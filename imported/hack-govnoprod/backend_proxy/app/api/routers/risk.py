from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.users import Prompt
from ...models.orm.recommendation import Recommendation


router = APIRouter(prefix="/analysis-runs/{run_id}/risk", tags=["risk"])


@router.get("")
async def get_risk(run_id: str) -> dict:
    # MVP: no dedicated risk table; derive empty
    return {"risk_level": "medium", "factors": [], "recommendations": []}


@router.post("")
async def set_risk(run_id: str, risk_level: str, factors: list[dict], recommendations: list[dict]) -> dict:
    # MVP: accept payload and echo
    return {"status": "ok"}


