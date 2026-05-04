from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class CaptureEvent(SQLModel, table=True):
    __tablename__ = "capture_event"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=datetime.utcnow)
    project_id: Optional[str]
    user_id: Optional[str]
    session_id: Optional[str]
    client_app_id: Optional[str]
    kind: str
    name: str
    severity: str
    payload: dict = Field(default_factory=dict, sa_column=Column(SAJSON))


class CLIInvocation(SQLModel, table=True):
    __tablename__ = "cli_invocation"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    capture_event_id: str
    command: str
    args: list = Field(default_factory=list, sa_column=Column(SAJSON))
    exit_code: Optional[int]
    duration_ms: Optional[int]


class IDEInstallation(SQLModel, table=True):
    __tablename__ = "ide_installation"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    capture_event_id: str
    ide: str
    version: str
    os: str
    success: bool
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))


