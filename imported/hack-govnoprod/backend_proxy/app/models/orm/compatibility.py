from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class CookbookRule(SQLModel, table=True):
    __tablename__ = "cookbook_rule"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    provider_id: Optional[str]
    key: str
    title: str
    description: Optional[str]
    severity: str
    check_logic: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CookbookCheck(SQLModel, table=True):
    __tablename__ = "cookbook_check"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    analysis_run_id: str
    rule_id: str
    status: str
    details: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)


