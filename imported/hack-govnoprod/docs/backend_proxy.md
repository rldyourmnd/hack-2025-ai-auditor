# backend_proxy — implementation plan (API Gateway)

This document defines the implementation plan for the `backend_proxy` service — an API Gateway that serves all extensions, the admin UI and the landing site. The service follows the project rules: FastAPI, Pydantic v2, async IO, strict layer separation and the app factory pattern.

References: `docs/apiguideline.md`, `docs/backend_public.md`, `docs/backendguideline.md`, `docs/dbguideline.md`, and the project's FastAPI style guide.

## Summary
- Purpose: single entry point for clients (browser extensions, admin UI, landing), serve static/dynamic content, proxy calls to the `backend` analysis service, handle authentication, caching, rate-limiting, logging and metrics.
- Stack: Python 3.11+, FastAPI, SQLModel/SQLAlchemy (async), asyncpg, Alembic, httpx (async), Redis, Prometheus, python-jose for JWT.
- Database: PostgreSQL with two dedicated schemas.
- Pattern: App factory — `def create_app(settings: Settings | None = None) -> FastAPI:`. No app instances at import time.

## Responsibilities
- Authentication/authorization and role checks.
- Proxying requests to `backend` with timeouts, retries and error normalization.
- Serving static/dynamic content (markdown, HTML, images) with safe sanitization.
- Centralized CORS, rate-limiting, monitoring and metrics.
- Caching heavy/expensive responses (Redis).
- Persisting events and audit logs.

## Project layout (recommended)

```
backend_proxy/
  app/
    __init__.py
    factory.py
    config.py
    middleware/
      error_handler.py
      logging_middleware.py
      metrics_middleware.py
      rate_limit_middleware.py
    api/
      routers/
        public.py
        admin.py
        content.py
        proxy.py
    services/
      pipeline_client.py
      content_service.py
      auth_service.py
      events_service.py
    db/
      session.py
      repo/
        content_repo.py
        event_repo.py
    models/
      orm/
        content.py
        event.py
      schemas/
        content.py
        event.py
    utils/
      responses.py
      errors.py
  alembic/
  tests/
  Dockerfile
  requirements.txt
  pyproject.toml
  README.md
```

Each module has a single responsibility. Routers contain DI and validation only; no business logic.

## Requirements & packaging (example)
- `requirements.txt` (no ML deps):

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.3
pydantic-settings==2.1.0
sqlalchemy==2.0.23
sqlmodel==0.0.14
alembic==1.13.1
psycopg[binary]==3.1.15
asyncpg==0.29.0
redis==5.0.1
httpx==0.24.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
prometheus-client==0.16.0
python-multipart==0.0.6
```

- `pyproject.toml` follows `backend/pyproject.toml` rules (ruff, mypy, pytest) and adds `httpx`, `redis`, `prometheus_client` to known third-party.

## Configuration
Implement `app/config.py` using Pydantic Settings. Exposed settings (example):
- `env` (development | production)
- `database_url` (asyncpg)
- `jwt_secret`, `jwt_expire_minutes`
- `backend_api_url` (URL for `backend` service)
- `redis_url`
- `cors_origins`
- `rate_limit` (requests/sec)
- `prometheus_enabled` (bool)

All values are read from environment variables. Provide an `is_development` helper.

## App factory
Provide `create_app(settings: Settings | None = None) -> FastAPI` in `app/factory.py`.
Inside the factory:
- Register middleware (CORS, logging, metrics, rate limit, error handler).
- Configure startup/shutdown to initialize DB engine, Redis pool, httpx client(s), and Prometheus if enabled.
- Include routers with prefixes: `/api/v1/public`, `/api/v1/admin`, `/content`, `/proxy`.
- Do not create a global FastAPI app at import time.

Skeleton example (high level) must include typed dependencies and no business logic.

## Database design: two schemas
The service uses a single PostgreSQL database with two schemas in that database:
- `gateway` — routing, content index, storage references, content metadata.
- `events` — audit logs, API call events, webhook events.

Guidelines:
- SQLModel/SQLAlchemy async usage.
- UUID string primary keys, UTC timestamps.
- `alembic/env.py` must include both schemas metadata.

Example tables (schematic):
- `gateway.contents` (id, key, path, content_type, storage_reference, created_at)
- `events.api_events` (id, path, method, user_id, request_id, status, latency_ms, created_at)

## Proxying to backend
Implement `services/pipeline_client.py`:
- Async `httpx.AsyncClient` with configurable timeouts and limits.
- Retries using exponential backoff and jitter (3 attempts default).
- Error mapping: backend 5xx → 502; timeouts → 504; custom `PipelineError` subclasses.
- Support and forward `Idempotency-Key` header when present.
- Log each proxy call with request_id, path, latency, status.

## Content serving
`api/routers/content.py` responsibilities:
- Validate content path and access rights.
- Read content from DB, S3, or local storage.
- Sanitize markdown -> safe HTML conversion (use bleach) and ensure XML exports use CDATA.
- Cache exports and heavy results in Redis with `content:{key}:{version}` keys and configurable TTL.

## Authentication and authorization
- All `/api/v1/*` endpoints require JWT Bearer.
- Implement `auth_service.py` with `get_current_user` dependency and `require_admin` guard.
- Validate tokens using `python-jose` and optionally refresh/lookup in DB.
- Minimum roles: `user`, `admin`.

## Middleware and error handling
- `error_handler.py` returns standardized error responses: `{error_code, message, details, timestamp, request_id}` and maps exceptions to HTTP statuses.
- `logging_middleware.py` emits structured JSON logs with `timestamp, level, service, module, request_id, user_id?, path, method, status, duration_ms`.
- `metrics_middleware.py` collects Prometheus metrics: request count, duration histogram, error counters.
- `rate_limit_middleware.py` implements Redis-backed token bucket per IP or API key.

## Observability
- Expose `/metrics` for Prometheus when enabled.
- Instrument latencies and error rates per route.
- Propagate `X-Request-ID` and include it in logs and error responses.
- Optionally integrate OpenTelemetry later.

## Security best practices
- Restrict CORS to a whitelist.
- Enforce body size limits and field length limits for content fields.
- Strict pydantic validation for inputs.
- Sanitize content exports to prevent XSS.
- Store secrets in env; never commit `.env`.

## Testing
- Unit tests: `tests/unit/` for services, utils and repos (use mocks for DB and Redis).
- Integration tests: `tests/integration/` using a test DB (testcontainers recommended) or SQLModel metadata create/drop.
- Use `AsyncClient` to test endpoints and include auth flows, proxy error mapping and caching behavior.

## CI / CD
- Linters: ruff/isort/black (pre-commit).
- Type check: mypy.
- Tests: pytest with coverage thresholds.
- Docker build: multi-stage; run with multiple Uvicorn workers in production.
- Deploy via Docker image and infra compose with nginx reverse proxy; use service healthchecks.

## Migrations
- `alembic/env.py` must import ORM models and include both `gateway` and `events` metadata.
- Name migrations `00x_description.py`.
- CI must validate migration autogeneration and apply migrations against test DB.

## Dockerfile
Follow project Docker rules: uppercase instructions, order: FROM → ENV/ARG → COPY → RUN → ENTRYPOINT/CMD, use multiline RUN with `\`.
Example runtime command: `uvicorn app.factory:create_app --factory --host 0.0.0.0 --port 8000`.

## Implementation milestones and checklists
Each milestone is a small PR. Every item below must include the acceptance criteria checklist.

1) Initialize repository and skeleton
- [ ] Create repository skeleton: `app/`, `alembic/`, `tests/`, `requirements.txt`, `pyproject.toml`, `Dockerfile`, `README.md`.
  - **Acceptance criteria:**
    - [ ] `create_app` exists as a placeholder in `app/factory.py` (no app at import).
    - [ ] `requirements.txt` contains required packages.
    - [ ] CI pipeline stub added (lint/test job defined).

2) Implement configuration and app factory
- [ ] `app/config.py` (Pydantic Settings) and `app/factory.py` with middleware and router wiring.
  - **Acceptance criteria:**
    - [ ] Settings load from env and provide `is_development`.
    - [ ] App factory registers CORS and placeholder middleware functions.
    - [ ] Startup/shutdown handlers initialize and close DB and Redis clients (stubs acceptable).
    - [ ] Unit tests for `create_app` confirm app has expected routers and startup events configured.

3) DB engine and Alembic with two schemas
- [ ] `app/db/session.py` async engine, session factory; `alembic/env.py` configured for two schemas.
  - **Acceptance criteria:**
    - [ ] Async engine connects to test DB in CI and `SELECT 1` passes.
    - [ ] Alembic env imports ORM models and `target_metadata` contains both schemas' metadata.
    - [ ] Integration test runs `alembic upgrade head` on test DB (or SQLModel create_all) and cleans up.

4) Implement core models and schemas
- [ ] Add `models/orm/content.py`, `models/orm/event.py`, and matching Pydantic schemas.
  - **Acceptance criteria:**
    - [ ] Models include UUID primary keys and UTC timestamps.
    - [ ] Schemas use Pydantic v2 and validate required fields with examples.
    - [ ] Unit tests validate model <-> schema mapping and field constraints.

5) Implement pipeline client (proxy client)
- [ ] `services/pipeline_client.py` with async httpx client, retries and error mapping.
  - **Acceptance criteria:**
    - [ ] Client retries on transient errors and backs off with jitter.
    - [ ] Timeout and limits are configurable via settings.
    - [ ] Unit tests mock httpx to validate retry and error mapping behavior.

6) Implement API routers (proxy, content, public) with auth guards
- [ ] `api/routers/proxy.py`, `content.py`, `public.py` and JWT guards.
  - **Acceptance criteria:**
    - [ ] Endpoints are under correct prefixes and versioned ( `/api/v1/*` ).
    - [ ] Guards reject unauthenticated requests with 401 and insufficient-role with 403.
    - [ ] Integration tests cover happy and error flows (auth required, proxy mapping).

7) Add Redis cache and rate limiting
- [ ] Redis-backed cache for content and rate limit middleware.
  - **Acceptance criteria:**
    - [ ] Cache stores and retrieves content with TTL and versioned keys.
    - [ ] Rate limiter enforces configured limit per IP/API key and returns 429 when exceeded.
    - [ ] Tests cover cache hit/miss and rate limiting paths.

8) Add Prometheus metrics and structured logging
- [ ] Implement `/metrics`, metrics middleware, and structured JSON logging.
  - **Acceptance criteria:**
    - [ ] `/metrics` exposes counters and histograms with meaningful labels.
    - [ ] Logs include request_id and duration; a sample request produces expected JSON fields.
    - [ ] Tests assert metrics increase after requests.

9) Tests and CI
- [ ] Achieve automated CI (lint, typecheck, tests) and required test coverage.
  - **Acceptance criteria:**
    - [ ] CI pipeline passes lint and typecheck.
    - [ ] Unit and integration tests pass in CI against test DB.
    - [ ] Coverage thresholds are met (team-defined threshold).

10) OpenAPI docs and deployment readiness
- [ ] Document endpoints, examples, and provide infra compose snippet for deployment.
  - **Acceptance criteria:**
    - [ ] OpenAPI contains summaries/descriptions for all endpoints and examples for OK and error responses.
    - [ ] Docker image builds in CI and starts with healthcheck; `uvicorn` correctly runs the factory.
    - [ ] infra/docker-compose example includes nginx reverse proxy and healthchecks.

## Risks and mitigations
- Long `backend` responses: mitigate with timeouts, retries and queueing long jobs to background workers.
- Migration conflicts: ensure Alembic is configured with schemas and run migration tests in CI.
- Secrets leakage: require env validation and do not allow `.env` commits.

## Final notes
This plan gives a step-by-step work breakdown with explicit, testable acceptance criteria. Each milestone must be delivered as a small PR and pass CI checks before merging.
