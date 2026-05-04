from __future__ import annotations

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel


ClientAppType = Literal["browser_ext", "vscode", "cli", "api"]


class ClientAppRegisterRequest(BaseModel):
    type: ClientAppType
    name: str
    version: str
    platform: str
    install_id: str
    meta: dict = {}


class ClientAppResponse(BaseModel):
    id: str
    type: ClientAppType
    name: str
    version: str
    platform: str
    install_id: str
    meta: dict
    created_at: datetime
    last_seen_at: Optional[datetime]


class DeviceCreate(BaseModel):
    user_id: Optional[str] = None
    platform: Optional[str] = None
    meta: dict = {}


class DeviceResponse(BaseModel):
    id: str
    user_id: Optional[str]
    platform: Optional[str]
    meta: dict
    created_at: datetime


class SessionStartRequest(BaseModel):
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    client_app_id: Optional[str] = None


class SessionResponse(BaseModel):
    id: str
    user_id: Optional[str]
    project_id: Optional[str]
    client_app_id: Optional[str]
    started_at: datetime
    finished_at: Optional[datetime]


