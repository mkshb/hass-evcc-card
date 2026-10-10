import { HIDEABLE_SETTINGS, SLIDER_STEP_KEYS, SINGLE_LOADPOINT_MODES, vehicleSlug, isVehicleImage, isMediaSourceId,
         loadpointFilter, loadpointOption } from "./core/constants.js";
import { detectIntegration, discoverEntities, discoverVehicles, selectVehicle, cardDisabledEntities, isLoadpointDisabled } from "./core/entity-discovery.js";
import { enableEntity } from "./core/actions.js";
import { disabledEntitiesHtml, disabledListCss, enableEntities } from "./components/disabled-entities.js";
import { loadSharedTranslations, sharedTranslations, sharedTranslationsReady } from "./utils/translations.js";
import { escHtml } from "./utils/html.js";
import { listVehicleDevices, findVehicleDevice, evccVehicleTitle, resolveVehicleDevice, classifyVehicleDevice,
         vehicleOverride, vehicleRoleCandidates, vehicleActionCandidates, VEHICLE_ROLES } from "./core/vehicle-device.js";

// mdi:eye-off
const EYE_OFF_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L18.74,21L20,19.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"/></svg>`;

// mdi:alert, the warning triangle the card shows for disabled entities
const WARN_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/></svg>`;

// mdi:close
const CLEAR_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>`;

// The value of the "not set" option in a select of the form. HA's select cannot
// hold an empty value, so the default option carries this one and the editor
// turns it back into a missing key.
const UNSET = "__unset";

// The value of the option that stands for a list of several loadpoints from
// before, in the modes that show one loadpoint per card.
const MANY = "__many";

// A value from the form as it goes into the config: the unset option, an empty
// field, a switch that is off and an empty list all drop the key.
function unsetToUndefined(v) {
  if (v === UNSET || v === "" || v === null || v === false) return undefined;
  if (Array.isArray(v) && !v.length) return undefined;
  return v;
}

const MODE_DESC = {
  loadpoint:  "editorModeDescLoadpoint",
  compact:    "editorModeDescCompact",
  site:       "editorModeDescSite",
  flow:       "editorModeDescFlow",
  grid:       "editorModeDescGrid",
  battery:    "editorModeDescBattery",
  vehicle:    "editorModeDescVehicle",
  stats:      "editorModeDescStats",
  plan:       "editorModeDescPlan",
  repeatplan: "editorModeDescRepeatplan",
  priority:   "editorModeDescPriority",
  debug:      "editorModeDescDebug",
};

const TITLE_PLACEHOLDER = {
  loadpoint:  "editorTitlePlaceholderLoadpoint",
  compact:    "editorTitlePlaceholderCompact",
  plan:       "editorTitlePlaceholderPlan",
  repeatplan: "editorTitlePlaceholderRepeatplan",
  priority:   "editorTitlePlaceholderPriority",
  site:       "editorTitlePlaceholderSite",
  flow:       "editorTitlePlaceholderFlow",
  grid:       "editorTitlePlaceholderGrid",
  stats:      "editorTitlePlaceholderStats",
  battery:    "editorTitlePlaceholderBattery",
  vehicle:    "editorTitlePlaceholderVehicle",
};

const LANGUAGES = [
  ["de", "editorLanguageNameDe"],
  ["en", "editorLanguageNameEn"],
  ["es", "editorLanguageNameEs"],
  ["fr", "editorLanguageNameFr"],
  ["hr", "editorLanguageNameHr"],
  ["nl", "editorLanguageNameNl"],
  ["pl", "editorLanguageNamePl"],
  ["pt", "editorLanguageNamePt"],
];

const SECTION_TITLES = {
  content: "editorSectionContent",
  look:    "editorSectionLook",
};

const LEGACY_PERIOD_LABELS = {
  "30d":      "editorStatsPeriod30d",
  "365d":     "editorStatsPeriod365d",
  "thisYear": "editorStatsPeriodThisYear",
};

const EDITOR_CSS = `
  :host { display: block; }
  .form { display: flex; flex-direction: column; gap: 16px; }
  .form > div:empty { display: none; }
  .form-extra { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field-label { font-size: .875rem; font-weight: 500; color: var(--primary-text-color); }
  .section-title { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); }
  .hint { font-size: .75rem; color: var(--secondary-text-color); }
  .deprecated { padding: 8px 12px; border-radius: 4px; font-size: .875rem; color: var(--error-color, #db4437);
                background: rgba(219, 68, 55, .1); border-left: 4px solid var(--error-color, #db4437); }
  .ha-select, .ha-input {
    width: 100%; padding: 8px 12px; border-radius: 4px; font-size: 1rem;
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color, #e0e0e0);
    box-sizing: border-box; font-family: inherit;
  }
  .ha-select:focus, .ha-input:focus { outline: none; border-color: var(--primary-color); }
  .panel-icon { display: inline-flex; vertical-align: -4px; margin-right: 8px; color: var(--warning-color, #ffa600); }
  .panel-icon svg { width: 20px; height: 20px; }
  .panel-body { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
  details.panel { border: 1px solid var(--divider-color, #e0e0e0); border-radius: 4px; padding: 0 16px; }
  details.panel > summary { cursor: pointer; padding: 12px 0; font-weight: 500; color: var(--primary-text-color); }
  .vehicle-media { margin-top: 6px; }
  .vehicle-media:empty { display: none; }
  .vehicle-media + .vehicle-image-row { margin-top: 6px; }
  .vehicle-image-row { display: flex; align-items: center; gap: 4px; }
  .vehicle-image-row .ha-input { flex: 1; min-width: 0; }
  .vehicle-image-clear {
    flex-shrink: 0; display: flex; padding: 8px; border: none; border-radius: 50%; cursor: pointer;
    background: none; color: var(--secondary-text-color);
  }
  .vehicle-image-clear:hover, .vehicle-image-clear:focus-visible { color: var(--primary-text-color); background: var(--secondary-background-color, rgba(127,127,127,.15)); outline: none; }
  .vehicle-image-clear[hidden] { display: none; }
  .vehicle-image-clear svg { width: 20px; height: 20px; }
  .vehicle-map-toggle {
    margin: 6px 0 0; padding: 4px 0; background: none; border: none; cursor: pointer;
    color: var(--primary-color); font: inherit; font-size: .85rem; text-align: left;
  }
  .vehicle-map-toggle::before { content: "▸ "; }
  .vehicle-map-toggle[aria-expanded="true"]::before { content: "▾ "; }
  .vehicle-map { margin: 2px 0 10px; padding: 8px 10px; border-left: 2px solid var(--divider-color, rgba(127,127,127,.3)); }
  .vehicle-map-row { margin-bottom: 6px; }
  .vehicle-map-row .field-label { margin-bottom: 2px; }
  .vehicle-role-row { display: flex; align-items: center; gap: 4px; }
  .vehicle-role-row .ha-select, .vehicle-role-pick { flex: 1; min-width: 0; }
  .vehicle-role-none {
    flex: none; background: none; border: none; padding: 2px; border-radius: 50%; cursor: pointer;
    color: var(--secondary-text-color); line-height: 0;
  }
  .vehicle-role-none:hover, .vehicle-role-none:focus-visible { color: var(--primary-text-color); background: var(--secondary-background-color, rgba(127,127,127,.15)); outline: none; }
  .vehicle-role-none[aria-pressed="true"] { color: var(--error-color, #db4437); }
  .vehicle-role-none svg { width: 20px; height: 20px; }
  .vehicle-funcs { margin-top: 10px; }
  .vehicle-func-row { display: flex; align-items: center; gap: 4px; margin: 4px 0; }
  .vehicle-func-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .9rem; }
`;

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
    this._disabled  = [];   // ha-evcc entities disabled in the registry
    this._enabling  = {};   // entity id -> outcome of enabling it here (disabled-entities.js)
    this._vehicleMapOpen = false;   // the entity mapping of the card's vehicle unfolded
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
      detectIntegration(hass).then(({ prefix, instances, disabled }) => {
        this._detectingPrefix = false;
        this._detectedPrefix = prefix;
        this._instances = instances;
        this._disabled = disabled;
        this._discoverLoadpoints();
        this._render();
      });
      return;
    }
    // An enabled entity leaves the list once HA has reloaded ha-evcc.
    const prev = this._availableLoadpoints.join(",") + "|" + this._disabledKey;
    this._discoverLoadpoints();
    const next = this._availableLoadpoints.join(",") + "|" + this._disabledEntries().map(e => e.id).join(",");
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

  // The vehicle sensors count as needed for the card's own vehicle only, and
  // only while it has no device of its own (see disabledCardEntities). Only
  // what this card's warning triangles point at, see cardDisabledEntities.
  _disabledEntries() {
    if (!this._hass) return [];
    const vehicle = this._config.mode === "vehicle" && !this._vehicleDeviceFor()
      ? selectVehicle(discoverVehicles(this._hass, this._getPrefix()), this._config)?.[0] ?? null : null;
    return cardDisabledEntities(this._hass, this._disabled, this._getPrefix(), this._config, { vehicle });
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

  _vehicleTitle(slug, vehicle) {
    return evccVehicleTitle(this._hass, slug, vehicle) || slug;
  }

  // The device of the vehicle's own integration. The first option is what the
  // card does by itself and names the device it found, so nobody has to pick
  // what is already right; a choice is written to `vehicle_device`, the
  // automatic one removes the option again.
  _vehicleDeviceField(slug, vehicle) {
    const devices = listVehicleDevices(this._hass);
    const option  = (val, label, cur) => `<option value="${this._esc(val)}"${cur === val ? " selected" : ""}>${this._esc(label)}</option>`;
    const title   = this._vehicleTitle(slug, vehicle);
    const found   = devices.find(d => d.id === findVehicleDevice(this._hass, slug, title));
    const chosen  = this._config.vehicle_device;
    const cur     = chosen === false ? "none" : (typeof chosen === "string" ? chosen : "");
    const like    = devices.filter(d => d.vehicleLike);
    const other   = devices.filter(d => !d.vehicleLike);
    return `
      <select id="vehicle-device" class="ha-select" data-vehicle-device>
        ${option("", this._t("editorVehicleDeviceAuto", { val: found ? found.name : this._t("editorVehicleDeviceNotFound") }), cur)}
        ${option("none", this._t("editorVehicleDeviceNone"), cur)}
        ${like.length ? `<optgroup label="${this._esc(this._t("editorVehicleDeviceGroupVehicles"))}">${like.map(d => option(d.id, d.name, cur)).join("")}</optgroup>` : ""}
        ${other.length ? `<optgroup label="${this._esc(this._t("editorVehicleDeviceGroupOther"))}">${other.map(d => option(d.id, d.name, cur)).join("")}</optgroup>` : ""}
        ${cur && cur !== "none" && !devices.some(d => d.id === cur) ? option(cur, cur, cur) : ""}
      </select>
      ${this._vehicleMapFields(slug, resolveVehicleDevice(this._hass, this._config, slug, title))}`;
  }

  // The entity mapping of one vehicle, folded away: one field per role and the
  // list of functions. Where Home Assistant's own entity picker is there, each
  // role gets it, with its search and narrowed down to the entities that could
  // fill the role; without it a plain select stands in, the entities of the
  // vehicle's device first. Empty means the card decides by itself, and the
  // button next to the field switches a role off for good.
  // Rendered only while it is unfolded, so an installation with many entities
  // pays for the fields only when someone looks at them.
  _vehicleMapFields(slug, deviceId) {
    const ov    = vehicleOverride(this._config) || {};
    const set   = VEHICLE_ROLES.filter(r => r.key in ov).length + ("actions" in ov ? 1 : 0);
    const open  = !!this._vehicleMapOpen;
    const head  = `
      <button type="button" class="vehicle-map-toggle" data-vehicle-map aria-expanded="${open}">
        <span>${this._esc(this._t("editorVehicleMapToggle"))}${set ? ` (${this._esc(this._t("editorVehicleMapSet", { val: set }))})` : ""}</span>
      </button>`;
    if (!open) return head;

    const search = this._haSelectorReady();
    const auto   = classifyVehicleDevice(this._hass, deviceId, null);
    const hide   = this._t("editorVehicleRoleNone");
    const rows = VEHICLE_ROLES.map(role => {
      const cur   = typeof ov[role.key] === "string" ? ov[role.key] : (ov[role.key] === false ? "none" : "");
      const off   = cur === "none";
      const label = this._t("vehicleRole_" + role.key);
      const field = search
        ? `<div class="vehicle-role-pick" data-vehicle-role-pick data-role="${role.key}"></div>`
        : this._vehicleRoleSelect(role, deviceId, cur, auto);
      return `
        <div class="vehicle-map-row">
          ${search ? "" : `<label class="field-label" for="vehicle-role-${role.key}">${this._esc(label)}</label>`}
          <div class="vehicle-role-row">
            ${field}
            <button type="button" class="vehicle-role-none" data-vehicle-role-none data-role="${role.key}"
                    aria-pressed="${off}" title="${this._esc(hide)}" aria-label="${this._esc(`${label}: ${hide}`)}">${EYE_OFF_ICON}</button>
          </div>
        </div>`;
    }).join("");

    return head + `
      <div class="vehicle-map">
        <div class="hint">${this._esc(this._t("editorVehicleMapHint"))}</div>
        ${rows}
        ${this._vehicleFunctionFields(deviceId)}
      </div>`;
  }

  // The select that stands in for the picker: the automatic choice, "do not
  // show", then the entities of the vehicle's device and everything else that
  // fits the role.
  _vehicleRoleSelect(role, deviceId, cur, auto) {
    const cand   = vehicleRoleCandidates(this._hass, role.key, deviceId);
    const autoId = this._vehicleAutoRole(auto, role.key);
    const opt    = (val, label) => `<option value="${this._esc(val)}"${cur === val ? " selected" : ""}>${this._esc(label)}</option>`;
    const group  = (label, list) => list.length ? `<optgroup label="${this._esc(label)}">${list.map(e => opt(e.entityId, `${e.name} (${e.entityId})`)).join("")}</optgroup>` : "";
    const known  = [...cand.device, ...cand.other].some(e => e.entityId === cur);
    return `
      <select id="vehicle-role-${role.key}" class="ha-select" data-vehicle-role data-role="${role.key}">
        ${opt("", autoId ? this._t("editorVehicleRoleAuto", { val: autoId }) : this._t("editorVehicleRoleAutoNone"))}
        ${opt("none", this._t("editorVehicleRoleNone"))}
        ${group(this._deviceName(deviceId) || this._t("editorVehicleRoleGroupDevice"), cand.device)}
        ${group(this._t("editorVehicleRoleGroupAll"), cand.other)}
        ${cur && cur !== "none" && !known ? opt(cur, cur) : ""}
      </select>`;
  }

  // What the card takes for a role on its own: an entity from the device, or one
  // of the three that make up the preconditioning.
  _vehicleAutoRole(auto, key) {
    const slot = VEHICLE_ROLES.find(r => r.key === key)?.climate;
    return slot ? (auto.climate?.[slot] ?? null) : (auto.roles[key] ?? null);
  }

  // Home Assistant's entity picker per role: it searches, and it only offers
  // what could fill the role. Empty is the automatic choice, which the helper
  // line under the field names; a role switched off keeps the field empty and
  // disabled, the button beside it says so.
  _mountVehicleRolePickers() {
    const slots = this.shadowRoot.querySelectorAll("[data-vehicle-role-pick]");
    if (!slots.length || !this._haSelectorReady()) return;
    // The device and what the card picks by itself are the same for every
    // role; each search walks the registries, so it runs once, not per role.
    const deviceId = this._vehicleDeviceFor();
    const ov       = vehicleOverride(this._config) || {};
    const auto     = classifyVehicleDevice(this._hass, deviceId, null);
    slots.forEach(slot => {
      const key      = slot.dataset.role;
      const cur      = typeof ov[key] === "string" ? ov[key] : (ov[key] === false ? "none" : "");
      const cand     = vehicleRoleCandidates(this._hass, key, deviceId);
      const ids      = [...cand.device, ...cand.other].map(e => e.entityId);
      const autoId   = this._vehicleAutoRole(auto, key);
      const picker   = document.createElement("ha-selector");
      picker.hass     = this._hass;
      // A configured entity that fits no longer, or none of this installation,
      // still belongs in the list or the picker would drop it silently.
      picker.selector = { entity: { include_entities: cur && cur !== "none" && !ids.includes(cur) ? [...ids, cur] : ids } };
      picker.label    = this._t("vehicleRole_" + key);
      picker.helper   = autoId ? this._t("editorVehicleRoleAuto", { val: autoId }) : this._t("editorVehicleRoleAutoNone");
      picker.disabled = cur === "none";
      picker.value    = cur && cur !== "none" ? cur : undefined;
      picker.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const id = e.detail?.value;
        this._setVehicleRole(key, typeof id === "string" ? id : "");
        this._render();
      });
      slot.appendChild(picker);
    });
  }

  // The functions of a vehicle: what the card shows as buttons today, each with
  // a remove button, and one field to add another one.
  _vehicleFunctionFields(deviceId) {
    const ov      = vehicleOverride(this._config) || {};
    const current = classifyVehicleDevice(this._hass, deviceId, ov).actions;
    const cand    = vehicleActionCandidates(this._hass, deviceId);
    const known   = [...cand.device, ...cand.other];
    const name    = id => known.find(e => e.entityId === id)?.name || id;
    const remove  = this._t("editorVehicleFunctionRemove");
    const free    = list => list.filter(e => !current.includes(e.entityId));
    const group   = (label, list) => list.length ? `<optgroup label="${this._esc(label)}">${list.map(e =>
      `<option value="${this._esc(e.entityId)}">${this._esc(`${e.name} (${e.entityId})`)}</option>`).join("")}</optgroup>` : "";
    const add = this._haSelectorReady()
      ? `<div class="vehicle-func-add" data-vehicle-func-pick></div>`
      : `<select class="ha-select" data-vehicle-func-add>
          <option value="">${this._esc(this._t("editorVehicleFunctionAdd"))}</option>
          ${group(this._deviceName(deviceId) || this._t("editorVehicleRoleGroupDevice"), free(cand.device))}
          ${group(this._t("editorVehicleRoleGroupAll"), free(cand.other))}
        </select>`;
    return `
      <div class="vehicle-funcs">
        <div class="field-label">${this._esc(this._t("editorVehicleFunctionsTitle"))}</div>
        <div class="hint">${this._esc(this._t("editorVehicleFunctionsHint"))}</div>
        ${current.length ? current.map(id => `
          <div class="vehicle-func-row">
            <span class="vehicle-func-name" title="${this._esc(id)}">${this._esc(name(id))}</span>
            <button type="button" class="vehicle-image-clear" data-vehicle-func-remove data-entity="${this._esc(id)}"
                    title="${this._esc(remove)}" aria-label="${this._esc(remove)}">${CLEAR_ICON}</button>
          </div>`).join("") : `<div class="hint">${this._esc(this._t("editorVehicleFunctionsNone"))}</div>`}
        ${add}
      </div>`;
  }

  // Adding a function through the picker: the ones already listed stay out of
  // it, and after the pick the field is empty again for the next one.
  _mountVehicleFunctionPickers() {
    const slots = this.shadowRoot.querySelectorAll("[data-vehicle-func-pick]");
    if (!slots.length || !this._haSelectorReady()) return;
    const deviceId = this._vehicleDeviceFor();
    slots.forEach(slot => {
      const current  = classifyVehicleDevice(this._hass, deviceId, vehicleOverride(this._config)).actions;
      const cand     = vehicleActionCandidates(this._hass, deviceId);
      const picker   = document.createElement("ha-selector");
      picker.hass     = this._hass;
      picker.selector = { entity: { include_entities: [...cand.device, ...cand.other]
        .map(e => e.entityId).filter(id => !current.includes(id)) } };
      picker.label    = this._t("editorVehicleFunctionAdd");
      picker.value    = undefined;
      picker.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const id = e.detail?.value;
        if (typeof id !== "string" || !id) return;
        this._setVehicleFunctions([...current, id]);
        this._render();
      });
      slot.appendChild(picker);
    });
  }

  // The device of a vehicle the way the card sees it: the configured one, else
  // the one the search finds for the evcc title.
  _vehicleDeviceFor() {
    const chosen = selectVehicle(discoverVehicles(this._hass, this._getPrefix()), this._config);
    if (!chosen) return null;
    const [slug, vehicle] = chosen;
    return resolveVehicleDevice(this._hass, this._config, slug, evccVehicleTitle(this._hass, slug, vehicle));
  }

  _deviceName(deviceId) {
    const dev = deviceId ? this._hass?.devices?.[deviceId] : null;
    return dev ? (dev.name_by_user || dev.name || deviceId) : null;
  }

  // Writing one role: an entity id or "none" is kept, the empty choice
  // (automatic) removes the role again, and a vehicle without a single setting
  // drops out of the option, as the option itself does when it is empty.
  _setVehicleRole(role, value) {
    const entry = { ...(vehicleOverride(this._config) || {}) };
    if (value) entry[role] = value;
    else delete entry[role];
    this._config = { ...this._config, vehicle_entities: Object.keys(entry).length ? entry : undefined };
    this._fire();
  }

  _setVehicleFunctions(list) {
    this._setVehicleRole("actions", list);
  }

  // A picture of the card's vehicle (`key`: vehicle_image or one of the
  // pictures for a state): HA's media picker, and a text field underneath for
  // a path or an address (and to show what was picked). A set picture gets a
  // button next to the field that removes it.
  _vehicleImageField(key) {
    const remove  = this._t("editorVehicleImageRemove");
    const current = this._config[key] || "";
    return `
      <div class="vehicle-media" data-vehicle-media="${key}"></div>
      <div class="vehicle-image-row">
        <input id="${key.replace(/_/g, "-")}" class="ha-input" type="text" data-vehicle-image="${key}"
               value="${this._esc(current)}" placeholder="${this._esc(this._t("editorVehicleImagePlaceholder"))}">
        <button type="button" class="vehicle-image-clear" data-vehicle-image-clear="${key}"
                title="${this._esc(remove)}" aria-label="${this._esc(remove)}"${current ? "" : " hidden"}>${CLEAR_ICON}</button>
      </div>`;
  }

  _setVehicleImage(key, value) {
    this._config = { ...this._config, [key]: value || undefined };
    this._fire();
  }

  // The picture of a vehicle is picked from Home Assistant's media library with
  // HA's own media selector, narrowed to images. The element belongs to the HA
  // frontend and is loaded on demand there, so it is created once it is defined;
  // the text field underneath works without it and shows what was picked.
  // Whether HA's own selector element is there. The frontend loads it on demand,
  // so the first render can come before it; the editor asks once to be told and
  // renders again, and until then the plain fields stand in.
  _haSelectorReady() {
    if (customElements.get("ha-selector")) return true;
    if (!this._waitingForSelector) {
      this._waitingForSelector = true;
      customElements.whenDefined("ha-selector").then(() => { this._waitingForSelector = false; this._render(); });
    }
    return false;
  }

  _mountVehicleMediaPickers() {
    const slots = this.shadowRoot.querySelectorAll("[data-vehicle-media]");
    if (!slots.length || !this._haSelectorReady()) return;
    slots.forEach(slot => {
      const key     = slot.dataset.vehicleMedia;
      const current = this._config[key];
      const picker  = document.createElement("ha-selector");
      picker.hass     = this._hass;
      picker.selector = { media: { accept: ["image/*"] } };
      picker.label    = this._t("editorVehicleImagePick");
      picker.value    = isMediaSourceId(current) ? { media_content_id: current, media_content_type: "image/*", metadata: {} } : undefined;
      picker.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const id = e.detail?.value?.media_content_id;
        this._setVehicleImage(key, isMediaSourceId(id) ? id : null);
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

  // The fields of HA's form for the current config and mode. Each field carries
  // its schema entry, the value the form shows, label and helper, and how a
  // value from the form goes back into the config (`write`, default: an unset
  // value drops the key). `after` adjusts other keys a change takes along, and
  // `rebuild` marks the fields that change which fields there are.
  _fields() {
    const c    = this._config;
    const mode = c.mode || "loadpoint";
    const opt  = (value, label) => ({ value, label });
    const tOpt = (value, key, r) => opt(value, this._t(key, r));
    const pick = (name, options, value, extra = {}) =>
      ({ name, schema: { name, required: true, selector: { select: { mode: "dropdown", options } } }, value, ...extra });
    const many = (name, options, value, extra = {}) =>
      ({ name, schema: { name, selector: { select: { multiple: true, mode: "list", options } } }, value, ...extra });
    const flag = (name, extra = {}) =>
      ({ name, schema: { name, selector: { boolean: {} } }, value: c[name] === true, ...extra });

    const showLoadpoints    = ["loadpoint", "compact", "plan", "priority"].includes(mode);
    const single            = SINGLE_LOADPOINT_MODES.includes(mode);
    const showNoPlan        = ["loadpoint", "compact"].includes(mode);
    const showChargeCurrent = ["loadpoint", "compact"].includes(mode);
    const showSiteDetails   = ["site", "flow"].includes(mode);
    const showStatsPeriod   = ["stats", "site", "flow", "grid"].includes(mode);
    const lps = this._availableLoadpoints;
    const fields = [];
    // What the card draws: the loadpoints it is limited to, else all of them.
    const filter = loadpointFilter(c);
    const shown  = filter || lps;
    const oneLp  = shown.length === 1 ? shown[0] : null;

    fields.push(pick("mode", [
      tOpt("loadpoint",  "editorModeLoadpoint"),
      tOpt("compact",    "editorModeCompact"),
      tOpt("site",       "editorModeSite"),
      tOpt("flow",       "editorModeFlow"),
      tOpt("grid",       "editorModeGrid"),
      tOpt("battery",    "editorModeBattery"),
      tOpt("vehicle",    "editorModeVehicle"),
      tOpt("stats",      "editorModeStats"),
      tOpt("plan",       "editorModePlan"),
      tOpt("repeatplan", "editorModeRepeatplan"),
      tOpt("priority",   "editorModePriority"),
      tOpt("debug",      "editorModeDebug"),
    ], mode, { label: this._t("editorModeLabel"), helper: this._t(MODE_DESC[mode] || "") || undefined,
               after: next => this._fitLoadpoints(next) }));

    // Instance: the first entry is what the card detects on its own, so picking
    // it drops `prefix` from the config. Loadpoint and vehicle selections belong
    // to the instance they were made for and are cleared along with the switch.
    const instanceOptions = this._instanceOptions();
    if (instanceOptions) {
      fields.push(pick("prefix", instanceOptions.map(([v, l]) => opt(v, l)), this._getPrefix(), {
        label: this._t("editorInstanceLabel"), helper: this._t("editorInstanceHint"),
        write: v => (this._instances.length > 0 && v === this._instances[0].prefix) ? undefined : v,
        after: next => {
          Object.assign(next, { loadpoint: undefined, loadpoints: undefined, no_plan: undefined, no_pv: undefined, repeating_plan_vehicles: undefined,
            vehicle: undefined, vehicles: undefined, vehicle_device: undefined, vehicle_image: undefined,
            vehicle_image_connected: undefined, vehicle_image_charging: undefined, vehicle_entities: undefined });
        },
      }));
    }

    // The title is written trimmed, and a blank one drops the key.
    fields.push({ name: "title", schema: { name: "title", selector: { text: {} } },
      value: c.title || "",
      label: `${this._t("editorTitleLabel")} (${this._t("editorOptional")})`,
      helper: this._t(TITLE_PLACEHOLDER[mode] || TITLE_PLACEHOLDER.loadpoint),
      write: v => (typeof v === "string" && v.trim()) ? v.trim() : undefined });

    fields.push(pick("language", [
      tOpt(UNSET, "editorLanguageAuto"),
      ...LANGUAGES.map(([code, key]) => tOpt(code, key)),
    ], c.language || UNSET, { label: this._t("editorLanguageLabel"), section: "look" }));

    fields.push(pick("size", [
      tOpt(UNSET,    "editorSizeAuto"),
      tOpt("small",  "editorSizeSmall"),
      tOpt("medium", "editorSizeMedium"),
      tOpt("large",  "editorSizeLarge"),
    ], c.size || UNSET, { label: this._t("editorSizeLabel"), section: "look" }));

    // One loadpoint per card in the loadpoint and plan modes, picked like the
    // vehicle: with a single loadpoint the card takes it by itself and the
    // first option says so. A list of several from before is an option of its
    // own and keeps drawing them all until another one is picked; the red
    // note above the form then says that this goes away (_deprecatedHtml).
    if (single && lps.length) {
      const legacy = !c.loadpoint && filter && filter.length > 1;
      const value  = c.loadpoint ?? (legacy ? MANY : (filter ? filter[0] : UNSET));
      // Drawing them all is phasing out: offered only while the card does it.
      fields.push(pick("loadpoint", [
        ...(lps.length === 1 ? [opt(UNSET, this._t("editorLoadpointAuto", { val: lps[0] }))]
          : value === UNSET ? [opt(UNSET, `\u26A0 ${this._t("editorLoadpointAll")}`)] : []),
        ...lps.map(lp => opt(lp, lp)),
        ...(value !== UNSET && value !== MANY && !lps.includes(value) ? [opt(value, value)] : []),
        ...(legacy ? [opt(MANY, `\u26A0 ${this._t("editorLoadpointMany", { val: filter.join(", ") })}`)] : []),
      ], value, {
        label: this._t("editorLoadpointTitle"),
        helper: oneLp ? this._t("editorLoadpointHint") : undefined,
        write: v => (v === UNSET || v === MANY) ? undefined : v,
        after: next => { next.loadpoints = undefined; this._fitLoadpoints(next); },
      }));
    } else if (showLoadpoints && lps.length) {
      fields.push(many("loadpoints", ...this._listField("loadpoints", lps),
        { label: this._t("editorShowLoadpointsTitle"), helper: this._t("editorShowLoadpointsHint") }));
    }
    // A card for one loadpoint has no other to hide it among, unless evcc has
    // disabled that one: hiding it then empties the card.
    const oneOff = oneLp && this._hass && isLoadpointDisabled(this._hass,
      { disabled_in_config: `binary_sensor.${this._getPrefix()}${oneLp}_disabled_in_config` });
    if (showLoadpoints && !(single && oneLp && !oneOff)) {
      fields.push(pick("disabled_loadpoints", [
        tOpt(UNSET,  "editorDisabledLoadpointsHide"),
        tOpt("dim",  "editorDisabledLoadpointsDim"),
        tOpt("show", "editorDisabledLoadpointsShow"),
      ], c.disabled_loadpoints || UNSET,
      { label: this._t("editorDisabledLoadpointsLabel"), helper: this._t("editorDisabledLoadpointsHint"), section: "content" }));
    }

    const rplanSlugs = mode === "repeatplan" ? this._availableVehicleSlugs : [];
    if (rplanSlugs.length) {
      const title = slug => String(slug).replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase());
      fields.push(many("repeating_plan_vehicles", ...this._listField("repeating_plan_vehicles", rplanSlugs, { nocase: true, label: title }),
        { label: this._t("editorVehicleFilterTitle"), helper: this._t("editorVehicleFilterHint") }));
    }

    // The vehicle this card is for. One card shows one vehicle, so this is a
    // plain choice: with a single vehicle in the installation the card takes it
    // by itself and the first option says so, with several one has to be
    // picked. Another vehicle means another device, another picture and another
    // mapping: what was set belonged to the vehicle before it, so it goes.
    const vehicles = mode === "vehicle" && this._hass ? discoverVehicles(this._hass, this._getPrefix()) : {};
    const vSlugs   = Object.keys(vehicles).sort();
    if (vSlugs.length) {
      const first = vSlugs.length === 1
        ? this._t("editorVehicleAuto", { val: this._vehicleTitle(vSlugs[0], vehicles[vSlugs[0]]) })
        : this._t("editorVehiclePick");
      const cur = vehicleSlug(c);
      const value = cur ? (vSlugs.find(s => s.toLowerCase() === String(cur).toLowerCase()) ?? String(cur)) : UNSET;
      fields.push(pick("vehicle", [
        opt(UNSET, first),
        ...vSlugs.map(slug => opt(slug, this._vehicleTitle(slug, vehicles[slug]))),
        ...(value !== UNSET && !vSlugs.includes(value) ? [opt(value, value)] : []),
      ], value, {
        label: this._t("editorVehicleTitle"), helper: this._t("editorVehicleHint"),
        after: next => Object.assign(next, { vehicles: undefined, vehicle_device: undefined, vehicle_image: undefined,
          vehicle_image_connected: undefined, vehicle_image_charging: undefined, vehicle_entities: undefined }),
      }));
      if (selectVehicle(vehicles, c)) fields.push(flag("vehicle_actions", { label: this._t("editorVehicleActions"), section: "content" }));
    }

    // For one loadpoint a switch that writes `true`, for several a list of names.
    // `no_pv` has no field: evcc offers the solar modes whenever a grid meter
    // is configured, so it only matters without one and stays a YAML option.
    if (showNoPlan && lps.length && single && oneLp) {
      fields.push({ name: "no_plan", schema: { name: "no_plan", selector: { boolean: {} } }, value: loadpointOption(c, "no_plan", oneLp),
                    label: this._t("editorNoPlan"), section: "content", write: v => v ? true : undefined });
    } else if (showNoPlan && lps.length) {
      fields.push(many("no_plan", ...this._listField("no_plan", lps), { label: this._t("editorNoPlanForTitle"), section: "content" }));
    }
    if (mode === "battery") fields.push(flag("hide_soc_chart", { label: this._t("editorHideSocChart"), section: "content" }));
    if (showChargeCurrent) {
      fields.push(pick("charge_current_settings", [
        tOpt("collapsed", "editorCollapsed"),
        tOpt("expanded",  "editorExpanded"),
      ], c.charge_current_settings || "collapsed", { label: this._t("editorChargeCurrentSettingsLabel"), section: "content" }));
      fields.push(many("hide_settings", ...this._listField("hide_settings", HIDEABLE_SETTINGS.map(([key]) => key),
        { label: key => this._t(HIDEABLE_SETTINGS.find(([k]) => k === key)?.[1] ?? key) }),
        { label: this._t("editorHideSettingsTitle"), helper: this._t("editorHideSettingsHint"), section: "content" }));
    }
    // The switch for the warning triangle, in the modes that draw one.
    if (["loadpoint", "compact", "battery", "vehicle"].includes(mode)) {
      fields.push(flag("hide_disabled_hint", { label: this._t("editorHideDisabledHint"), section: "content" }));
    }
    if (showSiteDetails) {
      fields.push(pick("site_details", [
        tOpt("expanded",  "editorExpanded"),
        tOpt("collapsed", "editorCollapsed"),
      ], c.site_details || "expanded", { label: this._t("editorSiteDetailsLabel"), section: "content" }));
    }
    if (showStatsPeriod) {
      // `stats_period` has no implicit value: unconfigured, every mode follows
      // its own default (the stats mode opens on the most recent month, the
      // compact footer under site/flow/grid sums everything up). The editor
      // names that default instead of preselecting an option the card does not
      // use. The legacy vocabulary stays valid in existing YAML and keeps its
      // own meaning (365d is a rolling window, not the calendar year), so a
      // configured legacy value is offered as an option of its own rather than
      // showing a neighbouring one, and rewritten only when something else is
      // picked.
      const options = [
        tOpt(UNSET,   "editorStatsPeriodDefault", {
                        val: mode === "stats" ? this._t("statsPeriodMonth") : this._t("editorStatsPeriodTotal") }),
        tOpt("month", "statsPeriodMonth"),
        tOpt("year",  "statsPeriodYear"),
        tOpt("total", "editorStatsPeriodTotal"),
        tOpt("none",  "editorStatsPeriodNone"),
      ];
      if (LEGACY_PERIOD_LABELS[c.stats_period]) options.push(tOpt(c.stats_period, LEGACY_PERIOD_LABELS[c.stats_period]));
      fields.push(pick("stats_period", options, c.stats_period || UNSET, { label: this._t("editorStatsPeriodLabel"), section: "content" }));
    }

    // Advanced, folded away: the step of each number slider. A named section of
    // HA's form keeps its values under its name, which is exactly the shape of
    // `slider_steps`. Keys the editor has no field for stay as they are.
    if (showChargeCurrent) {
      const steps = c.slider_steps && typeof c.slider_steps === "object" ? c.slider_steps : {};
      const known = SLIDER_STEP_KEYS.map(([key]) => key);
      const value = Object.fromEntries(known.filter(k => parseFloat(steps[k]) > 0).map(k => [k, parseFloat(steps[k])]));
      fields.push({
        name: "slider_steps", value,
        schema: { type: "expandable", name: "slider_steps", title: this._t("editorAdvancedTitle"),
                  schema: SLIDER_STEP_KEYS.map(([key]) => ({ name: key, selector: { number: { min: 0, step: "any", mode: "box" } } })) },
        children: Object.fromEntries(SLIDER_STEP_KEYS.map(([key, labelKey]) =>
          [key, { label: this._t("editorSliderStep", { val: this._t(labelKey) }), helper: this._t("editorSliderStepHint") }])),
        write: v => {
          const out = Object.fromEntries(Object.entries(steps).filter(([k]) => !known.includes(k)));
          for (const k of known) if (Number(v?.[k]) > 0) out[k] = Number(v[k]);
          return Object.keys(out).length ? out : undefined;
        },
      });
    }

    // What was typed stays in the form as long as it writes the same config: a
    // title with a trailing space on the way to the next word, a step of 0 on
    // the way to 0.01. Handing the form the config value instead would take the
    // half typed input away under the cursor.
    for (const f of fields) {
      if (!this._typed || !(f.name in this._typed)) continue;
      const write = f.write || unsetToUndefined;
      if (JSON.stringify(write(this._typed[f.name]) ?? null) === JSON.stringify(write(f.value) ?? null)) f.value = this._typed[f.name];
    }
    return fields;
  }

  // Brings `loadpoint` and `loadpoints` in line with the mode (`next`, the
  // config about to be written): a mode for one loadpoint takes a list of one
  // as its loadpoint, a mode for several takes the one loadpoint as a list.
  // A card down to one loadpoint keeps `no_plan` / `no_pv` as `true` where its
  // loadpoint was in the list.
  _fitLoadpoints(next) {
    if (SINGLE_LOADPOINT_MODES.includes(next.mode || "loadpoint")) {
      const list = loadpointFilter(next);
      if (!next.loadpoint && list && list.length === 1) Object.assign(next, { loadpoint: list[0], loadpoints: undefined });
      if (!next.loadpoint) return;
      for (const key of ["no_plan", "no_pv"]) {
        if (next[key] !== undefined && next[key] !== true) next[key] = loadpointOption(next, key, next.loadpoint) || undefined;
      }
    } else if (["compact", "priority"].includes(next.mode) && next.loadpoint) {
      Object.assign(next, { loadpoints: [next.loadpoint], loadpoint: undefined });
    }
  }

  // A list option as the form shows it: a single name is the shorthand of a
  // list with one entry, `true` (every loadpoint, see loadpointOption) all of
  // the known ones, and a name the installation does not have stays in the
  // list as an option of its own, so nothing is dropped unseen. Vehicle slugs
  // are compared without case, like the card does.
  _listField(name, known, { nocase = false, label = v => v } = {}) {
    const raw    = this._config[name];
    const listed = raw === undefined || raw === null || raw === false ? [] : raw === true ? [...known]
      : (Array.isArray(raw) ? raw : [raw]).map(String);
    const value  = listed.map(v => nocase ? (known.find(k => k.toLowerCase() === v.toLowerCase()) ?? v) : v);
    const options = [...known, ...value.filter(v => !known.includes(v))].map(v => ({ value: v, label: label(v) }));
    return [options, value];
  }

  // Whether HA's form element is there. In the card editor dialog the frontend
  // has usually loaded it already; if not, loading the editor of a built-in
  // card brings it along, and the editor renders again once it is defined.
  _haFormReady() {
    if (customElements.get("ha-form")) return true;
    if (!this._waitingForForm) {
      this._waitingForForm = true;
      customElements.whenDefined("ha-form").then(() => { this._waitingForForm = false; this._render(); });
      (async () => {
        try {
          const helpers = await window.loadCardHelpers?.();
          const card    = await helpers?.createCardElement({ type: "entities", entities: [] });
          await card?.constructor?.getConfigElement?.();
        } catch (e) { /* the form stays away, the rest of the editor works */ }
      })();
    }
    return false;
  }

  // HA's form in a slot of the editor: created once and then only handed new
  // data, so focus and an unfolded section survive a change. The schema is set
  // again only when it differs, which is what a mode or instance switch does.
  _mountForm(slot, form, fields, onChange) {
    if (!form || form.parentNode !== slot) {
      slot.replaceChildren();
      form = document.createElement("ha-form");
      form.addEventListener("value-changed", (e) => { e.stopPropagation(); form._evccOnChange?.(e.detail?.value || {}); });
      slot.appendChild(form);
    }
    // The handler compares with the fields of this render, not of the first one.
    form._evccOnChange = onChange;
    const texts = {};
    for (const f of fields) {
      texts[f.name] = { label: f.label, helper: f.helper };
      Object.assign(texts, f.children || {});
    }
    const schema = this._sectionSchema(fields);
    const key    = JSON.stringify(schema);
    form.hass = this._hass;
    if (form._evccSchema !== key) { form.schema = schema; form._evccSchema = key; }
    form.computeLabel  = s => texts[s.name]?.label ?? s.title ?? s.name;
    form.computeHelper = s => texts[s.name]?.helper;
    form.data = Object.fromEntries(fields.map(f => [f.name, f.value]));
    return form;
  }

  // The fields of a section go into a folded panel of their own: first the
  // fields without one, then the panels in the order of SECTION_TITLES, then
  // the panels a field brings itself (the slider steps). A panel is flattened,
  // so its values stay top level keys of the config, and its title counts what
  // is set in it, so a folded panel still tells whether anything differs from
  // the defaults.
  _sectionSchema(fields) {
    const own      = f => !f.section && f.schema.type !== "expandable";
    const sections = Object.keys(SECTION_TITLES).map(name => {
      const list = fields.filter(f => f.section === name);
      if (!list.length) return null;
      const set   = list.filter(f => this._config[f.name] !== undefined && this._config[f.name] !== null).length;
      const title = this._t(SECTION_TITLES[name]);
      return { type: "expandable", name: `section_${name}`, flatten: true,
               title: set ? `${title} (${this._t("editorVehicleMapSet", { val: set })})` : title,
               schema: list.map(f => f.schema) };
    }).filter(Boolean);
    return [
      ...fields.filter(own).map(f => f.schema),
      ...sections,
      ...fields.filter(f => !f.section && !own(f)).map(f => f.schema),
    ];
  }

  // A change from the form: every field whose value moved away from what the
  // form was shown is written back, the others stay as they are in the config,
  // a shorthand or a legacy value included. One change, one event.
  _applyForm(fields, data) {
    const next = { ...this._config };
    let changed = false;
    for (const f of fields) {
      const v = data[f.name];
      if (JSON.stringify(v ?? null) === JSON.stringify(f.value ?? null)) continue;
      this._typed = { ...this._typed, [f.name]: v };
      // What the field would write for the value it showed: a title that only
      // gained a trailing space writes nothing new.
      const write = f.write || unsetToUndefined;
      const out   = write(v);
      if (JSON.stringify(out ?? null) === JSON.stringify(write(f.value) ?? null)) continue;
      next[f.name] = out;
      f.after?.(next);
      changed = true;
    }
    if (!changed) { this._render(); return; }
    this._config = next;
    this._discoverLoadpoints();
    this._fire();
    this._render();
  }

  _render() {
    const root = this.shadowRoot;
    if (!this._slots) {
      root.innerHTML = `
        <style>${EDITOR_CSS}${disabledListCss}</style>
        <div class="form">
          <div class="form-warn"></div>
          <div class="form-main"></div>
          <div class="form-extra"></div>
          <div class="form-look"></div>
          <div class="form-disabled"></div>
        </div>`;
      this._slots = { disabled: root.querySelector(".form-disabled"), main: root.querySelector(".form-main"),
                      warn: root.querySelector(".form-warn"),
                      extra: root.querySelector(".form-extra"), look: root.querySelector(".form-look") };
    }

    const c    = this._config;
    const mode = c.mode || "loadpoint";
    const disabledEntries = this._disabledEntries();
    this._disabledKey     = disabledEntries.map(e => e.id).join(",");

    this._slots.warn.innerHTML     = this._deprecatedHtml(mode);
    this._slots.extra.innerHTML    = this._extraHtml(mode);
    this._slots.disabled.innerHTML = this._disabledHtml(disabledEntries);

    const ready = this._haFormReady();
    if (ready) {
      // Language and size follow what the form cannot hold (the vehicle's
      // panels) in a form of their own; the disabled entities come last.
      const all    = this._fields();
      const fields = all.filter(f => f.section !== "look");
      const look   = all.filter(f => f.section === "look");
      this._mainForm = this._mountForm(this._slots.main, this._mainForm, fields, data => this._applyForm(fields, data));
      this._lookForm = this._mountForm(this._slots.look, this._lookForm, look, data => this._applyForm(look, data));
    }

    this._addListeners();
  }

  // Several loadpoints on a loadpoint or plan card go away in one of the next
  // versions; until then the editor says so in red, above everything else.
  _deprecatedHtml(mode) {
    const lps = this._availableLoadpoints;
    if (!SINGLE_LOADPOINT_MODES.includes(mode) || !lps.length) return "";
    if ((loadpointFilter(this._config) || lps).length < 2) return "";
    return `<div class="deprecated" role="alert">${this._esc(this._t("editorLoadpointManyHint"))}</div>`;
  }

  // Everything below the form that HA's form cannot express: what is missing
  // in the installation, and the device, mapping and picture of the card's
  // vehicle.
  _extraHtml(mode) {
    const c     = this._config;
    const parts = [];
    const lps   = this._availableLoadpoints;
    if (["loadpoint", "compact", "plan", "priority"].includes(mode) && !lps.length) {
      parts.push(`<div class="hint">${this._t("editorNoLoadpointsFound")}</div>`);
    }
    if (mode === "repeatplan" && !this._availableVehicleSlugs.length) {
      parts.push(`<div class="hint">${this._t("editorNoVehiclesFound")}</div>`);
    }
    if (mode === "vehicle") {
      const vehicles = this._hass ? discoverVehicles(this._hass, this._getPrefix()) : {};
      const own      = selectVehicle(vehicles, c);
      if (!Object.keys(vehicles).length) {
        parts.push(`<div class="hint">${this._t("editorVehiclesNoneFound")}</div>`);
      } else if (own) {
        const isSet  = key => c[key] !== undefined && c[key] !== null;
        const images = ["vehicle_image", "vehicle_image_connected", "vehicle_image_charging"];
        parts.push(this._panel("vehicle_device", this._t("editorVehicleDeviceTitle"),
          ["vehicle_device", "vehicle_entities"].filter(isSet).length, `
          <div class="field">
            <div class="hint">${this._t("editorVehicleDeviceHint")}</div>
            ${this._vehicleDeviceField(own[0], own[1])}
          </div>`));
        parts.push(this._panel("vehicle_images", this._t("editorVehicleImagesTitle"), images.filter(isSet).length, `
          <div class="field">
            <div class="field-label">${this._t("editorVehicleImageTitle")}</div>
            <div class="hint">${this._t("editorVehicleImageHint")}</div>
            ${this._vehicleImageField("vehicle_image")}
          </div>
          <div class="field">
            <div class="field-label">${this._t("editorVehicleImageConnectedTitle")}</div>
            <div class="hint">${this._t("editorVehicleImageConnectedHint")}</div>
            ${this._vehicleImageField("vehicle_image_connected")}
          </div>
          <div class="field">
            <div class="field-label">${this._t("editorVehicleImageChargingTitle")}</div>
            <div class="hint">${this._t("editorVehicleImageChargingHint")}</div>
            ${this._vehicleImageField("vehicle_image_charging")}
          </div>`));
      }
    }
    return parts.join("");
  }

  // What this card misses, last and folded like the rest: the entities its
  // warning triangles point at, with their enable buttons. The panel carries
  // the card's triangle and counts them. Nothing missing, nothing shown.
  _disabledHtml(disabledEntries) {
    if (!disabledEntries.length) return "";
    const body = disabledEntitiesHtml({ entries: disabledEntries, enabling: this._enabling, admin: !!this._hass?.user?.is_admin,
                                       t: (k, r) => this._t(k, r) });
    return this._panel("disabled", `${this._t("disabledWarnTitle")} (${disabledEntries.length})`, 0, body, WARN_ICON);
  }

  // A folded panel below the form, looking like the sections inside it: HA's
  // expansion panel where the frontend has it, a native one otherwise. The
  // title counts what is set inside, like the form's sections. Whether it is
  // open is the editor's own state, so it survives the next render.
  _panel(key, title, set, body, icon = "") {
    const open = !!this._panelsOpen?.[key];
    const head = set ? `${title} (${this._t("editorVehicleMapSet", { val: set })})` : title;
    return customElements.get("ha-expansion-panel")
      ? `<ha-expansion-panel outlined data-panel="${key}" header="${this._esc(head)}"${open ? " expanded" : ""}>${icon ? `<span class="panel-icon" slot="leading-icon">${icon}</span>` : ""}<div class="panel-body">${body}</div></ha-expansion-panel>`
      : `<details class="panel" data-panel="${key}"${open ? " open" : ""}><summary>${icon ? `<span class="panel-icon">${icon}</span>` : ""}${this._esc(head)}</summary><div class="panel-body">${body}</div></details>`;
  }

  _addListeners() {
    this.shadowRoot.querySelectorAll("[data-panel]").forEach(el => {
      const keep = open => { this._panelsOpen = { ...this._panelsOpen, [el.dataset.panel]: open }; };
      el.addEventListener("expanded-changed", e => { if (e.target === el) keep(!!e.detail?.expanded); });
      el.addEventListener("toggle", () => keep(el.open));
    });

    const enable = ids => enableEntities(id => enableEntity(this._hass, id),
      this._disabledEntries().filter(e => ids.includes(e.id)), this._enabling, () => this._render());
    this.shadowRoot.querySelectorAll("button.disabled-enable").forEach(btn => {
      btn.addEventListener("click", () => { btn.disabled = true; enable([btn.dataset.enableEntity]); });
    });
    this.shadowRoot.querySelectorAll("button.disabled-enable-all").forEach(btn => {
      btn.addEventListener("click", () => { btn.disabled = true; enable(btn.dataset.enableEntities.split(",")); });
    });

    this._mountVehicleMediaPickers();
    this._mountVehicleRolePickers();
    this._mountVehicleFunctionPickers();

    // Written on change, not on every key: half a path is not a valid config.
    // An emptied field is the exception, it removes the picture right away. The
    // field is not rendered anew here, so focus and a click on the remove button
    // survive; only the button follows the value.
    this.shadowRoot.querySelectorAll("input[data-vehicle-image]").forEach(inp => {
      const key   = inp.dataset.vehicleImage;
      const clear = this.shadowRoot.querySelector(`[data-vehicle-image-clear="${key}"]`);
      const set = (value) => {
        this._setVehicleImage(key, value);
        if (clear) clear.hidden = !value;
        const picker = this.shadowRoot.querySelector(`[data-vehicle-media="${key}"] ha-selector`);
        if (picker && !isMediaSourceId(value)) picker.value = undefined;
      };
      inp.addEventListener("change", () => {
        const val = inp.value.trim();
        if (val && !isVehicleImage(val)) inp.value = "";
        set(val && isVehicleImage(val) ? val : null);
      });
      inp.addEventListener("input", () => {
        if (!inp.value.trim() && this._config[key]) set(null);
      });
    });
    this.shadowRoot.querySelectorAll("[data-vehicle-image-clear]").forEach(btn => {
      btn.addEventListener("click", () => { this._setVehicleImage(btn.dataset.vehicleImageClear, null); this._render(); });
    });

    // Unfolding the mapping is the editor's own state: it survives the re-render
    // the way the disabled list does, without touching the config.
    this.shadowRoot.querySelectorAll("[data-vehicle-map]").forEach(btn => {
      btn.addEventListener("click", () => {
        this._vehicleMapOpen = !this._vehicleMapOpen;
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll("[data-vehicle-role-none]").forEach(btn => {
      btn.addEventListener("click", () => {
        const off = btn.getAttribute("aria-pressed") === "true";
        this._setVehicleRole(btn.dataset.role, off ? "" : "none");
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll("select[data-vehicle-role]").forEach(sel => {
      sel.addEventListener("change", () => {
        this._setVehicleRole(sel.dataset.role, sel.value);
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll("[data-vehicle-func-add]").forEach(sel => {
      sel.addEventListener("change", () => {
        if (!sel.value) return;
        const current = classifyVehicleDevice(this._hass, this._vehicleDeviceFor(), vehicleOverride(this._config)).actions;
        this._setVehicleFunctions([...current, sel.value]);
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll("[data-vehicle-func-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const current = classifyVehicleDevice(this._hass, this._vehicleDeviceFor(), vehicleOverride(this._config)).actions;
        this._setVehicleFunctions(current.filter(id => id !== btn.dataset.entity));
        this._render();
      });
    });

    this.shadowRoot.querySelectorAll("[data-vehicle-device]").forEach(sel => {
      sel.addEventListener("change", () => {
        this._config = { ...this._config, vehicle_device: sel.value || undefined };
        this._fire();
        this._render();
      });
    });
  }
}
