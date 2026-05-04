from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    organization_id: str
    name: str
    key: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    key: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    organization_id: str
    name: str
    key: Optional[str]
    created_at: datetime


