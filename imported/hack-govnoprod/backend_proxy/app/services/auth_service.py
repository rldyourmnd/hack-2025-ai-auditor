from __future__ import annotations

import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from jose import jwt
from passlib.context import CryptContext

from ..config import Settings
from ..db.session import get_session
from ..models.orm.users import User
from ..models.orm.identity import RefreshToken
from sqlmodel import select


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    def __init__(self, settings: Settings):
        self.settings = settings
        # For demo: allow symmetric secret; production should use RSA and JWKS
        self.jwt_secret = settings.jwt_secret or "dev-secret-change-me"
        self.jwt_alg = "HS256"
        self.access_ttl_minutes = settings.jwt_expire_minutes

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, password: str, password_hash: str) -> bool:
        return pwd_context.verify(password, password_hash)

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    async def authenticate_user(self, email: str, password: str) -> Optional[User]:
        async with get_session() as session:
            stmt = select(User).where(User.email == email)
            res = await session.execute(stmt)
            user = res.scalars().first()
            if not user:
                return None
            # type: ignore[attr-defined]
            password_hash = getattr(user, "password_hash", None)
            if not password_hash:
                return None
            if not self.verify_password(password, password_hash):
                return None
            return user

    def _generate_access_token(self, user: User) -> Tuple[str, int]:
        now = self._now()
        exp = now + timedelta(minutes=self.access_ttl_minutes)
        payload = {
            "sub": str(user.id),
            "email": user.email,
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        token = jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_alg)
        return token, int((exp - now).total_seconds())

    def _hash_refresh(self, token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()

    async def issue_tokens(self, user: User) -> Tuple[str, str, int]:
        access_token, expires_in = self._generate_access_token(user)
        # Simplified refresh token: HMAC of user id + timestamp
        raw_refresh = f"{user.id}:{self._now().isoformat()}"
        refresh_token = hmac.new(self.jwt_secret.encode(), raw_refresh.encode(), hashlib.sha256).hexdigest()
        token_hash = self._hash_refresh(refresh_token)

        async with get_session() as session:
            rt = RefreshToken(
                user_id=str(user.id),
                token_hash=token_hash,
                issued_at=self._now(),
                expires_at=self._now() + timedelta(days=30),
                revoked=False,
            )
            session.add(rt)
            await session.commit()

        return access_token, refresh_token, expires_in

    async def signup_user(self, email: str, password: str, display_name: Optional[str]) -> User:
        async with get_session() as session:
            stmt = select(User).where(User.email == email)
            res = await session.execute(stmt)
            existing = res.scalars().first()
            if existing:
                return existing
            user = User(email=email, display_name=display_name)
            # type: ignore[attr-defined]
            setattr(user, "password_hash", self.hash_password(password))
            session.add(user)
            await session.commit()
            await session.refresh(user)
            return user

    async def refresh_tokens(self, refresh_token: str) -> Optional[Tuple[str, str, int]]:
        token_hash = self._hash_refresh(refresh_token)
        async with get_session() as session:
            stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash, RefreshToken.revoked == False)
            res = await session.execute(stmt)
            rt = res.scalars().first()
            if not rt:
                return None
            if rt.expires_at <= self._now():
                return None
            # rotate: revoke old and issue new
            rt.revoked = True
            await session.commit()
            # fetch user
            u_stmt = select(User).where(User.id == rt.user_id)
            u_res = await session.execute(u_stmt)
            user = u_res.scalars().first()
            if not user:
                return None
            return await self.issue_tokens(user)


