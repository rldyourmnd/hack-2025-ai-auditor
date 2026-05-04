from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Content(SQLModel, table=True):
    __tablename__ = "contents"

    id: Optional[str] = Field(default=None, primary_key=True)
    key: str
    path: str
    content_type: str = "text/markdown"
    storage_reference: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


