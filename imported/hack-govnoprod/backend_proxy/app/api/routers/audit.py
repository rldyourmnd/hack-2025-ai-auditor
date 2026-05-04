from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.telemetry import AuditLog


router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list)
async def list_audit_logs(limit: int = 50, offset: int = 0):
    async with get_session() as session:
        stmt = select(AuditLog).order_by(AuditLog.ts.desc()).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(i.id), "ts": i.ts, "actor_user_id": i.actor_user_id, "action": i.action, "entity_type": i.entity_type, "entity_id": i.entity_id}
            for i in items
        ]


