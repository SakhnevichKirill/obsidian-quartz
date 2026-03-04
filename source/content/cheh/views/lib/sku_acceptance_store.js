// Persistent storage for SKU acceptance state (frontmatter + validation).
(() => {
  const VERSION = "2026-03-04T01";
  if (
    globalThis.SkuAcceptanceStore &&
    typeof globalThis.SkuAcceptanceStore.__version === "string" &&
    globalThis.SkuAcceptanceStore.__version >= VERSION
  ) {
    return globalThis.SkuAcceptanceStore;
  }

  const ALLOWED_SKU_STATUS = new Set(["todo", "in_progress", "done", "blocked"]);
  const ALLOWED_REC_STATUS = new Set(["todo", "done", "skip", "blocked"]);

  const deepCopy = (value) => JSON.parse(JSON.stringify(value));

  const ensureObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const nowIso = () => new Date().toISOString();

  const todayIso = () => nowIso().slice(0, 10);

  const toYaml = (value, indent = 0) => {
    const pad = " ".repeat(indent);
    if (value === null || value === undefined) return "null";
    if (typeof value === "number" || typeof value === "boolean") return String(value);

    if (typeof value === "string") {
      if (!value.length) return '""';
      if (/[:\-\[\]\{\},#&*!|>'"%@`]/.test(value) || /\n/.test(value)) {
        return JSON.stringify(value);
      }
      return value;
    }

    if (Array.isArray(value)) {
      if (!value.length) return "[]";
      const lines = [];
      for (let i = 0; i < value.length; i += 1) {
        const itemYaml = toYaml(value[i], indent + 2);
        const segments = String(itemYaml).split("\n");
        const first = segments.shift() || "";
        lines.push(`${pad}- ${first.trimStart()}`);
        for (let s = 0; s < segments.length; s += 1) {
          lines.push(`${pad}  ${segments[s]}`);
        }
      }
      return lines.join("\n");
    }

    if (typeof value === "object") {
      const entries = Object.entries(value);
      if (!entries.length) return "{}";
      return entries
        .map(([key, val]) => {
          const safeKey = /^[A-Za-z0-9_]+$/.test(key) ? key : JSON.stringify(String(key));
          if (Array.isArray(val)) {
            if (!val.length) return `${pad}${safeKey}: []`;
            const nestedArray = toYaml(val, indent + 2);
            return `${pad}${safeKey}:\n${nestedArray}`;
          }
          const yamlVal = toYaml(val, indent + 2);
          if (yamlVal.indexOf("\n") !== -1) {
            const nested = yamlVal
              .split("\n")
              .map((line) => `${pad}  ${line}`)
              .join("\n");
            return `${pad}${safeKey}:\n${nested}`;
          }
          return `${pad}${safeKey}: ${yamlVal}`;
        })
        .join("\n");
    }

    return JSON.stringify(value);
  };

  const readFrontmatter = (app, file) => {
    try {
      const cache = app?.metadataCache?.getFileCache(file);
      const fm = cache && cache.frontmatter ? cache.frontmatter : {};
      const plain = {};
      for (const key of Object.keys(fm || {})) {
        if (key === "position") continue;
        plain[key] = deepCopy(fm[key]);
      }
      return plain;
    } catch (error) {
      return {};
    }
  };

  const ensureParentFolders = async (app, filePath) => {
    const pathParts = String(filePath || "")
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
    if (pathParts.length <= 1) return;

    let current = "";
    for (let i = 0; i < pathParts.length - 1; i += 1) {
      current = current ? `${current}/${pathParts[i]}` : pathParts[i];
      const existing = app.vault.getAbstractFileByPath(current);
      if (!existing) {
        await app.vault.createFolder(current);
      }
    }
  };

  const writeFrontmatter = async (app, file, updater) => {
    const original = await app.vault.read(file);
    const existing = readFrontmatter(app, file);
    updater(existing);
    const yamlBody = toYaml(existing);
    const nextFrontmatter = `---\n${yamlBody}\n---`;

    const bodyWithoutFrontmatter = original.replace(
      /(^|\n)---\s*\n[\s\S]*?\n---\s*(?=\n|$)/g,
      (match, prefix) => (prefix === "\n" ? "\n" : "")
    );
    const trimmedBody = bodyWithoutFrontmatter.replace(/^[\n\r]+/, "");
    const suffix = trimmedBody.length ? `\n\n${trimmedBody}` : "";
    const nextContent = `${nextFrontmatter}${suffix}`;

    if (nextContent !== original) {
      await app.vault.modify(file, nextContent);
    }
  };

  const ensureFile = async (app, filePath, initialFrontmatter, initialBody) => {
    const path = String(filePath || "").trim();
    if (!path.length) throw new Error("SkuAcceptanceStore: empty file path");

    let file = app.vault.getAbstractFileByPath(path);
    let created = false;

    if (!file) {
      await ensureParentFolders(app, path);
      const fm = toYaml(initialFrontmatter || {});
      const body = typeof initialBody === "string" ? initialBody : "";
      const content = `---\n${fm}\n---\n\n${body}`;
      file = await app.vault.create(path, content);
      created = true;
    }

    return { file, created };
  };

  const recommendationFromRaw = (raw) => {
    const source = ensureObject(raw);
    const state = ALLOWED_REC_STATUS.has(String(source.state || ""))
      ? String(source.state)
      : "todo";
    return {
      state,
      comment: String(source.comment || ""),
      updated_at: String(source.updated_at || "")
    };
  };

  const createDefaultEntry = (recommendationKeys) => {
    const keys = Array.isArray(recommendationKeys) ? recommendationKeys : [];
    const recommendations = {};
    for (let i = 0; i < keys.length; i += 1) {
      const key = String(keys[i] || "").trim();
      if (!key.length) continue;
      recommendations[key] = {
        state: "todo",
        comment: "",
        updated_at: ""
      };
    }

    return {
      status: "todo",
      owner: "",
      summary_comment: "",
      updated_at: "",
      recommendations
    };
  };

  const normalizeEntry = (rawEntry, recommendationKeys) => {
    const source = ensureObject(rawEntry);
    const base = createDefaultEntry(recommendationKeys);

    const status = ALLOWED_SKU_STATUS.has(String(source.status || ""))
      ? String(source.status)
      : base.status;

    const recommendations = ensureObject(source.recommendations);
    for (const key of Object.keys(base.recommendations)) {
      base.recommendations[key] = recommendationFromRaw(recommendations[key]);
    }
    for (const key of Object.keys(recommendations)) {
      if (!Object.prototype.hasOwnProperty.call(base.recommendations, key)) {
        base.recommendations[key] = recommendationFromRaw(recommendations[key]);
      }
    }

    return {
      status,
      owner: String(source.owner || ""),
      summary_comment: String(source.summary_comment || ""),
      updated_at: String(source.updated_at || ""),
      recommendations: base.recommendations
    };
  };

  const normalizeState = (rawState, recommendationKeysBySku) => {
    const source = ensureObject(rawState);
    const sourceAcceptance = ensureObject(source.sku_acceptance);
    const output = {
      schema_version: 1,
      updated_at: String(source.updated_at || ""),
      sku_acceptance: {}
    };

    const skuSet = new Set(Object.keys(sourceAcceptance));
    for (const skuId of Object.keys(ensureObject(recommendationKeysBySku))) {
      skuSet.add(skuId);
    }

    skuSet.forEach((skuId) => {
      const keys = recommendationKeysBySku && recommendationKeysBySku[skuId]
        ? recommendationKeysBySku[skuId]
        : [];
      output.sku_acceptance[skuId] = normalizeEntry(sourceAcceptance[skuId], keys);
    });

    return output;
  };

  const load = async (app, filePath, recommendationKeysBySku) => {
    if (!app) throw new Error("SkuAcceptanceStore.load: app is required");

    const initialFrontmatter = {
      title: "SKU Acceptance State",
      type: "config",
      schema_version: 1,
      updated_at: "",
      sku_acceptance: {}
    };

    const { file, created } = await ensureFile(
      app,
      filePath,
      initialFrontmatter,
      "Persistent state for SKU acceptance dashboard. Managed automatically."
    );

    const fm = readFrontmatter(app, file);
    const state = normalizeState(fm, recommendationKeysBySku || {});

    if (created) {
      await save(app, filePath, state, file);
    }

    return { file, created, state };
  };

  const save = async (app, filePath, state, fileHint) => {
    if (!app) throw new Error("SkuAcceptanceStore.save: app is required");

    let file = fileHint;
    if (!file) {
      const ensured = await ensureFile(
        app,
        filePath,
        {
          title: "SKU Acceptance State",
          type: "config",
          schema_version: 1,
          updated_at: "",
          sku_acceptance: {}
        },
        "Persistent state for SKU acceptance dashboard. Managed automatically."
      );
      file = ensured.file;
    }

    const safeState = normalizeState(state, {});
    if (!safeState.updated_at) safeState.updated_at = nowIso();

    await writeFrontmatter(app, file, (fm) => {
      fm.schema_version = 1;
      fm.updated_at = safeState.updated_at;
      fm.sku_acceptance = safeState.sku_acceptance;
      if (!fm.title) fm.title = "SKU Acceptance State";
      if (!fm.type) fm.type = "config";
    });

    return { file, state: safeState };
  };

  const validateEntry = (entry, recommendationKeys) => {
    const keys = Array.isArray(recommendationKeys) ? recommendationKeys : [];
    const safeEntry = normalizeEntry(entry, keys);
    const errors = [];

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const rec = safeEntry.recommendations[key] || recommendationFromRaw({});
      const comment = String(rec.comment || "").trim();
      if ((rec.state === "blocked" || rec.state === "skip") && !comment.length) {
        errors.push(`Для рекомендации '${key}' обязателен комментарий при статусе ${rec.state}.`);
      }
    }

    if (safeEntry.status === "done") {
      for (let i = 0; i < keys.length; i += 1) {
        const key = keys[i];
        const rec = safeEntry.recommendations[key] || recommendationFromRaw({});
        if (rec.state === "todo" || rec.state === "blocked") {
          errors.push(`Нельзя поставить done: рекомендация '${key}' в статусе ${rec.state}.`);
        }
        if (rec.state === "skip" && !String(rec.comment || "").trim().length) {
          errors.push(`Нельзя поставить done: '${key}' в skip без комментария.`);
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      entry: safeEntry
    };
  };

  const summarize = (state, skuIds, recommendationKeysBySku) => {
    const safe = normalizeState(state, recommendationKeysBySku || {});
    const list = Array.isArray(skuIds) ? skuIds : Object.keys(safe.sku_acceptance);

    const result = {
      totalSku: 0,
      status: { todo: 0, in_progress: 0, done: 0, blocked: 0 },
      recommendations: { total: 0, done: 0, todo: 0, skip: 0, blocked: 0 },
      allRecommendationsApplied: 0,
      withBlockers: 0
    };

    for (let i = 0; i < list.length; i += 1) {
      const skuId = list[i];
      const keys = recommendationKeysBySku && recommendationKeysBySku[skuId]
        ? recommendationKeysBySku[skuId]
        : [];
      const entry = normalizeEntry(safe.sku_acceptance[skuId], keys);
      result.totalSku += 1;
      result.status[entry.status] = (result.status[entry.status] || 0) + 1;

      let blockers = 0;
      let applied = true;
      for (let r = 0; r < keys.length; r += 1) {
        const rec = entry.recommendations[keys[r]] || recommendationFromRaw({});
        result.recommendations.total += 1;
        result.recommendations[rec.state] = (result.recommendations[rec.state] || 0) + 1;
        if (rec.state !== "done" && rec.state !== "skip") applied = false;
        if (rec.state === "blocked") blockers += 1;
      }
      if (applied) result.allRecommendationsApplied += 1;
      if (blockers > 0) result.withBlockers += 1;
    }

    return result;
  };

  globalThis.SkuAcceptanceStore = {
    ALLOWED_SKU_STATUS,
    ALLOWED_REC_STATUS,
    deepCopy,
    ensureObject,
    nowIso,
    todayIso,
    toYaml,
    readFrontmatter,
    writeFrontmatter,
    ensureFile,
    createDefaultEntry,
    normalizeEntry,
    normalizeState,
    load,
    save,
    validateEntry,
    summarize,
    __version: VERSION
  };
})();
