from __future__ import annotations

from fastapi import APIRouter
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.capture import CaptureEvent, CLIInvocation, IDEInstallation


router = APIRouter(prefix="/capture", tags=["capture"])


@router.post("/events", response_model=dict, status_code=201)
async def create_event(project_id: str | None, user_id: str | None, session_id: str | None, client_app_id: str | None, kind: str, name: str, severity: str, payload: dict) -> dict:
    async with get_session() as session:
        ev = CaptureEvent(project_id=project_id, user_id=user_id, session_id=session_id, client_app_id=client_app_id, kind=kind, name=name, severity=severity, payload=payload or {})
        session.add(ev)
        await session.commit()
        await session.refresh(ev)
        return {"id": str(ev.id), "ts": ev.ts}


@router.post("/cli", response_model=dict, status_code=201)
async def create_cli(capture_event_id: str, command: str, args: list[str], exit_code: int | None = None, duration_ms: int | None = None) -> dict:
    async with get_session() as session:
        rec = CLIInvocation(capture_event_id=capture_event_id, command=command, args=args or [], exit_code=exit_code, duration_ms=duration_ms)
        session.add(rec)
        await session.commit()
        await session.refresh(rec)
        return {"id": str(rec.id)}


@router.post("/ide-installations", response_model=dict, status_code=201)
async def create_ide_installation(capture_event_id: str, ide: str, version: str, os: str, success: bool, meta: dict | None = None) -> dict:
    async with get_session() as session:
        rec = IDEInstallation(capture_event_id=capture_event_id, ide=ide, version=version, os=os, success=success, meta=meta or {})
        session.add(rec)
        await session.commit()
        await session.refresh(rec)
        return {"id": str(rec.id)}


@router.get("/events", response_model=list)
async def list_events(limit: int = 50, offset: int = 0):
    async with get_session() as session:
        stmt = select(CaptureEvent).order_by(CaptureEvent.ts.desc()).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(e.id), "ts": e.ts, "project_id": e.project_id, "user_id": e.user_id, "kind": e.kind, "name": e.name, "severity": e.severity}
            for e in items
        ]


