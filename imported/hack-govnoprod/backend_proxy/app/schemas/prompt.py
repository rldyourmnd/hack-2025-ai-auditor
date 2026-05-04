from __future__ import annotations

from typing import Optional, List
from datetime import datetime

from pydantic import BaseModel


class PromptRead(BaseModel):
    id: Optional[str]
    project_id: str
    title: Optional[str]
    content: str
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime
    format_type: str
    language: str
    tags: Optional[List[str]]
    extra_metadata: Optional[dict]

    class Config:
        orm_mode = True


class PromptCreate(BaseModel):
    project_id: str
    title: Optional[str]
    content: str
    created_by: Optional[str]
    format_type: Optional[str] = "auto"
    language: Optional[str] = "en"
    tags: Optional[List[str]] = None
    extra_metadata: Optional[dict] = None


