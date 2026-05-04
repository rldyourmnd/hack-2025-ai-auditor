from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class ClientApp(SQLModel, table=True):
    __tablename__ = "client_app"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    type: str
    name: str
    version: str
    platform: str
    install_id: str
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: Optional[datetime] = None


class Device(SQLModel, table=True):
    __tablename__ = "devices"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    user_id: Optional[str]
    platform: Optional[str]
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Connection(SQLModel, table=True):
    __tablename__ = "connections"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    user_id: Optional[str]
    provider: str
    external_id: str
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Session(SQLModel, table=True):
    __tablename__ = "sessions"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    user_id: Optional[str]
    project_id: Optional[str]
    client_app_id: Optional[str]
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: Optional[datetime] = None


