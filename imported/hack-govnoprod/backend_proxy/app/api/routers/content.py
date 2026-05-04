from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.content import Content
from ...schemas.content import ContentRead

# NOTE: Avoid catch-all at the API root to prevent shadowing specific routes like
# /api/v1/healthz. Place content under an explicit prefix.
router = APIRouter(prefix="/content", tags=["content"])


@router.get("/{key}", response_model=ContentRead)
async def get_content(key: str):
    async with get_session() as session:
        statement = select(Content).where(Content.key == key)
        result = await session.exec(statement)
        content = result.first()
        if not content:
            raise HTTPException(status_code=404, detail="not found")
        return content


