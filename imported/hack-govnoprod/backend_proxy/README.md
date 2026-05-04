# backend_proxy

API Gateway skeleton for the project. See `docs/backend_proxy.md` in the repository for the implementation plan and milestones.

Added DB schema and scaffolding. Files added:

- `db_schema.sql` - full SQL schema
- `alembic/` - alembic configuration and initial migration
- `app/models/orm/*.py` - SQLModel ORM models for main entities
- `app/repositories/prompt_repo.py` - repository for prompts
- `app/schemas/prompt.py` - Pydantic DTOs
- `app/api/routers/prompts.py` - prompts router
- `ER_diagram.mmd` - Mermaid ER diagram
- `app/seed/seed_data.py` - seed scaffold

To run locally (development):

1. Create a `.env` in the `backend_proxy/` folder with necessary settings (e.g. `DATABASE_URL`).
   - Example `DATABASE_URL`: `postgresql+asyncpg://postgres:postgres@db:5432/backend_proxy`
2. Install dependencies: `poetry install`.
3. Configure `alembic.ini` `sqlalchemy.url` to point to your DB.
4. Run migrations: `alembic upgrade head` (from `backend_proxy/`).
5. Start: `uvicorn backend_proxy.app.factory:create_app --factory --reload`.

Docker tips:
- The service expects a Postgres instance; the default `DATABASE_URL` in settings points to `localhost`.
- In Docker Compose use a `db` service and set `DATABASE_URL` accordingly before starting the app.


