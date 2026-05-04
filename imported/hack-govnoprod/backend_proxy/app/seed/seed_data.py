from __future__ import annotations

import asyncio
from datetime import datetime

from sqlmodel import SQLModel

from ..db.session import engine
from ..models.orm.users import Organization, User, Project, Prompt


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

    # naive seeding via sync connection
    async with engine.connect() as conn:
        org_id = await conn.execute("SELECT gen_random_uuid()")


if __name__ == "__main__":
    asyncio.run(seed())


