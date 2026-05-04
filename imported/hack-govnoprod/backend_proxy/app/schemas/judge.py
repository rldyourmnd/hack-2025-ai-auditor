from __future__ import annotations

from typing import Optional
from datetime import datetime

from pydantic import BaseModel


class JudgeRubricRead(BaseModel):
    id: Optional[str]
    project_id: str
    name: str
    description: Optional[str]
    meta: dict
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class JudgeRubricCreate(BaseModel):
    name: str
    description: Optional[str] = None
    meta: dict = {}


class JudgeCriterionRead(BaseModel):
    id: Optional[str]
    rubric_id: str
    key: str
    title: str
    description: Optional[str]
    weight: float
    created_at: datetime

    class Config:
        orm_mode = True


class JudgeCriterionCreate(BaseModel):
    key: str
    title: str
    description: Optional[str] = None
    weight: float


class JudgeScoreUpsert(BaseModel):
    criterion_id: str
    score: float
    comment: Optional[str] = None
    evidence: dict = {}

