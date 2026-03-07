/**
 * evcc-card — Generische Home Assistant Lovelace Card für ha-evcc
 *
 * Datei:   evcc-card.js
 * Ablage:  /config/www/evcc-card/evcc-card.js
 *
 * Übersetzungen: /config/www/evcc-card/locales/de.json
 *                /config/www/evcc-card/locales/en.json
 */

// ─── Feature-Definitionen ────────────────────────────────────────────────────

const FEATURES = [
  // ── Loadpoint: Steuerung ──────────────────────────────────────────────────
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

  // ── Loadpoint: Schalter ───────────────────────────────────────────────────
  { suffix: "battery_boost",       domain: "switch",        type: "toggle",        lp: true  },

  // ── Loadpoint: Status-Sensoren ────────────────────────────────────────────
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

  // ── Loadpoint: Plan-Sensoren ─────────────────────────────────────────────
  { suffix: "effective_plan_soc",      domain: "sensor", type: "info", lp: true },
  { suffix: "effective_plan_time",     domain: "sensor", type: "info", lp: true },
  { suffix: "plan_projected_start",    domain: "sensor", type: "info", lp: true },
  { suffix: "plan_projected_end",      domain: "sensor", type: "info", lp: true },
  { suffix: "vehicle_plans_soc",       domain: "sensor", type: "info", lp: true },
  { suffix: "vehicle_plans_time",      domain: "sensor", type: "info", lp: true },

  // ── Loadpoint: Binär-Sensoren ─────────────────────────────────────────────
  { suffix: "charging",            domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "connected",           domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "enabled",             domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "smart_cost_active",   domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "plan_active",         domain: "binary_sensor", type: "status_bool",   lp: true  },

  // ── Site: Sensoren ────────────────────────────────────────────────────────
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

  // ── Site: Steuerung ───────────────────────────────────────────────────────
  { suffix: "priority_soc",        domain: "select",        type: "select_slider", lp: false },
  { suffix: "buffer_soc",          domain: "select",        type: "select_slider", lp: false },
  { suffix: "buffer_start_soc",    domain: "select",        type: "select_slider", lp: false },
  { suffix: "residual_power",      domain: "number",        type: "slider",        lp: false },
  { suffix: "battery_discharge_control", domain: "switch",  type: "toggle",        lp: false },
  { suffix: "battery_grid_charge_active", domain: "binary_sensor", type: "status_bool", lp: false },
  { suffix: "battery_grid_charge_limit",  domain: "number",        type: "slider",      lp: false },
];

// Lademodi → Icon + Label
const CHARGE_MODES = {
  "off":   { icon: "⏹",  tKey: "modeOff"  },
  "pv":    { icon: "☀️",  tKey: "modePV"   },
  "minpv": { icon: "⚡☀️", tKey: "modeMinPV"},
  "now":   { icon: "⚡",  tKey: "modeNow"  },
};


// ─── Discovery ────────────────────────────────────────────────────────────────

function discoverEntities(hass) {
  const sortedFeatures = [...FEATURES].sort((a, b) => b.suffix.length - a.suffix.length);

  const loadpoints = {};
  const site = {};

  for (const entityId of Object.keys(hass.states)) {
    const dotIdx = entityId.indexOf(".");
    const domain = entityId.slice(0, dotIdx);
    const slug   = entityId.slice(dotIdx + 1);

    if (!slug.startsWith("evcc_")) continue;

    const rest = slug.slice(5);

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

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function stateVal(hass, entityId) {
  return hass.states[entityId]?.state ?? null;
}

function attr(hass, entityId, key) {
  return hass.states[entityId]?.attributes?.[key] ?? null;
}

function unitStr(hass, entityId) {
  return attr(hass, entityId, "unit_of_measurement") ?? "";
}

function isOn(hass, entityId) {
  const s = stateVal(hass, entityId);
  return s === "on" || s === "true";
}

// ─── Web Component ────────────────────────────────────────────────────────────

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
    this._translations  = {};        // { de: {...}, en: {...} }
    this._translationsReady = false;

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

  // ── Übersetzungen laden ───────────────────────────────────────────────────

  async _loadTranslations() {
    // Basis-URL: selbes Verzeichnis wie evcc-card.js, Unterordner locales/
    const base = new URL("locales/", import.meta.url).href;

    // Verfügbare Sprachen aus index.json lesen
    let langs = ["de", "en"]; // Fallback falls index.json nicht erreichbar
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
    const evccIds = Object.keys(hass.states).filter(id => {
      const slug = id.split(".")[1] ?? "";
      return slug.startsWith("evcc_");
    });
    const lang = this._config.language || (hass.language ?? "de");
    return lang + "|" + evccIds.map(id => `${id}=${hass.states[id]?.state}`).join("|");
  }

  setConfig(config) {
    this._config = config || {};

    // Übersetzungen beim ersten setConfig laden
    if (!this._translationsReady && !this._loadingTranslations) {
      this._loadingTranslations = true;
      this._loadTranslations().then(() => {
        this._loadingTranslations = false;
        if (this._hass) this._render();
      });
    }
  }

  // ── Übersetzungs-Helfer ───────────────────────────────────────────────────

  _t(key, replacements = {}) {
    const lang = (this._config.language
      || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();

    const strings = this._translations[lang]
      || this._translations["de"]
      || {};

    let val = strings[key] ?? key;

    // {placeholder} ersetzen, z.B. {val} oder {list}
    for (const [k, v] of Object.entries(replacements)) {
      val = val.replace(`{${k}}`, v);
    }

    return val;
  }


  // ── Vollständiges Rendering ────────────────────────────────────────────────

  _render() {
    if (!this._hass) return;

    // Noch nicht bereit: Ladeanzeige
    if (!this._translationsReady) {
      this.shadowRoot.innerHTML = `
        <style>:host{display:block} ha-card{background:var(--card-background-color)}
        .loading{padding:24px;text-align:center;color:var(--secondary-text-color);font-size:.9rem}</style>
        <ha-card><div class="loading">⏳</div></ha-card>`;
      return;
    }

    const { loadpoints, site } = discoverEntities(this._hass);

    const filter = this._config.loadpoints;
    const visible = filter && Array.isArray(filter) && filter.length > 0
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
              : this._config.mode === "plan"
                ? this._renderPlanMode(visible)
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

  // ── Live-Update nur für read-only Elemente (während Drag) ─────────────────

  _updateLiveValues() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-live-entity]").forEach(el => {
      const entityId = el.dataset.liveEntity;
      const type     = el.dataset.liveType;
      if (!entityId) return;

      if (type === "soc-fill") {
        const soc = parseFloat(stateVal(this._hass, entityId)) || 0;
        el.style.width      = `${soc}%`;
        el.style.background = soc > 80 ? "#22c55e" : soc > 30 ? "#3b82f6" : "#f59e0b";
      } else if (type === "soc-pct") {
        const soc = parseFloat(stateVal(this._hass, entityId)) || 0;
        el.textContent = `🔋 ${Math.round(soc)} ${unitStr(this._hass, entityId)}`;
      } else if (type === "power") {
        el.textContent = `${stateVal(this._hass, entityId)} ${unitStr(this._hass, entityId)}`;
      }
    });
  }

  // ── Loadpoint ─────────────────────────────────────────────────────────────

  _renderLoadpoint(lpName, ents) {
    const charging   = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected  = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusColor = charging ? "#22c55e" : connected ? "#3b82f6" : "#6b7280";

    const noPlan = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);

    return `
      <div class="loadpoint">
        <div class="lp-header">
          <span class="lp-name">${lpName}</span>
          <span class="lp-badge" style="background:${statusColor}22;color:${statusColor}">
            ${statusLabel}
          </span>
        </div>
        ${this._renderModeSelector(ents)}
        ${this._renderSocBar(ents, charging)}
        ${this._renderPowerRow(ents, charging)}
        ${this._renderSliders(ents)}
        ${this._renderCurrentBlock(ents)}
        ${this._renderToggles(ents)}
        ${noPlan ? "" : this._renderPlanBlock(lpName, ents)}
        ${this._renderSessionInfo(ents)}
      </div>
    `;
  }

  // ── Lademodus ─────────────────────────────────────────────────────────────

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

  // ── SOC-Balken ────────────────────────────────────────────────────────────

  _renderSocBar(ents, charging = false) {
    if (!ents.vehicle_soc) return "";
    const soc   = parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0;
    const range = ents.vehicle_range
      ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_range))) : null;
    const limit = ents.limit_soc
      ? parseFloat(stateVal(this._hass, ents.limit_soc)) : null;
    const color = soc > 80 ? "#22c55e" : soc > 30 ? "#3b82f6" : "#f59e0b";

    return `
      <div class="soc-section">
        <div class="soc-label-row">
          <span data-live-entity="${ents.vehicle_soc}" data-live-type="soc-pct">
            🔋 ${Math.round(soc)} ${unitStr(this._hass, ents.vehicle_soc)}
          </span>
          ${range !== null ? `<span>🛣 ${range} km</span>` : ""}
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

  // ── Ladeleistung ──────────────────────────────────────────────────────────

  _renderPowerRow(ents, charging) {
    if (!ents.charge_power) return "";
    const power   = stateVal(this._hass, ents.charge_power);
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

  // ── Slider ────────────────────────────────────────────────────────────────

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

  // ── Ladestrom-Block ───────────────────────────────────────────────────────

  _renderCurrentBlock(ents) {
    const hasPhases  = !!ents.phases_configured;
    const hasCurrent = ents.min_current || ents.max_current;
    if (!hasPhases && !hasCurrent) return "";

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

    return `
      <div class="current-block">
        <div class="block-title">${this._t("chargeCurrent")}</div>
        ${phasesHtml}
        ${currentRows}
      </div>`;
  }

  _sliderRow(entityId, label) {
    const domain = entityId.split(".")[0];
    const val    = parseFloat(stateVal(this._hass, entityId)) || 0;
    const unit   = unitStr(this._hass, entityId);
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

  // ── Batterie-Boost ────────────────────────────────────────────────────────

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
      const label    = curPct === 100 ? "AUS" : curPct === 0 ? "0 % (Vollentladung)" : `${curPct} %`;
      return `
        <div class="slider-row">
          <label>Batterie-Boost</label>
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

  // ── Toggle-Schalter ───────────────────────────────────────────────────────

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
              ${on ? "AN" : "AUS"}
            </button>
          </div>
        `;
      });
    return rows.length ? `<div class="toggles">${rows.join("")}</div>` : "";
  }

  // ── Select-Steuerung ──────────────────────────────────────────────────────

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

  // ── Ladeplanung ───────────────────────────────────────────────────────────

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
      const initSoc = (planSoc && planSoc !== "unknown" && planSoc !== "unavailable")
        ? Math.round(parseFloat(planSoc)) : 80;
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
        return new Date(iso).toLocaleString("de-DE", {
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
        ${startStr ? `<span>🔌 Start: <strong>${startStr}</strong></span>` : ""}
        ${endStr   ? `<span>✅ Ende: <strong>${endStr}</strong></span>`    : ""}
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

  // ── Sitzungsinfo ──────────────────────────────────────────────────────────

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

  // ── Plan-Modus ────────────────────────────────────────────────────────────

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

  // ── Site-Übersicht ────────────────────────────────────────────────────────

  _renderSiteBlock(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };
    const kwh = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;
    const ct  = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;

    const pvSources = [
      { key: "pv_0_power", energyKey: "pv_0_energy", label: "PV 1" },
      { key: "pv_1_power", energyKey: "pv_1_energy", label: "PV 2" },
      { key: "pv_2_power", energyKey: "pv_2_energy", label: "PV 3" },
      { key: "pv_3_power", energyKey: "pv_3_energy", label: "PV 4" },
    ].filter(s => site[s.key]);
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

    const barTotal  = Math.max(pvPow, 0.001);
    const homePct   = Math.min(Math.round(Math.max(homePow - chargePow, 0) / barTotal * 100), 100);
    const chargePct = Math.min(Math.round(chargePow      / barTotal * 100), 100);
    const battPct   = Math.min(Math.round(battChargePow  / barTotal * 100), 100);
    const feedinPct = Math.min(Math.round(feedinPow      / barTotal * 100), 100);
    const usedPct   = homePct + chargePct + battPct + feedinPct;
    const restPct   = Math.max(0, 100 - usedPct);

    const gridKwh    = kwh(site.grid_energy);
    const exportKwh  = kwh(site.grid_energy_export);
    const battCKwh   = kwh(site.battery_energy_charge);
    const battDKwh   = kwh(site.battery_energy_discharge);
    const homeKwh    = kwh(site.home_energy);
    const batterySoc = kwh(site.battery_soc);

    const fmt   = v => v === null ? "–" : v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const fmtKw  = v => `${fmt(v)} kW`;
    const fmtKwh = v => v === null ? "–" : `${fmt(v)} kWh`;

    const inTotal  = pvPow + battDischPow + bezugPow;
    const outTotal = homePow + battChargePow + feedinPow;

    const bar = `
      <div class="site-bar-wrap">
        <div class="site-sun-icon">☀️</div>
        <div class="site-bar">
          <div class="site-bar-home"   style="flex:${homePct}"   title="Haus ${homePct}%"></div>
          <div class="site-bar-charge" style="flex:${chargePct}" title="Laden ${chargePct}%"></div>
          <div class="site-bar-batt"   style="flex:${battPct}"   title="Batterie ${battPct}%"></div>
          <div class="site-bar-feedin" style="flex:${feedinPct}" title="Einspeisung ${feedinPct}%"></div>
          <div class="site-bar-rest"   style="flex:${restPct}"></div>
        </div>
        <div class="site-export-icon">⚡</div>
      </div>
      <div class="site-legend">
        <span><span class="site-dot green"></span> ${this._t("legendHome")}
              <span class="site-dot blue"></span> ${this._t("legendCharge")}
              <span class="site-dot orange"></span> ${this._t("legendBatt")}</span>
        <span>${this._t("legendFeedin")} <span class="site-dot yellow"></span></span>
      </div>`;

    const row = (icon, label, sub, _kwh, _ct, pw, pwClass="", indent=false) => `
      <div class="site-row ${indent ? "site-row-indent" : ""}">
        <span class="site-row-icon">${icon}</span>
        <span class="site-row-label">
          <span class="site-row-name">${label}</span>
          ${sub ? `<span class="site-row-sub">${sub}</span>` : ""}
        </span>
        <span class="site-row-pw ${pwClass}">${fmtKw(pw)}</span>
      </div>`;

    const section = (title, total, rows) => `
      <div class="site-section">
        <div class="site-section-head">
          <span class="site-section-title">${title}</span>
          <span class="site-section-total">${fmtKw(total)}</span>
        </div>
        ${rows}
      </div>`;

    const tariffGrid   = ct(site.tariff_grid);
    const tariffFeedin = ct(site.tariff_feedin);

    const lpRows = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow = kw(ents.charge_power);
        const lpSoc = ents.vehicle_soc ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unitStr(this._hass, ents.vehicle_soc)}` : "";
        return row("🔌", lpName, lpSoc, null, null, lpPow, "site-pw-blue", true);
      }).join("");

    const pvRows = pvSources.length > 1
      ? pvSources.map(s => {
          const p = kw(site[s.key]);
          const e = kwh(site[s.energyKey]);
          return p > 0.005 ? row("☀️", s.label, "", e, null, p, "site-pw-green", true) : "";
        }).join("")
      : "";

    const inSection  = section("In", inTotal, [
      row("☀️", this._t("generation"), "", pvKwh, null, pvPow, "site-pw-green"),
      pvRows,
      battDischPow > 0.05 ? row("🔋", this._t("battDischarge"), batterySoc !== null ? `${Math.round(batterySoc)} %` : "", battDKwh, null, battDischPow) : "",
      bezugPow > 0.05 ? row("🔌", this._t("gridImport"), "", gridKwh, tariffGrid, bezugPow) : "",
    ].join(""));

    const outSection = section("Out", outTotal, [
      row("🏠", this._t("consumption"), "", homeKwh, tariffGrid, homePow),
      chargePow > 0.05 ? row("🔌", this._t("chargePoint"), "", null, null, chargePow, "site-pw-blue") + lpRows : "",
      battChargePow > 0.05 ? row("🔋", this._t("battCharge"), batterySoc !== null ? `${Math.round(batterySoc)} %` : "", battCKwh, null, battChargePow) : "",
      feedinPow > 0.05 ? row("⚡", this._t("gridExport"), "", exportKwh, tariffFeedin, feedinPow, "site-pw-yellow") : "",
    ].join(""));

    return `
      <div class="site-block">
        <div class="lp-header">
          <span class="lp-name">${this._t("overview")}</span>
        </div>
        ${bar}
        <div class="site-table">
          ${inSection}
          <div class="site-section-gap"></div>
          ${outSection}
        </div>
      </div>`;
  }

  // ── Hausbatterie-Block ────────────────────────────────────────────────────

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
    const socColor    = soc > 80 ? "#22c55e" : soc > 30 ? "#3b82f6" : "#f59e0b";

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
              <span class="batt-zone-icon">🚗</span>
            </div>
            <div class="batt-divider-line"></div>
            <div class="batt-zone batt-zone-haus" style="flex:${hausZonePct}">
              <span class="batt-zone-icon">🏠</span>
            </div>` : `
            <div class="batt-zone batt-zone-car" style="flex:1">
              <span class="batt-zone-icon">🚗</span>
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
        ${cap ? `<div class="batt-info-kwh">${(soc/100*cap).toFixed(1)} kWh von ${cap} kWh</div>` : ""}
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
              <span class="batt-text-icon">⚡</span>
              <div>
                <div class="batt-text-title">${this._t("battBoostTitle")}</div>
                <div class="batt-text-desc">${this._t("battBoostDesc", { val: inlineSlider(bufferSocId, bufferVal) })}</div>
              </div>
            </div>` : ""}
            ${prioritySocId ? `
            <div class="batt-text-item">
              <span class="batt-text-icon">🚗</span>
              <div>
                <div class="batt-text-title">${this._t("battCarPrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battCarPrioDesc", { val: inlineSlider(prioritySocId, priorityVal) })}</div>
              </div>
            </div>
            <div class="batt-text-item">
              <span class="batt-text-icon">🏠</span>
              <div>
                <div class="batt-text-title">${this._t("battHomePrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battHomePrioDesc", { val: inlineSlider(prioritySocId, priorityVal) })}</div>
              </div>
            </div>` : ""}
            ${dischargeHtml}
          </div>
          <div class="batt-visual-col">
            ${bufferVal !== null ? `<span class="batt-marker-top">${bufferVal} %</span>` : ""}
            ${visual}
            ${info}
          </div>
        </div>
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

  // ── Event-Listener ────────────────────────────────────────────────────────

  _attachListeners() {
    this.shadowRoot.querySelectorAll("button.batt-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const tabIdx = parseInt(btn.dataset.tab);
        const block  = btn.closest(".battery-block");
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

    this.shadowRoot.addEventListener("click", () => {
      this.shadowRoot.querySelectorAll(".batt-inline-popup").forEach(p => p.setAttribute("hidden", ""));
    }, { capture: true });

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
          display.textContent = val >= 50 ? "AN" : "AUS";
        } else {
          display.textContent = val === 100 ? "AUS" : val === 0 ? "0 % (Vollentladung)" : `${val} %`;
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
        this._isDragging    = true;
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
          showError(`❌ ${lastErr?.message || JSON.stringify(lastErr) || "Unbekannter Fehler"}`);
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
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
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
        if (span) span.textContent = `${input.value} ${unitStr(this._hass, input.dataset.entity)}`;
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

  // ── CSS ───────────────────────────────────────────────────────────────────

  _styles() {
    return `
      :host { display: block; }
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
      .lp-name { font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
      .lp-badge {
        font-size: .75rem; font-weight: 600; padding: 2px 10px;
        border-radius: 999px; border: 1px solid currentColor;
      }

      .mode-row { display: flex; gap: 6px; margin-bottom: 12px; }
      .mode-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 8px 4px;
        border: 1px solid var(--divider-color, #e5e7eb); border-radius: 8px;
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .7rem; transition: all .15s;
      }
      .mode-btn:hover { border-color: var(--primary-color); }
      .mode-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .mode-icon { font-size: 1.1rem; }

      .soc-section { margin-bottom: 12px; }
      .soc-label-row {
        display: flex; justify-content: space-between;
        font-size: .85rem; margin-bottom: 6px; color: var(--secondary-text-color);
      }
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
        background: var(--warning-color, #f59e0b); border-radius: 2px; transform: translateX(-50%);
      }

      .power-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 12px; color: var(--secondary-text-color); }
      .power-row.charging { color: #22c55e; }
      .power-value { font-size: 1.6rem; font-weight: 700; }
      .power-sep { font-size: .8rem; color: var(--secondary-text-color); align-self: flex-end; padding-bottom: .2rem; }
      .power-current { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }
      .power-phases  { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }

      .sliders { margin-bottom: 10px; }
      .slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: .83rem; }
      .slider-row label { width: 90px; flex-shrink: 0; color: var(--secondary-text-color); }
      .slider-control { display: flex; align-items: center; gap: 8px; flex: 1; }
      .slider-control input { flex: 1; accent-color: var(--primary-color); }
      .slider-val { width: 58px; text-align: right; font-size: .8rem; }

      .toggles { margin-bottom: 10px; }
      .toggle-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; }
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
      .block-title {
        font-size: .7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: .08em; color: var(--secondary-text-color); margin-bottom: 8px;
      }

      .selects { margin-bottom: 10px; }
      .select-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; }
      .phase-btn-group { display: flex; gap: 4px; }
      button.phase-btn {
        padding: 3px 10px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s; white-space: nowrap;
      }
      button.phase-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .site-block { padding: 0; }
      .site-bar-wrap { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
      .site-bar {
        flex: 1; height: 28px; border-radius: 6px;
        display: flex; overflow: hidden; background: var(--divider-color, #333);
      }
      .site-bar-home   { background: #22c55e; transition: flex .4s; min-width: 0; }
      .site-bar-charge { background: #3b82f6; transition: flex .4s; min-width: 0; }
      .site-bar-batt   { background: #f97316; transition: flex .4s; min-width: 0; }
      .site-bar-feedin { background: #facc15; transition: flex .4s; min-width: 0; }
      .site-bar-rest   { background: var(--divider-color, #333); min-width: 0; }
      .site-sun-icon, .site-export-icon { font-size: 1.1rem; flex-shrink: 0; }
      .site-legend { display: flex; justify-content: space-between; font-size: .72rem; color: var(--secondary-text-color); margin-bottom: 14px; }
      .site-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; vertical-align: middle; margin: 0 3px; }
      .site-dot.green  { background: #22c55e; }
      .site-dot.blue   { background: #3b82f6; }
      .site-dot.orange { background: #f97316; }
      .site-dot.yellow { background: #facc15; }
      .site-table { display: flex; flex-direction: column; }
      .site-section-gap { border-top: 1px solid var(--divider-color, #333); margin: 8px 0 10px; }
      .site-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
      .site-section-title { font-size: .9rem; font-weight: 700; }
      .site-section-total { font-size: .9rem; font-weight: 700; }
      .site-row { display: grid; grid-template-columns: 1.2rem 1fr auto; gap: 0 6px; align-items: center; padding: 3px 0; font-size: .78rem; }
      .site-row-icon  { text-align: center; font-size: .85rem; }
      .site-row-label { display: flex; flex-direction: column; gap: 1px; }
      .site-row-name  { font-size: .8rem; }
      .site-row-sub   { font-size: .68rem; color: var(--secondary-text-color); }
      .site-row-pw    { font-weight: 700; font-size: .82rem; min-width: 48px; text-align: right; }
      .site-row-indent .site-row-icon { visibility: hidden; }
      .site-row-indent .site-row-name { padding-left: 10px; font-size: .75rem; color: var(--secondary-text-color); }
      .site-pw-green  { color: #22c55e; }
      .site-pw-blue   { color: #3b82f6; }
      .site-pw-yellow { color: #facc15; }

      .battery-block { padding: 0; }
      .batt-tabs { display: flex; border-bottom: 1px solid var(--divider-color, #333); margin-bottom: 14px; }
      button.batt-tab {
        background: transparent; border: none; border-bottom: 2px solid transparent;
        color: var(--secondary-text-color); padding: 7px 16px; font-size: .84rem; cursor: pointer; margin-bottom: -1px;
      }
      button.batt-tab.active { color: var(--primary-text-color); border-bottom-color: var(--primary-text-color); font-weight: 600; }
      .batt-main-row { display: flex; gap: 16px; align-items: flex-start; }
      .batt-text-col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
      .batt-text-item { display: flex; gap: 8px; align-items: flex-start; }
      .batt-text-icon { font-size: 1rem; margin-top: 1px; flex-shrink: 0; }
      .batt-text-title { font-size: .82rem; font-weight: 600; margin-bottom: 2px; }
      .batt-text-desc  { font-size: .76rem; color: var(--secondary-text-color); line-height: 1.4; }
      .batt-inline-val { color: var(--primary-color, #00b4d8); text-decoration: underline dotted; cursor: pointer; font-weight: 600; }
      .batt-visual-col { display: flex; align-items: flex-start; gap: 10px; flex-shrink: 0; }
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
      .batt-discharge-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; font-size: .84rem; }
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
      .plan-badge.active  { background: #22c55e22; color: #22c55e; border-color: #22c55e; }
      .plan-projection { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; color: var(--secondary-text-color); margin-bottom: 10px; padding: 7px 10px; background: var(--secondary-background-color, rgba(0,0,0,.08)); border-radius: 6px; }
      .plan-projection strong { color: var(--primary-text-color); }
      .plan-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .plan-row { display: flex; align-items: center; gap: 8px; font-size: .83rem; }
      .plan-row label { width: 70px; flex-shrink: 0; color: var(--secondary-text-color); }
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
    `;
  }
}

// ─── Registrierung ────────────────────────────────────────────────────────────

customElements.define("evcc-card", EvccCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "evcc-card",
  name:        "EVCC Card",
  description: "Dashboard card for ha-evcc integration.",
  preview:     false,
});