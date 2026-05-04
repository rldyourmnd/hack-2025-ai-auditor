from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class Recommendation(SQLModel, table=True):
    __tablename__ = "recommendation"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    analysis_run_id: str
    kind: str
    title: str
    body: str
    priority: str
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PromptRevision(SQLModel, table=True):
    __tablename__ = "prompt_revision"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    prompt_id: Optional[str]
    analysis_id: Optional[str]
    revised_content: str
    improvement_summary: Optional[str]
    author_user_id: Optional[str]
    applied_patch_ids: list = Field(default_factory=list, sa_column=Column(SAJSON))
    quality_gain: Optional[float]
    created_at: datetime = Field(default_factory=datetime.utcnow)


