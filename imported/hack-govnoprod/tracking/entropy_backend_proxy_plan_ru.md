# План доработки backend_proxy для Entropy API v1 и интеграции VS Code расширения

## 0. Цели и контекст

- **Цель**: реализовать серверную сторону Entropy API (версия v1) в сервисе `backend_proxy` (FastAPI), чтобы VS Code расширение могло:
  - загружать архивы сырья (`profiles.ndjson.gz`, `findings.ndjson.gz`, `manifest.json`) через `POST /entropy/v1/upload` (и опционально через многочастную загрузку);
  - отслеживать статус пайплайна через `GET /entropy/v1/status/{upload_id}`;
  - получать рассчитанные результаты через `GET /entropy/v1/result/{upload_id}`;
  - узнать активную таблицу весов через `GET /entropy/v1/weights`;
  - запрашивать пересчёт с другой версией весов через `POST /entropy/v1/recompute/{upload_id}`.
- **Аутентификация**: `Authorization: Bearer <token>` (используем существующий `require_auth` из `backend_proxy/app/security/auth.py`).
- **Идемпотентность**: обязательный заголовок `X-Upload-Id: <uuid>` для загрузок. Повторный запрос с тем же `X-Upload-Id` должен вернуть прошлый результат (или статус), не дублируя работу.
- **Контент и формат**: ZIP `entropy-input-v1.zip` со строго тремя файлами: `profiles.ndjson.gz`, `findings.ndjson.gz`, `manifest.json`. Внутри GZIP; сервер читает стримингово; лимиты на размер. По умолчанию группировка — «папка верхнего уровня».
- **PFP v2.3**: поддержать декодирование `pfp2:<base85>` профилей; уметь принимать «развёрнутый» вид.
- **Результаты**: вычисление CDX/CCI с разложением на энтропийные оси, HPC, findings; возврат агрегатов и по группам. Источником истины для весов является сервер.

---

## 1. Архитектура и размещение кода (не меняя текущие правила проекта)

- Работать только внутри `backend_proxy/` (не затрагиваем `backend/`).
- Соблюдать текущую структуру FastAPI-приложения:
  - `backend_proxy/app/__init__.py` — содержит `create_app` и автоподключение роутеров `api/routers/*` под префиксом `/api/v1`.
  - Роуты — в `backend_proxy/app/api/routers/*.py` с `APIRouter`.
  - Аутентификация — в `backend_proxy/app/security/auth.py` — использовать `require_auth`.
  - БД сессии — `backend_proxy/app/db/session.py`.
  - ORM модели — `backend_proxy/app/models/orm/*`.
  - Рекомендуем создать новые модули:
    - `backend_proxy/app/api/routers/entropy.py` — все 5+1 эндпойнтов.
    - `backend_proxy/app/services/entropy_ingest.py` — сервис приема архива, валидации и парсинга.
    - `backend_proxy/app/services/entropy_compute.py` — нормализации, расчеты энтропий/штрафов/индексов.
    - `backend_proxy/app/services/pfp_decoder.py` — декодер pfp2 Base85 → структуры.
    - `backend_proxy/app/services/weights.py` — активная таблица весов, версионирование, проверка версий.
    - `backend_proxy/app/repositories/entropy.py` — репозиторий для хранения состояния загрузок, прогресса и результатов.
    - `backend_proxy/app/schemas/entropy.py` — Pydantic-схемы запросов/ответов.
    - `backend_proxy/app/utils/entropy_io.py` — стриминг ZIP/GZIP, лимиты размеров, NDJSON чтение.
    - `backend_proxy/app/utils/grouping.py` — top-level-folder группировка, KLoC оценка.
    - `backend_proxy/app/utils/errors.py` — единый формат ошибок.
  - При необходимости добавить новые таблицы в БД (миграции Alembic в `backend_proxy/alembic/versions`).

---

## 2. Модели данных и БД (миграции)

Добавим 3 новые логические сущности: загрузка, прогресс, результат. Можно сделать 2 таблицы (в прогрессе хранить метрики и манифест), а результат хранить отдельно.

2.1 Таблица `entropy_upload` (основная сущность загрузки)
- `id` (UUID, PK) — совпадает с `upload_id`.
- `repo_id` (TEXT, nullable) — из заголовка `X-Repo-Id`.
- `status` (TEXT, not null) — одно из: `accepted`, `validating`, `parsing_profiles`, `parsing_findings`, `computing`, `computed`, `failed`.
- `received_at` (TIMESTAMP WITH TIME ZONE, not null).
- `last_update_at` (TIMESTAMP WITH TIME ZONE, not null).
- `manifest_json` (JSONB, nullable) — исходный `manifest.json`.
- `error_code` (TEXT, nullable), `error_message` (TEXT, nullable), `error_details` (JSONB, nullable).
- `archive_size_bytes` (BIGINT, nullable).
- Индексы: по `status`, `received_at`.

2.2 Таблица `entropy_progress`
- `upload_id` (UUID, PK, FK -> entropy_upload.id, on delete cascade).
- `profiles_read_lines` (BIGINT, default 0), `profiles_bad_lines` (BIGINT, default 0), `profiles_bytes_gz` (BIGINT, default 0).
- `findings_read_lines` (BIGINT, default 0), `findings_bad_lines` (BIGINT, default 0), `findings_bytes_gz` (BIGINT, default 0).
- Доп. поля: `groups_json` (JSONB) — список групп, `file_index_count` (INT) — число файлов после парсинга.

2.3 Таблица `entropy_result`
- `upload_id` (UUID, PK, FK -> entropy_upload.id, on delete cascade).
- `result_json` (JSONB, not null) — ровно то, что отдаём в `/result/{upload_id}` (с полями `scores`, `decomposition`, `by_group`, `weights_version`, `provenance`, `source`, `groups`).
- `weights_version` (TEXT, not null).
- Индексы: по `weights_version`.

2.4 Таблица (опционально) `entropy_parts` (для многочастной загрузки)
- `upload_id` (UUID, FK), `part_no` (INT, PK композит), `size` (INT), `sha256` (TEXT), `received_at` (TIMESTAMPTZ), `path` (TEXT).
- Поддерживает init/part/complete без хранения всего архива в памяти.

2.5 Alembic
- Создать миграцию с этими таблицами.
- Обновить `backend_proxy/alembic/versions/*`.
- Соблюсти обратную совместимость (только добавляем новые таблицы).

---

## 3. Схемы (Pydantic) `backend_proxy/app/schemas/entropy.py`

3.1 Ответы ошибок (единая модель)
- Универсальная обёртка:
  - `{"error":{"code":"...","message":"...","details":{...}}}`
- В схемах: `ErrorResponse` с полями `code`, `message`, `details: dict[str, Any] | None`.

3.2 Схемы запросов/ответов
- `AcceptedResponse`: `{ upload_id: UUID, status: str }`.
- `StatusResponse`: как в контракте — поля `upload_id`, `status`, `progress`, `manifest`, `received_at`, `last_update_at`.
- `ResultResponse`: как в контракте — поля `upload_id`, `source`, `groups`, `scores`, `decomposition`, `by_group`, `weights_version`, `provenance`.
- `WeightsResponse`: `version`, `entropy_dimensions`, `hpc_rules`, `finding_kinds`, `normalization`, `notes`.
- Многочастная загрузка:
  - `MultipartInitRequest`: `{ size: int, parts: int, sha256: str }` → валидация min/max.
  - `MultipartInitResponse`: `{ upload_id: UUID, part_size: int }`.
  - `MultipartPartResponse`: `{ received: int }`.
  - `MultipartCompleteRequest`: `{ upload_id: UUID, parts: [{ no: int, sha256: str }] }`.
  - `MultipartCompleteResponse`: `{ upload_id: UUID, status: "accepted" }`.

---

## 4. Роуты: `backend_proxy/app/api/routers/entropy.py`

4.1 Общие
- Префикс: `/entropy/v1` (включится под `/api/v1` через фабрику → итог: `/api/v1/entropy/v1/...`).
  - ВНИМАНИЕ: VS Code конфиг `ai-auditor.upload.endpoint` по умолчанию ожидает полный URL. Мы должны документировать правильный путь. Рекомендуем указать пользователю ставить `http://localhost:8080/api/v1/entropy/v1/upload` — либо в роутере задать префикс `/entropy/v1` и в `factory` включится как `/api/v1` → итог `/api/v1/entropy/v1/upload`.
- Зависимость `require_auth` — для всех POST/GET в этом наборе.
- Единый перехват и маппинг ошибок → `errors.py`.

4.2 POST `/entropy/v1/upload`
- Headers: `X-Upload-Id` (uuid, required), `X-Repo-Id` (optional string);
- Body: ZIP бинарь `application/zip`.
- Действия:
  1) Проверить идемпотентность: если `upload_id` в `entropy_upload` уже есть:
     - Если статус `computed`/`computing`/`parsing_*`/`validating`/`accepted`: вернуть `409 Conflict` с ссылкой на уже существующую загрузку (контракт просил «409 — X-Upload-Id уже принят, возвращаем прежний upload_id», фактически можно отдать `{upload_id, status}` с `409`).
  2) Создать запись `entropy_upload` со статусом `accepted`; записать `repo_id`, `received_at`.
  3) Асинхронно запустить ingestion job (см. раздел 6) — либо синхронно (MVP) с ограниченными размерами.
  4) Ответ `202 Accepted` `{ upload_id, status: "accepted" }`.
- Ошибки: 400/401/403/409/413/422/500 — используем общий формат.

4.3 Многочастная загрузка (опционально)
- POST `/entropy/v1/multipart/init` → создать «контейнер загрузки», вернуть `upload_id`, `part_size` (5 MiB по умолчанию; можно конфигурировать через `Settings`).
- PUT `/entropy/v1/multipart/part?upload_id=...&part_no=...` → писать кусок на диск (temp dir по `upload_id`), возвращать `{received}`.
- POST `/entropy/v1/multipart/complete` → верифицировать sha256 по всем частям, склеить ZIP, положить в очередь ingestion, вернуть `202 Accepted`.

4.4 GET `/entropy/v1/status/{upload_id}`
- Возвращает модель статуса с прогрессом чтения NDJSON.gz и info из `manifest`.
- 404 — если нет такой загрузки.

4.5 GET `/entropy/v1/result/{upload_id}`
- Если статус `computed` — отдать `result_json` из таблицы `entropy_result`.
- Если статус ещё не готов — `202` `{ status: "computing" }`.
- 404 — нет загрузки.

4.6 GET `/entropy/v1/weights`
- Отдаёт активную таблицу весов (`weights.py` — источник истины).

4.7 POST `/entropy/v1/recompute/{upload_id}`
- Query: `?weights_version=...` (опционально; если не указано — активная).
- Если загрузка существует и есть сырые признаки в объектном хранилище — запустить пересчёт; вернуть `202` `{status:"recomputing"}`.
- Ошибки: 404 (нет загрузки), 400 (невалидная версия), 409 (уже в процессе).

---

## 5. Объектное хранилище и индексы (MVP без внешнего blob-сторанжа)

- Место хранения «сырья после парсинга» — файловая система (каталог в `tmp/entropy/<upload_id>/`), либо S3-совместимое хранилище (позже). Для MVP:
  - `raw/` — исходный загруженный ZIP (по желанию, для отладки), можно не хранить.
  - `parsed/profiles.jsonl` — нормализованные записи профилей (по файлу): для каждой строки — JSON вида `{ path, group, lang, enums:{...}, q:{...}, hpc_hits:{ rule:bool }, id:{ simhash64, pathhash24, crc8 } }`.
  - `parsed/findings.jsonl` — нормализованные файндинги: `{ kind, scope, file?, line?, group, meta? }` (без метрик score/weight и т.д.).
  - `parsed/manifest.json` — сохранённый манифест.
  - `aggregates/` — предрассчитанные гистограммы/частоты, оценки KLoC, список групп, чтобы ускорить `/result`.
- Индексы:
  - Карта `file → group` и `group → files` (в памяти при расчёте и/или в `aggregates/groups.json`).
  - Для разложения по группам — храним гистограммы по каждой оси в `aggregates/by_group/*.json`.

---

## 6. Ingestion pipeline (валидация, распаковка, парсинг)

6.1 Стриминговая распаковка ZIP
- Используем `zipfile`/`zipstream` эквивалентно; чтение без распаковки в память, валидация лимитов размера (например, до 200 MiB, конфигурируемо в `Settings`).
- Проверить наличие строго трёх файлов: `profiles.ndjson.gz`, `findings.ndjson.gz`, `manifest.json`. Имена — регистрозависимы. Ошибка → `400`/`422` с соответствующей деталью.

6.2 Чтение `manifest.json`
- Парсим JSON; проверяем обязательные поля из контракта (client, repo, counts, generated_at/ timestamp). Не критично для расчётов, но полезно для `status` и `provenance`.
- Сохраняем в `parsed/manifest.json` и в поле `entropy_upload.manifest_json`.

6.3 Чтение `profiles.ndjson.gz`
- GZIP-стрим; построчно JSON decode. Лимит на длину строки (например, 1 MiB).
- Каждая строка либо:
  - PFP-вид: `{ path, sha, tier, pfp: "pfp2:<base85>", decode_hint? }` — вызываем `pfp_decoder.decode_pfp2(...)`.
  - Развёрнутый: `{ path, sha, planes_present, Q, ENUMS, HPC, ID }` — маппим напрямую.
- Нормализуем к внутреннему виду:
  - `q` — список/словарь бакетов (0..6) по известным ключам (`lines_code`, `imports_total`, ...).
  - `enums` — значения по 16 осям (по `mapping_v23.yaml`, если понадобится связь с именами).
  - `hpc_mask` → `hpc_hits` bool-словарь имён правил согласно `mapping_v23.yaml` (см. раздел «weights» и «mapping»).
  - `id` — `simhash64`, `pathhash24`, `crc8` (если есть).
  - `group` — top-level-folder от `path` (см. `utils/grouping.py`).
  - `lang` — по расширению файла (минимальная эвристика; пригодится для группировки/фильтров).
- Инкрементируем счётчики прогресса: `read_lines`, `bad_lines`, `bytes_gz`.
- Пишем нормализованный JSONL в `parsed/profiles.jsonl`.

6.4 Чтение `findings.ndjson.gz`
- GZIP-стрим; построчно JSON decode.
- Нормализация: берём только `kind`, `scope`, опционально `file`, `line`, `context`, `left`, `right`, `meta`. Отбрасываем клиентские метрики.
- Определяем `group` по `file` (если есть), иначе — общий `"."` или из `manifest.repo.default_grouping`.
- Инкрементируем прогресс; пишем `parsed/findings.jsonl`.

6.5 Обновление статуса
- После успешного парсинга профилей → `status = parsing_findings`.
- После успешного парсинга файндингов → `status = computing`.
- Любая ошибка → `status = failed` + `error_*` поля; в ответах — модель ошибки.

---

## 7. Расчёт (compute) CDX/CCI

7.1 Подготовка агрегатов
- Сканируем `parsed/profiles.jsonl` и собираем:
  - `per_file_enums[file] = { dim: value }`.
  - `per_file_q[file] = { metric: bucket }`.
  - `per_file_hpc_hits[file] = { rule: bool }`.
  - `lines_buckets[file] = bucket(lines_code)`.
  - `group_by_file[file] = topLevelFolder(path)`; `files_by_group[group] = []`.
- Оцениваем `KLoC_est`:
  - Для всего набора: суммируем центры бакетов LoC и делим на 1000.
  - Для групп: аналогично по файлам группы.

7.2 Нормализация и метрики
- Энтропийные оси (Enums и Q) → `H_norm` и `coverage` по формулам:
  - H = −Σ p_i log2 p_i
  - H_norm = H/log2(m), m — число ненулевых бинов; coverage = defined/N_files.
  - вклад = `w_d * H_norm * coverage`.
- HPC: `rate_r = files_with_rule_r / N_files`; вклад = `w_hpc[r] * rate_r`.
- Findings: `norm(kind) = count_k / kloc` (по умолчанию), особые — по 100 файлов или клипы. Вклад = `w_kind[k] * norm_k`.

7.3 Итоговые индексы
- `CDX = EntropyTerm + HpcPenalty + Findings`
- `CCI = max(0, 100 − CDX)`
- Сохраняем `result_json` в `entropy_result` и в `aggregates/`.
- `status = computed`.

7.4 Разложение по группам
- Повторяем расчёт энтропийных/НРС/файнд. компонент на срезе файлов группы; получаем `by_group[group] = { CDX, CCI }`.

---

## 8. Таблица весов (weights) и версионирование

- Модуль `services/weights.py` хранит активную таблицу весов и может поднимать другую версию по запросу.
- Версия по умолчанию: `v1.0` (как в примере). Структура:
  - `entropy_dimensions: Dict[str, int]` — имена осей и веса.
  - `hpc_rules: Dict[str, int]` — имена правил и веса.
  - `finding_kinds: Dict[str, int]` — имена видов находок и веса.
  - `normalization: { findings: ..., hpc: ..., entropy: ... }` — строки-договорённости для клиента.
  - `notes`: текст объяснений/примечаний.
- Источником имен для HPC служит `mapping_v23.yaml` (есть в `extensions/apps/vscode-ext/schemas/mapping_v23.yaml`). Для бэкенда можно продублировать свою копию (лучше версионированная копия под `backend_proxy/app/schemas/mapping_v23.yaml`), либо прошивать список в коде на MVP.

---

## 9. Идемпотентность, лимиты, ошибки

- Идемпотентность: запись в БД по `upload_id` с уникальным первичным ключом. Повторная попытка — вернуть прежний `upload_id` и текущий `status`. Контракт допускает `409 Conflict` с прежним результатом; можно возвращать `409` и JSON `{upload_id, status}`.
- Лимиты:
  - `max_archive_bytes` — например, 200 MiB.
  - `max_line_bytes` — например, 1 MiB на строку NDJSON.
  - `max_lines_profiles`/`max_lines_findings` — при необходимости.
  - GZIP/ZIP защита от zip-bomb (порог отношения распакованного/сжатого).
- Ошибки: всегда `{"error":{"code":"...","message":"...","details":{...}}}`. Кодовые строки: `VALIDATION_ERROR`, `UNAUTHORIZED`, `PAYLOAD_TOO_LARGE`, `CONFLICT`, `UNPROCESSABLE`, `INTERNAL_ERROR`.

---

## 10. Интеграция с VS Code расширением

- Расширение имеет команду `uploadRawFeatures.ts`, которая:
  - Собирает `profiles.ndjson.gz` и `findings.ndjson.gz` локально, создаёт ZIP, выставляет `X-Upload-Id` и `X-Repo-Id` и шлёт на endpoint.
  - Ключи конфигурации в `package.json`: `ai-auditor.upload.endpoint` (URL), `ai-auditor.upload.token` (SecretStorage), `ai-auditor.upload.useGzip` (клиент уже gzips), опциональная многочастная загрузка `chunked`.
- Совместимость путей: рекомендуем в README для расширения указать: endpoint должен быть `http://<host>:<port>/api/v1/entropy/v1/upload` (учитывая включение роутов под `/api/v1`).
- Токен: расширение кладёт Bearer-токен в `Authorization`; сервер использует `require_auth` (JWT или API-ключи).

---

## 11. Пошаговый план реализации (минимальными итерациями)

Шаг 1. БД и схемы
- Создать Pydantic-схемы в `schemas/entropy.py`.
- Подготовить Alembic миграцию для таблиц `entropy_upload`, `entropy_progress`, `entropy_result`, опц. `entropy_parts`.

Шаг 2. Веса и mapping
- Создать `services/weights.py` с версией `v1.0` по образцу из описания.
- Закрепить локальную копию `mapping_v23.yaml` в `backend_proxy/app/schemas/mapping_v23.yaml` (или прошить в коде список имён и битов HPC для MVP).

Шаг 3. Декодер PFP v2.3
- Реализовать `services/pfp_decoder.py` по референсу (см. Приложение C). Убедиться в корректности чтения бит (LSB-first).
- Покрыть базовыми тестами (несколько синтетических примеров).

Шаг 4. Утилиты IO
- `utils/entropy_io.py`: функции для стримингового чтения ZIP, извлечения файлов по именам, чтения NDJSON.gz с лимитами, подсчёта прогресса.
- `utils/grouping.py`: `top_level_folder(path: str) -> str`, примитивная детекция языка по расширению.

Шаг 5. Репозиторий
- `repositories/entropy.py`: CRUD для таблиц, обновление статуса/прогресса, запись результата, загрузка/сохранение манифеста и агрегатов.

Шаг 6. Роутер
- `api/routers/entropy.py`: реализовать эндпойнты по контракту, обвязать `require_auth` и формат ошибок.

Шаг 7. Ingestion сервис
- `services/entropy_ingest.py`: логика upload/multipart: валидация, распаковка, парсинг профилей/файнд.; обновление прогресса; подготовка данных для расчёта; постановка compute-задачи.

Шаг 8. Compute сервис
- `services/entropy_compute.py`: расчёт энтропийных терминов, HPC, findings, CDX/CCI; разложение по группам; сохранение результата и статуса.

Шаг 9. Weights endpoint
- `GET /entropy/v1/weights` — выдаёт `weights.py`.

Шаг 10. Recompute endpoint
- `POST /entropy/v1/recompute/{upload_id}` — пересчитывает по другой версии весов.

Шаг 11. Тесты
- Юнит-тесты: декодер PFP, нормализации, утилиты bucketize, расчёт CDX/CCI на малом фикстуре.
- Интеграционные: happy path — upload → status(… цепочка статусов …) → result.

Шаг 12. Документация
- Обновить `docs/backend_proxy.md` краткой секцией про Entropy API.
- Сгенерировать выдержку OpenAPI в `infra/openapijson.json` (или добавить описание в существующую схему).

---

## 12. Детали реализации и псевдокод

12.1 `schemas/entropy.py`
- `class AcceptedResponse(BaseModel): upload_id: UUID, status: Literal[...]`
- `class ProgressPart(BaseModel): read_lines: int; bad_lines: int; bytes_gz: int`
- `class StatusResponse(BaseModel): ...`
- `class ResultResponse(BaseModel): ...` в точности по контракту.
- Многочастные: `MultipartInitRequest/Response`, `MultipartCompleteRequest/Response`.

12.2 `api/routers/entropy.py`
- `router = APIRouter(prefix="/entropy/v1", tags=["entropy"])`
- `@router.post("/upload", status_code=202)`
  - `ctx = Depends(require_auth)`
  - `upload_id = request.headers["X-Upload-Id"]` (валидировать UUID)
  - `repo_id = request.headers.get("X-Repo-Id")`
  - Проверить существование загрузки → `409` (см. Идемпотентность)
  - Создать запись `entropy_upload` (`accepted`) и запустить ingestion
  - Вернуть `{ upload_id, status: "accepted" }`
- `GET /status/{upload_id}` → собрать данные из БД + `manifest_json` + `progress`.
- `GET /result/{upload_id}` → если `computed` — отдать `result_json`, если нет — `202`.
- `GET /weights` → `weights.current()`.
- `POST /recompute/{upload_id}` → `weights_version` в `query`, поставить задачу, вернуть `202`.

12.3 `services/entropy_ingest.py`
- Функция `ingest_upload(upload_id, file_stream, repo_id)`:
  - Обновить статус `validating`.
  - Распаковать ZIP (стриминг), найти нужные файлы.
  - Прочитать `manifest.json`, сохранить.
  - Обновить статус `parsing_profiles`.
  - Построчно прочитать `profiles.ndjson.gz` → нормализовать → писать в `parsed/profiles.jsonl`, считать прогресс.
  - Обновить статус `parsing_findings`.
  - Прочитать `findings.ndjson.gz` → нормализовать → `parsed/findings.jsonl`.
  - Обновить статус `computing` и вызвать `compute_upload(upload_id, weights_version=None)`.

12.4 `services/entropy_compute.py`
- Функция `compute_upload(upload_id, weights_version: Optional[str])`:
  - Считать `parsed/*.jsonl`.
  - Построить гистограммы, посчитать KLoC.
  - `entropy_term`, `hpc_term`, `findings_term`; `scores = {CDX, CCI}`.
  - Разложение (списки с `contrib`).
  - По группам.
  - Сохранить `result_json` и поставить `status=computed`.

12.5 `services/pfp_decoder.py`
- Реализовать `_read_bits` (LSB-first), парсинг в порядке: Header(32) → C0..C3(4×64) → HPC(64) → Q(24×3) → ENUMS(16×5) → IDs(64|24|8). См. Приложение C (референс-код на Python).

12.6 `services/weights.py`
- Словарь `WEIGHTS_V1_0` по примеру из ТЗ.
- Ф-ция `get_weights(version: Optional[str]) -> Weights`.

12.7 `repositories/entropy.py`
- CRUD upload/progress/result/parts. Удобные методы: `create_upload`, `get_upload`, `update_status`, `upsert_progress`, `save_result`, `list_parts`, `save_part`, `complete_parts`.

12.8 `utils/entropy_io.py`
- `iter_gzip_ndjson(fileobj, max_line_bytes)` → генератор dict-строк.
- `open_zip_member(zip_stream, name)` → получить file-like.
- Лимиты и валидации.

12.9 `utils/grouping.py`
- `top_level_folder(path)` — взять первый сегмент от корня рабочего каталога; если нет `/` — вернуть `"."`.
- `detect_lang_by_ext(path)` — простая таблица расширений.

---

## 13. OpenAPI и соответствие контракту

- Добавить описания роутов (summary, tags) и схем через Pydantic models, чтобы `/openapi.json` включал Entropy API.
- Проверить коды ответов: `202`, `200`, `404`, `409`, `413`, `422`, `500`.
- Единая модель ошибок через `HTTPException(detail={...})` по нашему формату.

---

## 14. Безопасность и производительность

- Аутентификация — обязательная (Bearer), по `require_auth`.
- Стриминговая обработка ZIP/GZIP — без буферизации всего файла в память.
- Лимиты размеров/строк/времени; отмена задачи по таймауту.
- Валидация JSON линий, защита от злонамеренных входов (zip bomb/парсинг-бомбы).
- Логирование прогресса (без утечки чувствительных данных). Манипулирование `traceparent`/`x-request-id` — опция.

---

## 15. Переиспользование и расширение

- Веса и mapping — версионируемые; рекомпьют без повторной загрузки.
- Хранение агрегатов — ускоряет `GET /result` при повторных запросах.
- Группировки — можно расширять (по языкам, по пакетам).

---

## 16. План тестирования

- Юнит: pfp_decoder (корректное чтение бит); bucketize LoC; H_norm на синтетике; normalize_findings special-cases.
- Интеграция: end-to-end upload → status → result (MVP синхронно на маленьком архиве), затем асинхронно.
- Негативные кейсы: битый ZIP, отсутствуют файлы, неверный контент-тайп, превышение лимита, плохой GZIP, неверный JSON в строке, «слишком длинная строка», коллизия upload_id.

---

## 17. Деплой и конфигурация

- Новые параметры `Settings` (при необходимости):
  - `entropy_max_archive_bytes`, `entropy_max_line_bytes`, `entropy_part_size`, `entropy_storage_dir`.
- Миграции применяются автоматически при старте (если так принято) или вручную — описать в README.
- Проверить CORS (для браузерной интеграции — не требуется для VS Code, но полезно иметь).

---

## 18. Ограничения MVP и дальнейшие шаги

- MVP: синхронный расчёт после парсинга (для небольших архивов). В дальнейшем — вынести compute в фоновые задачи (Celery/Arq/RQ) и обновлять статус.
- MVP: локальное FS-хранилище parsed/aggregates. Дальше — S3/GCS.
- MVP: фиксированные веса `v1.0`. Позже — добавление `v1.1`, экспериментальные веса.

---

## 19. Пример структуры каталогов для одного upload_id

```
/tmp/entropy/<upload_id>/
  parsed/
    manifest.json
    profiles.jsonl
    findings.jsonl
  aggregates/
    global.json          # KLoC, counts
    by_group/
      backend.json
      frontend.json
      ...
```

---

## 20. Карта соответствия требованиям → реализация

- Контент ZIP с 3 файлами — раздел 6.
- GZIP внутри ZIP — раздел 6 (стримингово).
- Идемпотентность через `X-Upload-Id` — раздел 4/9 (уникальность и 409).
- Состояния — раздел 2/6/7/4 (в БД и статус-роут).
- Контракты эндпойнтов — раздел 4.
- Многочастная загрузка — раздел 4.3, таблица `entropy_parts` — раздел 2.4.
- PFP v2.3 — раздел 12.5 + Приложение C.
- Группировки и KLoC — разделы 6/7/12.4/12.9.
- Статистики и формулы — раздел 7 + Приложение B.
- Weights — раздел 8.
- Recompute — раздел 4.7.

---

## 21. Чеклист готовности

- [ ] Миграции применяются, таблицы создаются
- [ ] Роуты видны в `/openapi.json` и `/docs`
- [ ] Upload (маленький архив) даёт `202` и статус прогрессирует
- [ ] Result возвращает CDX/CCI и разложение
- [ ] Weights отдаёт активную версию
- [ ] Recompute работает
- [ ] Тесты зелёные

---

# Приложение A. Полный перечень ENUM-измерений и Q-счётчиков (референс v1.0)

(Сервер — источник истины; список может меняться. Формат pfp2 допускает до 16 ENUM осей (5 бит каждая) и 24 Q-счётчика (3 бита каждая, бакеты 0..6). Значения осей маппятся по `mapping_v23.yaml`.)

A.1 ENUM-оси (16 штук, до 32 значений каждая)

- http_client: none | requests | httpx | aiohttp | urllib3 | curl_cffi | other
- logger: none | logging | structlog | loguru | print_as_log | other
- db_access: none | sqlalchemy-sync | sqlalchemy-async | sqlmodel | peewee | prisma | raw-sql | other
- pydantic_version: none | v1 | v2
- json_lib: none | stdlib.json | ujson | orjson | rapidjson | simplejson | other
- id_type: none | uuid | int | snowflake | ulid | str | mixed | other
- datetime_tz: none | naive | aware_utc | aware_local | mixed
- pagination_style: none | limit_offset | cursor | page_size | keyset | mixed
- typing_policy: unknown | weak | partial | strict | mypy_strict
- concurrency_mode: none | threads | asyncio | trio | mixed
- config_style: none | env | dotenv | pydantic-settings | yaml | toml | ini | mixed
- logging_style: none | plain | structured | otel | mixed
- runtime_target: unknown | py38 | py39 | py310 | py311 | py312+
- error_envelope: none | {"ok":...} | {"success":...} | custom | mixed
- http_framework: none | fastapi | flask | django | starlette | aiohttp | other
- orm_version: none | sa1 | sa2 | sqlmodel | peewee | prisma | other

A.2 Q-счётчики (24 слота, используем минимум)

Общие пороги бакетов: 0, 1, 2–3, 4–7, 8–15, 16–31, 32+.

- imports_total_b (imports_total)
- classes_count_b (classes_count)
- functions_count_b (functions_count)
- async_funcs_count_b (async_funcs_count)
- try_blocks_b (try_blocks)
- except_blocks_b (except_blocks)
- log_calls_b (log_calls_count)
- print_calls_b (print_calls_count)
- http_calls_b (http_call_sites)
- yaml_unsafe_b (yaml_unsafe_count)
- lines_code_b (lines_code) — специальные пороги: 0, 1–99, 100–199, 200–399, 400–799, 800–1599, 1600+
- avg_cyclomatic_b (avg_cyclomatic) — спец. пороги: 0, 1, 2–3, 4–5, 6–7, 8–11, 12+

Примечание: остальные 12 слотов — резерв.

---

# Приложение B. Формулы нормализации (точные)

B.1 Энтропийные оси (Enums и Q)

- Считаем частоты по значениям оси на множестве файлов.
- H = −Σ p_i log2 p_i, где p_i — доля файлов с i-м значением.
- m = число значений с ненулевой частотой.
- H_norm = H / log2(m) (если m <= 1 → H_norm = 0).
- coverage = defined / N_files (defined — количество файлов, в которых ось определена).
- Вклад оси: `w * H_norm * coverage`.

B.2 HPC правила

- Для каждого правила r: `rate_r = files_with_rule_r / N_files`.
- Вклад: `w_hpc[r] * rate_r`.
- Исключения (политики) — активны/неактивны в зависимости от policy-флагов; формула та же.

B.3 Findings

- Базово: `norm_k = count_k / kloc`, где `kloc = max(ε, sum(center(LoC_buckets))/1000)`.
- Спец. случаи:
  - `import_cycle_small`: нормировать на 100 файлов: `count / max(ε, N_files/100)`.
  - `secret_hardcoded`: нормировать на KLoC, затем клипнуть итоговый вклад в [0, 5] перед умножением на вес (или клипнуть сам `norm_k` → up to 5/weight).
- Общая рекомендация: метрики, зависящие от текста/объёма, — `per KLoC`; метрики графовые/структурные — `per 100 files`.

---

# Приложение C. Референс-код (Python/FastAPI) — PFP2 декодер и ядро расчёта

C.1 `services/pfp_decoder.py`

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional
import base64

@dataclass
class PfpHeader:
    schema_id: int
    flags: int
    tier: int

@dataclass
class PfpDecoded:
    header: PfpHeader
    core_planes: List[int]          # 4 x 64-bit ints
    hpc_mask: int                   # 64-bit
    q_buckets: List[int]            # 24 entries, each 0..6
    enums: List[int]                # 16 entries, each 0..31
    simhash64: Optional[int]
    pathhash24: Optional[int]
    crc8: Optional[int]

def _read_bits(buf: bytes, bit_offset: int, bit_len: int) -> int:
    val = 0
    for i in range(bit_len):
        byte_index = (bit_offset + i) // 8
        bit_index  = (bit_offset + i) % 8
        bit = (buf[byte_index] >> bit_index) & 1
        val |= (bit << i)
    return val

def decode_pfp2(pfp2_str: str) -> PfpDecoded:
    assert pfp2_str.startswith("pfp2:"), "bad prefix"
    data = base64.a85decode(pfp2_str[5:].encode("ascii"), adobe=False)
    bit = 0
    header_raw = _read_bits(data, bit, 32); bit += 32
    schema_id = (header_raw >> 20) & 0xFFF
    flags     = (header_raw >> 8)  & 0xFFF
    tier      = header_raw & 0xF
    header = PfpHeader(schema_id=schema_id, flags=flags, tier=tier)
    core_planes = []
    for _ in range(4):
        core_planes.append(_read_bits(data, bit, 64)); bit += 64
    hpc_mask = _read_bits(data, bit, 64); bit += 64
    q_buckets = []
    for i in range(24):
        q_buckets.append(_read_bits(data, bit + i*3, 3))
    bit += 72
    enums = []
    for i in range(16):
        enums.append(_read_bits(data, bit + i*5, 5))
    bit += 80
    simhash64  = _read_bits(data, bit, 64); bit += 64
    pathhash24 = _read_bits(data, bit, 24); bit += 24
    crc8       = _read_bits(data, bit, 8);  bit += 8
    return PfpDecoded(header, core_planes, hpc_mask, q_buckets, enums, simhash64, pathhash24, crc8)
```

C.2 `services/entropy_compute.py` (ядро метрик)

```python
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Tuple
import math
from collections import Counter

@dataclass
class Weights:
    entropy_dimensions: Dict[str, float]
    hpc_rules: Dict[str, float]
    finding_kinds: Dict[str, float]
    normalization: Dict[str, str]

def shannon_H_norm(counts: Dict[str,int]) -> Tuple[float,float]:
    total = sum(counts.values())
    if total <= 0:
        return 0.0, 0.0
    probs = [c/total for c in counts.values() if c>0]
    m = len(probs)
    if m <= 1:
        return 0.0, 0.0
    H = -sum(p*math.log2(p) for p in probs)
    Hn = H / math.log2(m)
    return H, Hn

def coverage(defined: int, total_files: int) -> float:
    return (defined / total_files) if total_files else 0.0

def kloc_est_from_buckets(lines_buckets: List[int]) -> float:
    centers = [0, 50, 150, 300, 600, 1200, 2000]
    return sum(centers[b] for b in lines_buckets) / 1000.0

def normalize_findings(kind: str, count: int, kloc: float, n_files: int) -> float:
    if kind == "import_cycle_small":
        denom = max(n_files/100.0, 1e-9)
        return count / denom
    return count / max(kloc, 1e-9)

def normalize_hpc(rule: str, hits: int, n_files: int) -> float:
    return hits / max(n_files, 1e-9)

def compute_entropy_terms(per_file_enums: Dict[str, Dict[str, str]],
                          per_file_q: Dict[str, Dict[str, int]],
                          weights: Weights,
                          n_files: int) -> Tuple[float, List[Dict]]:
    contribs = []
    total = 0.0
    for dim, w in weights.entropy_dimensions.items():
        if dim.endswith("_b"):
            q_key = dim[:-2]
            values = [str(q.get(q_key)) for q in per_file_q.values() if q_key in q]
            defined = sum(1 for v in values if v is not None)
            counts = Counter(v for v in values if v is not None)
        else:
            values = [enums.get(dim) for enums in per_file_enums.values() if dim in enums]
            defined = sum(1 for v in values if v)
            counts = Counter(v for v in values if v)
        _, Hn = shannon_H_norm(counts)
        cov = coverage(defined, n_files)
        term = w * Hn * cov
        total += term
        contribs.append({"name": dim, "H_norm": Hn, "coverage": cov, "w": w, "contrib": term})
    return total, contribs

def compute_hpc_term(per_file_hpc_hits: List[Dict[str,bool]], weights: Weights, n_files: int) -> Tuple[float, List[Dict]]:
    counts = Counter()
    for d in per_file_hpc_hits:
        for rule, hit in d.items():
            if hit:
                counts[rule] += 1
    contribs = []
    total = 0.0
    for rule, w in weights.hpc_rules.items():
        rate = normalize_hpc(rule, counts.get(rule, 0), n_files)
        term = w * rate
        total += term
        contribs.append({"rule": rule, "rate": rate, "w": w, "contrib": term})
    return total, contribs

def compute_findings_term(findings_by_kind: Dict[str,int], weights: Weights, kloc: float, n_files: int) -> Tuple[float, List[Dict]]:
    contribs = []
    total = 0.0
    for k, w in weights.finding_kinds.items():
        val = normalize_findings(k, findings_by_kind.get(k, 0), kloc, n_files)
        term = w * val
        total += term
        contribs.append({"kind": k, "count": findings_by_kind.get(k, 0), "norm": "per_kloc", "w": w, "contrib": term})
    return total, contribs

def compute_cdx_cci(entropy_term: float, hpc_term: float, findings_term: float) -> Dict[str,float]:
    cdx = entropy_term + hpc_term + findings_term
    cci = max(0.0, 100.0 - cdx)
    return {"CDX": cdx, "CCI": cci}
```

C.3 Пример скелета роутера (фрагменты)

```python
from fastapi import APIRouter, Depends, Header, UploadFile, HTTPException
from ..security.auth import require_auth

router = APIRouter(prefix="/entropy/v1", tags=["entropy"])

@router.post("/upload", status_code=202)
async def upload(file: UploadFile, x_upload_id: str = Header(...), x_repo_id: str | None = Header(None), ctx=Depends(require_auth)):
    # idempotency + enqueue ingestion
    return {"upload_id": x_upload_id, "status": "accepted"}

@router.get("/status/{upload_id}")
async def status(upload_id: str, ctx=Depends(require_auth)):
    return {"upload_id": upload_id, "status": "parsing_profiles"}

@router.get("/result/{upload_id}")
async def result(upload_id: str, ctx=Depends(require_auth)):
    return {"upload_id": upload_id, "scores": {"CDX": 0.0, "CCI": 100.0}}

@router.get("/weights")
async def weights(ctx=Depends(require_auth)):
    return {"version": "v1.0"}

@router.post("/recompute/{upload_id}", status_code=202)
async def recompute(upload_id: str, weights_version: str | None = None, ctx=Depends(require_auth)):
    return {"upload_id": upload_id, "status": "recomputing"}
```

---

# Приложение D. Примеры ошибок (единый формат)

```json
{"error":{"code":"VALIDATION_ERROR","message":"profiles.ndjson.gz missing","details":{"field":"profiles"}}}
```

Другие коды: `UNAUTHORIZED`, `CONFLICT`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE`, `INTERNAL_ERROR`.

---

# Приложение E. Мини OpenAPI выдержка

См. требования в задаче; эндпойнты `/entropy/v1/*` с ответами 200/202/4XX/5XX.

---

# Приложение F. Рекомендации по производству

- Вынести compute в фоновые воркеры (Celery/Arq) при росте объёма.
- Подключить объектное хранилище (S3) для сырья/агрегатов.
- Калибровать веса по эталонным репозиториям.
- Добавить метрики Prometheus по стадиям пайплайна.
