from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class HTTPRequestLog(SQLModel, table=True):
    __tablename__ = "http_request_log"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=datetime.utcnow)
    project_id: Optional[str]
    user_id: Optional[str]
    session_id: Optional[str]
    method: str
    path: str
    status_code: int
    latency_ms: int
    ip: Optional[str] = None
    ua_hash: Optional[str] = None
    payload: dict = Field(default_factory=dict, sa_column=Column(SAJSON))


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=datetime.utcnow)
    actor_user_id: Optional[str]
    project_id: Optional[str]
    action: str
    entity_type: str
    entity_id: Optional[str]
    before: Optional[dict] = Field(default=None, sa_column=Column(SAJSON))
    after: Optional[dict] = Field(default=None, sa_column=Column(SAJSON))


