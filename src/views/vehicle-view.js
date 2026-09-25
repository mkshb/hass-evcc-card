import { discoverVehicles, selectVehicles } from "../core/entity-discovery.js";
import { VEHICLE_FEATURES } from "../core/constants.js";
import { stateVal, unitStr, isOn } from "../utils/state.js";
import { fmtClock, socFillGradient, socTrackBg } from "../utils/format.js";
import { escHtml, escAttr } from "../utils/html.js";

const ICON_BATTERY  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg>`;
const ICON_RANGE    = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg>`;
const ICON_ODOMETER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M12,16A3,3 0 0,1 9,13C9,11.88 9.61,10.9 10.5,10.39L20.21,4.77L14.68,14.35C14.18,15.33 13.17,16 12,16M12,3C13.81,3 15.5,3.5 16.97,4.32L14.87,5.53C14,5.19 13,5 12,5A8,8 0 0,0 4,13C4,15.21 4.89,17.21 6.34,18.65H6.35C6.74,19.04 6.74,19.67 6.35,20.06C5.96,20.45 5.32,20.45 4.93,20.07V20.07C3.12,18.26 2,15.76 2,13A10,10 0 0,1 12,3M22,13C22,15.76 20.88,18.26 19.07,20.07V20.07C18.68,20.45 18.05,20.45 17.66,20.06C17.27,19.67 17.27,19.04 17.66,18.65V18.65C19.11,17.2 20,15.21 20,13C20,12 19.81,11 19.46,10.1L20.67,8C21.5,9.5 22,11.18 22,13Z"/></svg>`;

// Vehicle mode: one block per vehicle evcc knows, plugged in or not. Methods are mixed into EvccCard.prototype.
export const vehicleView = {
  _renderVehicleMode(loadpoints) {
    const all      = discoverVehicles(this._hass, this._getPrefix());
    const vehicles = selectVehicles(all, this._config);
    const slugs    = Object.keys(vehicles).sort();
    if (slugs.length === 0) return this._renderNoVehicles(all);
    return slugs.map(slug => this._renderVehicle(slug, vehicles[slug],
      this._vehicleLoadpoint(slug, loadpoints), slugs.length === 1)).join("");
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

  // A value is read from the loadpoint while the vehicle is connected there:
  // evcc polls a charging vehicle far more often than a parked one, and the
  // loadpoint falls back to the charger's own reading. Unplugged, the vehicle's
  // own evcc sensor is left. `unknown` and `unavailable` are the normal state
  // of a sleeping vehicle, not an error, and read as "no value"; so does
  // anything not above `min`, because evcc reports a charge level of 0 for a
  // vehicle it cannot reach instead of saying it does not know.
  _vehicleValue({ vehicle, lp, lpKey, min = -Infinity }) {
    const read = entityId => {
      const st = entityId && this._hass.states[entityId];
      if (!st) return null;
      const v = parseFloat(st.state);
      return isNaN(v) || !(v > min) ? null : { value: v, entityId, updated: Date.parse(st.last_updated) || 0 };
    };
    return (lp?.connected ? read(lp.ents[lpKey]) : null) ?? read(vehicle);
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

  _renderVehicle(slug, vehicle, lp, single) {
    const title = (single && this._config.title) || lp?.title || this._vehicleNameForSlug(slug);

    const soc      = this._vehicleValue({ vehicle: vehicle.soc,       lp, lpKey: "vehicle_soc", min: 0 });
    const range    = this._vehicleValue({ vehicle: vehicle.range,     lp, lpKey: "vehicle_range" });
    const odometer = this._vehicleValue({ vehicle: vehicle.odometer,  lp, lpKey: "vehicle_odometer" });
    // evcc reports a limit of 0 for a vehicle that has none.
    const limit    = this._vehicleValue({ vehicle: vehicle.limit_soc, lp, lpKey: "effective_limit_soc", min: 0 });
    const limitSoc = limit ? limit.value : null;

    // What the vehicle is doing, as far as evcc knows: charging or connected at
    // one of its loadpoints. Anywhere else the card does not claim it is parked.
    const state       = lp?.charging ? "charging" : lp?.connected ? "connected" : "away";
    const statusClass = state === "away" ? "ready" : state;
    const statusLabel = state === "charging" ? this._t("charging")
                      : state === "connected" ? this._t("connected") : this._t("vehicleNotConnected");
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

    const hasVehicleData = VEHICLE_FEATURES.some(f => vehicle[f.key]);

    return `
      <div class="loadpoint vehicle-block" data-vehicle="${escAttr(slug)}">
        <div class="lp-header">
          <span class="lp-name">${escHtml(title)}</span>
          ${lpTitle ? `<span class="vehicle-lp" title="${this._t("vehicleAtLoadpoint")}">${escHtml(lpTitle)}</span>` : ""}
          <span class="lp-badge ${statusClass}">${statusLabel}</span>
        </div>
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
        ${this._renderVehiclePlan(lp)}
        ${this._renderVehicleRepeatPlans(vehicle)}
        ${this._renderVehicleTotals(vehicle)}
      </div>`;
  },

  // The plan evcc is working on, read only. It hangs on the loadpoint, so there
  // is nothing to show for a vehicle that is parked somewhere else. A vehicle
  // evcc plans in kWh (no SoC, or no known capacity) shows its energy goal.
  _renderVehiclePlan(lp) {
    if (!lp?.connected || this._isHeatingLoadpoint(lp.ents)) return "";
    const ents = lp.ents;
    const time = ents.effective_plan_time ? stateVal(this._hass, ents.effective_plan_time) : null;
    const lang = this._config.language || this._hass?.language || "en";
    const when = fmtClock(time, lang);
    if (!when) return "";

    const active = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const num    = id => id ? parseFloat(stateVal(this._hass, id)) : NaN;
    const energy = this._planKind(ents) === "energy";
    const goal   = energy ? num(ents.plan_energy) : num(ents.effective_plan_soc);
    const item   = (label, text) =>
      `<div class="session-item"><span class="si-label">${label}</span><span class="si-value">${text}</span></div>`;
    return `
      <div class="plan-block vehicle-plan">
        <div class="plan-header">
          <span class="session-title">${this._t("chargePlan")}</span>
          <span class="plan-badge ${active ? "active" : "planned"}">${active ? this._t("chargingByPlan") : this._t("planned")}</span>
        </div>
        <div class="session-grid">
          ${item(this._t("finishBy"), escHtml(when))}
          ${goal > 0 ? item(this._t(energy ? "planTargetEnergy" : "targetSoc"), energy ? `${Math.round(goal)} kWh` : `${Math.round(goal)} %`) : ""}
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

// Part of the card stylesheet, see src/styles.js. The block reuses the
// loadpoint's header, SoC bar and session grid.
export const vehicleCss = `
      .vehicle-lp { font-size: .85em; color: var(--secondary-text-color); margin-right: 8px; white-space: nowrap; }
      .vehicle-hint { font-size: .8rem; line-height: 1.4; color: var(--secondary-text-color); margin-bottom: 12px; }
      .vehicle-block [data-more-info] { cursor: pointer; }
`;
