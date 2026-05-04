from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class Setting(SQLModel, table=True):
    __tablename__ = "settings"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    owner_type: str  # org|project|user|client_app|device (DB enum has org/project/user for now)
    owner_id: str
    key: str
    value: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


