-- =====================================================================
-- Full DB schema for backend_proxy (derived from provided SQL)
-- Save as backend_proxy/db_schema.sql
-- =====================================================================

-- =====================================================================
-- Bootstrap
-- =====================================================================
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS mart;

-- для gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- ENUM types
-- =====================================================================
DO $$ BEGIN
  CREATE TYPE ops.prompt_format_enum AS ENUM ('auto','xml','markdown');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.tri_priority_enum AS ENUM ('low','medium','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.patch_type_enum AS ENUM ('safe','risky');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.patch_category_enum AS ENUM ('markup','vocabulary','structure','clarity');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.contradiction_type_enum AS ENUM ('intra','inter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.org_role_enum AS ENUM ('owner','admin','member','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.membership_status_enum AS ENUM ('active','invited','removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.client_app_type_enum AS ENUM ('browser_ext','vscode','cli','api');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.repo_provider_enum AS ENUM ('github','gitlab','bitbucket','local');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.analysis_run_status_enum AS ENUM ('queued','running','succeeded','failed','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.node_result_status_enum AS ENUM ('pass','fail','warn','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.cookbook_severity_enum AS ENUM ('info','warn','block');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.cookbook_check_status_enum AS ENUM ('pass','fail','warn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.grade_enum AS ENUM ('A','B','C','D','F');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.capture_severity_enum AS ENUM ('info','warn','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.settings_owner_enum AS ENUM ('org','project','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.tag_entity_enum AS ENUM ('prompt','analysis_run','repo_file','workspace','recommendation','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE ops.rate_limit_scope_enum AS ENUM ('api_key','user','project','org');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- 1) Мульти-тенантность и доступ
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.organization (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES ops.organization(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  key            TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.organization_user (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES ops.organization(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
  role             ops.org_role_enum NOT NULL,
  status           ops.membership_status_enum NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS ops.api_key (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES ops.organization(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES ops.projects(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  key_hash         TEXT NOT NULL UNIQUE,
  scopes           JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at       TIMESTAMPTZ,
  is_revoked       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.provider_credential (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES ops.organization(id) ON DELETE CASCADE,
  project_id       UUID REFERENCES ops.projects(id) ON DELETE SET NULL,
  provider         TEXT NOT NULL, -- openai|anthropic|slack|github ...
  credential_ref   TEXT NOT NULL,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.client_app (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          ops.client_app_type_enum NOT NULL,
  name          TEXT NOT NULL,
  version       TEXT NOT NULL,
  platform      TEXT NOT NULL,
  install_id    TEXT NOT NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ,
  UNIQUE (type, install_id)
);

CREATE TABLE IF NOT EXISTS ops.devices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  platform      TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  provider      TEXT NOT NULL,
  external_id   TEXT NOT NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)
);

CREATE TABLE IF NOT EXISTS ops.sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  project_id    UUID REFERENCES ops.projects(id) ON DELETE SET NULL,
  client_app_id UUID REFERENCES ops.client_app(id) ON DELETE SET NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS ops.tools (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.llm_models (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL,
  name          TEXT NOT NULL, -- e.g. gpt-4o, claude-3-5-sonnet
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, name)
);

-- =====================================================================
-- 2) Проекты и каталоги промптов
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.repo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  provider        ops.repo_provider_enum NOT NULL,
  url             TEXT NOT NULL,
  default_branch  TEXT NOT NULL,
  last_sync_at    TIMESTAMPTZ,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.repo_file (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repo_id         UUID NOT NULL REFERENCES ops.repo(id) ON DELETE CASCADE,
  path            TEXT NOT NULL,
  sha             TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  last_indexed_at TIMESTAMPTZ,
  language        TEXT,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_id, path)
);

CREATE TABLE IF NOT EXISTS ops.workspace (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  client_app_id   UUID REFERENCES ops.client_app(id) ON DELETE SET NULL,
  device_id       UUID REFERENCES ops.devices(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.prompt_source (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL, -- repo|workspace|manual|api|other
  repo_file_id    UUID REFERENCES ops.repo_file(id) ON DELETE SET NULL,
  workspace_id    UUID REFERENCES ops.workspace(id) ON DELETE SET NULL,
  meta            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 3) Промпты и версии (с выравниванием под Swagger)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.prompts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  title          TEXT,
  content        TEXT NOT NULL,
  created_by     UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- поля из Swagger (format_type, language, tags, extra_metadata)
ALTER TABLE ops.prompts
  ADD COLUMN IF NOT EXISTS format_type ops.prompt_format_enum NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS language    VARCHAR(10) NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS tags        TEXT[] NULL,
  ADD COLUMN IF NOT EXISTS extra_metadata JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_prompts_project ON ops.prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prompts_language ON ops.prompts(language);
CREATE INDEX IF NOT EXISTS idx_prompts_format_type ON ops.prompts(format_type);
CREATE INDEX IF NOT EXISTS idx_prompts_tags_gin ON ops.prompts USING GIN (tags);

CREATE TABLE IF NOT EXISTS ops.prompt_version (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id      UUID NOT NULL REFERENCES ops.prompts(id) ON DELETE CASCADE,
  version_no     INT NOT NULL,
  content        TEXT NOT NULL,
  created_by     UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prompt_id, version_no)
);

CREATE TABLE IF NOT EXISTS ops.prompt_relations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_prompt_id UUID NOT NULL REFERENCES ops.prompts(id) ON DELETE CASCADE,
  to_prompt_id   UUID NOT NULL REFERENCES ops.prompts(id) ON DELETE CASCADE,
  relation_type  TEXT NOT NULL,
  description    TEXT,
  extra_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- типы связей из требований
DO $$ BEGIN
  ALTER TABLE ops.prompt_relations
    ADD CONSTRAINT chk_prompt_relations_type
    CHECK (relation_type IN ('depends_on','overrides','conflicts_with'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Легаси-накопитель результатов (если уже был)
CREATE TABLE IF NOT EXISTS ops.analysis_results (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id  UUID NOT NULL REFERENCES ops.prompts(id) ON DELETE CASCADE,
  report     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 4) Анализ и метрики (операции)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.analysis_run (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  user_id            UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  session_id         UUID REFERENCES ops.sessions(id) ON DELETE SET NULL,
  source_id          UUID, -- опционально: ops.prompt_source/id
  prompt_id          UUID REFERENCES ops.prompts(id) ON DELETE SET NULL,
  prompt_version_id  UUID REFERENCES ops.prompt_version(id) ON DELETE SET NULL,
  status             ops.analysis_run_status_enum NOT NULL,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at        TIMESTAMPTZ,
  meta               JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ops.analysis_metric (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  key              TEXT NOT NULL,
  value_num        NUMERIC,
  value_text       TEXT,
  value_json       JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.analysis_node_result (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  node             TEXT NOT NULL,
  status           ops.node_result_status_enum NOT NULL,
  score            NUMERIC,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 5) LLM-as-Judge (рубрика/критерии/оценки)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.judge_rubric (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.judge_criterion (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rubric_id   UUID NOT NULL REFERENCES ops.judge_rubric(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  weight      NUMERIC NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rubric_id, key)
);

CREATE TABLE IF NOT EXISTS ops.judge_score (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  criterion_id     UUID NOT NULL REFERENCES ops.judge_criterion(id) ON DELETE CASCADE,
  score            NUMERIC NOT NULL CHECK (score >= 0 AND score <= 10),
  comment          TEXT,
  evidence         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_run_id, criterion_id)
);

-- =====================================================================
-- 6) Противоречия / патчи / уточнения (операционные)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.contradiction (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,
  severity         ops.tri_priority_enum NOT NULL,
  description      TEXT NOT NULL,
  evidence         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.patch (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id      UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  prompt_id            UUID REFERENCES ops.prompts(id) ON DELETE SET NULL,
  prompt_version_id    UUID REFERENCES ops.prompt_version(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  diff_text            TEXT NOT NULL,
  rationale            TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.clarify_question (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  question_text    TEXT NOT NULL,
  priority         ops.tri_priority_enum NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.clarify_answer (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES ops.clarify_question(id) ON DELETE CASCADE,
  user_id      UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  answer       TEXT NOT NULL,
  analysis_id  UUID REFERENCES ops.analysis_report(id) ON DELETE SET NULL, -- связь с отчётом (см. ниже)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.apply_session (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
  from_prompt_version_id  UUID REFERENCES ops.prompt_version(id) ON DELETE SET NULL,
  to_prompt_version_id    UUID REFERENCES ops.prompt_version(id) ON DELETE SET NULL,
  summary                 TEXT NOT NULL,
  changes                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 7) Совместимость с «кукбуками» моделей
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.model_provider (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  base_url    TEXT,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.cookbook_rule (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID REFERENCES ops.model_provider(id) ON DELETE SET NULL,
  key         TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT,
  severity    ops.cookbook_severity_enum NOT NULL,
  check_logic JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.cookbook_check (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  rule_id          UUID NOT NULL REFERENCES ops.cookbook_rule(id) ON DELETE CASCADE,
  status           ops.cookbook_check_status_enum NOT NULL,
  details          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_run_id, rule_id)
);

CREATE TABLE IF NOT EXISTS ops.compatibility_summary (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  llm_model_id   UUID NOT NULL REFERENCES ops.llm_models(id) ON DELETE CASCADE,
  grade          ops.grade_enum NOT NULL,
  notes          TEXT,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (analysis_run_id, llm_model_id)
);

-- =====================================================================
-- 8) Захват событий и интеграции
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.capture_event (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts            TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id    UUID REFERENCES ops.projects(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  session_id    UUID REFERENCES ops.sessions(id) ON DELETE SET NULL,
  client_app_id UUID REFERENCES ops.client_app(id) ON DELETE SET NULL,
  kind          TEXT NOT NULL,
  name          TEXT NOT NULL,
  severity      ops.capture_severity_enum NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ops.cli_invocation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_event_id UUID NOT NULL REFERENCES ops.capture_event(id) ON DELETE CASCADE,
  command          TEXT NOT NULL,
  args             JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_code        INT,
  duration_ms      BIGINT
);

CREATE TABLE IF NOT EXISTS ops.ide_installation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capture_event_id UUID NOT NULL REFERENCES ops.capture_event(id) ON DELETE CASCADE,
  ide              TEXT NOT NULL,
  version          TEXT NOT NULL,
  os               TEXT NOT NULL,
  success          BOOLEAN NOT NULL,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- =====================================================================
-- 9) Риски и сигналы галлюцинаций
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.risk_assessment (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  risk_level       ops.tri_priority_enum NOT NULL,
  factors          JSONB NOT NULL,
  recommendations  JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.user_hallucination_signal (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  source              TEXT NOT NULL,
  description         TEXT NOT NULL,
  severity            ops.tri_priority_enum NOT NULL,
  related_prompt_id   UUID REFERENCES ops.prompts(id) ON DELETE SET NULL,
  meta                JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- 10) Рекомендации и реврайты (c поддержкой /analyze/apply)
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.recommendation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id  UUID NOT NULL REFERENCES ops.analysis_run(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  priority         ops.tri_priority_enum NOT NULL,
  meta             JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ops.prompt_revision (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id          UUID REFERENCES ops.prompts(id) ON DELETE SET NULL,
  analysis_id        UUID REFERENCES ops.analysis_report(id) ON DELETE SET NULL,
  revised_content    TEXT NOT NULL,
  improvement_summary TEXT,
  author_user_id     UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  applied_patch_ids  UUID[] NOT NULL DEFAULT '{}',
  quality_gain       NUMERIC(4,2),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_revision_prompt_id ON ops.prompt_revision(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_revision_analysis_id ON ops.prompt_revision(analysis_id);

-- =====================================================================
-- 11) Телеметрия и аудит
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.http_request_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  project_id   UUID REFERENCES ops.projects(id) ON DELETE SET NULL,
  user_id      UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  session_id   UUID REFERENCES ops.sessions(id) ON DELETE SET NULL,
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  status_code  INT NOT NULL,
  latency_ms   BIGINT NOT NULL,
  ip           INET,
  ua_hash      TEXT,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ops.audit_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id  UUID REFERENCES ops.users(id) ON DELETE SET NULL,
  project_id     UUID REFERENCES ops.projects(id) ON DELETE SET NULL,
  action         TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  entity_id      UUID,
  before         JSONB,
  after          JSONB
);

CREATE TABLE IF NOT EXISTS ops.rate_limit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      ops.rate_limit_scope_enum NOT NULL,
  scope_id   TEXT NOT NULL,
  window     TEXT NOT NULL, -- e.g. 1m|1h|1d
  limit      INT NOT NULL,
  used       INT NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL,
  UNIQUE (scope, scope_id, window)
);

-- =====================================================================
-- 12) Настройки и теги
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type  ops.settings_owner_enum NOT NULL,
  owner_id    UUID NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, key)
);

CREATE TABLE IF NOT EXISTS ops.tag (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);

CREATE TABLE IF NOT EXISTS ops.tag_link (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id       UUID NOT NULL REFERENCES ops.tag(id) ON DELETE CASCADE,
  entity_type  ops.tag_entity_enum NOT NULL,
  entity_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tag_id, entity_type, entity_id)
);

-- =====================================================================
-- Swagger-совместимый отчет анализа (MetricReport + детали)
-- (id == prompt_id для прямого соответствия /analyze/report/{prompt_id})
-- =====================================================================
CREATE TABLE IF NOT EXISTS ops.analysis_report (
  id                 UUID PRIMARY KEY REFERENCES ops.prompts(id) ON DELETE CASCADE, -- = prompt_id
  original_prompt    TEXT NOT NULL,
  analyzed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  detected_language  TEXT NOT NULL,
  translated         BOOLEAN NOT NULL DEFAULT FALSE,
  format_valid       BOOLEAN NOT NULL,

  judge_score        NUMERIC(4,2) NOT NULL,
  judge_rationale    TEXT NOT NULL,
  judge_details      JSONB,

  entropy            NUMERIC(6,3) NOT NULL,
  spread             NUMERIC(6,3) NOT NULL,
  clusters           INT NOT NULL,
  samples            TEXT[] NOT NULL,

  length_chars       INT NOT NULL,
  length_words       INT NOT NULL,
  complexity_score   NUMERIC(4,2) NOT NULL,
  overall_score      NUMERIC(4,2) NOT NULL,
  improvement_priority ops.tri_priority_enum NOT NULL
);

CREATE TABLE IF NOT EXISTS ops.analysis_contradiction (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES ops.analysis_report(id) ON DELETE CASCADE,
  type        ops.contradiction_type_enum NOT NULL,
  description TEXT NOT NULL,
  severity    ops.tri_priority_enum NOT NULL,
  locations   TEXT[] NOT NULL
);

CREATE TABLE IF NOT EXISTS ops.analysis_patch (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id   UUID NOT NULL REFERENCES ops.analysis_report(id) ON DELETE CASCADE,
  type        ops.patch_type_enum NOT NULL,
  category    ops.patch_category_enum NOT NULL,
  description TEXT NOT NULL,
  original    TEXT NOT NULL,
  improved    TEXT NOT NULL,
  rationale   TEXT NOT NULL,
  confidence  NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE IF NOT EXISTS ops.analysis_clarify_question (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES ops.analysis_report(id) ON DELETE CASCADE,
  question   TEXT NOT NULL,
  category   TEXT NOT NULL,
  priority   ops.tri_priority_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- mart.* (аналитические витрины)
-- =====================================================================
CREATE TABLE IF NOT EXISTS mart.metric_timeseries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  metric_key   TEXT NOT NULL,
  ts_bucket    TIMESTAMPTZ NOT NULL,
  value_num    NUMERIC,
  value_json   JSONB,
  UNIQUE (project_id, metric_key, ts_bucket)
);

CREATE TABLE IF NOT EXISTS mart.feature_daily (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  feature_key  TEXT NOT NULL,
  events       BIGINT NOT NULL,
  unique_users BIGINT NOT NULL,
  UNIQUE (project_id, day, feature_key)
);

CREATE TABLE IF NOT EXISTS mart.model_daily (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  day            DATE NOT NULL,
  llm_model_id   UUID NOT NULL REFERENCES ops.llm_models(id) ON DELETE CASCADE,
  invocations    BIGINT NOT NULL,
  tokens_in      BIGINT NOT NULL,
  tokens_out     BIGINT NOT NULL,
  avg_latency_ms BIGINT NOT NULL,
  cost_estimated NUMERIC,
  UNIQUE (project_id, day, llm_model_id)
);

CREATE TABLE IF NOT EXISTS mart.analysis_daily (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  analyses     BIGINT NOT NULL,
  avg_overall  NUMERIC(4,2),
  avg_entropy  NUMERIC(6,3),
  UNIQUE (project_id, day)
);

CREATE TABLE IF NOT EXISTS mart.project_kpi_daily (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES ops.projects(id) ON DELETE CASCADE,
  day              DATE NOT NULL,
  dau              BIGINT,
  sessions         BIGINT,
  new_users        BIGINT,
  api_calls        BIGINT,
  error_rate       NUMERIC(5,2),
  avg_response_ms  BIGINT,
  avg_session_sec  BIGINT,
  UNIQUE (project_id, day)
);



-- =====================================================================
-- 13) Entropy API (uploads, progress, results)
-- =====================================================================
CREATE TABLE IF NOT EXISTS entropy_upload (
  id                 TEXT PRIMARY KEY,
  repo_id            TEXT,
  status             TEXT NOT NULL,
  received_at        TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  last_update_at     TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  manifest_json      JSON,
  error_code         TEXT,
  error_message      TEXT,
  error_details      JSON,
  archive_size_bytes BIGINT
);

CREATE INDEX IF NOT EXISTS idx_entropy_upload_status ON entropy_upload(status);
CREATE INDEX IF NOT EXISTS idx_entropy_upload_received_at ON entropy_upload(received_at);

CREATE TABLE IF NOT EXISTS entropy_progress (
  upload_id            TEXT PRIMARY KEY,
  profiles_read_lines  BIGINT NOT NULL DEFAULT 0,
  profiles_bad_lines   BIGINT NOT NULL DEFAULT 0,
  profiles_bytes_gz    BIGINT NOT NULL DEFAULT 0,
  findings_read_lines  BIGINT NOT NULL DEFAULT 0,
  findings_bad_lines   BIGINT NOT NULL DEFAULT 0,
  findings_bytes_gz    BIGINT NOT NULL DEFAULT 0,
  groups_json          JSON,
  file_index_count     INT
);

CREATE TABLE IF NOT EXISTS entropy_result (
  upload_id       TEXT PRIMARY KEY,
  result_json     JSON NOT NULL,
  weights_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entropy_result_weights_version ON entropy_result(weights_version);