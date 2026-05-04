from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, Response
from fastapi.responses import JSONResponse
import httpx
import logging

from ...config import Settings

logger = logging.getLogger(__name__)

_ENABLED = bool(Settings().prompt_base_compat_enabled)

if not _ENABLED:
    logger.info("prompt_base_compat disabled by config; not registering compat routes")
else:
    router = APIRouter(prefix="/prompt-base", tags=["prompt-base-compat (experimental)"])


    async def _client(timeout: int | None = None) -> httpx.AsyncClient:
        to = timeout or Settings().backend_timeout
        return httpx.AsyncClient(timeout=to)


    def _backend_base() -> str:
        return Settings().backend_api_url or "http://api:8000"


    async def _proxy_request(request: Request, method: str, path: str):
        base = _backend_base()
        url = f"{base}{path}"
        async with await _client() as client:
            headers = {}
            # forward important headers
            for hn in ("authorization", "traceparent", "x-request-id", "idempotency-key", "cookie"):
                v = request.headers.get(hn)
                if v:
                    headers[hn] = v
            try:
                body = await request.body()
                if body:
                    resp = await client.request(method, url, content=body, headers=headers, params=dict(request.query_params))
                else:
                    resp = await client.request(method, url, headers=headers, params=dict(request.query_params))
            except Exception as exc:
                logger.exception("proxy to backend failed %s %s", method, url)
                raise HTTPException(status_code=502, detail={"error_code": "backend_error", "message": str(exc)})

            status = resp.status_code
            # try to preserve JSON if present
            try:
                body_json = resp.json()
                return status, dict(resp.headers), body_json
            except Exception:
                return status, dict(resp.headers), resp.content


    def _build_response(status: int, headers: dict, body: object):
        # preserve upstream headers (filter unsafe)
        safe_headers = {k: v for k, v in headers.items() if k.lower() not in ("content-length", "content-encoding")}
        if isinstance(body, (bytes, bytearray)):
            return Response(content=body, status_code=status, headers=safe_headers)
        return JSONResponse(content=body, status_code=status, headers=safe_headers)


    @router.api_route("/add", methods=["POST"])
    async def add_prompt(request: Request):
        status, headers, body = await _proxy_request(request, "POST", "/prompt-base/add")
        return _build_response(status, headers, body)


    @router.api_route("/check", methods=["POST"])
    async def check_prompt(request: Request):
        status, headers, body = await _proxy_request(request, "POST", "/prompt-base/check")
        return _build_response(status, headers, body)


    @router.api_route("/prompts", methods=["GET"])
    async def list_prompts(request: Request):
        status, headers, body = await _proxy_request(request, "GET", "/prompt-base/prompts")
        return _build_response(status, headers, body)


    @router.api_route("/prompts/{prompt_id}", methods=["GET", "PUT", "DELETE"])
    async def prompt_crud(prompt_id: str, request: Request):
        path = f"/prompt-base/prompts/{prompt_id}"
        status, headers, body = await _proxy_request(request, request.method, path)
        return _build_response(status, headers, body)


    @router.api_route("/search", methods=["GET"])
    async def search_prompts(request: Request):
        status, headers, body = await _proxy_request(request, "GET", "/prompt-base/search")
        return _build_response(status, headers, body)


    @router.api_route("/relations", methods=["POST"])
    async def create_relation(request: Request):
        status, headers, body = await _proxy_request(request, "POST", "/prompt-base/relations")
        return _build_response(status, headers, body)


    @router.api_route("/prompts/{prompt_id}/relations", methods=["GET"])
    async def list_prompt_relations(prompt_id: str, request: Request):
        path = f"/prompt-base/prompts/{prompt_id}/relations"
        status, headers, body = await _proxy_request(request, "GET", path)
        return _build_response(status, headers, body)


    @router.api_route("/relations/{relation_id}", methods=["DELETE"])
    async def delete_relation(relation_id: str, request: Request):
        path = f"/prompt-base/relations/{relation_id}"
        status, headers, body = await _proxy_request(request, "DELETE", path)
        return _build_response(status, headers, body)


