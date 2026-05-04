from __future__ import annotations

from typing import TypeVar, Generic, Type, Optional, List

from sqlmodel import select

from ..db.session import get_session

T = TypeVar("T")


class GenericRepository(Generic[T]):
    def __init__(self, model: Type[T]):
        self.model = model

    async def get(self, id: str) -> Optional[T]:
        async with get_session() as session:
            statement = select(self.model).where(self.model.id == id)
            result = await session.execute(statement)
            return result.scalars().first()

    async def list(self, limit: int = 100, offset: int = 0) -> List[T]:
        async with get_session() as session:
            statement = select(self.model).limit(limit).offset(offset)
            result = await session.execute(statement)
            return result.scalars().all()

    async def create(self, instance: T) -> T:
        async with get_session() as session:
            session.add(instance)
            await session.commit()
            await session.refresh(instance)
            return instance

    async def delete(self, id: str) -> None:
        async with get_session() as session:
            instance = await self.get(id)
            if instance:
                await session.delete(instance)
                await session.commit()


