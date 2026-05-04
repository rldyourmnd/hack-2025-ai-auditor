from __future__ import annotations

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from ...db.session import get_session
from ...models.orm.users import Prompt
from ...models.orm.users import Prompt as PromptModel
from ...models.orm.users import Project
from ...models.orm.users import User
from ...models.orm.users import SQLModel  # placeholder if needed
from ...models.orm.users import Field  # not used; keep imports minimal
from ...models.orm.users import datetime  # avoid


router = APIRouter(prefix="/prompts/{prompt_id}/versions", tags=["prompt-versions"])


@router.post("", response_model=dict, status_code=201)
async def create_prompt_version(prompt_id: str, content: str, created_by: str | None = None) -> dict:
    async with get_session() as session:
        # Store as new row in ops.prompt_version via raw insert to keep it light for now
        await session.exec(
            """
            INSERT INTO ops.prompt_version (id, prompt_id, version_no, content, created_by)
            VALUES (gen_random_uuid(), :prompt_id,
                    COALESCE((SELECT max(version_no)+1 FROM ops.prompt_version WHERE prompt_id=:prompt_id), 1),
                    :content, :created_by)
            """,
            {"prompt_id": prompt_id, "content": content, "created_by": created_by},
        )
        await session.commit()
        # Return the latest version summary
        res = await session.exec(
            "SELECT id, version_no, created_at FROM ops.prompt_version WHERE prompt_id=:pid ORDER BY version_no DESC LIMIT 1",
            {"pid": prompt_id},
        )
        row = res.first()
        return {"id": str(row.id), "version_no": row.version_no, "created_at": row.created_at}


@router.get("", response_model=list[dict])
async def list_prompt_versions(prompt_id: str, limit: int = 50, offset: int = 0) -> list[dict]:
    async with get_session() as session:
        res = await session.exec(
            "SELECT id, version_no, created_at FROM ops.prompt_version WHERE prompt_id=:pid ORDER BY version_no DESC LIMIT :limit OFFSET :offset",
            {"pid": prompt_id, "limit": limit, "offset": offset},
        )
        rows = res.all()
        return [{"id": str(r.id), "version_no": r.version_no, "created_at": r.created_at} for r in rows]


