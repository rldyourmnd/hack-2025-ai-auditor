from __future__ import annotations

from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class RepoRead(BaseModel):
    id: Optional[str]
    project_id: str
    provider: str
    url: str
    default_branch: str
    last_sync_at: Optional[datetime]
    meta: dict
    created_at: datetime

    class Config:
        orm_mode = True


class RepoFileRead(BaseModel):
    id: Optional[str]
    repo_id: str
    path: str
    sha: str
    size_bytes: int
    last_indexed_at: Optional[datetime]
    language: Optional[str]
    meta: dict
    created_at: datetime

    class Config:
        orm_mode = True


