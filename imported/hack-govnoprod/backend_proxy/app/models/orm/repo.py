from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class Repo(SQLModel, table=True):
    __tablename__ = "repo"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    provider: str
    url: str
    default_branch: str
    last_sync_at: Optional[datetime] = None
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RepoFile(SQLModel, table=True):
    __tablename__ = "repo_file"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    repo_id: str
    path: str
    sha: str
    size_bytes: int
    last_indexed_at: Optional[datetime] = None
    language: Optional[str] = None
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Workspace(SQLModel, table=True):
    __tablename__ = "workspace"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    user_id: Optional[str] = None
    client_app_id: Optional[str] = None
    device_id: Optional[str] = None
    name: str
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PromptSource(SQLModel, table=True):
    __tablename__ = "prompt_source"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    project_id: str
    kind: str
    repo_file_id: Optional[str] = None
    workspace_id: Optional[str] = None
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


