from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import text

from ...db.session import get_session


router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/timeseries")
async def metric_timeseries(project_id: str, metric_key: str, from_: str, to: str, interval: str) -> dict:
    # MVP raw query to mart.metric_timeseries
    async with get_session() as session:
        res = await session.exec(
            text(
                "SELECT ts_bucket, value_num, value_json FROM mart.metric_timeseries WHERE project_id=:pid AND metric_key=:key AND ts_bucket BETWEEN :from AND :to ORDER BY ts_bucket"
            ),
            {"pid": project_id, "key": metric_key, "from": from_, "to": to},
        )
        rows = res.all()
        return {"data": [{"ts": r.ts_bucket, "value_num": r.value_num, "value_json": r.value_json} for r in rows]}


@router.get("/daily/features")
async def daily_features(project_id: str, from_: str, to: str) -> dict:
    async with get_session() as session:
        res = await session.exec(text("SELECT day, feature_key, events, unique_users FROM mart.feature_daily WHERE project_id=:pid AND day BETWEEN :from AND :to ORDER BY day"), {"pid": project_id, "from": from_, "to": to})
        rows = res.all()
        return {"data": [{"day": r.day, "feature_key": r.feature_key, "events": r.events, "unique_users": r.unique_users} for r in rows]}


@router.get("/daily/models")
async def daily_models(project_id: str, from_: str, to: str) -> dict:
    async with get_session() as session:
        res = await session.exec(text("SELECT day, llm_model_id, invocations, tokens_in, tokens_out, avg_latency_ms, cost_estimated FROM mart.model_daily WHERE project_id=:pid AND day BETWEEN :from AND :to ORDER BY day"), {"pid": project_id, "from": from_, "to": to})
        rows = res.all()
        return {"data": [{"day": r.day, "llm_model_id": str(r.llm_model_id), "invocations": r.invocations, "tokens_in": r.tokens_in, "tokens_out": r.tokens_out, "avg_latency_ms": r.avg_latency_ms, "cost_estimated": r.cost_estimated} for r in rows]}


@router.get("/daily/analysis")
async def daily_analysis(project_id: str, from_: str, to: str) -> dict:
    async with get_session() as session:
        res = await session.exec(text("SELECT day, analyses, avg_overall, avg_entropy FROM mart.analysis_daily WHERE project_id=:pid AND day BETWEEN :from AND :to ORDER BY day"), {"pid": project_id, "from": from_, "to": to})
        rows = res.all()
        return {"data": [{"day": r.day, "analyses": r.analyses, "avg_overall": r.avg_overall, "avg_entropy": r.avg_entropy} for r in rows]}


@router.get("/daily/project-kpi")
async def daily_project_kpi(project_id: str, from_: str, to: str) -> dict:
    async with get_session() as session:
        res = await session.exec(text("SELECT day, dau, sessions, new_users, api_calls, error_rate, avg_response_ms, avg_session_sec FROM mart.project_kpi_daily WHERE project_id=:pid AND day BETWEEN :from AND :to ORDER BY day"), {"pid": project_id, "from": from_, "to": to})
        rows = res.all()
        return {"data": [{"day": r.day, "dau": r.dau, "sessions": r.sessions, "new_users": r.new_users, "api_calls": r.api_calls, "error_rate": r.error_rate, "avg_response_ms": r.avg_response_ms, "avg_session_sec": r.avg_session_sec} for r in rows]}


