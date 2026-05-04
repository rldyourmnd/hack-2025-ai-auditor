from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.judge import JudgeRubric, JudgeCriterion, JudgeScore
from ...schemas.judge import JudgeRubricCreate, JudgeRubricRead, JudgeCriterionCreate, JudgeCriterionRead, JudgeScoreUpsert


rubrics = APIRouter(prefix="/projects/{project_id}/judge/rubrics", tags=["judge"])


@rubrics.post("", response_model=JudgeRubricRead, status_code=201)
async def create_rubric(project_id: str, payload: JudgeRubricCreate) -> JudgeRubricRead:
    async with get_session() as session:
        r = JudgeRubric(project_id=project_id, name=payload.name, description=payload.description, meta=payload.meta)
        session.add(r)
        await session.commit()
        await session.refresh(r)
        return JudgeRubricRead.model_validate(r)


@rubrics.get("", response_model=list[JudgeRubricRead])
async def list_rubrics(project_id: str, limit: int = 50, offset: int = 0) -> list[JudgeRubricRead]:
    async with get_session() as session:
        stmt = select(JudgeRubric).where(JudgeRubric.project_id == project_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        return [JudgeRubricRead.model_validate(i) for i in res.all()]


single = APIRouter(prefix="/judge/rubrics", tags=["judge"])


@single.get("/{rubric_id}", response_model=JudgeRubricRead)
async def get_rubric(rubric_id: str) -> JudgeRubricRead:
    async with get_session() as session:
        stmt = select(JudgeRubric).where(JudgeRubric.id == rubric_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Rubric not found"})
        return JudgeRubricRead.model_validate(r)


@single.patch("/{rubric_id}", response_model=JudgeRubricRead)
async def update_rubric(rubric_id: str, name: str | None = None, description: str | None = None, meta: dict | None = None) -> JudgeRubricRead:
    async with get_session() as session:
        stmt = select(JudgeRubric).where(JudgeRubric.id == rubric_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Rubric not found"})
        if name is not None:
            r.name = name
        if description is not None:
            r.description = description
        if meta is not None:
            r.meta = meta
        await session.commit()
        await session.refresh(r)
        return JudgeRubricRead.model_validate(r)


@single.delete("/{rubric_id}", status_code=204, response_model=None)
async def delete_rubric(rubric_id: str) -> None:
    async with get_session() as session:
        stmt = select(JudgeRubric).where(JudgeRubric.id == rubric_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Rubric not found"})
        await session.delete(r)
        await session.commit()
        return None


criteria = APIRouter(prefix="/judge/rubrics/{rubric_id}/criteria", tags=["judge"])


@criteria.post("", response_model=JudgeCriterionRead, status_code=201)
async def create_criterion(rubric_id: str, payload: JudgeCriterionCreate) -> JudgeCriterionRead:
    async with get_session() as session:
        c = JudgeCriterion(rubric_id=rubric_id, key=payload.key, title=payload.title, description=payload.description, weight=payload.weight)
        session.add(c)
        await session.commit()
        await session.refresh(c)
        return JudgeCriterionRead.model_validate(c)


@criteria.get("", response_model=list[JudgeCriterionRead])
async def list_criteria(rubric_id: str, limit: int = 50, offset: int = 0) -> list[JudgeCriterionRead]:
    async with get_session() as session:
        stmt = select(JudgeCriterion).where(JudgeCriterion.rubric_id == rubric_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        return [JudgeCriterionRead.model_validate(i) for i in res.all()]


@criteria.patch("/{criterion_id}", response_model=JudgeCriterionRead)
async def update_criterion(rubric_id: str, criterion_id: str, title: str | None = None, description: str | None = None, weight: float | None = None) -> JudgeCriterionRead:
    async with get_session() as session:
        stmt = select(JudgeCriterion).where(JudgeCriterion.id == criterion_id, JudgeCriterion.rubric_id == rubric_id)
        res = await session.exec(stmt)
        c = res.first()
        if not c:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Criterion not found"})
        if title is not None:
            c.title = title
        if description is not None:
            c.description = description
        if weight is not None:
            c.weight = weight
        await session.commit()
        await session.refresh(c)
        return JudgeCriterionRead.model_validate(c)


@criteria.delete("/{criterion_id}", status_code=204, response_model=None)
async def delete_criterion(rubric_id: str, criterion_id: str) -> None:
    async with get_session() as session:
        stmt = select(JudgeCriterion).where(JudgeCriterion.id == criterion_id, JudgeCriterion.rubric_id == rubric_id)
        res = await session.exec(stmt)
        c = res.first()
        if not c:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Criterion not found"})
        await session.delete(c)
        await session.commit()
        return None


scores = APIRouter(prefix="/analysis-runs/{run_id}/judge/scores", tags=["judge"])


@scores.post("", response_model=dict)
async def upsert_scores(run_id: str, items: list[JudgeScoreUpsert]) -> dict:
    async with get_session() as session:
        for it in items:
            # Try update then insert
            stmt = select(JudgeScore).where(JudgeScore.analysis_run_id == run_id, JudgeScore.criterion_id == it.criterion_id)
            res = await session.exec(stmt)
            s = res.first()
            if not s:
                s = JudgeScore(analysis_run_id=run_id, criterion_id=it.criterion_id, score=it.score, comment=it.comment, evidence=it.evidence)
                session.add(s)
            else:
                s.score = it.score
                s.comment = it.comment
                s.evidence = it.evidence
        await session.commit()
        return {"status": "ok"}


@scores.get("", response_model=list[dict])
async def list_scores(run_id: str, limit: int = 100, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(JudgeScore).where(JudgeScore.analysis_run_id == run_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(s.id), "criterion_id": s.criterion_id, "score": s.score, "comment": s.comment, "evidence": s.evidence, "created_at": s.created_at}
            for s in items
        ]


