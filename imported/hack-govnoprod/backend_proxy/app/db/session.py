from __future__ import annotations

from typing import Optional, AsyncGenerator
from contextlib import asynccontextmanager

from sqlmodel import SQLModel
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text


engine: Optional[AsyncEngine] = None
async_session: Optional[sessionmaker] = None


async def init_db(database_url: Optional[str]) -> None:
    """Initialize async engine and create all tables."""
    global engine, async_session
    if database_url is None:
        # default to sqlite file for development
        database_url = "sqlite+aiosqlite:///./backend_proxy.db"

    engine = create_async_engine(database_url, echo=False, future=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # create schemas declared on models (if they don't already exist) and then create tables
    async with engine.begin() as conn:
        def _create_schemas(sync_conn):
            schemas = {t.schema for t in SQLModel.metadata.tables.values() if t.schema}
            for s in schemas:
                # use IF NOT EXISTS to be idempotent
                sync_conn.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{s}"'))

        await conn.run_sync(_create_schemas)
        await conn.run_sync(SQLModel.metadata.create_all)


async def close_db() -> None:
    global engine
    if engine is not None:
        await engine.dispose()
        engine = None


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Async context manager that yields an AsyncSession compatible object.

    Many code paths in this project call `await session.exec(...)` (SQLModel
    convenience). The SQLAlchemy `AsyncSession` doesn't implement `exec`, so
    we add a small compatibility shim on the instance that delegates to
    `execute` and returns the result. This keeps existing callers working
    without changing their usage.
    """
    assert async_session is not None, "Database not initialized"
    async with async_session() as session:
        # add `exec` compatibility if missing
        if not hasattr(session, "exec"):
            async def _exec(statement, params=None):
                # delegate to SQLAlchemy execute; preserve caller semantics
                if params is None:
                    result = await session.execute(statement)
                else:
                    result = await session.execute(statement, params)
                return result

            # attach as attribute on the instance
            session.exec = _exec

        try:
            yield session
        except Exception:
            await session.rollback()
            raise


