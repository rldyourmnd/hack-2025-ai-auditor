from __future__ import annotations
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import Column, JSON as SAJSON, BigInteger, Text


class EntropyUpload(SQLModel, table=True):
    __tablename__ = "entropy_upload"

    id: str = Field(primary_key=True)
    repo_id: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    status: str = Field(default="accepted", sa_column=Column(Text, nullable=False))
    received_at: datetime = Field(default_factory=datetime.utcnow)
    last_update_at: datetime = Field(default_factory=datetime.utcnow)
    manifest_json: Optional[dict] = Field(default=None, sa_column=Column(SAJSON, nullable=True))
    error_code: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    error_details: Optional[dict] = Field(default=None, sa_column=Column(SAJSON, nullable=True))
    archive_size_bytes: Optional[int] = Field(default=None, sa_column=Column(BigInteger, nullable=True))


class EntropyProgress(SQLModel, table=True):
    __tablename__ = "entropy_progress"

    upload_id: str = Field(primary_key=True)
    profiles_read_lines: int = 0
    profiles_bad_lines: int = 0
    profiles_bytes_gz: int = 0
    findings_read_lines: int = 0
    findings_bad_lines: int = 0
    findings_bytes_gz: int = 0
    groups_json: Optional[dict] = Field(default=None, sa_column=Column(SAJSON, nullable=True))
    file_index_count: Optional[int] = None


class EntropyResult(SQLModel, table=True):
    __tablename__ = "entropy_result"

    upload_id: str = Field(primary_key=True)
    result_json: dict = Field(sa_column=Column(SAJSON, nullable=False))
    weights_version: str = Field()


