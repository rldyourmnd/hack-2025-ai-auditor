from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.repo import PromptSource


router = APIRouter(prefix="/projects/{project_id}/prompt-sources", tags=["prompt-sources"])


@router.post("", response_model=dict, status_code=201)
async def create_prompt_source(project_id: str, kind: str, repo_file_id: str | None = None, workspace_id: str | None = None, meta: dict | None = None) -> dict:
    async with get_session() as session:
        src = PromptSource(project_id=project_id, kind=kind, repo_file_id=repo_file_id, workspace_id=workspace_id, meta=meta or {})
        session.add(src)
        await session.commit()
        await session.refresh(src)
        return {"id": str(src.id), "project_id": src.project_id, "kind": src.kind, "repo_file_id": src.repo_file_id, "workspace_id": src.workspace_id, "meta": src.meta, "created_at": src.created_at}


@router.get("", response_model=list[dict])
async def list_prompt_sources(project_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(PromptSource).where(PromptSource.project_id == project_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(src.id), "project_id": src.project_id, "kind": src.kind, "repo_file_id": src.repo_file_id, "workspace_id": src.workspace_id, "meta": src.meta, "created_at": src.created_at}
            for src in items
        ]


@router.get("/{source_id}", response_model=dict)
async def get_prompt_source(project_id: str, source_id: str) -> dict:
    async with get_session() as session:
        stmt = select(PromptSource).where(PromptSource.id == source_id, PromptSource.project_id == project_id)
        res = await session.exec(stmt)
        src = res.first()
        if not src:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Prompt source not found"})
        return {"id": str(src.id), "project_id": src.project_id, "kind": src.kind, "repo_file_id": src.repo_file_id, "workspace_id": src.workspace_id, "meta": src.meta, "created_at": src.created_at}


@router.patch("/{source_id}", response_model=dict)
async def update_prompt_source(project_id: str, source_id: str, kind: str | None = None, meta: dict | None = None) -> dict:
    async with get_session() as session:
        stmt = select(PromptSource).where(PromptSource.id == source_id, PromptSource.project_id == project_id)
        res = await session.exec(stmt)
        src = res.first()
        if not src:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Prompt source not found"})
        if kind is not None:
            src.kind = kind
        if meta is not None:
            src.meta = meta
        await session.commit()
        await session.refresh(src)
        return {"id": str(src.id), "project_id": src.project_id, "kind": src.kind, "repo_file_id": src.repo_file_id, "workspace_id": src.workspace_id, "meta": src.meta, "created_at": src.created_at}


@router.delete("/{source_id}", status_code=204, response_model=None)
async def delete_prompt_source(project_id: str, source_id: str) -> None:
    async with get_session() as session:
        stmt = select(PromptSource).where(PromptSource.id == source_id, PromptSource.project_id == project_id)
        res = await session.exec(stmt)
        src = res.first()
        if not src:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Prompt source not found"})
        await session.delete(src)
        await session.commit()
        return None


