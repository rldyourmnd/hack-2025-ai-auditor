from __future__ import annotations

from datetime import datetime
import uuid
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class AnalysisRun(SQLModel, table=True):
    __tablename__ = "analysis_run"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    source_id: Optional[str] = None
    prompt_id: Optional[str] = None
    prompt_version_id: Optional[str] = None
    status: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))


class AnalysisMetric(SQLModel, table=True):
    __tablename__ = "analysis_metric"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    analysis_run_id: str
    key: str
    value_num: Optional[float] = None
    value_text: Optional[str] = None
    value_json: Optional[dict] = Field(default=None, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AnalysisNodeResult(SQLModel, table=True):
    __tablename__ = "analysis_node_result"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    analysis_run_id: str
    node: str
    status: str
    score: Optional[float] = None
    details: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


