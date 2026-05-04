from __future__ import annotations

from fastapi import APIRouter, Request, HTTPException, Response

from ...services.prompt_base_adapter import get_prompt_base_adapter
from ...config import Settings

router = APIRouter(prefix="/prompts/{prompt_id}/relations", tags=["prompt-relations"])


del_router = APIRouter(prefix="/prompt-relations", tags=["prompt-relations"])


def _ensure_compat_enabled_or_raise() -> None:
    s = Settings()
    if not s.prompt_base_url:
        raise HTTPException(status_code=500, detail={"error_code": "misconfigured", "message": "PROMPT_BASE_URL not set"})


@router.post("", status_code=201)
async def create_relation(prompt_id: str, request: Request):
    _ensure_compat_enabled_or_raise()
    body = await request.json()
    to_id = body.get("to_id") or body.get("to_prompt_id")
    relation_type = body.get("relation_type")
    description = body.get("description")
    adapter = await get_prompt_base_adapter()
    status, data, headers = await adapter.create_relation(prompt_id, to_id, relation_type, description, headers_in=dict(request.headers))
    if data is None or data == "":
        return Response(status_code=status, headers=headers)
    return Response(content=data if isinstance(data, (bytes, bytearray)) else data, status_code=status, headers=headers)


@router.get("", response_model=list[dict])
async def list_relations(prompt_id: str, request: Request, limit: int = 50, offset: int = 0) -> list[dict]:
    _ensure_compat_enabled_or_raise()
    params = dict(request.query_params)
    adapter = await get_prompt_base_adapter()
    status, data, headers = await adapter.list_relations(prompt_id, params=params, headers_in=dict(request.headers))
    return data


@del_router.delete("/{relation_id}", status_code=204, response_model=None)
async def delete_relation(relation_id: str, request: Request) -> None:
    _ensure_compat_enabled_or_raise()
    adapter = await get_prompt_base_adapter()
    status, data, headers = await adapter.delete_relation(relation_id, headers_in=dict(request.headers))
    if status == 204:
        return Response(status_code=204)
    if data is None or data == "":
        raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Relation not found"})
    return Response(content=data, status_code=status)


