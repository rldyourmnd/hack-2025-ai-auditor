from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.repo import Workspace


router = APIRouter(prefix="/projects/{project_id}/workspaces", tags=["workspaces"])


@router.post("", response_model=dict, status_code=201)
async def create_workspace(project_id: str, name: str, user_id: str | None = None, client_app_id: str | None = None, device_id: str | None = None) -> dict:
    async with get_session() as session:
        w = Workspace(project_id=project_id, name=name, user_id=user_id, client_app_id=client_app_id, device_id=device_id)
        session.add(w)
        await session.commit()
        await session.refresh(w)
        return {
            "id": str(w.id),
            "project_id": w.project_id,
            "name": w.name,
            "meta": w.meta,
            "created_at": w.created_at,
            "updated_at": w.updated_at,
        }


@router.get("", response_model=list[dict])
async def list_workspaces(project_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(Workspace).where(Workspace.project_id == project_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {
                "id": str(w.id),
                "project_id": w.project_id,
                "name": w.name,
                "meta": w.meta,
                "created_at": w.created_at,
                "updated_at": w.updated_at,
            }
            for w in items
        ]


@router.get("/{ws_id}", response_model=dict)
async def get_workspace(project_id: str, ws_id: str) -> dict:
    async with get_session() as session:
        stmt = select(Workspace).where(Workspace.id == ws_id, Workspace.project_id == project_id)
        res = await session.exec(stmt)
        w = res.first()
        if not w:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Workspace not found"})
        return {
            "id": str(w.id),
            "project_id": w.project_id,
            "name": w.name,
            "meta": w.meta,
            "created_at": w.created_at,
            "updated_at": w.updated_at,
        }


@router.patch("/{ws_id}", response_model=dict)
async def update_workspace(project_id: str, ws_id: str, name: str | None = None, meta: dict | None = None) -> dict:
    async with get_session() as session:
        stmt = select(Workspace).where(Workspace.id == ws_id, Workspace.project_id == project_id)
        res = await session.exec(stmt)
        w = res.first()
        if not w:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Workspace not found"})
        if name is not None:
            w.name = name
        if meta is not None:
            w.meta = meta
        await session.commit()
        await session.refresh(w)
        return {
            "id": str(w.id),
            "project_id": w.project_id,
            "name": w.name,
            "meta": w.meta,
            "created_at": w.created_at,
            "updated_at": w.updated_at,
        }


@router.delete("/{ws_id}", status_code=204, response_model=None)
async def delete_workspace(project_id: str, ws_id: str) -> None:
    async with get_session() as session:
        stmt = select(Workspace).where(Workspace.id == ws_id, Workspace.project_id == project_id)
        res = await session.exec(stmt)
        w = res.first()
        if not w:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Workspace not found"})
        await session.delete(w)
        await session.commit()
        return None


