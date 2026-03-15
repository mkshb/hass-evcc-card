/**
 * evcc-card — Generische Home Assistant Lovelace Card für ha-evcc
 *
 * Datei:   evcc-card.js
 * Ablage:  /config/www/evcc-card/evcc-card.js
 *
 * Übersetzungen: /config/www/evcc-card/locales/de.json
 *                /config/www/evcc-card/locales/en.json
 */

const EVCC_CARD_VERSION = "0.4.2";

const FEATURES = [
  { suffix: "mode",                domain: "select",        type: "mode",          lp: true  },
  { suffix: "min_current",         domain: "select",        type: "select_slider", lp: true  },
  { suffix: "max_current",         domain: "select",        type: "select_slider", lp: true  },
  { suffix: "min_soc",             domain: "select",        type: "select_slider", lp: true  },
  { suffix: "limit_soc",           domain: "number",        type: "slider",        lp: true  },
  { suffix: "limit_soc",           domain: "select",        type: "select_slider", lp: true  },
  { suffix: "limit_energy",        domain: "number",        type: "slider",        lp: true  },
  { suffix: "smart_cost_limit",    domain: "number",        type: "slider",        lp: true  },
  { suffix: "priority",            domain: "number",        type: "slider",        lp: true  },
  { suffix: "phases_configured",   domain: "select",        type: "select",        lp: true  },
  { suffix: "vehicle_name",        domain: "select",        type: "select",        lp: true  },
  { suffix: "battery_boost_limit", domain: "select",        type: "select_slider", lp: true  },

  { suffix: "battery_boost",       domain: "switch",        type: "toggle",        lp: true  },

  { suffix: "charge_power",        domain: "sensor",        type: "power",         lp: true  },
  { suffix: "charge_current",      domain: "sensor",        type: "current",       lp: true  },
  { suffix: "charge_duration",     domain: "sensor",        type: "info",          lp: true  },
  { suffix: "charged_energy",      domain: "sensor",        type: "energy",        lp: true  },
  { suffix: "effective_limit_soc", domain: "sensor",        type: "info",          lp: true  },
  { suffix: "vehicle_soc",         domain: "sensor",        type: "soc",           lp: true  },
  { suffix: "vehicle_range",       domain: "sensor",        type: "range",         lp: true  },
  { suffix: "vehicle_odometer",    domain: "sensor",        type: "info",          lp: true  },
  { suffix: "session_energy",      domain: "sensor",        type: "info",          lp: true  },
  { suffix: "session_price",       domain: "sensor",        type: "info",          lp: true  },
  { suffix: "phases_active",       domain: "sensor",        type: "info",          lp: true  },

  { suffix: "effective_plan_soc",      domain: "sensor", type: "info", lp: true },
  { suffix: "effective_plan_time",     domain: "sensor", type: "info", lp: true },
  { suffix: "plan_projected_start",    domain: "sensor", type: "info", lp: true },
  { suffix: "plan_projected_end",      domain: "sensor", type: "info", lp: true },
  { suffix: "vehicle_plans_soc",       domain: "sensor", type: "info", lp: true },
  { suffix: "vehicle_plans_time",      domain: "sensor", type: "info", lp: true },

  { suffix: "charging",            domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "connected",           domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "enabled",             domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "smart_cost_active",   domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "plan_active",         domain: "binary_sensor", type: "status_bool",   lp: true  },

  { suffix: "grid_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_power",            domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_0_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_1_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_2_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_3_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "home_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_power",       domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_soc",         domain: "sensor",        type: "soc",           lp: false },
  { suffix: "battery_capacity",    domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_energy",           domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_0_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_1_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_2_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_3_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "grid_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "grid_energy_export",  domain: "sensor",        type: "info",          lp: false },
  { suffix: "battery_energy_charge",   domain: "sensor",    type: "info",          lp: false },
  { suffix: "battery_energy_discharge",domain: "sensor",    type: "info",          lp: false },
  { suffix: "home_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "tariff_grid",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "tariff_feedin",       domain: "sensor",        type: "info",          lp: false },
  { suffix: "tariff_co2",          domain: "sensor",        type: "info",          lp: false },

  { suffix: "priority_soc",        domain: "select",        type: "select_slider", lp: false },
  { suffix: "buffer_soc",          domain: "select",        type: "select_slider", lp: false },
  { suffix: "buffer_start_soc",    domain: "select",        type: "select_slider", lp: false },
  { suffix: "residual_power",      domain: "number",        type: "slider",        lp: false },
  { suffix: "battery_discharge_control", domain: "switch",  type: "toggle",        lp: false },
  { suffix: "battery_grid_charge_active", domain: "binary_sensor", type: "status_bool", lp: false },
  { suffix: "battery_grid_charge_limit",  domain: "number",        type: "slider",      lp: false },
];

const CHARGE_MODES = {
  "off":   { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13,3H11V13H13V3M17.83,5.17L16.41,6.59C17.99,7.86 19,9.81 19,12A7,7 0 0,1 12,19A7,7 0 0,1 5,12C5,9.81 6.01,7.86 7.58,6.58L6.17,5.17C4.23,6.82 3,9.26 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12C21,9.26 19.77,6.82 17.83,5.17Z"/></svg>`,  tKey: "modeOff"  },
  "pv":    { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`,  tKey: "modePV"   },
  "minpv": { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="position:relative;top:4px;left:-6px;opacity:0.8"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`, tKey: "modeMinPV"},
  "now":   { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>`,  tKey: "modeNow"  },
};

function discoverEntities(hass, prefix = "evcc_") {
  const sortedFeatures = [...FEATURES].sort((a, b) => b.suffix.length - a.suffix.length);
  const prefixLen = prefix.length;

  const loadpoints = {};
  const site = {};

  for (const entityId of Object.keys(hass.states)) {
    const dotIdx = entityId.indexOf(".");
    const domain = entityId.slice(0, dotIdx);
    const slug   = entityId.slice(dotIdx + 1);

    if (!slug.startsWith(prefix)) continue;

    const rest = slug.slice(prefixLen);

    let matched = null;
    for (const feat of sortedFeatures) {
      if (feat.domain !== domain) continue;
      if (rest === feat.suffix) {
        matched = { feat, lpName: "" };
        break;
      }
      if (rest.endsWith("_" + feat.suffix)) {
        const lpName = rest.slice(0, rest.length - feat.suffix.length - 1);
        matched = { feat, lpName };
        break;
      }
    }

    if (!matched) continue;

    const { feat, lpName } = matched;

    if (!lpName) {
      site[feat.suffix] = entityId;
    } else {
      if (!loadpoints[lpName]) loadpoints[lpName] = {};
      if (!loadpoints[lpName][feat.suffix]) {
        loadpoints[lpName][feat.suffix] = entityId;
      }
    }
  }

  const CORE_FEATURES = ["mode", "charge_power", "connected", "charging", "vehicle_soc"];
  for (const lpName of Object.keys(loadpoints)) {
    const hasCore = CORE_FEATURES.some(f => loadpoints[lpName][f]);
    if (!hasCore) delete loadpoints[lpName];
  }

  return { loadpoints, site };
}

function stateVal(hass, entityId) {
  return hass.states[entityId]?.state ?? null;
}

function attr(hass, entityId, key) {
  return hass.states[entityId]?.attributes?.[key] ?? null;
}

function unitStr(hass, entityId) {
  return attr(hass, entityId, "unit_of_measurement") ?? "";
}

function displayUnit(hass, entityId) {
  const rawUnit = unitStr(hass, entityId);
  return rawUnit || (entityId.includes("soc") ? "%" : "");
}

function isOn(hass, entityId) {
  const s = stateVal(hass, entityId);
  return s === "on" || s === "true";
}

function socFillGradient(soc, minSoc, limitSoc) {
  const s   = Math.max(0.01, soc);
  const min = Math.max(0, minSoc  || 0);
  const lim = Math.min(100, limitSoc || 100);
  const amber = "var(--evcc-amber)", blue = "var(--evcc-blue)", green = "var(--evcc-green)";
  if (min <= 0 && lim >= 100) return blue;
  const stops = [];
  if (min > 0) {
    const minRel = Math.min((min / s) * 100, 100).toFixed(1);
    stops.push(`${amber} 0%`, `${amber} ${minRel}%`);
    if (s > min) stops.push(`${blue} ${minRel}%`);
  } else {
    stops.push(`${blue} 0%`);
  }
  if (lim < 100 && s > lim) {
    const limRel = Math.min((lim / s) * 100, 100).toFixed(1);
    stops.push(`${blue} ${limRel}%`, `${green} ${limRel}%`, `${green} 100%`);
  } else {
    stops.push(`${blue} 100%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

function socTrackBg(minSoc, limitSoc) {
  const min = Math.max(0, minSoc  || 0);
  const lim = Math.min(100, limitSoc || 100);
  const base = "var(--divider-color, #e5e7eb)";
  if (min <= 0 && lim >= 100) return base;
  const stops = [];
  if (min > 0) stops.push(`rgba(245,158,11,.13) 0%`, `rgba(245,158,11,.13) ${min}%`, `${base} ${min}%`);
  else         stops.push(`${base} 0%`);
  if (lim < 100) stops.push(`${base} ${lim}%`, `rgba(34,197,94,.13) ${lim}%`, `rgba(34,197,94,.13) 100%`);
  else           stops.push(`${base} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

class EvccCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass          = null;
    this._config        = {};
    this._isDragging    = false;
    this._pendingRender = false;
    this._renderTimer   = null;
    this._lastRenderKey = null;
    this._planState     = {};
    this._tabState      = {};
    this._statsPeriod   = "total";
    this._chartCache     = {};
    this._chartCacheTime = {};
    this._translations  = {};
    this._translationsReady = false;

    this._siteTableExpanded = undefined; // undefined = use config default
    this._currentBlockExpanded = {};

    this._onPlanReset = (e) => {
      const lpName = e.detail?.lpName;
      setTimeout(() => {
        if (lpName) delete this._planState[lpName];
        else this._planState = {};
        if (this._hass) this._render();
      }, 1500);
    };
    window.addEventListener("evcc-plan-reset", this._onPlanReset);
  }

  disconnectedCallback() {
    window.removeEventListener("evcc-plan-reset", this._onPlanReset);
  }

  async _loadTranslations() {
    const base = new URL("locales/", import.meta.url).href;

    let langs = ["de", "en"];
    try {
      const idxResp = await fetch(`${base}index.json`);
      if (idxResp.ok) langs = await idxResp.json();
      else console.warn("[evcc-card] locales/index.json not found, using fallback:", langs);
    } catch (e) {
      console.warn("[evcc-card] Could not load locales/index.json, using fallback:", langs);
    }

    const results = await Promise.allSettled(
      langs.map(lang =>
        fetch(`${base}${lang}.json`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(data => ({ lang, data }))
      )
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        this._translations[result.value.lang] = result.value.data;
      } else {
        console.warn("[evcc-card] Failed to load translation:", result.reason);
      }
    }

    this._translationsReady = true;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._isDragging) {
      this._pendingRender = true;
      this._updateLiveValues();
      return;
    }
    const key = this._buildRenderKey(hass);
    if (key === this._lastRenderKey) return;

    if (this._renderTimer) return;
    this._renderTimer = setTimeout(() => {
      this._renderTimer   = null;
      this._lastRenderKey = this._buildRenderKey(this._hass);
      this._render();
    }, 300);
  }

  _buildRenderKey(hass) {
    if (!hass) return "";
    const prefix = this._config.prefix || "evcc_";
    const evccIds = Object.keys(hass.states).filter(id => {
      const slug = id.split(".")[1] ?? "";
      return slug.startsWith(prefix);
    });
    const lang = this._config.language || (hass.language ?? "de");
    return lang + "|" + evccIds.map(id => `${id}=${hass.states[id]?.state}`).join("|");
  }

  setConfig(config) {
    this._config = config || {};

    if (!this._translationsReady && !this._loadingTranslations) {
      this._loadingTranslations = true;
      this._loadTranslations().then(() => {
        this._loadingTranslations = false;
        if (this._hass) this._render();
      });
    }
  }

  _toggleSite() {
    const wasExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");
    this._siteTableExpanded = !wasExpanded;

    const root = this.shadowRoot;
    const table = root?.querySelector(".site-table");
    if (table) table.style.display = wasExpanded ? "none" : "";
    const wrap = root?.querySelector(".flow-wrap-clickable");
    if (wrap) {
      wrap.title = !wasExpanded ? this._tInline("siteCollapse") : this._tInline("siteExpand");
    }
  }

  _tInline(key) {
    const lang = (this._config.language
      || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();
    const map = {
      siteCollapse: { de: "Einklappen", en: "Collapse" },
      siteExpand:   { de: "Ausklappen", en: "Expand" },
    };
    return (map[key]?.[lang]) ?? (map[key]?.["en"]) ?? key;
  }

  _t(key, replacements = {}) {
    const lang = (this._config.language
      || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();

    const strings = this._translations[lang]
      || this._translations["en"]
      || {};

    let val = strings[key] ?? key;

    for (const [k, v] of Object.entries(replacements)) {
      val = val.replace(`{${k}}`, v);
    }

    return val;
  }

  _render() {
    if (!this._hass) return;
    if (!this._cardId) {
      this._cardId = Math.random().toString(36).slice(2);
      window.__evccCards = window.__evccCards || new Map();
      window.__evccCards.set(this._cardId, this);
    }

    if (!this._translationsReady) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block} ha-card{background:var(--card-background-color)}
        .loading{padding:24px;text-align:center;color:var(--secondary-text-color);font-size:.9rem}</style>
        <ha-card><div class="loading">⏳</div></ha-card>`;
      return;
    }

    const prefix = this._config.prefix || "evcc_";
    const { loadpoints, site } = discoverEntities(this._hass, prefix);

    const filterRaw = this._config.loadpoints;
    const filter = filterRaw
      ? (Array.isArray(filterRaw) ? filterRaw : [filterRaw])
      : null;
    const visible = filter && filter.length > 0
      ? Object.fromEntries(
          Object.entries(loadpoints).filter(([lp]) => filter.includes(lp))
        )
      : loadpoints;

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        <div class="card-content">
        ${this._config.mode === "battery"
            ? this._renderBatteryBlock(site)
            : this._config.mode === "site"
              ? this._renderSiteBlock(site, loadpoints)
              : (this._config.mode === "grid" || this._config.mode === "site2")
              ? this._renderSiteBlock2(site, loadpoints)
              : this._config.mode === "stats"
              ? this._renderStatsBlock()
              : this._config.mode === "plan"
                ? this._renderPlanMode(visible)
                : this._config.mode === "compact"
                  ? (Object.keys(visible).length === 0
                      ? this._renderEmpty(loadpoints)
                      : Object.entries(visible)
                          .map(([lp, ents]) => this._renderCompactLoadpoint(lp, ents))
                          .join(""))
                  : Object.keys(visible).length === 0
              ? this._renderEmpty(loadpoints)
              : Object.entries(visible)
                  .map(([lp, ents]) => this._renderLoadpoint(lp, ents))
                  .join("")
          }
        </div>
      </ha-card>
    `;
    this._attachListeners();
  }

  _updateLiveValues() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-live-entity]").forEach(el => {
      const entityId = el.dataset.liveEntity;
      const type     = el.dataset.liveType;
      if (!entityId) return;

      if (type === "soc-fill") {
        const soc      = parseFloat(stateVal(this._hass, entityId)) || 0;
        const minSoc   = parseFloat(el.dataset.minSoc)   || 0;
        const limitSoc = parseFloat(el.dataset.limitSoc) || 100;
        el.style.width      = `${soc}%`;
        el.style.background = socFillGradient(soc, minSoc, limitSoc);
      } else if (type === "soc-pct") {
        const soc = parseFloat(stateVal(this._hass, entityId)) || 0;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${unitStr(this._hass, entityId)}`;
      } else if (type === "power") {
        el.textContent = `${parseFloat(stateVal(this._hass, entityId)).toFixed(1)} ${unitStr(this._hass, entityId)}`;
      }
    });
  }

  _renderLoadpoint(lpName, ents) {
    const charging   = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected  = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusClass = charging ? "charging" : connected ? "connected" : "ready";

    const noPlan = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);

    return `
      <div class="loadpoint">
        <div class="lp-header">
          <span class="lp-name">${lpName}</span>
          <span class="lp-badge ${statusClass}">
            ${statusLabel}
          </span>
        </div>
        ${this._renderModeSelector(ents)}
        ${this._renderVehicleInfo(ents, charging)}
        ${this._renderPowerRow(ents, charging)}
        ${this._renderSliders(ents)}
        ${this._renderCurrentBlock(ents, lpName)}
        ${this._renderToggles(ents)}
        ${noPlan ? "" : this._renderPlanBlock(lpName, ents)}
        ${this._renderSessionInfo(ents)}
      </div>
    `;
  }

  _renderCompactLoadpoint(lpName, ents) {
    const charging    = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected   = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusClass = charging ? "charging" : connected ? "connected" : "ready";
    const noPlan      = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);

    if (this._tabState[lpName] === undefined) this._tabState[lpName] = 0;
    const activeTab = this._tabState[lpName];

    const tabs = [
      { key: "tabControl",  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>` },
      { key: "tabSettings", icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z"/></svg>` },
      { key: "tabPlan",     icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V8H19V19Z"/></svg>` },
      { key: "tabSession",  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22,21H2V3H4V19H6V17H10V19H12V16H16V19H18V17H22V21Z"/></svg>` },
    ];

    const tabBar = `
      <div class="compact-tabs">
        ${tabs.map((tab, i) => `
          <button class="compact-tab ${activeTab === i ? "active" : ""}"
                  data-lp="${lpName}" data-tab="${i}">
            <span class="compact-tab-icon">${tab.icon}</span>
            <span class="compact-tab-label">${this._t(tab.key)}</span>
          </button>
        `).join("")}
      </div>`;

    const tabContent = [
      `<div class="compact-panel" ${activeTab !== 0 ? 'hidden' : ''}>
        ${this._renderModeSelector(ents)}
        ${this._renderVehicleInfo(ents, charging)}
        ${this._renderPowerRow(ents, charging)}
      </div>`,
      `<div class="compact-panel" ${activeTab !== 1 ? 'hidden' : ''}>
        ${this._renderSliders(ents)}
        ${this._renderCurrentBlock(ents, lpName)}
        ${this._renderToggles(ents)}
      </div>`,
      `<div class="compact-panel" ${activeTab !== 2 ? 'hidden' : ''}>
        ${noPlan ? "" : this._renderPlanBlock(lpName, ents)}
      </div>`,
      `<div class="compact-panel" ${activeTab !== 3 ? 'hidden' : ''}>
        ${this._renderSessionInfo(ents)}
      </div>`,
    ].join("");

    return `
      <div class="loadpoint" data-lp-compact="${lpName}">
        <div class="lp-header">
          <span class="lp-name">${lpName}</span>
          <span class="lp-badge ${statusClass}">
            ${statusLabel}
          </span>
        </div>
        ${tabBar}
        ${tabContent}
      </div>
    `;
  }

  _renderModeSelector(ents) {
    if (!ents.mode) return "";
    const current = stateVal(this._hass, ents.mode);
    const buttons = Object.entries(CHARGE_MODES).map(([val, cfg]) => `
      <button class="mode-btn ${current === val ? "active" : ""}"
              data-entity="${ents.mode}" data-value="${val}">
        <span class="mode-icon">${cfg.icon}</span>
        <span class="mode-label">${this._t(cfg.tKey)}</span>
      </button>
    `).join("");
    return `<div class="mode-row">${buttons}</div>`;
  }

  _renderSocBar(ents, charging = false) {
    if (!ents.vehicle_soc) return "";
    const soc   = parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0;
    const range = ents.vehicle_range
      ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_range))) : null;
    const limit = ents.limit_soc
      ? parseFloat(stateVal(this._hass, ents.limit_soc)) : null;
    const color = soc > 80 ? "var(--evcc-green)" : soc > 30 ? "var(--evcc-blue)" : "var(--evcc-amber)";

    return `
      <div class="soc-section">
        <div class="soc-label-row">
          <span data-live-entity="${ents.vehicle_soc}" data-live-type="soc-pct">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${unitStr(this._hass, ents.vehicle_soc)}
          </span>
          ${range !== null ? `<span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg> ${range} km</span>` : ""}
        </div>
        <div class="soc-track">
          <div class="soc-fill ${charging ? 'charging' : ''}"
               data-live-entity="${ents.vehicle_soc}" data-live-type="soc-fill"
               style="width:${soc}%;background:${color}"></div>
          ${limit !== null
            ? `<div class="soc-limit-marker" style="left:${Math.min(limit,100)}%"></div>`
            : ""}
        </div>
      </div>
    `;
  }

  _renderVehicleInfo(ents, charging = false) {
    if (!ents.vehicle_soc && !ents.vehicle_name) return "";
    const vehicleAttrs = ents.vehicle_name
      ? (this._hass.states[ents.vehicle_name]?.attributes ?? {}) : {};
    const vehicleName  = vehicleAttrs.vehicle?.name || null;
    const validName    = vehicleName && vehicleName !== "null" ? vehicleName : null;

    if (!ents.vehicle_soc && !validName) return "";

    const soc   = ents.vehicle_soc ? parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0 : null;
    const range = ents.vehicle_range
      ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_range))) : null;
    const limit  = ents.limit_soc ? parseFloat(stateVal(this._hass, ents.limit_soc))  : null;
    const minSoc = ents.min_soc   ? parseFloat(stateVal(this._hass, ents.min_soc))    : null;
    const fillBg  = soc !== null ? socFillGradient(soc, minSoc ?? 0, limit ?? 100) : "var(--evcc-blue)";
    const trackBg = socTrackBg(minSoc ?? 0, limit ?? 100);

    return `
      <div class="soc-section">
        <div class="soc-label-row">
          ${validName ? `<span class="vehicle-name"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z"/></svg> ${validName}</span>` : ""}
          ${soc !== null ? `<span data-live-entity="${ents.vehicle_soc}" data-live-type="soc-pct"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${unitStr(this._hass, ents.vehicle_soc)}</span>` : ""}
          ${range !== null ? `<span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg> ${range} km</span>` : ""}
        </div>
        ${soc !== null ? `
        <div class="soc-track" style="background:${trackBg}">
          <div class="soc-fill ${charging ? 'charging' : ''}"
               data-live-entity="${ents.vehicle_soc}" data-live-type="soc-fill"
               data-min-soc="${minSoc ?? 0}" data-limit-soc="${limit ?? 100}"
               style="width:${soc}%;background:${fillBg}"></div>
          ${minSoc !== null ? `<div class="soc-min-marker"   style="left:${Math.min(minSoc,100)}%"></div>` : ""}
          ${limit  !== null ? `<div class="soc-limit-marker" style="left:${Math.min(limit,100)}%"></div>`  : ""}
        </div>` : ""}
      </div>
    `;
  }

  _renderPowerRow(ents, charging) {
    if (!ents.charge_power) return "";
    const power   = parseFloat(stateVal(this._hass, ents.charge_power)).toFixed(1);
    const unit    = unitStr(this._hass, ents.charge_power);
    const current = ents.charge_current
      ? stateVal(this._hass, ents.charge_current) : null;
    const phases  = ents.phases_active
      ? parseInt(stateVal(this._hass, ents.phases_active)) || null : null;
    const phasesLabel = phases === 1 ? this._t("phasesSingle")
                      : phases === 3 ? this._t("phasesTriple")
                      : phases !== null ? `${phases}` : null;

    return `
      <div class="power-row ${charging ? "charging" : ""}">
        <span class="power-value"
              data-live-entity="${ents.charge_power}" data-live-type="power">
          ${power} ${unit}
        </span>
        ${current !== null ? `<span class="power-sep">·</span><span class="power-current">${current} A</span>` : ""}
        ${phasesLabel !== null ? `<span class="power-sep">·</span><span class="power-phases">${phasesLabel}</span>` : ""}
      </div>
    `;
  }

  _renderSliders(ents) {
    const SLIDER_FEATURES = [
      { key: "limit_soc",   label: this._t("targetSoc") },
      { key: "min_soc",     label: this._t("minSoc")    },
      { key: "priority",    label: this._t("priority")  },
    ];

    const rows = SLIDER_FEATURES
      .filter(({ key }) => ents[key])
      .map(({ key, label }) => this._sliderRow(ents[key], label));

    return rows.length ? `<div class="sliders">${rows.join("")}</div>` : "";
  }

  _renderCurrentBlock(ents, lpName = "") {
    const hasPhases  = !!ents.phases_configured;
    const hasCurrent = ents.min_current || ents.max_current;
    if (!hasPhases && !hasCurrent) return "";

    const configDefault = this._config.charge_current_settings === "expanded";
    const expanded = this._currentBlockExpanded[lpName] !== undefined
      ? this._currentBlockExpanded[lpName]
      : configDefault;

    let phasesHtml = "";
    if (hasPhases) {
      const entityId = ents.phases_configured;
      const current  = stateVal(this._hass, entityId);
      const options  = this._hass.states[entityId]?.attributes?.options ?? [];
      const PHASE_LABELS = {
        "automatischer Wechsel": "Auto", "automatic": "Auto", "auto": "Auto", "0": "Auto",
        "1-phasig": "1", "1": "1",
        "3-phasig": "3", "3": "3",
      };
      const buttons = options.map(opt => `
        <button class="phase-btn ${opt === current ? "active" : ""}"
                data-entity="${entityId}" data-value="${opt}">
          ${PHASE_LABELS[opt] ?? opt}
        </button>`).join("");
      phasesHtml = `
        <div class="select-row">
          <span>${this._t("phases")}</span>
          <div class="phase-btn-group">${buttons}</div>
        </div>`;
    }

    const currentRows = [
      ents.max_current ? this._sliderRow(ents.max_current, this._t("maxCurrent")) : "",
      ents.min_current ? this._sliderRow(ents.min_current, this._t("minCurrent")) : "",
    ].join("");

    const gearIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>`;

    return `
      <div class="current-block" data-lp-current="${lpName}">
        <div class="block-title-row">
          <span class="block-title">${this._t("chargeCurrent")}</span>
          <button class="current-toggle-btn ${expanded ? "active" : ""}"
                  data-lp-current-toggle="${lpName}"
                  title="${expanded ? "Hide settings" : "Show settings"}">
            ${gearIcon}
          </button>
        </div>
        <div class="current-block-body" ${expanded ? "" : "hidden"}>
          ${phasesHtml}
          ${currentRows}
        </div>
      </div>`;
  }

  _sliderRow(entityId, label) {
    const domain  = entityId.split(".")[0];
    const val     = parseFloat(stateVal(this._hass, entityId)) || 0;
    const unit    = displayUnit(this._hass, entityId);
    let min, max, step;

    if (domain === "select") {
      const opts = (attr(this._hass, entityId, "options") ?? [])
        .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
      min  = opts[0]  ?? 0;
      max  = opts[opts.length - 1] ?? 100;
      step = opts.length > 1
        ? opts.slice(1).reduce((s, v, i) => Math.min(s, v - opts[i]), Infinity)
        : 5;
    } else {
      min  = attr(this._hass, entityId, "min")  ?? 0;
      max  = attr(this._hass, entityId, "max")  ?? 100;
      step = attr(this._hass, entityId, "step") ?? 1;
    }

    return `
      <div class="slider-row">
        <label>${label}</label>
        <div class="slider-control">
          <input type="range"
                 min="${min}" max="${max}" step="${step}" value="${val}"
                 data-entity="${entityId}"
                 data-domain="${domain}" />
          <span class="slider-val">${val} ${unit}</span>
        </div>
      </div>`;
  }

  _boostCommit(input) {
    this._isDragging = false;
    if (this._pendingRender) { this._pendingRender = false; this._render(); return; }
    const val      = parseInt(input.value, 10);
    const entityId = input.dataset.boostEntity;

    if (input.dataset.boostType === "switch") {
      this._hass.callService("switch", val >= 50 ? "turn_on" : "turn_off", { entity_id: entityId });
      return;
    }

    const options = JSON.parse(input.dataset.options || "[]");
    const numOpts = options.map(o => parseInt(o)).filter(o => !isNaN(o));
    const nearest = numOpts.reduce((p, c) =>
      Math.abs(c - val) < Math.abs(p - val) ? c : p, numOpts[0] ?? val);
    this._hass.callService("select", "select_option", {
      entity_id: entityId,
      option:    String(nearest),
    });
  }

  _renderBatteryBoost(ents) {
    if (ents.battery_boost_limit) {
      const entityId = ents.battery_boost_limit;
      const current  = stateVal(this._hass, entityId);
      const options  = this._hass.states[entityId]?.attributes?.options ?? [];
      const pctOpts  = options.map(o => parseInt(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
      const min      = pctOpts[0] ?? 0;
      const max      = pctOpts[pctOpts.length - 1] ?? 100;
      const step     = pctOpts.length > 1 ? (pctOpts[1] - pctOpts[0]) : 5;
      const curPct   = (!current || current === "unknown") ? 100 : parseInt(current);
      const label    = curPct === 100 ? "Off" : curPct === 0 ? "0 % (full discharge)" : `${curPct} %`;
      return `
        <div class="slider-row">
          <label>Battery boost</label>
          <div class="slider-control">
            <input type="range"
                   min="${min}" max="${max}" step="${step}" value="${curPct}"
                   data-boost-entity="${entityId}"
                   data-options='${JSON.stringify(options)}' />
            <span class="slider-val boost-val">${label}</span>
          </div>
        </div>`;
    }
    if (!ents.battery_boost_limit) return "";
  }

  _renderToggles(ents) {
    const TOGGLE_FEATURES = [];
    const rows = TOGGLE_FEATURES
      .filter(({ key }) => ents[key])
      .map(({ key, label }) => {
        const entityId = ents[key];
        const on       = isOn(this._hass, entityId);
        const domain   = entityId.split(".")[0];
        return `
          <div class="toggle-row">
            <span>${label}</span>
            <button class="toggle ${on ? "on" : ""}"
                    data-entity="${entityId}"
                    data-domain="${domain}"
                    data-on="${on}">
              ${on ? "On" : "Off"}
            </button>
          </div>
        `;
      });
    return rows.length ? `<div class="toggles">${rows.join("")}</div>` : "";
  }

  _renderSelects(ents) {
    const SELECT_FEATURES = [
      { key: "phases_configured", label: this._t("phases") },
    ];
    const PHASE_LABELS = {
      "automatischer Wechsel": "Auto", "automatic": "Auto", "auto": "Auto", "0": "Auto",
      "1-phasig": "1", "1": "1", "3-phasig": "3", "3": "3",
    };
    const rows = SELECT_FEATURES
      .filter(({ key }) => ents[key])
      .map(({ key, label }) => {
        const entityId = ents[key];
        const current  = stateVal(this._hass, entityId);
        const options  = this._hass.states[entityId]?.attributes?.options ?? [];
        const buttons  = options.map(opt => `
          <button class="phase-btn ${opt === current ? "active" : ""}"
                  data-entity="${entityId}" data-value="${opt}">
            ${PHASE_LABELS[opt] ?? opt}
          </button>`).join("");
        return `
          <div class="select-row">
            <span>${label}</span>
            <div class="phase-btn-group">${buttons}</div>
          </div>`;
      });
    return rows.length ? `<div class="selects">${rows.join("")}</div>` : "";
  }

  _renderPlanBlock(lpName, ents, force = false) {
    const hasVehicle = !!ents.vehicle_soc;
    const planActive = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const planTime   = ents.effective_plan_time
      ? stateVal(this._hass, ents.effective_plan_time) : null;
    const planSoc    = ents.effective_plan_soc
      ? stateVal(this._hass, ents.effective_plan_soc) : null;
    const projStart  = ents.plan_projected_start
      ? stateVal(this._hass, ents.plan_projected_start) : null;
    const projEnd    = ents.plan_projected_end
      ? stateVal(this._hass, ents.plan_projected_end) : null;

    if (!ents.effective_plan_soc || !this._hass.states[ents.effective_plan_soc]) return "";
    if (!force && !hasVehicle && !planActive) return "";

    if (!this._planState[lpName]) {
      const limitSoc = ents.effective_limit_soc
        ? Math.round(parseFloat(stateVal(this._hass, ents.effective_limit_soc))) : null;
      
      const initSoc = (planSoc && planSoc !== "unknown" && planSoc !== "unavailable")
        ? Math.round(parseFloat(planSoc))
        : (limitSoc && limitSoc > 0)
          ? limitSoc
          : 80;
      let initDt = "";
      if (planTime && planTime !== "unknown" && planTime !== "unavailable") {
        try {
          const d = new Date(planTime);
          const offset = d.getTimezoneOffset() * 60000;
          initDt = new Date(d - offset).toISOString().slice(0, 16);
        } catch(e) {}
      }
      if (!initDt) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(7, 0, 0, 0);
        const offset = tomorrow.getTimezoneOffset() * 60000;
        initDt = new Date(tomorrow - offset).toISOString().slice(0, 16);
      }
      this._planState[lpName] = { soc: initSoc, time: initDt, vehicle: null };
    }

    const defaultSoc     = this._planState[lpName].soc;
    const defaultDt      = this._planState[lpName].time;

    const vehicleEntityId    = ents.vehicle_name || null;
    const vehicleAttrs       = vehicleEntityId ? (this._hass.states[vehicleEntityId]?.attributes ?? {}) : {};
    const allOptions         = (vehicleAttrs.options ?? []).filter(o => o !== "null" && o !== "");
    const vehicleAttr        = vehicleAttrs.vehicle ?? null;

    const dbIdToName = {};
    if (vehicleAttr?.evccName && vehicleAttr?.name) {
      dbIdToName[vehicleAttr.evccName] = vehicleAttr.name;
    }
    allOptions.forEach(id => { if (!dbIdToName[id]) dbIdToName[id] = id; });

    if (!this._planState[lpName].vehicle && vehicleAttr?.evccName) {
      this._planState[lpName].vehicle = vehicleAttr.evccName;
    }
    const defaultVehicle = this._planState[lpName].vehicle;

    const vehicleSelectHtml = allOptions.length > 0 ? `
      <div class="plan-row">
        <label>${this._t("vehicle")}</label>
        <select class="plan-vehicle-select" data-lp="${lpName}" data-entity="${vehicleEntityId ?? ""}">
          ${allOptions.map(id => `
            <option value="${id}" ${id === defaultVehicle ? "selected" : ""}>${dbIdToName[id]}</option>
          `).join("")}
        </select>
      </div>` : "";

    const fmtDt = (iso) => {
      if (!iso || iso === "unknown" || iso === "unavailable") return null;
      try {
        return new Date(iso).toLocaleString(this._config.language || this._hass?.language || "en", {
          weekday: "short", day: "2-digit", month: "2-digit",
          hour: "2-digit", minute: "2-digit"
        });
      } catch(e) { return null; }
    };

    const startStr = fmtDt(projStart);
    const endStr   = fmtDt(projEnd);

    const planBadge = planActive
      ? `<span class="plan-badge active">${this._t("chargingByPlan")}</span>`
      : (planTime && planTime !== "unknown" && planTime !== "unavailable")
        ? `<span class="plan-badge planned">${this._t("planned")}</span>`
        : `<span class="plan-badge">${this._t("noPlan")}</span>`;

    const projectionHtml = (startStr || endStr) ? `
      <div class="plan-projection">
        ${startStr ? `<span style="display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16.06,3.5L17.5,2.08L18.92,3.5L17.5,4.92L16.06,3.5M7.06,3.5L5.64,2.08L4.22,3.5L5.64,4.92L7.06,3.5M12,6A4,4 0 0,1 16,10V16H13V22H11V16H8V10A4,4 0 0,1 12,6Z"/></svg> Start: <strong>${startStr}</strong></span>` : ""}
        ${endStr   ? `<span>✅ End: <strong>${endStr}</strong></span>`      : ""}
      </div>` : "";

    return `
      <div class="plan-block" data-lp="${lpName}">
        <div class="plan-header">
          <span class="session-title">${this._t("chargePlan")}</span>
          ${planBadge}
        </div>
        ${projectionHtml}
        <div class="plan-inputs">
          ${vehicleSelectHtml}
          <div class="plan-row">
            <label>${this._t("finishBy")}</label>
            <input type="datetime-local" class="plan-time-input"
                   value="${defaultDt}" data-lp="${lpName}" />
          </div>
          <div class="plan-row">
            <label>${this._t("targetSoc")}</label>
            <div class="plan-soc-control">
              <input type="range" class="plan-soc-range"
                     min="20" max="100" step="5" value="${defaultSoc}"
                     data-lp="${lpName}" />
              <span class="plan-soc-val">${defaultSoc} %</span>
            </div>
          </div>
        </div>
        <div class="plan-actions">
          <button class="plan-btn save" data-lp="${lpName}">${this._t("setPlan")}</button>
          ${(planActive || (planTime && planTime !== "unknown" && planTime !== "unavailable"))
            ? `<button class="plan-btn delete" data-lp="${lpName}">${this._t("deletePlan")}</button>`
            : ""}
        </div>
      </div>
    `;
  }

  _renderSessionInfo(ents) {
    const hasAny = ents.session_energy || ents.session_price || ents.charge_duration;
    if (!hasAny) return "";

    const energy = ents.session_energy
      ? (() => {
          const v = parseFloat(stateVal(this._hass, ents.session_energy));
          return isNaN(v) ? "—" : `${v.toFixed(2)} kWh`;
        })() : null;

    const price = ents.session_price
      ? (() => {
          const v    = parseFloat(stateVal(this._hass, ents.session_price));
          const unit = unitStr(this._hass, ents.session_price) || "€";
          return isNaN(v) ? "—" : `${v.toFixed(2)} ${unit}`;
        })() : null;

    const duration = ents.charge_duration
      ? (() => {
          const raw = stateVal(this._hass, ents.charge_duration);
          let totalSec;
          if (raw && raw.includes(":")) {
            const parts = raw.split(":").map(Number);
            totalSec = parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
          } else {
            totalSec = parseFloat(raw) || 0;
          }
          const h   = Math.floor(totalSec / 3600);
          const min = Math.floor((totalSec % 3600) / 60);
          if (h > 0) return `${h} h ${min} min`;
          if (min > 0) return `${min} min`;
          return `< 1 min`;
        })() : null;

    const phases = ents.phases_active
      ? stateVal(this._hass, ents.phases_active) : null;

    const items = [
      energy   ? `<div class="session-item"><span class="si-label">${this._t("energy")}</span><span class="si-value">${energy}</span></div>`   : "",
      price    ? `<div class="session-item"><span class="si-label">${this._t("cost")}</span><span class="si-value">${price}</span></div>`     : "",
      duration ? `<div class="session-item"><span class="si-label">${this._t("duration")}</span><span class="si-value">${duration}</span></div>`   : "",
      phases   ? `<div class="session-item"><span class="si-label">${this._t("phases")}</span><span class="si-value">${phases}</span></div>`    : "",
    ].filter(Boolean);

    return `
      <div class="session-block">
        <div class="session-title">${this._t("chargeSession")}</div>
        <div class="session-grid">${items.join("")}</div>
      </div>
    `;
  }

  _renderPlanMode(loadpoints) {
    if (Object.keys(loadpoints).length === 0) return this._renderEmpty(loadpoints);
    return Object.entries(loadpoints).map(([lpName, ents]) => {
      const planHtml    = this._renderPlanBlock(lpName, ents, true);
      const sessionHtml = this._renderSessionInfo(ents);
      if (!planHtml) return "";
      return `
        <div class="loadpoint">
          <div class="lp-header">
            <span class="lp-name">${lpName}</span>
          </div>
          ${planHtml}
          ${sessionHtml}
        </div>`;
    }).join("");
  }

  _renderSiteBlock(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };
    const kwh = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;
    const ct  = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;

    const pvNameFromEntity = (entityId) => entityId ? (attr(this._hass, entityId, "title") ?? null) : null;
    const pvSources = [
      { key: "pv_0_power", energyKey: "pv_0_energy", idx: 1 },
      { key: "pv_1_power", energyKey: "pv_1_energy", idx: 2 },
      { key: "pv_2_power", energyKey: "pv_2_energy", idx: 3 },
      { key: "pv_3_power", energyKey: "pv_3_energy", idx: 4 },
    ].filter(s => site[s.key]).map(s => ({
      ...s,
      label: pvNameFromEntity(site[s.key]) ?? `PV ${s.idx}`,
    }));
    const pvPow = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const pvKwh = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + (kwh(site[s.energyKey]) ?? 0), 0)
      : kwh(site.pv_energy);
    const gridPow = kw(site.grid_power);
    const battPow = kw(site.battery_power);
    const homePow = kw(site.home_power);

    const chargePow = Object.values(loadpoints)
      .reduce((sum, ents) => sum + kw(ents.charge_power), 0);

    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;

    const totalIn  = Math.max(pvPow + battDischPow + bezugPow, 0.001);

    const pvPct      = Math.round(pvPow      / totalIn * 100);
    const battDPct   = Math.round(battDischPow / totalIn * 100);
    const gridInPct  = Math.round(bezugPow   / totalIn * 100);

    const houseOnlyPow = homePow;
    const totalOut = Math.max(houseOnlyPow + chargePow + battChargePow + feedinPow, 0.001);
    const homePct   = Math.round(houseOnlyPow  / totalOut * 100);
    const chargePct = Math.round(chargePow     / totalOut * 100);
    const battCPct  = Math.round(battChargePow / totalOut * 100);
    const feedinPct = Math.round(feedinPow     / totalOut * 100);

    const fmt     = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const useWatt = Math.max(totalIn, totalOut) < 1;
    const fmtPow  = v => useWatt ? `${Math.round(v * 1000)} W` : `${fmt(v)} kW`;
    const fmtKw   = v => `${fmt(v)} kW`;
    const fmtKwh  = v => v === null ? "–" : `${fmt(v)} kWh`;

    const batterySoc = kwh(site.battery_soc);
    const gridKwh    = kwh(site.grid_energy);
    const exportKwh  = kwh(site.grid_energy_export);
    const battCKwh   = kwh(site.battery_energy_charge);
    const battDKwh   = kwh(site.battery_energy_discharge);
    const homeKwh    = kwh(site.home_energy);

    const tariffGrid   = ct(site.tariff_grid);
    const tariffFeedin = ct(site.tariff_feedin);

    const hasBatt   = site.battery_power && (battDischPow > 0.05 || battChargePow > 0.05);
    const hasGrid   = bezugPow > 0.05 || feedinPow > 0.05;
    const hasPV     = pvPow > 0.05;
    const hasCharge = chargePow > 0.05;

    const segments = [
      { cls: "seg-pv",      pct: pvPct,     label: fmtPow(pvPow),       color: "var(--evcc-green)",  show: hasPV },
      { cls: "seg-battd",   pct: battDPct,  label: fmtPow(battDischPow),color: "var(--evcc-orange)", show: battDischPow > 0.05 },
      { cls: "seg-gridin",  pct: gridInPct, label: fmtPow(bezugPow),    color: "var(--evcc-red)",    show: bezugPow > 0.05 },
    ].filter(s => s.pct > 0);;

    const segTotal = segments.reduce((s, x) => s + x.pct, 0);
    if (segTotal > 0 && segTotal !== 100) {
      const scale = 100 / segTotal;
      segments.forEach(s => s.pct = Math.round(s.pct * scale));
      const diff = 100 - segments.reduce((s, x) => s + x.pct, 0);
      if (segments.length) segments[segments.length - 1].pct += diff;
    }

    const topLabels = [
      hasPV         ? { icon: "☀️",  val: fmtKw(pvPow),        pct: pvPct / 2 } : null,
      battDischPow > 0.05 ? { icon: "🔋↑", val: fmtKw(battDischPow), pct: pvPct + battDPct / 2 } : null,
      bezugPow > 0.05     ? { icon: "⚡↓", val: fmtKw(bezugPow),     pct: pvPct + battDPct + gridInPct / 2 } : null,
    ].filter(Boolean);

    const bottomSegs = [
      { icon: "🏠",  val: fmtPow(houseOnlyPow), pct: homePct,   show: houseOnlyPow > 0.05 },
      { icon: "🔌",  val: fmtPow(chargePow),     pct: chargePct, show: hasCharge },
      { icon: "🔋",  val: fmtPow(battChargePow), pct: battCPct,  show: battChargePow > 0.05 },
      { icon: "🗼",  val: fmtPow(feedinPow),     pct: feedinPct, show: feedinPow > 0.05 },
    ].filter(s => s.show);

    let cumPct = 0;
    bottomSegs.forEach(s => {
      s.midPct = cumPct + s.pct / 2;
      cumPct += s.pct;
    });

    const SVG_W        = 1000;
    const LABEL_W      = 60;
    const BRACE_TOP_H  = 52;
    const BAR_H        = 48;
    const BRACE_BOT_H  = 52;
    const BAR_Y        = BRACE_TOP_H;
    const BAR_X0       = 0;
    const BAR_X1       = SVG_W - LABEL_W;
    const BAR_W        = BAR_X1 - BAR_X0;
    const SVG_H        = BRACE_TOP_H + BAR_H + BRACE_BOT_H;
    const R            = 5;
    const TICK         = 7;

    const TOP_TIP_Y    = BAR_Y - BRACE_TOP_H + 10;
    const BOT_TIP_Y    = BAR_Y + BAR_H + BRACE_BOT_H - 10;

    const COL_BRACE    = "currentColor";
    const COL_TEXT     = "currentColor";
    const COL_LABEL    = "currentColor";

    const bracePath = (x0, x1, barEdgeY, tipY) => {
      const yEnd = barEdgeY + (tipY > barEdgeY ? TICK : -TICK);
      return [
        `M ${x0} ${barEdgeY}`,
        `L ${x0} ${yEnd}`,
        `Q ${x0} ${tipY} ${(x0 + x1) / 2} ${tipY}`,
        `Q ${x1} ${tipY} ${x1} ${yEnd}`,
        `L ${x1} ${barEdgeY}`,
      ].join(" ");
    };

    let cumX = BAR_X0;
    const segsWithX = segments.map(s => {
      const w  = Math.round(s.pct / 100 * BAR_W);
      const x0 = cumX;
      const x1 = cumX + w;
      cumX = x1;
      return { ...s, x0, x1, xMid: (x0 + x1) / 2, w };
    });
    if (segsWithX.length) segsWithX[segsWithX.length - 1].x1 = BAR_X1;

    let cumXB = BAR_X0;
    const botSegsWithX = bottomSegs.map(s => {
      const w  = Math.round(s.pct / 100 * BAR_W);
      const x0 = cumXB;
      const x1 = cumXB + w;
      cumXB = x1;
      return { ...s, x0, x1, xMid: (x0 + x1) / 2 };
    });
    if (botSegsWithX.length) botSegsWithX[botSegsWithX.length - 1].x1 = BAR_X1;
    botSegsWithX.forEach(s => { s.xMid = (s.x0 + s.x1) / 2; });

    const barRects = segsWithX.map(s =>
      `<rect x="${s.x0}" y="${BAR_Y}" width="${s.x1 - s.x0}" height="${BAR_H}" fill="${s.color}" />`
    ).join("");

    const barClip = `
      <defs>
        <clipPath id="bar-clip">
          <rect x="${BAR_X0}" y="${BAR_Y}" width="${BAR_W}" height="${BAR_H}" rx="${R}" ry="${R}" />
        </clipPath>
      </defs>
      <g clip-path="url(#bar-clip)">${barRects}</g>`;

    const barDividers = segsWithX.slice(0, -1).map(s =>
      `<line x1="${s.x1}" y1="${BAR_Y}" x2="${s.x1}" y2="${BAR_Y + BAR_H}"
             stroke="rgba(0,0,0,0.20)" stroke-width="2" />`
    ).join("");

    const barLabels = segsWithX.map(s => {
      if (s.w < 80) return "";
      return `<text x="${s.xMid}" y="${BAR_Y + BAR_H / 2 + 8}"
                    text-anchor="middle" font-size="24" font-weight="700"
                    fill="rgba(255,255,255,0.95)">${s.label}</text>`;
    }).join("");

    const MDI = {
      solar:   "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      battery: "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      tower:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:    "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:      "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      solpan:  "M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z",
      heat:    "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };
    const srcPathMap = { "seg-pv": MDI.solar, "seg-battd": MDI.battery, "seg-gridin": MDI.tower };
    segsWithX.forEach(s => { s.srcPath = srcPathMap[s.cls] || ""; });
    const botPathMap = { "🏠": MDI.home, "🔌": MDI.ev, "🔋": MDI.battery, "🗼": MDI.tower };
    botSegsWithX.forEach(s => { s.mdiPath = botPathMap[s.icon] || ""; });

    const SVG_ICON_HALF = 12;

    const topBraces = segsWithX.map(s => {
      const path  = bracePath(s.x0 + 2, s.x1 - 2, BAR_Y, TOP_TIP_Y);
      const ix = s.xMid - SVG_ICON_HALF, iy = TOP_TIP_Y - SVG_ICON_HALF;
      return `
        <path d="${path}" fill="none"
              style="stroke:var(--primary-text-color,#212121);opacity:0.45"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g transform="translate(${ix},${iy})" style="opacity:0.85">
          <path d="${s.srcPath}" style="fill:var(--primary-text-color,#212121)" />
        </g>`;
    }).join("");

    const botBraces = botSegsWithX.map(s => {
      const path  = bracePath(s.x0 + 2, s.x1 - 2, BAR_Y + BAR_H, BOT_TIP_Y);
      const ix = s.xMid - SVG_ICON_HALF, iy = BOT_TIP_Y - SVG_ICON_HALF;
      return `
        <path d="${path}" fill="none"
              style="stroke:var(--primary-text-color,#212121);opacity:0.45"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g transform="translate(${ix},${iy})" style="opacity:0.85">
          <path d="${s.mdiPath}" style="fill:var(--primary-text-color,#212121)" />
        </g>`;
    }).join("");

    const LX = BAR_X1 + 18;
    const sideLabels = `
      <text x="${LX}" y="${TOP_TIP_Y}" text-anchor="start" dominant-baseline="central"
            font-size="19" font-weight="700"
            style="fill:var(--secondary-text-color,#757575)">IN</text>
      <text x="${LX}" y="${BOT_TIP_Y}" text-anchor="start" dominant-baseline="central"
            font-size="19" font-weight="700"
            style="fill:var(--secondary-text-color,#757575)">OUT</text>`;

    const flowBar = `
      <div class="flow-wrap">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%"
             style="display:block;overflow:visible;font-family:inherit">
          ${barClip}
          ${barDividers}
          ${barLabels}
          ${topBraces}
          ${botBraces}
          ${sideLabels}
        </svg>
      </div>
    `;

    const row = (icon, label, sub, pw, pwClass = "", indent = false) => `
      <div class="site-row ${indent ? "site-row-indent" : ""}">
        <span class="site-row-icon">${icon}</span>
        <span class="site-row-label">
          <span class="site-row-name">${label}</span>
          ${sub ? `<span class="site-row-sub">${sub}</span>` : ""}
        </span>
        <span class="site-row-pw ${pwClass}">${fmtPow(pw)}</span>
      </div>`;

    const section = (title, total, rows) => `
      <div class="site-section">
        <div class="site-section-head">
          <span class="site-section-title">${title}</span>
          <span class="site-section-total">${fmtPow(total)}</span>
        </div>
        ${rows}
      </div>`;

    const inTotal  = pvPow + battDischPow + bezugPow;
    const outTotal = homePow + chargePow + battChargePow + feedinPow;

    const lpRows = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow  = kw(ents.charge_power);
        const unit   = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const val    = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        const label  = val ? `${lpName.toUpperCase()} – ${val}` : lpName.toUpperCase();
        const icon   = unit.includes("°")
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z"/></svg>`;
        return row(icon, label, "", lpPow, "site-pw-blue", true);
      }).join("");

    const pvRows = pvSources.length > 1
      ? pvSources.map(s => {
          const p = kw(site[s.key]);
          return p > 0.005 ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z\"/></svg>", s.label, "", p, "site-pw-green", true) : "";
        }).join("")
      : "";

    const inSection = section(this._t("in") || "In", inTotal, [
      row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z\"/></svg>", this._t("generation"), "", pvPow, "site-pw-green"),
      pvRows,
      battDischPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>",
              batterySoc !== null ? `${this._t("battDischarge")} – ${Math.round(batterySoc)} %` : this._t("battDischarge"),
              "", battDischPow) : "",
      bezugPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z\"/></svg>", this._t("gridImport"), "", bezugPow) : "",
    ].join(""));

    const outSection = section(this._t("out") || "Out", outTotal, [
      row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z\"/></svg>", this._t("consumption"), "", homePow),
      chargePow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z\"/></svg>", this._t("chargePoint"), "", chargePow, "site-pw-blue") + lpRows : "",
      battChargePow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>",
              batterySoc !== null ? `${this._t("battCharge")} – ${Math.round(batterySoc)} %` : this._t("battCharge"),
              "", battChargePow) : "",
      feedinPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z\"/></svg>", this._t("gridExport"), "", feedinPow, "site-pw-yellow") : "",
    ].join(""));

    const siteExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");

    return `
      <div class="site-block">
        <div class="lp-header">
          <span class="lp-name">${this._t("energyFlow")}</span>
        </div>
        <div class="flow-wrap-clickable" role="button" tabindex="0"
             onclick="window.__evccCards.get('${this._cardId}')._toggleSite()"
             title="${siteExpanded ? this._tInline("siteCollapse") : this._tInline("siteExpand")}">
          ${flowBar}
        </div>
        <div class="site-table" style="${siteExpanded ? '' : 'display:none'}">
          ${inSection}
          <div class="site-section-gap"></div>
          ${outSection}
        </div>
        ${this._renderStatsFooter()}
      </div>`;
  }

  _renderSiteBlock2(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };

    const pvSources = [
      { key: "pv_0_power" }, { key: "pv_1_power" },
      { key: "pv_2_power" }, { key: "pv_3_power" },
    ].filter(s => site[s.key]);

    const pvPow         = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const gridPow       = kw(site.grid_power);
    const battPow       = kw(site.battery_power);
    const homePow       = kw(site.home_power);
    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;

    const totalIn = pvPow + battDischPow + bezugPow;
    const pvShare = totalIn > 0.05 ? Math.round(pvPow / totalIn * 100) : 0;

    const fmt   = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const fmtKw = v => `${fmt(v)} kW`;

    const importing = bezugPow > 0.05;
    const exporting = feedinPow > 0.05;
    const netColor  = importing ? "var(--evcc-red)" : exporting ? "var(--evcc-green)" : "var(--secondary-text-color)";
    const netAbs    = importing ? bezugPow : feedinPow;
    const netValStr = (importing || exporting)
      ? `${importing ? "+" : "−"}${fmtKw(netAbs)}`
      : "–";
    const netLabel  = importing
      ? this._t("gridImport")
      : exporting
        ? this._t("gridExport")
        : this._t("gridNeutral") || "–";

    const pvBadge = pvShare > 0
      ? `<div class="s2-pv-badge">
           <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>
           ${pvShare} % Solar
         </div>`
      : "";

    const chip = (dot, label, sub) =>
      `<div class="s2-chip">
        <span class="s2-chip-dot" style="background:${dot}"></span>
        <span class="s2-chip-name">${label}</span>
        ${sub ? `<span class="s2-chip-sub">${sub}</span>` : ""}
      </div>`;

    const lpChips = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow = kw(ents.charge_power);
        const unit  = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const soc   = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        return chip("var(--evcc-blue)", lpName.toUpperCase(), soc ? `${fmtKw(lpPow)} · ${soc}` : fmtKw(lpPow));
      }).join("");

    const srcChips = [
      pvPow        > 0.05 ? chip("var(--evcc-green)",  this._t("generation"),    fmtKw(pvPow))        : "",
      bezugPow     > 0.05 ? chip("var(--evcc-red)",   this._t("gridImport"),    fmtKw(bezugPow))     : "",
      battDischPow > 0.05 ? chip("var(--evcc-orange)",this._t("battDischarge"), fmtKw(battDischPow)) : "",
    ].filter(Boolean).join("");

    const dstChips = [
      homePow      > 0.05 ? chip("var(--secondary-text-color)", this._t("consumption"), fmtKw(homePow))       : "",
      lpChips,
      battChargePow > 0.05 ? chip("var(--evcc-orange)", this._t("battCharge"),  fmtKw(battChargePow)) : "",
      feedinPow    > 0.05 ? chip("var(--evcc-yellow)", this._t("gridExport"),   fmtKw(feedinPow))     : "",
    ].filter(Boolean).join("");

    const section = (labelKey, chips) => chips
      ? `<div class="s2-section">
           <div class="s2-section-label">${this._t(labelKey)}</div>
           <div class="s2-chips">${chips}</div>
         </div>`
      : "";

    return `
      <div class="s2-block">
        <div class="lp-header">
          <span class="lp-name">${this._t("energyFlow")}</span>
        </div>
        <div class="s2-net">
          <div class="s2-net-label">${this._t("gridStatus") || "Netzstatus"}</div>
          <div class="s2-net-value" style="color:${netColor}">${netValStr}</div>
          <div class="s2-net-status" style="color:${netColor}">${netLabel}</div>
          ${pvBadge}
        </div>
        ${section("generation", srcChips)}
        ${section("consumption", dstChips)}
        ${this._renderStatsFooter()}
      </div>`;
  }

  _getStatEntityIds(period) {
    const per    = period ?? this._statsPeriod ?? "total";
    const base   = `sensor.${this._config.prefix || "evcc_"}`;
    const find   = id => this._hass?.states[id] ? id : null;
    const sufMap = {
      total:    { kwh: "stat_total_charged_kwh",    solar: "stat_total_solar_percentage",    price: "stat_total_avg_price"    },
      "30d":    { kwh: "stat30_charged_kwh",         solar: "stat30_solar_percentage",         price: "stat30_avg_price"         },
      "365d":   { kwh: "stat365_charged_kwh",        solar: "stat365_solar_percentage",        price: "stat365_avg_price"        },
      thisYear: { kwh: "stat_this_year_charged_kwh", solar: "stat_this_year_solar_percentage", price: "stat_this_year_avg_price" },
    };
    const s = sufMap[per] ?? sufMap.total;
    return {
      kwhId:   find(`${base}${s.kwh}`),
      solarId: find(`${base}${s.solar}`),
      priceId: find(`${base}${s.price}`),
    };
  }

  _renderStatsPeriodTabs(size = "normal") {
    const cur  = this._statsPeriod ?? "total";
    const defs = [
      { key: "30d",      tKey: "statsPeriod30d"      },
      { key: "365d",     tKey: "statsPeriod365d"     },
      { key: "thisYear", tKey: "statsPeriodThisYear" },
      { key: "total",    tKey: "statsPeriodTotal"    },
    ];
    const btns = defs.map(d =>
      `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-period="${d.key}">${this._t(d.tKey)}</button>`
    ).join("");
    return `<div class="stats-period-tabs${size === "small" ? " stats-period-tabs--small" : ""}">${btns}</div>`;
  }

  _maybeRefreshStats() {
    const period = this._statsPeriod ?? "total";
    const age = Date.now() - (this._chartCacheTime[period] ?? 0);
    if (age > 5 * 60 * 1000) {
      this._chartCacheTime[period] = Date.now();
      this._fetchChartData(period);
    }
  }

  async _fetchChartData(period) {
    const { kwhId, solarId } = this._getStatEntityIds("total"); // always use cumulative total entity
    if (!kwhId) return;

    const now   = new Date();
    let startTime, recorderPeriod;

    if (period === "30d") {
      startTime = new Date(now);
      startTime.setDate(startTime.getDate() - 31);
      startTime.setHours(0, 0, 0, 0);
      recorderPeriod = "day";
    } else if (period === "365d") {
      startTime = new Date(now.getFullYear(), now.getMonth() - 14, 1);
      recorderPeriod = "month";
    } else if (period === "thisYear") {
      startTime = new Date(now.getFullYear(), 0, 1);
      recorderPeriod = "month";
    } else { // total
      startTime = new Date(2010, 0, 1);
      recorderPeriod = "month";
    }

    try {
      const statIds = solarId ? [kwhId, solarId] : [kwhId];
      const result = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: startTime.toISOString(),
        statistic_ids: statIds,
        period: recorderPeriod,
        types: solarId ? ["sum", "mean"] : ["sum"],
      });
      const stats      = result[kwhId]  ?? [];
      const solarStats = solarId ? (result[solarId] ?? []) : [];

      if      (period === "30d")      this._chartCache[period] = this._computeDailyDeltas(stats, 30, solarStats);
      else if (period === "365d")     this._chartCache[period] = this._computeMonthlyDeltas(stats, 13, solarStats);
      else if (period === "thisYear") this._chartCache[period] = this._computeThisYearMonthly(stats, solarStats);
      else {
        const yearly = this._computeYearlyTotals(stats, solarStats);
        this._chartCache[period] = yearly.length <= 1
          ? this._computeThisYearMonthly(stats, solarStats)  // only one year of data → show months
          : yearly;
      }

      this._render();
    } catch(e) {
      console.warn("[evcc-card] chart error", e);
    }
  }

  _computeDailyDeltas(stats, days, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { if (s.mean != null) solarByKey[toKey(s.start)] = s.mean; });
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const prevDay = new Date(day);
      prevDay.setDate(prevDay.getDate() - 1);
      const cur   = byKey[toKey(day)];
      const prev  = byKey[toKey(prevDay)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const solar = solarByKey[toKey(day)] ?? null;
      const labelStr = day.toLocaleDateString(lang, { day: "numeric", month: "numeric" });
      result.push({ delta, label: day, labelStr, isCurrent: i === 0, solar });
    }
    return result;
  }

  _computeMonthlyDeltas(stats, count, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { if (s.mean != null) solarByKey[toKey(s.start)] = s.mean; });
    const result = [];
    for (let i = count - 1; i >= 0; i--) {
      const month     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      const cur   = byKey[toKey(month)];
      const prev  = byKey[toKey(prevMonth)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const solar = solarByKey[toKey(month)] ?? null;
      const labelStr = month.toLocaleDateString(lang, { month: "short" });
      result.push({ delta, label: month, labelStr, isCurrent: i === 0, solar });
    }
    return result;
  }

  _computeThisYearMonthly(stats, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now  = new Date();
    const year = now.getFullYear();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { if (s.mean != null) solarByKey[toKey(s.start)] = s.mean; });
    const result = [];
    for (let m = 0; m <= now.getMonth(); m++) {
      const month     = new Date(year, m, 1);
      const prevMonth = new Date(year, m - 1, 1);
      const cur   = byKey[toKey(month)];
      const prev  = byKey[toKey(prevMonth)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const solar = solarByKey[toKey(month)] ?? null;
      const labelStr = month.toLocaleDateString(lang, { month: "short" });
      result.push({ delta, label: month, labelStr, isCurrent: m === now.getMonth(), solar });
    }
    return result;
  }

  _computeYearlyTotals(stats, solarStats = []) {
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { if (s.mean != null) solarByKey[toKey(s.start)] = s.mean; });
    const years = [...new Set(stats.map(s => new Date(s.start).getFullYear()))].sort();
    return years.map(year => {
      let yearTotal = 0, hasAny = false;
      for (let m = 0; m <= 11; m++) {
        const cur  = byKey[`${year}-${m}`];
        const prev = byKey[m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`];
        if (cur != null && prev != null) { yearTotal += Math.max(0, cur - prev); hasAny = true; }
      }
      // Average the monthly mean values of stat_total_solar_percentage within this year
      const solarVals = [];
      for (let m = 0; m <= 11; m++) {
        const v = solarByKey[`${year}-${m}`];
        if (v != null) solarVals.push(v);
      }
      const solar = solarVals.length > 0 ? solarVals.reduce((a, b) => a + b, 0) / solarVals.length : null;
      return { delta: hasAny ? yearTotal : null, label: new Date(year, 0, 1), labelStr: String(year), isCurrent: year === now.getFullYear(), solar };
    });
  }

  _renderBarChart(data) {
    const W = 280, VALUE_H = 22, BAR_H = 55, LABEL_H = 32, TOTAL_H = VALUE_H + BAR_H + LABEL_H + 4;
    const n = data.length, GAP = 2;
    const barW = Math.floor((W - (n - 1) * GAP) / n);
    const maxVal = Math.max(...data.map(d => d.delta ?? 0), 0.1);

    const bars = data.map((d, i) => {
      const x          = i * (barW + GAP);
      const isCurrent  = d.isCurrent ?? (i === n - 1);
      let h = 0, y = VALUE_H + BAR_H;
      if (d.delta !== null && d.delta > 0) {
        h = Math.max(2, Math.round((d.delta / maxVal) * BAR_H));
        y = VALUE_H + BAR_H - h;
      }
      const valLabel = (d.delta !== null && d.delta > 0)
        ? `<text transform="translate(${x + barW / 2}, ${y - 2}) rotate(-45)"
                text-anchor="start" font-size="6.5" fill="var(--secondary-text-color,#888)"
                opacity="${isCurrent ? "1" : "0.75"}">${d.delta.toFixed(1)}</text>`
        : "";
      return `${valLabel}
              <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h,1)}"
                    fill="var(--primary-color,#3b82f6)" opacity="${isCurrent ? "0.7" : "0.3"}" rx="1.5"/>
              <text transform="translate(${x + barW / 2}, ${VALUE_H + BAR_H + 4}) rotate(90)"
                    text-anchor="start" font-size="7" fill="var(--secondary-text-color,#888)"
                    opacity="${isCurrent ? "1" : "0.75"}">${d.labelStr}</text>`;
    }).join("");

    // Solar % trend line — drawn over bars when per-bar solar data is available
    const solarPts = data
      .map((d, i) => d.solar != null
        ? { x: i * (barW + GAP) + barW / 2, y: VALUE_H + BAR_H - (d.solar / 100) * BAR_H }
        : null)
      .filter(Boolean);
    const solarOverlay = solarPts.length >= 2 ? (() => {
      const pts  = solarPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      const dots = solarPts.map(p =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="1.0"
                 fill="var(--evcc-green,#22c55e)" opacity="0.7"/>`).join("");
      return `<polyline points="${pts}" fill="none" stroke="var(--evcc-green,#22c55e)"
                        stroke-width="1.0" stroke-linejoin="round" opacity="0.6"/>${dots}`;
    })() : "";

    return `<svg viewBox="0 0 ${W} ${TOTAL_H}" style="width:100%;display:block">${bars}${solarOverlay}</svg>`;
  }

  _renderStatsFooter() {
    const period = this._config.stats_period ?? "total";
    const { kwhId, solarId, priceId } = this._getStatEntityIds(period);
    if (!kwhId && !solarId && !priceId) return "";

    const val = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const kwh   = val(kwhId);
    const solar = val(solarId);
    const price = val(priceId);

    const items = [
      kwhId   ? `<span class="sf-item"><span class="sf-val">${Math.round(kwh)} kWh</span><span class="sf-lbl">${this._t("statsTotalCharged")}</span></span>` : "",
      solarId ? `<span class="sf-item"><span class="sf-val" style="color:var(--evcc-green)">${Math.round(solar)} %</span><span class="sf-lbl">${this._t("statsSolarShare")}</span></span>` : "",
      priceId ? `<span class="sf-item"><span class="sf-val">${(price * 100).toFixed(1)} ct</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
    ].filter(Boolean);

    if (items.length === 0) return "";
    return `<div class="stats-footer">${items.join('<span class="sf-sep"></span>')}</div>`;
  }

  _renderStatsBlock() {
    this._maybeRefreshStats();
    const { kwhId, solarId, priceId } = this._getStatEntityIds();

    const val = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const kwh   = val(kwhId);
    const solar = val(solarId);
    const price = val(priceId);

    const kpi = (v, label, fmt, color) => `
      <div class="stats-kpi">
        <div class="stats-kpi-val"${color ? ` style="color:${color}"` : ""}>${v !== null ? fmt(v) : "–"}</div>
        <div class="stats-kpi-lbl">${label}</div>
      </div>`;

    const kpis = [
      kpi(kwh,   this._t("statsTotalCharged") || "Geladen gesamt", v => `${Math.round(v)} kWh`, null),
      kpi(solar, this._t("statsSolarShare")   || "Solaranteil",    v => `${Math.round(v)} %`,   solar > 0 ? "var(--evcc-green)" : null),
      kpi(price, this._t("statsAvgPrice")     || "Ø Preis/kWh",    v => `${(v * 100).toFixed(1)} ct`, null),
    ].join("");

    const { kwhId: chartKwhId } = this._getStatEntityIds("total");
    const period     = this._statsPeriod ?? "total";
    const chartData  = this._chartCache[period];
    const chartTitle = this._t({ "30d": "statsPeriod30d", "365d": "statsPeriod365d", "thisYear": "statsPeriodThisYear", "total": "statsPeriodTotal" }[period]);
    const chart = chartKwhId ? `
      <div class="stats-chart-section">
        <div class="stats-chart-title">${chartTitle}</div>
        ${chartData
          ? this._renderBarChart(chartData)
          : '<div class="stats-chart-loading">…</div>'}
      </div>` : "";

    const noDataHint = (!kwhId && !solarId && !priceId && this._statsPeriod !== "total")
      ? `<div class="stats-no-data">${this._t("statsNoData")}</div>`
      : "";

    return `
      <div>
        <div class="lp-header">
          <span class="lp-name">${this._t("statistics")}</span>
        </div>
        ${this._renderStatsPeriodTabs()}
        ${noDataHint}
        <div class="stats-kpi-row">${kpis}</div>
        ${chart}
      </div>`;
  }

  _renderBatteryBlock(site) {
    const socId         = site.battery_soc;
    const powerId       = site.battery_power;
    const capId         = site.battery_capacity;
    const dischargeId   = site.battery_discharge_control;
    const prioritySocId = site.priority_soc;
    const bufferSocId   = site.buffer_soc;

    if (!socId) return "";

    const soc         = parseFloat(stateVal(this._hass, socId)) || 0;
    const power       = powerId ? parseFloat(stateVal(this._hass, powerId)) || 0 : null;
    const cap         = capId   ? parseFloat(stateVal(this._hass, capId))   || 0 : null;
    const dischargeOn = dischargeId ? isOn(this._hass, dischargeId) : null;
    const socColor    = soc > 80 ? "var(--evcc-green)" : soc > 30 ? "var(--evcc-blue)" : "var(--evcc-amber)";

    const getVal  = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const getOpts = id => id ? (attr(this._hass, id, "options") ?? [])
      .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b) : [];

    const priorityVal = getVal(prioritySocId);
    const bufferVal   = getVal(bufferSocId);

    const inlineSlider = (entityId, val) => {
      if (!entityId || val === null) return "";
      const opts = getOpts(entityId);
      const min  = opts[0] ?? 0;
      const max  = opts[opts.length - 1] ?? 100;
      const step = opts.length > 1 ? opts[1] - opts[0] : 5;
      return `<span class="batt-inline-val"
                    data-batt-inline="${entityId}"
                    data-min="${min}" data-max="${max}" data-step="${step}"
                    data-val="${val}">${val} %</span>`;
    };

    const splitPct    = priorityVal ?? 0;
    const carZonePct  = 100 - splitPct;
    const hausZonePct = splitPct;
    const socFillH    = Math.min(soc, 100);

    const visual = `
      <div class="batt-visual">
        <div class="batt-cap-tip"></div>
        <div class="batt-body">
          ${splitPct > 0 && splitPct < 100 ? `
            <div class="batt-zone batt-zone-car" style="flex:${carZonePct}">
              <span class="batt-zone-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="rgba(255,255,255,0.5)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
            </div>
            <div class="batt-divider-line"></div>
            <div class="batt-zone batt-zone-haus" style="flex:${hausZonePct}">
              <span class="batt-zone-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="rgba(255,255,255,0.5)"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg></span>
            </div>` : `
            <div class="batt-zone batt-zone-car" style="flex:1">
              <span class="batt-zone-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="rgba(255,255,255,0.5)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
            </div>`}
          <div class="batt-soc-overlay" style="height:${socFillH}%;background:${socColor}"></div>
        </div>
      </div>`;

    const powerStr = power !== null
      ? (Math.abs(power) < 50 ? this._t("battReady")
        : `${(Math.abs(power)/1000).toFixed(2)} kW ${power > 0 ? "↑" : "↓"}`)
      : "";
    const info = `
      <div class="batt-info-col">
        <div class="batt-info-label">${this._t("battLevel")}</div>
        <div class="batt-info-pct" style="color:${socColor}">${Math.round(soc)} %</div>
        ${cap ? `<div class="batt-info-kwh">${(soc/100*cap).toFixed(1)} kWh / ${cap} kWh</div>` : ""}
        ${powerStr ? `<div class="batt-info-power">${powerStr}</div>` : ""}
      </div>`;

    const dischargeHtml = dischargeOn !== null ? `
      <div class="batt-discharge-row">
        <button class="batt-discharge-toggle ${dischargeOn ? "on" : ""}"
                data-entity="${dischargeId}" data-domain="switch" data-on="${dischargeOn}">
          <span class="batt-toggle-knob"></span>
        </button>
        <span>${this._t("battDischargeLabel")}</span>
      </div>` : "";

    const tabUsage = `
      <div class="batt-usage-content">
        <div class="batt-main-row">
          <div class="batt-text-col">
            ${bufferSocId ? `
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="fill:var(--evcc-bolt)"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battBoostTitle")}</div>
                <div class="batt-text-desc">${this._t("battBoostDesc", { val: inlineSlider(bufferSocId, bufferVal) })}</div>
              </div>
            </div>` : ""}
            ${prioritySocId ? `
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="fill:var(--evcc-blue)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battCarPrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battCarPrioDesc", { val: inlineSlider(prioritySocId, priorityVal) })}</div>
              </div>
            </div>
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--secondary-text-color)"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battHomePrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battHomePrioDesc", { val: inlineSlider(prioritySocId, priorityVal) })}</div>
              </div>
            </div>` : ""}
          </div>
          <div class="batt-visual-col">
            ${bufferVal !== null ? `<span class="batt-marker-top">${bufferVal} %</span>` : ""}
            ${visual}
            ${info}
          </div>
        </div>
        ${dischargeHtml}
        <div class="batt-inline-popup" hidden>
          <input type="range" class="batt-inline-input" />
          <span class="batt-inline-label"></span>
        </div>
      </div>`;

    return `
      <div class="battery-block">
        <div class="lp-header">
          <span class="lp-name">${this._t("homeBattery")}</span>
        </div>
        ${tabUsage}
      </div>`;
  }

  _renderEmpty(allLoadpoints = {}) {
    const available = Object.keys(allLoadpoints);
    const hint = available.length > 0
      ? `<p>${this._t("availableLoadpoints", { list: `<code>${available.join(", ")}</code>` })}</p>`
      : "";
    return `
      <div class="empty">
        <p>${this._t("noLoadpoints")}</p>
        ${hint}
      </div>
    `;
  }

  _attachListeners() {
    this.shadowRoot.querySelectorAll("[data-lp-current-toggle]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const lpName   = btn.dataset.lpCurrentToggle;
        const expanded = this._currentBlockExpanded[lpName] === true;
        this._currentBlockExpanded[lpName] = !expanded;

        const block = this.shadowRoot.querySelector(`[data-lp-current="${lpName}"]`);
        if (!block) return;
        const body = block.querySelector(".current-block-body");
        if (body) {
          if (!expanded) body.removeAttribute("hidden");
          else body.setAttribute("hidden", "");
        }
        btn.classList.toggle("active", !expanded);
      });
    });

    this.shadowRoot.querySelectorAll("button.compact-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName   = btn.dataset.lp;
        const tabIdx   = parseInt(btn.dataset.tab);
        this._tabState[lpName] = tabIdx;

        const block = btn.closest("[data-lp-compact]");
        block.querySelectorAll("button.compact-tab").forEach((b, i) =>
          b.classList.toggle("active", i === tabIdx));
        block.querySelectorAll(".compact-panel").forEach((p, i) =>
          i === tabIdx ? p.removeAttribute("hidden") : p.setAttribute("hidden", ""));
      });
    });

    this.shadowRoot.querySelectorAll("button.stats-period-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._statsPeriod = btn.dataset.period;
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll("button.batt-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        block.querySelectorAll("button.batt-tab").forEach((b, i) =>
          b.classList.toggle("active", i === tabIdx));
        block.querySelectorAll(".batt-tab-content").forEach((c, i) =>
          i === tabIdx ? c.removeAttribute("hidden") : c.setAttribute("hidden", ""));
      });
    });

    this.shadowRoot.querySelectorAll("button.batt-discharge-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._hass.callService(domain, on ? "turn_off" : "turn_on", { entity_id: btn.dataset.entity });
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    this.shadowRoot.querySelectorAll(".batt-inline-val").forEach(span => {
      span.addEventListener("click", () => {
        const popup    = span.closest(".batt-usage-content").querySelector(".batt-inline-popup");
        const input    = popup.querySelector(".batt-inline-input");
        const label    = popup.querySelector(".batt-inline-label");
        const entityId = span.dataset.battInline;
        input.min   = span.dataset.min;
        input.max   = span.dataset.max;
        input.step  = span.dataset.step;
        input.value = span.dataset.val;
        label.textContent = `${span.dataset.val} %`;
        input.dataset.entity = entityId;
        popup.removeAttribute("hidden");
      });
      span.addEventListener("click", e => e.stopPropagation());
    });

    this.shadowRoot.querySelectorAll(".batt-inline-input").forEach(input => {
      input.addEventListener("pointerdown", () => { this._isDragging = true; });
      input.addEventListener("input", () => {
        const popup = input.closest(".batt-inline-popup");
        const label = popup.querySelector(".batt-inline-label");
        label.textContent = `${input.value} %`;
        this.shadowRoot.querySelectorAll(`.batt-inline-val[data-batt-inline="${input.dataset.entity}"]`)
          .forEach(s => { s.textContent = `${input.value} %`; s.dataset.val = input.value; });
      });
      input.addEventListener("pointerup", () => {
        this._isDragging = false;
        const opts = (attr(this._hass, input.dataset.entity, "options") ?? [])
          .map(o => parseFloat(o)).filter(o => !isNaN(o));
        const val     = parseFloat(input.value);
        const nearest = opts.length
          ? opts.reduce((p, c) => Math.abs(c - val) < Math.abs(p - val) ? c : p, opts[0])
          : val;
        this._hass.callService("select", "select_option", {
          entity_id: input.dataset.entity,
          option:    String(nearest),
        });
      });
    });

    const cardContent = this.shadowRoot.querySelector(".card-content");
    if (cardContent) {
      cardContent.addEventListener("click", (e) => {
        this.shadowRoot.querySelectorAll(".batt-inline-popup").forEach(p => p.setAttribute("hidden", ""));
      });
    } else {
      this.shadowRoot.addEventListener("click", () => {
        this.shadowRoot.querySelectorAll(".batt-inline-popup").forEach(p => p.setAttribute("hidden", ""));
      }, { capture: true });
    }

    this.shadowRoot.querySelectorAll("button.mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._hass.callService("select", "select_option", {
          entity_id: btn.dataset.entity,
          option:    btn.dataset.value,
        });
      });
    });

    this.shadowRoot.querySelectorAll("button.toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._hass.callService(domain, on ? "turn_off" : "turn_on", {
          entity_id: btn.dataset.entity,
        });
      });
    });

    this.shadowRoot.querySelectorAll("button.phase-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._hass.callService("select", "select_option", {
          entity_id: btn.dataset.entity,
          option:    btn.dataset.value,
        });
        const group = btn.closest(".phase-btn-group");
        if (group) {
          group.querySelectorAll(".phase-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        }
      });
    });

    this.shadowRoot.querySelectorAll("input[data-boost-entity]").forEach(input => {
      input.addEventListener("pointerdown", () => { this._isDragging = true; this._pendingRender = false; });
      input.addEventListener("input", () => {
        const val     = parseInt(input.value, 10);
        const display = input.nextElementSibling;
        if (!display) return;
        if (input.dataset.boostType === "switch") {
          display.textContent = val >= 50 ? "On" : "Off";
        } else {
          display.textContent = val === 100 ? "Off" : val === 0 ? "0 % (full discharge)" : `${val} %`;
        }
      });
      input.addEventListener("pointerup",  () => this._boostCommit(input));
      input.addEventListener("blur",       () => this._boostCommit(input));
    });

    this.shadowRoot.querySelectorAll("input.plan-soc-range").forEach(input => {
      input.addEventListener("pointerdown", () => {
        this._isDragging    = true;
        this._pendingRender = false;
      });
      input.addEventListener("input", () => {
        const lpName = input.dataset.lp;
        const val    = parseInt(input.value, 10);
        if (this._planState[lpName]) this._planState[lpName].soc = val;
        const span = input.nextElementSibling;
        if (span) span.textContent = `${val} %`;
      });
      input.addEventListener("pointerup", () => {
        this._isDragging = false;
        if (this._pendingRender) { this._pendingRender = false; this._render(); }
      });
      input.addEventListener("blur", () => {
        if (this._isDragging) {
          this._isDragging = false;
          if (this._pendingRender) { this._pendingRender = false; this._render(); }
        }
      });
    });

    this.shadowRoot.querySelectorAll("input.plan-time-input").forEach(input => {
      input.addEventListener("change", () => {
        const lpName = input.dataset.lp;
        if (this._planState[lpName]) this._planState[lpName].time = input.value;
      });
    });

    this.shadowRoot.querySelectorAll("select.plan-vehicle-select").forEach(sel => {
      sel.addEventListener("focus", () => {
        this._pendingRender = false;
        const eid = sel.dataset.entity;
        if (eid) console.info("[evcc-card] vehicle_name entity attrs:", this._hass.states[eid]?.attributes);
      });
      sel.addEventListener("blur", () => {
        this._isDragging = false;
        if (this._pendingRender) { this._pendingRender = false; this._render(); }
      });
      sel.addEventListener("change", () => {
        const lpName = sel.dataset.lp;
        if (this._planState[lpName]) this._planState[lpName].vehicle = sel.value;
      });
    });

    this.shadowRoot.querySelectorAll("button.plan-btn.save").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName  = btn.dataset.lp;
        const state   = this._planState[lpName] || {};
        const soc     = state.soc || 80;
        const dtValue = state.time || "";

        if (!dtValue) { alert(this._t("noTimeAlert")); return; }

        const showError = (msg) => {
          const block = btn.closest(".plan-block");
          let errEl = block.querySelector(".plan-error");
          if (!errEl) {
            errEl = document.createElement("div");
            errEl.className = "plan-error";
            block.querySelector(".plan-actions").after(errEl);
          }
          errEl.textContent = msg;
        };
        const showSuccess = () => {
          const block = btn.closest(".plan-block");
          const errEl = block.querySelector(".plan-error");
          if (errEl) errEl.remove();
          const badge = block.querySelector(".plan-badge");
          if (badge) { badge.textContent = this._t("planned"); badge.classList.remove("active"); badge.classList.add("planned"); }
        };

        const vehicleDbId = state.vehicle || null;
        const dt  = new Date(dtValue);
        const pad = n => String(n).padStart(2, "0");
        const startdate = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ` +
                          `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;

        const tryServices = async () => {
          let lastErr = null;
          if (vehicleDbId) {
            try {
              await this._hass.callService("evcc_intg", "set_vehicle_plan", { vehicle: vehicleDbId, soc, startdate });
              window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } }));
              showSuccess();
              return;
            } catch(e) { lastErr = e; }
          }
          try {
            await this._hass.callService("evcc_intg", "set_loadpoint_plan", { loadpoint: lpName, soc, startdate });
            window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } }));
            showSuccess();
            return;
          } catch(e) { lastErr = e; }
          showError(`❌ ${lastErr?.message || JSON.stringify(lastErr) || "Unknown error"}`);
        };
        tryServices();
      });
    });

    this.shadowRoot.querySelectorAll("button.plan-btn.delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName      = btn.dataset.lp;
        const planSt      = this._planState[lpName] || {};
        const vehicleDbId = planSt.vehicle || null;
        const block       = btn.closest(".plan-block");
        const resetBadge  = () => {
          const badge = block?.querySelector(".plan-badge");
          if (badge) { badge.textContent = this._t("noPlan"); badge.classList.remove("active", "planned"); }
        };
        if (vehicleDbId) {
          this._hass.callService("evcc_intg", "del_vehicle_plan", { vehicle: vehicleDbId })
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        } else {
          this._hass.callService("evcc_intg", "set_loadpoint_plan", { loadpoint: lpName, soc: 0, startdate: "" })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        }
      });
    });

    this.shadowRoot.querySelectorAll("input[type=range]:not(.plan-soc-range):not([data-boost-entity])").forEach(input => {
      input.addEventListener("pointerdown", () => {
        this._isDragging    = true;
        this._pendingRender = false;
      });
      input.addEventListener("input", () => {
        const span = input.nextElementSibling;
        if (span) span.textContent = `${input.value} ${displayUnit(this._hass, input.dataset.entity)}`;
      });
      input.addEventListener("pointerup", () => {
        this._isDragging = false;
        const domain   = input.dataset.domain;
        const entityId = input.dataset.entity;
        if (domain === "select") {
          const opts = (attr(this._hass, entityId, "options") ?? [])
            .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
          const target  = parseFloat(input.value);
          const nearest = opts.reduce((p, c) => Math.abs(c - target) < Math.abs(p - target) ? c : p, opts[0]);
          this._hass.callService("select", "select_option", { entity_id: entityId, option: String(nearest) });
        } else {
          this._hass.callService("number", "set_value", { entity_id: entityId, value: parseFloat(input.value) });
        }
        if (this._pendingRender) { this._pendingRender = false; this._render(); }
      });
      input.addEventListener("blur", () => {
        if (this._isDragging) {
          this._isDragging = false;
          if (this._pendingRender) { this._pendingRender = false; this._render(); }
        }
      });
    });
  }

  _styles() {
    return `
      :host {
        display: block;
        --evcc-green:  var(--success-color,  #22c55e);
        --evcc-red:    var(--error-color,    #ef4444);
        --evcc-amber:  var(--warning-color,  #f59e0b);
        --evcc-blue:   #3b82f6;
        --evcc-orange: #f97316;
        --evcc-yellow: #eab308;
        --evcc-gray:   var(--disabled-color, #6b7280);
        --evcc-bolt:   #facc15;
      }
      ha-card {
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
      }
      .card-content { padding: 12px 16px 16px; }

      .loadpoint {
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color, #e5e7eb);
        margin-bottom: 0;
      }
      .loadpoint:first-child { padding-top: 0; }
      .loadpoint:last-child { border-bottom: none; padding-bottom: 0; }
      .lp-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
      }
      .lp-name { font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
      .lp-badge {
        font-size: .75rem; font-weight: 600; padding: 2px 10px;
        border-radius: 999px; border: 1px solid currentColor;
      }
      .lp-badge.charging  { color: var(--evcc-green);  background: color-mix(in srgb, var(--evcc-green)  15%, transparent); }
      .lp-badge.connected { color: var(--evcc-blue);   background: color-mix(in srgb, var(--evcc-blue)   15%, transparent); }
      .lp-badge.ready     { color: var(--evcc-gray);   background: color-mix(in srgb, var(--evcc-gray)   15%, transparent); }

      .mode-row { display: flex; gap: 6px; margin-bottom: 12px; }
      .mode-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 8px 2px; min-width: 0;
        border: 1px solid var(--divider-color, #e5e7eb); border-radius: 8px;
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .7rem; transition: all .15s; overflow: hidden;
      }
      .mode-btn:hover { border-color: var(--primary-color); }
      .mode-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .mode-icon { display: flex; align-items: center; justify-content: center; line-height: 1; min-height: 20px; }
      .mode-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .soc-section { margin-bottom: 12px; }
      .soc-label-row {
        display: flex; justify-content: space-between;
        font-size: .85rem; margin-bottom: 6px; color: var(--secondary-text-color);
      }
      .vehicle-name { font-weight: 500; color: var(--primary-text-color); }
      .soc-track {
        position: relative; height: 8px;
        background: var(--divider-color, #e5e7eb); border-radius: 4px; overflow: visible;
      }
      @keyframes soc-pulse {
        0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; }
      }
      .soc-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
      .soc-fill.charging { animation: soc-pulse 1.4s ease-in-out infinite; }
      .soc-limit-marker {
        position: absolute; top: -3px; width: 3px; height: 14px;
        background: #22c55e; border-radius: 2px; transform: translateX(-50%);
      }
      .soc-min-marker {
        position: absolute; top: -3px; width: 3px; height: 14px;
        background: #f59e0b; border-radius: 2px; transform: translateX(-50%);
      }

      .power-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 12px; color: var(--secondary-text-color); flex-wrap: wrap; }
      .power-row.charging { color: #22c55e; }
      .power-value { font-size: 1.6rem; font-weight: 700; }
      .power-sep { font-size: .8rem; color: var(--secondary-text-color); align-self: flex-end; padding-bottom: .2rem; }
      .power-current { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }
      .power-phases  { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }

      .sliders { margin-bottom: 10px; }
      .slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: .83rem; flex-wrap: wrap; }
      .slider-row label { flex: 0 0 auto; min-width: 70px; white-space: nowrap; color: var(--secondary-text-color); }
      .slider-control { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 120px; }
      .slider-control input { flex: 1; min-width: 0; accent-color: var(--primary-color); }
      .slider-val { flex-shrink: 0; width: 52px; text-align: right; font-size: .8rem; }

      .toggles { margin-bottom: 10px; }
      .toggle-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      button.toggle {
        padding: 3px 14px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s;
      }
      button.toggle.on { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .current-block {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 10px; padding-top: 10px; margin-bottom: 10px;
      }
      .block-title-row {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
      }
      .block-title {
        font-size: .7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: .08em; color: var(--secondary-text-color);
      }
      .current-toggle-btn {
        background: transparent; border: none; border-radius: 50%;
        color: var(--secondary-text-color); cursor: pointer;
        padding: 3px; display: flex; align-items: center; justify-content: center;
        transition: color .15s, background .15s; margin: -3px;
      }
      .current-toggle-btn:hover {
        color: var(--primary-color);
        background: var(--secondary-background-color, rgba(0,0,0,.06));
      }
      .current-toggle-btn.active { color: var(--primary-color); }
      .current-block-body[hidden] { display: none; }

      .selects { margin-bottom: 10px; }
      .select-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      .phase-btn-group { display: flex; gap: 4px; }
      button.phase-btn {
        padding: 3px 10px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s; white-space: nowrap;
      }
      button.phase-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .site-block { padding: 0; }
      .site-table-hidden { display: none; }
      .flow-wrap-clickable {
        cursor: pointer;
        border-radius: 6px;
        transition: opacity .15s;
      }
      .flow-wrap-clickable:hover { opacity: 0.85; }

      .flow-wrap {
        margin-bottom: 18px;
        padding: 0;
      }
      .flow-wrap svg {
        overflow: visible;
      }
      .flow-overlay {
        color: var(--primary-text-color, #212121);
      }
      .site-table { display: flex; flex-direction: column; }
      .site-section-gap { border-top: 1px solid var(--divider-color, #333); margin: 10px 0 12px; }
      .site-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--divider-color, #333); }
      .site-section-title { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--secondary-text-color); }
      .site-section-total { font-size: 1rem; font-weight: 700; }
      .site-row { display: grid; grid-template-columns: 1.4rem 1fr auto; gap: 0 6px; align-items: center; padding: 5px 0; font-size: .78rem; }
      .site-row-icon  { display: flex; align-items: center; justify-content: center; }
      .site-row-label { display: flex; flex-direction: column; gap: 1px; }
      .site-row-name  { font-size: .8rem; }
      .site-row-sub   { font-size: .68rem; color: var(--secondary-text-color); }
      .site-row-pw    { font-weight: 700; font-size: .82rem; min-width: 48px; text-align: right; }
      .site-row-indent { padding-left: 1.2rem; position: relative; }
      .site-row-indent::before {
        content: "└";
        position: absolute;
        left: 0.15rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: .75rem;
        color: var(--secondary-text-color);
        opacity: 0.6;
      }
      .site-row-indent .site-row-icon { opacity: 0.7; }
      .site-row-indent .site-row-name { font-size: .75rem; color: var(--secondary-text-color); }
      .site-row-indent .site-row-pw   { font-size: .78rem; }
      .site-pw-green  { color: #22c55e; }
      .site-pw-blue   { color: #3b82f6; }
      .site-pw-yellow { color: #facc15; }

      .s2-net {
        text-align: center; padding: 14px 0 16px;
        border-bottom: 1px solid var(--divider-color, #333); margin-bottom: 14px;
      }
      .s2-net-label {
        font-size: .6rem; font-weight: 700; letter-spacing: .1em;
        text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 4px;
      }
      .s2-net-value { font-size: 2.2rem; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
      .s2-net-status { font-size: .75rem; font-weight: 600; margin-top: 4px; }
      .s2-pv-badge {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 8px; background: rgba(34,197,94,0.12); color: #22c55e;
        border-radius: 20px; padding: 3px 10px; font-size: .68rem; font-weight: 700;
      }
      .s2-section { margin-bottom: 12px; }
      .s2-section-label {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 6px;
      }
      .s2-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .s2-chip {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--secondary-background-color, rgba(255,255,255,0.05));
        border-radius: 20px; padding: 5px 11px; font-size: .72rem; font-weight: 600;
        border: 1px solid var(--divider-color, #333);
      }
      .s2-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .s2-chip-sub { font-size: .62rem; color: var(--secondary-text-color); font-weight: 400; }

      .stats-period-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
      .stats-period-tab {
        padding: 2px 10px; border-radius: 999px;
        border: 1px solid var(--divider-color, #e5e7eb);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s;
      }
      .stats-period-tab.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .stats-period-tabs--small .stats-period-tab { font-size: .65rem; padding: 1px 8px; }

      .stats-footer-wrap {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 8px;
      }
      .stats-footer-wrap .stats-footer { border-top: none; margin-top: 6px; padding-top: 0; }

      .stats-footer {
        display: flex; align-items: center;
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 10px;
      }
      .sf-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .sf-val  { font-size: .82rem; font-weight: 700; }
      .sf-lbl  { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .sf-sep  { width: 1px; height: 28px; background: var(--divider-color, #333); flex-shrink: 0; }

      .stats-no-data {
        font-size: .76rem; color: var(--secondary-text-color);
        background: var(--secondary-background-color, rgba(255,255,255,.04));
        border: 1px solid var(--divider-color, #333);
        border-radius: 6px; padding: 8px 12px; margin-bottom: 10px; line-height: 1.4;
      }

      .stats-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .stats-kpi {
        background: var(--secondary-background-color, rgba(255,255,255,.05));
        border-radius: 8px; padding: 10px 8px; text-align: center;
        display: flex; flex-direction: column; gap: 3px;
      }
      .stats-kpi-val { font-size: 1.1rem; font-weight: 800; line-height: 1; }
      .stats-kpi-lbl { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .stats-chart-section { margin-top: 4px; }
      .stats-chart-title {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 8px;
      }
      .stats-chart-loading {
        height: 75px; display: flex; align-items: center; justify-content: center;
        color: var(--secondary-text-color); font-size: .75rem; opacity: .5;
      }

      .battery-block { padding: 0; }
      .batt-tabs { display: flex; border-bottom: 1px solid var(--divider-color, #333); margin-bottom: 14px; }
      button.batt-tab {
        background: transparent; border: none; border-bottom: 2px solid transparent;
        color: var(--secondary-text-color); padding: 7px 16px; font-size: .84rem; cursor: pointer; margin-bottom: -1px;
      }
      button.batt-tab.active { color: var(--primary-text-color); border-bottom-color: var(--primary-text-color); font-weight: 600; }
      .batt-main-row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .batt-text-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
      .batt-text-item { display: flex; gap: 8px; align-items: flex-start; }
      .batt-text-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      .batt-text-title { font-size: .82rem; font-weight: 600; margin-bottom: 2px; }
      .batt-text-desc  { font-size: .76rem; color: var(--secondary-text-color); line-height: 1.4; }
      .batt-inline-val { color: var(--primary-color, #00b4d8); text-decoration: underline dotted; cursor: pointer; font-weight: 600; white-space: nowrap; }
      .batt-visual-col { display: flex; align-items: flex-start; gap: 10px; flex-shrink: 0; align-self: flex-start; }
      .batt-marker-top { display: none; }
      .batt-visual { display: flex; flex-direction: column; align-items: center; width: 56px; }
      .batt-cap-tip { width: 22px; height: 5px; background: var(--divider-color, #555); border-radius: 3px 3px 0 0; margin-bottom: 1px; }
      .batt-body { width: 56px; height: 130px; border: 2px solid var(--divider-color, #555); border-radius: 5px; overflow: hidden; display: flex; flex-direction: column; position: relative; }
      .batt-zone { display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; min-height: 20px; }
      .batt-zone-car  { background: #22c55e18; }
      .batt-zone-haus { background: #3b82f618; }
      .batt-zone-icon { font-size: 1.2rem; }
      .batt-divider-line { height: 2px; background: var(--divider-color, #555); flex-shrink: 0; z-index: 2; }
      .batt-soc-overlay { position: absolute; bottom: 0; left: 0; right: 0; z-index: 0; border-radius: 0 0 3px 3px; transition: height .4s; opacity: 0.55; }
      .batt-info-col { display: flex; flex-direction: column; gap: 3px; padding-top: 2px; min-width: 90px; }
      .batt-info-label { font-size: .72rem; color: var(--secondary-text-color); }
      .batt-info-pct   { font-size: 1rem; font-weight: 700; }
      .batt-info-kwh, .batt-info-power { font-size: .72rem; color: var(--secondary-text-color); }
      .batt-discharge-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); font-size: .84rem; }
      .batt-discharge-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; background: var(--divider-color, #444); position: relative; cursor: pointer; flex-shrink: 0; transition: background .2s; }
      .batt-discharge-toggle.on { background: var(--primary-color, #00b4d8); }
      .batt-toggle-knob { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: left .2s; }
      .batt-discharge-toggle.on .batt-toggle-knob { left: 21px; }
      .batt-inline-popup { display: flex; align-items: center; gap: 8px; background: var(--card-background-color, #1c1c1e); border: 1px solid var(--divider-color, #333); border-radius: 8px; padding: 8px 12px; margin-top: 10px; }
      .batt-inline-popup[hidden] { display: none; }
      .batt-inline-input { flex: 1; }
      .batt-inline-label { font-size: .84rem; font-weight: 600; min-width: 44px; text-align: right; }

      .session-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .session-title { font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text-color); margin-bottom: 8px; }
      .session-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 6px; }
      .session-item { display: flex; flex-direction: column; gap: 2px; }
      .si-label { font-size: .7rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .05em; }
      .si-value { font-size: .95rem; font-weight: 600; color: var(--primary-text-color); }

      .plan-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .plan-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .plan-badge { font-size: .7rem; font-weight: 600; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--divider-color); color: var(--secondary-text-color); }
      .plan-badge.planned { background: rgba(0, 120, 180, 0.3); color: #60aaff; }
      .plan-badge.active  { background: color-mix(in srgb, var(--evcc-green) 15%, transparent); color: var(--evcc-green); border-color: var(--evcc-green); }
      .plan-projection { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; color: var(--secondary-text-color); margin-bottom: 10px; padding: 7px 10px; background: var(--secondary-background-color, rgba(0,0,0,.08)); border-radius: 6px; }
      .plan-projection strong { color: var(--primary-text-color); }
      .plan-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .plan-row { display: flex; align-items: center; gap: 8px; font-size: .83rem; flex-wrap: wrap; }
      .plan-row label { flex: 0 0 auto; min-width: 60px; white-space: nowrap; color: var(--secondary-text-color); }
      .plan-soc-control { display: flex; align-items: center; gap: 8px; flex: 1; }
      .plan-soc-range { flex: 1; accent-color: var(--primary-color); }
      .plan-soc-val { width: 42px; text-align: right; font-size: .8rem; }
      input.plan-time-input { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; color-scheme: dark light; }
      .plan-actions { display: flex; gap: 8px; }
      .plan-btn { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--divider-color); font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .15s; background: transparent; color: var(--primary-text-color); }
      .plan-btn.save { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .plan-btn.save:hover { filter: brightness(1.1); }
      .plan-btn.delete { color: #ef4444; border-color: #ef444466; }
      .plan-btn.delete:hover { background: #ef444422; }
      select.plan-vehicle-select { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; }
      .plan-error { margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #ef444422; color: #ef4444; font-size: .78rem; word-break: break-all; }

      .empty { text-align: center; padding: 24px; color: var(--secondary-text-color); font-size: .9rem; line-height: 1.8; }
      .empty code { background: var(--code-editor-background-color, #1e1e1e); color: var(--primary-color); padding: 1px 6px; border-radius: 4px; font-size: .82rem; }
      .compact-tabs {
        display: flex; gap: 4px; margin-bottom: 12px;
        border-bottom: 1px solid var(--divider-color, #e5e7eb); padding-bottom: 0;
      }
      .compact-tab {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 6px 4px 8px; background: transparent; border: none;
        border-bottom: 2px solid transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .68rem; margin-bottom: -1px;
        transition: color .15s, border-color .15s;
      }
      .compact-tab:hover { color: var(--primary-text-color); }
      .compact-tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }
      .compact-tab-icon  { font-size: 1rem; line-height: 1; }
      .compact-tab-label { font-size: .68rem; }
      .compact-panel[hidden] { display: none; }
      .compact-panel .plan-block,
      .compact-panel .session-block { border-top: none; margin-top: 0; padding-top: 0; }
    `;
  }
}

customElements.define("evcc-card", EvccCard);
window.__evccCards = window.__evccCards || new Map();

(async function cacheBust() {
  const ver = EVCC_CARD_VERSION;

  console.info(
    `%c evcc-card %c ${ver} %c`,
    "background:#1d4ed8;color:#fff;padding:2px 4px;border-radius:3px 0 0 3px;font-weight:bold",
    "background:#22c55e;color:#fff;padding:2px 4px;border-radius:0 3px 3px 0;font-weight:bold",
    "background:transparent"
  );

  await customElements.whenDefined("home-assistant");
  const ha = document.querySelector("home-assistant");
  if (!ha || !ha.hass) return;

  try {
    const resources = await ha.hass.callWS({ type: "lovelace/resources" });
    const myRes = resources.find(r =>
      r.url && r.url.includes("evcc-card") && r.url.endsWith(".js") ||
      r.url && r.url.includes("evcc-card") && r.url.includes(".js?")
    );
    if (!myRes) return;

    const baseUrl = myRes.url.split("?")[0];
    const expectedUrl = `${baseUrl}?v=${ver}`;

    if (myRes.url === expectedUrl) return;

    await ha.hass.callWS({
      type:   "lovelace/resources/update",
      res_id: myRes.id,
      res_type: myRes.type || "module",
      url:    expectedUrl,
    });
    console.info(`[evcc-card] Cache URL updated -> ${expectedUrl}. Reloading page.`);
    setTimeout(() => location.reload(), 500);
  } catch (e) {
  }
})();

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "evcc-card",
  name:        "EVCC Card",
  description: "Dashboard card for ha-evcc integration.",
  preview:     false,
  version:     EVCC_CARD_VERSION,
}); 