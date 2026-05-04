from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse, Response

from ...services.prompt_base_adapter import get_prompt_base_adapter, PromptBaseAdapter
from ...config import Settings

router = APIRouter(prefix="/prompts", tags=["prompts"])


async def _adapter() -> "PromptBaseAdapter":
    return await get_prompt_base_adapter()


def _ensure_compat_enabled_or_raise() -> None:
    # For safety route: we allow proxying when prompt_base_url is configured.
    s = Settings()
    if not s.prompt_base_url:
        raise HTTPException(status_code=500, detail={"error_code": "misconfigured", "message": "PROMPT_BASE_URL not set"})


@router.post("")
async def create_prompt(request: Request):
    """Create prompt by proxying to upstream `/prompt-base/add` and returning upstream body as-is."""
    _ensure_compat_enabled_or_raise()
    adapter = await _adapter()
    body = await request.json()
    status, data, headers = await adapter.add(body, headers_in=dict(request.headers))
    if isinstance(data, (bytes, bytearray)):
        return Response(content=data, status_code=status, headers=headers)
    return JSONResponse(content=data, status_code=status, headers=headers)


@router.get("/{prompt_id}")
async def get_prompt(prompt_id: str, request: Request):
    _ensure_compat_enabled_or_raise()
    adapter = await _adapter()
    status, data, headers = await adapter.get(prompt_id, headers_in=dict(request.headers))
    if isinstance(data, (bytes, bytearray)):
        return Response(content=data, status_code=status, headers=headers)
    return JSONResponse(content=data, status_code=status, headers=headers)


@router.put("/{prompt_id}")
async def update_prompt(prompt_id: str, request: Request):
    _ensure_compat_enabled_or_raise()
    adapter = await _adapter()
    body = await request.json()
    status, data, headers = await adapter.update(prompt_id, body, headers_in=dict(request.headers))
    if isinstance(data, (bytes, bytearray)):
        return Response(content=data, status_code=status, headers=headers)
    return JSONResponse(content=data, status_code=status, headers=headers)


@router.delete("/{prompt_id}")
async def delete_prompt(prompt_id: str, request: Request):
    _ensure_compat_enabled_or_raise()
    adapter = await _adapter()
    status, data, headers = await adapter.delete(prompt_id, headers_in=dict(request.headers))
    # If upstream returns empty body, match status
    if data is None or data == "":
        return Response(status_code=status, headers=headers)
    if isinstance(data, (bytes, bytearray)):
        return Response(content=data, status_code=status, headers=headers)
    return JSONResponse(content=data, status_code=status, headers=headers)


@router.get(":search")
async def search_prompts(request: Request):
    _ensure_compat_enabled_or_raise()
    adapter = await _adapter()
    params = dict(request.query_params)
    status, data, headers = await adapter.search(params=params, headers_in=dict(request.headers))
    if isinstance(data, (bytes, bytearray)):
        return Response(content=data, status_code=status, headers=headers)
    return JSONResponse(content=data, status_code=status, headers=headers)


