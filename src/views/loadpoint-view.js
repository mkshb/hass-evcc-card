import { SMART_MODE_ICON, CHARGE_MODES } from "../core/constants.js";
import { stateVal, attr, unitStr, isOn } from "../utils/state.js";
import { fmtNum, fmtClock, fmtDuration, fmtRemainingDuration, evccDate, fmtCountdownFromISO, fmtCountdownFromTimestamp, socFillGradient, socTrackBg } from "../utils/format.js";
import { escHtml, escAttr } from "../utils/html.js";

// A value that maps onto one ha-evcc entity opens that entity's more-info
// dialog on a click, the way the rows of the site and flow views do. The
// delegation in listeners.js attaches the handler, the focus and the keys to
// every element carrying the attribute; empty when the entity is not discovered.
const moreInfo = (entityId) => entityId ? ` data-more-info="${escAttr(entityId)}"` : "";

// Loadpoint and compact modes: header, mode selector, power row, vehicle and session info, toggles. Methods are mixed into EvccCard.prototype.
export const loadpointView = {
  _renderLoadpoint(lpName, ents) {
    const charging   = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected  = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusClass = charging ? "charging" : connected ? "connected" : "ready";

    const noPlan = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);
    const noPv   = Array.isArray(this._config.no_pv)   && this._config.no_pv.includes(lpName);
    const remaining = charging ? fmtRemainingDuration(this._hass, ents.charge_remaining_duration) : "";

    return `
      <div class="loadpoint">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          ${this._renderDisabledWarn(ents, lpName)}
          ${remaining ? `<span class="lp-remaining" title="${this._t("remaining")}"${moreInfo(ents.charge_remaining_duration)}>${remaining}</span>` : ""}
          <span class="lp-badge ${statusClass}"${moreInfo(charging ? ents.charging : ents.connected)}>
            ${statusLabel}
          </span>
        </div>
        ${this._renderActionIndicator(ents, lpName, noPlan)}
        ${this._renderModeSelector(ents, noPv)}
        ${this._renderVehicleInfo(ents, charging, lpName)}
        ${this._renderPowerRow(ents, charging)}
        ${this._renderSliders(ents)}
        ${this._renderCurrentBlock(ents, lpName)}
        ${this._renderToggles(ents)}
        ${noPlan ? "" : this._renderPlanBlock(lpName, ents)}
        ${this._renderSessionInfo(ents, charging)}
      </div>
    `;
  },

  _renderCompactLoadpoint(lpName, ents) {
    const charging    = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected   = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusClass = charging ? "charging" : connected ? "connected" : "ready";
    const noPlan      = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);
    const noPv        = Array.isArray(this._config.no_pv)   && this._config.no_pv.includes(lpName);

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
                  data-lp="${escAttr(lpName)}" data-tab="${i}">
            <span class="compact-tab-icon">${tab.icon}</span>
            <span class="compact-tab-label">${this._t(tab.key)}</span>
          </button>
        `).join("")}
      </div>`;

    const tabContent = [
      `<div class="compact-panel" ${activeTab !== 0 ? 'hidden' : ''}>
        ${this._renderModeSelector(ents, noPv)}
        ${this._renderVehicleInfo(ents, charging, lpName)}
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
        ${this._renderSessionInfo(ents, charging)}
      </div>`,
    ].join("");

    const remaining = charging ? fmtRemainingDuration(this._hass, ents.charge_remaining_duration) : "";

    return `
      <div class="loadpoint" data-lp-compact="${escAttr(lpName)}">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          ${this._renderDisabledWarn(ents, lpName)}
          ${remaining ? `<span class="lp-remaining" title="${this._t("remaining")}"${moreInfo(ents.charge_remaining_duration)}>${remaining}</span>` : ""}
          <span class="lp-badge ${statusClass}"${moreInfo(charging ? ents.charging : ents.connected)}>
            ${statusLabel}
          </span>
        </div>
        ${this._renderActionIndicator(ents, lpName, noPlan)}
        ${tabBar}
        ${tabContent}
      </div>
    `;
  },

  _loadpointTitle(lp, ents) {
    const hass = this._hass;
    // 1) a loadpoint_title attribute on the mode entity, when one is present
    const fromAttr = ents.mode && attr(hass, ents.mode, "loadpoint_title");
    if (fromAttr) return fromAttr;
    // 2) the device registry: ha-evcc names the loadpoint device like
    //    "evcc - Ladepunkt openWB [evcc]" — extract the title by locating the lp slug
    //    inside the device name case-insensitively (underscores match space/dash too).
    const probeEntity = ents.mode || ents.charge_power || ents.priority;
    const entReg = hass?.entities?.[probeEntity];
    const devId  = entReg?.device_id;
    const dev    = devId ? hass?.devices?.[devId] : null;
    if (dev?.name_by_user) return dev.name_by_user;
    const devName = dev?.name;
    if (devName) {
      const slugPattern = lp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[ _\\-]");
      const re = new RegExp(`(${slugPattern})`, "i");
      const m = devName.match(re);
      if (m) return m[1];
      return devName.replace(/^\[evcc\]\s*/i, "").trim() || lp;
    }
    return lp;
  },

  // phase_remaining is delivered as a raw seconds value (unlike pv_remaining,
  // which ha-evcc exposes as an absolute timestamp). Convert it to an absolute
  // target ISO so the generic _tickCountdowns() loop can count it down live.
  // The target is cached per entity and only re-anchored when the integration
  // reports a new remaining value, so frequent re-renders don't reset it.
  _phaseTargetISO(entityId, rawState) {
    const sec = Math.round(parseFloat(rawState));
    if (isNaN(sec) || sec <= 0) return null;
    this._phaseTargets = this._phaseTargets || {};
    const cached = this._phaseTargets[entityId];
    if (!cached || cached.raw !== String(rawState)) {
      this._phaseTargets[entityId] = {
        raw: String(rawState),
        iso: new Date(Date.now() + sec * 1000).toISOString(),
      };
    }
    return this._phaseTargets[entityId].iso;
  },

  // Lights up the block a chip jumped to. An animation rather than a class: the
  // morph strips every class the template does not render, so the next evcc
  // update (about every two seconds) would cut a class-driven one short.
  _flash(el) {
    const color = getComputedStyle(el).getPropertyValue("--primary-color").trim() || "#03a9f4";
    const lit   = `color-mix(in srgb, ${color} 15%, transparent)`;
    el.animate?.([
      { background: "transparent", borderRadius: "6px" },
      { background: lit, borderRadius: "6px", offset: 0.4 },
      { background: "transparent", borderRadius: "6px" },
    ], { duration: 1500, easing: "ease" });
  },

  _renderActionIndicator(ents, lpName = "", noPlan = false) {
    const flashIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>`;
    const sunIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`;

    // Every chip carries its own data-key: they share one class name, and the
    // morph would otherwise build a chip out of the one that left before it,
    // role and click listener included.
    const chips = [];

    // What drives the loadpoint right now comes first, as in evcc's vehicle
    // status: the charge plan, then the minimum charge.
    const planChip = noPlan ? "" : this._renderPlanHint(ents, lpName);
    if (planChip) chips.push(planChip);
    const minChip = this._renderMinSocHint(ents);
    if (minChip) chips.push(minChip);

    if (ents.phase_action && this._hass.states[ents.phase_action]) {
      const state = stateVal(this._hass, ents.phase_action);
      if (state === "scale1p" || state === "scale3p") {
        const key    = state === "scale1p" ? "phaseActionScale1p" : "phaseActionScale3p";
        const raw    = ents.phase_remaining ? stateVal(this._hass, ents.phase_remaining) : "";
        const target = ents.phase_remaining ? this._phaseTargetISO(ents.phase_remaining, raw) : null;
        const cd     = target ? fmtCountdownFromISO(target) : "";
        // Like evcc, the chip shows only while there is time left to count down.
        if (cd) chips.push(`
          <div class="lp-action-chip phase" data-key="phase">
            ${flashIcon}
            <span data-countdown-target="${target}" data-countdown-label="${key}">${this._t(key, { val: cd })}</span>
          </div>`);
      }
    }

    if (ents.pv_action && this._hass.states[ents.pv_action]) {
      const state = stateVal(this._hass, ents.pv_action);
      if (state === "enable" || state === "disable") {
        const ts  = ents.pv_remaining ? (stateVal(this._hass, ents.pv_remaining) || "") : "";
        const cd  = fmtCountdownFromTimestamp(this._hass, ents.pv_remaining);
        const key = state === "enable" ? "pvActionEnable" : "pvActionDisable";
        if (cd) chips.push(`
          <div class="lp-action-chip pv" data-key="pv">
            ${sunIcon}
            <span data-countdown-target="${ts}" data-countdown-label="${key}">${this._t(key, { val: cd })}</span>
          </div>`);
      }
    }

    const vehicleStatuses = [
      { key: "vehicle_detection_active", chip: "detection", label: "vehicleDetectionActive", icon: "M9.61 16.11C9.61 14.03 10.59 12.19 12.1 11H5L6.5 6.5H17.5L18.72 10.16C19.56 10.53 20.3 11.07 20.91 11.74L18.92 6C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H10.29C9.86 18.13 9.61 17.15 9.61 16.11M6.5 16C5.67 16 5 15.33 5 14.5S5.67 13 6.5 13 8 13.67 8 14.5 7.33 16 6.5 16M20.71 20.7L20.7 20.71L20.71 20.7M16.11 11.61C18.61 11.61 20.61 13.61 20.61 16.11C20.61 17 20.36 17.82 19.92 18.5L23 21.61L21.61 23L18.5 19.93C17.8 20.36 17 20.61 16.11 20.61C13.61 20.61 11.61 18.61 11.61 16.11S13.61 11.61 16.11 11.61M16.11 13.61C14.73 13.61 13.61 14.73 13.61 16.11S14.73 18.61 16.11 18.61 18.61 17.5 18.61 16.11 17.5 13.61 16.11 13.61" },
      { key: "vehicle_climater_active",  chip: "climater",  label: "vehicleClimaterActive",  icon: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z" },
      { key: "vehicle_welcome_active",   chip: "welcome",   label: "vehicleWelcomeActive",   icon: "M22,12V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V12A1,1 0 0,1 1,11V8A2,2 0 0,1 3,6H6.17C6.06,5.69 6,5.35 6,5A3,3 0 0,1 9,2C10,2 10.88,2.5 11.43,3.24V3.23L12,4L12.57,3.23V3.24C13.12,2.5 14,2 15,2A3,3 0 0,1 18,5C18,5.35 17.94,5.69 17.83,6H21A2,2 0 0,1 23,8V11A1,1 0 0,1 22,12M4,20H11V12H4V20M20,20V12H13V20H20M9,4A1,1 0 0,0 8,5A1,1 0 0,0 9,6A1,1 0 0,0 10,5A1,1 0 0,0 9,4M15,4A1,1 0 0,0 14,5A1,1 0 0,0 15,6A1,1 0 0,0 16,5A1,1 0 0,0 15,4M3,8V10H11V8H3M13,8V10H21V8H13Z" },
    ];
    for (const vs of vehicleStatuses) {
      if (ents[vs.key] && isOn(this._hass, ents[vs.key])) {
        chips.push(`
          <div class="lp-action-chip vehicle" data-key="${vs.chip}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${vs.icon}"/></svg>
            <span>${this._t(vs.label)}</span>
          </div>`);
      }
    }

    return chips.length ? `<div class="lp-action-row">${chips.join("")}</div>` : "";
  },

  // The charge plan in one line, so it shows without scrolling to the plan block
  // (or, in compact mode, switching to its tab): when it starts, or until when it
  // runs, and a warning when evcc projects the end after the target time. A tap
  // jumps to the plan block, so the chip shows only where that block is drawn.
  // A start that has passed without the plan running is a stale value (vehicle
  // unplugged); unlike evcc, the chip does not announce it.
  _renderPlanHint(ents, lpName) {
    if (!this._hasPlanBlock(ents)) return "";
    const date   = (id) => id ? evccDate(stateVal(this._hass, id)) : null;
    const active = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const start  = date(ents.plan_projected_start);
    const end    = date(ents.plan_projected_end);
    const target = date(ents.effective_plan_time);
    if (active ? !end : !start || start.getTime() <= Date.now()) return "";

    const lang    = this._config.language || this._hass?.language || "en";
    // evcc's planTimeUnreachable: the projected end lies after the target time.
    // A minute of slack keeps rounding in evcc's projection from raising it.
    const overrun = end && target ? (end.getTime() - target.getTime()) / 1000 : 0;
    const late    = overrun >= 60;
    const text    = late
      ? this._t("planHintLate", { overrun: fmtDuration(overrun) })
      : active
        ? this._t("planHintActive", { time: fmtClock(end.toISOString(), lang) })
        : this._t("planHintStart", { time: fmtClock(start.toISOString(), lang) });
    const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V8H19V19Z"/></svg>`;
    return `
          <div class="lp-action-chip plan${late ? " late" : ""}" data-key="plan" data-lp-plan-open="${escAttr(lpName)}">
            ${icon}
            <span>${escHtml(text)}</span>
          </div>`;
  },

  // evcc charges to the minimum SoC first in every mode but Off (the Off case
  // comes first in core/loadpoint.go); evcc's minSocNotReached while a vehicle
  // is connected. SoC 0 is evcc's "no value". evcc's own status shows the hint
  // in Off as well; here it stays away there, as nothing gets charged.
  _renderMinSocHint(ents) {
    if (!ents.min_soc || !ents.vehicle_soc || this._isHeatingLoadpoint(ents)) return "";
    if (ents.mode && stateVal(this._hass, ents.mode) === "off") return "";
    const connected = ents.connected ? isOn(this._hass, ents.connected) : false;
    const minSoc    = parseFloat(stateVal(this._hass, ents.min_soc));
    const soc       = parseFloat(stateVal(this._hass, ents.vehicle_soc));
    if (!connected || !(minSoc > 0) || !(soc > 0) || soc >= minSoc) return "";
    const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4M11,18H13V16H11V18M11,9V14H13V9H11Z"/></svg>`;
    return `
          <div class="lp-action-chip minsoc" data-key="minsoc"${moreInfo(ents.min_soc)}>
            ${icon}
            <span>${escHtml(this._t("minSocHint", { soc: `${Math.round(minSoc)} %` }))}</span>
          </div>`;
  },

  _renderModeSelector(ents, hidePv = false) {
    if (!ents.mode) return "";
    const current = stateVal(this._hass, ents.mode);

    // evcc 0.310 "switch devices" no longer offer the 'minpv' mode, and with
    // evcc PR 32490 a loadpoint offers 'smart' instead of 'pv'/'minpv' (ha-evcc
    // then swaps the whole option list to [off, smart, now]). Render only the
    // modes the entity actually exposes; fall back to the classic set when
    // options are not yet loaded, so nothing regresses on older integrations.
    const available = attr(this._hass, ents.mode, "options");
    const offered   = Array.isArray(available) && available.length ? available : null;
    const hasSmart  = !!offered && offered.includes("smart");

    // Mirror evcc's Mode.vue: when PV is hidden (no solar configured) the modes
    // depend on whether a dynamic tariff is available (smartCostAvailable). The
    // ha-evcc integration exposes no such flag, so we proxy it via a valid
    // tariff sensor value (same signal used by the smart-cost block below).
    // With a real 'smart' mode only the [Off, Now] case is left to do; before
    // that, 'pv' stands in for it.
    let hidden    = [];
    let pvAsSmart = false;
    if (hidePv) {
      const isCo2     = (attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "") === "g/kWh";
      const tariffId  = `sensor.${this._getPrefix()}${isCo2 ? "tariff_co2" : "tariff_grid"}`;
      const smartCost = !isNaN(parseFloat(this._hass.states[tariffId]?.state ?? "NaN"));
      if (hasSmart)        { if (!smartCost) hidden = ["smart"]; }   // [Off, Smart, Now] or [Off, Now]
      else if (smartCost)  { hidden = ["minpv"]; pvAsSmart = true; } // [Off, Smart, Now]
      else                 { hidden = ["pv", "minpv"]; }             // [Off, Now]
    }

    // evcc labels the modes of a continuously running device (a heat pump)
    // Normal / Smart / Boost instead of Off / Smart / Now (chargeModeLabel.ts,
    // chargerFeatureContinuous). ha-evcc exposes no such flag, the heating
    // marker is the closest signal it has.
    const heating = this._isHeatingLoadpoint(ents);
    const HEATING_LABELS = { off: "modeNormal", now: "modeBoost" };

    const buttons = Object.entries(CHARGE_MODES)
      .filter(([val]) => {
        if (val === current)      return true;
        if (hidden.includes(val)) return false;
        if (offered)              return offered.includes(val);
        return val !== "smart";   // options unknown: keep the pre-32391 set
      })
      .map(([val, cfg]) => {
        const isSmart = pvAsSmart && val === "pv";
        const icon    = isSmart ? SMART_MODE_ICON : cfg.icon;
        const tKey    = isSmart ? "modeSmart" : (heating && HEATING_LABELS[val]) || cfg.tKey;
        const label   = this._t(tKey);
        return `
      <button class="mode-btn ${current === val ? "active" : ""}"
              data-entity="${ents.mode}" data-value="${val}">
        <span class="mode-icon">${icon}</span>
        <span class="mode-label">${label}</span>
      </button>
    `;
      }).join("");
    const alwaysCharge = this._renderAlwaysCharge(ents);
    return `<div class="mode-row${alwaysCharge ? " has-sub" : ""}">${buttons}</div>${alwaysCharge}`;
  },

  // Companion of the 'smart' mode (evcc PR 32490, ha-evcc 2026.8.3+): charge
  // without interruption at least at min current, either permanently ('on') or
  // for the running session only ('once'). ha-evcc marks the entity unavailable
  // while the loadpoint is not in 'smart' mode, so the row disappears by itself
  // whenever it does not apply.
  _renderAlwaysCharge(ents) {
    const entityId = ents.always_charge;
    if (!entityId) return "";
    const current = stateVal(this._hass, entityId);
    if (current === null || current === "unavailable" || current === "unknown") return "";

    const options = attr(this._hass, entityId, "options");
    if (!Array.isArray(options) || !options.length) return "";

    const LABELS = {
      "off":  this._t("alwaysChargeOff"),
      "on":   this._t("alwaysChargeOn"),
      "once": this._t("alwaysChargeOnce"),
    };
    const buttons = options.map(opt => `
        <button class="pill-btn ac-btn ${opt === current ? "active" : ""}"
                data-entity="${entityId}" data-value="${escAttr(opt)}">
          ${LABELS[opt] ?? escHtml(opt)}
        </button>`).join("");

    // Same subline evcc shows under its Always-charge dropdown, as a tooltip so
    // the compact row stays a single line.
    const minA = ents.min_current ? stateVal(this._hass, ents.min_current) : null;
    const hint = minA !== null && !isNaN(parseFloat(minA))
      ? this._t("alwaysChargeHint", { val: minA }) : "";

    return `
      <div class="select-row alwayscharge-row">
        <span${hint ? ` title="${escAttr(hint)}"` : ""}>${this._t("alwaysCharge")}</span>
        <div class="pill-btn-group">${buttons}</div>
      </div>`;
  },

  // evcc's socBasedCharging (UI uiLoadpoints.ts): an assigned vehicle that
  // reports a SoC (no "Offline" feature), or any SoC above zero. Otherwise
  // evcc works in kWh: energy charged, an energy limit, a plan in kWh.
  // Heating loadpoints keep their temperature view, and without the vehicle
  // select there is nothing to decide on.
  _socBasedCharging(ents) {
    if (!ents.vehicle_name || this._isHeatingLoadpoint(ents)) return true;
    const vehicleId = stateVal(this._hass, ents.vehicle_name);
    const known     = !!vehicleId && !["null", "unknown", "unavailable"].includes(vehicleId);
    const origin    = known ? (this._hass.states[ents.vehicle_name]?.attributes?.vehicle?.originObject ?? {}) : {};
    const hasSoc    = known && !(origin.features ?? []).includes("Offline");
    const soc       = ents.vehicle_soc ? parseFloat(stateVal(this._hass, ents.vehicle_soc)) : NaN;
    return hasSoc || soc > 0;
  },

  _renderVehicleInfo(ents, charging = false, lpName = "") {
    if (!ents.vehicle_soc && !ents.vehicle_name) return "";
    const vehicleAttrs = ents.vehicle_name
      ? (this._hass.states[ents.vehicle_name]?.attributes ?? {}) : {};
    // No vehicle assigned ("null") while a car is plugged in is evcc's guest
    // vehicle, and evcc names it so (Vehicles/Title.vue). A vehicle attribute
    // left over from before does not name it.
    const unassigned   = !!ents.vehicle_name && stateVal(this._hass, ents.vehicle_name) === "null";
    const vehicleName  = unassigned ? null : vehicleAttrs.vehicle?.name || null;
    const guest        = unassigned && !!ents.connected && isOn(this._hass, ents.connected);
    const validName    = vehicleName && vehicleName !== "null" ? vehicleName
                       : guest ? this._t("vehicleGuest") : null;

    if (!ents.vehicle_soc && !validName) return "";

    // Without a SoC evcc shows the energy charged instead, on a bar that runs up
    // to the plan or the energy limit (Vehicles/Soc.vue); the SoC markers go.
    const socBased = this._socBasedCharging(ents);
    const soc   = socBased && ents.vehicle_soc ? parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0 : null;
    const range = socBased && ents.vehicle_range
      ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_range))) : null;
    const kwh     = id => { const v = id ? parseFloat(stateVal(this._hass, id)) : NaN; return v > 0 ? v : 0; };
    const charged = socBased ? null : kwh(ents.charged_energy || ents.session_energy);
    const energyLimit = kwh(ents.limit_energy);
    const energyMax   = Math.max(kwh(ents.plan_energy), energyLimit, charged ?? 0);
    const limit  = ents.limit_soc ? parseFloat(stateVal(this._hass, ents.limit_soc))  : null;
    const minSoc = ents.min_soc   ? parseFloat(stateVal(this._hass, ents.min_soc))    : null;
    const fillBg  = soc !== null ? socFillGradient(soc, minSoc ?? 0, limit ?? 100) : "var(--evcc-blue)";
    const trackBg = socTrackBg(minSoc ?? 0, limit ?? 100);

    // Like the slider, the chip needs the clear button (see _limitClear).
    const offered    = !!ents.smart_cost_limit && !!this._limitClear(ents.smart_cost_limit);
    const _rawLimit  = offered ? parseFloat(stateVal(this._hass, ents.smart_cost_limit)) : NaN;
    const smartLimit = offered && !isNaN(_rawLimit) ? _rawLimit : null;
    const smartUnit  = smartLimit !== null
      ? (attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "") : "";
    const isCo2Chip  = smartUnit === "g/kWh";
    const prefix     = this._getPrefix();
    const tariffId   = isCo2Chip ? `sensor.${prefix}tariff_co2` : `sensor.${prefix}tariff_grid`;
    const tariffVal  = parseFloat(this._hass.states[tariffId]?.state ?? "NaN");
    const smartActive = smartLimit !== null && !isNaN(tariffVal) && tariffVal <= smartLimit;
    const leafIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/></svg>`;
    const euroIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M15,18.5C12.49,18.5 10.32,17.08 9.24,15H15V13H8.58C8.53,12.67 8.5,12.34 8.5,12C8.5,11.66 8.53,11.33 8.58,11H15V9H9.24C10.32,6.92 12.5,5.5 15,5.5C16.61,5.5 18.09,6.09 19.23,7.07L21,5.3C19.41,3.87 17.3,3 15,3C11.08,3 7.76,5.51 6.52,9H3V11H6.06C6.02,11.33 6,11.66 6,12C6,12.34 6.02,12.67 6.06,13H3V15H6.52C7.76,18.49 11.08,21 15,21C17.31,21 19.41,20.13 21,18.7L19.22,16.93C18.09,17.91 16.61,18.5 15,18.5Z"/></svg>`;
    const smartChip  = smartLimit !== null ? `
      <button class="smart-cost-chip ${smartActive ? "active" : ""}"
              data-lp-smart-cost-open="${escAttr(lpName)}">
        ${isCo2Chip ? leafIcon : euroIcon} ≤ ${smartLimit} ${isCo2Chip ? "g" : escHtml(smartUnit)}
      </button>` : "";

    const _boostLimitRaw = ents.battery_boost_limit
      ? parseInt(stateVal(this._hass, ents.battery_boost_limit), 10) : NaN;
    const boostLimit     = isNaN(_boostLimitRaw) ? 100 : _boostLimitRaw;
    const showBoostChip  = !!ents.battery_boost && boostLimit < 100;
    const boostOn        = showBoostChip ? isOn(this._hass, ents.battery_boost) : false;
    const battPlusIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16,20H8V14H10V12H8V6H16V20M14,4V2H10V4H8C6.89,4 6,4.89 6,6V20A2,2 0 0,0 8,22H16A2,2 0 0,0 18,20V6C18,4.89 17.11,4 16,4H14M11,9H13V11H15V13H13V15H11V13H9V11H11V9Z"/></svg>`;
    const boostChip      = showBoostChip ? `
      <button class="boost-activate-btn ${boostOn ? "on" : ""}"
              data-entity="${ents.battery_boost}"
              data-domain="switch"
              data-on="${boostOn}">
        ${battPlusIcon} ${this._t("boostShort", { val: boostLimit })}
      </button>` : "";

    return `
      <div class="soc-section">
        <div class="soc-label-row">
          ${validName ? `<span class="vehicle-name"${moreInfo(ents.vehicle_name)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z"/></svg> ${escHtml(validName)}</span>` : ""}
          ${soc !== null ? `<span data-live-entity="${ents.vehicle_soc}" data-live-type="soc-pct"${moreInfo(ents.vehicle_soc)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${escHtml(unitStr(this._hass, ents.vehicle_soc))}</span>` : ""}
          ${charged !== null ? `<span${moreInfo(ents.charged_energy || ents.session_energy)}>${this._t("charged")} ${fmtNum(charged, 1)} kWh</span>` : ""}
          ${range !== null ? `<span${moreInfo(ents.vehicle_range)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg> ${range} km</span>` : ""}
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
        ${charged !== null ? `
        <div class="soc-track energy-track">
          <div class="soc-fill ${charging ? 'charging' : ''}"
               style="width:${energyMax ? Math.min(100, charged / energyMax * 100) : 100}%;background:var(--evcc-blue)"></div>
          ${energyLimit > 0 && energyLimit < energyMax ? `<div class="soc-limit-marker" style="left:${energyLimit / energyMax * 100}%"></div>` : ""}
        </div>` : ""}
        ${boostChip ? `<div class="boost-activate-row">${boostChip}</div>` : ""}
        ${smartChip ? `<div class="smart-cost-row">${smartChip}</div>` : ""}
      </div>
    `;
  },

  _renderPowerRow(ents, charging) {
    if (!ents.charge_power) return "";
    const power = parseFloat(stateVal(this._hass, ents.charge_power)).toFixed(1);
    const unit  = unitStr(this._hass, ents.charge_power);

    // Phase current sensors (measured values). ha-evcc creates them disabled;
    // while they are off the warning triangle points at them (DISABLED_NEEDED).
    const hasPhaseCurrents = ents.charge_currents_0 || ents.charge_currents_1 || ents.charge_currents_2;
    const phaseCurrents = hasPhaseCurrents
      ? [0, 1, 2].map(i => {
          const val = ents[`charge_currents_${i}`]
            ? parseFloat(stateVal(this._hass, ents[`charge_currents_${i}`]))
            : null;
          return (val === null || isNaN(val)) ? null : val;
        })
      : null;

    // Fallback: offeredCurrent (without phase current sensors)
    const current = !hasPhaseCurrents && ents.charge_current
      ? stateVal(this._hass, ents.charge_current) : null;

    // Phasen-Label nur wenn keine Einzelwerte sichtbar
    const phases = !hasPhaseCurrents && ents.phases_active
      ? parseInt(stateVal(this._hass, ents.phases_active)) || null : null;
    const phasesLabel = phases === 1 ? this._t("phasesSingle")
                      : phases === 3 ? this._t("phasesTriple")
                      : phases !== null ? `${phases}` : null;

    // Show only phases with current > 0 (robust for arbitrary phase assignments).
    const activePhases = phaseCurrents ? phaseCurrents.filter(v => v !== null && v > 0) : null;
    const phaseStr = activePhases && activePhases.length > 0
      ? activePhases.map(v => Math.round(v)).join(" / ") + " A"
      : null;

    return `
      <div class="power-row ${charging ? "charging" : ""}">
        <span class="power-value"
              data-live-entity="${ents.charge_power}" data-live-type="power"${moreInfo(ents.charge_power)}>
          ${power} ${escHtml(unit)}
        </span>
        ${phaseStr ? `<span class="power-sep">·</span><span class="power-current"${moreInfo(ents.charge_currents_0 || ents.charge_currents_1 || ents.charge_currents_2)}>${phaseStr}</span>` : ""}
        ${current !== null ? `<span class="power-sep">·</span><span class="power-current"${moreInfo(ents.charge_current)}>${current} A</span>` : ""}
        ${phasesLabel !== null ? `<span class="power-sep">·</span><span class="power-phases"${moreInfo(ents.phases_active)}>${phasesLabel}</span>` : ""}
      </div>
    `;
  },

  _renderSessionInfo(ents, charging = false) {
    const hasAny = ents.session_energy || ents.session_price || ents.session_price_per_kwh || ents.session_co2_per_kwh || ents.session_solar_percentage;
    if (!hasAny) return "";

    const fmtVal = (entityId, decimals = 2) => {
      const v = parseFloat(stateVal(this._hass, entityId));
      if (isNaN(v)) return "—";
      const unit = unitStr(this._hass, entityId);
      return `${v.toFixed(decimals)}${unit ? " " + escHtml(unit) : ""}`;
    };

    const energy      = ents.session_energy          ? (() => { const v = parseFloat(stateVal(this._hass, ents.session_energy)); return isNaN(v) ? "—" : `${v.toFixed(2)} kWh`; })() : null;
    const price       = ents.session_price           ? (() => { const v = parseFloat(stateVal(this._hass, ents.session_price)); const u = unitStr(this._hass, ents.session_price) || "€"; return isNaN(v) ? "—" : `${v.toFixed(2)} ${escHtml(u)}`; })() : null;
    const fmtPerKwh = (entityId, decimals) => {
      const v = parseFloat(stateVal(this._hass, entityId));
      if (isNaN(v)) return "—";
      const unit = (unitStr(this._hass, entityId) || "").replace("/kWh", "").trim();
      return `${v.toFixed(decimals)}${unit ? " " + escHtml(unit) : ""}`;
    };
    const pricePerKwh = ents.session_price_per_kwh   ? fmtPerKwh(ents.session_price_per_kwh, 3) : null;
    const co2PerKwh   = ents.session_co2_per_kwh     ? fmtPerKwh(ents.session_co2_per_kwh, 0)   : null;
    const solar       = ents.session_solar_percentage? (() => { const v = parseFloat(stateVal(this._hass, ents.session_solar_percentage)); return isNaN(v) ? "—" : `${Math.round(v)} %`; })() : null;

    const items = [
      energy      ? `<div class="session-item"${moreInfo(ents.session_energy)}><span class="si-label">${this._t("energy")}</span><span class="si-value">${energy}</span></div>`          : "",
      price       ? `<div class="session-item"${moreInfo(ents.session_price)}><span class="si-label">${this._t("cost")}</span><span class="si-value">${price}</span></div>`              : "",
      pricePerKwh ? `<div class="session-item"${moreInfo(ents.session_price_per_kwh)}><span class="si-label">${this._t("sessionPricePerKwh")}</span><span class="si-value">${pricePerKwh}</span></div>` : "",
      co2PerKwh   ? `<div class="session-item"${moreInfo(ents.session_co2_per_kwh)}><span class="si-label">${this._t("sessionCo2PerKwh")}</span><span class="si-value">${co2PerKwh}</span></div>`     : "",
      solar       ? `<div class="session-item"${moreInfo(ents.session_solar_percentage)}><span class="si-label">${this._t("sessionSolar")}</span><span class="si-value">${solar}</span></div>`           : "",
    ].filter(Boolean);

    return `
      <div class="session-block">
        <div class="session-title">${charging ? this._t("chargeSessionCurrent") : this._t("chargeSessionLast")}</div>
        <div class="session-grid">${items.join("")}</div>
      </div>
    `;
  },

  // ha-evcc marks heating loadpoints (is_heating) by giving their SOC entities a
  // temperature device_class / °C unit (see force_celsius in the integration). Such
  // loadpoints are not EV charge points, so the charge-plan block is skipped for them.
  _isHeatingLoadpoint(ents) {
    const probe = ents.effective_plan_soc || ents.effective_limit_soc || ents.vehicle_soc;
    if (!probe) return false;
    const a = this._hass?.states[probe]?.attributes;
    if (!a) return false;
    return a.device_class === "temperature" || a.unit_of_measurement === "°C";
  },

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
              ${on ? this._t("toggleOn") : this._t("toggleOff")}
            </button>
          </div>
        `;
      });
    return rows.length ? `<div class="toggles">${rows.join("")}</div>` : "";
  },

  _renderEmpty(allLoadpoints = {}) {
    const available = Object.keys(allLoadpoints);
    const hint = available.length > 0
      ? `<p>${this._t("availableLoadpoints", { list: `<code>${available.map(escHtml).join(", ")}</code>` })}</p>`
      : "";
    return `
      <div class="empty">
        <p>${this._t("noLoadpoints")}</p>
        ${hint}
        <p class="empty-debug-hint">
          ${this._t("emptyTryDebug")}
          <button class="debug-link" data-action="open-debug">${this._t("openDebugMode")}</button>
        </p>
      </div>
    `;
  },

  // Placeholder when every (matching) loadpoint is disabled in the evcc
  // config and disabled_loadpoints is 'hide' - avoids an empty-looking card.
  _renderAllDisabled() {
    return `
      <div class="empty">
        <p>${this._t("allLoadpointsDisabled")}</p>
      </div>
    `;
  },

  // Dimmed stub for a loadpoint disabled in the evcc config
  // (disabled_loadpoints: dim). Only its disabled_in_config entity exists,
  // so there is nothing interactive to render.
  _renderDisabledLoadpoint(lpName, ents) {
    return `
      <div class="loadpoint lp-disabled" data-entity="${ents.disabled_in_config || ""}">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          <span class="lp-badge disabled">${this._t("loadpointDisabled")}</span>
        </div>
      </div>
    `;
  },

  // Listeners of the loadpoint and compact views: the charge settings toggle
  // and the jump to the smart cost limit, the compact tabs, the boost chip,
  // the mode buttons, the entity toggles and the phase buttons. Called by
  // _attachListeners() after every render.
  _attachLoadpointListeners() {
    this._fresh("[data-lp-current-toggle]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const lpName   = btn.dataset.lpCurrentToggle;
        // Same fallback as the render: with `charge_current_settings: expanded`
        // the block starts open, so the first click must collapse it.
        const expanded = this._currentBlockExpanded[lpName]
          ?? (this._config.charge_current_settings === "expanded");
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

    this._fresh("[data-lp-smart-cost-open]").forEach(chip => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const lpName = chip.dataset.lpSmartCostOpen;
        const block  = this.shadowRoot.querySelector(`[data-lp-current="${lpName}"]`);
        if (!block) return;
        const body = block.querySelector(".current-block-body");
        if (body) body.removeAttribute("hidden");
        this._currentBlockExpanded[lpName] = true;
        const toggleBtn = block.querySelector("[data-lp-current-toggle]");
        if (toggleBtn) toggleBtn.classList.add("active");
        const section = block.querySelector(`[data-lp-smart-cost-section="${lpName}"]`);
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "nearest" });
          this._flash(section);
        }
      });
    });

    this._fresh("[data-lp-plan-open]").forEach(chip => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const lpName = chip.dataset.lpPlanOpen;
        // compact mode: the plan sits in its own tab, switch to it
        const tab = chip.closest("[data-lp-compact]")?.querySelector('button.compact-tab[data-tab="2"]');
        if (tab && !tab.classList.contains("active")) tab.click();
        const block = [...this.shadowRoot.querySelectorAll(".plan-block")].find(b => b.dataset.lp === lpName);
        if (!block) return;
        block.scrollIntoView({ behavior: "smooth", block: "nearest" });
        this._flash(block);
      });
    });

    this._fresh("button.compact-tab").forEach(btn => {
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

    this._fresh("button.boost-activate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const on = btn.dataset.on === "true";
        this._toggleEntity("switch", btn.dataset.entity, on);
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    // The mode buttons mark the pressed one at once. The real state comes back
    // through evcc, ha-evcc and HA, which takes up to a few seconds while the
    // button would look as if the tap had not landed; a failed call reverts.
    this._fresh("button.mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._pressGroupButton(btn, ".mode-row", ".mode-btn");
      });
    });

    this._fresh("button.toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._toggleEntity(domain, btn.dataset.entity, on);
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
        if (btn.dataset.lp) this._requestPlanPreview(btn.dataset.lp);
      });
    });

    this._fresh("button.phase-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._pressGroupButton(btn, ".phase-btn-group", ".phase-btn");
      });
    });

    this._fresh("button.ac-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._pressGroupButton(btn, ".pill-btn-group", ".ac-btn");
      });
    });
  },

  // One button of a group writes its value to the select entity and shows as
  // active right away; the previous button gets the mark back when the service
  // call fails. The next render draws the state HA reports.
  _pressGroupButton(btn, groupSel, buttonSel) {
    const group = btn.closest(groupSel);
    const was   = group?.querySelector(`${buttonSel}.active`);
    if (group) {
      group.querySelectorAll(buttonSel).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }
    const call = this._setSelectOption(btn.dataset.entity, btn.dataset.value);
    call?.catch?.((e) => {
      console.warn("[evcc-card] select_option failed:", e?.message || e);
      if (!btn.isConnected) return;
      btn.classList.remove("active");
      if (was?.isConnected) was.classList.add("active");
    });
    return call;
  },
};

// Loadpoint and compact modes: header, badges, action chips, mode row, vehicle
// and power row, the entity toggles and the session block.
// Part of the card stylesheet, see src/styles.js.
export const loadpointCss = `
      .loadpoint {
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color, #e5e7eb);
        margin-bottom: 0;
      }
      .loadpoint:first-child { padding-top: 0; }
      .loadpoint:last-child { border-bottom: none; padding-bottom: 0; }
      /* The header values of a loadpoint open more-info; the site rows and the
         grid chips carry their own hover, this one covers the inline values. */
      .loadpoint [data-more-info] { cursor: pointer; }
      .loadpoint [data-more-info]:hover { opacity: .75; }
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
      .lp-badge.disabled  { color: var(--evcc-gray);   background: color-mix(in srgb, var(--evcc-gray)   15%, transparent); }
      .loadpoint.lp-disabled { opacity: 0.55; }
      .lp-action-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
      .lp-action-row[hidden], .lp-action-chip[hidden] { display: none; }
      .lp-action-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px; border-radius: 999px;
        font-size: .72rem; font-weight: 600;
        border: 1px solid var(--divider-color, #4b5563);
        color: var(--primary-text-color);
      }
      .lp-action-chip svg { width: 14px; height: 14px; flex: 0 0 14px; }
      .lp-action-chip.phase { color: var(--evcc-bolt, #ffae00); border-color: color-mix(in srgb, var(--evcc-bolt, #ffae00) 50%, transparent); background: color-mix(in srgb, var(--evcc-bolt, #ffae00) 10%, transparent); }
      .lp-action-chip.pv    { color: var(--evcc-green, #0a0);  border-color: color-mix(in srgb, var(--evcc-green, #0a0)  50%, transparent); background: color-mix(in srgb, var(--evcc-green, #0a0)  10%, transparent); }
      .lp-action-chip.plan  { color: var(--info-color, #2196f3); border-color: color-mix(in srgb, var(--info-color, #2196f3) 50%, transparent); background: color-mix(in srgb, var(--info-color, #2196f3) 10%, transparent); cursor: pointer; }
      .lp-action-chip.plan.late, .lp-action-chip.minsoc { color: var(--warning-color, #ff9800); border-color: color-mix(in srgb, var(--warning-color, #ff9800) 50%, transparent); background: color-mix(in srgb, var(--warning-color, #ff9800) 10%, transparent); }
      .lp-action-chip.minsoc { cursor: pointer; }
      .lp-action-chip.vehicle { color: var(--info-color, #2196f3); border-color: color-mix(in srgb, var(--info-color, #2196f3) 50%, transparent); background: color-mix(in srgb, var(--info-color, #2196f3) 10%, transparent); }
      .lp-remaining {
        font-size: .85em; color: var(--secondary-text-color);
        margin-right: 8px; white-space: nowrap;
      }

      .mode-row { display: flex; gap: 6px; margin-bottom: 12px; }
      .mode-row.has-sub { margin-bottom: 6px; }
      .alwayscharge-row { margin-bottom: 12px; }
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
      .smart-cost-row { display: flex; justify-content: flex-end; margin-top: 4px; }
      .boost-activate-row { display: flex; justify-content: flex-start; margin-top: 6px; margin-bottom: 2px; }
      .boost-activate-btn {
        display: inline-flex; align-items: center; gap: 4px;
        background: none; border: 1px solid var(--divider-color, #555);
        border-radius: 4px; cursor: pointer;
        font-size: .75rem; color: var(--secondary-text-color);
        padding: 3px 8px; font-family: inherit;
        transition: border-color .15s, color .15s, background .15s;
      }
      .boost-activate-btn:hover { border-color: var(--evcc-bolt, #ffae00); color: var(--evcc-bolt, #ffae00); }
      .boost-activate-btn.on { color: var(--evcc-bolt, #ffae00); border-color: var(--evcc-bolt, #ffae00); background: rgba(255,174,0,0.08); }
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

      .toggles { margin-bottom: 10px; }
      .toggle-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      button.toggle {
        padding: 3px 14px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s;
      }
      button.toggle.on { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .session-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .session-title { font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text-color); margin-bottom: 8px; }
      .session-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 6px; }
      .session-item { display: flex; flex-direction: column; gap: 2px; }
      .si-label { font-size: .7rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .05em; }
      .si-value { font-size: .95rem; font-weight: 600; color: var(--primary-text-color); }
`;
