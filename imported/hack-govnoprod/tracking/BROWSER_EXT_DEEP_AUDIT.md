
## AI Auditor — Глубокий аудит расширения для браузера (MV3)

Date: 2025-09-06
Scope: `extensions/apps/browser-ext` (+ соответствующие `extensions/packages/*`)

### Краткое резюме

- UX: мощный inline-оверлей/подсветка уже присутствует; унифицировать настройки между всплывающим окном и страницей опций, добавить аудит через контекстное меню, быстрые исправления и поддержку a11y/i18n.
- Надежность: хорошие debounce и SPA-охранники; добавить централизованное управление наблюдателем, фоновые health-пробы уже есть; улучшить пользовательские сообщения об ошибках.
- Производительность: бандл content-скрипта ограничен; сохранять политику single-chunk для content, избегать общих runtime-импортов.
- Файлы/архивы: политика для zip/7z/rar/tar (магические байты, без распаковки содержимого), шифрованные архивы требуют явного подтверждения; повышение риска по типам вложений.
- Архитектура: хорошее разделение через `packages/*` (детекторы/паттерны/client-sdk). Оставить приложения «тонкими», перенести оставшиеся эвристики анализа в `packages/core`.
- DevEx: добавить тесты для детекторов/паттернов, e2e smoke для адаптеров, CI для сборки и typecheck; унифицировать схему настроек и валидацию (используется `@extensions/shared`).

---

### Текущее состояние (быстрый инвентарь)

- `manifest.json`
  - MV3, `service_worker: dist/src/background.js`, content: `dist/src/content.js`, popup/options находятся в `public/`.
  - `commands.run-audit` назначен на Alt+A.

- Content script `src/content.ts`
  - Вставляет плавающую кнопку Audit рядом с кнопкой отправки на сайте; горячая клавиша Alt+A; стабильный оверлей UI; окно деталей с метриками (quality, entropy, complexity) и патчами/вопросами.
  - Inline-подсказки (подсветка) через оверлей, синхронизированный с textarea/contenteditable (без мутаций самих полей) с использованием `@extensions/core/patterns/quality`.
  - Учитывает SPA (повторная инъекция с debounce); защита от дублирующихся слушателей; сохраняет позицию перетаскиваемой кнопки; перехватывает отправку при блоке-оценке с возможностью обхода через модал.
  - Резервный прямой fetch на backend (`/analyze`) если BG недоступен.

- Background `src/background.ts`
  - Оркестрация анализа: объединяет локальные детекторы (`runLengthDetector`, `runPiiDetector`) с удалённым `ApiClient.analyze` и возвращает объединённый `AnalysisResult`.
  - Обрабатывает clarify (promptId и legacy combinedText как запасной вариант). Сохраняет lastResult/lastRequest.

- Popup `public/popup.html` + `src/popup.ts`
  - UI настроек: режим (mock/remote/openai), базовый URL, API ключ, модель; переключатели: PII guard, block on high, inline hints; allowlist сайтов; проверка состояния backend/OpenAI; событие `SETTINGS_UPDATED`.

- Options `public/options.html` + `src/options.ts`
  - Минимальная страница настроек (mode/baseUrl/apiKey/model) с валидацией схемы в TS; частично дублирует popup.

- Сборка
  - Vite с кастомными Rollup-выходами: content собирается в единый бандл (`src/content.js`), html-ассеты кладутся в корень dist, остальные — под `public/` в dist.
  - TS paths алиасы на `packages/*`.

---

 

### UX и улучшения функционала

Короткосрочные улучшения
- Добавить пункт в контекстное меню: «Audit selection» для анализа выделенного текста на любой странице (хост-перм не нужен, если правило content match покрывает страницу; иначе — требовать on-click с `activeTab` + `scripting`).
- Быстрые исправления в оверлее: применять безопасные патчи (уже частично поддерживается) и «Копировать маскированный prompt».
- Переключатель inline hints и включение по сайту уже есть; сделать их видимыми в popup; по умолчанию — ChatGPT.
- Менеджер паттернов в контекстном меню: подпункты «PII patterns» с включением/выключением категорий и «Custom regex…» для быстрого перехода к редактору пользовательских регексов.

Среднесрочно
- A11y: обеспечить доступность кнопок с клавиатуры, `role`/`aria-*` для панелей/модалей, фокус-трэп в модалях, закрытие по Escape.
- i18n: вынести строки в `packages/i18n/{en,ru}.json`, загружать в content/popup и переключать динамически.
- Онбординг: walkthrough при первом открытии popup с одноразовым флагом.

Долгосрочно
- История в popup (последние N аудитов) с экспортом в JSON/CSV. Хранить только локально; уважать приватность.
- UI поддержки адаптеров по сайтам: показывать селекторы по сайту в расширенных настройках для продвинутых пользователей.

---

### Надёжность и производительность

- Наблюдатели: оставлять один верхнеуровневый `MutationObserver` с дебаунсом при монтировании (уже есть). Добавить явный disconnect при выгрузке страницы и между сменами маршрутов SPA (есть). Проверить удаление слушателей во всех путях выполнения.
- Дебаунс анализа ввода для inline-подсветки (реализовано через event-triggered обновления). Рассмотреть throttle для очень больших prompt-ов, чтобы избежать трешинга layout.
- Фоновые health-пробы: реализованы в `ApiClient.healthCheck()`. Добавить экспоненциальный бэк-офф с джиттером при недоступности сервиса; показывать «offline (local only)» в статусной строке popup.
- Таймауты/повторы: присутствуют в `ApiClient.analyze`. Логировать только в `debug` при включённом флаге `DEBUG`; по умолчанию — молчать.

### Обработка файлов, архивов и «скрытых» вложений

- Быстрое определение формата по магическим байтам (zip, 7z, rar, tar) без доверия к `name/type`.
- Шифрованные архивы (zip AES/has password) помечать как medium/high риск и требовать явного подтверждения; не пытаться расшифровывать в браузере.
- Для обычного zip: не распаковывать содержимое; только список имён. Если обнаружены текстовые/табличные типы (txt, md, csv, tsv, xlsx, docx, json) — повышать риск до medium.
- Тайм-ауты на чтение/сканирование: 5–10 секунд на файл; отображать прогресс и давать отмену.

Критерии приёмки:
- Детектор магических байтов корректно распознаёт zip/7z/rar/tar на наборе ≥ 20 файлов (100% точность по заголовкам).
- Шифрованные zip определяются без чтения содержимого; показ подтверждения; при отказе — отправка блокируется.
- Для обычного zip отображается список имён; содержимое не читается/не сохраняется; если есть текстовые/табличные типы — риск повышается до medium.
- В логах нет содержимого; только счётчики/типы/тайминги. Тайм-ауты корректно прерывают операции.

---

### Региональные детекторы (RU/KZ) — эвристики

- KZ IBAN: `KZ\d{20}` → severity: medium.
- Паспорт РФ: `\b\d{2}\s?\d{2}\s?\d{6}\b` → severity: medium.
- СНИЛС: `\b\d{3}-\d{3}-\d{3}\s?\d{2}\b` (+ опциональная проверка контрольной суммы) → severity: medium.
- ИНН: `\b\d{10}(\b|\D)|\b\d{12}(\b|\D)` → severity: medium.
- Секреты/JWT/ключи: `eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}`; `AKIA[0-9A-Z]{16}`; `-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----` → severity: high.

Критерии приёмки:
- Юнит-тесты на позитивные/негативные примеры; порог ложноположительных ≤ 2% на подготовленном корпусе.
- Severity агрегируется корректно; для секретов — всегда high.

---

 

### Выравнивание архитектуры (mono-repo extensions)

- Держать аналитику/детекторы в `packages/core` (OK). Если в content останутся PII-регексы, переместить их в `packages/core/detectors/piiDetector.ts` и вызывать из BG/content через общий API.
- Shared UI: сложные переиспользуемые оверлеи оставлять в приложении (content script не должен использовать React). React-UI хранить в `packages/ui` для popup/webview.
- Контракты сообщений в `packages/messaging` (OK). Продолжать использовать константы, чтобы не увеличивать размер content-чанка.

---

### Тестирование и CI

- Unit tests (Jest/TS) в `packages/core`:
  - `detectors/piiDetector.spec.ts` — email/телефоны/API-ключи/CC (Luhn)/IBAN; допустимый уровень ложноположительных.
  - `patterns/quality.spec.ts` — спаны совпадений, отображение уровня риска, кейсы с unicode.
- Integration smoke для адаптеров (jsdom): findInput/findSendButton для mock DOM-скриншотов для каждого сайта.
- E2E smoke (Playwright) для ChatGPT-адаптера: кнопка инжектится, Alt+A открывает панель, блокировка при высоком риске работает.
- CI workflow (GitHub Actions): `pnpm -r run build`, `pnpm -r run test`, `tsc -b`.

Дополнительно (E2E, минимальный набор):
- Путь загрузки: attach/drop/paste — все сценарии работают одинаково (оверлей, блокировка, отмена, повторы).
- Архивы: обычный zip (список имён, повышение риска по типам), шифрованный zip (требуется подтверждение), rar/7z/tar — корректный детект и политика без распаковки.
- PDF и «большой файл» (≥ 50 МБ): индикатор прогресса/тайм-аут/отмена; вкладка не зависает.
- SPA-перендер: отсутствуют дубли слушателей/оверлеев.
- Браузеры: Chrome и Edge (Chromium) проходят стабильно.
 - Паттерны: переключение чекбоксов в контекстном меню мгновенно влияет на анализ; custom regex добавляется/удаляется/редактируется и сохраняется между сессиями; валидация регексов ловит неверные паттерны без падений.

---

### Конкретные изменения (действия)

1) Унификация popup/настроек
- Сделать popup единственным источником правды для настроек; оставить `options.html` минимальной или перенаправлять в popup.
- Обеспечить паритет `SettingsSchema` между popup и options; они уже используют `@extensions/shared` — расширить на `flags.enabledSites`, `flags.enableInlineHints`, `blockOnHighRisk`, `piiGuardEnabled`.

Критерии приёмки:
- `options.html` и popup используют одну схему; изменения отражаются в контенте без перезагрузки.
- Флаги inline hints/site-allowlist/`blockOnHighRisk` работают и сохраняются.

2) Контекстное меню
- Добавить право `contextMenus` и обработчик в BG: создать пункт при установке, при клике — захватить выделение (через `chrome.scripting.executeScript`) и отправить на анализ в BG → показать оверлей в контенте для поддерживаемых сайтов или уведомление/резюме в popup.

Расширение: «PII patterns» подпункты
- Создать подменю `PII patterns` с чекбоксами по категориям: Email, Phones, RU Passport, SNILS, INN, KZ IBAN, JWT/Secrets, IBAN/CC (Luhn), и т.д.
- При клике на чекбокс — обновлять `Settings.detectors.enabledCategories` и пересоздавать подменю для отражения текущего состояния.
- Добавить элемент `Custom regex…` → открывает popup с вкладкой «Patterns», где можно добавлять/удалять пользовательские регексы, названия и severity.

Критерии приёмки:
- Пункт «Audit selection» виден при выделении.
- Текст корректно извлекается и анализируется; в unsupported-кейсах — уведомление.
- Подменю `PII patterns` отражает текущее состояние включённых категорий; переключения мгновенно влияют на анализ без перезагрузки.
- Переход «Custom regex…» открывает редактор; добавленные шаблоны сохраняются и участвуют в анализе.

3) A11y/i18n
- Оверлеи: добавить `role="dialog"`, `aria-modal`, фокус-трэп, закрытие по `Esc`, правильный порядок табуляции, видимый фокус.
- Перенести строки в `packages/i18n`; добавить утилиту загрузки и подключить к popup/content.

Критерии приёмки:
- Полная навигация клавиатурой; `Esc` закрывает модал; фокус-трэп работает.
- Переключение RU/EN обновляет строки без перезагрузки.

4) История/экспорт
- Хранить последние N результатов в `chrome.storage.local.history` с таймстампом и сайтом. Вкладка «History» в popup показывает записи; поддержать экспорт.

Критерии приёмки:
- LRU-ограничение N; экспорт JSON/CSV корректен; нет хранения сырых файлов.

5) Тесты и CI
- Добавить unit-тесты core, integration-тесты адаптеров, базовый Playwright smoke. Установить порог покрытия (core ≥90%).

Критерии приёмки:
- Покрытие core ≥ 90%, прочее ≥ 80%; CI зелёный.

6) Политика по архивам/вложениям
- Детектировать zip/7z/rar/tar по магическим байтам, определять шифрование zip; не распаковывать содержимое без явного подтверждения.

Критерии приёмки:
- Обычный zip → список имён, повышение риска по типам; шифрованный zip → запрос подтверждения и блокировка при отказе.

7) Региональные детекторы RU/KZ
- Маски/регексы и severity: KZ IBAN `KZ\\d{20}` (medium); RU паспорт `\\b\\d{2}\\s?\\d{2}\\s?\\d{6}\\b` (medium); СНИЛС `\\b\\d{3}-\\d{3}-\\d{3}\\s?\\d{2}\\b` (+ контрольная сумма опц., medium); ИНН `\\b\\d{10}(\\b|\\D)|\\b\\d{12}(\\b|\\D)` (medium); JWT/ключи `eyJ[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}\\.[a-zA-Z0-9_-]{10,}`, `AKIA[0-9A-Z]{16}`, `-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----` (high).

Критерии приёмки:
- Юнит-тесты на позитив/негатив; ложноположительные ≤ 2% на тест-наборе; severity агрегируется корректно.
 - Категории связываются с чекбоксами в контекстном меню; их выключение/включение корректно влияет на общий счёт риска.

8) E2E (минимальный набор)
- Playwright/Chromium: attach/drop/paste; zip/pdf/большой файл; отмена/повтор; SPA-перендер.

Критерии приёмки:
- Зелёные тесты на Chrome/Edge; флейки ≤ 2%.

---

### Илллюстративные фрагменты кода

Контекстное меню (background.ts):
```ts
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'audit-selection', title: 'Audit selection', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'pii-root', title: 'PII patterns', contexts: ['action'] });
  const categories = ['Email','Phones','RU Passport','SNILS','INN','KZ IBAN','JWT/Secrets','IBAN/CC'];
  for (const cat of categories) {
    chrome.contextMenus.create({ id: `pii-${cat}`, parentId: 'pii-root', title: cat, type: 'checkbox', checked: true, contexts: ['action'] });
  }
  chrome.contextMenus.create({ id: 'pii-custom', parentId: 'pii-root', title: 'Custom regex…', contexts: ['action'] });
});
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'audit-selection' || !tab?.id) return;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => (window.getSelection?.()?.toString() || '')
  });
  const text = String(result || '').trim();
  if (!text) return;
  const req = { text, source: 'context', url: tab.url || '', ts: Date.now() } as const;
  const analyzed = await client.analyze(req);
  // Вариант A: открыть оверлей через message в контент
  // Вариант B: показать простое уведомление/резюме в popup
  chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_PROMPT', payload: req });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (typeof info.menuItemId === 'string' && info.menuItemId.startsWith('pii-')) {
    if (info.menuItemId === 'pii-custom') {
      chrome.runtime.openOptionsPage?.();
      return;
    }
    const cat = info.menuItemId.replace('pii-','');
    const current = await Settings.get();
    const enabled = new Set(current.detectors?.enabledCategories ?? []);
    if ((info as any).checked) enabled.add(cat); else enabled.delete(cat);
    await Settings.set({ ...current, detectors: { ...current.detectors, enabledCategories: Array.from(enabled) } });
    await rebuildContextMenuFromSettings();
  }
});
```

A11y (content.ts):
```ts
panel.setAttribute('role', 'dialog');
panel.setAttribute('aria-modal', 'true');
const focusable = panel.querySelector('button, [href], input, select, textarea, [tabindex]');
(focusable as HTMLElement)?.focus();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') panel.remove(); }, { once: true });
```

Схема настроек (shared/settings.ts):
```ts
export type DetectorCategory = 'Email'|'Phones'|'RU Passport'|'SNILS'|'INN'|'KZ IBAN'|'JWT/Secrets'|'IBAN/CC';
export interface CustomRegex {
  id: string;
  name: string;
  pattern: string; // JS regex source
  flags?: string;  // e.g. 'i'
  severity: 'low'|'medium'|'high';
}
export interface Settings {
  detectors: {
    enabledCategories: DetectorCategory[];
    custom: CustomRegex[];
  };
}
```

---

### Риски и меры смягчения

- Изменения DOM сайтов: поддерживать адаптеры по сайту, запасные селекторы, быстрые хотфиксы через настраиваемые селекторы в storage (advanced).
 
- Производительность при очень больших prompt-ах: throttle обновлений подсветки; лимитировать количество спанов.
- Фоновая недоступность: уже есть fallback; показывать явный баннер offline в popup.

Мелкие, но важные штрихи — критерии:
- Перехватывать `dragenter/dragover` с `preventDefault()` на сайтах, перенаправляющих вкладку при дропе — проверено на тестовой витрине.
- Модалка в Shadow DOM всегда поверх: высокий `z-index`, `position: fixed`, порт на `document.documentElement` — визуальный тест проходит.
- Вторичные «approved» события помечены флагом; проверяем `event.isTrusted`; где невозможно — используем прямую установку `input.files`.
- Тайм-ауты чтения (5–10 секунд) применяются; по истечении — пользователь видит понятное сообщение и кнопку повтора.

---

### Приоритетная дорожная карта (фичи и UX)

P0 (Must-be):
- Политика по архивам/шифрованию (подтверждение, без распаковки содержимого)
- Базовые RU/KZ детекторы (маски и severity)
- Минимальный E2E (attach/drop/paste, архивы, большие файлы, SPA)

P1 (Performance/Linear):
- Контекстное меню + быстрые исправления
- Унификация popup/настроек + live-флаги (inline hints/sites/block)
- Worker-скан больших файлов; офлайн-индикатор в popup
 - Менеджер паттернов (контекстное меню + редактор custom regex в popup)

P2 (Delighters):
- История/экспорт
- Глубокие парсеры (pdf.js/docx/xlsx) за фича-флагом
- OCR (Tesseract WASM) офлайн, фича-флаг
- Расширенный UX (категории, темы, совместимость-доки)

---

### Критерии приёмки по milestone

- Сборка проходит (`pnpm --filter ai-auditor-browser-ext build`), без ошибок типов.
- MV3 валидация в Chrome DevTools OK (нет runtime-ошибок в service worker).
- Alt+A работает только при фокусе в поле ввода; кнопка не дублируется при смене маршрутов SPA.
 
- Переключатель inline hints сразу отражается на страницах контента.
- E2E smoke: оверлей рендерится; модал блокировки появляется при влитом высоком риске.

---

### Примечания, специфичные для этого репозитория

- Держать content script в одном бандле; избегать импорта общих модулей, создающих дополнительные чанки. Текущая Vite-конфигурация это обеспечивает — сохранить.
- Не переносить React в content-оверлей; оставлять DOM-only, чтобы избежать веса бандла и конфликтов с CSS сайтов.
- Централизовать строки в `packages/i18n`; подключать через лёгкие loader-функции, чтобы оставаться tree-shakeable.


