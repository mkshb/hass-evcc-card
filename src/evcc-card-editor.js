import { HIDEABLE_SETTINGS, vehicleFilter, isVehicleImage, isMediaSourceId } from "./core/constants.js";
import { detectIntegration, discoverEntities, discoverVehicles } from "./core/entity-discovery.js";
import { loadSharedTranslations, sharedTranslations, sharedTranslationsReady } from "./utils/translations.js";
import { escHtml } from "./utils/html.js";
import { listVehicleDevices, findVehicleDevice, evccVehicleTitle } from "./core/vehicle-device.js";

export class EvccCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._availableLoadpoints = [];
    this._detectedPrefix = null;
    this._detectingPrefix = false;
    this._instances = [];   // every ha-evcc entry in the registry, first one is the default
  }

  _t(key, replacements = {}) {
    const lang = (this._config?.language
      || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
    const t = sharedTranslations();
    const strings = t[lang] || t["en"] || {};
    let val = strings[key] ?? key;
    for (const [k, v] of Object.entries(replacements)) val = val.replace(`{${k}}`, v);
    return val;
  }

  set hass(hass) {
    this._hass = hass;
    if (!sharedTranslationsReady()) {
      loadSharedTranslations().then(() => this._render());
    }
    if (!this._detectedPrefix && !this._detectingPrefix) {
      this._detectingPrefix = true;
      detectIntegration(hass).then(({ prefix, instances }) => {
        this._detectingPrefix = false;
        this._detectedPrefix = prefix;
        this._instances = instances;
        this._discoverLoadpoints();
        this._render();
      });
      return;
    }
    const prev = this._availableLoadpoints.join(",");
    this._discoverLoadpoints();
    const next = this._availableLoadpoints.join(",");
    if (prev !== next) this._render();
  }

  setConfig(config) {
    this._config = { ...config };
    if (this.shadowRoot?.activeElement?.tagName === "INPUT") return;
    this._discoverLoadpoints();
    this._render();
  }

  _getPrefix() {
    return this._config.prefix || this._detectedPrefix || "evcc_";
  }

  _discoverLoadpoints() {
    if (!this._hass) return;
    const prefix = this._getPrefix();
    const { loadpoints } = discoverEntities(this._hass, prefix);
    this._availableLoadpoints = Object.keys(loadpoints).sort();
  }

  _esc(str) {
    return escHtml(str);
  }

  _fire() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true,
    }));
  }

  // The ha-evcc entries the registry reports, as select options. Only shown
  // with more than one entry, or when the config names a prefix the registry
  // does not know, so it can be cleared. The registry carries no entry title,
  // so the prefix stands in for it, underscores read as spaces.
  _instanceOptions() {
    const cfg = this._config.prefix;
    const opts = this._instances.map((inst, i) => {
      const name = inst.prefix.replace(/_$/, "").replace(/_/g, " ");
      return [inst.prefix, i === 0 ? `${name} (${this._t("editorInstanceDefault")})` : name];
    });
    if (cfg && !this._instances.some(inst => inst.prefix === cfg)) opts.push([cfg, cfg]);
    return opts.length > 1 || (cfg && !this._instances.some(inst => inst.prefix === cfg)) ? opts : null;
  }

  _sel(id, options, current) {
    return `<select id="${id}" class="ha-select">
      ${options.map(([val, label]) =>
        `<option value="${val}"${current === val ? " selected" : ""}>${label}</option>`
      ).join("")}
    </select>`;
  }

  _checkboxes(type, selected) {
    const lps = this._availableLoadpoints;
    if (lps.length === 0) return `<div class="hint">${this._t("editorNoLoadpointsFound")}</div>`;
    return lps.map(lp => `
      <label class="cb-row">
        <input type="checkbox" data-field="${type}" data-lp="${this._esc(lp)}" ${selected.includes(lp) ? "checked" : ""}>
        <span>${this._esc(lp)}</span>
      </label>
    `).join("");
  }

  _vehicleCheckboxes(type, selected, slugs = this._availableVehicleSlugs, emptyKey = "editorNoVehiclesFound") {
    if (slugs.length === 0) return `<div class="hint">${this._t(emptyKey)}</div>`;
    return slugs.map(slug => {
      const label = String(slug).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return `
      <label class="cb-row">
        <input type="checkbox" data-field="${type}" data-lp="${this._esc(slug)}" ${selected.includes(slug) ? "checked" : ""}>
        <span>${this._esc(label)}</span>
      </label>`;
    }).join("");
  }

  // One device select per vehicle. The first option is what the card does on
  // its own and names the device it found, so nobody has to pick what is
  // already right; a choice is written to `vehicle_devices`, the automatic one
  // removes the vehicle from it again.
  _vehicleDeviceFields(vehicles) {
    const slugs = Object.keys(vehicles).sort();
    if (slugs.length === 0) return `<div class="hint">${this._t("editorVehiclesNoneFound")}</div>`;
    const devices = listVehicleDevices(this._hass);
    const chosen  = this._config.vehicle_devices && typeof this._config.vehicle_devices === "object" ? this._config.vehicle_devices : {};
    const option  = (val, label, cur) => `<option value="${this._esc(val)}"${cur === val ? " selected" : ""}>${this._esc(label)}</option>`;

    return slugs.map(slug => {
      const title = evccVehicleTitle(this._hass, slug, vehicles[slug]) || slug;
      const found = devices.find(d => d.id === findVehicleDevice(this._hass, slug, title));
      const cur   = chosen[slug] === false ? "none" : (chosen[slug] || "");
      const like  = devices.filter(d => d.vehicleLike);
      const other = devices.filter(d => !d.vehicleLike);
      return `
        <label class="field-label" for="vehicle-device-${this._esc(slug)}">${this._esc(title)}</label>
        <select id="vehicle-device-${this._esc(slug)}" class="ha-select" data-vehicle-device="${this._esc(slug)}">
          ${option("", this._t("editorVehicleDeviceAuto", { val: found ? found.name : this._t("editorVehicleDeviceNotFound") }), cur)}
          ${option("none", this._t("editorVehicleDeviceNone"), cur)}
          ${like.length ? `<optgroup label="${this._esc(this._t("editorVehicleDeviceGroupVehicles"))}">${like.map(d => option(d.id, d.name, cur)).join("")}</optgroup>` : ""}
          ${other.length ? `<optgroup label="${this._esc(this._t("editorVehicleDeviceGroupOther"))}">${other.map(d => option(d.id, d.name, cur)).join("")}</optgroup>` : ""}
          ${cur && cur !== "none" && !devices.some(d => d.id === cur) ? option(cur, cur, cur) : ""}
        </select>
        <div class="vehicle-media" data-vehicle-media="${this._esc(slug)}"></div>
        <input class="ha-input" type="text" data-vehicle-image="${this._esc(slug)}"
               value="${this._esc(this._config.vehicle_images?.[slug] || "")}" placeholder="${this._esc(this._t("editorVehicleImagePlaceholder"))}">`;
    }).join("");
  }

  // The picture of a vehicle is picked from Home Assistant's media library with
  // HA's own media selector, narrowed to images. The element belongs to the HA
  // frontend and is loaded on demand there, so it is created once it is defined;
  // the text field underneath works without it and shows what was picked.
  _mountVehicleMediaPickers() {
    const slots = this.shadowRoot.querySelectorAll("[data-vehicle-media]");
    if (!slots.length) return;
    if (!customElements.get("ha-selector")) {
      if (!this._waitingForSelector) {
        this._waitingForSelector = true;
        customElements.whenDefined("ha-selector").then(() => { this._waitingForSelector = false; this._render(); });
      }
      return;
    }
    slots.forEach(slot => {
      const slug    = slot.dataset.vehicleMedia;
      const current = this._config.vehicle_images?.[slug];
      const picker  = document.createElement("ha-selector");
      picker.hass     = this._hass;
      picker.selector = { media: { accept: ["image/*"] } };
      picker.label    = this._t("editorVehicleImagePick");
      picker.value    = isMediaSourceId(current) ? { media_content_id: current, media_content_type: "image/*", metadata: {} } : undefined;
      picker.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const id  = e.detail?.value?.media_content_id;
        const map = { ...(this._config.vehicle_images || {}) };
        if (isMediaSourceId(id)) map[slug] = id;
        else delete map[slug];
        this._config = { ...this._config, vehicle_images: Object.keys(map).length ? map : undefined };
        this._fire();
        this._render();
      });
      slot.appendChild(picker);
    });
  }

  get _availableVehicleSlugs() {
    if (!this._hass) return [];
    const prefix = this._getPrefix();
    const escPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^switch\\.${escPrefix}(.+)_repeating_plan_\\d+$`);
    const slugs = new Set();
    for (const entityId of Object.keys(this._hass.states)) {
      const m = entityId.match(re);
      if (m) slugs.add(m[1]);
    }
    return [...slugs].sort();
  }

  _render() {
    const c    = this._config;
    const mode = c.mode || "loadpoint";
    const selLps = Array.isArray(c.loadpoints) ? c.loadpoints : [];
    const noPlan  = Array.isArray(c.no_plan)   ? c.no_plan   : [];
    const noPv    = Array.isArray(c.no_pv)     ? c.no_pv     : [];

    const showLoadpoints    = ["loadpoint", "compact", "plan", "priority"].includes(mode);
    const showNoPlan        = ["loadpoint", "compact"].includes(mode);
    const showChargeCurrent = ["loadpoint", "compact"].includes(mode);
    const hideSettings      = Array.isArray(c.hide_settings) ? c.hide_settings : [];
    const showSiteDetails   = ["site", "flow"].includes(mode);
    const showStatsPeriod   = ["stats", "site", "flow", "grid"].includes(mode);
    const showVehicleFilter = mode === "repeatplan";
    const rplanVehicles     = Array.isArray(c.repeating_plan_vehicles) ? c.repeating_plan_vehicles : [];
    const showVehicles      = mode === "vehicle";
    const selVehicles       = vehicleFilter(c) || [];
    const instanceOptions   = this._instanceOptions();

    // `stats_period` has no implicit value: unconfigured, every mode follows its
    // own default (the stats mode opens on the most recent month, the compact
    // footer under site/flow/grid sums everything up). The editor names that
    // default instead of preselecting an option the card does not use.
    const statsPeriodOptions = [
      ["",      this._t("editorStatsPeriodDefault", {
                  val: mode === "stats" ? this._t("statsPeriodMonth") : this._t("editorStatsPeriodTotal") })],
      ["month", this._t("statsPeriodMonth")],
      ["year",  this._t("statsPeriodYear")],
      ["total", this._t("editorStatsPeriodTotal")],
      ["none",  this._t("editorStatsPeriodNone")],
    ];
    // The legacy vocabulary stays valid in existing YAML and keeps its own
    // meaning (365d is a rolling window, not the calendar year). So the select
    // offers the configured legacy value as an option of its own rather than
    // showing a neighbouring one, and rewrites it only when the user picks
    // something else.
    const legacyPeriodLabels = {
      "30d":      "editorStatsPeriod30d",
      "365d":     "editorStatsPeriod365d",
      "thisYear": "editorStatsPeriodThisYear",
    };
    if (legacyPeriodLabels[c.stats_period]) {
      statsPeriodOptions.push([c.stats_period, this._t(legacyPeriodLabels[c.stats_period])]);
    }

    const titlePlaceholder = {
      loadpoint: this._t("editorTitlePlaceholderLoadpoint"),
      compact:   this._t("editorTitlePlaceholderCompact"),
      plan:      this._t("editorTitlePlaceholderPlan"),
      repeatplan:this._t("editorTitlePlaceholderRepeatplan"),
      priority:  this._t("editorTitlePlaceholderPriority"),
      site:      this._t("editorTitlePlaceholderSite"),
      flow:      this._t("editorTitlePlaceholderFlow"),
      grid:      this._t("editorTitlePlaceholderGrid"),
      stats:     this._t("editorTitlePlaceholderStats"),
      battery:   this._t("editorTitlePlaceholderBattery"),
      vehicle:   this._t("editorTitlePlaceholderVehicle"),
    }[mode] || this._t("editorTitlePlaceholderLoadpoint");

    const modeDesc = {
      loadpoint:  this._t("editorModeDescLoadpoint"),
      compact:    this._t("editorModeDescCompact"),
      site:       this._t("editorModeDescSite"),
      flow:       this._t("editorModeDescFlow"),
      grid:       this._t("editorModeDescGrid"),
      battery:    this._t("editorModeDescBattery"),
      vehicle:    this._t("editorModeDescVehicle"),
      stats:      this._t("editorModeDescStats"),
      plan:       this._t("editorModeDescPlan"),
      repeatplan: this._t("editorModeDescRepeatplan"),
      priority:   this._t("editorModeDescPriority"),
      debug:      this._t("editorModeDescDebug"),
    }[mode] || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field-label { font-size: .875rem; font-weight: 500; color: var(--primary-text-color); }
        .section-title { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); }
        .hint { font-size: .75rem; color: var(--secondary-text-color); }
        .ha-select, .ha-input {
          width: 100%; padding: 8px 12px; border-radius: 4px; font-size: 1rem;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color, #e0e0e0);
          box-sizing: border-box; font-family: inherit;
        }
        .ha-select:focus, .ha-input:focus { outline: none; border-color: var(--primary-color); }
        .vehicle-media { margin-top: 6px; }
        .vehicle-media:empty { display: none; }
        .cb-row { display: flex; align-items: center; gap: 8px; font-size: .875rem; cursor: pointer; padding: 4px 0; }
        .cb-row input[type="checkbox"] { accent-color: var(--primary-color); width: 16px; height: 16px; cursor: pointer; }
      </style>
      <div class="form">
        <div class="field">
          <label class="field-label" for="mode">${this._t("editorModeLabel")}</label>
          ${this._sel("mode", [
            ["loadpoint", this._t("editorModeLoadpoint")],
            ["compact",   this._t("editorModeCompact")],
            ["site",      this._t("editorModeSite")],
            ["flow",      this._t("editorModeFlow")],
            ["grid",      this._t("editorModeGrid")],
            ["battery",   this._t("editorModeBattery")],
            ["vehicle",   this._t("editorModeVehicle")],
            ["stats",     this._t("editorModeStats")],
            ["plan",      this._t("editorModePlan")],
            ["repeatplan",this._t("editorModeRepeatplan")],
            ["priority",  this._t("editorModePriority")],
            ["debug",     this._t("editorModeDebug")],
          ], mode)}
          ${modeDesc ? `<div class="hint">${modeDesc}</div>` : ""}
        </div>
        ${instanceOptions ? `
        <div class="field">
          <label class="field-label" for="prefix">${this._t("editorInstanceLabel")}</label>
          ${this._sel("prefix", instanceOptions, this._getPrefix())}
          <div class="hint">${this._t("editorInstanceHint")}</div>
        </div>
        ` : ""}
        <div class="field">
          <label class="field-label" for="title">${this._t("editorTitleLabel")} <span class="hint" style="display:inline">(${this._t("editorOptional")})</span></label>
          <input id="title" class="ha-input" type="text" value="${this._esc(c.title || "")}" placeholder="${titlePlaceholder}">
        </div>
        <div class="field">
          <label class="field-label" for="language">${this._t("editorLanguageLabel")}</label>
          ${this._sel("language", [
            ["",   this._t("editorLanguageAuto")],
            ["de", this._t("editorLanguageNameDe")],
            ["en", this._t("editorLanguageNameEn")],
            ["es", this._t("editorLanguageNameEs")],
            ["fr", this._t("editorLanguageNameFr")],
            ["hr", this._t("editorLanguageNameHr")],
            ["nl", this._t("editorLanguageNameNl")],
            ["pl", this._t("editorLanguageNamePl")],
            ["pt", this._t("editorLanguageNamePt")],
          ], c.language || "")}
        </div>
        <div class="field">
          <label class="field-label" for="size">${this._t("editorSizeLabel")}</label>
          ${this._sel("size", [
            ["",       this._t("editorSizeAuto")],
            ["small",  this._t("editorSizeSmall")],
            ["medium", this._t("editorSizeMedium")],
            ["large",  this._t("editorSizeLarge")],
          ], c.size || "")}
        </div>
        ${showLoadpoints ? `
        <div class="field">
          <div class="section-title">${this._t("editorShowLoadpointsTitle")}</div>
          <div class="hint">${this._t("editorShowLoadpointsHint")}</div>
          ${this._checkboxes("loadpoints", selLps)}
        </div>
        ` : ""}
        ${showLoadpoints ? `
        <div class="field">
          <label class="field-label" for="disabled_loadpoints">${this._t("editorDisabledLoadpointsLabel")}</label>
          ${this._sel("disabled_loadpoints", [
            ["",     this._t("editorDisabledLoadpointsHide")],
            ["dim",  this._t("editorDisabledLoadpointsDim")],
            ["show", this._t("editorDisabledLoadpointsShow")],
          ], c.disabled_loadpoints || "")}
          <div class="hint">${this._t("editorDisabledLoadpointsHint")}</div>
        </div>
        ` : ""}
        ${showVehicleFilter ? `
        <div class="field">
          <div class="section-title">${this._t("editorVehicleFilterTitle")}</div>
          <div class="hint">${this._t("editorVehicleFilterHint")}</div>
          ${this._vehicleCheckboxes("repeating_plan_vehicles", rplanVehicles)}
        </div>
        ` : ""}
        ${showVehicles ? `
        <div class="field">
          <div class="section-title">${this._t("editorVehicleFilterTitle")}</div>
          <div class="hint">${this._t("editorVehicleFilterHint")}</div>
          ${this._vehicleCheckboxes("vehicles", selVehicles, Object.keys(discoverVehicles(this._hass, this._getPrefix())).sort(), "editorVehiclesNoneFound")}
        </div>
        <div class="field">
          <label class="field-label" for="vehicle_graphic">${this._t("editorVehicleGraphicLabel")}</label>
          ${this._sel("vehicle_graphic", [
            ["",     this._t("editorVehicleGraphicShow")],
            ["hide", this._t("editorVehicleGraphicHide")],
          ], c.vehicle_graphic === "hide" ? "hide" : "")}
        </div>
        <div class="field">
          <div class="section-title">${this._t("editorVehicleDeviceTitle")}</div>
          <div class="hint">${this._t("editorVehicleDeviceHint")}</div>
          ${this._vehicleDeviceFields(discoverVehicles(this._hass, this._getPrefix()))}
        </div>
        ` : ""}
        ${showNoPlan ? `
        <div class="field">
          <div class="section-title">${this._t("editorNoPlanForTitle")}</div>
          ${this._checkboxes("no_plan", noPlan)}
        </div>
        ` : ""}
        ${showNoPlan ? `
        <div class="field">
          <div class="section-title">${this._t("editorNoPvForTitle")}</div>
          ${this._checkboxes("no_pv", noPv)}
        </div>
        ` : ""}
        ${showChargeCurrent ? `
        <div class="field">
          <label class="field-label" for="charge_current_settings">${this._t("editorChargeCurrentSettingsLabel")}</label>
          ${this._sel("charge_current_settings", [
            ["collapsed", this._t("editorCollapsed")],
            ["expanded",  this._t("editorExpanded")],
          ], c.charge_current_settings || "collapsed")}
        </div>
        ` : ""}
        ${showChargeCurrent ? `
        <div class="field">
          <div class="section-title">${this._t("editorHideSettingsTitle")}</div>
          <div class="hint">${this._t("editorHideSettingsHint")}</div>
          ${HIDEABLE_SETTINGS.map(([key, labelKey]) => `
            <label class="cb-row">
              <input type="checkbox" data-field="hide_settings" data-lp="${key}" ${hideSettings.includes(key) ? "checked" : ""}>
              <span>${this._esc(this._t(labelKey))}</span>
            </label>`).join("")}
        </div>
        ` : ""}
        ${showSiteDetails ? `
        <div class="field">
          <label class="field-label" for="site_details">${this._t("editorSiteDetailsLabel")}</label>
          ${this._sel("site_details", [
            ["expanded",  this._t("editorExpanded")],
            ["collapsed", this._t("editorCollapsed")],
          ], c.site_details || "expanded")}
        </div>
        ` : ""}
        ${showStatsPeriod ? `
        <div class="field">
          <label class="field-label" for="stats_period">${this._t("editorStatsPeriodLabel")}</label>
          ${this._sel("stats_period", statsPeriodOptions, c.stats_period || "")}
        </div>
        ` : ""}
      </div>
    `;

    this._addListeners();
  }

  _addListeners() {
    ["mode", "language", "site_details", "charge_current_settings", "stats_period", "size", "disabled_loadpoints", "vehicle_graphic"].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        this._config = { ...this._config, [id]: el.value || undefined };
        this._fire();
        if (id === "mode") this._render();
      });
    });

    // Instance: the first entry is what the card detects on its own, so picking
    // it drops `prefix` from the config. Loadpoint and vehicle selections belong
    // to the instance they were made for and are cleared along with the switch.
    const prefixEl = this.shadowRoot.getElementById("prefix");
    if (prefixEl) {
      prefixEl.addEventListener("change", () => {
        const chosen = prefixEl.value;
        const isDefault = this._instances.length > 0 && chosen === this._instances[0].prefix;
        this._config = {
          ...this._config,
          prefix: isDefault ? undefined : chosen,
          loadpoints: undefined, no_plan: undefined, no_pv: undefined, repeating_plan_vehicles: undefined, vehicles: undefined, vehicle_devices: undefined, vehicle_images: undefined,
        };
        this._discoverLoadpoints();
        this._fire();
        this._render();
      });
    }

    this.shadowRoot.querySelectorAll("[data-vehicle-device]").forEach(sel => {
      sel.addEventListener("change", () => {
        const map = { ...(this._config.vehicle_devices && typeof this._config.vehicle_devices === "object" ? this._config.vehicle_devices : {}) };
        if (sel.value) map[sel.dataset.vehicleDevice] = sel.value;
        else delete map[sel.dataset.vehicleDevice];
        this._config = { ...this._config, vehicle_devices: Object.keys(map).length ? map : undefined };
        this._fire();
      });
    });

    this._mountVehicleMediaPickers();

    // Written on change, not on every key: half a path is not a valid config.
    this.shadowRoot.querySelectorAll("input[data-vehicle-image]").forEach(inp => {
      inp.addEventListener("change", () => {
        const map = { ...(this._config.vehicle_images || {}) };
        const val = inp.value.trim();
        if (val && isVehicleImage(val)) map[inp.dataset.vehicleImage] = val;
        else { delete map[inp.dataset.vehicleImage]; if (val) inp.value = ""; }
        this._config = { ...this._config, vehicle_images: Object.keys(map).length ? map : undefined };
        this._fire();
      });
    });

    const titleEl = this.shadowRoot.getElementById("title");
    if (titleEl) {
      titleEl.addEventListener("input", () => {
        const val = titleEl.value.trim();
        this._config = { ...this._config, title: val || undefined };
        this._fire();
      });
    }

    this.shadowRoot.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const field = cb.dataset.field;
        const lp    = cb.dataset.lp;
        const current = Array.isArray(this._config[field]) ? [...this._config[field]] : [];
        if (cb.checked) {
          if (!current.includes(lp)) current.push(lp);
        } else {
          const idx = current.indexOf(lp);
          if (idx > -1) current.splice(idx, 1);
        }
        this._config = { ...this._config, [field]: current.length > 0 ? current : undefined };
        this._fire();
      });
    });
  }
}
