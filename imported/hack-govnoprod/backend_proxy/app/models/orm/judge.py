from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON
from datetime import datetime


class JudgeRubric(SQLModel, table=True):
    __tablename__ = "judge_rubric"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    name: str
    description: Optional[str]
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class JudgeCriterion(SQLModel, table=True):
    __tablename__ = "judge_criterion"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    rubric_id: str
    key: str
    title: str
    description: Optional[str]
    weight: float
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JudgeScore(SQLModel, table=True):
    __tablename__ = "judge_score"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    analysis_run_id: str
    criterion_id: str
    score: float
    comment: Optional[str]
    evidence: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


