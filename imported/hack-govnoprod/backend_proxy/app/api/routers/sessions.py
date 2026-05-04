from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.client import Session
from ...schemas.client import SessionStartRequest, SessionResponse


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=201)
async def start_session(payload: SessionStartRequest) -> SessionResponse:
    async with get_session() as session:
        s = Session(user_id=payload.user_id, project_id=payload.project_id, client_app_id=payload.client_app_id)
        session.add(s)
        await session.commit()
        await session.refresh(s)
        return SessionResponse(
            id=str(s.id), user_id=s.user_id, project_id=s.project_id, client_app_id=s.client_app_id,
            started_at=s.started_at, finished_at=s.finished_at
        )


@router.patch("/{session_id}/finish", response_model=SessionResponse)
async def finish_session(session_id: str) -> SessionResponse:
    async with get_session() as session:
        stmt = select(Session).where(Session.id == session_id)
        res = await session.exec(stmt)
        s = res.first()
        if not s:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Session not found"})
        s.finished_at = datetime.utcnow()
        await session.commit()
        await session.refresh(s)
        return SessionResponse(
            id=str(s.id), user_id=s.user_id, project_id=s.project_id, client_app_id=s.client_app_id,
            started_at=s.started_at, finished_at=s.finished_at
        )


@router.get("", response_model=list[SessionResponse])
async def list_sessions(limit: int = 50, offset: int = 0, project_id: str | None = None, user_id: str | None = None) -> list[SessionResponse]:
    async with get_session() as session:
        stmt = select(Session)
        if project_id:
            stmt = stmt.where(Session.project_id == project_id)
        if user_id:
            stmt = stmt.where(Session.user_id == user_id)
        stmt = stmt.limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            SessionResponse(
                id=str(s.id), user_id=s.user_id, project_id=s.project_id, client_app_id=s.client_app_id,
                started_at=s.started_at, finished_at=s.finished_at
            )
            for s in items
        ]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str) -> SessionResponse:
    async with get_session() as session:
        stmt = select(Session).where(Session.id == session_id)
        res = await session.exec(stmt)
        s = res.first()
        if not s:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Session not found"})
        return SessionResponse(
            id=str(s.id), user_id=s.user_id, project_id=s.project_id, client_app_id=s.client_app_id,
            started_at=s.started_at, finished_at=s.finished_at
        )


