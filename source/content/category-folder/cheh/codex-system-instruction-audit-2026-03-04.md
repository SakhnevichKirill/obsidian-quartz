# Codex System Instruction Audit

Дата: `2026-03-04`  
Аудитор: `Codex`  
Объект аудита: `~/.codex/AGENTS.md` (global), проектный `AGENTS.md`

## 1. Executive Summary

Текущая системная инструкция функциональна как черновой каркас, но не дотягивает до production-уровня мультиагентной оркестрации. Главные риски: неверная модель приоритетов, смешение глобальных и доменных правил, недостаточные execution/verification gates.

## 2. Best Practices (Codex + Cloud + рынок)

1. Строить инструкции иерархически: global в `~/.codex/AGENTS.md`, проектные правила в локальном `AGENTS.md`.
2. Делать правила операционными: явные `when/then`, DoD, проверка, rollback.
3. Включать multi-agent только по триггерам (независимые подзадачи, batch, SLA), а не по умолчанию.
4. Для long-horizon cloud задач вести план-артефакт (`PLANS.md`) с checkpoint-циклами.
5. Отдельно задавать tool-governance: allow/prompt/deny, trusted prefixes, ограничения на сетевой доступ.
6. Для internet/cloud использовать least privilege: deny by default + allowlist.
7. Для prompt engineering фиксировать objective, constraints, output schema, examples.
8. Обязательно вести traceability: evidence + source + date на каждый факт.

## 3. Findings (приоритет)

### Critical

1. Неверно сформулирован приоритет инструкций.
- В файле `~/.codex/AGENTS.md` локальные AGENTS поставлены выше системных.
- Риск: конфликт с реальной иерархией инструкций Codex и непредсказуемое поведение.

2. Глобальный слой перегружен доменной спецификой.
- В global AGENTS включены конкретные Yandex-инструменты и процесс проекта.
- Риск: деградация качества на нерелевантных проектах.

3. Конфликтующая копия global AGENTS вне `~/.codex`.
- Одновременно существует `/Users/kirsr/AGENTS.md`.
- Риск: неоднозначность scope и затрудненная диагностика.

### High

1. Нет формальных триггеров для включения multi-agent.
- Риск: лишняя сложность, рост стоимости и нестабильность исполнения.

2. Нет обязательного verification gate / Definition of Done.
- Риск: шаги считаются завершенными без объективной проверки.

3. Нет cloud/network policy на уровне системной инструкции.
- Риск: переиспользование инструментов без principle of least privilege.

### Medium

1. Handoff-контракт неполный.
- Не хватает `owner`, `eta`, `validation`, `rollback_plan`, `confidence`.

2. Нет жизненного цикла самой инструкции.
- Не зафиксированы `version`, `review cadence`, `change log`, `owner`.

3. Fallback-политика слишком общая.
- Нет таблицы `tool unavailable -> specific fallback -> quality impact`.

## 4. Рекомендуемая целевая архитектура

1. `Global AGENTS` (`~/.codex/AGENTS.md`):
- Только универсальные правила оркестрации, безопасности, quality-gates.
- Без доменных стеков конкретного проекта.

2. `Project AGENTS` (`<repo>/AGENTS.md`):
- Доменные инструменты, KPI, ограничения, формат артефактов.

3. `Plan Artifact` (`PLANS.md` на длинных задачах):
- Четкие этапы, критерии выхода, checkpoints, риск-лог.

## 5. Прицельный remediation plan

1. Исправить секцию приоритетов в global AGENTS.
2. Вынести проектную доменную специфику из global в локальные AGENTS.
3. Оставить один global-файл в `~/.codex/AGENTS.md`; лишнюю копию архивировать.
4. Добавить multi-agent trigger criteria + DoD + verification + rollback.
5. Добавить отдельный блок cloud/network policy.
6. Добавить governance-индикаторы: `version`, `owner`, `last_reviewed`, `next_review`.

## 6. Acceptance Criteria после исправлений

1. Любая новая сессия Codex предсказуемо применяет global + project правила без конфликтов.
2. Multi-agent запускается только при соблюдении формальных триггеров.
3. Каждый шаг имеет evidence и проверяемый результат.
4. Сетевой доступ и инструменты работают по documented least-privilege политике.
5. Инструкция имеет прозрачный жизненный цикл обновлений.

## 7. Sources

1. OpenAI Codex Prompting Guide: https://cookbook.openai.com/examples/gpt-5-codex_prompting_guide
2. OpenAI Codex Security Rules: https://developers.openai.com/codex/security/rules
3. OpenAI Codex Multi-agents: https://developers.openai.com/codex/concepts/multi-agent
4. OpenAI Codex Cloud Environments: https://developers.openai.com/codex/cloud/environments
5. OpenAI Codex Internet Access: https://developers.openai.com/codex/cloud/internet-access
6. OpenAI Cookbook (PLANS.md): https://cookbook.openai.com/articles/codex_exec_plans
7. Anthropic System Prompts: https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/system-prompts
8. Anthropic Tool Engineering: https://www.anthropic.com/engineering/writing-tools-for-agents
9. LangChain Multi-agent: https://docs.langchain.com/oss/python/langchain/multi-agent
10. LangGraph Multi-agent: https://docs.langchain.com/oss/python/langgraph/multi-agent

## 8. План отработки рисков (Execution Plan)

### Этап P0. Baseline и freeze

Цель: зафиксировать текущую конфигурацию и исключить дрейф во время remediation.

Действия:
1. Снять snapshot `~/.codex/AGENTS.md`, проектного `AGENTS.md`, `~/.codex/config.toml`.
2. Зафиксировать список активных MCP и рабочие директории.
3. Заморозить изменения инструкций вне данного плана до прохождения Gate G4.

Результат:
- baseline-пакет артефактов для сравнения до/после.

### Этап P1. Исправление критических рисков

Цель: устранить архитектурные ошибки в иерархии и scope.

Действия:
1. Исправить секцию приоритетов инструкций в global AGENTS.
2. Удалить доменную проектную специфику из global AGENTS.
3. Оставить единственный глобальный файл в `~/.codex/AGENTS.md`.
4. Архивировать или удалить `/Users/kirsr/AGENTS.md` как источник неоднозначности.

Результат:
- глобальный слой становится универсальным и непротиворечивым.

### Этап P2. Внедрение governance-гейтов

Цель: сделать оркестрацию исполнимой и измеримой.

Действия:
1. Добавить trigger-критерии для multi-agent (когда запускать/когда запрещено).
2. Добавить `Definition of Done` для каждого шага оркестрации.
3. Добавить verification и rollback-правила.
4. Добавить fallback-матрицу для недоступных инструментов.

Результат:
- решение о завершении шага принимается по объективным критериям.

### Этап P3. Cloud/Network hardening

Цель: снизить риск избыточного доступа и несанкционированных вызовов.

Действия:
1. Добавить policy least privilege для web/cloud.
2. Зафиксировать allow/deny-принципы по сетевым обращениям.
3. Зафиксировать правила работы с секретами и логами.

Результат:
- cloud execution управляется формальными ограничениями.

### Этап P4. Валидирующие прогоны и sign-off

Цель: подтвердить, что риски реально закрыты в исполнении, а не только на бумаге.

Действия:
1. Провести минимум 2 контрольных прогона на разных типах задач.
2. Протоколировать прохождение gate-чеков по каждому прогону.
3. Зафиксировать итоговый `Go/No-Go` по правилам секции 10.

Результат:
- подтвержденная операционная пригодность системной инструкции.

## 9. Gate-модель принятия решения

### Gate G0. Baseline completeness

Pass criteria:
1. Есть snapshot всех целевых файлов и активного MCP-списка.
2. Зафиксирован журнал изменений по remediation.

Fail criteria:
1. Отсутствует хотя бы один базовый артефакт.

### Gate G1. Scope and precedence integrity

Pass criteria:
1. В global AGENTS корректно описан приоритет инструкций.
2. Global AGENTS не содержит проектной доменной специфики.
3. Нет конфликтующей копии глобальной инструкции вне `~/.codex`.

Fail criteria:
1. Любой из трех критериев не выполнен.

### Gate G2. Orchestration governability

Pass criteria:
1. Явно описаны multi-agent triggers.
2. Для каждого ключевого шага есть DoD.
3. Для каждого шага есть verification и rollback-условия.

Fail criteria:
1. Отсутствует хотя бы один из обязательных governance-блоков.

### Gate G3. Security and cloud constraints

Pass criteria:
1. Описана least-privilege политика для web/cloud.
2. Описаны секреты/логи и запреты на утечки.
3. Есть fallback-политика при недоступности критичных инструментов.

Fail criteria:
1. Нет формализованных security-ограничений.

### Gate G4. Operational validation

Pass criteria:
1. Проведены 2 контрольных прогона по разным сценариям.
2. На каждом прогоне пройдены G1-G3.
3. Нет новых критических/высоких рисков, возникших в ходе прогона.

Fail criteria:
1. Любой прогон не проходит G1-G3.
2. Появились новые открытые critical/high риски.

## 10. Критерии финального решения «риски отработаны»

Решение `GO` принимается только если одновременно выполнены условия:

1. Gate G0, G1, G2, G3, G4 имеют статус `PASS`.
2. Все `Critical` риски имеют статус `Closed` с артефактами доказательства.
3. Все `High` риски имеют статус `Closed` или `Accepted` с явной причиной и владельцем.
4. Нет конфликтов в active instruction scope для целевого репозитория.
5. Есть подписанный remediation log с датой проверки.

Решение `NO-GO` принимается если выполнено хотя бы одно условие:

1. Не пройден любой из gate G0-G4.
2. Остался хотя бы один `Critical` риск со статусом не `Closed`.
3. Есть хотя бы один `High` риск без плана и владельца.
4. Есть конфликтующие AGENTS-инструкции в активном scope.

## 11. Формат журнала контроля (обязательный)

Для каждого риска фиксировать запись:

```json
{
  "risk_id": "R-XXX",
  "severity": "Critical|High|Medium",
  "status": "Open|InProgress|Closed|Accepted",
  "owner": "name-or-role",
  "mitigation_action": "string",
  "gate_link": "G0|G1|G2|G3|G4",
  "evidence_artifact": "path-or-url",
  "validated_at": "YYYY-MM-DD",
  "validator": "name-or-role"
}
```

Правило приемки:
1. Запись без `evidence_artifact` или `validated_at` не может считаться закрытием риска.

## 12. Execution Status (2026-03-04)

### 12.1 Выполненные действия по плану

1. P0 Baseline выполнен:
- Создан baseline-пакет: `/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/`.

2. P1 Critical remediation выполнен:
- Global AGENTS переведен в универсальный runtime-kernel.
- Удалена доменная привязка из global AGENTS.
- Конфликтующая копия `/Users/kirsr/AGENTS.md` архивирована в `/Users/kirsr/.codex/archive/AGENTS.home-legacy-2026-03-04.md`.

3. P2 Governance выполнен:
- Добавлены multi-agent triggers, DoD, verification/rollback, fallback.
- Обновлен проектный `AGENTS.md` до релизной структуры.
- `agents.mdc` переведен в mirror-режим с явным source-of-truth.

4. P3 Security/Cloud policy выполнен:
- В global AGENTS зафиксирован least-privilege подход и правила по секретам/внешним источникам.

5. P4 Validation выполнен:
- Проведены 2 контрольных прогона `codex exec` (single-task и multi-stream scenario).

### 12.2 Gate Results

| Gate | Status | Evidence |
|---|---|---|
| G0 Baseline completeness | `PASS` | `/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/` |
| G1 Scope and precedence integrity | `PASS` | `evidence/g1-static.txt`, `evidence/scope-check.txt` |
| G2 Orchestration governability | `PASS` | `evidence/g2-g3-static.txt`, `~/.codex/AGENTS.md` |
| G3 Security and cloud constraints | `PASS` | `evidence/g2-g3-static.txt`, `~/.codex/AGENTS.md` |
| G4 Operational validation | `PASS` | `evidence/g4-run1.txt`, `evidence/g4-run2.txt` |

### 12.3 Risk Control Log

```json
[
  {
    "risk_id": "R-C1",
    "severity": "Critical",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Corrected instruction precedence in global AGENTS",
    "gate_link": "G1",
    "evidence_artifact": "/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/evidence/g1-static.txt",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-C2",
    "severity": "Critical",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Removed project-domain specifics from global AGENTS",
    "gate_link": "G1",
    "evidence_artifact": "/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/evidence/g1-static.txt",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-C3",
    "severity": "Critical",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Archived conflicting /Users/kirsr/AGENTS.md",
    "gate_link": "G1",
    "evidence_artifact": "/Users/kirsr/.codex/archive/AGENTS.home-legacy-2026-03-04.md",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-H1",
    "severity": "High",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Added formal multi-agent trigger criteria",
    "gate_link": "G2",
    "evidence_artifact": "/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/evidence/g2-g3-static.txt",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-H2",
    "severity": "High",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Added Definition of Done and verification/rollback gates",
    "gate_link": "G2",
    "evidence_artifact": "/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/evidence/g2-g3-static.txt",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-H3",
    "severity": "High",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Added cloud/network least-privilege policy and source evidence rules",
    "gate_link": "G3",
    "evidence_artifact": "/Users/kirsr/workspace/cheh/.instruction-baseline/2026-03-04-release/evidence/g2-g3-static.txt",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-M1",
    "severity": "Medium",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Expanded handoff contract with owner/validation/rollback/confidence",
    "gate_link": "G2",
    "evidence_artifact": "/Users/kirsr/.codex/AGENTS.md",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-M2",
    "severity": "Medium",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Added versioning and review governance metadata",
    "gate_link": "G1",
    "evidence_artifact": "/Users/kirsr/.codex/AGENTS.md",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  },
  {
    "risk_id": "R-M3",
    "severity": "Medium",
    "status": "Closed",
    "owner": "Codex",
    "mitigation_action": "Added fallback matrix for unavailable tools/validation gaps",
    "gate_link": "G3",
    "evidence_artifact": "/Users/kirsr/.codex/AGENTS.md",
    "validated_at": "2026-03-04",
    "validator": "Codex"
  }
]
```

### 12.4 Final Decision

`GO`

Основание:
1. Все гейты G0-G4 в статусе `PASS`.
2. Все `Critical` и `High` риски закрыты с артефактами доказательства.
3. Конфликтов по active instruction scope в целевом репозитории не выявлено.
