from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.settings import Setting
from ...schemas.settings import SettingsCatalogResponse, EffectiveSettingsQuery, SettingKV


router = APIRouter(prefix="/settings", tags=["settings"])


CATALOG: dict[str, list[dict]] = {
    "browser_ext": [
        {"key": "revizor.methods.enabled", "type": "array", "default": ["uia", "simCopy", "interactiveCopy"]},
        {"key": "revizor.privacy.noClipboard", "type": "boolean", "default": False},
        {"key": "revizor.ui.showPreview", "type": "boolean", "default": True},
        {"key": "revizor.keys.grab", "type": "string", "default": "ctrl+alt+g"},
        {"key": "cursorAudit.sendHotkey", "type": "string", "default": "ctrl+enter"},
        {"key": "cursorAudit.osMethod", "type": "string", "default": "auto", "enum": ["auto", "uia", "applescript", "xdotool"]},
    ],
    "vscode_ext": [
        {"key": "revizor.methods.enabled", "type": "array", "default": ["uia", "simCopy", "interactiveCopy"]},
        {"key": "revizor.privacy.noClipboard", "type": "boolean", "default": False},
        {"key": "revizor.ui.showPreview", "type": "boolean", "default": True},
        {"key": "revizor.keys.grab", "type": "string", "default": "ctrl+alt+g"},
        {"key": "cursorAudit.sendHotkey", "type": "string", "default": "ctrl+enter"},
        {"key": "cursorAudit.osMethod", "type": "string", "default": "auto", "enum": ["auto", "uia", "applescript", "xdotool"]},
    ],
    "shared": [],
}


@router.get("/catalog", response_model=SettingsCatalogResponse)
async def settings_catalog(scope: Literal["browser_ext", "vscode_ext", "shared"]) -> SettingsCatalogResponse:
    return SettingsCatalogResponse(scope=scope, keys=CATALOG.get(scope, []))


def _merge_effective(defaults: dict, org: dict, project: dict, user: dict, client_app: dict, device: dict) -> dict:
    result = dict(defaults)
    result.update(org)
    result.update(project)
    result.update(user)
    result.update(client_app)
    result.update(device)
    return result


@router.get("/effective")
async def effective(owner_type: str, owner_id: str, device_id: str | None = None, project_id: str | None = None) -> dict:
    # MVP: read known keys and merge by simple priority; DB enum currently supports org/project/user
    layers = {"org": {}, "project": {}, "user": {}, "client_app": {}, "device": {}}
    async with get_session() as session:
        for layer in ("org", "project", "user"):
            stmt = select(Setting).where(Setting.owner_type == layer)
            if layer == owner_type:
                stmt = stmt.where(Setting.owner_id == owner_id)
            res = await session.exec(stmt)
            for s in res.all():
                layers[layer][s.key] = s.value
    defaults = {k["key"]: k.get("default") for k in CATALOG.get("shared", [])}
    merged = _merge_effective(defaults, layers["org"], layers["project"], layers["user"], layers["client_app"], layers["device"])
    return {"data": merged}


@router.get("/{owner_type}/{owner_id}")
async def list_owner_settings(owner_type: str, owner_id: str) -> list[SettingKV]:
    async with get_session() as session:
        stmt = select(Setting).where(Setting.owner_type == owner_type, Setting.owner_id == owner_id)
        res = await session.exec(stmt)
        return [SettingKV(key=s.key, value=s.value) for s in res.all()]


@router.get("/{owner_type}/{owner_id}/{key}")
async def get_owner_setting(owner_type: str, owner_id: str, key: str) -> SettingKV:
    async with get_session() as session:
        stmt = select(Setting).where(Setting.owner_type == owner_type, Setting.owner_id == owner_id, Setting.key == key)
        res = await session.exec(stmt)
        s = res.first()
        if not s:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Setting not found"})
        return SettingKV(key=s.key, value=s.value)


@router.put("/{owner_type}/{owner_id}/{key}")
async def upsert_owner_setting(owner_type: str, owner_id: str, key: str, payload: SettingKV) -> SettingKV:
    async with get_session() as session:
        stmt = select(Setting).where(Setting.owner_type == owner_type, Setting.owner_id == owner_id, Setting.key == key)
        res = await session.exec(stmt)
        s = res.first()
        if not s:
            s = Setting(owner_type=owner_type, owner_id=owner_id, key=key, value=payload.value)
            session.add(s)
        else:
            s.value = payload.value
        await session.commit()
        return SettingKV(key=key, value=payload.value)


@router.delete("/{owner_type}/{owner_id}/{key}", status_code=204, response_model=None)
async def delete_owner_setting(owner_type: str, owner_id: str, key: str) -> None:
    async with get_session() as session:
        stmt = select(Setting).where(Setting.owner_type == owner_type, Setting.owner_id == owner_id, Setting.key == key)
        res = await session.exec(stmt)
        s = res.first()
        if not s:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Setting not found"})
        await session.delete(s)
        await session.commit()
        return None


