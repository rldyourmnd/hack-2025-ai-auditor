from __future__ import annotations

from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class MetricTimeseries(SQLModel, table=True):
    __tablename__ = "metric_timeseries"
    __table_args__ = {"schema": "mart"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    metric_key: str
    ts_bucket: Optional[str]
    value_num: Optional[float]
    value_json: Optional[dict] = Field(default=None, sa_column=Column(SAJSON))


class FeatureDaily(SQLModel, table=True):
    __tablename__ = "feature_daily"
    __table_args__ = {"schema": "mart"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    day: date
    feature_key: str
    events: int
    unique_users: int


class ModelDaily(SQLModel, table=True):
    __tablename__ = "model_daily"
    __table_args__ = {"schema": "mart"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    day: date
    llm_model_id: str
    invocations: int
    tokens_in: int
    tokens_out: int
    avg_latency_ms: int
    cost_estimated: Optional[float]


class AnalysisDaily(SQLModel, table=True):
    __tablename__ = "analysis_daily"
    __table_args__ = {"schema": "mart"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    day: date
    analyses: int
    avg_overall: Optional[float]
    avg_entropy: Optional[float]


class ProjectKPIDaily(SQLModel, table=True):
    __tablename__ = "project_kpi_daily"
    __table_args__ = {"schema": "mart"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    day: date
    dau: Optional[int]
    sessions: Optional[int]
    new_users: Optional[int]
    api_calls: Optional[int]
    error_rate: Optional[float]
    avg_response_ms: Optional[int]
    avg_session_sec: Optional[int]


