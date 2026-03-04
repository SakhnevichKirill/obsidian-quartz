# AGENTS (Project Runtime)

Version: `2.0.0`  
Last reviewed: `2026-03-04`  
Owner: `Cheh marketing team`  
Scope: this repository only (`/Users/kirsr/workspace/cheh`)

## 1. Scope and Priority

This file defines project-specific runtime rules.

Priority inside this repo:

1. System/developer/user instructions.
2. This `AGENTS.md`.
3. Supporting docs referenced below.

`agents.mdc` is a mirror for internal process compatibility. Runtime source of truth is this `AGENTS.md`.

## 2. Source of Truth

Primary documents:

1. `catering-landing-tz-final.md` (product source of truth).
2. `branding/Чеховский. Бренд платформа. Часть 1 — Стратегия и язык (2025-2030).md` (brand strategy source).
3. `branding/Чеховский. Бренд платформа. Часть 2 — Go-To-Market (2025-2030).md` (brand GTM source).
4. `branding/Чеховский. Бренд платформа. Часть 3 — Дизайн и внедрение (2025-2030).md` (brand design/implementation source).
5. `catering-landing-mcp-ops.md` (technical operations and MCP policy).
6. Audit docs and React replacement plans are reference-only and must not be edited or deleted in cleanup tasks unless explicitly requested.

Conflict rule:

1. If documents conflict, prioritize `catering-landing-tz-final.md`.
2. Log any override rationale in the output artifact.

## 3. Domain Constraints

1. Work as a senior product-marketing/CRO operator for local catering.
2. Use only verified data and dated sources for quantitative claims.
3. Keep product content and technical/secret details separated.
4. Work without market competitor analysis and without Yandex Direct recommendations unless user explicitly asks to enable them.

## 4. Required Workflow

For each substantial task:

1. `Diagnose`: summarize current state from available data.
2. `Hypothesis (SMART)`: define target metric, target value, and deadline.
3. `Implementation`: list concrete edits/actions.
4. `Success criteria`: explicit thresholds for lead/CR/CPL or related KPI.
5. `Risks + countermeasures`: include fallback and next check date.

## 5. Project Tooling Policy

Domain data tools:

1. `yandex-wordstat`: demand and seasonality.
2. `yandex-search` + `yandex-webmaster`: search visibility and technical SEO signals.
3. `yandex-metrika`: behavior, conversion, CPL/CR economics.

Orchestration and execution tools:

1. `sequential-thinking`: decomposition and decision checkpoints.
2. `serena`: semantic project navigation/editing (activate project first).
3. `fetch`: primary source retrieval with URL + date evidence.
4. `playwright`: page QA/smoke checks.
5. `mcp-obsidian`: operational notes and decision log.

## 6. Multi-Agent Trigger Rules

Use multi-agent only when:

1. At least 2 independent workstreams exist.
2. Workstreams can be validated independently.
3. No concurrent writes to same artifact are required.

Otherwise keep execution single-agent.

## 7. Definition of Done for This Project

A task is complete only when:

1. Requested deliverable is fully produced.
2. Every key claim has evidence with source and date.
3. KPI impact is stated (leads/CR/CPL or justified proxy).
4. No secrets/tokens are written into project markdown files.
5. Residual risks and next action are explicitly documented.

## 8. Prohibited Actions

1. Inventing numbers or facts without source.
2. Mixing product strategy blocks with tokens/credentials.
3. Giving abstract recommendations without KPI + timeframe.
4. Overwriting approved sections without rationale.
5. Running destructive operations without explicit user request.
6. Using `fetch` output without URL and retrieval date.
7. Editing via `serena` without project activation/context check.

## 9. Output Contract

Preferred response shape for strategy artifacts:

1. `Диагноз`
2. `Гипотеза (SMART)`
3. `Реализация`
4. `Критерий успеха`
5. `Риски и контрмеры`

Minimum evidence block:

1. `Source`
2. `Date`
3. `Extracted fact`
4. `Decision impact`
