from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ContentRead(BaseModel):
    id: Optional[str]
    key: str
    path: str
    content_type: str
    storage_reference: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True


