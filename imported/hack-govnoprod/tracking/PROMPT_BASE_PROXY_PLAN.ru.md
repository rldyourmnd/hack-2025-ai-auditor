### Интеграция только в backend_proxy: проксирование Prompt Base и поддержка prompt'ов в analyze

Важно: этот план затрагивает исключительно код в `backend_proxy/`. Внутренний сервис `backend/` не изменяем. Публичные контракты `backend_proxy` (пути, схемы, OpenAPI) сохраняются — мы лишь меняем реализацию под капотом, направляя запросы к внутреннему Prompt Base API.

## 1) Цели и KPI
- Проксировать все публичные маршруты Prompt Base 1:1 через `backend_proxy` (контракты без изменений).
- В `POST /analyze/apply` и `POST /analyze/clarify` добавить поддержку ссылочной формы: `prompt_id` и/или `relation_id`.
- Обеспечить единую авторизацию, трейсинг, метрики, ограничение RPS, кэш безопасных GET.

### KPI
- Доля вызовов Prompt Base, проходящих через `backend_proxy`: 100% в проде.
- 95-й перцентиль задержки проксируемых GET ≤ 250 мс (при доступном upstream).
- Ошибки маппятся корректно (>= 99% совпадение кодов/тел).

## 2) Сопоставление: публичные маршруты backend_proxy → внутренний Prompt Base (upstream)

Пути и теги публичного API НЕ меняем. Все изменения — в обработчиках, которые вызывают upstream `{PROMPT_BASE_URL}`.

| Метод | ПУБЛИЧНЫЙ ПУТЬ (backend_proxy, без изменений) | Действие | UPSTREAM (backend, внутренний) |
|---|---|---|---|
| POST | `/api/v1/prompts` | Создать промпт | `POST /prompt-base/add` |
| GET | `/api/v1/prompts/{prompt_id}` | Получить промпт | `GET /prompt-base/prompts/{prompt_id}` |
| GET | `/api/v1/prompts:search` | Поиск (публичный контракт с двоеточием) | `GET /prompt-base/search` |
| POST | `/api/v1/prompts/{prompt_id}/relations` | Создать связь | `POST /prompt-base/relations` (body.from_id=prompt_id) |
| GET | `/api/v1/prompts/{prompt_id}/relations` | Список связей | `GET /prompt-base/prompts/{prompt_id}/relations` |
| DELETE | `/api/v1/prompt-relations/{relation_id}` | Удалить связь | `DELETE /prompt-base/relations/{relation_id}` |

Инвентаризация текущих публичных путей (по `backend_proxy/app/api/routers` и OpenAPI):

- `GET /api/v1/prompts/{prompt_id}` — тег `prompts` (есть).
- `POST /api/v1/prompts` — тег `prompts` (есть).
- `GET /api/v1/prompts:search` — тег `prompts` (есть, двоеточие в пути сохранено по контракту).
- `GET /api/v1/prompts/{prompt_id}/relations` — тег `prompt-relations` (есть).
- `POST /api/v1/prompts/{prompt_id}/relations` — тег `prompt-relations` (есть).
- `DELETE /api/v1/prompt-relations/{relation_id}` — тег `prompt-relations` (есть).
- `POST /api/v1/prompts/{prompt_id}/versions` и `GET /api/v1/prompts/{prompt_id}/versions` — тег `prompt-versions` (есть локально, в Prompt Base может отсутствовать — оставляем локально).

Если в Prompt Base отсутствуют некоторые из этих возможностей, мы не меняем публичные пути — адаптер будет реализовывать их локально либо агрегировать из нескольких upstream-вызовов. Новые совместимые пути `/prompt-base/*` добавим как ОТДЕЛЬНУЮ совместимость (см. раздел 12), не ломая существующий API.

Примечание о теле ошибок: коды статусов upstream сохраняем, но тело ответа маппим в наш унифицированный формат `{error_code, message, details}` согласно политике сервиса. Сетевые/транспортные ошибки маппим в 502, таймауты — в 504 (подробнее — см. раздел 5 и 7).

## 3) Analyze: только изменение реализации, контракты без изменений

Схемы `AnalyzeRequest`, `AnalyzeApplyRequest`, `AnalyzeClarifyRequest` НЕ меняются. Внутри обработчика вместо локального `PromptRepository` используем новый адаптер к Prompt Base. Правила разрешения источника промпта:

- Если пришёл `inline_prompt` — используем его.
- Иначе если пришёл `prompt_id` — через адаптер забираем контент из upstream `GET /prompt-base/prompts/{id}`.
- Если оба — приоритет у `prompt_id`; логируем warning, тело ответа без изменений.
- Если ни того, ни другого — 400 Bad Request (как сейчас).

В `AnalysisRun` (если сохраняем) дополнительно пишем `prompt_id` в `meta` — это внутренняя деталь, на контракт не влияет.

Дополнительно фиксируем источник промпта в `meta.prompt_source` ∈ {`inline`, `by_id`}. При одновременной передаче `prompt_id` и `inline_prompt` — используем `by_id`, логируем предупреждение и сохраняем оба значения в `meta.debug` для аудита (без включения контента промпта).

## 4) Конфигурация (env только для backend_proxy)
- `PROMPT_BASE_URL` — адрес upstream.
- `PROMPT_BASE_TIMEOUT` (по умолчанию 30с).
- `PROMPT_BASE_CACHE_TTL` для GET (0 — выкл).
- `PROMPT_BASE_SERVICE_TOKEN` — опционально, если нужно ходить от имени сервиса.

Дополнительные параметры надежности и производительности:
- `PROMPT_BASE_MAX_RETRIES` — число повторов для ИДЕМПОТЕНТНЫХ методов (GET/HEAD/OPTIONS). По умолчанию 2.
- `PROMPT_BASE_RETRY_BACKOFF_MS` — базовая задержка (джиттер обязателен). По умолчанию 200–800мс с экспонентой.
- `PROMPT_BASE_CIRCUIT_FAIL_THRESHOLD` — количество/доля неудач для открытия «предохранителя». По умолчанию 20 ошибок за 30с.
- `PROMPT_BASE_CIRCUIT_RESET_SEC` — время полуоткрытого состояния. По умолчанию 30с.
- `PROMPT_BASE_CONCURRENCY` — максимальное число одновременных upstream-запросов (семафор/пул httpx). По умолчанию 64.
- `PROMPT_BASE_ALLOWED_HOSTS` — allowlist доменов upstream (безопасность SSRF).
- `PROMPT_BASE_MAX_BODY_BYTES` — лимит размера тела запроса/ответа для проксируемых операций. По умолчанию 1MiB.
- `PROMPT_BASE_COMPAT_ENABLED` — включает совместимые пути `/api/v1/prompt-base/*`.

Заголовки, которые прокидываем к upstream: `Authorization` (из входа, либо сервисный), `traceparent`, `x-request-id`, `Idempotency-Key` (если пришёл от клиента — прокидываем).
Также прокидываем/возвращаем `Retry-After` для 429/503, если он пришёл от upstream или сгенерирован локально лимитером.

## 5) Архитектура реализации в backend_proxy

- Новый адаптер `backend_proxy/app/services/prompt_base_adapter.py` (httpx AsyncClient с пулом соединений, таймауты, ретраи только для идемпотентных методов, трейсинг, кэш для безопасных GET).
- Роутеры остаются теми же (`prompts.py`, `prompt_relations.py` и т.д.), но вместо локального репозитория вызывают адаптер.
- Аналогично, `analyze.py` при `prompt_id` использует адаптер для получения контента.
- Ошибки: сетевые → 502; таймаут → 504; коды статусов от upstream сохраняем, тело маппим в наш формат ошибок `{error_code, message, details}`; заголовок `Retry-After` прокидываем.
- Конкурентность: ограничиваем число одновременных вызовов к upstream семафором (`PROMPT_BASE_CONCURRENCY`) для предотвращения перегрузки.
- Circuit breaker: при превышении порога ошибок — быстрые отказы 503 с `Retry-After`, фоновая полупроверка после `PROMPT_BASE_CIRCUIT_RESET_SEC`.
- Кэширование: только для безопасных GET и только для публичных/неперсонализированных ресурсов. Ключ кэша включает путь+квери и, при необходимости, скоуп авторизации; по умолчанию для авторизованных приватных ресурсов кэш отключён. Добавляем `Vary: Authorization`.

Отдельный совместимый роутер (опционально):
- `api/routers/prompt_base_compat.py` — публичные пути `/prompt-base/*` под тегом `prompt-base-compat`, которые напрямую маппятся на одноимённые upstream пути для клиентов, ожидающих «сырой» контракт Prompt Base. Эти пути ДОБАВЛЯЮТСЯ (не заменяют существующие) и помечены как experimental.
  - Совместимый роутер включается только при `PROMPT_BASE_COMPAT_ENABLED=true` и помечается в OpenAPI как experimental.

## 6) Данные и миграции
Миграций не требуется. Если нужно хранить связку `run ↔ prompt_id`, достаточно писать `prompt_id` в `meta` у `AnalysisRun` (внутреннее поле). База схем публичного API не меняется.

## 7) Метрики и логи
- Счётчики: `proxy_upstream_requests_total{service="prompt_base",method,path,status}`.
- Гистограммы: `proxy_upstream_duration_ms`.
- Логи JSON: `ts, trace_id, method, path, status, duration_ms, upstream_url` (без контента промптов).
  - Редактирование/маскирование: контент промптов и секреты токенов не логируем. Маскируем `Authorization`, `Idempotency-Key`.
  - Корреляция: если нет `x-request-id`, генерируем и возвращаем его клиенту; прокидываем в upstream.

Наблюдаемость/готовность:
- `/healthz` — ливнесс (без внешних зависимостей).
- `/readyz` — рединесс (быстрый ping до upstream с таймаутом и кэшированием результата на 1–5с). Красный `readyz` не ломает ливнесс.

## 8) Вехи и сроки (только backend_proxy)

M1 — Адаптер и конфиг (0.5–1д)
- Создать `services/prompt_base_adapter.py` с методами: `add`, `check`, `list`, `get`, `update`, `delete`, `search`, `create_relation`, `list_relations`, `delete_relation`.
- Таймауты/ретраи/трейсинг; юнит-тесты с моками httpx.
  - Ограничение `CONCURRENCY`, circuit breaker, лимит размера тела, валидация ALLOWED_HOSTS.

M2 — Перевод роутеров на адаптер (1–2д)
- `api/routers/prompts.py`: использовать адаптер (без изменения путей/схем).
- `api/routers/prompt_relations.py`: использовать адаптер и корректный маппинг тел.
- Оставшиеся роутеры, не относящиеся к Prompt Base, не трогаем.

M2.1 — Доп. роутер совместимости (0.5д, опционально)
- Добавить `prompt_base_compat.py` с путями под тегом `prompt-base-compat`:
  - `POST /prompt-base/add`
  - `POST /prompt-base/check`
  - `GET /prompt-base/prompts`
  - `GET /prompt-base/prompts/{prompt_id}`
  - `PUT /prompt-base/prompts/{prompt_id}`
  - `DELETE /prompt-base/prompts/{prompt_id}`
  - `GET /prompt-base/search`
  - `POST /prompt-base/relations`
  - `GET /prompt-base/prompts/{prompt_id}/relations`
  - `DELETE /prompt-base/relations/{relation_id}`
- Включить флагом `PROMPT_BASE_COMPAT_ENABLED=true`.

M3 — Analyze + prompt_id (0.5–1д)
- В `api/routers/analyze.py` заменить чтение промпта через адаптер.
- Логика приоритета `prompt_id` над `inline_prompt` остаётся, контракт — без изменений.
  - Сохранение `meta.prompt_source` и `meta.prompt_id`.

M4 — Метрики/логи/лимиты (0.5д)
- Счётчики/гистограммы для upstream Prompt Base; rate limit на публичные пути `/prompts*` и связанные.
  - 429 с `Retry-After`; лимиты как минимум per-IP и per-token.

M5 — Документация и примеры (0.5д)
- Обновить README и этот план разделом «Как пользоваться», не меняя OpenAPI путей.
  - Отдельно документировать поведение ошибок и ограничения по размеру.

## 9) DoD (критерии приёмки по задачам)

M1 (Адаптер):
- Все методы адаптера возвращают данные/коды, идентичные upstream; покрытие юнит-тестами ≥ 85% модуля.
- Таймауты/ретраи настраиваются через env; заголовки `Authorization`, `traceparent`, `x-request-id` прокидываются.
 - Ретраи — только для идемпотентных методов; circuit breaker корректно открывается/закрывается; соблюдается лимит конкурентности.
 - Ограничения по размеру тела работают (ошибка 413/422 при превышении — согласно нашей политике).

M2 (Роутеры):
- OpenAPI пути и модели `backend_proxy` не изменились; интеграционные тесты подтверждают 1:1 поведение vs старые контракты.
- Ошибки 4xx/5xx от upstream преобразуются без потери кода; тело — в наш формат ошибок; 502/504 при сетевых/таймауте.

M2.1 (Совместимый роутер):
- Появился новый тег `prompt-base-compat`; публичные пути `/api/v1/prompt-base/*` работают и 1:1 транслируют контракты upstream.
- Фича-флаг выключает эти пути полностью при необходимости.

M3 (Analyze):
- Для `prompt_id` `analyze` корректно подтягивает контент через адаптер; для `inline_prompt` поведение без изменений.
- При одновременной передаче `prompt_id` и `inline_prompt` — приоритет `prompt_id`, логируется warning; ответы по контракту.
 - В `meta` корректно сохраняются `prompt_id` и `prompt_source`.

M4 (Наблюдаемость/лимиты):
- Доступны метрики по upstream; ограничение RPS работает и логируется при превышении.
 - `/healthz` зелёный; `/readyz` отражает доступность upstream; OpenAPI проходит валидацию.

M5 (Документация):
- README и план обновлены; добавлены рабочие curl-примеры.

## 10) Риски и меры
- Расхождение контрактов → тесты-контракты и периодический smoke против upstream.
- Латентность → кэш GET, ретраи с джиттером, разумные таймауты.
- Auth несовместимость → сервисный токен и фича-флаг проксирования.
 - Неправильное кэширование приватных ресурсов → по умолчанию кэш отключён при авторизации, `Vary: Authorization`.
 - Перегрузка upstream → ограничение конкурентности + circuit breaker.
 - Путь с двоеточием `/prompts:search` → добавить E2E-тесты маршрутизации и корректной генерации OpenAPI.
 - Идемпотентность POST при сетевых сбоях → не делаем ретраи для небезопасных методов; honor `Idempotency-Key` как есть (проксируем).
 - Утечки чувствительных данных в логах → строгая маскировка заголовков и обрезка тел по лимиту.

## 11) Примеры curl

Добавить промпт (публичный API неизменён):
```bash
curl -X POST "$PROXY/prompts" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"title":"Greeting","content":"Hello, {{name}}!"}'
```

Запустить анализ по prompt_id (контракт без изменений):
```bash
curl -X POST "$PROXY/analyze/apply" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"prompt_id":"pr_123","input_overrides":{"variables":{"name":"Alice"}},"pipeline":{"profile":"default"}}'
```

---

## 12) Детализация задач (WBS) с критериями

1. Создать `services/prompt_base_adapter.py`
   - Реализовать методы (см. M1), общую функцию `_request(method, path, ...)` с ретраями.
   - Критерии: корректный маппинг заголовков; 502/504 на сетевых/таймауте; логирование latency; ограничения размера; circuit breaker; ограничение конкурентности; ALLOWED_HOSTS.

2. Подключить адаптер в `api/routers/prompts.py`
   - `POST /prompts` → `adapter.add(...)`
   - `GET /prompts:search` → `adapter.search(...)` (пагинация/фильтры как есть).
   - `GET/PUT/DELETE /prompts/{id}` → соответствующие вызовы.
   - Критерии: OpenAPI не менялся; тесты: создание, чтение, обновление, удаление, ошибки 404/400.

3. Подключить адаптер в `api/routers/prompt_relations.py`
   - `POST /prompts/{id}/relations` → `adapter.create_relation(from=id, ...)`.
   - `GET /prompts/{id}/relations` → `adapter.list_relations(id)`.
   - `DELETE /prompt-relations/{relation_id}` → `adapter.delete_relation(...)`.
   - Критерии: идентичные статусы/форматы; обработка отсутствующих сущностей.

4. Изменить `api/routers/analyze.py`
   - Заменить чтение из `PromptRepository` на `adapter.get(prompt_id)`.
   - Критерии: ответы `Analyze*Response` не менялись; unit+integration тесты на оба пути (inline и id); сохранение `meta.prompt_source`.

5. Метрики/лимиты
   - Добавить счётчики/гистограммы и rate limiting на публичные пути.
   - Критерии: метрики видны; при превышении лимита — 429 с `Retry-After`; readiness учитывает upstream.

6. Документация
7. Добавить совместимый роутер `prompt_base_compat.py` (опционально)
   - Пути `/prompt-base/add`, `/prompt-base/check`, `/prompt-base/prompts`, `/prompt-base/prompts/{id}`, `/prompt-base/search`, `/prompt-base/relations`, `/prompt-base/prompts/{id}/relations`, `/prompt-base/relations/{relation_id}`.
   - Тег `prompt-base-compat`. Фича-флаг `PROMPT_BASE_COMPAT_ENABLED`.
   - Критерии: контракты и статусы 1:1 с upstream; выключаемость флагом; пометка experimental в OpenAPI.
   - Обновить README и этот план; добавить curl примеры.
   - Критерии: проверка команд по staging.



