from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.compatibility import CookbookRule


router = APIRouter(prefix="/cookbook", tags=["cookbook"])


@router.post("/providers", response_model=dict, status_code=201)
async def create_provider(key: str, name: str, base_url: str | None = None, meta: dict | None = None) -> dict:
    # Providers model is mart-level in schema; keep as a simple echo for now
    return {"status": "not_implemented"}


@router.get("/providers", response_model=list[dict])
async def list_providers() -> list[dict]:
    return []


@router.post("/rules", response_model=dict, status_code=201)
async def create_rule(provider_id: str | None, key: str, title: str, severity: str, check_logic: dict, description: str | None = None) -> dict:
    async with get_session() as session:
        r = CookbookRule(provider_id=provider_id, key=key, title=title, description=description, severity=severity, check_logic=check_logic)
        session.add(r)
        await session.commit()
        await session.refresh(r)
        return {"id": str(r.id), "key": r.key, "title": r.title, "severity": r.severity}


@router.get("/rules", response_model=list[dict])
async def list_rules(limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(CookbookRule).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [
            {"id": str(r.id), "key": r.key, "title": r.title, "severity": r.severity, "description": r.description, "updated_at": r.updated_at}
            for r in items
        ]


@router.get("/rules/{rule_id}", response_model=dict)
async def get_rule(rule_id: str) -> dict:
    async with get_session() as session:
        stmt = select(CookbookRule).where(CookbookRule.id == rule_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Rule not found"})
        return {"id": str(r.id), "key": r.key, "title": r.title, "severity": r.severity, "description": r.description, "check_logic": r.check_logic}


@router.patch("/rules/{rule_id}", response_model=dict)
async def update_rule(rule_id: str, title: str | None = None, severity: str | None = None, description: str | None = None, check_logic: dict | None = None) -> dict:
    async with get_session() as session:
        stmt = select(CookbookRule).where(CookbookRule.id == rule_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Rule not found"})
        if title is not None:
            r.title = title
        if severity is not None:
            r.severity = severity
        if description is not None:
            r.description = description
        if check_logic is not None:
            r.check_logic = check_logic
        await session.commit()
        await session.refresh(r)
        return {"id": str(r.id), "key": r.key, "title": r.title, "severity": r.severity, "description": r.description, "check_logic": r.check_logic}


@router.delete("/rules/{rule_id}", status_code=204, response_model=None)
async def delete_rule(rule_id: str) -> None:
    async with get_session() as session:
        stmt = select(CookbookRule).where(CookbookRule.id == rule_id)
        res = await session.exec(stmt)
        r = res.first()
        if not r:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Rule not found"})
        await session.delete(r)
        await session.commit()
        return None


