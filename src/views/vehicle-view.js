import { discoverVehicles, selectVehicles } from "../core/entity-discovery.js";
import { classifyVehicleDevice, resolveVehicleDevice, evccVehicleTitle, vehicleDeviceState } from "../core/vehicle-device.js";
import { VEHICLE_FEATURES, isVehicleImageUrl, isMediaSourceId } from "../core/constants.js";
import { stateVal, unitStr, isOn } from "../utils/state.js";
import { socFillGradient, socTrackBg } from "../utils/format.js";
import { escHtml, escAttr } from "../utils/html.js";

const ICON_BATTERY  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg>`;
const ICON_RANGE    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg>`;
const ICON_ODOMETER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M12,16A3,3 0 0,1 9,13C9,11.88 9.61,10.9 10.5,10.39L20.21,4.77L14.68,14.35C14.18,15.33 13.17,16 12,16M12,3C13.81,3 15.5,3.5 16.97,4.32L14.87,5.53C14,5.19 13,5 12,5A8,8 0 0,0 4,13C4,15.21 4.89,17.21 6.34,18.65H6.35C6.74,19.04 6.74,19.67 6.35,20.06C5.96,20.45 5.32,20.45 4.93,20.07V20.07C3.12,18.26 2,15.76 2,13A10,10 0 0,1 12,3M22,13C22,15.76 20.88,18.26 19.07,20.07V20.07C18.68,20.45 18.05,20.45 17.66,20.06C17.27,19.67 17.27,19.04 17.66,18.65V18.65C19.11,17.2 20,15.21 20,13C20,12 19.81,11 19.46,10.1L20.67,8C21.5,9.5 22,11.18 22,13Z"/></svg>`;

const ICON_LOCK     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>`;
const ICON_UNLOCK   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10A2,2 0 0,1 6,8H15V6A3,3 0 0,0 12,3A3,3 0 0,0 9,6H7A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,17A2,2 0 0,0 14,15A2,2 0 0,0 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17Z"/></svg>`;
const ICON_DOOR     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19,14H16V16H19V14M22,21H3V11L11,3H21A1,1 0 0,1 22,4V21M11.83,5L5.83,11H20V5H11.83Z"/></svg>`;
const ICON_PIN      = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"/></svg>`;
const ICON_WARN     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/></svg>`;
const ICON_CHECK    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>`;

const NO_VALUE = new Set(["unknown", "unavailable", ""]);
// How many open doors or warnings get a chip of their own before the rest is summed up.
const MAX_CHIPS = 4;

// Vehicle mode: one block per vehicle evcc knows, plugged in or not. Methods are mixed into EvccCard.prototype.
export const vehicleView = {
  _renderVehicleMode(loadpoints) {
    const all      = discoverVehicles(this._hass, this._getPrefix());
    const vehicles = selectVehicles(all, this._config);
    const slugs    = Object.keys(vehicles).sort();
    if (slugs.length === 0) return this._renderNoVehicles(all);

    const links = this._vehicleLinks();
    return slugs.map(slug => this._renderVehicle(slug, vehicles[slug],
      this._vehicleLoadpoint(slug, loadpoints), slugs.length === 1, links[slug] ?? null)).join("");
  },

  // Which Home Assistant device belongs to which vehicle, and the entities on
  // it. The search walks both registries, and the render key asks for the
  // entity list on every hass update, so the answer is kept until one of the
  // registries, the config or the set of evcc entities changes.
  _vehicleLinks() {
    const hass = this._hass;
    if (!hass) return {};
    const c = this._vehicleLinkCache;
    const stateCount = Object.keys(hass.states).length;
    if (c && c.entities === hass.entities && c.devices === hass.devices && c.config === this._config
        && c.prefix === this._getPrefix() && c.stateCount === stateCount) return c.links;

    const links = {};
    const vehicles = selectVehicles(discoverVehicles(hass, this._getPrefix()), this._config);
    for (const [slug, vehicle] of Object.entries(vehicles)) {
      const deviceId = resolveVehicleDevice(hass, this._config, slug, evccVehicleTitle(hass, slug, vehicle));
      if (!deviceId) continue;
      const entityIds = Object.values(hass.entities || {}).filter(e => e.device_id === deviceId).map(e => e.entity_id);
      links[slug] = { deviceId, entityIds };
    }
    this._vehicleLinkCache = { entities: hass.entities, devices: hass.devices, config: this._config,
                               prefix: this._getPrefix(), stateCount, links };
    return links;
  },

  // Entities outside the evcc prefix whose changes have to reach the card.
  _vehicleLinkedIds() {
    return Object.values(this._vehicleLinks()).flatMap(l => l.entityIds);
  },

  // The loadpoint a vehicle is assigned to right now. ha-evcc describes the
  // vehicle of a loadpoint in the `vehicle` attribute of its vehicle select, and
  // the `id` in there is the slug the vehicle's own entity ids are built from.
  _vehicleLoadpoint(slug, loadpoints) {
    for (const [lpName, ents] of Object.entries(loadpoints)) {
      if (!ents.vehicle_name) continue;
      const vehicle = this._hass.states[ents.vehicle_name]?.attributes?.vehicle;
      if (vehicle?.id !== slug) continue;
      return {
        lpName, ents,
        title:     vehicle.name && vehicle.name !== "null" ? vehicle.name : null,
        connected: ents.connected ? isOn(this._hass, ents.connected) : false,
        charging:  ents.charging  ? isOn(this._hass, ents.charging)  : false,
      };
    }
    return null;
  },

  // A value can exist three times. While the vehicle is connected it is read
  // from the loadpoint: evcc polls a charging vehicle far more often than a
  // parked one, and the loadpoint falls back to the charger's own reading.
  // Unplugged, the vehicle's evcc sensor and the one of its own integration are
  // left, and the one that changed last wins. `unknown` and `unavailable` are
  // the normal state of a sleeping vehicle, not an error, and read as "no
  // value"; so does anything not above `min`, because evcc reports a charge
  // level of 0 for a vehicle it cannot reach instead of saying it does not know.
  _vehicleValue({ vehicle, device, lp, lpKey, min = -Infinity }) {
    const read = entityId => {
      const st = entityId && this._hass.states[entityId];
      if (!st) return null;
      const v = parseFloat(st.state);
      return isNaN(v) || !(v > min) ? null : { value: v, entityId, updated: Date.parse(st.last_updated) || 0 };
    };
    const fromLp = lp?.connected ? read(lp.ents[lpKey]) : null;
    if (fromLp) return fromLp;
    return [read(vehicle), read(device)].filter(Boolean).sort((a, b) => b.updated - a.updated)[0] ?? null;
  },

  // "2 hours ago" in the card's language, for the tooltip of a value. The state
  // of a parked car does not change, so an old value is no stale value and gets
  // no warning colour; the age is there for whoever wonders.
  _vehicleAge(updated) {
    if (!updated) return "";
    const min = Math.max(0, Math.round((Date.now() - updated) / 60000));
    const lang = this._config.language || this._hass?.language || "en";
    let text;
    try {
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
      text = min < 60 ? rtf.format(-min, "minute") : min < 2880 ? rtf.format(-Math.round(min / 60), "hour") : rtf.format(-Math.round(min / 1440), "day");
    } catch (e) { return ""; }
    return this._t("vehicleUpdated", { val: text });
  },

  _renderVehicle(slug, vehicle, lp, single, link) {
    const title = (single && this._config.title) || lp?.title
      || evccVehicleTitle(this._hass, slug, vehicle) || this._vehicleNameForSlug(slug);
    const dev   = link ? classifyVehicleDevice(this._hass, link.deviceId) : null;
    const roles = dev?.roles ?? {};

    const soc      = this._vehicleValue({ vehicle: vehicle.soc,       device: roles.soc,        lp, lpKey: "vehicle_soc", min: 0 });
    const range    = this._vehicleValue({ vehicle: vehicle.range,     device: roles.range,      lp, lpKey: "vehicle_range" });
    const odometer = this._vehicleValue({ vehicle: vehicle.odometer,  device: roles.odometer,   lp, lpKey: "vehicle_odometer" });
    // evcc reports a limit of 0 for a vehicle that has none.
    const limit    = this._vehicleValue({ vehicle: vehicle.limit_soc, device: roles.target_soc, lp, lpKey: "effective_limit_soc", min: 0 });
    const limitSoc = limit ? limit.value : null;

    // What the vehicle is doing. evcc knows about its own loadpoints and leads
    // there; everything else (driving, charging somewhere else) only the
    // vehicle's integration can tell. Without one, a vehicle that is not at a
    // loadpoint is simply "not connected": the card does not claim it is parked.
    const state = lp?.charging ? "charging" : lp?.connected ? "connected"
                : dev ? vehicleDeviceState(this._hass, roles) : "parked";
    const statusClass = state === "charging" ? "charging" : state === "connected" ? "connected" : "ready";
    const statusLabel = state === "charging" ? this._t("charging")
                      : state === "connected" ? this._t("connected")
                      : state === "driving"   ? this._t("vehicleDriving")
                      : dev ? this._t("vehicleParked") : this._t("vehicleNotConnected");
    const lpTitle = lp?.connected ? this._loadpointTitle(lp.lpName, lp.ents) : null;

    const value = (v, icon, text) => v
      ? `<span data-more-info="${escAttr(v.entityId)}" title="${escAttr(this._vehicleAge(v.updated))}">${icon} ${text}</span>` : "";
    const km = v => `${Math.round(v.value)} ${escHtml(unitStr(this._hass, v.entityId) || "km")}`;

    const socHtml = soc ? `
      <div class="soc-track" style="background:${socTrackBg(0, limitSoc ?? 100)}">
        <div class="soc-fill ${state === "charging" ? "charging" : ""}"
             style="width:${Math.min(soc.value, 100)}%;background:${socFillGradient(soc.value, 0, limitSoc ?? 100)}"></div>
        ${limitSoc !== null ? `<div class="soc-limit-marker" style="left:${Math.min(limitSoc, 100)}%"></div>` : ""}
      </div>` : "";

    const hasVehicleData = VEHICLE_FEATURES.some(f => vehicle[f.key]) || !!dev;

    return `
      <div class="loadpoint vehicle-block" data-vehicle="${escAttr(slug)}">
        <div class="lp-header">
          <span class="lp-name">${escHtml(title)}</span>
          ${lpTitle ? `<span class="vehicle-lp" title="${this._t("vehicleAtLoadpoint")}">${escHtml(lpTitle)}</span>` : ""}
          <span class="lp-badge ${statusClass}">${statusLabel}</span>
        </div>
        ${this._config.vehicle_graphic === "hide" ? "" : this._renderVehicleGraphic(state, soc ? soc.value : null, `${title}: ${statusLabel}`, this._vehicleImage(slug, roles))}
        ${(soc || range || odometer) ? `
        <div class="soc-section">
          <div class="soc-label-row">
            ${value(soc, ICON_BATTERY, soc ? `${Math.round(soc.value)} %` : "")}
            ${value(range, ICON_RANGE, range ? km(range) : "")}
            ${value(odometer, ICON_ODOMETER, odometer ? km(odometer) : "")}
          </div>
          ${socHtml}
        </div>` : ""}
        ${!hasVehicleData ? `<div class="vehicle-hint">${this._t("vehicleExtDataHint")}</div>`
          : !(soc || range || odometer) ? `<div class="vehicle-hint">${this._t("vehicleNoData")}</div>` : ""}
        ${dev ? this._renderVehicleChips(dev) : ""}
        ${this._renderVehiclePlan(lp)}
        ${this._renderVehicleRepeatPlans(vehicle)}
        ${this._renderVehicleTotals(vehicle)}
        ${dev ? this._renderVehicleDetails(slug, dev) : ""}
      </div>`;
  },

  // The picture of the real car: the configured one, else what the vehicle's
  // integration offers as an image entity. Returns { source, url } or null;
  // `source` is what was configured and `url` what the browser can load. One
  // that failed to load is not tried again, the drawing takes over.
  _vehicleImage(slug, roles) {
    const configured = this._config.vehicle_images?.[slug];
    const fromEntity = roles.image ? this._hass.states[roles.image]?.attributes?.entity_picture : null;
    const source = [configured, fromEntity].find(v => isMediaSourceId(v) || isVehicleImageUrl(v))?.trim() ?? null;
    if (!source || this._vehicleImageFailed[source]) return null;
    const url = isMediaSourceId(source) ? this._vehicleMediaUrl(source) : source;
    return url ? { source, url } : null;
  },

  // An item of the media library has no address of its own: Home Assistant
  // hands out a signed one on request, valid for a day. It is asked for once
  // and again after half that time, never on a plain re-render; until the
  // answer is there the drawing stands in.
  _vehicleMediaUrl(source) {
    const HALF_LIFE = 12 * 3600 * 1000;
    const hit = this._vehicleMedia[source];
    if (hit?.url && Date.now() - hit.ts < HALF_LIFE) return hit.url;
    if (!hit?.pending) {
      this._vehicleMedia[source] = { ...hit, pending: true };
      this._hass.callWS({ type: "media_source/resolve_media", media_content_id: source })
        .then(res => {
          if (!res?.url) throw new Error("no url");
          this._vehicleMedia[source] = { url: res.url, ts: Date.now() };
        })
        .catch(() => {
          delete this._vehicleMedia[source];
          this._vehicleImageFailed[source] = true;
        })
        .finally(() => { if (this._hass && this.isConnected) this._render(); });
    }
    return hit?.url ?? null;   // an address about to expire still beats the drawing
  },

  // The name Home Assistant shows for an entity inside its device ("Tür vorne
  // links", without the device name in front).
  _vehicleEntityName(entityId) {
    return this._hass.entities?.[entityId]?.name
      || entityId.slice(entityId.indexOf(".") + 1).replace(/_/g, " ");
  },

  // A state the way Home Assistant words it (translated enum options, zone
  // names, units); the raw state on a frontend too old to offer that.
  _vehicleStateText(entityId) {
    const st = this._hass.states[entityId];
    if (!st || NO_VALUE.has(st.state)) return null;
    if (typeof this._hass.formatEntityState === "function") return this._hass.formatEntityState(st);
    const n    = Number(st.state);
    const unit = unitStr(this._hass, entityId);
    const text = st.state.trim() !== "" && !isNaN(n) ? String(Math.round(n * 10) / 10) : st.state;
    return unit ? `${text} ${unit}` : text;
  },

  // Lock, location, doors and warnings at a glance. Thirty warning flags are
  // one chip while all is well, and a chip each for the ones that are raised;
  // a flag the car does not report (`unknown`) is no warning.
  _renderVehicleChips(dev) {
    const chip = (cls, icon, text, entityId = null, hint = "") =>
      `<span class="vehicle-chip ${cls}"${entityId ? ` data-more-info="${escAttr(entityId)}"` : ""}${hint ? ` title="${escAttr(hint)}"` : ""}>${icon} ${escHtml(text)}</span>`;
    const chips = [];

    const lock = dev.roles.lock && this._hass.states[dev.roles.lock];
    if (lock && !NO_VALUE.has(lock.state)) {
      const locked = lock.state === "locked";
      chips.push(chip(locked ? "ok" : "warn", locked ? ICON_LOCK : ICON_UNLOCK,
        locked ? this._t("vehicleLocked") : this._t("vehicleUnlocked"), dev.roles.lock));
    }

    const group = (ids, okText, icon, cls) => {
      const raised = ids.filter(id => isOn(this._hass, id));
      if (!ids.length) return;
      if (!raised.length) { chips.push(chip("ok", ICON_CHECK, okText)); return; }
      raised.slice(0, MAX_CHIPS).forEach(id => chips.push(chip(cls, icon, this._vehicleEntityName(id), id)));
      if (raised.length > MAX_CHIPS) {
        chips.push(chip(cls, icon, `+${raised.length - MAX_CHIPS}`, null, raised.slice(MAX_CHIPS).map(id => this._vehicleEntityName(id)).join(", ")));
      }
    };
    group(dev.openings, this._t("vehicleAllClosed"),  ICON_DOOR, "warn");
    group(dev.problems, this._t("vehicleNoWarnings"), ICON_WARN, "alert");

    const loc = dev.roles.location && this._hass.states[dev.roles.location];
    if (loc && !NO_VALUE.has(loc.state)) {
      const text = typeof this._hass.formatEntityState === "function" ? this._hass.formatEntityState(loc)
        : loc.state === "home" ? this._t("vehicleAtHome") : loc.state === "not_home" ? this._t("vehicleAway") : loc.state;
      chips.push(chip("", ICON_PIN, text, dev.roles.location));
    }
    return chips.length ? `<div class="vehicle-chips">${chips.join("")}</div>` : "";
  },

  // Everything else the device reports, folded away by default.
  _renderVehicleDetails(slug, dev) {
    const ids  = [dev.roles.capacity, dev.roles.target_soc, ...dev.details].filter(Boolean);
    const rows = ids.map(id => {
      const text = this._vehicleStateText(id);
      return text === null ? "" : `
        <div class="vehicle-detail" data-more-info="${escAttr(id)}">
          <span class="vehicle-detail-label">${escHtml(this._vehicleEntityName(id))}</span>
          <span class="vehicle-detail-value">${escHtml(text)}</span>
        </div>`;
    }).filter(Boolean);
    if (!rows.length) return "";
    const open = !!this._vehicleDetailsOpen?.[slug];
    return `
      <div class="vehicle-details">
        <button class="vehicle-details-toggle" data-vehicle-details="${escAttr(slug)}" aria-expanded="${open}">
          <span class="session-title">${this._t("vehicleDetails")}</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="${open
            ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
            : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"}"/></svg>
        </button>
        <div class="vehicle-detail-list"${open ? "" : " hidden"}>${rows.join("")}</div>
      </div>`;
  },

  // The plan evcc is working on, read only. It hangs on the loadpoint, so there
  // is nothing to show for a vehicle that is parked somewhere else.
  _renderVehiclePlan(lp) {
    if (!lp?.connected || this._isHeatingLoadpoint(lp.ents)) return "";
    const ents = lp.ents;
    const time = ents.effective_plan_time ? stateVal(this._hass, ents.effective_plan_time) : null;
    const when = time ? new Date(time) : null;
    if (!when || isNaN(when.getTime())) return "";

    const active = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const soc    = ents.effective_plan_soc ? parseFloat(stateVal(this._hass, ents.effective_plan_soc)) : NaN;
    const whenStr = when.toLocaleString(this._config.language || this._hass?.language || "en", {
      weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    return `
      <div class="plan-block vehicle-plan">
        <div class="plan-header">
          <span class="session-title">${this._t("chargePlan")}</span>
          <span class="plan-badge ${active ? "active" : "planned"}">${active ? this._t("chargingByPlan") : this._t("planned")}</span>
        </div>
        <div class="session-grid">
          <div class="session-item"><span class="si-label">${this._t("finishBy")}</span><span class="si-value">${escHtml(whenStr)}</span></div>
          ${soc > 0 ? `<div class="session-item"><span class="si-label">${this._t("targetSoc")}</span><span class="si-value">${Math.round(soc)} %</span></div>` : ""}
        </div>
      </div>`;
  },

  _renderVehicleRepeatPlans(vehicle) {
    const re    = /_repeating_plan_(\d+)$/;
    const plans = vehicle.repeating_plans
      .map(entityId => this._readRepeatingPlan(entityId, parseInt(entityId.match(re)[1], 10)))
      .filter(Boolean);
    return plans.length ? this._renderRepeatPlansBlock({ plans }) : "";
  },

  // Everything the vehicle ever charged, from the session totals of ha-evcc.
  _renderVehicleTotals(vehicle) {
    const num = entityId => {
      if (!entityId) return null;
      const v = parseFloat(stateVal(this._hass, entityId));
      return isNaN(v) ? null : v;
    };
    const energy   = num(vehicle.sessions_energy);
    const cost     = num(vehicle.sessions_cost);
    const duration = num(vehicle.sessions_duration);
    if (energy === null && cost === null && duration === null) return "";

    const item = (entityId, label, text) => `
      <div class="session-item" data-more-info="${escAttr(entityId)}">
        <span class="si-label">${label}</span><span class="si-value">${text}</span>
      </div>`;
    const costUnit = unitStr(this._hass, vehicle.sessions_cost) || "€";
    return `
      <div class="session-block vehicle-totals">
        <div class="session-title">${this._t("vehicleTotals")}</div>
        <div class="session-grid">
          ${energy   !== null ? item(vehicle.sessions_energy,   this._t("energy"), `${Math.round(energy)} kWh`) : ""}
          ${cost     !== null ? item(vehicle.sessions_cost,     this._t("cost"), `${cost.toFixed(2)} ${escHtml(costUnit)}`) : ""}
          ${duration !== null ? item(vehicle.sessions_duration, this._t("vehicleChargeDuration"), `${Math.round(duration / 3600)} h`) : ""}
        </div>
      </div>`;
  },

  _renderNoVehicles(allVehicles = {}) {
    const available = Object.keys(allVehicles);
    const hint = available.length > 0
      ? `<p>${this._t("availableVehicles", { list: `<code>${available.map(escHtml).join(", ")}</code>` })}</p>`
      : "";
    return `
      <div class="empty">
        <p>${this._t("noVehicles")}</p>
        ${hint}
      </div>`;
  },
};
