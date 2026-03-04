(async () => {
  const params = typeof input === "object" && input ? input : {};
  const DATA_PATH = params.dataPath || "artifacts/sku-audit";
  const STYLE_ID = "cheh-sku-dashboard-style";
  const ACCEPTANCE_MODE = params.acceptanceMode !== false;
  const ACCEPTANCE_STATE_PATH = params.acceptanceStatePath || "views/sku_acceptance_state.md";
  const PROFILE_STATE_PATH = params.profileStatePath || "views/sku_dashboard_profiles.md";
  const ACCEPTANCE_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
  const PERSIST_TO_FILE = params.persistToFile !== false;
  const ACCEPTANCE_LOCAL_KEY =
    params.acceptanceLocalKey || "cheh:sku:acceptance:state:v1";
  const PROFILE_LOCAL_KEY =
    params.profileLocalKey || "cheh:sku:acceptance:profiles:v1";

  const SECTION_ORDER = ["furshetmenu", "hot", "zakuski", "desert", "napitki"];
  const SECTION_LABELS = {
    furshetmenu: "Фуршетное меню",
    hot: "Горячее",
    zakuski: "Закуски",
    desert: "Десерты",
    napitki: "Напитки"
  };
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const ACCEPTANCE_STATUS_LABELS = {
    todo: "К выполнению",
    in_progress: "В работе",
    done: "Принято",
    blocked: "Блокер"
  };
  const appCtx =
    dv.app ||
    (typeof window !== "undefined" ? window.app : null) ||
    (typeof app !== "undefined" ? app : null) ||
    null;
  let acceptanceEnabled = ACCEPTANCE_MODE;
  let AcceptanceStore = null;
  let AcceptanceModel = null;
  let ProfilesStore = null;

  async function safeLoad(path) {
    try {
      return await dv.io.load(path);
    } catch (error) {
      return "";
    }
  }

  function toNum(value) {
    if (value == null || value === "") return 0;
    const num = Number.parseFloat(String(value).replace(",", "."));
    return Number.isFinite(num) ? num : 0;
  }

  function alphaMark(index) {
    let value = index + 1;
    let result = "";
    while (value > 0) {
      const rem = (value - 1) % 26;
      result = LETTERS[rem] + result;
      value = Math.floor((value - 1) / 26);
    }
    return result;
  }

  function parseCSVLine(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"') {
          const next = line[i + 1];
          if (next === '"') {
            cell += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          cell += ch;
        }
      } else if (ch === '"') {
        quoted = true;
      } else if (ch === ",") {
        cells.push(cell);
        cell = "";
      } else {
        cell += ch;
      }
    }
    cells.push(cell);
    return cells;
  }

  function parseCSV(text) {
    const source = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!source) return [];
    const lines = source.split("\n");
    if (!lines.length) return [];

    const headers = parseCSVLine(lines[0]).map((h) => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const raw = lines[i];
      if (!raw || !raw.trim()) continue;
      const parts = parseCSVLine(raw);
      const row = {};
      for (let c = 0; c < headers.length; c += 1) row[headers[c]] = (parts[c] ?? "").trim();
      rows.push(row);
    }
    return rows;
  }

  function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function sanitizeProfileName(name) {
    return String(name || "")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w\-.]/g, "")
      .slice(0, 64);
  }

  function loadLocalJson(key) {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function saveLocalJson(key, value) {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {}
  }

  function fileLinkNode(path, label) {
    const cleanPath = String(path || "").trim();
    try {
      const link = dv.fileLink(cleanPath, false, label);
      if (link instanceof HTMLElement) return link;
      if (link && link.el instanceof HTMLElement) return link.el;
    } catch (error) {}
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = label || cleanPath;
    a.addEventListener("click", (event) => {
      event.preventDefault();
      if (appCtx?.workspace?.openLinkText) {
        appCtx.workspace.openLinkText(cleanPath, cleanPath);
      }
    });
    return a;
  }

  function externalLink(url, label) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label || url;
    return a;
  }

  function vaultImageSrc(path) {
    const clean = String(path || "").replace(/^\/+/, "");
    if (!clean) return "";
    try {
      if (typeof app !== "undefined" && app?.vault?.adapter?.getResourcePath) {
        const file = app.vault.getAbstractFileByPath(clean);
        if (file?.path) return app.vault.adapter.getResourcePath(file.path);
        return app.vault.adapter.getResourcePath(clean);
      }
    } catch (error) {}
    return clean;
  }

  function scoreBucket(score) {
    if (score < 5) return "low";
    if (score < 6.5) return "mid";
    return "high";
  }

  function scoreClass(score) {
    if (score < 5) return "bad";
    if (score < 6.5) return "mid";
    return "good";
  }

  function meter(value, max = 10) {
    const wrap = document.createElement("div");
    wrap.className = "cheh-meter";
    const bar = wrap.appendChild(document.createElement("div"));
    bar.className = "cheh-meter__bar";
    const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    bar.style.width = `${(ratio * 100).toFixed(1)}%`;
    const cls = scoreClass(value);
    if (cls === "mid") bar.classList.add("cheh-meter__bar--mid");
    if (cls === "bad") bar.classList.add("cheh-meter__bar--bad");
    return wrap;
  }

  function createTable(headers, rows) {
    const wrap = document.createElement("div");
    wrap.className = "cheh-table-wrap";
    const table = wrap.appendChild(document.createElement("table"));
    table.className = "cheh-table";

    const thead = table.appendChild(document.createElement("thead"));
    const headRow = thead.appendChild(document.createElement("tr"));
    for (const h of headers) {
      const th = headRow.appendChild(document.createElement("th"));
      th.textContent = h;
    }

    const tbody = table.appendChild(document.createElement("tbody"));
    for (const row of rows) {
      const tr = tbody.appendChild(document.createElement("tr"));
      for (const value of row) {
        const td = tr.appendChild(document.createElement("td"));
        td.textContent = value;
      }
    }

    return wrap;
  }

  function splitIntoFiveIntervals(items, scoreKey = "appetite_score_data") {
    const sorted = [...items].sort((a, b) => toNum(a[scoreKey]) - toNum(b[scoreKey]));
    const groups = [];
    const n = sorted.length;
    for (let i = 0; i < 5; i += 1) {
      const start = Math.floor((i * n) / 5);
      const end = Math.floor(((i + 1) * n) / 5);
      const part = sorted.slice(start, end);
      groups.push(part);
    }
    return groups.filter((g) => g.length > 0);
  }

  function commentsForCard(card, duplicatesByUrlCount) {
    const comments = [];
    const score = toNum(card.appetite_score_data);
    const price = toNum(card.price_rub);
    const imgQ = toNum(card.image_quality_score);
    const food = toNum(card.food_styling_score);

    if (!price) comments.push("Нет цены: для части пользователей это стоп-фактор перед добавлением в корзину.");
    if (score < 5) comments.push("Низкая аппетитность: карточку лучше переснять и перепроверить свет/кадр.");
    if (imgQ < 5) comments.push("Качество изображения ниже среднего: стоит усилить резкость/контраст и крупность блюда.");
    if (food < 5) comments.push("Подача выглядит слабо: нужен более «съедобный» ракурс и акцент на продукт.");
    if (duplicatesByUrlCount > 1)
      comments.push(`Фото повторяется в ${duplicatesByUrlCount} карточках: снижается различимость SKU.`);
    if (!card.description) comments.push("Описание пустое: добавьте состав/контекст подачи.");
    if (!card.weight_text) comments.push("Вес не указан: сложнее оценить ценность цены.");

    if (!comments.length) comments.push("Карточка выглядит рабочей: можно использовать как эталон визуала.");
    return comments;
  }

  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .cheh-sku-dashboard {
        --bg1: rgba(14,165,233,0.15);
        --bg2: rgba(59,130,246,0.12);
        --line: rgba(96,165,250,0.35);
        display: flex;
        flex-direction: column;
        gap: 1.05rem;
      }
      .cheh-kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 0.72rem;
      }
      .cheh-kpi {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: linear-gradient(135deg, var(--bg1), var(--bg2));
        padding: 0.74rem 0.84rem;
      }
      .cheh-kpi__label {
        font-size: 0.74rem;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .cheh-kpi__value {
        margin-top: 0.2rem;
        font-size: 1.01rem;
        font-weight: 700;
        color: var(--text-normal);
      }
      .cheh-story {
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 0.84rem;
        background: rgba(30,41,59,0.08);
      }
      .cheh-story__title { font-weight: 700; margin-bottom: 0.45rem; }
      .cheh-story__list {
        margin: 0;
        padding-left: 1.1rem;
        display: grid;
        gap: 0.24rem;
      }
      .cheh-story__subtitle {
        margin-top: 0.72rem;
        margin-bottom: 0.3rem;
        font-size: 0.86rem;
        font-weight: 700;
        color: var(--text-normal);
      }
      .cheh-story__algo {
        margin: 0;
        padding-left: 1.1rem;
        display: grid;
        gap: 0.22rem;
      }
      .cheh-story__algo li {
        font-size: 0.82rem;
        line-height: 1.34;
        color: var(--text-muted);
      }
      .cheh-alert {
        border: 1px solid rgba(239,68,68,0.45);
        background: rgba(239,68,68,0.12);
        border-radius: 10px;
        padding: 0.65rem 0.72rem;
        font-size: 0.86rem;
      }

      .cheh-sections { display: flex; flex-direction: column; gap: 0.9rem; }
      .cheh-section {
        --section-rgb: 59,130,246;
        border: 1px solid rgba(var(--section-rgb),0.42);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(var(--section-rgb),0.12), rgba(var(--section-rgb),0.05));
        padding: 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.72rem;
      }
      .cheh-section--furshetmenu { --section-rgb: 56,189,248; }
      .cheh-section--hot { --section-rgb: 37,99,235; }
      .cheh-section--zakuski { --section-rgb: 20,184,166; }
      .cheh-section--desert { --section-rgb: 168,85,247; }
      .cheh-section--napitki { --section-rgb: 245,158,11; }

      .cheh-section__head { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
      .cheh-section__badge {
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 999px;
        background: rgba(var(--section-rgb),0.55);
        border: 1px solid rgba(var(--section-rgb),0.9);
        color: #fff;
        font-size: 0.78rem;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .cheh-section__title { font-size: 1.03rem; font-weight: 700; }

      .cheh-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 0.6rem;
      }
      .cheh-chip {
        border: 1px solid rgba(var(--section-rgb),0.4);
        border-radius: 10px;
        background: rgba(var(--section-rgb),0.12);
        padding: 0.5rem 0.55rem;
      }
      .cheh-chip__k { font-size: 0.71rem; text-transform: uppercase; color: var(--text-muted); }
      .cheh-chip__v { margin-top: 0.16rem; font-size: 0.92rem; font-weight: 700; }

      .cheh-meter { border-radius: 8px; background: rgba(148,163,184,0.28); height: 8px; overflow: hidden; margin-top: 0.38rem; }
      .cheh-meter__bar { height: 100%; background: linear-gradient(90deg, #22c55e, #84cc16); }
      .cheh-meter__bar--mid { background: linear-gradient(90deg, #f59e0b, #eab308); }
      .cheh-meter__bar--bad { background: linear-gradient(90deg, #ef4444, #f97316); }

      .cheh-note { font-size: 0.86rem; line-height: 1.35; }
      .cheh-section details { border-top: 1px solid rgba(var(--section-rgb),0.35); padding-top: 0.45rem; margin-top: 0.2rem; }
      .cheh-section summary {
        cursor: pointer;
        font-size: 0.78rem;
        text-transform: uppercase;
        color: var(--text-muted);
        letter-spacing: 0.03em;
        font-weight: 600;
      }

      .cheh-intervals { display: flex; flex-direction: column; gap: 0.45rem; margin-top: 0.45rem; }
      .cheh-interval {
        border: 1px solid rgba(var(--section-rgb),0.34);
        border-radius: 10px;
        background: rgba(var(--section-rgb),0.09);
        padding: 0.5rem 0.55rem;
      }
      .cheh-interval summary { font-size: 0.76rem; }
      .cheh-interval__meta { margin-top: 0.2rem; font-size: 0.78rem; color: var(--text-muted); }

      .cheh-sku-cards { margin-top: 0.35rem; display: flex; flex-direction: column; gap: 0.38rem; }
      .cheh-sku-card {
        border: 1px solid rgba(var(--section-rgb),0.28);
        border-radius: 10px;
        background: rgba(var(--section-rgb),0.08);
        padding: 0.45rem 0.5rem;
      }
      .cheh-sku-card summary { font-size: 0.75rem; text-transform: none; letter-spacing: 0; color: var(--text-normal); }
      .cheh-sku-card__body { margin-top: 0.35rem; display: grid; grid-template-columns: 190px 1fr; gap: 0.55rem; }
      .cheh-sku-card__img {
        width: 190px;
        max-width: 100%;
        border: 1px solid rgba(var(--section-rgb),0.3);
        border-radius: 8px;
        background: rgba(148,163,184,0.14);
      }
      .cheh-sku-card__meta { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; }
      .cheh-meta-box {
        border: 1px solid rgba(var(--section-rgb),0.26);
        border-radius: 8px;
        background: rgba(var(--section-rgb),0.06);
        padding: 0.42rem;
      }
      .cheh-meta-box__title {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: var(--text-muted);
        margin-bottom: 0.18rem;
      }
      .cheh-meta-box ul { margin: 0; padding-left: 0.95rem; }
      .cheh-meta-box li { font-size: 0.78rem; line-height: 1.28; }

      .cheh-table-wrap {
        margin-top: 0.45rem;
        overflow-x: auto;
        border: 1px solid rgba(var(--section-rgb),0.35);
        border-radius: 8px;
      }
      .cheh-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .cheh-table th,
      .cheh-table td {
        border: 1px solid rgba(var(--section-rgb),0.25);
        padding: 0.36rem 0.42rem;
        font-size: 0.77rem;
        line-height: 1.26;
        text-align: left;
        overflow-wrap: break-word;
      }
      .cheh-table th { background: rgba(var(--section-rgb),0.2); font-weight: 700; }

      .cheh-artifacts ul { margin: 0.25rem 0 0; padding-left: 1rem; }
      .cheh-artifacts li { font-size: 0.8rem; line-height: 1.28; }

      .cheh-final {
        border: 1px solid rgba(100,116,139,0.44);
        border-radius: 14px;
        background: rgba(15,23,42,0.12);
        padding: 0.9rem;
      }
      .cheh-final h3 { margin: 0 0 0.45rem 0; }
      .cheh-final ul { margin: 0; padding-left: 1.1rem; }
      .cheh-final li { margin-bottom: 0.16rem; line-height: 1.32; }

      .cheh-acceptance {
        border: 1px solid rgba(96,165,250,0.45);
        border-radius: 14px;
        background: linear-gradient(180deg, rgba(59,130,246,0.14), rgba(59,130,246,0.06));
        padding: 0.9rem;
        display: flex;
        flex-direction: column;
        gap: 0.72rem;
      }
      .cheh-acceptance__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .cheh-acceptance__title {
        margin: 0;
        font-size: 1rem;
      }
      .cheh-acceptance__muted {
        font-size: 0.8rem;
        color: var(--text-muted);
      }
      .cheh-acceptance__profiles,
      .cheh-acceptance__filters {
        display: flex;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .cheh-acceptance__profiles label,
      .cheh-acceptance__filters label {
        display: flex;
        flex-direction: column;
        gap: 0.18rem;
        font-size: 0.73rem;
        color: var(--text-muted);
      }
      .cheh-acceptance input[type=\"text\"],
      .cheh-acceptance select,
      .cheh-acceptance textarea {
        border: 1px solid rgba(96,165,250,0.4);
        border-radius: 8px;
        background: var(--background-primary);
        color: var(--text-normal);
        font-size: 0.78rem;
        padding: 0.28rem 0.4rem;
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      .cheh-acceptance textarea {
        min-height: 44px;
        resize: vertical;
      }
      .cheh-acceptance button {
        border: 1px solid rgba(96,165,250,0.55);
        border-radius: 8px;
        background: rgba(59,130,246,0.16);
        color: var(--text-normal);
        padding: 0.28rem 0.48rem;
        font-size: 0.75rem;
        cursor: pointer;
      }
      .cheh-acceptance button:hover {
        background: rgba(59,130,246,0.25);
      }
      .cheh-acceptance__status {
        display: inline-flex;
        align-items: center;
        border: 1px solid rgba(96,165,250,0.35);
        border-radius: 999px;
        padding: 0.06rem 0.44rem;
        font-size: 0.71rem;
      }
      .cheh-acceptance__status--done {
        border-color: rgba(34,197,94,0.7);
        background: rgba(34,197,94,0.16);
      }
      .cheh-acceptance__status--blocked {
        border-color: rgba(239,68,68,0.7);
        background: rgba(239,68,68,0.16);
      }
      .cheh-acceptance__status--in_progress {
        border-color: rgba(245,158,11,0.7);
        background: rgba(245,158,11,0.16);
      }
      .cheh-acceptance__status--todo {
        border-color: rgba(148,163,184,0.7);
        background: rgba(148,163,184,0.14);
      }
      .cheh-acceptance__row-hint {
        font-size: 0.72rem;
        color: var(--text-muted);
      }
      .cheh-acceptance__rec-list {
        display: flex;
        flex-direction: column;
        gap: 0.38rem;
      }
      .cheh-acceptance__rec-item {
        border: 1px solid rgba(96,165,250,0.3);
        border-radius: 8px;
        background: rgba(59,130,246,0.06);
        padding: 0.35rem;
        overflow: hidden;
      }
      .cheh-acceptance__rec-item-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.24rem;
      }
      .cheh-acceptance__rec-item-title {
        font-size: 0.73rem;
        font-weight: 700;
      }
      .cheh-acceptance__rec-source {
        margin-top: 0.2rem;
        font-size: 0.72rem;
        color: var(--text-muted);
        line-height: 1.3;
        overflow-wrap: anywhere;
      }
      .cheh-acceptance__rec-source-wrap {
        margin-top: 0.24rem;
      }
      .cheh-acceptance__rec-source-wrap summary {
        font-size: 0.7rem;
        text-transform: none;
        letter-spacing: 0;
      }
      .cheh-acceptance__rec-source-wrap > div {
        margin-top: 0.2rem;
        max-height: 120px;
        overflow: auto;
        padding-right: 0.2rem;
      }
      .cheh-acceptance__pager {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        flex-wrap: wrap;
      }
      .cheh-acceptance__msg {
        font-size: 0.72rem;
        min-height: 1rem;
        overflow-wrap: anywhere;
      }
      .cheh-acceptance__msg--error { color: #f87171; }
      .cheh-acceptance__msg--ok { color: #4ade80; }
      .cheh-acceptance__msg--warn { color: #fbbf24; }
      .cheh-acceptance__summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 0.45rem;
      }
      .cheh-acceptance__summary-item {
        border: 1px solid rgba(96,165,250,0.35);
        border-radius: 10px;
        background: rgba(59,130,246,0.09);
        padding: 0.42rem;
      }
      .cheh-acceptance__summary-k {
        font-size: 0.69rem;
        text-transform: uppercase;
        color: var(--text-muted);
      }
      .cheh-acceptance__summary-v {
        margin-top: 0.14rem;
        font-size: 0.88rem;
        font-weight: 700;
      }
      .cheh-acceptance__summary-sub {
        margin-top: 0.12rem;
        font-size: 0.72rem;
        color: var(--text-muted);
      }
      .cheh-acceptance__summary-bar {
        margin-top: 0.2rem;
        height: 8px;
        border-radius: 999px;
        background: rgba(148,163,184,0.26);
        overflow: hidden;
      }
      .cheh-acceptance__summary-bar-fill {
        height: 100%;
        width: 0;
      }
      .cheh-acceptance__summary-bar-fill--done {
        background: linear-gradient(90deg, #22c55e, #16a34a);
      }
      .cheh-acceptance__summary-bar-fill--progress {
        background: linear-gradient(90deg, #f59e0b, #f97316);
      }
      .cheh-acceptance__summary-bar-fill--danger {
        background: linear-gradient(90deg, #ef4444, #dc2626);
      }
      .cheh-acceptance__summary-bar-fill--info {
        background: linear-gradient(90deg, #38bdf8, #2563eb);
      }
      .cheh-acceptance__summary-note {
        grid-column: 1 / -1;
        border: 1px solid rgba(96,165,250,0.35);
        border-radius: 10px;
        background: rgba(59,130,246,0.08);
        padding: 0.45rem 0.5rem;
        font-size: 0.76rem;
        line-height: 1.35;
      }
      .cheh-acceptance__table td {
        vertical-align: top;
        overflow-wrap: anywhere;
      }
      .cheh-acceptance__table th:nth-child(1) { width: 17%; }
      .cheh-acceptance__table th:nth-child(2) { width: 13%; }
      .cheh-acceptance__table th:nth-child(3) { width: 14%; }
      .cheh-acceptance__table th:nth-child(4) { width: 19%; }
      .cheh-acceptance__table th:nth-child(5) { width: 21%; }
      .cheh-acceptance__table th:nth-child(6) { width: 16%; }
      .cheh-acceptance__table button {
        width: 100%;
      }
      .cheh-acceptance__link-btn {
        margin-top: 0.24rem;
        display: inline-flex;
      }

      @media (max-width: 860px) {
        .cheh-sku-card__body { grid-template-columns: 1fr; }
        .cheh-sku-card__meta { grid-template-columns: 1fr; }
        .cheh-acceptance__profiles,
        .cheh-acceptance__filters {
          flex-direction: column;
          align-items: stretch;
        }
      }
    `;
    document.head.appendChild(style);
  }

  ensureStyles();

  if (acceptanceEnabled) {
    try {
      await dv.view("views/lib/sku_acceptance_store");
      await dv.view("views/lib/sku_acceptance_model");
      await dv.view("views/lib/sku_profiles_store");
      AcceptanceStore = globalThis.SkuAcceptanceStore || null;
      AcceptanceModel = globalThis.SkuAcceptanceModel || null;
      ProfilesStore = globalThis.SkuProfilesStore || null;
      if (!AcceptanceStore || !AcceptanceModel || !ProfilesStore || !appCtx) {
        acceptanceEnabled = false;
      }
    } catch (error) {
      console.error("[SKU Dashboard] acceptance runtime load failed", error);
      acceptanceEnabled = false;
    }
  }

  const [sectionKpiText, deviceText, skuText, pathText, monthlyText, expertText] = await Promise.all([
    safeLoad(`${DATA_PATH}/section_kpi_summary.csv`),
    safeLoad(`${DATA_PATH}/section_device_summary.csv`),
    safeLoad(`${DATA_PATH}/sku_cards.csv`),
    safeLoad(`${DATA_PATH}/section_top_paths.csv`),
    safeLoad(`${DATA_PATH}/section_monthly_recent.csv`),
    safeLoad(`${DATA_PATH}/sku_photo_expert_comments.csv`)
  ]);

  const sectionKpiRows = parseCSV(sectionKpiText).map((r) => ({
    ...r,
    sku_count: toNum(r.sku_count),
    visits_all: toNum(r.visits_all),
    users_all: toNum(r.users_all),
    bounce_all: toNum(r.bounce_all),
    checkout_begin_all: toNum(r.checkout_begin_all),
    forms_all: toNum(r.forms_all),
    phone_all: toNum(r.phone_all),
    forms_cr_all_pct: toNum(r.forms_cr_all_pct),
    visits_recent: toNum(r.visits_recent),
    forms_recent: toNum(r.forms_recent),
    checkout_begin_recent: toNum(r.checkout_begin_recent),
    taste_avg: toNum(r.taste_avg)
  }));

  const deviceRows = parseCSV(deviceText).map((r) => ({
    ...r,
    visits: toNum(r.visits),
    users: toNum(r.users),
    forms: toNum(r.forms),
    checkout_begin: toNum(r.checkout_begin),
    phone: toNum(r.phone),
    forms_cr_pct: toNum(r.forms_cr_pct),
    period: String(r.period || ""),
    device: String(r.device || "")
  }));

  const skuRows = parseCSV(skuText).map((r) => ({
    ...r,
    price_rub: toNum(r.price_rub),
    appetite_score_data: toNum(r.appetite_score_data),
    image_quality_score: toNum(r.image_quality_score),
    food_styling_score: toNum(r.food_styling_score),
    img_brightness: toNum(r.img_brightness),
    img_contrast: toNum(r.img_contrast),
    image_width: toNum(r.image_width),
    image_height: toNum(r.image_height)
  }));

  const pathRows = parseCSV(pathText).map((r) => ({
    ...r,
    visits: toNum(r.visits),
    users: toNum(r.users),
    forms: toNum(r.forms),
    checkout_begin: toNum(r.checkout_begin),
    phone: toNum(r.phone),
    forms_cr_pct: toNum(r.forms_cr_pct)
  }));

  const monthlyRows = parseCSV(monthlyText).map((r) => ({
    ...r,
    visits: toNum(r.visits),
    forms: toNum(r.forms),
    checkout_begin: toNum(r.checkout_begin),
    phone: toNum(r.phone),
    forms_cr_pct: toNum(r.forms_cr_pct)
  }));

  const expertRows = parseCSV(expertText).map((r) => ({
    ...r,
    appetite_score_data: toNum(r.appetite_score_data),
    image_quality_score: toNum(r.image_quality_score),
    food_styling_score: toNum(r.food_styling_score)
  }));

  const expertBySku = new Map(expertRows.map((r) => [r.sku_id, r]));
  const imageDupMapGlobal = new Map();
  for (const row of skuRows) {
    const key = String(row.image_url || "").trim();
    if (!key.length) continue;
    imageDupMapGlobal.set(key, (imageDupMapGlobal.get(key) || 0) + 1);
  }

  const recommendationKeysBySku = {};
  const recommendationItemsBySku = {};
  for (const card of skuRows) {
    const expert = expertBySku.get(card.sku_id);
    const dupCount = imageDupMapGlobal.get(String(card.image_url || "").trim()) || 0;
    const fallbackComments = commentsForCard(card, dupCount);
    const items = acceptanceEnabled
      ? AcceptanceModel.buildRecommendationItems({
          skuId: card.sku_id,
          expertRow: expert,
          fallbackComments
        })
      : [];
    recommendationItemsBySku[card.sku_id] = items;
    recommendationKeysBySku[card.sku_id] = acceptanceEnabled
      ? items.map((item) => item.key)
      : [];
  }

  const cardAcceptanceNodes = new Map();
  let acceptanceState = { schema_version: 1, updated_at: "", sku_acceptance: {} };
  let acceptanceFile = null;

  const defaultFilterState = {
    section: "all",
    status: "all",
    compliance: "all",
    blockers: "all",
    text: "",
    owner: "",
    page: 1,
    pageSize: ACCEPTANCE_PAGE_SIZE_OPTIONS[0]
  };

  let acceptanceProfiles = {
    default: {
      filters: deepCopy(defaultFilterState),
      updated_at: ""
    }
  };
  let activeProfileName = "default";
  let filterState = deepCopy(defaultFilterState);

  if (acceptanceEnabled) {
    try {
      const bundle = await AcceptanceStore.load(
        appCtx,
        ACCEPTANCE_STATE_PATH,
        recommendationKeysBySku
      );
      acceptanceFile = bundle.file;
      acceptanceState = bundle.state;

      const localAcceptance = loadLocalJson(ACCEPTANCE_LOCAL_KEY);
      if (localAcceptance && typeof localAcceptance === "object") {
        acceptanceState = AcceptanceStore.normalizeState(
          localAcceptance,
          recommendationKeysBySku
        );
      }

      let stateChanged = false;
      for (const card of skuRows) {
        if (!acceptanceState.sku_acceptance[card.sku_id]) {
          acceptanceState.sku_acceptance[card.sku_id] = AcceptanceStore.createDefaultEntry(
            recommendationKeysBySku[card.sku_id] || []
          );
          stateChanged = true;
        }
      }
      if (stateChanged) {
        acceptanceState.updated_at = AcceptanceStore.nowIso();
        saveLocalJson(ACCEPTANCE_LOCAL_KEY, acceptanceState);
        if (PERSIST_TO_FILE) {
          await AcceptanceStore.save(
            appCtx,
            ACCEPTANCE_STATE_PATH,
            acceptanceState,
            acceptanceFile
          );
        }
      }
    } catch (error) {
      console.error("[SKU Dashboard] acceptance state load failed", error);
      acceptanceEnabled = false;
    }
  }

  if (acceptanceEnabled) {
    try {
      const profileBundle = await ProfilesStore.load(
        appCtx,
        PROFILE_STATE_PATH,
        defaultFilterState
      );
      acceptanceProfiles = profileBundle.profiles || acceptanceProfiles;
      activeProfileName = profileBundle.activeName || "default";

      const localProfiles = loadLocalJson(PROFILE_LOCAL_KEY);
      if (localProfiles && typeof localProfiles === "object") {
        if (localProfiles.profiles && typeof localProfiles.profiles === "object") {
          acceptanceProfiles = localProfiles.profiles;
        }
        if (typeof localProfiles.activeName === "string" && localProfiles.activeName.length) {
          activeProfileName = localProfiles.activeName;
        }
      }

      if (!acceptanceProfiles[activeProfileName]) activeProfileName = "default";
      const activeFilters = acceptanceProfiles[activeProfileName]
        ? acceptanceProfiles[activeProfileName].filters
        : defaultFilterState;
      filterState = { ...deepCopy(defaultFilterState), ...deepCopy(activeFilters || {}) };
      filterState.page = Number.isFinite(Number(filterState.page)) ? Number(filterState.page) : 1;
      filterState.pageSize = Number.isFinite(Number(filterState.pageSize))
        ? Number(filterState.pageSize)
        : defaultFilterState.pageSize;
      if (ACCEPTANCE_PAGE_SIZE_OPTIONS.indexOf(filterState.pageSize) === -1) {
        filterState.pageSize = defaultFilterState.pageSize;
      }
    } catch (error) {
      console.error("[SKU Dashboard] profiles load failed", error);
      acceptanceProfiles = {
        default: { filters: deepCopy(defaultFilterState), updated_at: "" }
      };
      activeProfileName = "default";
      filterState = deepCopy(defaultFilterState);
    }
  }

  if (acceptanceEnabled) {
    saveLocalJson(ACCEPTANCE_LOCAL_KEY, acceptanceState);
    saveLocalJson(PROFILE_LOCAL_KEY, {
      profiles: acceptanceProfiles,
      activeName: activeProfileName
    });
  }

  const sectionMap = new Map(sectionKpiRows.map((r) => [r.section, r]));
  const skuBySection = new Map();
  const deviceBySection = new Map();
  const pathBySection = new Map();
  const monthlyBySection = new Map();

  for (const sec of SECTION_ORDER) {
    skuBySection.set(sec, skuRows.filter((r) => r.section === sec));
    deviceBySection.set(sec, deviceRows.filter((r) => r.section === sec));
    pathBySection.set(sec, pathRows.filter((r) => r.section === sec));
    monthlyBySection.set(sec, monthlyRows.filter((r) => r.section === sec));
  }

  const totalSku = sectionKpiRows.reduce((sum, r) => sum + r.sku_count, 0);
  const totalVisits = sectionKpiRows.reduce((sum, r) => sum + r.visits_all, 0);
  const totalForms = sectionKpiRows.reduce((sum, r) => sum + r.forms_all, 0);
  const totalCheckout = sectionKpiRows.reduce((sum, r) => sum + r.checkout_begin_all, 0);

  const sectionLabel = (key) => SECTION_LABELS[key] || key;

  const recommendationKeysForSku = (skuId) =>
    recommendationKeysBySku[skuId] && recommendationKeysBySku[skuId].length
      ? recommendationKeysBySku[skuId]
      : AcceptanceModel
      ? AcceptanceModel.DEFAULT_RECOMMENDATION_KEYS
      : [];

  const ensureAcceptanceEntry = (skuId) => {
    if (!acceptanceEnabled) return null;
    const keys = recommendationKeysForSku(skuId);
    if (!acceptanceState.sku_acceptance[skuId]) {
      acceptanceState.sku_acceptance[skuId] = AcceptanceStore.createDefaultEntry(keys);
    }
    const normalized = AcceptanceStore.normalizeEntry(acceptanceState.sku_acceptance[skuId], keys);
    acceptanceState.sku_acceptance[skuId] = normalized;
    return normalized;
  };

  const summarizeAcceptanceEntry = (skuId) => {
    if (!acceptanceEnabled) return null;
    const entry = ensureAcceptanceEntry(skuId);
    return AcceptanceModel.summarizeSkuEntry(entry, recommendationKeysForSku(skuId));
  };

  const statusBadgeClass = (status) => {
    const safe = String(status || "todo");
    return `cheh-acceptance__status cheh-acceptance__status--${safe}`;
  };

  const statusLabel = (status) =>
    ACCEPTANCE_STATUS_LABELS[String(status || "todo")] || String(status || "todo");

  const saveAcceptanceState = async (opts = {}) => {
    if (!acceptanceEnabled) return;
    acceptanceState.updated_at = AcceptanceStore.nowIso();
    saveLocalJson(ACCEPTANCE_LOCAL_KEY, acceptanceState);
    if (PERSIST_TO_FILE || opts.forceFile === true) {
      await AcceptanceStore.save(appCtx, ACCEPTANCE_STATE_PATH, acceptanceState, acceptanceFile);
    }
  };

  const persistProfiles = async (opts = {}) => {
    if (!acceptanceEnabled) return;
    saveLocalJson(PROFILE_LOCAL_KEY, {
      profiles: acceptanceProfiles,
      activeName: activeProfileName
    });
    if (PERSIST_TO_FILE || opts.forceFile === true) {
      await ProfilesStore.save(
        appCtx,
        PROFILE_STATE_PATH,
        acceptanceProfiles,
        activeProfileName
      );
    }
  };

  const refreshCardAcceptanceWidget = (skuId) => {
    if (!acceptanceEnabled) return;
    const refs = cardAcceptanceNodes.get(skuId);
    if (!refs) return;
    const summary = summarizeAcceptanceEntry(skuId);
    if (!summary) return;
    refs.status.className = statusBadgeClass(summary.status);
    refs.status.textContent = statusLabel(summary.status);
    refs.progress.textContent = `Прогресс рекомендаций: ${
      summary.recommendations_done + summary.recommendations_skip
    }/${summary.recommendations_total}`;
    refs.blockers.textContent = `Блокеры: ${summary.recommendations_blocked || 0}`;
    refs.owner.textContent = `Owner: ${summary.owner || "не назначен"}`;
    refs.comment.textContent = `Комментарий: ${summary.summary_comment || "—"}`;
  };

  const refreshAllCardAcceptanceWidgets = () => {
    if (!acceptanceEnabled) return;
    for (const card of skuRows) {
      refreshCardAcceptanceWidget(card.sku_id);
    }
  };

  const root = dv.el("div", "", { cls: "cheh-sku-dashboard" });

  const kpi = root.appendChild(document.createElement("section"));
  kpi.className = "cheh-kpi-grid";
  const kpiItems = [
    ["Разделов меню", String(sectionKpiRows.length)],
    ["SKU карточек", String(totalSku)],
    ["Визитов по SKU-разделам", String(Math.round(totalVisits))],
    ["Форм заказа", String(Math.round(totalForms))],
    ["Checkout begin", String(Math.round(totalCheckout))]
  ];
  for (const [label, value] of kpiItems) {
    const card = kpi.appendChild(document.createElement("article"));
    card.className = "cheh-kpi";
    const l = card.appendChild(document.createElement("div"));
    l.className = "cheh-kpi__label";
    l.textContent = label;
    const v = card.appendChild(document.createElement("div"));
    v.className = "cheh-kpi__value";
    v.textContent = value;
  }

  const story = root.appendChild(document.createElement("section"));
  story.className = "cheh-story";
  const storyTitle = story.appendChild(document.createElement("div"));
  storyTitle.className = "cheh-story__title";
  storyTitle.textContent = "Смотрим исследование шаг за шагом";
  const storyList = story.appendChild(document.createElement("ol"));
  storyList.className = "cheh-story__list";
  [
    "Понимаем, где больше всего карточек и трафика.",
    "Потом открываем раздел и видим 5 интервалов карточек по оценке.",
    "Внутри интервала открываем карточку и читаем все детали: мета, источники, комментарии.",
    "Отдельно открываем метрики раздела: устройства, пути, месяцы.",
    "И только потом делаем выводы и план обратной связи."
  ].forEach((line) => {
    const li = storyList.appendChild(document.createElement("li"));
    li.textContent = line;
  });

  const decisionAlgoTitle = story.appendChild(document.createElement("div"));
  decisionAlgoTitle.className = "cheh-story__subtitle";
  decisionAlgoTitle.textContent = "Алгоритм принятия выводов";
  const decisionAlgo = story.appendChild(document.createElement("ol"));
  decisionAlgo.className = "cheh-story__algo";
  [
    "Фиксируем срез: выбранный период, раздел, SKU и базовые сигналы (визиты, формы, checkout).",
    "Проверяем качество карточки: score, фото, описание, дубли и экспертные комментарии.",
    "Сверяем коммерческий риск: где трафик есть, а конверсионный сигнал слабый или не измеряется.",
    "Формулируем вывод в формате: проблема -> причина -> ожидаемый эффект и метрика контроля.",
    "Переводим вывод в задачу SKU и привязываем owner, срок и критерий приемки."
  ].forEach((line) => {
    const li = decisionAlgo.appendChild(document.createElement("li"));
    li.textContent = line;
  });

  const planAlgoTitle = story.appendChild(document.createElement("div"));
  planAlgoTitle.className = "cheh-story__subtitle";
  planAlgoTitle.textContent = "Алгоритм работы с планом и механикой задач";
  const planAlgo = story.appendChild(document.createElement("ol"));
  planAlgo.className = "cheh-story__algo";
  [
    "Декомпозируем рекомендации: одна рекомендация = одна управляемая подзадача внутри SKU.",
    "Для каждой подзадачи проставляем состояние: todo, in_progress, done, blocked или skip.",
    "Для blocked и skip комментарий обязателен: фиксируем причину, что мешает и следующий шаг.",
    "Статус SKU переводим в done только когда все рекомендации в done или skip и нет блокеров.",
    "Назначаем owner и комментарий по SKU, затем сохраняем: состояние фиксируется в профиле и state-файле."
  ].forEach((line) => {
    const li = planAlgo.appendChild(document.createElement("li"));
    li.textContent = line;
  });

  if (totalCheckout === 0) {
    const alert = root.appendChild(document.createElement("div"));
    alert.className = "cheh-alert";
    alert.textContent =
      "Главный факт: add_to_cart/checkout по SKU не измеряется системно. Значит сначала донастраиваем трекинг, потом оптимизируем конверсию.";
  }

  if (acceptanceEnabled) {
    const acceptanceSection = root.appendChild(document.createElement("section"));
    acceptanceSection.className = "cheh-acceptance";

    const acceptanceHead = acceptanceSection.appendChild(document.createElement("div"));
    acceptanceHead.className = "cheh-acceptance__head";
    const acceptanceTitle = acceptanceHead.appendChild(document.createElement("h3"));
    acceptanceTitle.className = "cheh-acceptance__title";
    acceptanceTitle.textContent = "Приемка по SKU: статус, рекомендации, комментарии";
    const acceptanceMeta = acceptanceHead.appendChild(document.createElement("div"));
    acceptanceMeta.className = "cheh-acceptance__muted";
    acceptanceMeta.textContent = `State: ${ACCEPTANCE_STATE_PATH} | Profiles: ${PROFILE_STATE_PATH} | auto file sync: ${
      PERSIST_TO_FILE ? "on" : "off"
    }`;

    const acceptanceSummaryGrid = acceptanceSection.appendChild(document.createElement("div"));
    acceptanceSummaryGrid.className = "cheh-acceptance__summary";

    const profilesRow = acceptanceSection.appendChild(document.createElement("div"));
    profilesRow.className = "cheh-acceptance__profiles";

    const profileLabel = profilesRow.appendChild(document.createElement("label"));
    profileLabel.textContent = "Профиль";
    const profileSelect = profileLabel.appendChild(document.createElement("select"));

    const profileNameLabel = profilesRow.appendChild(document.createElement("label"));
    profileNameLabel.textContent = "Имя профиля";
    const profileNameInput = profileNameLabel.appendChild(document.createElement("input"));
    profileNameInput.type = "text";
    profileNameInput.placeholder = "qa_weekly";
    profileNameInput.value = activeProfileName;

    const profileLoadButton = profilesRow.appendChild(document.createElement("button"));
    profileLoadButton.type = "button";
    profileLoadButton.textContent = "Загрузить";
    const profileSaveButton = profilesRow.appendChild(document.createElement("button"));
    profileSaveButton.type = "button";
    profileSaveButton.textContent = "Сохранить";
    const profileDeleteButton = profilesRow.appendChild(document.createElement("button"));
    profileDeleteButton.type = "button";
    profileDeleteButton.textContent = "Удалить";
    const syncFileButton = profilesRow.appendChild(document.createElement("button"));
    syncFileButton.type = "button";
    syncFileButton.textContent = "Синхр. файл";
    const syncInfo = profilesRow.appendChild(document.createElement("div"));
    syncInfo.className = "cheh-acceptance__msg";
    syncInfo.style.minWidth = "220px";
    syncInfo.style.alignSelf = "center";

    const filtersRow = acceptanceSection.appendChild(document.createElement("div"));
    filtersRow.className = "cheh-acceptance__filters";

    const makeFilterField = (label, control) => {
      const wrap = filtersRow.appendChild(document.createElement("label"));
      wrap.textContent = label;
      wrap.appendChild(control);
      return control;
    };

    const sectionFilter = document.createElement("select");
    [{ value: "all", label: "Все разделы" }]
      .concat(SECTION_ORDER.map((key) => ({ value: key, label: sectionLabel(key) })))
      .forEach((option) => {
        const opt = document.createElement("option");
        opt.value = option.value;
        opt.textContent = option.label;
        sectionFilter.appendChild(opt);
      });
    makeFilterField("Раздел", sectionFilter);

    const statusFilter = document.createElement("select");
    [
      { value: "all", label: "Любой статус" },
      { value: "todo", label: ACCEPTANCE_STATUS_LABELS.todo },
      { value: "in_progress", label: ACCEPTANCE_STATUS_LABELS.in_progress },
      { value: "done", label: ACCEPTANCE_STATUS_LABELS.done },
      { value: "blocked", label: ACCEPTANCE_STATUS_LABELS.blocked }
    ].forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      statusFilter.appendChild(opt);
    });
    makeFilterField("Статус", statusFilter);

    const complianceFilter = document.createElement("select");
    [
      { value: "all", label: "Любая применимость" },
      { value: "all_applied", label: "Все рекомендации применены" },
      { value: "not_all_applied", label: "Не все рекомендации применены" }
    ].forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      complianceFilter.appendChild(opt);
    });
    makeFilterField("Комплаенс", complianceFilter);

    const blockersFilter = document.createElement("select");
    [
      { value: "all", label: "Блокеры: любой" },
      { value: "with", label: "Есть блокеры" },
      { value: "without", label: "Без блокеров" }
    ].forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option.value;
      opt.textContent = option.label;
      blockersFilter.appendChild(opt);
    });
    makeFilterField("Блокеры", blockersFilter);

    const textFilter = document.createElement("input");
    textFilter.type = "text";
    textFilter.placeholder = "SKU, название, комментарий";
    makeFilterField("Поиск", textFilter);

    const ownerFilter = document.createElement("input");
    ownerFilter.type = "text";
    ownerFilter.placeholder = "@owner";
    makeFilterField("Owner", ownerFilter);

    const pageSizeFilter = document.createElement("select");
    ACCEPTANCE_PAGE_SIZE_OPTIONS.forEach((value) => {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = String(value);
      pageSizeFilter.appendChild(opt);
    });
    makeFilterField("На странице", pageSizeFilter);

    const resetFiltersButton = filtersRow.appendChild(document.createElement("button"));
    resetFiltersButton.type = "button";
    resetFiltersButton.textContent = "Сброс фильтров";

    const pagerRow = acceptanceSection.appendChild(document.createElement("div"));
    pagerRow.className = "cheh-acceptance__pager";
    const pagerPrev = pagerRow.appendChild(document.createElement("button"));
    pagerPrev.type = "button";
    pagerPrev.textContent = "<";
    const pagerInfo = pagerRow.appendChild(document.createElement("span"));
    pagerInfo.className = "cheh-acceptance__muted";
    const pagerNext = pagerRow.appendChild(document.createElement("button"));
    pagerNext.type = "button";
    pagerNext.textContent = ">";

    const tableWrap = acceptanceSection.appendChild(document.createElement("div"));
    tableWrap.className = "cheh-table-wrap";
    const table = tableWrap.appendChild(document.createElement("table"));
    table.className = "cheh-table cheh-acceptance__table";
    const tableHead = table.appendChild(document.createElement("thead"));
    const headRow = tableHead.appendChild(document.createElement("tr"));
    ["SKU", "Раздел", "Статус", "Рекомендации", "Owner + комментарий", "Действия"].forEach((title) => {
      const th = headRow.appendChild(document.createElement("th"));
      th.textContent = title;
    });
    const tableBody = table.appendChild(document.createElement("tbody"));

    const applyProfileToFilters = (profileName) => {
      const profile = acceptanceProfiles[profileName];
      if (!profile || !profile.filters) return;
      const next = { ...deepCopy(defaultFilterState), ...deepCopy(profile.filters) };
      filterState = next;
      sectionFilter.value = String(next.section || "all");
      statusFilter.value = String(next.status || "all");
      complianceFilter.value = String(next.compliance || "all");
      blockersFilter.value = String(next.blockers || "all");
      textFilter.value = String(next.text || "");
      ownerFilter.value = String(next.owner || "");
      pageSizeFilter.value = String(next.pageSize || defaultFilterState.pageSize);
      profileNameInput.value = profileName;
      activeProfileName = profileName;
    };

    const captureFiltersFromUi = () => {
      filterState.section = sectionFilter.value || "all";
      filterState.status = statusFilter.value || "all";
      filterState.compliance = complianceFilter.value || "all";
      filterState.blockers = blockersFilter.value || "all";
      filterState.text = String(textFilter.value || "").trim();
      filterState.owner = String(ownerFilter.value || "").trim();
      filterState.pageSize = Number(pageSizeFilter.value || defaultFilterState.pageSize);
      if (ACCEPTANCE_PAGE_SIZE_OPTIONS.indexOf(filterState.pageSize) === -1) {
        filterState.pageSize = defaultFilterState.pageSize;
      }
      if (!Number.isFinite(Number(filterState.page)) || Number(filterState.page) < 1) {
        filterState.page = 1;
      }
    };

    const buildAcceptanceRows = () =>
      skuRows.map((card) => {
        const entry = ensureAcceptanceEntry(card.sku_id);
        const summary = summarizeAcceptanceEntry(card.sku_id);
        return {
          card,
          entry,
          summary,
          section_label: sectionLabel(card.section),
          score: toNum(card.appetite_score_data),
          search: `${card.sku_id || ""} ${card.name || ""} ${entry.owner || ""} ${entry.summary_comment || ""}`.toLowerCase()
        };
      });

    const matchRowByFilters = (row) => {
      if (filterState.section !== "all" && row.card.section !== filterState.section) return false;
      if (filterState.status !== "all" && row.summary.status !== filterState.status) return false;

      if (filterState.compliance === "all_applied" && !row.summary.all_recommendations_applied) return false;
      if (filterState.compliance === "not_all_applied" && row.summary.all_recommendations_applied) return false;

      if (filterState.blockers === "with" && !row.summary.has_blockers) return false;
      if (filterState.blockers === "without" && row.summary.has_blockers) return false;

      if (filterState.owner.length) {
        if (!String(row.summary.owner || "").toLowerCase().includes(filterState.owner.toLowerCase())) return false;
      }

      if (filterState.text.length) {
        if (!row.search.includes(filterState.text.toLowerCase())) return false;
      }
      return true;
    };

    const renderAcceptanceSummary = (rows) => {
      acceptanceSummaryGrid.innerHTML = "";
      const skuIds = rows.map((row) => row.card.sku_id);
      const summary = AcceptanceStore.summarize(acceptanceState, skuIds, recommendationKeysBySku);
      const skuTotal = summary.totalSku || 0;
      const recTotal = summary.recommendations.total || 0;
      const recDone = summary.recommendations.done || 0;
      const recSkip = summary.recommendations.skip || 0;
      const recTodo = summary.recommendations.todo || 0;
      const recBlocked = summary.recommendations.blocked || 0;
      const recApplied = recDone + recSkip;
      const skuDone = summary.status.done || 0;
      const skuInProgress = summary.status.in_progress || 0;
      const skuBlocked = summary.status.blocked || 0;
      const skuTodo = summary.status.todo || 0;
      const skuFullApplied = summary.allRecommendationsApplied || 0;
      const remainingActions = recTodo + recBlocked;

      const toPct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
      const pct = (part, total) => `${toPct(part, total)}%`;

      const makeCard = ({ title, value, sub, ratio, tone }) => {
        const card = acceptanceSummaryGrid.appendChild(document.createElement("div"));
        card.className = "cheh-acceptance__summary-item";

        const keyNode = card.appendChild(document.createElement("div"));
        keyNode.className = "cheh-acceptance__summary-k";
        keyNode.textContent = title;

        const valNode = card.appendChild(document.createElement("div"));
        valNode.className = "cheh-acceptance__summary-v";
        valNode.textContent = value;

        const subNode = card.appendChild(document.createElement("div"));
        subNode.className = "cheh-acceptance__summary-sub";
        subNode.textContent = sub;

        const bar = card.appendChild(document.createElement("div"));
        bar.className = "cheh-acceptance__summary-bar";
        const fill = bar.appendChild(document.createElement("div"));
        fill.className = `cheh-acceptance__summary-bar-fill cheh-acceptance__summary-bar-fill--${
          tone || "info"
        }`;
        fill.style.width = `${Math.round(clamp((ratio || 0) * 100, 0, 100))}%`;
      };

      makeCard({
        title: "SKU принято",
        value: `${skuDone}/${skuTotal}`,
        sub: `Доля принятия: ${pct(skuDone, skuTotal)}`,
        ratio: skuTotal ? skuDone / skuTotal : 0,
        tone: "done"
      });
      makeCard({
        title: "SKU в работе",
        value: `${skuInProgress}/${skuTotal}`,
        sub: `Текущая нагрузка: ${pct(skuInProgress, skuTotal)}`,
        ratio: skuTotal ? skuInProgress / skuTotal : 0,
        tone: "progress"
      });
      makeCard({
        title: "SKU с блокером",
        value: `${skuBlocked}/${skuTotal}`,
        sub: `Критичность: ${pct(skuBlocked, skuTotal)}`,
        ratio: skuTotal ? skuBlocked / skuTotal : 0,
        tone: "danger"
      });
      makeCard({
        title: "Рекомендации применены",
        value: `${recApplied}/${recTotal}`,
        sub: `Покрытие рекомендаций: ${pct(recApplied, recTotal)}`,
        ratio: recTotal ? recApplied / recTotal : 0,
        tone: "done"
      });
      makeCard({
        title: "SKU с полным комплаенсом",
        value: `${skuFullApplied}/${skuTotal}`,
        sub: `Все рекомендации применены`,
        ratio: skuTotal ? skuFullApplied / skuTotal : 0,
        tone: "info"
      });
      makeCard({
        title: "Осталось действий",
        value: String(remainingActions),
        sub: `todo ${recTodo} | blocked ${recBlocked}`,
        ratio: recTotal ? remainingActions / recTotal : 0,
        tone: recBlocked > 0 ? "danger" : "progress"
      });

      const sectionStats = new Map();
      for (const row of rows) {
        const key = row.card.section || "other";
        if (!sectionStats.has(key)) {
          sectionStats.set(key, { total: 0, done: 0, blocked: 0, in_progress: 0, todo: 0 });
        }
        const stat = sectionStats.get(key);
        stat.total += 1;
        const status = String(row.summary.status || "todo");
        if (status === "done") stat.done += 1;
        if (status === "blocked") stat.blocked += 1;
        if (status === "in_progress") stat.in_progress += 1;
        if (status === "todo") stat.todo += 1;
      }

      const sectionList = Array.from(sectionStats.entries()).map(([key, stat]) => ({
        key,
        label: sectionLabel(key),
        ...stat,
        doneRatio: stat.total > 0 ? stat.done / stat.total : 0
      }));
      sectionList.sort((a, b) => {
        if (a.doneRatio !== b.doneRatio) return a.doneRatio - b.doneRatio;
        if (a.blocked !== b.blocked) return b.blocked - a.blocked;
        return a.label.localeCompare(b.label, "ru", { sensitivity: "base" });
      });

      const worst = sectionList[0];
      const note = acceptanceSummaryGrid.appendChild(document.createElement("div"));
      note.className = "cheh-acceptance__summary-note";
      note.textContent = worst
        ? `Фокус: ${worst.label}. Принято ${worst.done}/${worst.total} (${pct(
            worst.done,
            worst.total
          )}), blocked ${worst.blocked}, в работе ${worst.in_progress}, к выполнению ${worst.todo}.`
        : "Фокус: нет данных в текущем срезе.";
    };

    const renderProfilesSelect = () => {
      profileSelect.innerHTML = "";
      const names = Object.keys(acceptanceProfiles).sort((a, b) => a.localeCompare(b));
      if (!names.length) {
        acceptanceProfiles.default = { filters: deepCopy(defaultFilterState), updated_at: "" };
      }
      const safeNames = Object.keys(acceptanceProfiles).sort((a, b) => a.localeCompare(b));
      for (const name of safeNames) {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name === activeProfileName ? `${name} (active)` : name;
        profileSelect.appendChild(opt);
      }
      if (!acceptanceProfiles[activeProfileName]) {
        activeProfileName = safeNames[0];
      }
      profileSelect.value = activeProfileName;
      profileNameInput.value = activeProfileName;
    };

    const renderTable = async () => {
      captureFiltersFromUi();
      const allRows = buildAcceptanceRows()
        .filter(matchRowByFilters)
        .sort((a, b) => {
          const secA = SECTION_ORDER.indexOf(a.card.section);
          const secB = SECTION_ORDER.indexOf(b.card.section);
          const ordA = secA === -1 ? 999 : secA;
          const ordB = secB === -1 ? 999 : secB;
          if (ordA !== ordB) return ordA - ordB;
          if (a.score !== b.score) return a.score - b.score;
          return String(a.card.sku_id || "").localeCompare(String(b.card.sku_id || ""), "ru", {
            sensitivity: "base"
          });
        });

      const total = allRows.length;
      const pageSize = filterState.pageSize || defaultFilterState.pageSize;
      const maxPage = Math.max(1, Math.ceil(total / pageSize));
      filterState.page = clamp(Number(filterState.page || 1), 1, maxPage);

      const start = (filterState.page - 1) * pageSize;
      const pageRows = allRows.slice(start, start + pageSize);
      pagerInfo.textContent = `Страница ${filterState.page}/${maxPage} | записей ${total}`;

      tableBody.innerHTML = "";
      for (const row of pageRows) {
        const tr = tableBody.appendChild(document.createElement("tr"));
        tr.dataset.skuRow = row.card.sku_id;

        const skuCell = tr.appendChild(document.createElement("td"));
        const skuStrong = skuCell.appendChild(document.createElement("div"));
        skuStrong.style.fontWeight = "700";
        skuStrong.textContent = `${row.card.sku_id} | ${row.card.name || "Без названия"}`;
        const skuHint = skuCell.appendChild(document.createElement("div"));
        skuHint.className = "cheh-acceptance__row-hint";
        skuHint.textContent = `score ${row.score.toFixed(2)} | цена ${
          row.card.price_rub ? `${Math.round(row.card.price_rub)} ₽` : "не указана"
        }`;
        const openCardBtn = skuCell.appendChild(document.createElement("button"));
        openCardBtn.type = "button";
        openCardBtn.className = "cheh-acceptance__link-btn";
        openCardBtn.textContent = "К карточке";
        openCardBtn.addEventListener("click", () => {
          const cardNode = document.querySelector(`[data-sku-card='${row.card.sku_id}']`);
          if (cardNode) {
            let cursor = cardNode.parentElement;
            while (cursor) {
              if (cursor.tagName === "DETAILS") cursor.open = true;
              cursor = cursor.parentElement;
            }
            cardNode.open = true;
            cardNode.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        });

        const sectionCell = tr.appendChild(document.createElement("td"));
        sectionCell.textContent = row.section_label;

        const statusCell = tr.appendChild(document.createElement("td"));
        const statusSelect = statusCell.appendChild(document.createElement("select"));
        [
          { value: "todo", label: ACCEPTANCE_STATUS_LABELS.todo },
          { value: "in_progress", label: ACCEPTANCE_STATUS_LABELS.in_progress },
          { value: "done", label: ACCEPTANCE_STATUS_LABELS.done },
          { value: "blocked", label: ACCEPTANCE_STATUS_LABELS.blocked }
        ].forEach((option) => {
          const opt = document.createElement("option");
          opt.value = option.value;
          opt.textContent = option.label;
          statusSelect.appendChild(opt);
        });
        statusSelect.value = row.summary.status || "todo";
        const statusBadge = statusCell.appendChild(document.createElement("span"));
        statusBadge.className = statusBadgeClass(row.summary.status);
        statusBadge.textContent = statusLabel(row.summary.status);
        statusSelect.addEventListener("change", () => {
          statusBadge.className = statusBadgeClass(statusSelect.value);
          statusBadge.textContent = statusLabel(statusSelect.value);
        });

        const recCell = tr.appendChild(document.createElement("td"));
        const recTop = recCell.appendChild(document.createElement("div"));
        recTop.className = "cheh-acceptance__row-hint";
        recTop.textContent = `Прогресс ${row.summary.recommendations_done + row.summary.recommendations_skip}/${
          row.summary.recommendations_total
        } | blocked ${row.summary.recommendations_blocked}`;
        const recDetails = recCell.appendChild(document.createElement("details"));
        const recSummary = recDetails.appendChild(document.createElement("summary"));
        recSummary.textContent = "Редактировать рекомендации";
        const recList = recDetails.appendChild(document.createElement("div"));
        recList.className = "cheh-acceptance__rec-list";

        const recommendationControls = [];
        const recommendationItems = recommendationItemsBySku[row.card.sku_id] || [];
        for (const item of recommendationItems) {
          const recEntry = row.entry.recommendations[item.key] || {
            state: "todo",
            comment: "",
            updated_at: ""
          };
          const recNode = recList.appendChild(document.createElement("div"));
          recNode.className = "cheh-acceptance__rec-item";
          const recHead = recNode.appendChild(document.createElement("div"));
          recHead.className = "cheh-acceptance__rec-item-head";
          const recTitle = recHead.appendChild(document.createElement("div"));
          recTitle.className = "cheh-acceptance__rec-item-title";
          recTitle.textContent = item.label;
          const recState = recHead.appendChild(document.createElement("select"));
          [
            { value: "todo", label: "todo" },
            { value: "done", label: "done" },
            { value: "skip", label: "skip" },
            { value: "blocked", label: "blocked" }
          ].forEach((option) => {
            const opt = document.createElement("option");
            opt.value = option.value;
            opt.textContent = option.label;
            recState.appendChild(opt);
          });
          recState.value = recEntry.state || "todo";

          const recComment = recNode.appendChild(document.createElement("textarea"));
          recComment.placeholder = "Комментарий по рекомендации (обязательно для skip/blocked)";
          recComment.value = recEntry.comment || "";

          if (item.source_text) {
            const recSourceWrap = recNode.appendChild(document.createElement("details"));
            recSourceWrap.className = "cheh-acceptance__rec-source-wrap";
            const recSourceSummary = recSourceWrap.appendChild(document.createElement("summary"));
            recSourceSummary.textContent = "Источник рекомендации";
            const recSource = recSourceWrap.appendChild(document.createElement("div"));
            recSource.className = "cheh-acceptance__rec-source";
            recSource.textContent = item.source_text;
          }

          recommendationControls.push({
            key: item.key,
            stateSelect: recState,
            commentInput: recComment
          });
        }

        const ownerCell = tr.appendChild(document.createElement("td"));
        const ownerInput = ownerCell.appendChild(document.createElement("input"));
        ownerInput.type = "text";
        ownerInput.placeholder = "@owner";
        ownerInput.value = row.summary.owner || "";
        const commentInput = ownerCell.appendChild(document.createElement("textarea"));
        commentInput.placeholder = "Комментарий по задаче";
        commentInput.value = row.summary.summary_comment || "";

        const actionCell = tr.appendChild(document.createElement("td"));
        const saveButton = actionCell.appendChild(document.createElement("button"));
        saveButton.type = "button";
        saveButton.textContent = "Сохранить";
        const msg = actionCell.appendChild(document.createElement("div"));
        msg.className = "cheh-acceptance__msg";

        saveButton.addEventListener("click", async () => {
          const nextEntry = deepCopy(ensureAcceptanceEntry(row.card.sku_id));
          nextEntry.status = statusSelect.value;
          nextEntry.owner = String(ownerInput.value || "").trim();
          nextEntry.summary_comment = String(commentInput.value || "").trim();
          nextEntry.updated_at = AcceptanceStore.todayIso();

          for (const control of recommendationControls) {
            const current = nextEntry.recommendations[control.key] || {
              state: "todo",
              comment: "",
              updated_at: ""
            };
            nextEntry.recommendations[control.key] = {
              state: control.stateSelect.value,
              comment: String(control.commentInput.value || "").trim(),
              updated_at:
                control.stateSelect.value !== current.state ||
                String(control.commentInput.value || "").trim() !== String(current.comment || "").trim()
                  ? AcceptanceStore.todayIso()
                  : current.updated_at || ""
            };
          }

          let validation = AcceptanceStore.validateEntry(
            nextEntry,
            recommendationKeysForSku(row.card.sku_id)
          );
          let downgradedStatus = false;
          if (!validation.ok && String(nextEntry.status) === "done") {
            const doneOnlyErrors = validation.errors.every((errorText) =>
              String(errorText || "").startsWith("Нельзя поставить done")
            );
            if (doneOnlyErrors) {
              nextEntry.status = "in_progress";
              validation = AcceptanceStore.validateEntry(
                nextEntry,
                recommendationKeysForSku(row.card.sku_id)
              );
              if (validation.ok) {
                downgradedStatus = true;
                statusSelect.value = "in_progress";
                statusBadge.className = statusBadgeClass("in_progress");
                statusBadge.textContent = statusLabel("in_progress");
              }
            }
          }
          if (!validation.ok) {
            msg.className = "cheh-acceptance__msg cheh-acceptance__msg--error";
            msg.textContent = validation.errors[0] || "Ошибка валидации";
            return;
          }

          try {
            acceptanceState.sku_acceptance[row.card.sku_id] = validation.entry;
            await saveAcceptanceState();
            const savedSummary = summarizeAcceptanceEntry(row.card.sku_id);
            recTop.textContent = `Прогресс ${
              savedSummary.recommendations_done + savedSummary.recommendations_skip
            }/${savedSummary.recommendations_total} | blocked ${savedSummary.recommendations_blocked}`;
            refreshCardAcceptanceWidget(row.card.sku_id);
            const rowAfterSave = {
              card: row.card,
              entry: validation.entry,
              summary: savedSummary,
              section_label: row.section_label,
              score: row.score,
              search: `${row.card.sku_id || ""} ${row.card.name || ""} ${
                validation.entry.owner || ""
              } ${validation.entry.summary_comment || ""}`.toLowerCase()
            };
            if (!matchRowByFilters(rowAfterSave)) {
              await renderTable();
              return;
            }
            renderAcceptanceSummary(buildAcceptanceRows().filter(matchRowByFilters));
            if (downgradedStatus) {
              msg.className = "cheh-acceptance__msg cheh-acceptance__msg--warn";
              msg.textContent = "Сохранено: статус изменен на 'В работе', пока не закрыты все рекомендации.";
            } else {
              msg.className = "cheh-acceptance__msg cheh-acceptance__msg--ok";
              msg.textContent = `Сохранено ${AcceptanceStore.todayIso()}`;
            }
          } catch (error) {
            console.error("[SKU Dashboard] acceptance save failed", error);
            msg.className = "cheh-acceptance__msg cheh-acceptance__msg--error";
            msg.textContent = "Ошибка сохранения";
          }
        });
      }

      renderAcceptanceSummary(allRows);
    };

    const saveCurrentProfile = async () => {
      const rawName = profileNameInput.value || activeProfileName || "default";
      const cleanName = sanitizeProfileName(rawName);
      if (!cleanName.length) return;
      captureFiltersFromUi();
      acceptanceProfiles[cleanName] = {
        filters: deepCopy(filterState),
        updated_at: AcceptanceStore.nowIso()
      };
      activeProfileName = cleanName;
      await persistProfiles();
      renderProfilesSelect();
    };

    const loadProfileFromSelect = async () => {
      const target = profileSelect.value;
      if (!target || !acceptanceProfiles[target]) return;
      applyProfileToFilters(target);
      filterState.page = 1;
      await renderTable();
    };

    sectionFilter.value = filterState.section || "all";
    statusFilter.value = filterState.status || "all";
    complianceFilter.value = filterState.compliance || "all";
    blockersFilter.value = filterState.blockers || "all";
    textFilter.value = filterState.text || "";
    ownerFilter.value = filterState.owner || "";
    pageSizeFilter.value = String(filterState.pageSize || defaultFilterState.pageSize);

    sectionFilter.addEventListener("change", async () => {
      filterState.page = 1;
      await renderTable();
    });
    statusFilter.addEventListener("change", async () => {
      filterState.page = 1;
      await renderTable();
    });
    complianceFilter.addEventListener("change", async () => {
      filterState.page = 1;
      await renderTable();
    });
    blockersFilter.addEventListener("change", async () => {
      filterState.page = 1;
      await renderTable();
    });
    textFilter.addEventListener("input", async () => {
      filterState.page = 1;
      await renderTable();
    });
    ownerFilter.addEventListener("input", async () => {
      filterState.page = 1;
      await renderTable();
    });
    pageSizeFilter.addEventListener("change", async () => {
      filterState.page = 1;
      await renderTable();
    });

    resetFiltersButton.addEventListener("click", async () => {
      filterState = deepCopy(defaultFilterState);
      sectionFilter.value = defaultFilterState.section;
      statusFilter.value = defaultFilterState.status;
      complianceFilter.value = defaultFilterState.compliance;
      blockersFilter.value = defaultFilterState.blockers;
      textFilter.value = defaultFilterState.text;
      ownerFilter.value = defaultFilterState.owner;
      pageSizeFilter.value = String(defaultFilterState.pageSize);
      await renderTable();
    });

    pagerPrev.addEventListener("click", async () => {
      filterState.page = Math.max(1, Number(filterState.page || 1) - 1);
      await renderTable();
    });
    pagerNext.addEventListener("click", async () => {
      filterState.page = Number(filterState.page || 1) + 1;
      await renderTable();
    });

    profileLoadButton.addEventListener("click", async () => {
      await loadProfileFromSelect();
    });
    profileSelect.addEventListener("change", async () => {
      profileNameInput.value = profileSelect.value;
      await loadProfileFromSelect();
    });
    profileSaveButton.addEventListener("click", async () => {
      await saveCurrentProfile();
    });
    profileDeleteButton.addEventListener("click", async () => {
      const target = profileSelect.value;
      if (!target || target === "default") return;
      delete acceptanceProfiles[target];
      if (!acceptanceProfiles[activeProfileName]) activeProfileName = "default";
      await persistProfiles();
      renderProfilesSelect();
      applyProfileToFilters(activeProfileName);
      await renderTable();
    });
    syncFileButton.addEventListener("click", async () => {
      try {
        syncInfo.className = "cheh-acceptance__msg";
        syncInfo.textContent = "Синхронизация...";
        await saveAcceptanceState({ forceFile: true });
        await persistProfiles({ forceFile: true });
        syncInfo.className = "cheh-acceptance__msg cheh-acceptance__msg--ok";
        syncInfo.textContent = "Синхронизировано в markdown файл.";
      } catch (error) {
        console.error("[SKU Dashboard] sync to file failed", error);
        syncInfo.className = "cheh-acceptance__msg cheh-acceptance__msg--error";
        syncInfo.textContent = "Ошибка синхронизации в файл.";
      }
    });

    renderProfilesSelect();
    applyProfileToFilters(activeProfileName);
    await renderTable();
  }

  const sectionsWrap = root.appendChild(document.createElement("section"));
  sectionsWrap.className = "cheh-sections";

  let sectionIndex = 0;
  for (const sec of SECTION_ORDER) {
    const row = sectionMap.get(sec);
    if (!row) continue;

    const secNode = sectionsWrap.appendChild(document.createElement("article"));
    secNode.className = `cheh-section cheh-section--${sec}`;

    const head = secNode.appendChild(document.createElement("div"));
    head.className = "cheh-section__head";
    const badge = head.appendChild(document.createElement("span"));
    badge.className = "cheh-section__badge";
    badge.textContent = alphaMark(sectionIndex);
    sectionIndex += 1;
    const title = head.appendChild(document.createElement("div"));
    title.className = "cheh-section__title";
    title.textContent = `${SECTION_LABELS[sec] || sec} (${Math.round(row.sku_count)} SKU)`;

    const rowMetrics = secNode.appendChild(document.createElement("div"));
    rowMetrics.className = "cheh-row";
    const chips = [
      ["Визиты (вся история)", `${Math.round(row.visits_all)}`],
      ["Формы", `${Math.round(row.forms_all)} (${row.forms_cr_all_pct.toFixed(2)}%)`],
      ["Checkout begin", `${Math.round(row.checkout_begin_all)}`],
      ["Визиты (последний год)", `${Math.round(row.visits_recent)}`]
    ];
    for (const [k, v] of chips) {
      const chip = rowMetrics.appendChild(document.createElement("div"));
      chip.className = "cheh-chip";
      const kk = chip.appendChild(document.createElement("div"));
      kk.className = "cheh-chip__k";
      kk.textContent = k;
      const vv = chip.appendChild(document.createElement("div"));
      vv.className = "cheh-chip__v";
      vv.textContent = v;
    }

    const scoreChip = secNode.appendChild(document.createElement("div"));
    scoreChip.className = "cheh-chip";
    const scoreK = scoreChip.appendChild(document.createElement("div"));
    scoreK.className = "cheh-chip__k";
    scoreK.textContent = "Средняя вкусность карточек (1..10)";
    const scoreV = scoreChip.appendChild(document.createElement("div"));
    scoreV.className = "cheh-chip__v";
    scoreV.textContent = row.taste_avg.toFixed(2);
    scoreChip.appendChild(meter(row.taste_avg, 10));

    const secSku = [...(skuBySection.get(sec) || [])];
    secSku.sort((a, b) => a.appetite_score_data - b.appetite_score_data);

    const dupMap = new Map();
    for (const card of secSku) {
      const key = String(card.image_url || "").trim();
      if (!key) continue;
      dupMap.set(key, (dupMap.get(key) || 0) + 1);
    }

    const noPrice = secSku.filter((s) => !s.price_rub).length;
    const dupCount = [...dupMap.values()].filter((x) => x > 1).reduce((a, b) => a + b, 0);

    const note = secNode.appendChild(document.createElement("div"));
    note.className = "cheh-note";
    note.textContent = `Коротко: без цены ${noPrice}; карточек с повтором фото ${dupCount}; средняя оценка ${row.taste_avg.toFixed(2)}.`;

    const detailIntervals = secNode.appendChild(document.createElement("details"));
    const d1s = detailIntervals.appendChild(document.createElement("summary"));
    d1s.textContent = "Шаг 1. Интервалы оценок карточек (5 уровней)";
    const d1n = detailIntervals.appendChild(document.createElement("div"));
    d1n.className = "cheh-note";
    d1n.textContent = "Карточки уже отсортированы по оценке. Раскрывайте интервал -> карточку, чтобы увидеть полный контекст и источники.";

    const intervalsWrap = detailIntervals.appendChild(document.createElement("div"));
    intervalsWrap.className = "cheh-intervals";

    const groups = splitIntoFiveIntervals(secSku, "appetite_score_data");
    for (let gi = 0; gi < groups.length; gi += 1) {
      const group = groups[gi];
      const gMin = toNum(group[0]?.appetite_score_data);
      const gMax = toNum(group[group.length - 1]?.appetite_score_data);
      const gAvg = group.reduce((s, x) => s + toNum(x.appetite_score_data), 0) / (group.length || 1);

      const gNode = intervalsWrap.appendChild(document.createElement("details"));
      gNode.className = "cheh-interval";
      const gs = gNode.appendChild(document.createElement("summary"));
      gs.textContent = `Интервал ${gi + 1}/5: score ${gMin.toFixed(2)}..${gMax.toFixed(2)} | карточек ${group.length}`;

      const gMeta = gNode.appendChild(document.createElement("div"));
      gMeta.className = "cheh-interval__meta";
      gMeta.textContent = `Средний score интервала: ${gAvg.toFixed(2)}.`;

      const cardList = gNode.appendChild(document.createElement("div"));
      cardList.className = "cheh-sku-cards";

      for (const card of group) {
        const cNode = cardList.appendChild(document.createElement("details"));
        cNode.className = "cheh-sku-card";
        cNode.dataset.skuCard = String(card.sku_id || "");
        const cs = cNode.appendChild(document.createElement("summary"));
        cs.textContent = `${card.sku_id} | ${card.name || "Без названия"} | score ${toNum(card.appetite_score_data).toFixed(2)}`;

        const body = cNode.appendChild(document.createElement("div"));
        body.className = "cheh-sku-card__body";

        const img = body.appendChild(document.createElement("img"));
        img.className = "cheh-sku-card__img";
        img.src = vaultImageSrc(card.image_path);
        img.alt = `${card.sku_id} image`;
        img.loading = "lazy";

        const metaGrid = body.appendChild(document.createElement("div"));
        metaGrid.className = "cheh-sku-card__meta";

        const meta = metaGrid.appendChild(document.createElement("div"));
        meta.className = "cheh-meta-box";
        const mt = meta.appendChild(document.createElement("div"));
        mt.className = "cheh-meta-box__title";
        mt.textContent = "Мета карточки";
        const mul = meta.appendChild(document.createElement("ul"));
        [
          `SKU: ${card.sku_id}`,
          `Название: ${card.name || "—"}`,
          `Цена: ${card.price_rub ? `${Math.round(card.price_rub)} ₽` : "не указана"}`,
          `Вес: ${card.weight_text || "не указан"}`,
          `Описание: ${card.description || "нет"}`,
          `Кнопка: ${card.add_button_id || "нет id"}`
        ].forEach((line) => {
          const li = mul.appendChild(document.createElement("li"));
          li.textContent = line;
        });

        const quality = metaGrid.appendChild(document.createElement("div"));
        quality.className = "cheh-meta-box";
        const qt = quality.appendChild(document.createElement("div"));
        qt.className = "cheh-meta-box__title";
        qt.textContent = "Оценка и диагностика";
        const qul = quality.appendChild(document.createElement("ul"));
        [
          `appetite_score_data: ${toNum(card.appetite_score_data).toFixed(2)} (${scoreBucket(toNum(card.appetite_score_data))})`,
          `image_quality_score: ${toNum(card.image_quality_score).toFixed(2)}`,
          `food_styling_score: ${toNum(card.food_styling_score).toFixed(2)}`,
          `Размер: ${Math.round(toNum(card.image_width))}x${Math.round(toNum(card.image_height))}`,
          `Яркость/контраст: ${toNum(card.img_brightness).toFixed(1)} / ${toNum(card.img_contrast).toFixed(1)}`
        ].forEach((line) => {
          const li = qul.appendChild(document.createElement("li"));
          li.textContent = line;
        });

        const comments = metaGrid.appendChild(document.createElement("div"));
        comments.className = "cheh-meta-box";
        const ct = comments.appendChild(document.createElement("div"));
        ct.className = "cheh-meta-box__title";
        ct.textContent = "Комментарии для обратной связи";
        const cul = comments.appendChild(document.createElement("ul"));
        const expert = expertBySku.get(card.sku_id);
        const cardComments = expert
          ? [
              expert.expert_diagnosis || "",
              `Как переснять: ${expert.expert_shot_plan || "—"}`,
              `Стилизация: ${expert.expert_styling_plan || "—"}`,
              expert.expert_post_plan || "",
              `Итоговый комментарий: ${expert.expert_full_comment || ""}`
            ].filter(Boolean)
          : commentsForCard(card, dupMap.get(String(card.image_url || "").trim()) || 0);
        for (const line of cardComments) {
          const li = cul.appendChild(document.createElement("li"));
          li.textContent = line;
        }

        if (acceptanceEnabled) {
          const acceptanceBox = metaGrid.appendChild(document.createElement("div"));
          acceptanceBox.className = "cheh-meta-box";
          const at = acceptanceBox.appendChild(document.createElement("div"));
          at.className = "cheh-meta-box__title";
          at.textContent = "Статус приемки";

          const entrySummary = summarizeAcceptanceEntry(card.sku_id);
          const summaryList = acceptanceBox.appendChild(document.createElement("ul"));

          const liStatus = summaryList.appendChild(document.createElement("li"));
          const statusSpan = liStatus.appendChild(document.createElement("span"));
          statusSpan.className = statusBadgeClass(entrySummary.status);
          statusSpan.textContent = statusLabel(entrySummary.status);

          const liProgress = summaryList.appendChild(document.createElement("li"));
          liProgress.textContent = `Прогресс рекомендаций: ${
            entrySummary.recommendations_done + entrySummary.recommendations_skip
          }/${entrySummary.recommendations_total}`;

          const liBlockers = summaryList.appendChild(document.createElement("li"));
          liBlockers.textContent = `Блокеры: ${entrySummary.recommendations_blocked}`;

          const liOwner = summaryList.appendChild(document.createElement("li"));
          liOwner.textContent = `Owner: ${entrySummary.owner || "не назначен"}`;

          const liComment = summaryList.appendChild(document.createElement("li"));
          liComment.textContent = `Комментарий: ${entrySummary.summary_comment || "—"}`;

          cardAcceptanceNodes.set(card.sku_id, {
            status: statusSpan,
            progress: liProgress,
            blockers: liBlockers,
            owner: liOwner,
            comment: liComment
          });
        }

        const srcBox = metaGrid.appendChild(document.createElement("div"));
        srcBox.className = "cheh-meta-box";
        const st = srcBox.appendChild(document.createElement("div"));
        st.className = "cheh-meta-box__title";
        st.textContent = "Источники";
        const sul = srcBox.appendChild(document.createElement("ul"));
        const src1 = sul.appendChild(document.createElement("li"));
        src1.appendChild(fileLinkNode(`${DATA_PATH}/sku_cards.csv`, "sku_cards.csv"));
        const src2 = sul.appendChild(document.createElement("li"));
        src2.appendChild(fileLinkNode(card.image_path, "локальный image_path"));
        const src3 = sul.appendChild(document.createElement("li"));
        src3.appendChild(externalLink(card.image_url, "origin image_url"));
        const src4 = sul.appendChild(document.createElement("li"));
        src4.appendChild(externalLink(card.source_url, "source_url раздела"));
        const src5 = sul.appendChild(document.createElement("li"));
        src5.appendChild(fileLinkNode(`${DATA_PATH}/sku_photo_expert_comments.csv`, "sku_photo_expert_comments.csv"));
      }
    }

    const detailMetrics = secNode.appendChild(document.createElement("details"));
    const d2s = detailMetrics.appendChild(document.createElement("summary"));
    d2s.textContent = "Шаг 2. Подробные метрики раздела (устройства, пути, месяцы)";

    const secDevices = [...(deviceBySection.get(sec) || [])];
    secDevices.sort((a, b) => (a.period === b.period ? b.visits - a.visits : String(a.period).localeCompare(String(b.period))));
    if (secDevices.length) {
      detailMetrics.appendChild(
        createTable(
          ["Период", "Устройство", "Визиты", "Users", "Forms", "Checkout", "Phone", "CR формы %"],
          secDevices.map((x) => [
            x.period,
            x.device,
            String(Math.round(x.visits)),
            String(Math.round(x.users)),
            String(Math.round(x.forms)),
            String(Math.round(x.checkout_begin)),
            String(Math.round(x.phone)),
            x.forms_cr_pct.toFixed(2)
          ])
        )
      );
    }

    const secPaths = [...(pathBySection.get(sec) || [])].slice(0, 8);
    if (secPaths.length) {
      detailMetrics.appendChild(
        createTable(
          ["Path", "Визиты", "Forms", "Checkout", "Phone", "CR формы %"],
          secPaths.map((x) => [
            x.path,
            String(Math.round(x.visits)),
            String(Math.round(x.forms)),
            String(Math.round(x.checkout_begin)),
            String(Math.round(x.phone)),
            x.forms_cr_pct.toFixed(2)
          ])
        )
      );
    }

    const secMonthly = [...(monthlyBySection.get(sec) || [])];
    secMonthly.sort((a, b) => String(a.month).localeCompare(String(b.month)));
    if (secMonthly.length) {
      detailMetrics.appendChild(
        createTable(
          ["Месяц", "Визиты", "Forms", "Checkout", "Phone", "CR формы %"],
          secMonthly.map((x) => [
            x.month,
            String(Math.round(x.visits)),
            String(Math.round(x.forms)),
            String(Math.round(x.checkout_begin)),
            String(Math.round(x.phone)),
            x.forms_cr_pct.toFixed(2)
          ])
        )
      );
    }

    const detailArtifacts = secNode.appendChild(document.createElement("details"));
    const d3s = detailArtifacts.appendChild(document.createElement("summary"));
    d3s.textContent = "Шаг 3. Артефакты и первоисточники исследования";
    const art = detailArtifacts.appendChild(document.createElement("div"));
    art.className = "cheh-artifacts";
    const ul = art.appendChild(document.createElement("ul"));

    const items = [
      [`${DATA_PATH}/sku_cards.csv`, "Полный реестр карточек SKU"],
      [`${DATA_PATH}/section_kpi_summary.csv`, "Сводка KPI по разделам"],
      [`${DATA_PATH}/section_device_summary.csv`, "Метрики по устройствам"],
      [`${DATA_PATH}/section_top_paths.csv`, "Топ стартовых путей"],
      [`${DATA_PATH}/section_monthly_recent.csv`, "Помесячная динамика"],
      [`${DATA_PATH}/contact-sheets/${sec}.png`, `Визуальный лист ${sec}.png`],
      ["chehovskiy-sku-hadi-audit-add-to-cart-2026-03-04.md", "HADI-аудит add_to_cart"],
      ["chehovskiy-yandex-metrika-context-2026-03-04.md", "Контекст Яндекс Метрики"],
      [ACCEPTANCE_STATE_PATH, "Состояние приемки SKU"],
      [PROFILE_STATE_PATH, "Профили фильтров приемки"]
    ];

    for (const [path, label] of items) {
      const li = ul.appendChild(document.createElement("li"));
      li.appendChild(fileLinkNode(path, label));
    }
  }

  if (acceptanceEnabled) {
    refreshAllCardAcceptanceWidgets();
  }

  const bestTraffic = [...sectionKpiRows].sort((a, b) => b.visits_all - a.visits_all)[0];
  const bestForms = [...sectionKpiRows].sort((a, b) => b.forms_cr_all_pct - a.forms_cr_all_pct)[0];
  const weakestTaste = [...sectionKpiRows].sort((a, b) => a.taste_avg - b.taste_avg)[0];

  const final = root.appendChild(document.createElement("section"));
  final.className = "cheh-final";
  const finalTitle = final.appendChild(document.createElement("h3"));
  finalTitle.textContent = "Финальные выводы (после раскрытия шагов)";
  const finalList = final.appendChild(document.createElement("ul"));
  const lines = [
    `Максимальный трафик: ${SECTION_LABELS[bestTraffic?.section] || bestTraffic?.section}.`,
    `Лучшая текущая CR формы: ${SECTION_LABELS[bestForms?.section] || bestForms?.section} (${bestForms?.forms_cr_all_pct?.toFixed(2)}%).`,
    `Самая слабая средняя вкусность: ${SECTION_LABELS[weakestTaste?.section] || weakestTaste?.section} (${weakestTaste?.taste_avg?.toFixed(2)}).`,
    "Честный порядок работ: сначала трекинг add_to_cart, потом фото/карточки/цены, потом повторный HADI-замер.",
    "Не перегружаем команду: работаем по разделам и интервалам, от низких карточек к сильным."
  ];
  for (const line of lines) {
    const li = finalList.appendChild(document.createElement("li"));
    li.textContent = line;
  }
})();
