from logging.config import fileConfig
import os

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here for 'autogenerate' support
from sqlmodel import SQLModel
import sys
import os
from sqlalchemy import create_engine

# Try importing using the package path used in development (backend_proxy).
# When running inside the Docker container the project root is mounted at /app
# and the package layout may expose `app` directly instead of `backend_proxy.app`.
repo_root = os.getcwd()
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

try:
    from backend_proxy.app.db.session import engine
    from backend_proxy.app.models import orm as orm_models
except Exception:
    # Fallback to importing the local `app` package
    try:
        from app.db.session import engine
        from app.models import orm as orm_models
    except Exception:
        # As a last resort, try adding `backend_proxy` subdir to path
        backend_pkg_path = os.path.join(repo_root, "backend_proxy")
        if backend_pkg_path not in sys.path:
            sys.path.insert(0, backend_pkg_path)
        from app.db.session import engine
        from app.models import orm as orm_models

target_metadata = SQLModel.metadata


def _get_connectable_from_config():
    """Return a sync SQLAlchemy Engine suitable for Alembic when the app's
    async `engine` wasn't initialized. Tries alembic.ini `sqlalchemy.url`
    then `DATABASE_URL` env var. Converts common async URL schemes to sync.
    """
    # Prefer explicit DATABASE_URL environment variable (safer for containers/CI).
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    if not url:
        raise RuntimeError(
            "No database URL available for Alembic migrations. Set `sqlalchemy.url` in alembic.ini or DATABASE_URL env"
        )
    # Convert a few common async URL markers to their sync equivalents so
    # SQLAlchemy can create a sync Engine for migrations.
    sync_url = url.replace("+asyncpg", "")
    sync_url = sync_url.replace("+aiosqlite", "sqlite")
    return create_engine(sync_url)


def run_migrations_offline():
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    # If the application's async `engine` wasn't initialized (None), fall back
    # to creating a sync Engine from configuration for Alembic to use.
    if engine is None:
        connectable = _get_connectable_from_config()
    else:
        connectable = engine.sync_engine if hasattr(engine, 'sync_engine') else engine

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()


