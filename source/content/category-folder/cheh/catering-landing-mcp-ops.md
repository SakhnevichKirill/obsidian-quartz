# MCP Operations Canonical (Marketing Analytics)

Дата обновления: `2026-03-04`.
Назначение: единый технический стандарт MCP-контура для быстрого и чистого анализа маркетинговых стратегий по новым продуктам.

## 1. Канонический стек и статусы

| MCP сервер | Роль в аналитике | Статус | Примечание |
|---|---|---|---|
| `yandex-wordstat` | спрос/сезонность/частотности | `WORKING` | базовый слой рынка |
| `yandex-search` | SERP-срез по запросам | `WORKING` | слой видимости |
| `yandex-webmaster` | индексация/поисковая динамика сайта | `WORKING` | слой SEO-контроля |
| `yandex-metrika` | поведение, конверсии, CPL/CR | `WORKING` | слой экономики |
| `playwright` | QA лендинга и конкурентных страниц | `WORKING` | вспомогательный, без внешних токенов |
| `mcp-obsidian` | локальная операционная база заметок | `WORKING` | инфраструктурный |
| `sequential-thinking` | декомпозиция задач и управляемое reasoning | `WORKING` | оркестрационный слой |
| `fetch` | извлечение и нормализация внешних источников | `WORKING` | оркестрационный слой |
| `serena` | семантическая навигация/правки по проекту | `WORKING` | оркестрационный слой, нужен `activate_project` |
| `yandex-direct-custom` | аукцион/позиции/CPC/доля трафика | `PLANNED` | кастомный MCP, еще не внедрен |
| `keyso-mcp` | конкурентная разведка (organic/context) | `PLANNED` | кастомная обвязка над Keys.so API |
| `spywords-mcp` | конкурентная разведка по Я.Директ/SEO | `PLANNED` | кастомная обвязка над SpyWords API |

Правило: в активном production-контуре держим только `WORKING` + бизнес-критичные `PLANNED` после внедрения.

## 2. Что удалено с машины и исключено из контура

Удалено из глобального конфига Codex (`~/.codex/config.toml`) как нецелевое для текущей стратегии и требующее дополнительных внешних авторизаций/подписок:

- `brave-search`
- `firecrawl`
- `apify`
- `serpapi`

Причина удаления: не входят в базовый Yandex-first контур, увеличивают операционный шум и стоимость поддержки.

Новые добавления в глобальный конфиг Codex (активны с `2026-03-04`):

- `sequential-thinking`
- `fetch`
- `serena`

## 3. Минимально необходимый контур для быстрых решений

Для каждого нового продукта обязательны 2 уровня:

1. `Оркестрационный уровень`: `sequential-thinking` + `serena` + `fetch`.
2. `Данные маркетинга` (3 слоя):
- `Спрос`: `yandex-wordstat`
- `Видимость`: `yandex-search` + `yandex-webmaster`
- `Экономика`: `yandex-metrika`

Расширение до полного performance-контура:

1. `Аукцион`: `yandex-direct-custom` (`PLANNED`)
2. `Конкуренты`: `keyso-mcp` + `spywords-mcp` (`PLANNED`)

## 4. Требования к planned-интеграциям

### 4.1 `yandex-direct-custom` (обязательный next step)

MVP-ручки:

- `get-campaigns`
- `get-keywords`
- `get-auction-forecast`
- `get-search-query-report`
- `get-position-report`
- `get-segment-report`

Минимальный результат на выходе:

- `avg_cpc`, `avg_position`, `top_share`, `cost`, `conversions`, `cpl`
- решение по кластеру: `scale | hold | cut | test`

Статус: `PLANNED` (внедрения пока нет).

### 4.2 `keyso-mcp`

Минимально нужные сценарии:

- dashboard домена
- organic/context keywords
- конкуренты в organic/context
- direct-срезы
- wordstat/serp/monitoring (через API Keys.so)

Статус: `PLANNED` (внедрения пока нет).

### 4.3 `spywords-mcp`

Минимально нужные сценарии:

- `DomainAdv`, `DomainAdvCompetitors`
- `DomainOrganic`, `DomainOrganicCompetitors`
- `FightAdv`, `FightOrganic`
- `DomainOverviewHistory`

Статус: `PLANNED` (внедрения пока нет).

## 5. Единый интерфейс запуска анализа

Входной контракт:

```json
{
  "project_id": "new-product-x",
  "period": { "from": "2026-03-05", "to": "2026-03-31" },
  "region_ids": [973],
  "clusters": [
    { "id": "core", "queries": ["...", "..."] }
  ],
  "targets": {
    "max_cpl_rub": 2200,
    "target_cr_percent": 4.5
  }
}
```

Выходной контракт (decision-ready):

```json
{
  "snapshot_date": "2026-03-31",
  "market_state": [
    {
      "cluster_id": "core",
      "demand_trend_pct": 0,
      "visibility_top3_share_pct": 0,
      "auction_heat": "unknown",
      "economy": { "cpl_rub": 0, "cr_pct": 0 },
      "decision": "test"
    }
  ],
  "actions_next_7_days": [
    { "priority": "P1", "action": "...", "scope": "..." }
  ],
  "alerts": []
}
```

## 6. Операционный цикл (канонический)

1. Планируем шаги и критерии результата через `sequential-thinking`.
2. Активируем проект в `serena` и собираем локальный контекст (структура, текущие артефакты).
3. При дефиците контекста подтягиваем внешние первоисточники через `fetch`.
4. Снимаем `спрос` (`wordstat`) и его динамику.
5. Проверяем `видимость` (`search/webmaster`) по кластерам.
6. Сверяем `экономику` (`metrika`) по лидам и CPL.
7. После внедрения Direct/Keys/SpyWords добавляем аукцион и конкурентное давление.
8. На выходе фиксируем действия на 7 дней, критерий успеха и owner по каждому действию.

## 7. Правила чистоты контура

- Не добавлять новые MCP без явной бизнес-гипотезы и KPI.
- Не хранить токены в проектных markdown-файлах.
- Любой `PLANNED` переводится в `WORKING` только после smoke-теста и примера полезного отчета.
- Раз в месяц ревьюить `codex mcp list` и удалять неиспользуемые серверы.

## 8. Быстрые команды контроля

```bash
codex mcp list
codex mcp get yandex-wordstat
codex mcp get yandex-search
codex mcp get yandex-webmaster
codex mcp get yandex-metrika
codex mcp get playwright
codex mcp get sequential-thinking
codex mcp get fetch
codex mcp get serena
```

Для planned-серверов команда `codex mcp get <name>` должна быть добавлена после внедрения.

## 9. Runbook по новым MCP

### 9.1 `sequential-thinking`

- Использовать для декомпозиции сложных задач на атомарные шаги с критериями завершения.
- На каждом шаге фиксировать: `input`, `output`, `decision`.

### 9.2 `fetch`

- Использовать только для первоисточников (официальные доки, репозитории, API-спеки).
- Для каждого извлеченного факта фиксировать URL и дату запроса.

### 9.3 `serena`

- Перед работой обязательно активировать проект (`activate_project`).
- Для first-run выполнить onboarding и сохранить память проекта.
- Для точечных правок использовать семантический поиск/редактирование вместо грубых глобальных замен.
