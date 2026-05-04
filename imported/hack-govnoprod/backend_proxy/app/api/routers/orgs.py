from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.users import Organization
from ...models.orm.identity import OrganizationUser
from ...schemas.orgs import (
    OrganizationCreate,
    OrganizationUpdate,
    OrganizationResponse,
    MemberCreate,
    MemberUpdate,
    MemberResponse,
)


router = APIRouter(prefix="/orgs", tags=["orgs"])


@router.post("", response_model=OrganizationResponse, status_code=201)
async def create_org(payload: OrganizationCreate) -> OrganizationResponse:
    async with get_session() as session:
        org = Organization(name=payload.name, slug=payload.slug)
        session.add(org)
        await session.commit()
        await session.refresh(org)
        return OrganizationResponse(id=str(org.id), name=org.name, slug=org.slug, created_at=org.created_at)


@router.get("", response_model=list[OrganizationResponse])
async def list_orgs(limit: int = 50, offset: int = 0) -> list[OrganizationResponse]:
    async with get_session() as session:
        stmt = select(Organization).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [OrganizationResponse(id=str(o.id), name=o.name, slug=o.slug, created_at=o.created_at) for o in items]


@router.get("/{org_id}", response_model=OrganizationResponse)
async def get_org(org_id: str) -> OrganizationResponse:
    async with get_session() as session:
        stmt = select(Organization).where(Organization.id == org_id)
        res = await session.exec(stmt)
        org = res.first()
        if not org:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Organization not found"})
        return OrganizationResponse(id=str(org.id), name=org.name, slug=org.slug, created_at=org.created_at)


@router.patch("/{org_id}", response_model=OrganizationResponse)
async def update_org(org_id: str, payload: OrganizationUpdate) -> OrganizationResponse:
    async with get_session() as session:
        stmt = select(Organization).where(Organization.id == org_id)
        res = await session.exec(stmt)
        org = res.first()
        if not org:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Organization not found"})
        if payload.name is not None:
            org.name = payload.name
        if payload.slug is not None:
            org.slug = payload.slug
        await session.commit()
        await session.refresh(org)
        return OrganizationResponse(id=str(org.id), name=org.name, slug=org.slug, created_at=org.created_at)


@router.delete("/{org_id}", status_code=204, response_model=None)
async def delete_org(org_id: str) -> None:
    async with get_session() as session:
        stmt = select(Organization).where(Organization.id == org_id)
        res = await session.exec(stmt)
        org = res.first()
        if not org:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Organization not found"})
        await session.delete(org)
        await session.commit()
        return None


# Members

@router.post("/{org_id}/members", response_model=MemberResponse, status_code=201)
async def add_member(org_id: str, payload: MemberCreate) -> MemberResponse:
    async with get_session() as session:
        m = OrganizationUser(organization_id=org_id, user_id=payload.user_id, role=payload.role, status="active")
        session.add(m)
        await session.commit()
        await session.refresh(m)
        return MemberResponse(
            id=str(m.id), organization_id=org_id, user_id=payload.user_id, role=m.role, status=m.status, created_at=m.created_at
        )


@router.get("/{org_id}/members", response_model=list[MemberResponse])
async def list_members(org_id: str, limit: int = 50, offset: int = 0) -> list[MemberResponse]:
    async with get_session() as session:
        stmt = (
            select(OrganizationUser)
            .where(OrganizationUser.organization_id == org_id)
            .limit(limit)
            .offset(offset)
        )
        res = await session.exec(stmt)
        items = res.all()
        return [
            MemberResponse(
                id=str(m.id), organization_id=m.organization_id, user_id=m.user_id, role=m.role, status=m.status, created_at=m.created_at
            )
            for m in items
        ]


@router.patch("/{org_id}/members/{user_id}", response_model=MemberResponse)
async def update_member(org_id: str, user_id: str, payload: MemberUpdate) -> MemberResponse:
    async with get_session() as session:
        stmt = select(OrganizationUser).where(OrganizationUser.organization_id == org_id, OrganizationUser.user_id == user_id)
        res = await session.exec(stmt)
        m = res.first()
        if not m:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Member not found"})
        m.role = payload.role
        if payload.status is not None:
            m.status = payload.status
        await session.commit()
        await session.refresh(m)
        return MemberResponse(
            id=str(m.id), organization_id=m.organization_id, user_id=m.user_id, role=m.role, status=m.status, created_at=m.created_at
        )


@router.delete("/{org_id}/members/{user_id}", status_code=204, response_model=None)
async def remove_member(org_id: str, user_id: str) -> None:
    async with get_session() as session:
        stmt = select(OrganizationUser).where(OrganizationUser.organization_id == org_id, OrganizationUser.user_id == user_id)
        res = await session.exec(stmt)
        m = res.first()
        if not m:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Member not found"})
        await session.delete(m)
        await session.commit()
        return None


