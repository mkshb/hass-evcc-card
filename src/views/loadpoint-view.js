import { SMART_MODE_ICON, CHARGE_MODES } from "../core/constants.js";
import { stateVal, attr, unitStr, isOn } from "../utils/state.js";
import { fmtRemainingDuration, fmtCountdownFromISO, fmtCountdownFromTimestamp, socFillGradient, socTrackBg } from "../utils/format.js";
import { escAttr } from "../utils/html.js";

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
          <span class="lp-name">${this._config.title || lpName}</span>
          ${remaining ? `<span class="lp-remaining" title="${this._t("remaining")}">${remaining}</span>` : ""}
          <span class="lp-badge ${statusClass}">
            ${statusLabel}
          </span>
        </div>
        ${this._renderActionIndicator(ents)}
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
                  data-lp="${lpName}" data-tab="${i}">
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
      <div class="loadpoint" data-lp-compact="${lpName}">
        <div class="lp-header">
          <span class="lp-name">${this._config.title || lpName}</span>
          ${remaining ? `<span class="lp-remaining" title="${this._t("remaining")}">${remaining}</span>` : ""}
          <span class="lp-badge ${statusClass}">
            ${statusLabel}
          </span>
        </div>
        ${this._renderActionIndicator(ents)}
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

  _renderActionIndicator(ents) {
    const flashIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>`;
    const sunIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`;

    const fmtCountdown = (sec) => {
      const n = Math.max(0, Math.round(parseFloat(sec)));
      if (isNaN(n) || n <= 0) return "";
      if (n < 60) return `${n}s`;
      return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
    };

    const chips = [];

    if (ents.phase_action && this._hass.states[ents.phase_action]) {
      const state = stateVal(this._hass, ents.phase_action);
      if (state === "scale1p" || state === "scale3p") {
        const key    = state === "scale1p" ? "phaseActionScale1p" : "phaseActionScale3p";
        const raw    = ents.phase_remaining ? stateVal(this._hass, ents.phase_remaining) : "";
        const target = ents.phase_remaining ? this._phaseTargetISO(ents.phase_remaining, raw) : null;
        const span   = target
          ? `<span data-countdown-target="${target}" data-countdown-label="${key}">${this._t(key, { val: fmtCountdownFromISO(target) || "—" })}</span>`
          : `<span>${this._t(key, { val: fmtCountdown(raw) || "—" })}</span>`;
        chips.push(`
          <div class="lp-action-chip phase">
            ${flashIcon}
            ${span}
          </div>`);
      }
    }

    if (ents.pv_action && this._hass.states[ents.pv_action]) {
      const state = stateVal(this._hass, ents.pv_action);
      if (state === "enable" || state === "disable") {
        const ts  = ents.pv_remaining ? (stateVal(this._hass, ents.pv_remaining) || "") : "";
        const cd  = fmtCountdownFromTimestamp(this._hass, ents.pv_remaining);
        const key = state === "enable" ? "pvActionEnable" : "pvActionDisable";
        chips.push(`
          <div class="lp-action-chip pv">
            ${sunIcon}
            <span data-countdown-target="${ts}" data-countdown-label="${key}">${this._t(key, { val: cd || "—" })}</span>
          </div>`);
      }
    }

    const vehicleStatuses = [
      { key: "vehicle_detection_active", label: "vehicleDetectionActive", icon: "M9.61 16.11C9.61 14.03 10.59 12.19 12.1 11H5L6.5 6.5H17.5L18.72 10.16C19.56 10.53 20.3 11.07 20.91 11.74L18.92 6C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H10.29C9.86 18.13 9.61 17.15 9.61 16.11M6.5 16C5.67 16 5 15.33 5 14.5S5.67 13 6.5 13 8 13.67 8 14.5 7.33 16 6.5 16M20.71 20.7L20.7 20.71L20.71 20.7M16.11 11.61C18.61 11.61 20.61 13.61 20.61 16.11C20.61 17 20.36 17.82 19.92 18.5L23 21.61L21.61 23L18.5 19.93C17.8 20.36 17 20.61 16.11 20.61C13.61 20.61 11.61 18.61 11.61 16.11S13.61 11.61 16.11 11.61M16.11 13.61C14.73 13.61 13.61 14.73 13.61 16.11S14.73 18.61 16.11 18.61 18.61 17.5 18.61 16.11 17.5 13.61 16.11 13.61" },
      { key: "vehicle_climater_active",  label: "vehicleClimaterActive",  icon: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z" },
      { key: "vehicle_welcome_active",   label: "vehicleWelcomeActive",   icon: "M22,12V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V12A1,1 0 0,1 1,11V8A2,2 0 0,1 3,6H6.17C6.06,5.69 6,5.35 6,5A3,3 0 0,1 9,2C10,2 10.88,2.5 11.43,3.24V3.23L12,4L12.57,3.23V3.24C13.12,2.5 14,2 15,2A3,3 0 0,1 18,5C18,5.35 17.94,5.69 17.83,6H21A2,2 0 0,1 23,8V11A1,1 0 0,1 22,12M4,20H11V12H4V20M20,20V12H13V20H20M9,4A1,1 0 0,0 8,5A1,1 0 0,0 9,6A1,1 0 0,0 10,5A1,1 0 0,0 9,4M15,4A1,1 0 0,0 14,5A1,1 0 0,0 15,6A1,1 0 0,0 16,5A1,1 0 0,0 15,4M3,8V10H11V8H3M13,8V10H21V8H13Z" },
    ];
    for (const vs of vehicleStatuses) {
      if (ents[vs.key] && isOn(this._hass, ents[vs.key])) {
        chips.push(`
          <div class="lp-action-chip vehicle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${vs.icon}"/></svg>
            <span>${this._t(vs.label)}</span>
          </div>`);
      }
    }

    return chips.length ? `<div class="lp-action-row">${chips.join("")}</div>` : "";
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
    // Obsolete once evcc offers a real 'smart' mode, hence the hasSmart guard.
    let hidden    = [];
    let pvAsSmart = false;
    if (hidePv && !hasSmart) {
      const isCo2     = (attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "") === "g/kWh";
      const tariffId  = `sensor.${this._getPrefix()}${isCo2 ? "tariff_co2" : "tariff_grid"}`;
      const smartCost = !isNaN(parseFloat(this._hass.states[tariffId]?.state ?? "NaN"));
      if (smartCost) { hidden = ["minpv"];        pvAsSmart = true; }  // [Off, Smart, Now]
      else           { hidden = ["pv", "minpv"]; }                     // [Off, Now]
    }

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
        const label   = isSmart ? this._t("modeSmart") : this._t(cfg.tKey);
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
        <button class="phase-btn ${opt === current ? "active" : ""}"
                data-entity="${entityId}" data-value="${opt}">
          ${LABELS[opt] ?? opt}
        </button>`).join("");

    // Same subline evcc shows under its Always-charge dropdown, as a tooltip so
    // the compact row stays a single line.
    const minA = ents.min_current ? stateVal(this._hass, ents.min_current) : null;
    const hint = minA !== null && !isNaN(parseFloat(minA))
      ? this._t("alwaysChargeHint", { val: minA }) : "";

    return `
      <div class="select-row alwayscharge-row">
        <span${hint ? ` title="${escAttr(hint)}"` : ""}>${this._t("alwaysCharge")}</span>
        <div class="phase-btn-group">${buttons}</div>
      </div>`;
  },

  _renderVehicleInfo(ents, charging = false, lpName = "") {
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

    const _rawLimit  = ents.smart_cost_limit ? parseFloat(stateVal(this._hass, ents.smart_cost_limit)) : NaN;
    const smartLimit = ents.smart_cost_limit && !isNaN(_rawLimit) ? _rawLimit : null;
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
              data-lp-smart-cost-open="${lpName}">
        ${isCo2Chip ? leafIcon : euroIcon} ≤ ${smartLimit} ${isCo2Chip ? "g" : smartUnit}
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
        ${boostChip ? `<div class="boost-activate-row">${boostChip}</div>` : ""}
        ${smartChip ? `<div class="smart-cost-row">${smartChip}</div>` : ""}
      </div>
    `;
  },

  _renderPowerRow(ents, charging) {
    if (!ents.charge_power) return "";
    const power = parseFloat(stateVal(this._hass, ents.charge_power)).toFixed(1);
    const unit  = unitStr(this._hass, ents.charge_power);

    // Phasenstrom-Sensoren (echte Messwerte, standardmäßig deaktiviert)
    const hasPhaseCurrents = ents.charge_currents_0 || ents.charge_currents_1 || ents.charge_currents_2;
    const phaseCurrents = hasPhaseCurrents
      ? [0, 1, 2].map(i => {
          const val = ents[`charge_currents_${i}`]
            ? parseFloat(stateVal(this._hass, ents[`charge_currents_${i}`]))
            : null;
          return (val === null || isNaN(val)) ? null : val;
        })
      : null;

    // Fallback: offeredCurrent (wenn keine Phasenstrom-Sensoren vorhanden)
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

    // Show hint when offeredCurrent is displayed (no phase current entities available).
    const hint = current !== null
      ? `<div class="power-currents-hint">${this._t("phaseCurrentsHint")}</div>`
      : "";

    return `
      <div class="power-row ${charging ? "charging" : ""}">
        <span class="power-value"
              data-live-entity="${ents.charge_power}" data-live-type="power">
          ${power} ${unit}
        </span>
        ${phaseStr ? `<span class="power-sep">·</span><span class="power-current">${phaseStr}</span>` : ""}
        ${current !== null ? `<span class="power-sep">·</span><span class="power-current">${current} A</span>` : ""}
        ${phasesLabel !== null ? `<span class="power-sep">·</span><span class="power-phases">${phasesLabel}</span>` : ""}
      </div>
      ${hint}
    `;
  },

  _renderSessionInfo(ents, charging = false) {
    const hasAny = ents.session_energy || ents.session_price || ents.session_price_per_kwh || ents.session_co2_per_kwh || ents.session_solar_percentage;
    if (!hasAny) return "";

    const fmtVal = (entityId, decimals = 2) => {
      const v = parseFloat(stateVal(this._hass, entityId));
      if (isNaN(v)) return "—";
      const unit = unitStr(this._hass, entityId);
      return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
    };

    const energy      = ents.session_energy          ? (() => { const v = parseFloat(stateVal(this._hass, ents.session_energy)); return isNaN(v) ? "—" : `${v.toFixed(2)} kWh`; })() : null;
    const price       = ents.session_price           ? (() => { const v = parseFloat(stateVal(this._hass, ents.session_price)); const u = unitStr(this._hass, ents.session_price) || "€"; return isNaN(v) ? "—" : `${v.toFixed(2)} ${u}`; })() : null;
    const fmtPerKwh = (entityId, decimals) => {
      const v = parseFloat(stateVal(this._hass, entityId));
      if (isNaN(v)) return "—";
      const unit = (unitStr(this._hass, entityId) || "").replace("/kWh", "").trim();
      return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
    };
    const pricePerKwh = ents.session_price_per_kwh   ? fmtPerKwh(ents.session_price_per_kwh, 3) : null;
    const co2PerKwh   = ents.session_co2_per_kwh     ? fmtPerKwh(ents.session_co2_per_kwh, 0)   : null;
    const solar       = ents.session_solar_percentage? (() => { const v = parseFloat(stateVal(this._hass, ents.session_solar_percentage)); return isNaN(v) ? "—" : `${Math.round(v)} %`; })() : null;

    const items = [
      energy      ? `<div class="session-item"><span class="si-label">${this._t("energy")}</span><span class="si-value">${energy}</span></div>`          : "",
      price       ? `<div class="session-item"><span class="si-label">${this._t("cost")}</span><span class="si-value">${price}</span></div>`              : "",
      pricePerKwh ? `<div class="session-item"><span class="si-label">${this._t("sessionPricePerKwh")}</span><span class="si-value">${pricePerKwh}</span></div>` : "",
      co2PerKwh   ? `<div class="session-item"><span class="si-label">${this._t("sessionCo2PerKwh")}</span><span class="si-value">${co2PerKwh}</span></div>`     : "",
      solar       ? `<div class="session-item"><span class="si-label">${this._t("sessionSolar")}</span><span class="si-value">${solar}</span></div>`           : "",
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
      ? `<p>${this._t("availableLoadpoints", { list: `<code>${available.join(", ")}</code>` })}</p>`
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
          <span class="lp-name">${this._config.title || lpName}</span>
          <span class="lp-badge disabled">${this._t("loadpointDisabled")}</span>
        </div>
      </div>
    `;
  },
};
