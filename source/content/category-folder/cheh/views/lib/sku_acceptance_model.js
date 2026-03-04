// Derived model helpers for SKU acceptance dashboard.
(() => {
  const VERSION = "2026-03-04T01";
  if (
    globalThis.SkuAcceptanceModel &&
    typeof globalThis.SkuAcceptanceModel.__version === "string" &&
    globalThis.SkuAcceptanceModel.__version >= VERSION
  ) {
    return globalThis.SkuAcceptanceModel;
  }

  const DEFAULT_RECOMMENDATION_KEYS = [
    "expert_diagnosis",
    "expert_shot_plan",
    "expert_styling_plan",
    "expert_post_plan"
  ];

  const RECOMMENDATION_LABELS = {
    expert_diagnosis: "Диагностика",
    expert_shot_plan: "План досъемки",
    expert_styling_plan: "План стилизации",
    expert_post_plan: "План постобработки"
  };

  const deepCopy = (value) => JSON.parse(JSON.stringify(value));

  const recommendationKeysForSku = (expertRow) => {
    const set = new Set(DEFAULT_RECOMMENDATION_KEYS);
    if (expertRow && typeof expertRow === "object") {
      Object.keys(expertRow).forEach((key) => {
        if (!key.startsWith("expert_")) return;
        if (key === "expert_full_comment") return;
        const value = String(expertRow[key] || "").trim();
        if (!value.length) return;
        set.add(key);
      });
    }
    return Array.from(set);
  };

  const recommendationLabel = (key) => {
    if (RECOMMENDATION_LABELS[key]) return RECOMMENDATION_LABELS[key];
    return String(key || "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  };

  const recommendationSourceText = (key, expertRow, fallbackComments) => {
    const expert = expertRow && typeof expertRow === "object" ? expertRow : {};
    const fallback = Array.isArray(fallbackComments) ? fallbackComments.filter(Boolean) : [];

    if (key === "expert_diagnosis") {
      if (String(expert.expert_diagnosis || "").trim().length) return String(expert.expert_diagnosis);
      return fallback.join(" ");
    }

    if (String(expert[key] || "").trim().length) return String(expert[key]);

    if (key === "expert_shot_plan" && fallback.length) return "Нужна досъемка по итогам диагностики.";
    if (key === "expert_styling_plan" && fallback.length) return "Нужна стилизация подачи по итогам диагностики.";
    if (key === "expert_post_plan" && fallback.length) return "Нужна постобработка изображения по итогам диагностики.";

    return "";
  };

  const buildRecommendationItems = ({ skuId, expertRow, fallbackComments }) => {
    const keys = recommendationKeysForSku(expertRow);
    const items = keys.map((key) => ({
      sku_id: skuId,
      key,
      label: recommendationLabel(key),
      source_text: recommendationSourceText(key, expertRow, fallbackComments),
      required: true
    }));
    return items;
  };

  const computeRecommendationMetrics = (entry, recommendationKeys) => {
    const safeEntry = entry && typeof entry === "object" ? entry : {};
    const keys = Array.isArray(recommendationKeys) ? recommendationKeys : DEFAULT_RECOMMENDATION_KEYS;
    const recommendations =
      safeEntry.recommendations && typeof safeEntry.recommendations === "object"
        ? safeEntry.recommendations
        : {};

    const metrics = {
      total: keys.length,
      done: 0,
      todo: 0,
      skip: 0,
      blocked: 0,
      all_applied: true,
      has_blockers: false,
      completion_ratio: 0
    };

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const rec = recommendations[key] && typeof recommendations[key] === "object"
        ? recommendations[key]
        : { state: "todo" };
      const state = String(rec.state || "todo");
      if (state === "done") metrics.done += 1;
      else if (state === "skip") metrics.skip += 1;
      else if (state === "blocked") metrics.blocked += 1;
      else metrics.todo += 1;

      if (!(state === "done" || state === "skip")) metrics.all_applied = false;
      if (state === "blocked") metrics.has_blockers = true;
    }

    metrics.completion_ratio =
      metrics.total > 0 ? Number(((metrics.done + metrics.skip) / metrics.total).toFixed(4)) : 1;
    return metrics;
  };

  const summarizeSkuEntry = (entry, recommendationKeys) => {
    const metrics = computeRecommendationMetrics(entry, recommendationKeys);
    return {
      status: String(entry && entry.status ? entry.status : "todo"),
      owner: String(entry && entry.owner ? entry.owner : ""),
      summary_comment: String(entry && entry.summary_comment ? entry.summary_comment : ""),
      updated_at: String(entry && entry.updated_at ? entry.updated_at : ""),
      recommendations_total: metrics.total,
      recommendations_done: metrics.done,
      recommendations_skip: metrics.skip,
      recommendations_todo: metrics.todo,
      recommendations_blocked: metrics.blocked,
      all_recommendations_applied: metrics.all_applied,
      has_blockers: metrics.has_blockers,
      completion_ratio: metrics.completion_ratio
    };
  };

  globalThis.SkuAcceptanceModel = {
    DEFAULT_RECOMMENDATION_KEYS,
    RECOMMENDATION_LABELS,
    deepCopy,
    recommendationKeysForSku,
    recommendationLabel,
    recommendationSourceText,
    buildRecommendationItems,
    computeRecommendationMetrics,
    summarizeSkuEntry,
    __version: VERSION
  };
})();
