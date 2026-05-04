from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, JSON as SAJSON

from sqlmodel import Field, SQLModel


class AnalysisReport(SQLModel, table=True):
    __tablename__ = "analysis_report"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    original_prompt: str
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)
    detected_language: str
    translated: bool = False
    format_valid: bool = False

    judge_score: float
    judge_rationale: str
    judge_details: Optional[dict] = Field(default=None, sa_column=Column(SAJSON))

    entropy: float
    spread: float
    clusters: int
    samples: List[str] = Field(default_factory=list, sa_column=Column(SAJSON))

    length_chars: int
    length_words: int
    complexity_score: float
    overall_score: float
    improvement_priority: str


class AnalysisContradiction(SQLModel, table=True):
    __tablename__ = "analysis_contradiction"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    report_id: str
    type: str
    description: str
    severity: str
    locations: List[str] = Field(default_factory=list, sa_column=Column(SAJSON))


class AnalysisPatch(SQLModel, table=True):
    __tablename__ = "analysis_patch"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    report_id: str
    type: str
    category: str
    description: str
    original: str
    improved: str
    rationale: str
    confidence: float


class AnalysisClarifyQuestion(SQLModel, table=True):
    __tablename__ = "analysis_clarify_question"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    report_id: str
    question: str
    category: str
    priority: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


