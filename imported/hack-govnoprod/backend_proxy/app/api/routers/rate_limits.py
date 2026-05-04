from __future__ import annotations

from fastapi import APIRouter


router = APIRouter(prefix="/rate-limits", tags=["rate-limits"])


@router.get("/current")
async def rate_limits_current():
    # MVP: static stub; replace with real computation later
    return {"scopes": [], "limits": []}


