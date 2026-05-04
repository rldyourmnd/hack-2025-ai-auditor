from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field


OrgRole = Literal["owner", "admin", "member", "viewer"]
MembershipStatus = Literal["active", "invited", "removed"]


class OrganizationCreate(BaseModel):
    name: str
    slug: str


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None


class OrganizationResponse(BaseModel):
    id: str
    name: str
    slug: str
    created_at: datetime


class MemberCreate(BaseModel):
    user_id: str
    role: OrgRole


class MemberUpdate(BaseModel):
    role: OrgRole
    status: Optional[MembershipStatus] = None


class MemberResponse(BaseModel):
    id: str
    organization_id: str
    user_id: str
    role: OrgRole
    status: MembershipStatus
    created_at: datetime


