---
id: CHEH-OBSIDIAN-DATAVIEW-INTERFACE-CONTRACT-2026-03-04
title: "Chehovskiy: Obsidian + Dataview Interface Contract (React-side adapter)"
type: interface-contract
status: draft
owner: Chehovskiy Team
created: 2026-03-04
last_updated: 2026-03-04
scope: react-side-adapter-first
related_plan:
  - chehovskiy-react-dataview-engine-plan-2026-03-04.md
---

## Диагноз

Dataview нельзя запускать в React "как есть" без эмуляции Obsidian runtime.
Причина: исходники Dataview напрямую используют `obsidian` API и расширения DOM/JS среды.

Ключевые факты:
1. Импорт и зависимость от `App`, `Vault`, `MetadataCache`, `TFile`, `Component`: [plugin-api.ts:3](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/plugin-api.ts#L3), [data-index/index.ts:9](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-index/index.ts#L9).
2. `dv.view()` читает файлы через `metadataCache/vault` и исполняет через `new Function`: [inline-api.ts:317](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L317), [inline-api.ts:350](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L350).
3. DataviewJS выполняется через `eval`: [inline-api.ts:413](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L413), [js-view.ts:26](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/views/js-view.ts#L26).
4. Индексация зависит от событий `vault` и `metadataCache`: [data-index/index.ts:95](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-index/index.ts#L95).

Вывод: адаптер делаем на стороне React-host (`obsidian-shim`), а Dataview подключаем через совместимый runtime-контракт.

## Гипотеза (SMART)

Если до 2026-03-11 зафиксировать минимальный интерфейсный контракт и тесты `G0`, то:
1. `obsidian-shim` MVP можно реализовать без архитектурных развилок.
2. Риск "бесконечной эмуляции" снизится за счет явного `in/out` scope.
3. Первый bootstrap Dataview в React будет достижим до `G1` без глубокого форка.

## Реализация

### 1) Режимы интеграции Dataview

1. `Library Host Mode` (рекомендуемый для Phase 1):
- инициализируем Dataview API/индекс как библиотеку;
- не эмулируем весь lifecycle Obsidian plugin UI.

2. `Full Plugin Emulation Mode` (Phase 2):
- поддерживаем больше сущностей Obsidian (`Plugin`, `SettingTab`, editor/live-preview);
- выше стоимость и шире surface area.

### 2) Контракт интерфейсов шима (MVP required)

| Объект | Обязательные поля/методы | Где используется | Статус |
|---|---|---|---|
| `App` | `appId?`, `vault`, `metadataCache`, `workspace` | `DataviewApi`, `FullIndex`, UI refresh | MUST |
| `Vault` | `getAbstractFileByPath`, `getMarkdownFiles`, `cachedRead`, `read`, `create`, `modify`, `createFolder`, `on(event, cb)` | IO, индекс, `dv.view`, persistence | MUST |
| `Vault.adapter` | `read(path)`, `write(path, text)`, `getResourcePath(path)` | CSV cache, task rewrite, image links | MUST (`write` MAY in read-only mode) |
| `MetadataCache` | `getFirstLinkpathDest(path, origin)`, `getFileCache(file)`, `on("resolve", cb)`, `trigger(name, ...args)` | link resolution, index events, frontmatter reads | MUST |
| `TAbstractFile` | `path` | base type for path graph | MUST |
| `TFile` | `path`, `stat: {mtime, ctime, size}` | importer, IO checks, `instanceof TFile` | MUST |
| `TFolder` | `path`, `children` | prefix index, folder walk, `instanceof TFolder` | MUST |
| `Component` | `addChild`, `register`, `registerEvent`, `registerInterval`, `load` | lifecycle renderers/index/importer | MUST |
| `MarkdownRenderChild` | наследует `Component`, `containerEl` | list/table/task/js renderers | MUST |
| `MarkdownRenderer` | `render`, `renderMarkdown` | markdown rendering in Dataview views | MUST |

### 3) Workspace/Event контракт (MVP required + optional)

| Объект | Метод/событие | Семантика | Статус |
|---|---|---|---|
| `workspace.on("dataview:refresh-views", cb)` | подписка на refresh | ререндер индекс-зависимых view | MUST |
| `workspace.offref(ref)` | отписка | cleanup hooks | MUST |
| `workspace.trigger(name, ...args)` | публикация событий | refresh и hover события | MUST |
| `workspace.openLinkText(path, source, ...)` | навигация по ссылкам | task/list click behavior | SHOULD |
| `workspace.getUnpinnedLeaf().openFile(file, opts)` | open file action | calendar click | MAY (Phase 1 optional) |
| `workspace.onLayoutReady(cb)` | post-layout bootstrap | plugin mode | MAY |

### 4) DOM/JS compatibility extensions (MVP required)

| Расширение | Требование | Где используется | Статус |
|---|---|---|---|
| `HTMLElement.createEl(tag, opts)` | создание элемента с cls/text/attr | Dataview render/inline APIs | MUST |
| `HTMLElement.createSpan(opts)` | shortcut для span | render helpers | MUST |
| `HTMLElement.appendText(text)` | append text node | render helpers | MUST |
| `HTMLElement.addClasses([...])` | bulk class set | inline renderer | SHOULD |
| `HTMLElement.onNodeInserted(cb)` | callback при mount/show | refreshable renderers | MUST |
| `HTMLElement.isShown()` | видимость контейнера | refresh guard | MUST |
| `String.prototype.contains` | alias для includes | Dataview code paths | MUST (polyfill) |

### 5) Optional interface surface (Phase 2 / out of MVP)

| Символ | Обоснование | Статус |
|---|---|---|
| `Plugin`, `PluginSettingTab`, `Setting`, `MarkdownView`, `WorkspaceLeaf` | нужен для запуска `main.ts` plugin lifecycle как в Obsidian | MAY |
| `debounce` из `obsidian` | используется в plugin settings/refresh | MAY |
| `editorInfoField`, `editorLivePreviewField`, CM6 integrations | live-preview/editor mode | MAY |
| `Platform.isMacOS` | UX-ветка в task click handlers | MAY |

### 6) Интерфейсный скелет (TypeScript)

```ts
export interface EventRef {
  id: string;
}

export class TAbstractFile {
  path: string;
  constructor(path: string) { this.path = path; }
}

export class TFile extends TAbstractFile {
  stat: { mtime: number; ctime: number; size: number };
}

export class TFolder extends TAbstractFile {
  children: Array<TFile | TFolder>;
}

export interface VaultAdapter {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  getResourcePath(path: string): string;
}

export interface Vault {
  adapter: VaultAdapter;
  getAbstractFileByPath(path: string): TAbstractFile | null;
  getMarkdownFiles(): TFile[];
  cachedRead(file: TFile): Promise<string>;
  read(file: TFile): Promise<string>;
  create(path: string, content: string): Promise<TFile>;
  modify(file: TFile, content: string): Promise<void>;
  createFolder(path: string): Promise<void>;
  on(name: string, cb: (...args: any[]) => void): EventRef;
}

export interface MetadataCache {
  getFirstLinkpathDest(path: string, origin?: string): TFile | null;
  getFileCache(file: TFile): any;
  on(name: string, cb: (...args: any[]) => void): EventRef;
  trigger(name: string, ...args: any[]): void;
}

export interface Workspace {
  on(name: string, cb: (...args: any[]) => void): EventRef;
  offref(ref: EventRef): void;
  trigger(name: string, ...args: any[]): void;
  openLinkText?(path: string, sourcePath: string, newLeaf?: boolean, state?: any): void;
}

export interface App {
  appId?: string;
  vault: Vault;
  metadataCache: MetadataCache;
  workspace: Workspace;
}
```

### 7) Контрактные тесты G0

| ID | Проверка | Критерий PASS |
|---|---|---|
| `CT-01` | `instanceof TFile/TFolder` в индексных ветках | Все type-check ветки выполняются корректно |
| `CT-02` | `vault.getMarkdownFiles` + `cachedRead` | `FullIndex.initialize()` проходит без исключений |
| `CT-03` | `metadataCache.getFirstLinkpathDest` | `dv.page` и `dv.view` резолвят path |
| `CT-04` | `dv.io.load` | Чтение markdown/csv совпадает по контенту |
| `CT-05` | `dv.view` custom view | `view.js` исполняется и рендерит output |
| `CT-06` | `workspace` refresh events | Ререндер происходит по `dataview:refresh-views` |
| `CT-07` | DOM extensions | `createEl/createSpan/appendText` работают без падений |
| `CT-08` | `String.contains` polyfill | legacy path checks проходят |
| `CT-09` | `MarkdownRenderer.render/renderMarkdown` | markdown рендеринг доступен в List/Table/Task view |
| `CT-10` | sandbox policy gate | при запрете DataviewJS код не исполняется |

### 8) Go/No-Go для Gate G0

1. `Go`, если:
- все `CT-01..CT-10` описаны и покрывают обязательные интерфейсы;
- `MUST` surface зафиксирован без "TODO unspecified".

2. `No-Go`, если:
- есть хотя бы 1 обязательный интерфейс без сигнатуры и теста;
- scope смешан с feature-логикой конкретного дашборда.

## Критерий успеха

1. Контракт отделяет архитектуру ядра от частных DataviewJS сценариев.
2. Команда может начинать реализацию `obsidian-shim` без уточняющих догадок.
3. Измеримый baseline для `G1/G2` зафиксирован в виде интерфейсов и тестов.

## Риски и контрмеры

| Риск | Влияние | Контрмера | Fallback |
|---|---|---|---|
| Переоценка совместимости и пропуск hidden API | Высокое | contract tests + import inventory diff в CI | Hybrid mode patch list |
| Недостаточная эмуляция DOM extensions | Среднее | явный polyfill package + smoke tests | минимальный source patch Dataview |
| Security риск DataviewJS | Критическое | sandbox + policy flags + timeout/memory limits | precomputed mode |
| Расползание scope на plugin UI | Среднее | жесткий `MVP MUST/MAY` список | defer в Phase 2 |

## Evidence block

| Source | Date | Extracted fact | Decision impact |
|---|---|---|---|
| [plugin-api.ts:3](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/plugin-api.ts#L3) | 2026-03-04 | Dataview API импортирует `App`, `Component`, `TFile` из `obsidian`. | Обязателен `obsidian`-shim на стороне React. |
| [data-index/index.ts:95](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/data-index/index.ts#L95) | 2026-03-04 | Индекс подписывается на `metadataCache`/`vault` события. | Нужен event-compatible runtime. |
| [inline-api.ts:317](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L317) | 2026-03-04 | `dv.view` резолвит путь через `metadataCache` и читает `vault`. | Link + file adapters входят в MUST surface. |
| [inline-api.ts:350](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L350) | 2026-03-04 | `dv.view` исполняет код через `new Function`. | Требуется sandbox policy gate. |
| [inline-api.ts:413](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/api/inline-api.ts#L413) | 2026-03-04 | DataviewJS использует `evalInContext`. | Нужен изолированный JS execution режим. |
| [ui/refreshable-view.ts:25](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/ui/refreshable-view.ts#L25) | 2026-03-04 | Ререндер завязан на `workspace.on(...)` и `onNodeInserted`. | Workspace/event + DOM extensions обязательны. |
| [settings.ts:96](/Users/kirsr/workspace/cheh/external/obsidian-dataview/src/settings.ts#L96) | 2026-03-04 | `enableDataviewJs` по умолчанию `false`. | Security-first policy сохраняется в React runtime. |

## Примечание

Этот контракт описывает ядро совместимости. Reference-сценарии (например, SKU dashboard) используются только как regression-suite для проверки паритета.
