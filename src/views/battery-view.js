import { stateVal, attr, isOn } from "../utils/state.js";
import { escHtml } from "../utils/html.js";

// Battery mode. Methods are mixed into EvccCard.prototype.
export const batteryView = {
  _renderBatteryBlock(site) {
    const socId         = site.battery_soc;
    const powerId       = site.battery_power;
    const capId         = site.battery_capacity;
    const dischargeId   = site.battery_discharge_control;
    const prioritySocId      = site.priority_soc;
    const bufferSocId        = site.buffer_soc;
    const bufferStartSocId   = site.buffer_start_soc;

    if (!socId) return "";

    const soc         = parseFloat(stateVal(this._hass, socId)) || 0;
    const power       = powerId ? parseFloat(stateVal(this._hass, powerId)) || 0 : null;
    const cap         = capId   ? parseFloat(stateVal(this._hass, capId))   || 0 : null;
    const dischargeOn = dischargeId ? isOn(this._hass, dischargeId) : null;
    const socColor    = soc > 80 ? "var(--evcc-green)" : soc > 30 ? "var(--evcc-blue)" : "var(--evcc-amber)";

    const getVal  = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const getOpts = id => id ? (attr(this._hass, id, "options") ?? [])
      .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b) : [];

    const priorityVal      = getVal(prioritySocId);
    const bufferVal        = getVal(bufferSocId);
    const bufferStartVal   = getVal(bufferStartSocId);

    const bufferSocOpts      = getOpts(bufferSocId).filter(o => (priorityVal === null || o >= priorityVal) && (bufferStartVal === null || bufferStartVal === 0 || o <= bufferStartVal));
    const bufferStartSocOpts = getOpts(bufferStartSocId).filter(o => o === 0 || bufferVal === null || o >= bufferVal);
    const prioritySocOpts    = getOpts(prioritySocId).filter(o => bufferVal === null || o <= bufferVal);
    const bufferStartLabel   = o => o === 0 ? this._t("battBufferStartSocZero") : this._t("battBufferStartSocAt", { val: o });

    const inlineSelect = (entityId, val, filteredOpts, labelFn) => {
      if (!entityId || val === null || !filteredOpts.length) return "";
      const options = filteredOpts.map(o =>
        `<option value="${o}"${o === val ? " selected" : ""}>${labelFn ? labelFn(o) : `${o} %`}</option>`
      ).join("");
      return `<select class="batt-inline-select" data-entity="${entityId}">${options}</select>`;
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
        ${cap ? `<div class="batt-info-kwh">${(soc/100*cap).toFixed(1)} / ${cap} kWh</div>` : ""}
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
                <div class="batt-text-desc">${this._t("battBoostDesc", { val: inlineSelect(bufferSocId, bufferVal, bufferSocOpts) })}</div>
                ${bufferStartSocId ? `<div class="batt-text-desc">${this._t("battBufferStartDesc", { val: inlineSelect(bufferStartSocId, bufferStartVal, bufferStartSocOpts, bufferStartLabel) })}</div>` : ""}
              </div>
            </div>` : ""}
            ${prioritySocId ? `
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="fill:var(--evcc-blue)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battCarPrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battCarPrioDesc", { val: inlineSelect(prioritySocId, priorityVal, prioritySocOpts) })}</div>
              </div>
            </div>
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--secondary-text-color)"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battHomePrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battHomePrioDesc", { val: inlineSelect(prioritySocId, priorityVal, prioritySocOpts) })}</div>
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
      </div>`;

    return `
      <div class="battery-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("homeBattery"))}</span>
        </div>
        ${tabUsage}
      </div>`;
  },

  // Listeners of the battery view: the discharge toggle and the inline
  // selects. Called by _attachListeners() after every render.
  _attachBatteryListeners() {
    this._fresh("button.batt-discharge-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._toggleEntity(domain, btn.dataset.entity, on);
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    this._fresh(".batt-inline-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._setSelectOption(sel.dataset.entity, sel.value);
      });
      sel.addEventListener("click", e => e.stopPropagation());
    });
  },
};

// Battery mode.
// Part of the card stylesheet, see src/styles.js.
export const batteryCss = `
      .battery-block { padding: 0; }
      .batt-main-row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .batt-text-col { flex: 1; min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; gap: 12px; }
      .batt-text-item { display: flex; gap: 8px; align-items: flex-start; }
      .batt-text-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      .batt-text-title { font-size: .82rem; font-weight: 600; margin-bottom: 2px; }
      .batt-text-desc  { font-size: .76rem; color: var(--secondary-text-color); line-height: 1.4; }
      .batt-inline-select { color: var(--primary-color, #00b4d8); font-weight: 600; font-size: .76rem; font-family: inherit; background: transparent; border: none; border-bottom: 1px dotted var(--primary-color, #00b4d8); cursor: pointer; padding: 0 2px; outline: none; appearance: none; -webkit-appearance: none; }
      .batt-visual-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; align-self: flex-start; }
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
      .batt-info-col { display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; }
      .batt-info-label { font-size: .7rem; color: var(--secondary-text-color); line-height: 1.2; }
      .batt-info-pct   { font-size: 1.1rem; font-weight: 700; line-height: 1.1; }
      .batt-info-kwh, .batt-info-power { font-size: .7rem; color: var(--secondary-text-color); line-height: 1.2; white-space: nowrap; }
      .batt-discharge-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); font-size: .84rem; }
      .batt-discharge-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; background: var(--divider-color, #444); position: relative; cursor: pointer; flex-shrink: 0; transition: background .2s; }
      .batt-discharge-toggle.on { background: var(--primary-color, #00b4d8); }
      .batt-toggle-knob { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: left .2s; }
      .batt-discharge-toggle.on .batt-toggle-knob { left: 21px; }
      @container (max-width: 420px) {
        .batt-main-row { flex-direction: column; gap: 14px; }
        .batt-visual-col { align-self: stretch; justify-content: flex-start; }
      }
`;
