from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.misc import LLMModel


router = APIRouter(prefix="/llm-models", tags=["llm-models"])


@router.post("", response_model=dict, status_code=201)
async def create_llm_model(provider: str, name: str) -> dict:
    async with get_session() as session:
        m = LLMModel(provider=provider, name=name)
        session.add(m)
        await session.commit()
        await session.refresh(m)
        return {"id": str(m.id), "provider": m.provider, "name": m.name, "meta": m.meta, "created_at": m.created_at}


@router.get("", response_model=list[dict])
async def list_llm_models(limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        stmt = select(LLMModel).limit(limit).offset(offset)
        res = await session.exec(stmt)
        items = res.all()
        return [{"id": str(m.id), "provider": m.provider, "name": m.name, "meta": m.meta, "created_at": m.created_at} for m in items]


@router.get("/{model_id}", response_model=dict)
async def get_llm_model(model_id: str) -> dict:
    async with get_session() as session:
        stmt = select(LLMModel).where(LLMModel.id == model_id)
        res = await session.exec(stmt)
        m = res.first()
        if not m:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Model not found"})
        return {"id": str(m.id), "provider": m.provider, "name": m.name, "meta": m.meta, "created_at": m.created_at}


@router.patch("/{model_id}", response_model=dict)
async def update_llm_model(model_id: str, provider: str | None = None, name: str | None = None) -> dict:
    async with get_session() as session:
        stmt = select(LLMModel).where(LLMModel.id == model_id)
        res = await session.exec(stmt)
        m = res.first()
        if not m:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Model not found"})
        if provider is not None:
            m.provider = provider
        if name is not None:
            m.name = name
        await session.commit()
        await session.refresh(m)
        return {"id": str(m.id), "provider": m.provider, "name": m.name, "meta": m.meta, "created_at": m.created_at}


@router.delete("/{model_id}", status_code=204, response_model=None)
async def delete_llm_model(model_id: str) -> None:
    async with get_session() as session:
        stmt = select(LLMModel).where(LLMModel.id == model_id)
        res = await session.exec(stmt)
        m = res.first()
        if not m:
            raise HTTPException(status_code=404, detail={"error_code": "not_found", "message": "Model not found"})
        await session.delete(m)
        await session.commit()
        return None


