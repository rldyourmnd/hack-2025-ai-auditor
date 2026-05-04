from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.identity import ProviderCredential
from ...models.orm.users import Project
from ...schemas.provider_credentials import ProviderCredentialCreate, ProviderCredentialResponse
from ...utils.crypto import encrypt_secret


router = APIRouter(prefix="/projects/{project_id}/provider-credentials", tags=["provider-credentials"])


@router.post("", response_model=ProviderCredentialResponse, status_code=201)
async def create_provider_credential(project_id: str, payload: ProviderCredentialCreate) -> ProviderCredentialResponse:
    async with get_session() as session:
        # infer org from project
        p_stmt = select(Project).where(Project.id == project_id)
        p_res = await session.exec(p_stmt)
        proj = p_res.first()
        if not proj:
            raise HTTPException(status_code=404, detail={"error_code": "project_not_found", "message": "Project not found"})
        cred = ProviderCredential(
            organization_id=str(proj.organization_id),
            project_id=project_id,
            provider=payload.provider,
            credential_ref=encrypt_secret(payload.secret),
            meta=payload.meta or {},
        )
        session.add(cred)
        await session.commit()
        await session.refresh(cred)
        return ProviderCredentialResponse(
            id=str(cred.id), organization_id=str(cred.organization_id), project_id=str(cred.project_id),
            provider=cred.provider, meta=dict(cred.meta or {}), created_at=cred.created_at, updated_at=cred.updated_at
        )


@router.get("", response_model=list[ProviderCredentialResponse])
async def list_provider_credentials(project_id: str, limit: int = 50, offset: int = 0) -> list[ProviderCredentialResponse]:
    async with get_session() as session:
        stmt = select(ProviderCredential).where(ProviderCredential.project_id == project_id).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            ProviderCredentialResponse(
                id=str(c.id), organization_id=str(c.organization_id), project_id=str(c.project_id),
                provider=c.provider, meta=dict(c.meta or {}), created_at=c.created_at, updated_at=c.updated_at
            )
            for c in items
        ]


# Standalone routes by credential id
cred_router = APIRouter(prefix="/provider-credentials", tags=["provider-credentials"])


@cred_router.get("/{cred_id}", response_model=ProviderCredentialResponse)
async def get_provider_credential(cred_id: str) -> ProviderCredentialResponse:
    async with get_session() as session:
        stmt = select(ProviderCredential).where(ProviderCredential.id == cred_id)
        res = await session.exec(stmt)
        c = res.first()
        if not c:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Credential not found"})
        return ProviderCredentialResponse(
            id=str(c.id), organization_id=str(c.organization_id), project_id=str(c.project_id),
            provider=c.provider, meta=dict(c.meta or {}), created_at=c.created_at, updated_at=c.updated_at
        )


@cred_router.patch("/{cred_id}", response_model=ProviderCredentialResponse)
async def update_provider_credential(cred_id: str, provider: str | None = None, secret: str | None = None, meta: dict | None = None) -> ProviderCredentialResponse:
    async with get_session() as session:
        stmt = select(ProviderCredential).where(ProviderCredential.id == cred_id)
        res = await session.exec(stmt)
        c = res.first()
        if not c:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Credential not found"})
        if provider is not None:
            c.provider = provider
        if secret is not None:
            c.credential_ref = encrypt_secret(secret)
        if meta is not None:
            c.meta = meta
        await session.commit()
        await session.refresh(c)
        return ProviderCredentialResponse(
            id=str(c.id), organization_id=str(c.organization_id), project_id=str(c.project_id),
            provider=c.provider, meta=dict(c.meta or {}), created_at=c.created_at, updated_at=c.updated_at
        )


@cred_router.delete("/{cred_id}", status_code=204, response_model=None)
async def delete_provider_credential(cred_id: str) -> None:
    async with get_session() as session:
        stmt = select(ProviderCredential).where(ProviderCredential.id == cred_id)
        res = await session.exec(stmt)
        c = res.first()
        if not c:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Credential not found"})
        await session.delete(c)
        await session.commit()
        return None


