from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.client import ClientApp
from ...schemas.client import ClientAppRegisterRequest, ClientAppResponse


router = APIRouter(prefix="/client-apps", tags=["client-apps"])


@router.post("/register", response_model=ClientAppResponse, status_code=201)
async def register_client_app(payload: ClientAppRegisterRequest) -> ClientAppResponse:
    async with get_session() as session:
        app = ClientApp(
            type=payload.type,
            name=payload.name,
            version=payload.version,
            platform=payload.platform,
            install_id=payload.install_id,
            meta=payload.meta or {},
        )
        session.add(app)
        await session.commit()
        await session.refresh(app)
        return ClientAppResponse(
            id=str(app.id), type=app.type, name=app.name, version=app.version, platform=app.platform,
            install_id=app.install_id, meta=dict(app.meta or {}), created_at=app.created_at, last_seen_at=app.last_seen_at
        )


@router.post("/{app_id}/heartbeat", response_model=ClientAppResponse)
async def heartbeat(app_id: str) -> ClientAppResponse:
    async with get_session() as session:
        stmt = select(ClientApp).where(ClientApp.id == app_id)
        res = await session.exec(stmt)
        app = res.first()
        if not app:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Client app not found"})
        app.last_seen_at = datetime.utcnow()
        await session.commit()
        await session.refresh(app)
        return ClientAppResponse(
            id=str(app.id), type=app.type, name=app.name, version=app.version, platform=app.platform,
            install_id=app.install_id, meta=dict(app.meta or {}), created_at=app.created_at, last_seen_at=app.last_seen_at
        )


@router.get("", response_model=list[ClientAppResponse])
async def list_client_apps(limit: int = 50, offset: int = 0) -> list[ClientAppResponse]:
    async with get_session() as session:
        stmt = select(ClientApp).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            ClientAppResponse(
                id=str(app.id), type=app.type, name=app.name, version=app.version, platform=app.platform,
                install_id=app.install_id, meta=dict(app.meta or {}), created_at=app.created_at, last_seen_at=app.last_seen_at
            )
            for app in items
        ]


@router.get("/{app_id}", response_model=ClientAppResponse)
async def get_client_app(app_id: str) -> ClientAppResponse:
    async with get_session() as session:
        stmt = select(ClientApp).where(ClientApp.id == app_id)
        res = await session.exec(stmt)
        app = res.first()
        if not app:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Client app not found"})
        return ClientAppResponse(
            id=str(app.id), type=app.type, name=app.name, version=app.version, platform=app.platform,
            install_id=app.install_id, meta=dict(app.meta or {}), created_at=app.created_at, last_seen_at=app.last_seen_at
        )


