from __future__ import annotations

from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class TagRead(BaseModel):
    id: Optional[str]
    project_id: str
    key: str
    name: str
    color: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


class TagLinkRead(BaseModel):
    id: Optional[str]
    tag_id: str
    entity_type: str
    entity_id: str
    created_at: datetime

    class Config:
        orm_mode = True


