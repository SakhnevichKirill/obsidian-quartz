---
id: CHEH-SKU-RESEARCH-DASHBOARD
title: "Чеховский — SKU Research Dashboard"
type: dashboard
status: draft
owner: Chehovskiy Team
tags:
  - catering
  - sku
  - dashboard
  - research
created: 2026-03-04
last_updated: 2026-03-04
audience: "Owner, Marketing, Product"
persona: "AI_Agent"
north_star_metric: "Measured add_to_cart conversion by SKU"
---
%%  %%
> [!summary] Что это
> Детальный последовательный дашборд по всем SKU: от простых фактов к выводам, приемке и плану действий.

## SKU Story Board

```dataviewjs
await dv.view("views/chehovskiy_sku_research_dashboard", {
  dataPath: "artifacts/sku-audit",
  acceptanceMode: true,
  acceptanceStatePath: "views/sku_acceptance_state.md",
  profileStatePath: "views/sku_dashboard_profiles.md"
});
```

## Быстрые ссылки
- [[chehovskiy-sku-hadi-audit-add-to-cart-2026-03-04|SKU HADI Audit (add_to_cart)]]
- [[chehovskiy-yandex-metrika-context-2026-03-04|Metrika Context]]
- [[chehovskiy-furshet-hadi-audit-2026-03-04|Legacy Furshet Audit]]
