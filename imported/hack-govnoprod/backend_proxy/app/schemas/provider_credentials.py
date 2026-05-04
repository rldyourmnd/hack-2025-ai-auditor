from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProviderCredentialCreate(BaseModel):
    project_id: Optional[str] = None
    provider: str
    secret: str  # will be encrypted at rest
    meta: dict = {}


class ProviderCredentialResponse(BaseModel):
    id: str
    organization_id: str
    project_id: Optional[str]
    provider: str
    meta: dict
    created_at: datetime
    updated_at: datetime


