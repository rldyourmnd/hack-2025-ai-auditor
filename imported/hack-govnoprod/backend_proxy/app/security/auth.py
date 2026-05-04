from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from jose import jwt, JWTError
from sqlmodel import select

from ..config import Settings
from ..db.session import get_session
from ..models.orm.identity import APIKey


@dataclass
class AuthContext:
    user_id: Optional[str]
    org_id: Optional[str]
    project_id: Optional[str]
    client_app_id: Optional[str]
    session_id: Optional[str]


def _is_jwt(token: str) -> bool:
    return token.count(".") == 2


async def _validate_api_key(token: str) -> Optional[AuthContext]:
    import hashlib

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    async with get_session() as session:
        stmt = select(APIKey).where(APIKey.key_hash == token_hash, APIKey.is_revoked == False)  # noqa: E712
        res = await session.exec(stmt)
        k = res.first()
        if not k:
            return None
        if k.expires_at and k.expires_at <= datetime.now(timezone.utc):
            return None
        return AuthContext(
            user_id=k.user_id,
            org_id=k.organization_id,
            project_id=k.project_id,
            client_app_id=None,
            session_id=None,
        )


async def _validate_jwt(token: str, settings: Settings) -> Optional[AuthContext]:
    try:
        payload = jwt.decode(token, settings.jwt_secret or "dev-secret-change-me", algorithms=["HS256"])  # type: ignore[arg-type]
    except JWTError:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return AuthContext(user_id=str(user_id), org_id=None, project_id=None, client_app_id=None, session_id=None)


def get_settings() -> Settings:
    return Settings()


async def require_auth(request: Request, settings: Settings = Depends(get_settings)) -> AuthContext:
    authz = request.headers.get("Authorization", "")
    if not authz.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error_code": "unauthorized", "message": "Missing bearer token"})
    token = authz.split(" ", 1)[1].strip()
    ctx: Optional[AuthContext]
    if _is_jwt(token):
        ctx = await _validate_jwt(token, settings)
    else:
        ctx = await _validate_api_key(token)
    if not ctx:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"error_code": "unauthorized", "message": "Invalid token"})
    return ctx


