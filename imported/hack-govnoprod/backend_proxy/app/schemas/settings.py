from __future__ import annotations

from typing import Literal
from pydantic import BaseModel


OwnerType = Literal["org", "project", "user", "client_app", "device"]


class SettingsCatalogResponse(BaseModel):
    scope: str
    keys: list[dict]


class EffectiveSettingsQuery(BaseModel):
    owner_type: OwnerType
    owner_id: str
    device_id: str | None = None
    project_id: str | None = None


class SettingKV(BaseModel):
    key: str
    value: object


