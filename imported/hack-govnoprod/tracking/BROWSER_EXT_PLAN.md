# Браузерное расширение AI Auditor — Полный план (MV3, Multi‑site Overlay)

Дата: 2025-08-18
Область: extensions/apps/browser-ext (+ общие пакеты под extensions/packages/*)

Ссылки на исходные документы и спецификации:
- CHATGPT_OVERLAY_PLAN.md
- CHAT_GPT_OVERLAY.md
- docs/phase-roadmap.md
- docs/curestry_ui_elements.md
- c:\Users\User\Downloads\Telegram Desktop\PLAN_CLIENT_ROADMAP.md
- backend_public/openapi.json (API спецификация)
- Целевые сайты: https://chatgpt.com/, https://claude.ai/, https://grok.com/, https://gemini.google.com/, https://chat.deepseek.com/, https://chat.qwen.ai/, https://www.perplexity.ai/

---

## Статус (сделано)
- [x] Кнопка Analyze рядом с Send на chat.openai.com/chatgpt.com появляется в пределах 2 секунд после загрузки/SPA‑навигации

---

## Мильстоны (исправленная последовательность)

- **M1 — ChatGPT Overlay MVP (без настроек):** кнопка рядом с Send, хоткей Alt+A, оверлей «Результаты аудита», оверлей «Уточнения», онлайн‑по‑умолчанию, базовый обмен данными и сохранение последнего результата.
- **M2 — Мультисайтовые адаптеры (без настроек):** Claude/Grok/Gemini/DeepSeek/Qwen/Perplexity; включение по внутреннему allowlist (без UI).
- **M3 — Режим безопасности и блокировка:** PII‑guard (по умолчанию включён), блокирующий режим по High (по умолчанию выключен); управление пока внутренними флагами.
- **M4 — Устойчивость и офлайн‑фоллбэк:** health‑probe, таймауты/ретраи, прозрачный офлайн при сбоях; Re‑run; полировка оверлея.
- **M5 — Производительность и стабильность:** дебаунсы, отписки, минимизация логов, устранение дублей.
- **M6 — UI настроек (Popup):** мультиселект доменов, offlineOnly, blockOnHighRisk, piiGuardEnabled, apiBase, apiKey.
- **M7 — i18n (RU/EN) и A11y:** локализация строк и доступность.
- **M8 — Инлайн‑патчи и подсветка риска:** подсветка в поле ввода и паттерны качества.

---

## (M1) Manifest и области совпадения (MV3)

Критерии готовности
- [ ] Контент‑скрипт запускается на ChatGPT (базовый домен); остальные домены фильтруются внутренним allowlist до M2/M6
- [ ] MV3 сервис‑воркер `type: module`; иконки подключены; права минимальны (`storage`)

Шаги
- [ ] Базовые `matches`: chatgpt.com (остальные можно сразу добавить, но не монтировать рантайм‑логикой до M2)
- [ ] `background.service_worker`: dist/src/background.js, `type: "module"`
- [ ] `content_scripts[0].js`: dist/src/content.js, `run_at: "document_idle"`
- [ ] Подключить иконки: public/icons/icon16.svg, icon48.svg, icon128.svg
- [ ] В коде: константа `ENABLE_SITES` (allowlist); до M6 контролируется без UI

Файлы: extensions/apps/browser-ext/manifest.json, extensions/apps/browser-ext/public/icons/*

---

## (M1→M2) Адаптеры сайтов (селекторы и привязка)

Критерии готовности
- [x] M1: надёжный адаптер ChatGPT (ввод, Send, anchor)
- [x] M2: адаптеры для Claude/Grok/Gemini/DeepSeek/Qwen/Perplexity реализованы
- [ ] Запись в поле генерирует `InputEvent('input', { bubbles: true })`

Шаги
- [x] Файлы адаптеров:
- [x] `extensions/packages/adapters/src/chatgpt.ts`
- [x] `extensions/packages/adapters/src/claude.ts`
- [x] `extensions/packages/adapters/src/grok.ts`
- [x] `extensions/packages/adapters/src/gemini.ts`
- [x] `extensions/packages/adapters/src/deepseek.ts`
- [x] `extensions/packages/adapters/src/qwen.ts`
- [x] `extensions/packages/adapters/src/perplexity.ts`
- [ ] Интерфейс: `findInput()`, `findSendButton()`, `anchorForButton(send)`
- [ ] Поиск ввода: textarea#prompt‑textarea → textarea → видимый `[contenteditable="true"]`
- [ ] Поиск Send: `button[data-testid="send-button"]` → `button[type="submit"]` → `aria-label*="Send"`/локали (видимые/не disabled)
- [ ] Вставка кнопки: `sendBtn.parentElement ?? sendBtn`

---

## (M1) Контент‑скрипт: инъекция, хоткей, оверлей‑контейнер, SPA‑устойчивость

Критерии готовности
- [ ] Нет дублей кнопки/листенеров после SPA‑перерисовок
- [ ] Alt+A добавляется один раз, срабатывает только при фокусе в поле ввода
- [ ] Контейнер оверлея (без `alert`) с авто‑закрытием (~10с) и удержанием по hover

Шаги
- [ ] Гард: `document.body.dataset.aiAuditorInjected`; проверка `getElementById(IDS.btn)`
- [ ] Debounce 300–500 мс вокруг `mount()`; реинжект только если и нашей кнопки, и Send нет
- [ ] Хоткей Alt+A — один обработчик на окно (флаг `__aiAuditorHotkeyAttached`)
- [ ] Контейнер `__ai_auditor_panel__` (fixed, top‑right); авто‑закрытие; удаление при смене URL; тост на пустой ввод
- [ ] Флаг `OVERLAY_ENABLED` для быстрой деактивации UI

Файл: extensions/apps/browser-ext/src/content.ts

---

## (M1) Online‑by‑default интеграция с нашим бэкендом (OpenAPI)

Критерии готовности
- [ ] По умолчанию анализ через бекенд; `offlineOnly=true` включает локальные детекторы
- [ ] Перед первым запросом — `GET /healthz`; дружелюбные сообщения об ошибках

Шаги
- [ ] Реализовать `OnlineClient` по `backend_public/openapi.json`
- [ ] Методы: `POST /analyze/`, `POST /analyze/apply`, `POST /analyze/clarify`, `GET /analyze/export/{id}.{format}`, `GET /analyze/report/{id}.json`
- [ ] Настройки: `apiBase`, `apiKey` (до M6 — значения по умолчанию/в dev‑конфиге); хранить в `chrome.storage.local`
- [ ] Заголовки метаданных, таймаут/ретраи/отмена; прозрачный офлайн‑фоллбэк (см. M4)

Файлы: extensions/packages/core/src/client.ts, extensions/packages/shared/src/schemas.ts

---

## (M1) UX флоу: Audit → Оверлей результата → Clarify → Оверлей уточнений

Критерии готовности
- [ ] Кнопка `Audit` слева от Send на ChatGPT (и на остальных с M2)
- [ ] Оверлей «Результаты аудита»: сворачиваемое превью промпта, цветные метрики/риски, `Clarify`/`Re‑run`/`Close`
- [ ] Оверлей «Уточнения»: поля Контекст/Цель/Критерии/Ресурсы, `Back`/`Send`/`Apply to input`/`Apply & Send`

Шаги (UI)
- [ ] Кнопка `Audit`: высота 28–32px, отступ 8px, класс `ai‑auditor‑btn`, вставка через `anchorForButton(send)`
- [ ] Оверлей результата (max‑width ~420px): заголовок, превью промпта с «Развернуть», метрики (overall_score, priority, длина и т.п.), риски по severity
- [ ] Кнопки действий: `Clarify`, `Re‑run`, `Close`; опционально `Apply to input`/`Apply & Send`
- [ ] Оверлей уточнений: textarea/input для четырёх полей; `Send` формирует Clarify‑запрос

Шаги (данные)
- [ ] `Audit` → чтение текста (адаптер) → `POST /analyze/` → показать `report/patches/questions`
- [ ] `Clarify` → собрать ответы → `POST /analyze/clarify` с `prompt_id` → обновить результаты
- [ ] `Apply to input` → записать улучшенный текст в поле + `InputEvent`; `Apply & Send` — записать и кликнуть реальный Send (если не заблокировано M3)
- [ ] Сохранять `lastRequest`/`lastResult` в `chrome.storage.local`

---

## (M3) Режим безопасности: PII‑guard (по умолчанию включён)

Критерии готовности
- [ ] Детект и маркировка чувствительной информации; опция маскировки перед онлайн‑отправкой

Шаги
- [ ] Детекторы: e‑mail, телефоны, карты (Luhn), IBAN, адреса, токены (API‑ключи), идентификаторы
- [ ] Конфиг уровней (e‑mail/телефон — High); маски `[redacted-*]`
- [ ] Индикация в оверлее; локальная кнопка «Показать/скрыть маскировку»

Файлы: extensions/packages/core/src/detectors/pii.ts

---

## (M3) Блокирующий режим отправки (High) с Override (по умолчанию выключен)

Критерии готовности
- [ ] Перехват Send/Enter; High‑риски блокируют отправку; модалка Override & Send

Шаги
- [ ] Перехват submit: анализ → решение (блок/разрешить) → модалка; на Override — продолжить отправку
- [ ] Порог по умолчанию: High; локализация в M7

Файл: extensions/apps/browser-ext/src/content.ts (или общий per‑site handler)

---

## (M4) Устойчивость и офлайн‑фоллбэк

Критерии готовности
- [ ] Health‑probe, таймауты/ретраи; при сбое — офлайн‑анализ без ошибок UX
- [ ] Re‑run из оверлея использует `lastRequest`

Шаги
- [ ] Реализовать ретраи/таймауты, управление ошибками в client
- [ ] Фоновый обработчик возвращает `{ ok, result } | { ok: false, error }` всегда

Файлы: extensions/packages/core/src/client.ts, extensions/apps/browser-ext/src/background.ts

---

## (M5) Производительность и стабильность

Критерии готовности
- [ ] Нет thrashing от MutationObserver; нет утечек слушателей

Шаги
- [ ] Debounce/throttle и отписки при навигациях; минимизация шумных логов

---

## (M6) UI настроек (Popup)

Критерии готовности
- [ ] Настройки сразу влияют на поведение без перезагрузки

Шаги
- [ ] Тогглы: `offlineOnly`, `blockOnHighRisk`, `piiGuardEnabled`
- [ ] Мультиселект доменов: chatgpt/claude/grok/gemini/deepseek/qwen/perplexity
- [ ] Поля: `apiBase`, `apiKey`
- [ ] Сохранение/загрузка: `chrome.storage.local`; валидация

Файлы: extensions/apps/browser-ext/public/popup.html, extensions/apps/browser-ext/src/popup.ts

---

## (M7) i18n (RU/EN) и A11y

Критерии готовности
- [ ] Переключение языка без перезагрузки; доступность клавиатурой; корректные ARIA‑роли; контраст

Шаги
- [ ] `packages/i18n/en.json`, `ru.json` + рантайм‑лоадер; обновить строки в оверлее/попапе/модалке
- [ ] Фокусы/outline, `role=alert/status`, доступ закрытия/таймеров с клавиатуры

Файлы: extensions/packages/i18n/*, правки в UI/контент‑скрипте

---

## (M8) Инлайн‑патчи и подсветка риска

Критерии готовности
- [x] Подсветка в поле ввода без поломки нативного поведения сайтов (оверлей поверх ввода)
- [x] Паттерны качества (контекст/цель/критерии/формат/ограничения и PII) определяются локально

Шаги
- [x] Библиотека паттернов (регексы/эвристики) и типы подсветки: `extensions/packages/core/src/patterns/quality.ts`
- [x] Алгоритм подсветки: textarea/contenteditable — через фиксированный overlay, синхронизированный со скроллом/паддингами (без модификации DOM поля)
- [x] Синхронизация с оверлеем; флаг `inlineHintsEnabled` (по умолчанию выключен в `chrome.storage.local.settings.flags.inlineHintsEnabled`)

Файлы: extensions/packages/core/src/patterns/*, extensions/apps/browser-ext/src/content.ts

---

## Риски и смягчение
- Изменения DOM на сайтах → централизованные адаптеры и фоллбэки по общим селекторам
- Дубликаты/мульти‑листенеры → строгие гарды и идемпотентная инициализация
- Сбои API → health‑probe, таймауты/ретраи, офлайн‑деградация
- Производительность → debounce/throttle, отписка наблюдателей
- Безопасность → минимальные permissions, безопасные вставки (без небезопасного `innerHTML`)

---

## Быстрые команды

```bash
# из корня монорепо
pnpm i
pnpm --filter ai-auditor-browser-ext build

# билд всего подмодуля extensions
pnpm -r run build
```
