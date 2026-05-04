from __future__ import annotations

from fastapi import APIRouter

router = APIRouter()


@router.get("/healthz")
async def healthz() -> dict:
    return {"status": "ok"}


@router.get("/about")
async def about() -> dict:
    # minimal about; can be extended with git SHA, versions, env summary
    return {"service": "backend_proxy"}


