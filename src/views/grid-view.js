import { _discoverDeviceSources } from "../core/entity-discovery.js";
import { stateVal, attr, unitStr } from "../utils/state.js";
import { escHtml } from "../utils/html.js";

// Grid mode (site2). Methods are mixed into EvccCard.prototype.
export const gridView = {
  _renderSiteBlock2(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };

    const pvSources = _discoverDeviceSources(site, "pv", "power");

    const battSources = _discoverDeviceSources(site, "battery", "power", "soc").map(s => ({
      ...s,
      label: (site[s.key] ? (attr(this._hass, site[s.key], "title") ?? null) : null) ?? `${this._t("battery")} ${s.idx + 1}`,
    }));

    const pvPow         = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const gridPow       = kw(site.grid_power);
    const battPow       = kw(site.battery_power);
    const homePow       = kw(site.home_power);
    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;

    const totalIn = pvPow + battDischPow + bezugPow;
    const pvShare = totalIn > 0.05 ? Math.round(pvPow / totalIn * 100) : 0;

    const fmt   = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const fmtKw = v => `${fmt(v)} kW`;

    const importing = bezugPow > 0.05;
    const exporting = feedinPow > 0.05;
    const netColor  = importing ? "var(--evcc-red)" : exporting ? "var(--evcc-green)" : "var(--secondary-text-color)";
    const netAbs    = importing ? bezugPow : feedinPow;
    const netValStr = (importing || exporting)
      ? `${importing ? "+" : "−"}${fmtKw(netAbs)}`
      : "–";
    const netLabel  = importing
      ? this._t("gridImport")
      : exporting
        ? this._t("gridExport")
        : this._t("gridNeutral") || "–";

    const pvBadge = pvShare > 0
      ? `<div class="s2-pv-badge">
           <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>
           ${pvShare} % ${this._t("solar")}
         </div>`
      : "";

    const chip = (dot, label, sub, entityId = null) =>
      `<div class="s2-chip${entityId ? " s2-chip-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="s2-chip-dot" style="background:${dot}"></span>
        <span class="s2-chip-name">${escHtml(label)}</span>
        ${sub ? `<span class="s2-chip-sub">${escHtml(sub)}</span>` : ""}
      </div>`;

    const lpChips = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow = kw(ents.charge_power);
        const unit  = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const soc   = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        const lpTitle = this._hass?.states[ents.mode]?.attributes?.loadpoint_title ?? lpName;
        return chip("var(--evcc-blue)", lpTitle, soc ? `${fmtKw(lpPow)} · ${soc}` : fmtKw(lpPow), ents.charge_power);
      }).join("");

    const aggBattSoc = site.battery_soc ? Math.round(parseFloat(stateVal(this._hass, site.battery_soc)) || 0) : null;

    const battDischChips = battSources.length > 1
      ? battSources.flatMap(s => {
          const p = kw(site[s.key]);
          if (p <= 0.05) return [];
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          return [chip("var(--evcc-orange)", s.label, bSoc !== null ? `${fmtKw(p)} · ${bSoc} %` : fmtKw(p), site[s.key])];
        })
      : battDischPow > 0.05 ? [chip("var(--evcc-orange)", this._t("battDischarge"), aggBattSoc !== null ? `${fmtKw(battDischPow)} · ${aggBattSoc} %` : fmtKw(battDischPow), site.battery_power)] : [];

    const battChargeChips = battSources.length > 1
      ? battSources.flatMap(s => {
          const p = kw(site[s.key]);
          if (p >= -0.05) return [];
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          return [chip("var(--evcc-orange)", s.label, bSoc !== null ? `${fmtKw(Math.abs(p))} · ${bSoc} %` : fmtKw(Math.abs(p)), site[s.key])];
        })
      : battChargePow > 0.05 ? [chip("var(--evcc-orange)", this._t("battCharge"), aggBattSoc !== null ? `${fmtKw(battChargePow)} · ${aggBattSoc} %` : fmtKw(battChargePow), site.battery_power)] : [];

    const srcChips = [
      pvPow        > 0.05 ? chip("var(--evcc-green)",  this._t("generation"),    fmtKw(pvPow),    site.pv_power)    : "",
      bezugPow     > 0.05 ? chip("var(--evcc-red)",    this._t("gridImport"),    fmtKw(bezugPow), site.grid_power)  : "",
      ...battDischChips,
    ].filter(Boolean).join("");

    const dstChips = [
      homePow      > 0.05 ? chip("var(--secondary-text-color)", this._t("consumption"), fmtKw(homePow),   site.home_power)  : "",
      lpChips,
      ...battChargeChips,
      feedinPow    > 0.05 ? chip("var(--evcc-yellow)", this._t("gridExport"),   fmtKw(feedinPow), site.grid_power)  : "",
    ].filter(Boolean).join("");

    const section = (labelKey, chips) => chips
      ? `<div class="s2-section">
           <div class="s2-section-label">${this._t(labelKey)}</div>
           <div class="s2-chips">${chips}</div>
         </div>`
      : "";

    return `
      <div class="s2-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("grid"))}</span>
        </div>
        <div class="s2-net">
          <div class="s2-net-label">${this._t("gridStatus")}</div>
          <div class="s2-net-value" style="color:${netColor}">${netValStr}</div>
          <div class="s2-net-status" style="color:${netColor}">${netLabel}</div>
          ${pvBadge}
        </div>
        ${section("generation", srcChips)}
        ${section("consumption", dstChips)}
        ${this._renderStatsFooter()}
      </div>`;
  },
};
