from __future__ import annotations

from datetime import datetime
import uuid
from typing import Optional, List

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, JSON as SAJSON


class OrganizationUser(SQLModel, table=True):
    __tablename__ = "organization_user"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    organization_id: str
    user_id: str
    role: str
    status: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class APIKey(SQLModel, table=True):
    __tablename__ = "api_key"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    organization_id: str
    project_id: Optional[str]
    user_id: Optional[str]
    name: str
    key_hash: str
    scopes: list = Field(default_factory=list, sa_column=Column(SAJSON))
    expires_at: Optional[datetime]
    is_revoked: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RefreshToken(SQLModel, table=True):
    __tablename__ = "refresh_token"
    __table_args__ = {"schema": "ops"}

    # Generate id on the application side to avoid relying on server-side
    # defaults during INSERT (prevents NULL identity key on flush).
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str
    token_hash: str
    issued_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    revoked: bool = False
    replaced_by: Optional[str]
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))


class ProviderCredential(SQLModel, table=True):
    __tablename__ = "provider_credential"
    __table_args__ = {"schema": "ops"}

    id: Optional[str] = Field(default=None, primary_key=True)
    organization_id: str
    project_id: Optional[str]
    provider: str
    credential_ref: str
    meta: dict = Field(default_factory=dict, sa_column=Column(SAJSON))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


