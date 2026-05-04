# ROADMAP_FEATURES — 30 фич и приоритизация (только фичи)

Ниже 30 пронумерованных фич. Для каждой: краткое описание, jobs (работы), Effort (оценка), Impact (отдача), Acceptance criteria. В конце — USM и подбор патчей по принципу effort-effect.

> Примечание: бекенд в проекте — на Python (рекомендуется FastAPI + Pydantic v2). Остальные технологии указаны для контекста.

---

Фича 1: Экспорт анализа с метаданными
- Jobs: endpoint `/analyze/export` (FastAPI), сериализатор, UI modal JSON/MD.
- Effort: Низкий (1–3 д)
- Impact: Средний
- Acceptance: экспорт содержит original_prompt, improved_prompt, applied_patches, entropy_score, matched_policies.

Фича 2: Превью патчей и выбор перед Apply (undo)
- Jobs: `/analyze/apply` возвращает атомарные патчи; UI modal с diff и Undo.
- Effort: Низкий (2–4 д)
- Impact: Высокий
- Acceptance: выбор патчей, применение, откат последней операции.

Фича 3: Базовые PII-детекторы (regex) на бэкенде и клиенте
- Jobs: пакет detectors (Python), export rules JSON, client pre-check.
- Effort: Низкий (2–3 д)
- Impact: Высокий
- Acceptance: стандартные шаблоны обнаруживаются на тесткорпусе.

Фича 4: Перехват submit и неблокирующий overlay с рекомендациями
- Jobs: content script intercept, локальный/remote analyze, overlay UI.
- Effort: Низкий (2–3 д)
- Impact: Высокий
- Acceptance: overlay не мешает отправке и позволяет применить улучшения.

Фича 5: Перехват файлов перед загрузкой (txt/pdf/docx/csv)
- Jobs: hook file inputs, extract text (FileReader/pdf.js/mammoth), run detectors.
- Effort: Средний (5–8 д)
- Impact: Высокий
- Acceptance: файлы анализируются и блокируются/редактируются по policy.

Фича 6: OCR для изображений (опционально)
- Jobs: интеграция tesseract.js или серверного OCR; merge results with detectors.
- Effort: Высокий (8–12 д)
- Impact: Средний
- Acceptance: OCR извлекает текст с приемлемой точностью.

Фича 7: Политики (CRUD) и версияция
- Jobs: DB-модель policies, endpoints `/policies`, version/etag.
- Effort: Средний (4–6 д)
- Impact: Высокий
- Acceptance: политики создаются/обновляются, клиенты синхронизируют.

Фича 8: Enforcement режимы (warn/block/auto_redact)
- Jobs: реализовать режимы на client/server, UI per-policy.
- Effort: Средний (3–5 д)
- Impact: Высокий
- Acceptance: режимы корректно влияют на поведение клиента.

Фича 9: Auto-redact для файлов и текста с превью
- Jobs: redact algorithm, preview, save-as.
- Effort: Средний (4–6 д)
- Impact: Высокий
- Acceptance: редактирование удаляет детектируемые PII; пользователь подтверждает.

Фича 10: Audit-логи и экспорт
- Jobs: таблица audit_logs, endpoints, admin UI export.
- Effort: Средний (4–5 д)
- Impact: Высокий
- Acceptance: события логируются и доступны для экспорта.

Фича 11: Синхронизация политик (push/pull)
- Jobs: polling + SSE/WebSocket, signed configs, client verification.
- Effort: Средний (4–6 д)
- Impact: Высокий
- Acceptance: политики доставляются клиентам в срок и валидируются.

Фича 12: Provider-specific guides (OpenAI/Anthropic/Azure)
- Jobs: хранение guides JSON, adapter layer, UI suggestions.
- Effort: Средний (4–6 д)
- Impact: Высокий
- Acceptance: рекомендации видны и приводят к estimated token savings.

Фича 13: Rules-based prompt optimizer
- Jobs: набор правил для удаления fluff и структурирования prompt, endpoint `/optimize`.
- Effort: Средний (5–7 д)
- Impact: Высокий
- Acceptance: уменьшение token_count на тестовом наборе без потери смысла.

Фича 14: Lightweight distil-model для перефразирования (опционально)
- Jobs: deploy small model, fallback rules-based.
- Effort: Высокий (12–20 д)
- Impact: Высокий
- Acceptance: measurable token savings и улучшение quality metrics.

Фича 15: Entropy scoring и бейдж в UI
- Jobs: compute entropy_score, return in `/analyze`, UI badge + warnings.
- Effort: Низкий (2–3 д)
- Impact: Средний
- Acceptance: entropy корректно вычисляется и отображается.

Фича 16: Версии prompt и timeline истории
- Jobs: store versions, per-version metrics, UI timeline.
- Effort: Средний (4–6 д)
- Impact: Средний
- Acceptance: доступна история и diff версий с метрикой.

Фича 17: VS Code — сканирование workspace на PII/entropy
- Jobs: command scan workspace, local analyzer, webview results.
- Effort: Средний (5–7 д)
- Impact: Высокий
- Acceptance: список проблем по workspace и рекомендации.

Фича 18: VS Code — визуализация метрик по авторам (git blame)
- Jobs: map metrics to commits via git, UI breakdown per author.
- Effort: Высокий (8–12 д)
- Impact: Средний
- Acceptance: графики по авторам, клики ведут к offending snippet.

Фича 19: Site-scoped rules (policy per domain)
- Jobs: extend policy model, UI for site-specific rules.
- Effort: Низкий (2–3 д)
- Impact: Средний
- Acceptance: site policies применяются корректно.

Фича 20: Token savings estimator и отчёты
- Jobs: compute token_delta for patches, admin reports.
- Effort: Средний (3–4 д)
- Impact: Высокий
- Acceptance: отчёты показывают оценочную экономию.

Фича 21: Кэширование анализов и rate-limiting
- Jobs: cache results by hash, TTL, rate-limits per-user/org.
- Effort: Средний (3–4 д)
- Impact: Высокий
- Acceptance: кеш работает, лимиты отслеживаются.

Фича 22: E2E тесты расширения (playwright)
- Jobs: tests: highlight→analyze→apply, file intercept, export; CI integration.
- Effort: Средний (4–6 д)
- Impact: Средний
- Acceptance: E2E тесты стабильны и запускаются в CI.

Фича 23: SSO (OIDC/SAML) и ролевая модель
- Jobs: implement OIDC/SAML, map users→roles, admin UI.
- Effort: Высокий (8–10 д)
- Impact: Высокий
- Acceptance: SSO работает, роли применяются.

Фича 24: Редактор шаблонов system messages per-provider
- Jobs: UI editor, preview, deploy templates to clients.
- Effort: Средний (3–5 д)
- Impact: Средний
- Acceptance: админ сохраняет шаблон; клиенты получают обновление.

Фича 25: Responsive UI для мобильных браузеров
- Jobs: adapt popup/webview for mobile, test UA.
- Effort: Низкий (2–3 д)
- Impact: Низкий
- Acceptance: popup корректен на мобильных UA.

Фича 26: ML-классификатор риска (privacy/confidentiality)
- Jobs: collect corpus, train model, endpoint for risk prediction.
- Effort: Очень высокий (12–20 д)
- Impact: Высокий
- Acceptance: model meets precision/recall thresholds on validation.

Фича 27: Policy testing sandbox (для админа)
- Jobs: admin UI to run rules on corpus, show matches and redact preview.
- Effort: Низкий (2–3 д)
- Impact: Средний
- Acceptance: admin can test rules and see real examples.

Фича 28: Сбор фидбека по патчам (upvote/downvote)
- Jobs: UI rating, store feedback, rerank patches.
- Effort: Низкий (1–2 д)
- Impact: Средний
- Acceptance: feedback collected and used for rerank.

Фича 29: Интеграция в CI (pre-merge checks)
- Jobs: CLI/job for PR analysis, PR annotations with links to issues.
- Effort: Средний (5–7 д)
- Impact: Высокий
- Acceptance: PRs annotated with PII/high-entropy warnings.

Фича 30: Блокировка слабых промптов (quality rules)
- Jobs: implement detection rules, UI suggestion workflow or block.
- Effort: Средний (4–6 д)
- Impact: Высокий
- Acceptance: weak prompts detected; user guided to improve before sending.

---

USM (Utility-Score-Model) и подбор патчей
- Effort points: Низкий=1, Средний=3, Высокий=5
- Impact points: Низкий=1, Средний=3, Высокий=5
- Utility = Impact / Effort

Краткая классификация (ориентировочно):
- Very High ROI (Utility>=3): 2,3,4,15,28
- High ROI (2<=Utility<3): 1,5,7,8,10,12,13,20,21,22,29,30
- Medium ROI (1<=Utility<2): 6,9,11,14,16,17,19,24,27
- Low ROI (Utility<1): 18,23,25,26

Patch A (Quick Win): фичи 2,3,4,15,28 — Effort ~10–15 д — быстрый ROI
Patch B (Security & Compliance): фичи 5,7,8,10,21 — Effort ~20–30 д — enterprise value
Patch C (Optimization & Integration): фичи 12,13,17,20,29 — Effort ~25–35 д — долгосрочная экономия

---

Готов сгенерировать эту же таблицу в CSV/MD с точными числовыми значениями (человеко-дни) и сортировкой по Utility. Скажите: записать в `extensions/ROADMAP.md` (перезаписать) или оставить как новый файл `extensions/ROADMAP_FEATURES.md`.
