## Comprehensive Implementation Plan for the Platform REST API (CRUDL)

This document describes the full scope to implement all listed endpoints: architecture, tasks, Definition of Done (DoD), and Acceptance Criteria (AC). Implementation is fully asynchronous with FastAPI, without queues/Redis or task managers. All read/write operations use PostgreSQL via async SQLAlchemy. The OpenAPI/Swagger schema is auto-generated and maintained via Pydantic v2 models with descriptions and examples.

### 1) Service Architecture

- Services:
  - `backend_proxy` — primary API aggregator for clients. Implements Authentication/Authorization, catalogs, projects, settings, sources, repositories, client apps/devices/sessions, analysis runs, judge/risk/recommendations, telemetry, metrics, audit, etc. All data is stored in its own database.
  - `backend` — analysis service (already present). All Analyze endpoints call this service over HTTP (async `httpx`) with timeouts and retries. Results and operational history are persisted in `backend_proxy` DB.

- Storage: PostgreSQL (for `backend_proxy`). Migrations: Alembic.
- Stack: Python 3.11+, FastAPI, Pydantic v2, SQLAlchemy (async), Alembic, httpx (async), jose/pyjwt + Authlib (JWT/OAuth), structlog/uvicorn (logging).
- Service style: see “FastAPI Microservices — Code & API Style” in repo docs.

### 2) API Conventions

- Headers:
  - `Authorization: Bearer <token>` — API key or JWT.
  - `X-Client-App-Id`, `X-Session-Id`, `X-Request-ID` — tracing.
  - `Idempotency-Key` for unsafe operations (create/update), with deduplication persisted server-side.

- Pagination/Filtering:
  - All List endpoints support: `limit` (1–1000; default 50), `cursor` (base64; stable by `created_at,id`), `sort` (allowlisted fields with `asc|desc`), `q` (indexed search), `filter[*]` (strict whitelisted fields/operators).
  - List responses follow envelope: `{ data: [...], meta: { next_cursor?, limit, total? } }`.

- Errors: `{ error_code, message, details? }`; 4xx/5xx; no internal details leakage.

- Naming: stable resource names; snake_case fields; time in ISO-8601 UTC (Z).

- OpenAPI/Swagger: domain tags, descriptions, examples, error schemas for all 4xx/5xx.

### 3) Security & Access

- Authentication modes:
  - API keys (org-level) — stored as hashes only; return masked view after creation.
  - JWT (email/password and OAuth providers) — `access` + `refresh` tokens. RSA signature; JWKS exposed via `GET /auth/jwks.json`.
  - Service-to-service: JWT only.

- OAuth providers: Google, GitHub (Authlib) — redirect/start and callback; map to local `User`.

- RBAC: organization/project roles; policy checks at router and service layers.

- Rate limits (MVP): token buckets in memory/DB, endpoint to show current limits.

### 4) Database & Data Access Layer

- SQLAlchemy async + session-per-request.
- Alembic migrations with review.
- Repositories (CRUD + filters/pagination) and service layer (validation, authorization, transactions).
- Indices on FKs, unique constraints, soft/hard delete as required.

### 5) Unified Response Format

- Read/Update/Delete: return resource object/status per REST.
- Create: `201 Created` + `Location` header.
- List: `{ data, meta }`.
- Errors: `{ error_code, message, details }`.

---

## Domain Backlog: Tasks, DoD, and Acceptance Criteria

Below each resource group includes implementation tasks, Definition of Done (DoD), and Acceptance Criteria (AC).

### A. Auth & Identity

Endpoints:
- POST `/auth/login`
- POST `/auth/signup` (optional)
- POST `/auth/token/refresh`
- POST `/auth/logout`
- GET `/auth/me`
- GET `/auth/check`
- GET `/auth/jwks.json`
- GET `/auth/providers`
- GET `/auth/oauth/{provider}/start`
- GET `/auth/oauth/{provider}/callback`

Tasks:
1. ORM: `User`, `IdentityProviderAccount`, `RefreshToken`, `Org`, `OrgMember`, `Role` (several may exist — reconcile and extend).
2. JWT: RSA key generation (env or auto at boot, rotation), JWKS endpoint, verification.
3. Passwords: hashing (argon2/bcrypt), bruteforce protection.
4. OAuth (Google/GitHub) via Authlib: config, redirect, callback, account linking to `User`.
5. `GET /auth/me`: profile + orgs/projects/roles.
6. Middleware: extract token, client/session context, tracing.
7. Tests: unit + integration.

DoD:
- All endpoints functional, documented with examples. Login/refresh/logout flows covered.
- JWT signs/verifies, JWKS returns active public keys.
- RBAC middleware present; tests green.

AC:
- Email/password login returns `{access_token, refresh_token, expires_in}`.
- Refresh returns a fresh access token; session validity respected.
- OAuth providers return tokens and create/link user on first login.

### B. Organizations & API Keys

Endpoints:
- POST/GET/GET(id)/PATCH/DELETE `/orgs`
- Members: POST/GET/PATCH/DELETE `/orgs/{org_id}/members(/ {user_id})`
- API keys: POST/GET/DELETE/POST rotate `/orgs/{org_id}/api-keys(/ {key_id}|/{key_id}/rotate)`

Tasks:
1. ORM: `Organization`, `OrgMember` (role), `ApiKey` (hash+prefix+mask, last_used_at, scopes), auditing.
2. Routers/services with role validation (owner/admin/manage_api_keys).
3. Issue/rotate keys, store only hash; return full value only once.
4. Pagination/filters for lists.

DoD:
- CRUDL for organizations, members, API keys with RBAC.

AC:
- Newly created API key is returned once in full, later only masked/metadata.

### C. Users

Endpoints:
- GET `/users`
- GET/PATCH/DELETE `/users/{user_id}`

Tasks:
1. ORM: `User` (extend as needed), filters by org/project.
2. Profile update service (validation).

DoD/AC:
- Lists scoped by permissions; updates limited by roles or self-update rules.

### D. Projects

Endpoints:
- POST/GET/GET(id)/PATCH/DELETE `/projects`

Tasks:
1. ORM: `Project` (org_id, name, slug, created_by, ...), indices.
2. RBAC: org members access; optional project-level roles.

DoD/AC:
- CRUDL with authorization and pagination; referential integrity validated across dependent resources.

### E. Provider Credentials & LLM Models

Endpoints:
- Provider creds: POST/GET `/projects/{project_id}/provider-credentials`, GET/PATCH/DELETE `/provider-credentials/{cred_id}`
- LLM models: POST/GET `/llm-models`, GET/PATCH/DELETE `/llm-models/{model_id}`

Tasks:
1. ORM: `ProviderCredential` (secret encryption), `LlmModel` (name, provider, family, context_length, tags).
2. Secret encryption (e.g., Fernet with master key from env); gated access by roles.

DoD/AC:
- Secrets never leak to logs/Swagger; CRUDL works; filters by provider/tags.

### F. Client Apps, Devices, Sessions

Endpoints:
- Client apps: POST `/client-apps/register`, POST `/client-apps/{app_id}/heartbeat`, GET/GET(id)/PATCH/DELETE, GET `/client-apps/{app_id}/health`
- Devices: POST/GET/GET(id)/PATCH/DELETE `/devices`
- Sessions: POST `/sessions`, PATCH `/sessions/{session_id}/finish`, GET/GET(id)

Tasks:
1. ORM: `ClientApp` (type: browser_ext|vscode_ext|cli|other), `Device` (os, arch, fingerprint), `Session` (user/project/client_app/device, started_at/finished_at).
2. Health: validate key/bindings/permissions, return status.
3. Heartbeat updates `last_seen_at` and client version.

DoD/AC:
- Registration returns `app_id`. Session ties to request context (headers + token); finish sets `finished_at`.

### G. Settings (unified) + Device/App Settings

Endpoints:
- Catalog: GET `/settings/catalog?scope=browser_ext|vscode_ext|shared`
- Effective: GET `/settings/effective?owner_type=client_app&owner_id=...&device_id=...&project_id=...`
- Generic CRUDL: GET `/settings/{owner_type}/{owner_id}`, GET/PUT/DELETE `/settings/{owner_type}/{owner_id}/{key}`
- Aliases: GET/PATCH(put) `/client-apps/{app_id}/settings`; GET/PATCH(put) `/devices/{device_id}/settings`

Tasks:
1. ORM: `SettingCatalog` (scope, key, type, default, enum?), `SettingOverride` (owner_type: org|project|user|client_app|device, owner_id, key, value, updated_by).
2. Merge algorithm: defaults → org → project → user → client_app → device.
3. Type validation via Pydantic JSON Schema.
4. Minimal keys supported by server: `revizor.methods.enabled`, `revizor.privacy.noClipboard`, `revizor.ui.showPreview`, `revizor.keys.grab`, `cursorAudit.sendHotkey`, `cursorAudit.osMethod`.

DoD/AC:
- Catalog and merge are correct; aliases work; types validated; responses optionally cached in-memory with TTL.

### H. Repos, Files, Workspaces, Sources

Endpoints:
- Repos: POST/GET `/projects/{project_id}/repos`, GET/PATCH/DELETE `/repos/{repo_id}`, POST `/repos/{repo_id}/sync`
- Repo files: GET `/repos/{repo_id}/files?path_prefix=&language=`, GET `/repo-files/{file_id}`
- Workspaces: POST/GET `/projects/{project_id}/workspaces`, GET/PATCH/DELETE `/workspaces/{ws_id}`
- Prompt sources: POST/GET `/projects/{project_id}/prompt-sources`, GET/PATCH/DELETE `/prompt-sources/{source_id}`

Tasks:
1. ORM: `Repo`, `RepoFile` (path, language, size, hash), `Workspace`, `PromptSource`.
2. `sync`: MVP stub (register event without background workers).
3. Indices on `repo_id,path_prefix,language`.

DoD/AC:
- Files filter/paginate; access controlled by project; `sync` records history.

### I. Prompt Base (Prompts, Versions, Relations, Search)

Endpoints:
- Prompts: POST/GET `/projects/{project_id}/prompts?language=&format_type=&tags=&q=`, GET/PATCH/DELETE `/prompts/{prompt_id}`
- Versions: POST/GET `/prompts/{prompt_id}/versions`, GET `/prompt-versions/{version_id}`
- Relations: POST/GET `/prompts/{prompt_id}/relations`, DELETE `/prompt-relations/{relation_id}`
- Search: GET `/prompts:search?q=&project_id=`

Tasks:
1. ORM: `Prompt`, `PromptVersion`, `PromptRelation`.
2. Search `q`: PostgreSQL full-text index (tsvector) on name/tags/version text.
3. Tags: normalized storage (array/text with GIN index).

DoD/AC:
- Versioning is atomic; search is efficient; relation constraints validated (no disallowed cycles).

### J. Analyze (compatible with swagger flows)

Endpoints:
- POST `/analyze` — `{prompt_id? | inline_prompt, model?, options?}` → `{report, patches, questions}`
- POST `/analyze/apply` — apply patches → `{improved_prompt, applied_patches, quality_gain}`
- POST `/analyze/clarify` — answer questions → recompute/enrich

Tasks:
1. HTTP client to `backend` (base URL from env): route requests, timeouts, retries, tracing headers.
2. ORM: prepare persistence into `AnalysisRun` and child tables (see next section).
3. Transform `backend` responses to the unified `shared` schema.

DoD/AC:
- Happy path: call `backend`, return response to client, persist run+summary; `backend` errors mapped to structured 5xx.

### K. Analysis Runs and Subresources

Endpoints:
- Runs: POST `/projects/{project_id}/analysis-runs`, GET `/projects/{project_id}/analysis-runs`, GET `/analysis-runs/{run_id}`, POST `/analysis-runs/{run_id}:cancel`
- Subresources (GET): `/analysis-runs/{run_id}/metrics|nodes|contradictions|patches|questions|recommendations|cookbook-checks|compatibility`

Tasks:
1. ORM: `AnalysisRun` (status, timings, request_opts, model), `AnalysisNode`, `RunMetric`, `Contradiction`, `Patch`, `ClarifyQuestion`, `Recommendation`, `CookbookCheck`, `CompatibilityItem`.
2. Persist artifacts on Analyze calls; cancellation changes status (no background workers).

DoD/AC:
- All subresources are queryable by `run_id` with filtering/pagination; links are consistent.

### L. Judge (Rubrics, Criteria, Scores)

Endpoints:
- Rubrics: POST/GET `/projects/{project_id}/judge/rubrics`, GET/PATCH/DELETE `/judge/rubrics/{rubric_id}`
- Criteria: POST/GET `/judge/rubrics/{rubric_id}/criteria`, PATCH/DELETE `/judge/criteria/{criterion_id}`
- Scores: POST `/analysis-runs/{run_id}/judge/scores`, GET `/analysis-runs/{run_id}/judge/scores`

Tasks:
1. ORM: `JudgeRubric`, `JudgeCriterion`, `JudgeScore` (by run/node/criterion, source: auto|human, score, comment).
2. Validate relationships (rubric → criteria; scores reference existing run/node/criterion).

DoD/AC:
- Full CRUDL; bulk upsert of scores; aggregate stats (averages/totals) returned.

### M. Cookbook Compatibility

Endpoints:
- Providers: POST/GET `/cookbook/providers`
- Rules: POST/GET `/cookbook/rules`, GET/PATCH/DELETE `/cookbook/rules/{rule_id}`
- Checks/Summary: GET `/analysis-runs/{run_id}/cookbook/checks`, GET `/analysis-runs/{run_id}/compatibility/summary`

Tasks:
1. ORM: `CookbookProvider`, `CookbookRule`, `RunCookbookCheck`, `CompatibilitySummary`.
2. Import/export of rules (optional).

DoD/AC:
- Rules CRUDL; run-level checks readable; summary aggregates correctly.

### N. Contradictions, Patches, Clarify (as standalone resources)

Endpoints:
- GET `/contradictions/{id}`
- GET `/patches/{id}`
- GET `/clarify/questions/{id}`; POST `/clarify/questions/{id}/answers`

Tasks:
1. ORM: dedicated tables referencing `AnalysisRun`/`AnalysisNode`.
2. `answers` are stored and trigger recomputation via `/analyze/clarify` (call `backend`).

DoD/AC:
- Resources are directly readable; answers persist and add new artifacts to the run.

### O. Risk, Recommendations, Revisions

Endpoints:
- Risk: GET/POST `/analysis-runs/{run_id}/risk`
- Recommendations: GET `/analysis-runs/{run_id}/recommendations`
- Prompt revisions: POST/GET `/prompts/{prompt_id}/revisions`, GET/DELETE `/prompt-revisions/{rev_id}`

Tasks:
1. ORM: `RunRisk`, `RunRecommendation`, `PromptRevision`.
2. Add user edits as revisions.

DoD/AC:
- Risks can be saved/read; recommendations are available; revisions linked to prompt versions.

### P. Capture & Integrations

Endpoints:
- POST `/capture/events`, POST `/capture/cli`, POST `/capture/ide-installations`, GET `/capture/events`

Tasks:
1. ORM: `CaptureEvent`, `IdeInstallation`.
2. Payload validation; anti-spam (rate limiting).

DoD/AC:
- Events are persisted and listed with pagination; indices on time/type fields.

### Q. Telemetry, Audit, Rate Limits

Endpoints:
- GET `/telemetry/http-requests`
- GET `/audit/logs`
- GET `/rate-limits/current`

Tasks:
1. Middleware for logging HTTP requests into `TelemetryHttpRequest`.
2. Audit CRUD operations into `AuditLog` (who/what/when/from).
3. Rate-limit storage and current bucket calculation.

DoD/AC:
- Telemetry and audit pages return correct data with filters; current rate limit state returned.

### R. Metrics (mart.*)

Endpoints:
- GET `/metrics/timeseries?project_id=&metric_key=&from=&to=&interval=`
- GET `/metrics/daily/features?project_id=&from=&to=`
- GET `/metrics/daily/models?project_id=&from=&to=`
- GET `/metrics/daily/analysis?project_id=&from=&to=`
- GET `/metrics/daily/project-kpi?project_id=&from=&to=`

Tasks:
1. ORM/Views: `mart_*` tables or SQL views; read-only.
2. Validate time parameters; `interval` in {minute|hour|day}.

DoD/AC:
- Time series correct; interval rules respected; UTC timezone.

### S. Health & About

Endpoints:
- GET `/healthz` — liveness
- GET `/about` — version, git SHA, environment summary (no secrets)

Tasks:
1. DB connectivity check and `backend` reachability (ping with timeout).

DoD/AC:
- `200 OK` when DB is healthy; `about` returns version/env details.

---

## Cross-Cutting Tasks (apply to all domains)

1. Layers and structure (in `backend_proxy`):
   - `api/routers/*.py` — thin controllers.
   - `schemas/*.py` — Pydantic v2 DTOs.
   - `models/orm/*.py` — SQLAlchemy Async ORM models.
   - `repositories/*.py` — DB queries.
   - `services/*.py` — business logic, validation, RBAC.
   - `db/session.py` — async engine + sessionmaker.
   - `config.py` — pydantic-settings.
   - `factory.py` — app factory with lifespan.

2. Pagination/cursor: shared `repositories/base.py` implementing base64 cursor and stable ordering.

3. Filters: shared parser for allowlisted fields/operators.

4. Errors: unified exception hierarchy → HTTPException mapping.

5. Tracing/logging: middleware; generate/propagate `X-Request-ID`.

6. Idempotency: `idempotency_keys` table (key, handler, request_hash, response_hash, ttl, created_at).

7. Documentation: tags, descriptions, examples, error schemas; `openapi.json` is served by `backend_proxy`.

8. Security: CORS, body size limits, strict validation.

9. Performance: lazy loads, indices, request limits, cursor pagination.

10. Migrations: atomic, with rollback and tests.

---

## Step-by-Step Execution Plan (Iterations)

Iteration 0 — Technical foundation
- [ ] Ensure `backend_proxy` is fully async.
- [ ] Configure `httpx` client for `backend` (timeouts, retries).
- [ ] Middleware: auth, context, request-id, telemetry, audit.
- [ ] Common error schemas, pagination, filters.
- [ ] Alembic init/revisions for core tables (users/orgs/projects).

Iteration 1 — Auth/Identity + Orgs/Members/API Keys
- [ ] Implement sections A and B.
- [ ] Tests and Swagger.

Iteration 2 — Users/Projects + Provider Creds + LLM Models
- [ ] Implement sections C, D, E.

Iteration 3 — Client Apps/Devices/Sessions + Settings
- [ ] Implement sections F, G (including merge and scope catalog).

Iteration 4 — Repos/Files/Workspaces/Sources + Prompt Base
- [ ] Implement sections H, I (search, versions, relations).

Iteration 5 — Analyze + Analysis Runs (+subresources)
- [ ] Implement sections J, K (persistence + reads).

Iteration 6 — Judge/Cookbook/Risk/Recommendations/Revisions
- [ ] Implement sections L, M, N, O.

Iteration 7 — Capture/Telemetry/Audit/RateLimits/Metrics/Health/About
- [ ] Implement sections P, Q, R, S.

Each iteration ships: code + migrations + tests + Swagger.

---

## System-Level Acceptance Criteria

- Authentication: JWT+JWKS and API keys; OAuth providers available; `GET /auth/check` returns 200/401 correctly.
- RBAC: org/project scope enforced; attempts outside permissions → 403.
- Pagination/filters: all List endpoints support `limit,cursor,sort,q,filter[*]`; cursor is stable in presence of new inserts.
- Analyze: `/analyze*` call `backend`, timeouts/errors are mapped; `AnalysisRun` and subresources are persisted.
- Settings: merge order is correct `defaults → org → project → user → client_app → device`.
- OpenAPI: all endpoints documented with examples and error schemas; spec validates.
- Tests: unit ≥ 80%, core areas (analysis/identity/settings) ≥ 90%; integration tests cover key flows.
- Observability: JSON logs, `X-Request-ID`, basic request telemetry; `/healthz` reflects DB and `backend` connectivity.

---

## Impact on Repository and Directory Structure (only `backend_proxy`)

- New/updated files (guidance):
  - `app/api/routers/` — `auth.py`, `orgs.py`, `members.py`, `api_keys.py`, `users.py`, `projects.py`, `provider_credentials.py`, `llm_models.py`, `client_apps.py`, `devices.py`, `sessions.py`, `settings.py`, `repos.py`, `repo_files.py`, `workspaces.py`, `prompt_sources.py`, `prompts.py` (extended), `prompt_versions.py`, `prompt_relations.py`, `search.py`, `analyze.py`, `analysis_runs.py`, `judge.py`, `cookbook.py`, `contradictions.py`, `patches.py`, `clarify.py`, `risk.py`, `recommendations.py`, `revisions.py`, `capture.py`, `telemetry.py`, `audit.py`, `rate_limits.py`, `metrics.py`, `health.py`, `about.py`.
  - `app/schemas/` — DTOs per domain; shared `common.py` (errors, pagination, sort, filters).
  - `app/models/orm/` — tables per domain (some already exist: `analysis.py`, `capture.py`, `client.py`, `compatibility.py`, `content.py`, `identity.py`, `judge.py`, `mart.py`, `misc.py`, `recommendation.py`, ... — extend as required).
  - `app/repositories/` — `*_repo.py` per domain + `base.py` (cursors/filters/idempotency).
  - `app/services/` — business logic per domain.
  - `app/config.py` — settings for OAuth/JWT/crypto/limits.
  - `app/factory.py` — initialize routers/middleware/lifespan.

---

## Environment Variables (example)

- `DATABASE_URL` — async Postgres URL.
- `BACKEND_BASE_URL` — base URL for `backend`.
- `JWT_PRIVATE_KEY_PATH`/`JWT_PUBLIC_KEY_PATH` or `JWT_PRIVATE_KEY_PEM`/`JWT_PUBLIC_KEY_PEM`.
- `JWT_ALG` (RS256), `JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`.
- `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `OAUTH_GITHUB_CLIENT_ID`, `OAUTH_GITHUB_CLIENT_SECRET`, `OAUTH_REDIRECT_BASE_URL`.
- `CRYPTO_MASTER_KEY` — for encrypting provider credentials.
- `RATE_LIMITS_*` — token bucket parameters.
- `LOG_LEVEL`, `ENV`, `SENTRY_DSN` (optional).

---

## Testing

- Unit: services, repositories, settings merge, JWT/JWKS, RBAC.
- Integration: main flows (login → project create → analyze → read report), pagination/filters, OAuth.
- Contract: OpenAPI validation (Schemathesis/Prism — optional).

---

## Release Readiness (Definition of Done)

- Tests per targets; linters and type checks are green.
- All endpoints implemented, described in Swagger, and wired to DB.
- `/analyze*` reliably talks to `backend` and persists results.
- Migrations apply cleanly on empty and existing DBs.
- Documentation updated; environment variables declared.
- Docker Compose can run the entire stack locally.

---

## Production Notes

- Secrets only from env/Secret Manager. API keys stored as hashes only.
- CORS, body size limits, and timeouts configured upfront.
- All lists protected from full scans (indexes + limits + cursor).
- Shared components (filters/cursors/errors) are reused across domains.


