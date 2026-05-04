from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.users import Project
from ...schemas.projects import ProjectCreate, ProjectUpdate, ProjectResponse


router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(payload: ProjectCreate) -> ProjectResponse:
    async with get_session() as session:
        p = Project(organization_id=payload.organization_id, name=payload.name, key=payload.key)
        session.add(p)
        await session.commit()
        await session.refresh(p)
        return ProjectResponse(id=str(p.id), organization_id=p.organization_id, name=p.name, key=p.key, created_at=p.created_at)


@router.get("", response_model=list[ProjectResponse])
async def list_projects(limit: int = 50, offset: int = 0, organization_id: str | None = None) -> list[ProjectResponse]:
    async with get_session() as session:
        stmt = select(Project)
        if organization_id:
            stmt = stmt.where(Project.organization_id == organization_id)
        stmt = stmt.limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [ProjectResponse(id=str(p.id), organization_id=p.organization_id, name=p.name, key=p.key, created_at=p.created_at) for p in items]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: str) -> ProjectResponse:
    async with get_session() as session:
        stmt = select(Project).where(Project.id == project_id)
        res = await session.exec(stmt)
        p = res.first()
        if not p:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Project not found"})
        return ProjectResponse(id=str(p.id), organization_id=p.organization_id, name=p.name, key=p.key, created_at=p.created_at)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, payload: ProjectUpdate) -> ProjectResponse:
    async with get_session() as session:
        stmt = select(Project).where(Project.id == project_id)
        res = await session.exec(stmt)
        p = res.first()
        if not p:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Project not found"})
        if payload.name is not None:
            p.name = payload.name
        if payload.key is not None:
            p.key = payload.key
        await session.commit()
        await session.refresh(p)
        return ProjectResponse(id=str(p.id), organization_id=p.organization_id, name=p.name, key=p.key, created_at=p.created_at)


@router.delete("/{project_id}", status_code=204, response_model=None)
async def delete_project(project_id: str) -> None:
    async with get_session() as session:
        stmt = select(Project).where(Project.id == project_id)
        res = await session.exec(stmt)
        p = res.first()
        if not p:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Project not found"})
        await session.delete(p)
        await session.commit()
        return None


