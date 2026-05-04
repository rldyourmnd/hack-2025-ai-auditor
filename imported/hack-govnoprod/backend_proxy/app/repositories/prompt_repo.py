from __future__ import annotations

from typing import Optional

from sqlmodel import select

from ..db.session import get_session
from ..models.orm.users import Prompt


class PromptRepository:
    async def get_by_id(self, prompt_id: str) -> Optional[Prompt]:
        async with get_session() as session:
            statement = select(Prompt).where(Prompt.id == prompt_id)
            result = await session.exec(statement)
            return result.first()

    async def create(self, prompt: Prompt) -> Prompt:
        async with get_session() as session:
            session.add(prompt)
            await session.commit()
            await session.refresh(prompt)
            return prompt


