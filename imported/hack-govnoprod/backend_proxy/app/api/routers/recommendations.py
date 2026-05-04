from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.recommendation import Recommendation, PromptRevision


router = APIRouter(prefix="/analysis-runs/{run_id}/recommendations", tags=["recommendations"])


@router.get("", response_model=list[dict])
async def list_recommendations(run_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(Recommendation).where(Recommendation.analysis_run_id == run_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(r.id), "kind": r.kind, "title": r.title, "body": r.body, "priority": r.priority, "meta": r.meta, "created_at": r.created_at}
            for r in items
        ]


revisions = APIRouter(prefix="/prompts/{prompt_id}/revisions", tags=["prompt-revisions"])


@revisions.post("", response_model=dict, status_code=201)
async def create_revision(prompt_id: str, revised_content: str, improvement_summary: str | None = None, author_user_id: str | None = None) -> dict:
    async with get_session() as session:
        rev = PromptRevision(prompt_id=prompt_id, analysis_id=None, revised_content=revised_content, improvement_summary=improvement_summary, author_user_id=author_user_id)
        session.add(rev)
        await session.commit()
        await session.refresh(rev)
        return {"id": str(rev.id), "prompt_id": str(rev.prompt_id), "created_at": rev.created_at}


@revisions.get("", response_model=list[dict])
async def list_revisions(prompt_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(PromptRevision).where(PromptRevision.prompt_id == prompt_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(r.id), "prompt_id": str(r.prompt_id), "improvement_summary": r.improvement_summary, "quality_gain": r.quality_gain, "created_at": r.created_at}
            for r in items
        ]


@revisions.get("/{rev_id}", response_model=dict)
async def get_revision(prompt_id: str, rev_id: str) -> dict:
    async with get_session() as session:
        stmt = select(PromptRevision).where(PromptRevision.id == rev_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Revision not found"})
        return {
            "id": str(r.id),
            "prompt_id": str(r.prompt_id),
            "revised_content": r.revised_content,
            "improvement_summary": r.improvement_summary,
            "author_user_id": r.author_user_id,
            "applied_patch_ids": r.applied_patch_ids,
            "quality_gain": r.quality_gain,
            "created_at": r.created_at,
        }


@revisions.delete("/{rev_id}", status_code=204, response_model=None)
async def delete_revision(prompt_id: str, rev_id: str) -> None:
    async with get_session() as session:
        stmt = select(PromptRevision).where(PromptRevision.id == rev_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Revision not found"})
        await session.delete(r)
        await session.commit()
        return None


