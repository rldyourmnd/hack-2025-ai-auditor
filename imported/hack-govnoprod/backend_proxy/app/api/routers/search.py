from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import text

from ...db.session import get_session


router = APIRouter(prefix="/prompts:search", tags=["prompts"])


@router.get("")
async def search_prompts(q: str, project_id: str | None = None, limit: int = 50, offset: int = 0) -> dict:
    where = ["content ILIKE :q OR title ILIKE :q"]
    params = {"q": f"%{q}%", "limit": limit, "offset": offset}
    if project_id:
        where.append("project_id = :pid")
        params["pid"] = project_id
    sql = f"SELECT id, project_id, title, created_at FROM ops.prompts WHERE {' AND '.join(where)} ORDER BY created_at DESC LIMIT :limit OFFSET :offset"
    async with get_session() as session:
        res = await session.exec(text(sql), params)
        rows = res.all()
        return {"data": [{"id": str(r.id), "project_id": str(r.project_id), "title": r.title, "created_at": r.created_at} for r in rows], "meta": {"limit": limit, "offset": offset}}


