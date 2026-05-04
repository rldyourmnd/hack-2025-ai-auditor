from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from ...config import Settings
import time
import logging

logger = logging.getLogger(__name__)
from ...db.session import get_session
from ...models.orm.analysis import AnalysisRun
from ...services.prompt_base_adapter import get_prompt_content
from fastapi import Request
from ...config import Settings
from ...schemas.analyze import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalyzeApplyRequest,
    AnalyzeApplyResponse,
    AnalyzeClarifyRequest,
    AnalyzeClarifyResponse,
)


router = APIRouter(prefix="/analyze", tags=["analyze"])


async def _backend_client(timeout: int | None = None) -> httpx.AsyncClient:
    to = timeout or Settings().backend_timeout
    return httpx.AsyncClient(timeout=to)


def _backend_base() -> str:
    # Prefer explicit env BACKEND_API_URL; fallback to docker-compose service name 'api:8000'
    # and then to localhost:8001 for bare metal dev.
    return Settings().backend_api_url or "http://api:8000"


async def _call_backend(base: str, endpoint: str, payload: dict, headers: dict) -> dict:
    url = f"{base}{endpoint}"
    async with await _backend_client() as client:
        try:
            resp = await client.post(url, json=payload, headers=headers)
        except Exception as exc:
            logger.exception("backend request failed %s", url)
            raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": str(exc)})
        text = resp.text
        if resp.status_code >= 400:
            logger.error("upstream error %s %s headers=%s body=%s", resp.status_code, url, headers, text)
            raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": text})
        try:
            data = resp.json()
        except Exception:
            logger.exception("failed to parse json from upstream %s", url)
            logger.error("upstream body: %s", text)
            raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": "invalid json from backend"})
    return data


@router.post("", response_model=AnalyzeResponse)
@router.post("/", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest, request: Request) -> AnalyzeResponse:
    """Proxy analyze: translate proxy request shape to backend `/api/v1/analyze` shape.

    Supports either `inline_prompt` or `prompt_id` (will fetch prompt content from local DB).
    """
    t0 = time.perf_counter()
    try:
        client_ip = getattr(getattr(request, "client", None), "host", "?")
        clen = request.headers.get("content-length")
        logger.info("analyze: incoming POST from %s len=%s ua=%s", client_ip, clen, request.headers.get("user-agent", ""))
    except Exception:
        pass

    base = _backend_base()

    # resolve prompt content
    prompt_content: str | None = None
    prompt_source: str = ""
    if payload.inline_prompt:
        prompt_content = payload.inline_prompt
        prompt_source = "inline"
    elif payload.prompt_id:
        # fetch prompt content from upstream Prompt Base via adapter
        try:
            prompt_content = await get_prompt_content(payload.prompt_id, dict(request.headers))
            prompt_source = "by_id"
        except httpx.HTTPStatusError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "prompt not found"})
            raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": "upstream error"})
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail={"error_code": "backend_timeout", "message": "prompt-base timeout"})
        except Exception as exc:  # noqa: BLE001
            logger.exception("failed to fetch prompt by id: %s", exc)
            raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": "prompt-base error"})
    else:
        raise HTTPException(status_code=400, detail={"error_code": "bad_request", "message": "either prompt_id or inline_prompt must be provided"})

    # build backend-compatible payload
    options = payload.options or {}
    backend_payload = {
        "prompt": {
            "content": prompt_content,
            "format_type": options.get("format_type", "auto"),
            "language": options.get("language", None),
            "metadata": options.get("metadata", {}),
        },
        "include_entropy": options.get("include_entropy", True),
        "include_clarify": options.get("include_clarify", True),
        "include_patches": options.get("include_patches", True),
    }

    # forward incoming auth headers (Authorization, Cookie) if present
    headers: dict[str, str] = {}
    auth_header = request.headers.get("authorization")
    cookie_header = request.headers.get("cookie")
    if auth_header:
        headers["authorization"] = auth_header
    if cookie_header:
        headers["cookie"] = cookie_header

    # call backend and handle/log upstream errors
    async def _call_backend(endpoint: str, payload: dict, headers: dict) -> dict:
        url = f"{base}{endpoint}"
        async with await _backend_client() as client:
            try:
                t0_u = time.perf_counter()
                resp = await client.post(url, json=payload, headers=headers)
                dt_u_ms = int((time.perf_counter() - t0_u) * 1000)
                try:
                    logger.info("analyze.upstream: %s %s in %d ms", resp.status_code, url, dt_u_ms)
                except Exception:
                    pass
            except Exception as exc:
                logger.exception("backend request failed %s", url)
                raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": str(exc)})
            text = resp.text
            if resp.status_code >= 400:
                logger.error("upstream error %s %s time_ms=%s headers=%s body=%s", resp.status_code, url, dt_u_ms, headers, text)
                raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": text})
            try:
                data = resp.json()
            except Exception as exc:
                logger.exception("failed to parse json from upstream %s", url)
                logger.error("upstream body: %s", text)
                raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": "invalid json from backend"})
        return data

    logger.info("analyze: forwarding to backend %s/analyze/", base)
    data = await _call_backend("/analyze/", backend_payload, headers)

    # persist run skeleton
    async with get_session() as session:
        run = AnalysisRun(
            project_id=options.get("project_id", ""),
            status="succeeded",
            prompt_id=payload.prompt_id if prompt_source == "by_id" else None,
            meta={
                "backend": data,
                "prompt_source": prompt_source,
                "prompt_id": payload.prompt_id if payload.prompt_id else None,
            },
        )
        session.add(run)
        await session.commit()

    dt_ms = int((time.perf_counter() - t0) * 1000)
    logger.info("analyze: completed in %d ms", dt_ms)
    return AnalyzeResponse(report=data.get("report", {}), patches=data.get("patches", []), questions=data.get("questions", []))


@router.post("/apply", response_model=AnalyzeApplyResponse)
async def analyze_apply(payload: AnalyzeApplyRequest, request: Request) -> AnalyzeApplyResponse:
    base = _backend_base()
    headers: dict[str, str] = {}
    auth_header = request.headers.get("authorization")
    cookie_header = request.headers.get("cookie")
    if auth_header:
        headers["authorization"] = auth_header
    if cookie_header:
        headers["cookie"] = cookie_header
    data = await _call_backend("/analyze/apply", payload.model_dump(), headers)
    return AnalyzeApplyResponse(
        improved_prompt=data.get("improved_prompt", ""), applied_patches=data.get("applied_patches", []), quality_gain=float(data.get("quality_gain", 0.0))
    )


@router.post("/clarify", response_model=AnalyzeClarifyResponse)
async def analyze_clarify(payload: AnalyzeClarifyRequest, request: Request) -> AnalyzeClarifyResponse:
    base = _backend_base()
    headers: dict[str, str] = {}
    auth_header = request.headers.get("authorization")
    cookie_header = request.headers.get("cookie")
    if auth_header:
        headers["authorization"] = auth_header
    if cookie_header:
        headers["cookie"] = cookie_header
    data = await _call_backend("/analyze/clarify", payload.model_dump(), headers)
    return AnalyzeClarifyResponse(report=data.get("report", {}), patches=data.get("patches", []), questions=data.get("questions", []))


