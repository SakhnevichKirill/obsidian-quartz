// Persistent profiles store for SKU dashboard filters.
(() => {
  const VERSION = "2026-03-04T01";
  if (
    globalThis.SkuProfilesStore &&
    typeof globalThis.SkuProfilesStore.__version === "string" &&
    globalThis.SkuProfilesStore.__version >= VERSION
  ) {
    return globalThis.SkuProfilesStore;
  }

  const deepCopy = (value) => JSON.parse(JSON.stringify(value));

  const ensureObject = (value) =>
    value && typeof value === "object" && !Array.isArray(value) ? value : {};

  const sanitizeName = (input) =>
    String(input || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w\-.]/g, "")
      .slice(0, 64);

  const defaultState = (defaultFilters) => ({
    filters: deepCopy(defaultFilters || {}),
    updated_at: ""
  });

  const normalizeProfile = (raw, defaultFilters) => {
    const src = ensureObject(raw);
    const defaults = ensureObject(defaultFilters);
    const incoming = ensureObject(src.filters);
    const filters = {};

    for (const key of Object.keys(defaults)) {
      filters[key] = incoming[key] !== undefined ? incoming[key] : defaults[key];
    }

    for (const key of Object.keys(incoming)) {
      if (!Object.prototype.hasOwnProperty.call(filters, key)) {
        filters[key] = incoming[key];
      }
    }

    return {
      filters,
      updated_at: String(src.updated_at || "")
    };
  };

  const ensureDependencies = () => {
    if (!globalThis.SkuAcceptanceStore) {
      throw new Error("SkuProfilesStore requires SkuAcceptanceStore to be loaded first");
    }
    return globalThis.SkuAcceptanceStore;
  };

  const load = async (app, filePath, defaultFilters) => {
    const Store = ensureDependencies();

    const initialFrontmatter = {
      title: "SKU Dashboard Profiles",
      type: "config",
      schema_version: 1,
      active_profile: "default",
      profiles: {
        default: defaultState(defaultFilters)
      }
    };

    const { file, created } = await Store.ensureFile(
      app,
      filePath,
      initialFrontmatter,
      "Saved filter profiles for SKU acceptance dashboard."
    );

    const fm = Store.readFrontmatter(app, file);
    const sourceProfiles = ensureObject(fm.profiles);
    const profiles = {};

    Object.keys(sourceProfiles).forEach((name) => {
      const clean = sanitizeName(name);
      if (!clean.length) return;
      profiles[clean] = normalizeProfile(sourceProfiles[name], defaultFilters);
    });

    if (!Object.keys(profiles).length) {
      profiles.default = defaultState(defaultFilters);
    }

    let activeName = sanitizeName(fm.active_profile || "") || "default";
    if (!profiles[activeName]) activeName = Object.keys(profiles).sort()[0];

    if (created) {
      await save(app, filePath, profiles, activeName, file);
    }

    return { file, created, profiles, activeName };
  };

  const save = async (app, filePath, profiles, activeName, fileHint) => {
    const Store = ensureDependencies();

    let file = fileHint;
    if (!file) {
      const ensured = await Store.ensureFile(
        app,
        filePath,
        {
          title: "SKU Dashboard Profiles",
          type: "config",
          schema_version: 1,
          active_profile: "default",
          profiles: { default: { filters: {}, updated_at: "" } }
        },
        "Saved filter profiles for SKU acceptance dashboard."
      );
      file = ensured.file;
    }

    const safeProfiles = {};
    Object.keys(ensureObject(profiles)).forEach((name) => {
      const clean = sanitizeName(name);
      if (!clean.length) return;
      safeProfiles[clean] = normalizeProfile(profiles[name], {});
      if (!safeProfiles[clean].updated_at) safeProfiles[clean].updated_at = Store.nowIso();
    });

    if (!Object.keys(safeProfiles).length) {
      safeProfiles.default = { filters: {}, updated_at: Store.nowIso() };
    }

    let safeActive = sanitizeName(activeName);
    if (!safeProfiles[safeActive]) safeActive = Object.keys(safeProfiles).sort()[0];

    await Store.writeFrontmatter(app, file, (fm) => {
      fm.schema_version = 1;
      fm.active_profile = safeActive;
      fm.profiles = safeProfiles;
      if (!fm.title) fm.title = "SKU Dashboard Profiles";
      if (!fm.type) fm.type = "config";
    });

    return { file, profiles: safeProfiles, activeName: safeActive };
  };

  globalThis.SkuProfilesStore = {
    sanitizeName,
    normalizeProfile,
    defaultState,
    load,
    save,
    __version: VERSION
  };
})();
