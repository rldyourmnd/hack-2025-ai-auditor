from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.client import Device
from ...schemas.client import DeviceCreate, DeviceResponse


router = APIRouter(prefix="/devices", tags=["devices"])


@router.post("", response_model=DeviceResponse, status_code=201)
async def create_device(payload: DeviceCreate) -> DeviceResponse:
    async with get_session() as session:
        d = Device(user_id=payload.user_id, platform=payload.platform, meta=payload.meta or {})
        session.add(d)
        await session.commit()
        await session.refresh(d)
        return DeviceResponse(id=str(d.id), user_id=d.user_id, platform=d.platform, meta=dict(d.meta or {}), created_at=d.created_at)


@router.get("", response_model=list[DeviceResponse])
async def list_devices(limit: int = 50, offset: int = 0, user_id: str | None = None) -> list[DeviceResponse]:
    async with get_session() as session:
        stmt = select(Device)
        if user_id:
            stmt = stmt.where(Device.user_id == user_id)
        stmt = stmt.limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [DeviceResponse(id=str(d.id), user_id=d.user_id, platform=d.platform, meta=dict(d.meta or {}), created_at=d.created_at) for d in items]


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(device_id: str) -> DeviceResponse:
    async with get_session() as session:
        stmt = select(Device).where(Device.id == device_id)
        res = await session.exec(stmt)
        d = res.first()
        if not d:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Device not found"})
        return DeviceResponse(id=str(d.id), user_id=d.user_id, platform=d.platform, meta=dict(d.meta or {}), created_at=d.created_at)


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(device_id: str, platform: str | None = None, meta: dict | None = None) -> DeviceResponse:
    async with get_session() as session:
        stmt = select(Device).where(Device.id == device_id)
        res = await session.exec(stmt)
        d = res.first()
        if not d:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Device not found"})
        if platform is not None:
            d.platform = platform
        if meta is not None:
            d.meta = meta
        await session.commit()
        await session.refresh(d)
        return DeviceResponse(id=str(d.id), user_id=d.user_id, platform=d.platform, meta=dict(d.meta or {}), created_at=d.created_at)


@router.delete("/{device_id}", status_code=204, response_model=None)
async def delete_device(device_id: str) -> None:
    async with get_session() as session:
        stmt = select(Device).where(Device.id == device_id)
        res = await session.exec(stmt)
        d = res.first()
        if not d:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Device not found"})
        await session.delete(d)
        await session.commit()
        return None


