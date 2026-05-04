from __future__ import annotations

import hashlib
import secrets
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.identity import APIKey
from ...schemas.api_keys import ApiKeyCreate, ApiKeyResponse, ApiKeyListResponse


router = APIRouter(prefix="/orgs/{org_id}/api-keys", tags=["api-keys"])


def _mask_key(full_key: str) -> str:
    return f"{full_key[:4]}...{full_key[-4:]}"


def _hash_key(full_key: str) -> str:
    return hashlib.sha256(full_key.encode("utf-8")).hexdigest()


@router.post("", response_model=dict, status_code=201)
async def issue_api_key(org_id: str, payload: ApiKeyCreate) -> dict:
    # generate: prefix + random
    prefix = secrets.token_hex(4)
    suffix = secrets.token_hex(24)
    full_key = f"{prefix}.{suffix}"
    key_hash = _hash_key(full_key)
    async with get_session() as session:
        exists_stmt = select(APIKey).where(APIKey.key_hash == key_hash)
        res = await session.exec(exists_stmt)
        if res.first():
            raise HTTPException(status_code=409, detail={"error_code": "duplicate_key", "message": "Key collision, retry"})
        rec = APIKey(
            organization_id=org_id,
            project_id=None,
            user_id=None,
            name=payload.name,
            key_hash=key_hash,
            scopes=payload.scopes,
            expires_at=payload.expires_at,
            is_revoked=False,
        )
        session.add(rec)
        await session.commit()
        await session.refresh(rec)
        return {
            "id": str(rec.id),
            "organization_id": org_id,
            "name": rec.name,
            "api_key": full_key,  # return once
            "mask": _mask_key(full_key),
            "scopes": rec.scopes,
            "expires_at": rec.expires_at,
            "is_revoked": rec.is_revoked,
            "created_at": rec.created_at,
        }


@router.get("", response_model=ApiKeyListResponse)
async def list_api_keys(org_id: str, limit: int = 50, offset: int = 0) -> ApiKeyListResponse:
    async with get_session() as session:
        stmt = select(APIKey).where(APIKey.organization_id == org_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        def to_resp(k: APIKey) -> ApiKeyResponse:
            # mask based on hash; we can't reconstruct, so show only hash tail
            mask = f"hash:{k.key_hash[:6]}...{k.key_hash[-6:]}"
            return ApiKeyResponse(
                id=str(k.id), organization_id=str(k.organization_id), name=k.name, mask=mask,
                scopes=list(k.scopes or []), expires_at=k.expires_at, is_revoked=k.is_revoked, created_at=k.created_at
            )
        return ApiKeyListResponse(data=[to_resp(i) for i in items], meta={"limit": limit, "offset": offset})


@router.delete("/{key_id}", status_code=204, response_model=None)
async def revoke_api_key(org_id: str, key_id: str) -> None:
    async with get_session() as session:
        stmt = select(APIKey).where(APIKey.organization_id == org_id, APIKey.id == key_id)
        res = await session.exec(stmt)
        k = res.first()
        if not k:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "API key not found"})
        k.is_revoked = True
        await session.commit()
        return None


@router.post("/{key_id}/rotate", response_model=dict)
async def rotate_api_key(org_id: str, key_id: str) -> dict:
    prefix = secrets.token_hex(4)
    suffix = secrets.token_hex(24)
    full_key = f"{prefix}.{suffix}"
    key_hash = _hash_key(full_key)
    async with get_session() as session:
        stmt = select(APIKey).where(APIKey.organization_id == org_id, APIKey.id == key_id)
        res = await session.exec(stmt)
        k = res.first()
        if not k:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "API key not found"})
        k.key_hash = key_hash
        k.is_revoked = False
        await session.commit()
        await session.refresh(k)
        return {
            "id": str(k.id),
            "organization_id": org_id,
            "name": k.name,
            "api_key": full_key,
            "mask": _mask_key(full_key),
            "scopes": k.scopes,
            "expires_at": k.expires_at,
            "is_revoked": k.is_revoked,
            "created_at": k.created_at,
        }


