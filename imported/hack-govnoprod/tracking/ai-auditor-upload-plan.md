# AI Auditor — Upload Raw Features Plan

## Цель

Сделать в расширении команды, которые:

1. находят локальные **профили** и **файндинги** (квантованные/сжатые данные по файлам и наблюдениям),
2. приводят их к стандарту **NDJSON + Gzip** без каких-либо вычислений и агрегаций,
3. упаковывают вместе с манифестом в **ZIP** (`entropy-input-v1.zip`),
4. отправляют архив на бэкенд по HTTP.

> Важно: **никаких метрик/энтропий/весов на клиенте**. Только «как есть» признаки/наблюдения, плюс минимальные технические метаданные.

---

## Команды расширения

- `ai-auditor.upload.rawFeatures` — главная команда «Собрать и отправить сырые признаки».
- `ai-auditor.upload.dryRun` — собрать ZIP локально, **не отправляя**, открыть его в редакторе/проводнике.

---

## Конфигурация (включить в `contributes.configuration`)

```json
{
  "ai-auditor.upload.endpoint":   { "type": "string",  "default": "https://your.api/entropy/v1/upload", "description": "URL бэкенда" },
  "ai-auditor.upload.token":      { "type": "string",  "default": "", "markdownDescription": "Bearer-токен/ключ для аплоада (хранится в SecretStorage)" },

  "ai-auditor.upload.profilesGlobs": { "type": "array", "default": ["**/*profiles*.json*", "**/*profiles*.jsonl*"], "items": { "type": "string" }, "description": "Где искать профили" },
  "ai-auditor.upload.findingsGlobs": { "type": "array", "default": ["**/findings*.json*", "**/findings*.jsonl*"],   "items": { "type": "string" }, "description": "Где искать файндинги" },

  "ai-auditor.upload.maxInputMB": { "type": "number", "default": 200, "description": "Макс. суммарный размер исходников до сжатия" },
  "ai-auditor.upload.useGzip":    { "type": "boolean", "default": true, "description": "Gzip для NDJSON" },
  "ai-auditor.upload.chunked":    { "type": "boolean", "default": false, "description": "Включить многочастный аплоад, если сервер поддерживает" }
}
```

> Токен хранить через `SecretStorage`. В JSON-настройках — только ссылка/алиас.

---

## Формат выходного архива

- Имя файла: `entropy-input-v1.zip`
- Состав:
  1. `profiles.ndjson.gz` — NDJSON-стрим профилей, Gzip.
  2. `findings.ndjson.gz` — NDJSON-стрим файндингов, Gzip.
  3. `manifest.json` — служебный манифест.

### `profiles.ndjson.gz`

- Одна JSON-строка на профиль.
- Обязательные поля: `path`, `sha`, `planes_present`.
- Допускаются блоки `Q`, `ENUMS`, `HPC`, `ID`, `meta` — **как есть** из профайла.
- НЕЛЬЗЯ добавлять агрегаты/метрики.

Пример строки:

```json
{"path":"backend/app/main.py","sha":"sha256:...","planes_present":["Q","ENUMS","HPC","ID"],"Q":{"imports_total_b":3},"ENUMS":{"http_client":"httpx"}}
```

### `findings.ndjson.gz`

- Одна JSON-строка на наблюдение.
- Обязательные поля: `kind`, `scope`, `file` (если применимо).
- Опционально: `line`, `context`, `left`, `right`, `meta`.
- Из каждой записи удалить поля: `weight`, `score`, `cdx`, `cci`, `scd`, `entropy`.

Пример:

```json
{"kind":"blocking_call_in_async","scope":"file","file":"backend/app/user.py","line":342,"context":"requests.get in async def","meta":{"call":"requests.get"}}
```

### `manifest.json`

Должен содержать: версия, client (имя/версия), repo root/commit, counts (lines), generated_at, content_hash.

```json
{
  "version": "1.0",
  "client": { "name": "ai-auditor", "version": "0.1.0" },
  "repo": { "root": "workspace://my-project", "commit": "abc123", "default_grouping": "top-level-folder" },
  "counts": { "profiles_lines": 1789, "findings_lines": 420 },
  "generated_at": "2025-08-27T06:12:00Z",
  "content_hash": "sha256:..."
}
```

---

## Поиск и нормализация исходников

1. По `profilesGlobs` и `findingsGlobs` искать файлы в выбранном workspace-root.
2. Поддерживать форматы:
   - `.json` (JSON-массив) — расплющить в NDJSON.
   - `.jsonl`/`.ndjson` — читать построчно.
3. Стриминговая обработка: парсинг → удалить запрещённые поля (для findings) → записать `JSON.stringify(obj) + '\n'` в gzip-поток.
4. Валидировать JSON-модель (только синтаксис). Плохие строки логировать и пропускать.
5. Считать `profiles_lines` и `findings_lines`.
6. Ограничить суммарный необжатый размер по настройке `ai-auditor.upload.maxInputMB`.

---

## Сетевая спецификация

- Метод: POST на `ai-auditor.upload.endpoint`.
- Заголовки: `Authorization: Bearer <token>` (если есть), `Content-Type: application/zip`, `X-Upload-Id`, `X-Repo-Id`.
- Тело: байты ZIP.
- Успех: 200/202 — распарсить JSON-ответ, показать `upload_id`.
- При ошибке: сохранить ZIP локально и показать путь/инструкции.

Если `chunked=true` — поддержка `/upload/init`, `/upload/part`, `/upload/complete`.

---

## Эрроринг и безопасность

- Не падать на первой плохой строке: логировать в Output channel и пропускать.
- Не логировать секреты.
- Ограничения по размеру для файлов (>50MB — отклонять или предупреждать).
- Исключить чувствительные/очень крупные файлы по имени (например, `repomix-output.xml`).

---

## Сквозной псевдокод и вспомогательные модули

- `toNdjsonGz(files, outPath, stripKeys)` — стриминг JSON/JSONL → NDJSON → gzip.
- `zipFiles(outZip, entries)` — паковать без загрузки всех файлов в память (yazl/archiver).
- `httpUpload(url, zipPath, token)` — отправлять с обработкой retry и rollback (сохранение ZIP).

Зависимости: `stream-json`, `yazl`/`archiver`, `undici`, `uuid`.

---

## Acceptance criteria (приёмка)

- Команда `AI Auditor: Upload Raw Features` должна:
  - находить файлы по настроенным glob-ам;
  - корректно конвертировать `.json` и `.jsonl` в NDJSON;
  - gzip-ить стримы и положить их в ZIP с `manifest.json`;
  - в `findings.ndjson.gz` отсутствуют запрещённые поля;
  - отправлять ZIP на сервер и обрабатывать ошибки (сохранение локальной копии при неуспехе);
  - не логировать токены/секреты.

- Память: для больших файлов потоковая обработка, без OOM.
- Multi-root: выбор активного корня воркспейса корректен.

---

## Тесты (быстрые проверки)

1. Малые фикстуры: проверить ZIP-структуру и содержимое.
2. JSON-массив → NDJSON: проверить подсчёт строк.
3. JSONL с запрещёнными полями → проверить, что поля удалены.
4. Большой файл ≥50MB: no OOM, gzip присутствует.
5. Нет исходников: корректное сообщение пользователю.

---

## Адаптация под структуру репозитория

Следовать правилам монорепо: логика — в `extensions/packages/*`, команды и интеграция — в `extensions/apps/vscode-ext`.

- `packages/io` (новый или существующий) — реализовать `toNdjsonGz`, `zipFiles`, `httpUpload`, `makeTempDir`, `sha256File`.
- `packages/ui` — (опционально) компонент для диалога/прогресса (использовать Output channel и уведомления вместо UI в MVP).
- `apps/vscode-ext/src/commands/uploadRawFeatures.ts` — регистрировать `ai-auditor.upload.rawFeatures` и `ai-auditor.upload.dryRun`.
- `apps/vscode-ext/package.json` — добавить `contributes.commands` и `contributes.configuration`.
- Тесты: `packages/io/__tests__/*`, `apps/vscode-ext/__tests__/*`.

---

## Важные нюансы и рекомендации

- Никогда не формировать метрики/энтропии на клиенте.
- Всегда пользователю показывать прогресс и итоговые счётчики.
- Поддержать `dryRun` для локальной проверки архива.
- Для `manifest.content_hash` — использовать sha256 ZIP; если меняем manifest после архивации, обновлять ZIP или включать хэш отдельным путем (рекомендуется: пересобрать ZIP после написания manifest).
- Логи и Output channel — единый источник для ошибок/предупреждений; UI-звонки минимальны.

---

Создано автоматически. Текущая задача "Create `tracking/ai-auditor-upload-plan.md`" помечена как выполненная.
