from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ApiKeyCreate(BaseModel):
    name: str
    scopes: list[str] = []
    expires_at: Optional[datetime] = None


class ApiKeyResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    mask: str
    scopes: list[str]
    expires_at: Optional[datetime]
    is_revoked: bool
    created_at: datetime


class ApiKeyListResponse(BaseModel):
    data: list[ApiKeyResponse]
    meta: dict = {}


