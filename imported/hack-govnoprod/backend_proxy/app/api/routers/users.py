from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.users import User
from ...services.auth_service import AuthService
from ...config import Settings


router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(User).limit(limit).offset(offset)
        res = await session.execute(stmt)
        items = res.scalars().all()
        return [
            {"id": str(u.id), "email": u.email, "display_name": u.display_name, "created_at": u.created_at}
            for u in items
        ]


@router.get("/{user_id}")
async def get_user(user_id: str) -> dict:
    async with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        res = await session.execute(stmt)
        u = res.scalars().first()
        if not u:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "User not found"})
        return {"id": str(u.id), "email": u.email, "display_name": u.display_name, "created_at": u.created_at}


@router.patch("/{user_id}")
async def patch_user(user_id: str, email: str | None = None, display_name: str | None = None, password: str | None = None) -> dict:
    async with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        res = await session.execute(stmt)
        u = res.scalars().first()
        if not u:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "User not found"})
        if email is not None:
            u.email = email
        if display_name is not None:
            u.display_name = display_name
        if password is not None:
            svc = AuthService(Settings())
            # type: ignore[attr-defined]
            setattr(u, "password_hash", svc.hash_password(password))
        await session.commit()
        await session.refresh(u)
        return {"id": str(u.id), "email": u.email, "display_name": u.display_name, "created_at": u.created_at}


@router.delete("/{user_id}", status_code=204, response_model=None)
async def delete_user(user_id: str) -> None:
    async with get_session() as session:
        stmt = select(User).where(User.id == user_id)
        res = await session.exec(stmt)
        u = res.first()
        if not u:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "User not found"})
        await session.delete(u)
        await session.commit()
        return None


