from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import Column, JSON as SAJSON, String


class Organization(SQLModel, table=True):
    __tablename__ = "organization"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(
        default_factory=lambda: str(uuid4()),
        sa_column=Column(String, primary_key=True, default=lambda: str(uuid4()), nullable=False),
    )
    name: str
    slug: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(
        default_factory=lambda: str(uuid4()),
        sa_column=Column(String, primary_key=True, default=lambda: str(uuid4()), nullable=False),
    )
    email: str
    display_name: Optional[str]
    password_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Project(SQLModel, table=True):
    __tablename__ = "projects"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(
        default_factory=lambda: str(uuid4()),
        sa_column=Column(String, primary_key=True, default=lambda: str(uuid4()), nullable=False),
    )
    organization_id: str
    name: str
    key: Optional[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Prompt(SQLModel, table=True):
    __tablename__ = "prompts"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(
        default_factory=lambda: str(uuid4()),
        sa_column=Column(String, primary_key=True, default=lambda: str(uuid4()), nullable=False),
    )
    project_id: str
    title: Optional[str]
    content: str
    created_by: Optional[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    format_type: str = "auto"
    language: str = "en"
    # Use plain builtin types for SQLModel compatibility at import-time
    tags: Optional[list] = Field(default_factory=list, sa_column=Column(SAJSON))
    extra_metadata: Optional[dict] = Field(default_factory=dict, sa_column=Column(SAJSON))


