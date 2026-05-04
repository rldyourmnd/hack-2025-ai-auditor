from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class Tag(SQLModel, table=True):
    __tablename__ = "tag"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    key: str
    name: str
    color: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TagLink(SQLModel, table=True):
    __tablename__ = "tag_link"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    tag_id: str
    entity_type: str
    entity_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class LLMModel(SQLModel, table=True):
    __tablename__ = "llm_models"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    provider: str
    name: str
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


