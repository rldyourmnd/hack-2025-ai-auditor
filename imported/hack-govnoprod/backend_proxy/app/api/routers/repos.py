from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.repo import Repo, RepoFile
from ...schemas.repo import RepoRead, RepoFileRead


router = APIRouter(prefix="/projects/{project_id}/repos", tags=["repos"])


@router.post("", response_model=RepoRead, status_code=201)
async def create_repo(project_id: str, provider: str, url: str, default_branch: str = "main") -> RepoRead:
    async with get_session() as session:
        r = Repo(project_id=project_id, provider=provider, url=url, default_branch=default_branch)
        session.add(r)
        await session.commit()
        await session.refresh(r)
        return RepoRead.model_validate(r)


@router.get("", response_model=list[RepoRead])
async def list_repos(project_id: str, limit: int = 50, offset: int = 0) -> list[RepoRead]:
    async with get_session() as session:
        stmt = select(Repo).where(Repo.project_id == project_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [RepoRead.model_validate(i) for i in items]


@router.get("/{repo_id}", response_model=RepoRead)
async def get_repo(project_id: str, repo_id: str) -> RepoRead:
    async with get_session() as session:
        stmt = select(Repo).where(Repo.id == repo_id, Repo.project_id == project_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Repo not found"})
        return RepoRead.model_validate(r)


@router.patch("/{repo_id}", response_model=RepoRead)
async def update_repo(project_id: str, repo_id: str, default_branch: str | None = None, meta: dict | None = None) -> RepoRead:
    async with get_session() as session:
        stmt = select(Repo).where(Repo.id == repo_id, Repo.project_id == project_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Repo not found"})
        if default_branch is not None:
            r.default_branch = default_branch
        if meta is not None:
            r.meta = meta
        await session.commit()
        await session.refresh(r)
        return RepoRead.model_validate(r)


@router.delete("/{repo_id}", status_code=204, response_model=None)
async def delete_repo(project_id: str, repo_id: str) -> None:
    async with get_session() as session:
        stmt = select(Repo).where(Repo.id == repo_id, Repo.project_id == project_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Repo not found"})
        await session.delete(r)
        await session.commit()
        return None


@router.post("/{repo_id}/sync", response_model=dict)
async def sync_repo(project_id: str, repo_id: str) -> dict:
    # MVP: record sync request; real sync would run external indexing
    return {"status": "queued", "repo_id": repo_id}


files_router = APIRouter(prefix="/repos/{repo_id}/files", tags=["repo-files"])


@files_router.get("", response_model=list[RepoFileRead])
async def list_repo_files(repo_id: str, path_prefix: str | None = None, language: str | None = None, limit: int = 50, offset: int = 0) -> list[RepoFileRead]:
    async with get_session() as session:
        stmt = select(RepoFile).where(RepoFile.repo_id == repo_id)
        if path_prefix:
            stmt = stmt.where(RepoFile.path.startswith(path_prefix))
        if language:
            stmt = stmt.where(RepoFile.language == language)
        stmt = stmt.limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [RepoFileRead.model_validate(i) for i in items]


@files_router.get("/{file_id}", response_model=RepoFileRead)
async def get_repo_file(repo_id: str, file_id: str) -> RepoFileRead:
    async with get_session() as session:
        stmt = select(RepoFile).where(RepoFile.id == file_id, RepoFile.repo_id == repo_id)
        res = await session.exec(stmt)
        f = res.first()
        if not f:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Repo file not found"})
        return RepoFileRead.model_validate(f)


