from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.analysis import AnalysisRun, AnalysisMetric, AnalysisNodeResult


router = APIRouter(prefix="/projects/{project_id}/analysis-runs", tags=["analysis-runs"])


@router.post("", response_model=dict, status_code=201)
async def create_run(project_id: str, prompt_id: str | None = None, prompt_version_id: str | None = None) -> dict:
    async with get_session() as session:
        run = AnalysisRun(project_id=project_id, status="queued", prompt_id=prompt_id, prompt_version_id=prompt_version_id)
        session.add(run)
        await session.commit()
        await session.refresh(run)
        return {"id": str(run.id), "project_id": run.project_id, "status": run.status, "started_at": run.started_at}


@router.get("", response_model=list[dict])
async def list_runs(project_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(AnalysisRun).where(AnalysisRun.project_id == project_id).order_by(AnalysisRun.started_at.desc()).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(r.id), "project_id": r.project_id, "status": r.status, "started_at": r.started_at, "finished_at": r.finished_at}
            for r in items
        ]


@router.get("/{run_id}", response_model=dict)
async def get_run(project_id: str, run_id: str) -> dict:
    async with get_session() as session:
        stmt = select(AnalysisRun).where(AnalysisRun.id == run_id, AnalysisRun.project_id == project_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Run not found"})
        return {"id": str(r.id), "project_id": r.project_id, "status": r.status, "started_at": r.started_at, "finished_at": r.finished_at}


@router.post("/{run_id}:cancel", response_model=dict)
async def cancel_run(project_id: str, run_id: str) -> dict:
    async with get_session() as session:
        stmt = select(AnalysisRun).where(AnalysisRun.id == run_id, AnalysisRun.project_id == project_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Run not found"})
        r.status = "canceled"
        await session.commit()
        return {"id": str(r.id), "status": r.status}


# Subresources (read-only listings)
sub = APIRouter(prefix="/analysis-runs/{run_id}", tags=["analysis-run-subresources"])


@sub.get("/metrics")
async def run_metrics(run_id: str, limit: int = 100, offset: int = 0) -> dict:
    async with get_session() as session:
        stmt = select(AnalysisMetric).where(AnalysisMetric.analysis_run_id == run_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return {"data": [
            {"id": str(m.id), "key": m.key, "value_num": m.value_num, "value_text": m.value_text, "value_json": m.value_json, "created_at": m.created_at}
        for m in items], "meta": {"limit": limit, "offset": offset}}


@sub.get("/nodes")
async def run_nodes(run_id: str, limit: int = 100, offset: int = 0) -> dict:
    async with get_session() as session:
        stmt = select(AnalysisNodeResult).where(AnalysisNodeResult.analysis_run_id == run_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return {"data": [
            {"id": str(n.id), "node": n.node, "status": n.status, "score": n.score, "details": n.details, "created_at": n.created_at}
        for n in items], "meta": {"limit": limit, "offset": offset}}


