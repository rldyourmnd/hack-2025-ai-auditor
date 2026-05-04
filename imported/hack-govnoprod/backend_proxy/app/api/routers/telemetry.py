from __future__ import annotations

import time
from fastapi import APIRouter, Request
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.telemetry import HTTPRequestLog


router = APIRouter(prefix="/telemetry", tags=["telemetry"])


@router.get("/http-requests", response_model=list)
async def list_http_requests(limit: int = 50, offset: int = 0):
    async with get_session() as session:
        stmt = select(HTTPRequestLog).order_by(HTTPRequestLog.ts.desc()).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(i.id), "ts": i.ts, "method": i.method, "path": i.path, "status_code": i.status_code, "latency_ms": i.latency_ms}
            for i in items
        ]


