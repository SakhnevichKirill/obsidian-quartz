---
id: CHEH-QUARTZ-PERSISTENT-ACCEPTANCE-PLAN-2026-03-04
title: "Chehovskiy: Quartz runtime + персистентные профили/задачи через обратно совместимые markdown-интерфейсы"
type: engineering-plan
status: draft
owner: Chehovskiy Team
created: 2026-03-04
last_updated: 2026-03-04
plan_revision: v4-quartz-persistence
strategy: quartz-runtime-with-md-state-contract
source_of_truth:
  - views/chehovskiy_sku_research_dashboard.js
  - views/lib/sku_acceptance_store.js
  - views/lib/sku_profiles_store.js
  - views/lib/sku_acceptance_model.js
  - external/quartz/quartz/plugins/emitters/contentPage.tsx
  - external/quartz/quartz/plugins/emitters/assets.ts
  - external/quartz/quartz/util/resources.tsx
  - external/quartz-syncer/src/compiler/integrations/dataview.ts
  - external/quartz-syncer/src/compiler/SyncerPageCompiler.ts
---

## Диагноз

### 1) Что уже сделано и является сильной стороной

Текущий SKU dashboard уже содержит mature-контур приемки и персистентности:

1. Двухконтурное сохранение (`localStorage` + markdown frontmatter) реализовано в runtime.
2. Нормализация и валидация статусов централизованы в store-модуле.
3. Есть обязательные бизнес-правила приемки (`done` нельзя при незакрытых рекомендациях; `blocked/skip` требуют комментарий).
4. Профили фильтров и восстановление состояния реализованы как отдельный persistent слой.

Evidence:
1. Параметры файлов/ключей/режима `persistToFile` в dashboard: [views/chehovskiy_sku_research_dashboard.js:5](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:5), [views/chehovskiy_sku_research_dashboard.js:9](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:9), [views/chehovskiy_sku_research_dashboard.js:10](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:10).
2. Загрузка/мердж и сохранение состояния: [views/chehovskiy_sku_research_dashboard.js:880](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:880), [views/chehovskiy_sku_research_dashboard.js:1024](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:1024).
3. Save-flow на карточке SKU: [views/chehovskiy_sku_research_dashboard.js:1680](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:1680).
4. Валидация и правила статусов: [views/lib/sku_acceptance_store.js:297](/Users/kirsr/workspace/cheh/views/lib/sku_acceptance_store.js:297), [views/lib/sku_acceptance_store.js:311](/Users/kirsr/workspace/cheh/views/lib/sku_acceptance_store.js:311).
5. Профили с sanitize/normalize/load/save: [views/lib/sku_profiles_store.js:17](/Users/kirsr/workspace/cheh/views/lib/sku_profiles_store.js:17), [views/lib/sku_profiles_store.js:58](/Users/kirsr/workspace/cheh/views/lib/sku_profiles_store.js:58), [views/lib/sku_profiles_store.js:102](/Users/kirsr/workspace/cheh/views/lib/sku_profiles_store.js:102).

### 2) Ограничения текущего вектора (слабые стороны)

1. Контур записи опирается на Obsidian runtime (`app.vault`, `metadataCache`) и не переносится в браузер Quartz напрямую.
2. Текущий frontmatter-write выполняется полной перезаписью блока; при конкурентных изменениях возможны конфликты.
3. Нет server-side write API и нет optimistic locking для multi-user сценария.

Evidence:
1. Прямое использование `app.vault` в store: [views/lib/sku_acceptance_store.js:104](/Users/kirsr/workspace/cheh/views/lib/sku_acceptance_store.js:104), [views/lib/sku_acceptance_store.js:127](/Users/kirsr/workspace/cheh/views/lib/sku_acceptance_store.js:127).
2. Full frontmatter rewrite: [views/lib/sku_acceptance_store.js:111](/Users/kirsr/workspace/cheh/views/lib/sku_acceptance_store.js:111).

### 3) Что реально покрывает Quartz и чего не покрывает

Quartz покрывает runtime публикации/рендера и расширение UI:

1. HTML-рендер и страницы формируются эмиттером.
2. Нестатические ресурсы JS/CSS подключаются через `StaticResources` и компоненты.
3. Non-md assets копируются в build output автоматически.

Но Quartz не дает встроенную запись markdown из браузера в source repo.

Evidence:
1. Emission в html: [external/quartz/quartz/plugins/emitters/contentPage.tsx:76](/Users/kirsr/workspace/cheh/external/quartz/quartz/plugins/emitters/contentPage.tsx:76).
2. Модель подключения JS/CSS ресурсов: [external/quartz/quartz/util/resources.tsx:5](/Users/kirsr/workspace/cheh/external/quartz/quartz/util/resources.tsx:5), [external/quartz/quartz/util/resources.tsx:64](/Users/kirsr/workspace/cheh/external/quartz/quartz/util/resources.tsx:64).
3. Копирование assets: [external/quartz/quartz/plugins/emitters/assets.ts:28](/Users/kirsr/workspace/cheh/external/quartz/quartz/plugins/emitters/assets.ts:28).

### 4) Что реально покрывает Quartz Syncer

Quartz Syncer ускоряет pipeline публикации из Obsidian, но это не browser-runtime сохранения:

1. Dataview/DataviewJS компилируются в текст при публикации.
2. Pipeline one-way: из Obsidian vault в Quartz repository content.
3. В рантайме Quartz после публикации прямого Dataview API нет.

Evidence:
1. Feature statement: [external/quartz-syncer/README.md:8](/Users/kirsr/workspace/cheh/external/quartz-syncer/README.md:8).
2. One-way disclosure: [external/quartz-syncer/README.md:51](/Users/kirsr/workspace/cheh/external/quartz-syncer/README.md:51).
3. Dataview integration в compiler: [external/quartz-syncer/src/compiler/integrations/dataview.ts:71](/Users/kirsr/workspace/cheh/external/quartz-syncer/src/compiler/integrations/dataview.ts:71).
4. Compile pipeline в markdown output: [external/quartz-syncer/src/compiler/SyncerPageCompiler.ts:139](/Users/kirsr/workspace/cheh/external/quartz-syncer/src/compiler/SyncerPageCompiler.ts:139).

## Гипотеза (SMART)

Если до 2026-04-15 реализовать слой персистентной приемки поверх Quartz через обратно совместимые markdown-контракты и write-back API, то:

1. 100% SKU будут иметь отслеживаемый lifecycle (`todo|in_progress|done|blocked`) с комментированием блокеров.
2. 100% обязательных рекомендаций будут иметь явный state-трекинг (`todo|done|skip|blocked`) с enforce-валидацией.
3. Сохранение/восстановление профилей в Quartz UI будет воспроизводимым без потерь в >=99.5% тестовых циклов.
4. Совместимость схемы с текущими файлами состояния (`views/sku_acceptance_state.md`, `views/sku_dashboard_profiles.md`) сохранится на уровне 100% для чтения и >=99% для записи.

## Реализация

### 1) Целевая архитектура

`Quartz Runtime` + `State API` + `Markdown contract`.

1. Read-path:
- Quartz build читает markdown state/profile файлы.
- Transformer генерирует snapshot JSON для фронта.
- Quartz component рендерит dashboard и прогресс.

2. Write-path:
- UI отправляет mutation в `State API` (не в filesystem браузера).
- API валидирует payload теми же правилами, что текущий store.
- API обновляет markdown frontmatter, фиксирует revision/hash, коммитит изменения в repo.

3. Fallback-path:
- локальный optimistic cache в `localStorage` + retry queue при сетевых ошибках.
- server canonical state имеет приоритет при следующей синхронизации.

### 2) Контракт обратной совместимости

Сохраняем без изменений:

1. Пути по умолчанию:
- `views/sku_acceptance_state.md`
- `views/sku_dashboard_profiles.md`

2. Ключевые поля схемы:
- `schema_version`
- `updated_at`
- `sku_acceptance.<sku_id>.status|owner|summary_comment|recommendations`
- `active_profile`, `profiles.<name>.filters`

3. Бизнес-правила валидации:
- `done` запрещен при `todo|blocked` в обязательных рекомендациях.
- `skip|blocked` требуют непустой комментарий.

4. Семантика статусов и рекомендаций:
- SKU: `todo|in_progress|done|blocked`
- Recommendation: `todo|done|skip|blocked`

### 3) Модули (конкурентные workstreams)

1. `packages/acceptance-contract`
- общий schema + validator + normalizer.
- единый источник правил для UI, API и batch-проверок.

2. `packages/md-frontmatter-codec`
- parse/write frontmatter с deterministic сериализацией.
- patch mode (точечный update) + optimistic locking по `revision`.

3. `quartz/plugins/transformers/acceptanceSnapshot.ts`
- извлекает state/profile markdown в build-time snapshot JSON.

4. `quartz/components/SkuAcceptanceDashboard.tsx`
- интерактивный UI: прогресс, статусы, комментарии, фильтры, профили.
- без привязки к Obsidian API.

5. `apps/acceptance-state-api`
- endpoints: `GET /state`, `POST /state/entry`, `POST /profiles`, `POST /sync`.
- authn/authz, rate limits, audit log, conflict resolution.

6. `apps/acceptance-state-worker` (опционально)
- async commit/push + rebuild trigger Quartz + notification hooks.

### 4) Сценарии эксплуатации

1. QA-приемка:
- выбирает профиль `qa_weekly`;
- закрывает рекомендации по SKU;
- оставляет комментарий для `blocked`;
- переводит SKU в `done` только при pass правил.

2. Фото/контент owner workflow:
- фильтр по `owner`;
- массовый просмотр “blocked without comment”;
- фиксация причин и следующего шага.

3. PM контроль:
- смотрит сводку по разделам, completion ratio, blockers;
- выгружает acceptance snapshot;
- проверяет исполнение рекомендаций по SLA.

4. Release review:
- сверка markdown state vs UI snapshot;
- прогон quality gates;
- фиксация решения Go/No-Go.

### 5) Этапы и гейты разработки

1. `G0 Contract Freeze` (до 2026-03-08)
- зафиксированы схемы и правила валидации.
- Go/No-Go: 100% backward read-compat с текущими state/profile файлами.

2. `G1 Shared Validator` (до 2026-03-12)
- общий валидатор вынесен в пакет и покрыт тестами.
- Go/No-Go: parity с текущими правилами `validateEntry`.

3. `G2 Quartz Read Path` (до 2026-03-17)
- build snapshot + новый Quartz component только на чтение.
- Go/No-Go: визуальный паритет summary/rows с baseline dashboard.

4. `G3 State API Write Path` (до 2026-03-24)
- write-back API + optimistic lock + markdown patch.
- Go/No-Go: 50 циклов `save->reload` без потерь.

5. `G4 Profiles + Filters Persistence` (до 2026-03-29)
- полная поддержка профилей (save/load/delete).
- Go/No-Go: 20 циклов профилей без дрейфа состояния.

6. `G5 Conflict/Security Hardening` (до 2026-04-05)
- конкурирующие сохранения, auth, audit.
- Go/No-Go: все негативные кейсы блокируются корректно.

7. `G6 Production Rollout` (до 2026-04-15)
- feature flag, runbook, rollback, мониторинг.
- Go/No-Go: 7 дней без P1/P2 инцидентов.

### 6) UAT сценарии на естественном языке

1. `TS-QZ-01`
- Я открываю Quartz-страницу с dashboard и вижу текущее состояние по 139 SKU, совпадающее с markdown state.
- Ожидание: числа summary совпадают с расчетом из state-файла.

2. `TS-QZ-02`
- Я меняю статус рекомендации на `blocked` без комментария и жму сохранить.
- Ожидание: API отклоняет запрос, UI показывает понятную причину.

3. `TS-QZ-03`
- Я закрываю все обязательные рекомендации и перевожу SKU в `done`.
- Ожидание: сохранение проходит, SKU исчезает из фильтра `status != done`.

4. `TS-QZ-04`
- Я сохраняю профиль фильтров, перезагружаю страницу и снова выбираю профиль.
- Ожидание: фильтры/сортировка/пагинация восстановлены без дрейфа.

5. `TS-QZ-05`
- Два пользователя одновременно редактируют один SKU.
- Ожидание: второй save получает conflict, UI предлагает refresh и merge.

6. `TS-QZ-06`
- API недоступен, я вношу изменения локально.
- Ожидание: изменения попадают в retry queue и синхронизируются после восстановления API.

### 7) Quality gates (release)

1. `QG-01 Compatibility`
- threshold: 100% чтение текущего markdown-контракта.
- No-Go при любой потере полей.

2. `QG-02 Validation Integrity`
- threshold: 100% pass негативных тестов на запрет invalid transitions.
- No-Go при обходе правил.

3. `QG-03 Persistence Reliability`
- threshold: >=99.5% успешных save/reload циклов в smoke run.
- No-Go при data loss.

4. `QG-04 Concurrency Safety`
- threshold: 100% детекция конфликтов при параллельной записи.
- No-Go при silent overwrite.

5. `QG-05 Security`
- threshold: 0 critical findings (authz, CSRF, injection, commit spoofing).
- No-Go при любом critical.

6. `QG-06 Non-Regression`
- threshold: baseline рендер Quartz и search/navigation без регрессий.
- No-Go при функциональном регрессе core страниц.

7. `QG-07 Performance`
- threshold: p95 интерактивного save-feedback <= 1.5s (без rebuild), p95 initial render <= 2.5s.
- No-Go при превышении.

## Критерий успеха

1. На Quartz-сайте есть рабочий интерактивный контур приемки SKU с персистентными статусами/комментариями/профилями.
2. Состояние хранится в markdown по обратно совместимому контракту с текущими файлами.
3. Save path стабильно работает через API с конфликт-контролем и аудитом.
4. Дашборд показывает прогресс на уровне SKU и рекомендаций без потери исходной логики.

## Риски и контрмеры

1. Риск: конфликтные записи и потеря данных при одновременных save.
- Контрмера: optimistic locking (`revision`), 409 conflict flow, merge UI.
- Fallback: ручной merge через admin tool.
- Next check date: 2026-03-24.

2. Риск: расхождение валидаторов UI и API.
- Контрмера: единый `acceptance-contract` пакет + contract tests.
- Fallback: API truth + UI warning mode.
- Next check date: 2026-03-12.

3. Риск: деградация UX из-за статичности Quartz и rebuild lag.
- Контрмера: optimistic UI + async rebuild + stale indicator.
- Fallback: manual sync button.
- Next check date: 2026-03-29.

4. Риск: security в write-back API.
- Контрмера: scoped tokens, RBAC, audit trail, rate limit.
- Fallback: read-only mode switch.
- Next check date: 2026-04-05.

5. Риск: дрейф схемы frontmatter в будущем.
- Контрмера: schema_version + migration steps + backward readers.
- Fallback: freeze writer to previous schema.
- Next check date: 2026-04-10.

## Rollback path

1. Отключить feature flag write-path (`read-only dashboard`).
2. Вернуть Quartz компонент на read-only snapshot.
3. Откатить API deployment до предыдущей стабильной версии.
4. Восстановить state/profile markdown из git tag `pre-qz-writeback`.

## Evidence block

1. Source: [views/chehovskiy_sku_research_dashboard.js:1024](/Users/kirsr/workspace/cheh/views/chehovskiy_sku_research_dashboard.js:1024)
- Date: 2026-03-04
- Extracted fact: save flow уже разделяет local persistence и file persistence.
- Decision impact: сохраняем dual-mode архитектуру, меняем только backend write transport.

2. Source: [views/lib/sku_acceptance_store.js:297](/Users/kirsr/workspace/cheh/views/lib/sku_acceptance_store.js:297)
- Date: 2026-03-04
- Extracted fact: валидация бизнес-правил уже формализована кодом.
- Decision impact: выносим правила в shared contract package без изменения semantics.

3. Source: [external/quartz/quartz/util/resources.tsx:64](/Users/kirsr/workspace/cheh/external/quartz/quartz/util/resources.tsx:64)
- Date: 2026-03-04
- Extracted fact: Quartz умеет инжектить JS/CSS ресурсы в runtime.
- Decision impact: интерактивный dashboard реализуем как Quartz component/plugin.

4. Source: [external/quartz/quartz/plugins/emitters/contentPage.tsx:76](/Users/kirsr/workspace/cheh/external/quartz/quartz/plugins/emitters/contentPage.tsx:76)
- Date: 2026-03-04
- Extracted fact: Quartz генерирует статические HTML-страницы.
- Decision impact: запись markdown переносим в внешний API слой.

5. Source: [external/quartz-syncer/README.md:51](/Users/kirsr/workspace/cheh/external/quartz-syncer/README.md:51)
- Date: 2026-03-04
- Extracted fact: Quartz Syncer one-way в Quartz repo.
- Decision impact: не используем Syncer как runtime write engine.

6. Source: [external/quartz-syncer/src/compiler/integrations/dataview.ts:131](/Users/kirsr/workspace/cheh/external/quartz-syncer/src/compiler/integrations/dataview.ts:131)
- Date: 2026-03-04
- Extracted fact: Dataview интеграция происходит в compile pipeline Obsidian plugin.
- Decision impact: для Quartz runtime делаем собственный interactive layer поверх markdown snapshot.
