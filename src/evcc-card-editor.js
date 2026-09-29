import { HIDEABLE_SETTINGS, SLIDER_STEP_KEYS, vehicleSlug, isVehicleImage, isMediaSourceId } from "./core/constants.js";
import { detectIntegration, discoverEntities, discoverVehicles, selectVehicle, disabledCardEntities } from "./core/entity-discovery.js";
import { enableEntity } from "./core/actions.js";
import { disabledEntitiesHtml, disabledListCss, enableEntities } from "./components/disabled-entities.js";
import { loadSharedTranslations, sharedTranslations, sharedTranslationsReady } from "./utils/translations.js";
import { escHtml } from "./utils/html.js";
import { listVehicleDevices, findVehicleDevice, evccVehicleTitle, resolveVehicleDevice, classifyVehicleDevice,
         vehicleOverride, vehicleRoleCandidates, vehicleActionCandidates, VEHICLE_ROLES } from "./core/vehicle-device.js";

// mdi:eye-off
const EYE_OFF_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.83,9L15,12.16C15,12.11 15,12.05 15,12A3,3 0 0,0 12,9C11.94,9 11.89,9 11.83,9M7.53,9.8L9.08,11.35C9.03,11.56 9,11.77 9,12A3,3 0 0,0 12,15C12.22,15 12.44,14.97 12.65,14.92L14.2,16.47C13.53,16.8 12.79,17 12,17A5,5 0 0,1 7,12C7,11.21 7.2,10.47 7.53,9.8M2,4.27L4.28,6.55L4.73,7C3.08,8.3 1.78,10 1,12C2.73,16.39 7,19.5 12,19.5C13.55,19.5 15.03,19.2 16.38,18.66L18.74,21L20,19.73L3.27,3M12,7A5,5 0 0,1 17,12C17,12.64 16.87,13.26 16.64,13.82L19.57,16.75C21.07,15.5 22.27,13.86 23,12C21.27,7.61 17,4.5 12,4.5C10.6,4.5 9.26,4.75 8,5.2L10.17,7.35C10.74,7.13 11.35,7 12,7Z"/></svg>`;

// mdi:close
const CLEAR_ICON = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>`;

// The value of the "not set" option in a select of the form. HA's select cannot
// hold an empty value, so the default option carries this one and the editor
// turns it back into a missing key.
const UNSET = "__unset";

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
    this._disabledOptionalOpen = false;
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
  // only while it has no device of its own (see disabledCardEntities).
  _disabledEntries() {
    if (!this._hass) return [];
    const vehicle = this._config.mode === "vehicle" && !this._vehicleDeviceFor()
      ? selectVehicle(discoverVehicles(this._hass, this._getPrefix()), this._config)?.[0] ?? null : null;
    return disabledCardEntities(this._hass, this._disabled, this._getPrefix(), { vehicle });
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
    slots.forEach(slot => {
      const key      = slot.dataset.role;
      const deviceId = this._vehicleDeviceFor();
      const ov       = vehicleOverride(this._config) || {};
      const cur      = typeof ov[key] === "string" ? ov[key] : (ov[key] === false ? "none" : "");
      const cand     = vehicleRoleCandidates(this._hass, key, deviceId);
      const ids      = [...cand.device, ...cand.other].map(e => e.entityId);
      const autoId   = this._vehicleAutoRole(classifyVehicleDevice(this._hass, deviceId, null), key);
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
    slots.forEach(slot => {
      const deviceId = this._vehicleDeviceFor();
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

  // The picture of the card's vehicle: HA's media picker, and a text field
  // underneath for a path or an address (and to show what was picked). A set
  // picture gets a button next to the field that removes it.
  _vehicleImageField() {
    const remove  = this._t("editorVehicleImageRemove");
    const current = this._config.vehicle_image || "";
    return `
      <div class="vehicle-media" data-vehicle-media></div>
      <div class="vehicle-image-row">
        <input id="vehicle-image" class="ha-input" type="text" data-vehicle-image
               value="${this._esc(current)}" placeholder="${this._esc(this._t("editorVehicleImagePlaceholder"))}">
        <button type="button" class="vehicle-image-clear" data-vehicle-image-clear
                title="${this._esc(remove)}" aria-label="${this._esc(remove)}"${current ? "" : " hidden"}>${CLEAR_ICON}</button>
      </div>`;
  }

  _setVehicleImage(value) {
    this._config = { ...this._config, vehicle_image: value || undefined };
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
      const current = this._config.vehicle_image;
      const picker  = document.createElement("ha-selector");
      picker.hass     = this._hass;
      picker.selector = { media: { accept: ["image/*"] } };
      picker.label    = this._t("editorVehicleImagePick");
      picker.value    = isMediaSourceId(current) ? { media_content_id: current, media_content_type: "image/*", metadata: {} } : undefined;
      picker.addEventListener("value-changed", (e) => {
        e.stopPropagation();
        const id = e.detail?.value?.media_content_id;
        this._setVehicleImage(isMediaSourceId(id) ? id : null);
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
    const showNoPlan        = ["loadpoint", "compact"].includes(mode);
    const showChargeCurrent = ["loadpoint", "compact"].includes(mode);
    const showSiteDetails   = ["site", "flow"].includes(mode);
    const showStatsPeriod   = ["stats", "site", "flow", "grid"].includes(mode);
    const lps = this._availableLoadpoints;
    const fields = [];

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
    ], mode, { label: this._t("editorModeLabel"), helper: this._t(MODE_DESC[mode] || "") || undefined }));

    // Instance: the first entry is what the card detects on its own, so picking
    // it drops `prefix` from the config. Loadpoint and vehicle selections belong
    // to the instance they were made for and are cleared along with the switch.
    const instanceOptions = this._instanceOptions();
    if (instanceOptions) {
      fields.push(pick("prefix", instanceOptions.map(([v, l]) => opt(v, l)), this._getPrefix(), {
        label: this._t("editorInstanceLabel"), helper: this._t("editorInstanceHint"),
        write: v => (this._instances.length > 0 && v === this._instances[0].prefix) ? undefined : v,
        after: next => {
          Object.assign(next, { loadpoints: undefined, no_plan: undefined, no_pv: undefined, repeating_plan_vehicles: undefined,
            vehicle: undefined, vehicles: undefined, vehicle_device: undefined, vehicle_image: undefined, vehicle_entities: undefined });
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
    ], c.language || UNSET, { label: this._t("editorLanguageLabel") }));

    fields.push(pick("size", [
      tOpt(UNSET,    "editorSizeAuto"),
      tOpt("small",  "editorSizeSmall"),
      tOpt("medium", "editorSizeMedium"),
      tOpt("large",  "editorSizeLarge"),
    ], c.size || UNSET, { label: this._t("editorSizeLabel") }));

    if (showLoadpoints && lps.length) {
      fields.push(many("loadpoints", ...this._listField("loadpoints", lps),
        { label: this._t("editorShowLoadpointsTitle"), helper: this._t("editorShowLoadpointsHint") }));
    }
    if (showLoadpoints) {
      fields.push(pick("disabled_loadpoints", [
        tOpt(UNSET,  "editorDisabledLoadpointsHide"),
        tOpt("dim",  "editorDisabledLoadpointsDim"),
        tOpt("show", "editorDisabledLoadpointsShow"),
      ], c.disabled_loadpoints || UNSET,
      { label: this._t("editorDisabledLoadpointsLabel"), helper: this._t("editorDisabledLoadpointsHint") }));
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
        after: next => Object.assign(next, { vehicles: undefined, vehicle_device: undefined, vehicle_image: undefined, vehicle_entities: undefined }),
      }));
      if (selectVehicle(vehicles, c)) fields.push(flag("vehicle_actions", { label: this._t("editorVehicleActions") }));
    }

    if (showNoPlan && lps.length) {
      fields.push(many("no_plan", ...this._listField("no_plan", lps), { label: this._t("editorNoPlanForTitle") }));
      fields.push(many("no_pv",   ...this._listField("no_pv",   lps), { label: this._t("editorNoPvForTitle") }));
    }
    if (showChargeCurrent) {
      fields.push(pick("charge_current_settings", [
        tOpt("collapsed", "editorCollapsed"),
        tOpt("expanded",  "editorExpanded"),
      ], c.charge_current_settings || "collapsed", { label: this._t("editorChargeCurrentSettingsLabel") }));
      fields.push(many("hide_settings", ...this._listField("hide_settings", HIDEABLE_SETTINGS.map(([key]) => key),
        { label: key => this._t(HIDEABLE_SETTINGS.find(([k]) => k === key)?.[1] ?? key) }),
        { label: this._t("editorHideSettingsTitle"), helper: this._t("editorHideSettingsHint") }));
    }
    if (showSiteDetails) {
      fields.push(pick("site_details", [
        tOpt("expanded",  "editorExpanded"),
        tOpt("collapsed", "editorCollapsed"),
      ], c.site_details || "expanded", { label: this._t("editorSiteDetailsLabel") }));
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
      fields.push(pick("stats_period", options, c.stats_period || UNSET, { label: this._t("editorStatsPeriodLabel") }));
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

  // A list option as the form shows it: a single name is the shorthand of a
  // list with one entry, and a name the installation does not have stays in the
  // list as an option of its own, so nothing is dropped unseen. Vehicle slugs
  // are compared without case, like the card does.
  _listField(name, known, { nocase = false, label = v => v } = {}) {
    const raw    = this._config[name];
    const listed = raw === undefined || raw === null ? [] : (Array.isArray(raw) ? raw : [raw]).map(String);
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
    const schema = fields.map(f => f.schema);
    const key    = JSON.stringify(schema);
    form.hass = this._hass;
    if (form._evccSchema !== key) { form.schema = schema; form._evccSchema = key; }
    form.computeLabel  = s => texts[s.name]?.label ?? s.title ?? s.name;
    form.computeHelper = s => texts[s.name]?.helper;
    form.data = Object.fromEntries(fields.map(f => [f.name, f.value]));
    return form;
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

  // The switch that hides the warning triangle sits under the list it is about.
  _hintFields() {
    return [{ name: "hide_disabled_hint", schema: { name: "hide_disabled_hint", selector: { boolean: {} } },
              value: this._config.hide_disabled_hint === true, label: this._t("editorHideDisabledHint") }];
  }

  _render() {
    const root = this.shadowRoot;
    if (!this._slots) {
      root.innerHTML = `
        <style>${EDITOR_CSS}${disabledListCss}</style>
        <div class="form">
          <div class="form-main"></div>
          <div class="form-extra"></div>
          <div class="form-hint"></div>
        </div>`;
      this._slots = { main: root.querySelector(".form-main"), extra: root.querySelector(".form-extra"), hint: root.querySelector(".form-hint") };
    }

    const c    = this._config;
    const mode = c.mode || "loadpoint";
    const disabledEntries = this._disabledEntries();
    this._disabledKey     = disabledEntries.map(e => e.id).join(",");
    const showHint        = ["loadpoint", "compact"].includes(mode) && (disabledEntries.length || c.hide_disabled_hint);

    const ready = this._haFormReady();
    if (ready) {
      const fields = this._fields();
      this._mainForm = this._mountForm(this._slots.main, this._mainForm, fields, data => this._applyForm(fields, data));
      if (showHint) {
        const hint = this._hintFields();
        this._hintForm = this._mountForm(this._slots.hint, this._hintForm, hint, data => this._applyForm(hint, data));
      } else {
        this._slots.hint.replaceChildren();
        this._hintForm = null;
      }
    }

    this._slots.extra.innerHTML = this._extraHtml(mode, disabledEntries);
    this._addListeners();
  }

  // Everything below the form that HA's form cannot express: what is missing
  // in the installation, the device, mapping and picture of the card's vehicle,
  // and the list of disabled entities with its enable buttons.
  _extraHtml(mode, disabledEntries) {
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
        parts.push(`
          <div class="field">
            <div class="section-title">${this._t("editorVehicleDeviceTitle")}</div>
            <div class="hint">${this._t("editorVehicleDeviceHint")}</div>
            ${this._vehicleDeviceField(own[0], own[1])}
          </div>
          <div class="field">
            <div class="section-title">${this._t("editorVehicleImageTitle")}</div>
            <div class="hint">${this._t("editorVehicleImageHint")}</div>
            ${this._vehicleImageField()}
          </div>`);
      }
    }
    if (disabledEntries.length) {
      parts.push(`
        <div class="field">
          <div class="section-title">${this._t("disabledTitle")}</div>
          ${disabledEntitiesHtml({ entries: disabledEntries, enabling: this._enabling, admin: !!this._hass?.user?.is_admin,
                                   t: (k, r) => this._t(k, r), optionalOpen: this._disabledOptionalOpen })}
        </div>`);
    }
    return parts.join("");
  }

  _addListeners() {
    const enable = ids => enableEntities(id => enableEntity(this._hass, id),
      this._disabledEntries().filter(e => ids.includes(e.id)), this._enabling, () => this._render());
    this.shadowRoot.querySelectorAll("button.disabled-enable").forEach(btn => {
      btn.addEventListener("click", () => { btn.disabled = true; enable([btn.dataset.enableEntity]); });
    });
    this.shadowRoot.querySelectorAll("button.disabled-enable-all").forEach(btn => {
      btn.addEventListener("click", () => { btn.disabled = true; enable(btn.dataset.enableEntities.split(",")); });
    });
    const optEl = this.shadowRoot.querySelector("details.disabled-optional");
    if (optEl) optEl.addEventListener("toggle", () => { this._disabledOptionalOpen = optEl.open; });

    this._mountVehicleMediaPickers();
    this._mountVehicleRolePickers();
    this._mountVehicleFunctionPickers();

    // Written on change, not on every key: half a path is not a valid config.
    // An emptied field is the exception, it removes the picture right away. The
    // field is not rendered anew here, so focus and a click on the remove button
    // survive; only the button follows the value.
    this.shadowRoot.querySelectorAll("input[data-vehicle-image]").forEach(inp => {
      const clear = this.shadowRoot.querySelector("[data-vehicle-image-clear]");
      const set = (value) => {
        this._setVehicleImage(value);
        if (clear) clear.hidden = !value;
        const picker = this.shadowRoot.querySelector("[data-vehicle-media] ha-selector");
        if (picker && !isMediaSourceId(value)) picker.value = undefined;
      };
      inp.addEventListener("change", () => {
        const val = inp.value.trim();
        if (val && !isVehicleImage(val)) inp.value = "";
        set(val && isVehicleImage(val) ? val : null);
      });
      inp.addEventListener("input", () => {
        if (!inp.value.trim() && this._config.vehicle_image) set(null);
      });
    });
    this.shadowRoot.querySelectorAll("[data-vehicle-image-clear]").forEach(btn => {
      btn.addEventListener("click", () => { this._setVehicleImage(null); this._render(); });
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
