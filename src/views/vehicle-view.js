import { discoverVehicles, selectVehicle } from "../core/entity-discovery.js";
import { classifyVehicleDevice, resolveVehicleDevice, evccVehicleTitle, vehicleDeviceState,
         vehicleOverride, hasVehicleDeviceData } from "../core/vehicle-device.js";
import { VEHICLE_FEATURES, isVehicleImageUrl, isMediaSourceId } from "../core/constants.js";
import { stateVal, unitStr, isOn } from "../utils/state.js";
import { fmtClock, durationSeconds, socFillGradient, socTrackBg } from "../utils/format.js";
import { escHtml, escAttr } from "../utils/html.js";

const ICON_BATTERY  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg>`;
const ICON_RANGE    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg>`;
const ICON_ODOMETER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M12,16A3,3 0 0,1 9,13C9,11.88 9.61,10.9 10.5,10.39L20.21,4.77L14.68,14.35C14.18,15.33 13.17,16 12,16M12,3C13.81,3 15.5,3.5 16.97,4.32L14.87,5.53C14,5.19 13,5 12,5A8,8 0 0,0 4,13C4,15.21 4.89,17.21 6.34,18.65H6.35C6.74,19.04 6.74,19.67 6.35,20.06C5.96,20.45 5.32,20.45 4.93,20.07V20.07C3.12,18.26 2,15.76 2,13A10,10 0 0,1 12,3M22,13C22,15.76 20.88,18.26 19.07,20.07V20.07C18.68,20.45 18.05,20.45 17.66,20.06C17.27,19.67 17.27,19.04 17.66,18.65V18.65C19.11,17.2 20,15.21 20,13C20,12 19.81,11 19.46,10.1L20.67,8C21.5,9.5 22,11.18 22,13Z"/></svg>`;

const ICON_LOCK     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/></svg>`;
const ICON_UNLOCK   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V10A2,2 0 0,1 6,8H15V6A3,3 0 0,0 12,3A3,3 0 0,0 9,6H7A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,17A2,2 0 0,0 14,15A2,2 0 0,0 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17Z"/></svg>`;
const ICON_DOOR     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M19,14H16V16H19V14M22,21H3V11L11,3H21A1,1 0 0,1 22,4V21M11.83,5L5.83,11H20V5H11.83Z"/></svg>`;
const ICON_PIN      = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z"/></svg>`;
const ICON_WARN     = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/></svg>`;
const ICON_CLIMATE  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z"/></svg>`;
const ICON_CHECK    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg>`;

const NO_VALUE = new Set(["unknown", "unavailable", ""]);
const chevron = open => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="${open
  ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
  : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"}"/></svg>`;
// How many open doors or warnings get a chip of their own before the rest is summed up.
const MAX_CHIPS = 4;

// Vehicle mode: one card, one vehicle - plugged in or not. Everything the card
// carries (the device of the vehicle's own integration, the picture, the roles,
// the functions) belongs to that vehicle, so a household with several cars puts
// a card next to the other instead of one card growing with every car.
// Methods are mixed into EvccCard.prototype.
export const vehicleView = {
  _renderVehicleMode(loadpoints) {
    const all    = discoverVehicles(this._hass, this._getPrefix());
    const chosen = selectVehicle(all, this._config);
    if (!chosen) return this._renderNoVehicles(all);
    const [slug, vehicle] = chosen;
    return this._renderVehicle(slug, vehicle, this._vehicleLoadpoint(slug, loadpoints), this._vehicleLink(slug, vehicle));
  },

  // The vehicle whose evcc sensors this card depends on: the vehicle of a
  // vehicle card that is not linked to a device of its own, which would bring
  // charge level, range and odometer. Null for every other card, where the
  // vehicle sensors are optional. Seen from the debug view it is the card the
  // triangle was clicked in.
  _vehicleSensorsOwner() {
    const config = this._debugReturn || this._config;
    if (config.mode !== "vehicle" || !this._hass) return null;
    const chosen = selectVehicle(discoverVehicles(this._hass, this._getPrefix()), config);
    return chosen && !this._vehicleLink(chosen[0], chosen[1]) ? chosen[0] : null;
  },

  // The Home Assistant device of the vehicle and the entities on it. The search
  // walks both registries, so the answer is kept until one of the registries,
  // the config or the set of entities changes.
  _vehicleLink(slug, vehicle) {
    const hass = this._hass;
    if (!hass) return null;
    const c = this._vehicleLinkCache;
    const stateCount = Object.keys(hass.states).length;
    if (c && c.slug === slug && c.entities === hass.entities && c.devices === hass.devices && c.config === this._config
        && c.prefix === this._getPrefix() && c.stateCount === stateCount) return c.link;

    const deviceId = resolveVehicleDevice(hass, this._config, slug, evccVehicleTitle(hass, slug, vehicle));
    const link = deviceId
      ? { deviceId, entityIds: Object.values(hass.entities || {}).filter(e => e.device_id === deviceId).map(e => e.entity_id) }
      : null;
    this._vehicleLinkCache = { slug, entities: hass.entities, devices: hass.devices, config: this._config,
                               prefix: this._getPrefix(), stateCount, link };
    return link;
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

  _renderVehicle(slug, vehicle, lp, link) {
    const title = this._config.title || lp?.title
      || evccVehicleTitle(this._hass, slug, vehicle) || this._vehicleNameForSlug(slug);
    // What the vehicle's own integration contributes: the entities of its device
    // sorted into roles, with `vehicle_entities` having the last word. A vehicle
    // without a device gets everything from the configuration, which is why the
    // classification also runs without one.
    const override = vehicleOverride(this._config);
    const classified = link || override ? classifyVehicleDevice(this._hass, link?.deviceId ?? null, override) : null;
    const dev   = hasVehicleDeviceData(classified) ? classified : null;
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
    // A vehicle is only called parked when something could have said otherwise:
    // its device, or a configured entity for driving, charging or the plug.
    const tellsState = dev && (!!link || ["driving", "charging", "plugged"].some(r => roles[r]));
    const state = lp?.charging ? "charging" : lp?.connected ? "connected"
                : tellsState ? vehicleDeviceState(this._hass, roles) : "away";
    const statusClass = state === "charging" ? "charging" : state === "connected" ? "connected" : "ready";
    const statusLabel = state === "charging"  ? this._t("charging")
                      : state === "connected" ? this._t("connected")
                      : state === "driving"   ? this._t("vehicleDriving")
                      : state === "parked"    ? this._t("vehicleParked") : this._t("vehicleNotConnected");
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
          ${this._renderVehicleDisabledWarn(slug, !!link)}
          ${lpTitle ? `<span class="vehicle-lp" title="${this._t("vehicleAtLoadpoint")}">${escHtml(lpTitle)}</span>` : ""}
          <span class="lp-badge ${statusClass}">${statusLabel}</span>
        </div>
        ${this._renderVehicleImage(roles, title)}
        ${(soc || range || odometer) ? `
        <div class="soc-section">
          <div class="soc-label-row">
            ${value(soc, ICON_BATTERY, soc ? `${Math.round(soc.value)} %` : "")}
            ${value(range, ICON_RANGE, range ? km(range) : "")}
            ${value(odometer, ICON_ODOMETER, odometer ? km(odometer) : "")}
          </div>
          ${socHtml}
        </div>` : ""}
        ${!hasVehicleData ? `<div class="vehicle-hint">${this._t(this._vehicleDataDisabled(slug) ? "vehicleDataDisabledHint" : "vehicleExtDataHint")}</div>`
          : !(soc || range || odometer) ? `<div class="vehicle-hint">${this._t("vehicleNoData")}</div>` : ""}
        ${dev ? this._renderVehicleChips(dev) : ""}
        ${dev ? this._renderVehicleActions(slug, dev) : ""}
        ${this._renderVehiclePlan(lp)}
        ${this._renderVehicleRepeatPlans(vehicle)}
        ${this._renderVehicleTotals(vehicle)}
        ${dev ? this._renderVehicleDetails(slug, dev) : ""}
      </div>`;
  },

  // Whether ha-evcc created the vehicle's sensors, only disabled. That is
  // known from the registry, which only an administrator can read; for anyone
  // else the sensors look missing.
  _vehicleDataDisabled(slug) {
    const prefix = this._getPrefix();
    return VEHICLE_FEATURES.some(f => this._isEntityDisabled(`${f.domain}.${prefix}${slug}_${f.suffix}`));
  },

  // The picture of the real car: the configured one, else what the vehicle's
  // integration offers as an image entity. Returns { source, url } or null;
  // `source` is what was configured and `url` what the browser can load. One
  // that failed to load is not tried again, the block goes on without a picture.
  _vehicleImage(roles) {
    const configured = this._config.vehicle_image;
    const fromEntity = roles.image ? this._hass.states[roles.image]?.attributes?.entity_picture : null;
    const source = [configured, fromEntity].find(v => isMediaSourceId(v) || isVehicleImageUrl(v))?.trim() ?? null;
    if (!source || this._vehicleImageFailed[source]) return null;
    const url = isMediaSourceId(source) ? this._vehicleMediaUrl(source) : source;
    return url ? { source, url } : null;
  },

  // An item of the media library has no address of its own: Home Assistant
  // hands out a signed one on request, valid for a day. It is asked for once
  // and again after half that time, never on a plain re-render; until the
  // answer is there the block shows no picture.
  _vehicleMediaUrl(source) {
    const LIFETIME  = 24 * 3600 * 1000;
    const HALF_LIFE = LIFETIME / 2;
    const RETRY     = 5 * 60 * 1000;
    const hit = this._vehicleMedia[source];
    if (hit?.url && Date.now() - hit.ts < HALF_LIFE) return hit.url;
    if (!hit?.pending && !(hit?.failedAt && Date.now() - hit.failedAt < RETRY)) {
      this._vehicleMedia[source] = { ...hit, pending: true };
      this._hass.callWS({ type: "media_source/resolve_media", media_content_id: source })
        .then(res => {
          if (!res?.url) throw new Error("no url");
          this._vehicleMedia[source] = { url: res.url, ts: Date.now() };
        })
        .catch(() => {
          // A failed renewal keeps the address while it is still valid and
          // asks again a few minutes later; only a picture that never resolved,
          // or whose address ran out, is dropped.
          if (hit?.url && Date.now() - hit.ts < LIFETIME) {
            this._vehicleMedia[source] = { url: hit.url, ts: hit.ts, failedAt: Date.now() };
          } else {
            delete this._vehicleMedia[source];
            this._vehicleImageFailed[source] = true;
          }
        })
        .finally(() => { if (this._hass && this.isConnected) this._render(); });
    }
    return hit?.url ?? null;   // an address about to expire still beats none
  },

  // The picture above the values, only when there is one: the card draws no
  // vehicle of its own. A picture that fails to load is dropped (listener in
  // _attachVehicleListeners), keyed by what was configured.
  _renderVehicleImage(roles, title) {
    const image = this._vehicleImage(roles);
    if (!image) return "";
    return `
      <div class="vehicle-image">
        <img src="${escAttr(image.url)}" alt="${escAttr(title)}" data-vehicle-image="${escAttr(image.source)}" loading="lazy" decoding="async">
      </div>`;
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

    // With vehicle_actions the lock chip is the switch: a tap locks at once,
    // unlocking asks first. While the command runs the chip says so.
    const lock = dev.roles.lock && this._hass.states[dev.roles.lock];
    if (lock && !NO_VALUE.has(lock.state)) {
      const id      = dev.roles.lock;
      // A lock entity says "locked", a switch put into the role says "on".
      const locked  = lock.state === "locked" || lock.state === "on";
      // HA's own transition states, or a command of the card still under way:
      // the one sent is the opposite of what the lock showed.
      const moving  = lock.state === "locking" ? "vehicleLocking" : lock.state === "unlocking" ? "vehicleUnlocking" : null;
      const pending = !!moving || this._commandPending(id);
      const text    = this._t(moving ?? (pending ? (locked ? "vehicleUnlocking" : "vehicleLocking")
                                                 : (locked ? "vehicleLocked" : "vehicleUnlocked")));
      if (this._vehicleActionsAllowed()) {
        chips.push(`<button type="button" class="vehicle-chip vehicle-cmd ${locked ? "ok" : "warn"}${pending ? " pending" : ""}"
          data-vehicle-cmd="${locked ? "unlock" : "lock"}" data-entity="${escAttr(id)}"${locked ? ` data-confirm="1"` : ""}
          ${pending ? "disabled" : ""} title="${escAttr(this._t(locked ? "vehicleUnlock" : "vehicleLock"))}">${locked ? ICON_LOCK : ICON_UNLOCK} ${escHtml(text)}</button>`);
      } else {
        chips.push(chip(locked ? "ok" : "warn", locked ? ICON_LOCK : ICON_UNLOCK, text, id));
      }
    }

    // A climate entity or switch that is on shows as a chip, actions or not.
    const climate = dev.climate?.entity && this._hass.states[dev.climate.entity];
    if (climate && !NO_VALUE.has(climate.state) && climate.state !== "off") {
      chips.push(chip("ok", ICON_CLIMATE, this._t("vehicleClimateOn"), dev.climate.entity));
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

  // vehicle_actions: the card may send commands to the vehicle's own
  // integration. Off unless configured: a card on a wall tablet should not
  // unlock a car by a stray tap of someone who only wanted to look.
  _vehicleActionsAllowed() {
    return this._config.vehicle_actions === true;
  },

  // Preconditioning and the other buttons of the device, with vehicle_actions.
  // Preconditioning runs without asking; every other button asks first, as
  // the card cannot tell a harmless refresh from a horn at midnight.
  _renderVehicleActions(slug, dev) {
    if (!this._vehicleActionsAllowed()) return "";
    const cmd = (entityId, command, label, confirm = false, extra = "") => {
      const pending = this._commandPending(entityId);
      return `<button type="button" class="vehicle-cmd-btn${pending ? " pending" : ""}${extra}" data-vehicle-cmd="${command}"
        data-entity="${escAttr(entityId)}"${confirm ? ` data-confirm="1"` : ""}${pending ? " disabled" : ""}>${escHtml(pending ? this._t("vehiclePending") : label)}</button>`;
    };

    // A configured entity that does not exist in Home Assistant is left out
    // instead of drawn as a button that can only fail: an entity renamed or an
    // integration gone is the normal reason, and a typo shows as a missing
    // button rather than as an error on the first press.
    const exists  = id => !!this._hass.states[id];
    const actions = dev.actions.filter(exists);

    let climateHtml = "";
    const c = dev.climate;
    if (c?.entity && this._hass.states[c.entity] && !NO_VALUE.has(this._hass.states[c.entity].state)) {
      const on = this._hass.states[c.entity].state !== "off";
      climateHtml = cmd(c.entity, on ? "climate-off" : "climate-on", this._t(on ? "vehicleClimateStop" : "vehicleClimateStart"), false, on ? " active" : "");
    } else if (c?.start && c?.stop && exists(c.start) && exists(c.stop)) {
      climateHtml = cmd(c.start, "press", this._t("vehicleClimateStart")) + cmd(c.stop, "press", this._t("vehicleClimateStop"));
    }

    const confirm = this._vehicleConfirm;
    const mine    = confirm && [dev.roles.lock, ...actions].includes(confirm.entityId);
    const confirmHtml = mine ? `
      <div class="vehicle-confirm">
        <span>${escHtml(this._t("vehicleConfirm", { action: confirm.cmd === "unlock" ? this._t("vehicleUnlock") : this._vehicleEntityName(confirm.entityId) }))}</span>
        <button type="button" class="vehicle-cmd-btn" data-vehicle-confirm="yes">${this._t("vehicleConfirmYes")}</button>
        <button type="button" class="vehicle-cmd-btn" data-vehicle-confirm="no">${this._t("vehicleConfirmNo")}</button>
      </div>` : "";

    let actionsHtml = "";
    if (actions.length) {
      const open = !!this._vehicleActionsOpen[slug];
      actionsHtml = `
      <div class="vehicle-details vehicle-actions-list">
        <button class="vehicle-details-toggle" data-vehicle-actions="${escAttr(slug)}" aria-expanded="${open}">
          <span class="session-title">${this._t("vehicleActions")}</span>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="${open
            ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
            : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z"}"/></svg>
        </button>
        <div class="vehicle-cmd-row"${open ? "" : " hidden"}>${actions.map(id => cmd(id, "press", this._vehicleEntityName(id), true)).join("")}</div>
      </div>`;
    }

    if (!climateHtml && !confirmHtml && !actionsHtml) return "";
    return `
      <div class="vehicle-actions">
        ${climateHtml ? `<div class="vehicle-climate"><span class="vehicle-climate-label">${ICON_CLIMATE} ${this._t("vehicleClimate")}</span><span class="vehicle-cmd-row">${climateHtml}</span></div>` : ""}
        ${confirmHtml}
        ${actionsHtml}
      </div>`;
  },

  _runVehicleCommand(entityId, cmd) {
    if (cmd === "lock" || cmd === "unlock") return this._setLock(entityId, cmd === "lock");
    if (cmd === "climate-on" || cmd === "climate-off") return this._setClimate(entityId, cmd === "climate-on");
    if (cmd === "press") return this._pressVehicleButton(entityId);
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
          ${chevron(open)}
        </button>
        <div class="vehicle-detail-list"${open ? "" : " hidden"}>${rows.join("")}</div>
      </div>`;
  },


  // A block of the vehicle folded to one line: the toggle names the block and
  // says in a few words what is in it, the content is only rendered unfolded
  // (a folded plan asks ha-evcc for no preview). The fold state is the card's,
  // so the morph keeps it.
  _renderVehicleFold(key, title, summary, body) {
    const open = !!this._vehicleFoldOpen[key];
    return `
      <div class="vehicle-details vehicle-fold" data-fold="${key}">
        <button class="vehicle-details-toggle" data-vehicle-fold="${key}" aria-expanded="${open}">
          <span class="session-title">${title}</span>
          <span class="vehicle-fold-summary">${summary}</span>
          ${chevron(open)}
        </button>
        ${open ? `<div class="vehicle-fold-body">${body()}</div>` : ""}
      </div>`;
  },

  // The charge plan while the vehicle is plugged in, folded: the line says what
  // is planned, unfolded it is the plan block of the plan mode, set, previewed
  // and deleted the same way. evcc keeps a SoC plan on the vehicle and a kWh
  // plan on the loadpoint, and ha-evcc reports either only through the
  // loadpoint the vehicle is at, so a vehicle parked somewhere else has no plan
  // to show. The vehicle select stays out, this card is about one vehicle.
  _renderVehiclePlan(lp) {
    if (!lp?.connected || !this._hasPlanBlock(lp.ents, true)) return "";
    const ents   = lp.ents;
    const time   = ents.effective_plan_time ? stateVal(this._hass, ents.effective_plan_time) : null;
    const when   = fmtClock(time, this._config.language || this._hass?.language || "en");
    const active = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const energy = this._planKind(ents) === "energy";
    const goalId = energy ? ents.plan_energy : ents.effective_plan_soc;
    const goal   = goalId ? parseFloat(stateVal(this._hass, goalId)) : NaN;
    const badge  = active ? `<span class="plan-badge active">${this._t("chargingByPlan")}</span>`
                 : when   ? `<span class="plan-badge planned">${this._t("planned")}</span>`
                 : `<span class="plan-badge">${this._t("noPlan")}</span>`;
    const summary = when ? `<span>${escHtml(when)}</span>${goal > 0 ? `<span>${Math.round(goal)} ${energy ? "kWh" : "%"}</span>` : ""}${badge}` : badge;
    return this._renderVehicleFold("plan", this._t("chargePlan"), summary,
      () => this._renderPlanBlock(lp.lpName, ents, true, { vehicleSelect: false }));
  },

  // The repeating plans of the vehicle, folded: the line says how many are on.
  _renderVehicleRepeatPlans(vehicle) {
    const re    = /_repeating_plan_(\d+)$/;
    const plans = vehicle.repeating_plans
      .map(entityId => this._readRepeatingPlan(entityId, parseInt(entityId.match(re)[1], 10)))
      .filter(Boolean);
    if (!plans.length) return "";
    const summary = `<span>${this._t("vehicleRplanSummary", { active: plans.filter(p => p.active).length, total: plans.length })}</span>`;
    return this._renderVehicleFold("rplan", `${this._t("repeatingPlans")}${this._repeatPlansHint()}`, summary,
      () => this._renderRepeatPlansBlock({ plans }));
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
    const rawDuration = num(vehicle.sessions_duration);
    const duration = rawDuration === null ? null : durationSeconds(rawDuration, unitStr(this._hass, vehicle.sessions_duration));
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

  _attachVehicleListeners() {
    // error does not bubble, so it is bound on the picture itself; the morph
    // keeps the element, a new address reloads it with the listener in place.
    this._fresh("img[data-vehicle-image]").forEach(img => {
      img.addEventListener("error", () => {
        this._vehicleImageFailed[img.dataset.vehicleImage] = true;
        this._render();
      });
    });
    this._fresh("[data-vehicle-details]").forEach(btn => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.vehicleDetails;
        this._vehicleDetailsOpen[slug] = !this._vehicleDetailsOpen[slug];
        this._render();
      });
    });
    this._fresh("[data-vehicle-fold]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.vehicleFold;
        this._vehicleFoldOpen[key] = !this._vehicleFoldOpen[key];
        this._render();
      });
    });
    this._fresh("[data-vehicle-actions]").forEach(btn => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.vehicleActions;
        this._vehicleActionsOpen[slug] = !this._vehicleActionsOpen[slug];
        this._render();
      });
    });
    // A command that asks first only notes itself; the yes below sends it.
    this._fresh("[data-vehicle-cmd]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { entity, vehicleCmd: cmd } = btn.dataset;
        if (btn.dataset.confirm === "1") {
          this._vehicleConfirm = { entityId: entity, cmd };
          this._render();
          return;
        }
        this._vehicleConfirm = null;
        this._runVehicleCommand(entity, cmd);
      });
    });
    this._fresh("[data-vehicle-confirm]").forEach(btn => {
      btn.addEventListener("click", () => {
        const confirm = this._vehicleConfirm;
        this._vehicleConfirm = null;
        if (btn.dataset.vehicleConfirm === "yes" && confirm) this._runVehicleCommand(confirm.entityId, confirm.cmd);
        else this._render();
      });
    });
  },

  // Nothing to show: either evcc knows no vehicle, or it knows several and the
  // card has not been told which one it is for. Both name what there is.
  _renderNoVehicles(allVehicles = {}) {
    const available = Object.keys(allVehicles);
    const hint = available.length > 0
      ? `<p>${this._t("availableVehicles", { list: `<code>${available.map(escHtml).join(", ")}</code>` })}</p>`
      : "";
    return `
      <div class="empty">
        <p>${this._t(available.length > 0 ? "vehiclePickOne" : "noVehicles")}</p>
        ${hint}
      </div>`;
  },
};

// Part of the card stylesheet, see src/styles.js. The block reuses the
// loadpoint's header, SoC bar and session grid.
export const vehicleCss = `
      .vehicle-lp { font-size: .85em; color: var(--secondary-text-color); margin-right: 8px; white-space: nowrap; }
      .vehicle-hint { font-size: .8rem; line-height: 1.4; color: var(--secondary-text-color); margin-bottom: 12px; }
      .vehicle-block [data-more-info] { cursor: pointer; }
      .vehicle-image { margin: 0 0 12px; display: flex; justify-content: center; }
      .vehicle-image img { display: block; max-width: 100%; max-height: 180px; object-fit: contain; border-radius: 12px; }
      .vehicle-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
      .vehicle-chip {
        display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px;
        font-size: .72rem; font-weight: 600; color: var(--secondary-text-color);
        border: 1px solid var(--divider-color, #4b5563);
      }
      .vehicle-chip svg { flex: 0 0 13px; }
      .vehicle-chip.ok    { color: var(--evcc-green); border-color: color-mix(in srgb, var(--evcc-green) 50%, transparent); background: color-mix(in srgb, var(--evcc-green) 10%, transparent); }
      .vehicle-chip.warn  { color: var(--evcc-amber); border-color: color-mix(in srgb, var(--evcc-amber) 50%, transparent); background: color-mix(in srgb, var(--evcc-amber) 10%, transparent); }
      .vehicle-chip.alert { color: var(--error-color, #db4437); border-color: color-mix(in srgb, var(--error-color, #db4437) 50%, transparent); background: color-mix(in srgb, var(--error-color, #db4437) 10%, transparent); }
      .vehicle-details { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .vehicle-details .session-title { margin-bottom: 0; }
      .vehicle-details-toggle {
        display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0;
        background: none; border: none; color: var(--secondary-text-color); cursor: pointer; font: inherit;
      }
      .vehicle-detail-list { margin-top: 6px; }
      .vehicle-fold .session-title { display: inline-flex; align-items: center; gap: 6px; }
      .vehicle-fold-summary { display: flex; align-items: center; gap: 8px; margin: 0 6px 0 auto; font-size: .8rem; font-weight: 600; color: var(--primary-text-color); }
      .vehicle-fold-body { margin-top: 8px; }
      .vehicle-fold-body > .plan-block { border-top: none; margin-top: 0; padding-top: 0; }
      .vehicle-fold-body > .plan-block > .plan-header { display: none; }
      .vehicle-detail { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: .85rem; border-bottom: 1px solid var(--divider-color, #e5e7eb); }
      .vehicle-detail:last-child { border-bottom: none; }
      .vehicle-detail-label { color: var(--secondary-text-color); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .vehicle-detail-value { font-weight: 600; white-space: nowrap; }
      button.vehicle-chip { font-family: inherit; cursor: pointer; }
      .vehicle-chip.pending, .vehicle-cmd-btn.pending { opacity: .6; cursor: progress; }
      .vehicle-actions { margin: 0 0 12px; }
      .vehicle-climate { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: .85rem; }
      .vehicle-climate-label { display: inline-flex; align-items: center; gap: 6px; color: var(--secondary-text-color); }
      .vehicle-cmd-row { display: flex; flex-wrap: wrap; gap: 6px; }
      .vehicle-cmd-row[hidden] { display: none; }
      .vehicle-actions-list .vehicle-cmd-row { margin-top: 8px; }
      .vehicle-cmd-btn {
        padding: 5px 12px; border-radius: 999px; font: inherit; font-size: .8rem; cursor: pointer;
        background: none; color: var(--primary-text-color); border: 1px solid var(--divider-color, #4b5563);
      }
      .vehicle-cmd-btn.active { border-color: var(--evcc-green); color: var(--evcc-green); }
      .vehicle-confirm { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 8px; padding: 8px 10px;
        border-radius: 8px; font-size: .85rem; background: color-mix(in srgb, var(--evcc-amber) 12%, transparent); }
      .vehicle-confirm span { flex: 1 1 auto; }
`;
