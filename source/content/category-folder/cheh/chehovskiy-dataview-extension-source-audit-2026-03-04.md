---
id: CHEH-DATAVIEW-EXT-SOURCE-AUDIT-2026-03-04
title: "Chehovskiy: исходниковый аудит Dataview extension для React-движка"
type: source-audit
status: completed
owner: Chehovskiy Team
audit_date: 2026-03-04
scope:
  - local baseline scenario (Chehovskiy_SKU_Research_Dashboard.md + views/chehovskiy_sku_research_dashboard.js)
  - Dataview source repository clone
external_repo:
  url: https://github.com/blacksmithgu/obsidian-dataview
  commit: 5ad0994ff384cbb797de382e7edff2388141b73a
  commit_date: 2025-04-08
---

## Диагноз

Аудит завершен на уровне исходников Dataview (а не только документации) и локального baseline-сценария.

### Findings (ordered by severity)

1. `CRITICAL` — DataviewJS выполняется через `eval/new Function` без полноценного sandbox boundary.
- Подтверждение в коде:
  - `new Function("dv", "input", contents)` в `dv.view()` ([inline-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L350)).
  - `eval` в `evalInContext` ([inline-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L413)).
  - Вызов JS-исполнения для codeblock через `asyncEvalInContext` ([js-view.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/views/js-view.ts#L26)).
  - Inline JS в Live Preview также использует `eval` ([lp-render.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/lp-render.ts#L335), [lp-render.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/lp-render.ts#L347)).
- Импакт:
  - Для web-hosted React-движка прямое исполнение “как в Dataview” недопустимо без изоляции.
  - Без sandbox/allowlist любой доверенный контент может получить доступ к DOM/network-контексту хоста.

2. `HIGH` — Кодовая база Dataview жестко связана с Obsidian runtime; перенос “как есть” в React-хост невозможен.
- Подтверждение:
  - Прямая зависимость от `obsidian` API в core API и index ([plugin-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/plugin-api.ts#L3), [data-index/index.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-index/index.ts#L9)).
  - Чтение файлов через `vault` и резолв через `metadataCache` ([plugin-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/plugin-api.ts#L60), [inline-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L323)).
  - Рендер ссылок/markdown завязан на `MarkdownRenderer` Obsidian ([render.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/render.ts#L1), [render.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/render.ts#L22)).
- Импакт:
  - Нужен отдельный runtime-compat слой `dv.*`, а не “взять Dataview npm и сразу запустить в React”.

3. `HIGH` — Поведение `dv.view()` критично для вашего сценария, но тестов на этот путь в кодовой базе практически нет.
- Подтверждение:
  - Поиск по `src/test` не дал тестов на `dv.view`/custom view execution (`rg` по тестам вернул 0 совпадений).
- Импакт:
  - Высокий риск регрессий при попытке эмулировать поведение 1-в-1 без собственных контрактных тестов.

4. `MEDIUM` — Безопасностная модель DataviewJS изначально “опт-ин”; в React-движке это нужно сохранить как policy gate.
- Подтверждение:
  - `enableDataviewJs: false` по умолчанию ([settings.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/settings.ts#L104)).
  - Отдельные UI-тогглы на JS/inline JS ([main.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/main.ts#L345)).
  - Security note в README: JS-запросы могут изменять файлы и делать network calls ([README.md](/Users/kirsr/workspace/cheh/external/obsidian-dataview/README.md#L136)).
- Импакт:
  - В целевом движке необходимо ввести trust-level режимы исполнения (`off | trusted-only | sandboxed`).

5. `MEDIUM` — Есть документационные и поведенческие ограничения `dv.view()`, которые нужно зафиксировать в контракте.
- Подтверждение:
  - `dv.view` поддерживает `path.js` и `path/view.js` + `view.css` ([code-reference.md](/Users/kirsr/workspace/cheh/external/obsidian-dataview/docs/docs/api/code-reference.md#L115)).
  - Ограничение на dot-prefixed directories (например `.views`) ([code-reference.md](/Users/kirsr/workspace/cheh/external/obsidian-dataview/docs/docs/api/code-reference.md#L138)).
- Импакт:
  - Нужен валидатор путей при ingest + явные ошибки совместимости до этапа execute.

6. `MEDIUM` — Локальный baseline-скрипт теряет кликабельность file links.
- Подтверждение:
  - `fileLinkNode` ожидает `HTMLElement`, но `dv.fileLink` возвращает `Link` объект ([chehovskiy_sku_research_dashboard.js](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js#L91), [inline-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L222), [value.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-model/value.ts#L416)).
- Импакт:
  - В baseline уже есть частичная функциональная деградация в источниках/артефактах (рендерится `span`, а не кликабельная ссылка).

7. `MEDIUM` — Версионная поверхность в репозитории неоднородна (beta/stable маркеры).
- Подтверждение:
  - `manifest.json` содержит `0.5.68` ([manifest.json](/Users/kirsr/workspace/cheh/external/obsidian-dataview/manifest.json#L4)).
  - `package.json` содержит `0.5.70` ([package.json](/Users/kirsr/workspace/cheh/external/obsidian-dataview/package.json#L3)).
  - В changelog есть beta записи для 0.5.69/0.5.70 ([CHANGELOG.md](/Users/kirsr/workspace/cheh/external/obsidian-dataview/CHANGELOG.md#L1)).
- Импакт:
  - Для совместимости нужно зафиксировать целевой baseline-диапазон версий Dataview, иначе поведение может дрейфовать.

### Сильные стороны исходного Dataview (для реиспользования подхода)

1. Ясная API-структура `DataviewApi` / `DataviewInlineApi` / `DataviewIOApi`.
2. Нормализация путей с `originFile` для `dv.io.*` ([plugin-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/plugin-api.ts#L67)).
3. Индексация и фоновые воркеры в `FullIndex`/`FileImporter` (масштабируемый pattern) ([data-index/index.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-index/index.ts#L52), [import-manager.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-import/web-worker/import-manager.ts#L11)).
4. Полезная типизация `Literal`, `Link`, `DataArray` для контрактного слоя.

## Гипотеза (SMART)

Если в течение 3 недель построить compatibility-PoC с sandboxed исполнением и контрактными тестами на baseline SKU dashboard, то к 2026-03-25:
1. Будет достигнут подтвержденный функциональный паритет >= 85% на тестовом сценарии.
2. Критический security-риск выполнения произвольного JS будет закрыт (no direct eval in host page).
3. Ошибки резолва зависимостей (`md/wiki/view/csv/assets`) будут <= 1% на smoke-наборе заметок.

## Реализация

### Что уже сделано в этом аудите

1. Склонирован исходный репозиторий Dataview в `external/obsidian-dataview`.
2. Проведен разбор ключевых модулей API/JS execution/index/render/path resolution.
3. Выполнено сопоставление с локальным baseline сценарием SKU dashboard.
4. Сформирован список блокирующих факторов и обязательных требований для React-движка.

### Что делать дальше (конкретно)

1. Зафиксировать `dv-compat-contract v1`:
- `dv.view`, `dv.io.load`, `dv.fileLink`, `dv.el`, `dv.table`, `dv.list`, `dv.taskList`.

2. Внедрить execution policy:
- `mode=off` (default), `mode=trusted`, `mode=sandboxed`.
- В `sandboxed`: запрет network, запрет прямого DOM API вне адаптера, timeout + memory limits.

3. Сделать link rendering adapter:
- Явная конверсия `Link` -> anchor/wikilink UI.
- Исправить baseline bug в `fileLinkNode` (не ожидать HTMLElement от `dv.fileLink`).

4. Добавить contract regression suite:
- golden snapshot для KPI, интервалов, карточек, таблиц и финальных выводов.
- Отдельные тесты на `dv.view(path)` (`path.js` / `path/view.js` / `.views` error case).

5. Зафиксировать version target:
- Поддерживаемый baseline Dataview API: `0.5.68..0.5.70`.

## Критерий успеха

1. Все `CRITICAL/HIGH` findings имеют внедренные контрмеры и тесты.
2. На тестовом `Chehovskiy_SKU_Research_Dashboard` функциональный паритет >=95%.
3. В hosted runtime отсутствуют прямые `eval/new Function` вне sandbox boundary.
4. Link-резолв и отображение источников полностью кликабельны и проверены e2e.

## Риски и контрмеры

| Риск | Влияние | Контрмера | Fallback | Next check date |
|---|---|---|---|---|
| Неконтролируемое JS-исполнение | Критическое | Изоляция в sandbox worker + policy engine | Полный `mode=off` для JS | 2026-03-11 |
| Неполный API-паритет `dv.*` | Высокое | Contract tests + совместимый shim | `compatibilityMode=hybrid` | 2026-03-18 |
| Расхождение поведения ссылок | Среднее | Отдельный Link adapter и e2e на wiki/file links | Markdown fallback rendering | 2026-03-14 |
| Дрейф версий Dataview | Среднее | Версионный pin + changelog monitoring | Freeze baseline на выбранной версии | 2026-03-12 |
| Ложноположительная уверенность без runtime-валидации в Obsidian | Среднее | Добавить smoke в тестовом vault + Playwright snapshots | Ручной QA чеклист | 2026-03-20 |

## Evidence block

| Source | Date | Extracted fact | Decision impact |
|---|---|---|---|
| [inline-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L350) | 2026-03-04 | `dv.view` исполняет custom view через `new Function`. | Нужен sandbox runtime, нельзя исполнять напрямую в host page. |
| [inline-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L413) | 2026-03-04 | `evalInContext` использует `eval`. | Security gate обязателен для React-движка. |
| [js-view.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/views/js-view.ts#L26) | 2026-03-04 | DataviewJS codeblock рендер идет через async JS eval путь. | Нужен изолированный executor для DataviewJS. |
| [plugin-api.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/plugin-api.ts#L60) | 2026-03-04 | `dv.io.load` читает файлы через `vault` + path normalize. | Требуется собственный IO adapter и path resolver. |
| [data-index/index.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-index/index.ts#L9) | 2026-03-04 | Индекс тесно связан с Obsidian (`Vault`, `MetadataCache`, events). | Dataview core нельзя портировать в React runtime без переархитектуры. |
| [settings.ts](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/settings.ts#L104) | 2026-03-04 | `enableDataviewJs` по умолчанию `false`. | Вводим аналогичный security default в целевом движке. |
| [README.md](/Users/kirsr/workspace/cheh/external/obsidian-dataview/README.md#L136) | 2026-03-04 | Security note: JS queries могут менять файлы и делать network calls. | Trust model и политика допуска скриптов обязательны. |
| [code-reference.md](/Users/kirsr/workspace/cheh/external/obsidian-dataview/docs/docs/api/code-reference.md#L138) | 2026-03-04 | `dv.view()` ограничен для dot-prefixed directories. | Добавить preflight-валидацию путей в ingest. |
| [chehovskiy_sku_research_dashboard.js](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js#L91) | 2026-03-04 | `fileLinkNode` ожидает HTMLElement от `dv.fileLink`. | Исправить рендер file links в baseline/compat renderer. |

## Go/No-Go

1. `GO with constraints`: реализация React-движка возможна, но только через sandboxed compatibility architecture.
2. `NO-GO` для подхода “выполняем DataviewJS как есть в обычном браузерном контексте”.

## Примечание по конфликтам источников

Конфликтов с `catering-landing-tz-v3-direct.md` для данного технического аудита не обнаружено.
