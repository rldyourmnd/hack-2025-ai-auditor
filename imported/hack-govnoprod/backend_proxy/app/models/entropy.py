from __future__ import annotations
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON, BigInteger, Text


class EntropyUpload(SQLModel, table=True):
    __tablename__ = "entropy_upload"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    repo_id: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(default="accepted", sa_column=Column(Text, nullable=False))
    received_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column())
    last_update_at: datetime = Field(default_factory=datetime.utcnow, sa_column=Column())
    manifest_json: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))
    error_code: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    error_details: Optional[dict] = Field(default=None, sa_column=Column(JSON, nullable=True))
    archive_size_bytes: Optional[int] = Field(default=None, sa_column=Column(BigInteger, nullable=True))


