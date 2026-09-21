import { _discoverDeviceSources } from "../core/entity-discovery.js";
import { stateVal, attr, unitStr } from "../utils/state.js";
import { escHtml } from "../utils/html.js";

// Site mode. Methods are mixed into EvccCard.prototype.
export const siteView = {
  _renderSiteBlock(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };
    const kwh = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;

    const nameFromEntity = (entityId) => entityId ? (attr(this._hass, entityId, "title") ?? null) : null;
    const pvSources = _discoverDeviceSources(site, "pv", "power", "energy").map(s => ({
      ...s,
      label: nameFromEntity(site[s.key]) ?? `PV ${s.idx + 1}`,
    }));
    const pvPow = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const pvEnergyIds = pvSources.map(s => site[s.energyKey]).filter(Boolean);
    const pvKwh = pvEnergyIds.length > 0
      ? pvEnergyIds.reduce((sum, id) => sum + (kwh(id) ?? 0), 0)
      : kwh(site.pv_energy);
    const battSources = _discoverDeviceSources(site, "battery", "power", "soc").map(s => ({
      ...s,
      label: nameFromEntity(site[s.key]) ?? `${this._t("battery")} ${s.idx + 1}`,
    }));
    const gridPow = kw(site.grid_power);
    const battPow = kw(site.battery_power);
    const homePow = kw(site.home_power);

    const chargePow = Object.values(loadpoints)
      .reduce((sum, ents) => sum + kw(ents.charge_power), 0);

    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;

    const totalIn  = Math.max(pvPow + battDischPow + bezugPow, 0.001);

    const pvPct      = Math.round(pvPow      / totalIn * 100);
    const battDPct   = Math.round(battDischPow / totalIn * 100);
    const gridInPct  = Math.round(bezugPow   / totalIn * 100);

    const houseOnlyPow = homePow;
    const totalOut = Math.max(houseOnlyPow + chargePow + battChargePow + feedinPow, 0.001);
    const homePct   = Math.round(houseOnlyPow  / totalOut * 100);
    const chargePct = Math.round(chargePow     / totalOut * 100);
    const battCPct  = Math.round(battChargePow / totalOut * 100);
    const feedinPct = Math.round(feedinPow     / totalOut * 100);

    const pvSurplusPow = Math.min(feedinPow, pvPow);
    const pvSelfPow    = Math.max(pvPow - pvSurplusPow, 0);
    const pvSelfPct    = Math.round(pvSelfPow    / totalIn * 100);
    const pvSurplusPct = Math.round(pvSurplusPow / totalIn * 100);

    const fmt     = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const useWatt = Math.max(totalIn, totalOut) < 1;
    const fmtPow  = v => useWatt ? `${Math.round(v * 1000)} W` : `${fmt(v)} kW`;
    const fmtKw   = v => `${fmt(v)} kW`;
    const fmtKwh  = v => v === null ? "–" : `${fmt(v)} kWh`;

    const batterySoc = kwh(site.battery_soc);
    // Lifetime meter readings; kwh() yields null for a missing entity and the
    // matching row below stays hidden.
    const gridKwh    = kwh(site.grid_energy);
    const exportKwh  = kwh(site.grid_return_energy);
    const battCKwh   = kwh(site.battery_energy);
    const battDKwh   = kwh(site.battery_return_energy);

    const hasBatt   = site.battery_power && (battDischPow > 0.05 || battChargePow > 0.05);
    const hasGrid   = bezugPow > 0.05 || feedinPow > 0.05;
    const hasPV     = pvPow > 0.05;
    const hasCharge = chargePow > 0.05;

    const segments = [
      { cls: "seg-pv",         pct: pvSelfPct,    label: fmtPow(pvSelfPow),    color: "var(--evcc-green)",  show: pvSelfPow > 0.05 },
      { cls: "seg-battd",      pct: battDPct,     label: fmtPow(battDischPow), color: "var(--evcc-orange)", show: battDischPow > 0.05 },
      { cls: "seg-pv-surplus", pct: pvSurplusPct, label: fmtPow(pvSurplusPow), color: "var(--evcc-yellow)", show: pvSurplusPow > 0.05 },
      { cls: "seg-gridin",     pct: gridInPct,    label: fmtPow(bezugPow),     color: "var(--evcc-red)",    show: bezugPow > 0.05 },
    ].filter(s => s.pct > 0);

    const segTotal = segments.reduce((s, x) => s + x.pct, 0);
    if (segTotal > 0 && segTotal !== 100) {
      const scale = 100 / segTotal;
      segments.forEach(s => s.pct = Math.round(s.pct * scale));
      const diff = 100 - segments.reduce((s, x) => s + x.pct, 0);
      if (segments.length) segments[segments.length - 1].pct += diff;
    }

    const topLabels = [
      hasPV         ? { icon: "☀️",  val: fmtKw(pvPow),        pct: pvPct / 2 } : null,
      battDischPow > 0.05 ? { icon: "🔋↑", val: fmtKw(battDischPow), pct: pvPct + battDPct / 2 } : null,
      bezugPow > 0.05     ? { icon: "⚡↓", val: fmtKw(bezugPow),     pct: pvPct + battDPct + gridInPct / 2 } : null,
    ].filter(Boolean);

    const bottomSegs = [
      { icon: "🏠",  val: fmtPow(houseOnlyPow), pct: homePct,   show: houseOnlyPow > 0.05 },
      { icon: "🔌",  val: fmtPow(chargePow),     pct: chargePct, show: hasCharge },
      { icon: "🔋",  val: fmtPow(battChargePow), pct: battCPct,  show: battChargePow > 0.05 },
      { icon: "🗼",  val: fmtPow(feedinPow),     pct: feedinPct, show: feedinPow > 0.05 },
    ].filter(s => s.show);

    let cumPct = 0;
    bottomSegs.forEach(s => {
      s.midPct = cumPct + s.pct / 2;
      cumPct += s.pct;
    });

    const SVG_W        = 1000;
    const LABEL_W      = 60;
    const BRACE_TOP_H  = 40;
    const BAR_H        = 48;
    const BRACE_BOT_H  = 40;
    const BAR_Y        = BRACE_TOP_H;
    const BAR_X0       = 0;
    const BAR_X1       = SVG_W - LABEL_W;
    const BAR_W        = BAR_X1 - BAR_X0;
    const SVG_H        = BRACE_TOP_H + BAR_H + BRACE_BOT_H;
    const R            = 5;

    const TOP_TIP_Y    = BAR_Y - BRACE_TOP_H + 10;
    const BOT_TIP_Y    = BAR_Y + BAR_H + BRACE_BOT_H - 10;

    const COL_BRACE    = "currentColor";
    const COL_TEXT     = "currentColor";
    const COL_LABEL    = "currentColor";

    const BRACE_R = 14;
    const BRACE_GAP = 8;
    const bracePath = (x0, x1, barEdgeY, tipY) => {
      const r = Math.min(BRACE_R, Math.abs(tipY - barEdgeY) / 2, (x1 - x0) / 4);
      const startY = tipY < barEdgeY ? barEdgeY - BRACE_GAP : barEdgeY + BRACE_GAP;
      if (tipY < barEdgeY) {
        return [
          `M ${x0} ${startY}`,
          `L ${x0} ${tipY + r}`,
          `A ${r} ${r} 0 0 1 ${x0 + r} ${tipY}`,
          `L ${x1 - r} ${tipY}`,
          `A ${r} ${r} 0 0 1 ${x1} ${tipY + r}`,
          `L ${x1} ${startY}`,
        ].join(" ");
      } else {
        return [
          `M ${x0} ${startY}`,
          `L ${x0} ${tipY - r}`,
          `A ${r} ${r} 0 0 0 ${x0 + r} ${tipY}`,
          `L ${x1 - r} ${tipY}`,
          `A ${r} ${r} 0 0 0 ${x1} ${tipY - r}`,
          `L ${x1} ${startY}`,
        ].join(" ");
      }
    };

    let cumX = BAR_X0;
    const segsWithX = segments.map(s => {
      const w  = Math.round(s.pct / 100 * BAR_W);
      const x0 = cumX;
      const x1 = cumX + w;
      cumX = x1;
      return { ...s, x0, x1, xMid: (x0 + x1) / 2, w };
    });
    if (segsWithX.length) segsWithX[segsWithX.length - 1].x1 = BAR_X1;

    let cumXB = BAR_X0;
    const botSegsWithX = bottomSegs.map(s => {
      const w  = Math.round(s.pct / 100 * BAR_W);
      const x0 = cumXB;
      const x1 = cumXB + w;
      cumXB = x1;
      return { ...s, x0, x1, xMid: (x0 + x1) / 2 };
    });
    if (botSegsWithX.length) botSegsWithX[botSegsWithX.length - 1].x1 = BAR_X1;
    botSegsWithX.forEach(s => { s.xMid = (s.x0 + s.x1) / 2; });

    const barRects = segsWithX.map(s =>
      `<rect x="${s.x0}" y="${BAR_Y}" width="${s.x1 - s.x0}" height="${BAR_H}" fill="${s.color}" />`
    ).join("");

    const barClip = `
      <defs>
        <clipPath id="bar-clip">
          <rect x="${BAR_X0}" y="${BAR_Y}" width="${BAR_W}" height="${BAR_H}" rx="${R}" ry="${R}" />
        </clipPath>
      </defs>
      <g clip-path="url(#bar-clip)">${barRects}</g>`;

    const barDividers = segsWithX.slice(0, -1).map(s =>
      `<line x1="${s.x1}" y1="${BAR_Y}" x2="${s.x1}" y2="${BAR_Y + BAR_H}"
             stroke="rgba(0,0,0,0.20)" stroke-width="2" />`
    ).join("");

    const barLabels = segsWithX.map(s => {
      if (s.w < 40) return "";
      const fs = s.w < 80 ? 18 : 24;
      return `<text x="${s.xMid}" y="${BAR_Y + BAR_H / 2 + (fs === 18 ? 6 : 8)}"
                    text-anchor="middle" font-size="${fs}" font-weight="700"
                    fill="#fff" style="text-shadow:0 1px 3px rgba(0,0,0,0.5)">${escHtml(s.label)}</text>`;
    }).join("");

    const MDI = {
      solar:   "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      battery: "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      tower:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:    "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:      "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      solpan:  "M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z",
      heat:    "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };
    const srcPathMap = { "seg-pv": MDI.solar, "seg-pv-surplus": MDI.solar, "seg-battd": MDI.battery, "seg-gridin": MDI.tower };
    segsWithX.forEach(s => { s.srcPath = srcPathMap[s.cls] || ""; });
    const botPathMap = { "🏠": MDI.home, "🔌": MDI.ev, "🔋": MDI.battery, "🗼": MDI.tower };
    botSegsWithX.forEach(s => { s.mdiPath = botPathMap[s.icon] || ""; });

    const SVG_ICON_HALF = 12;

    const pvSeg      = segsWithX.find(s => s.cls === "seg-pv");
    const battSeg    = segsWithX.find(s => s.cls === "seg-battd");
    const surplusSeg = segsWithX.find(s => s.cls === "seg-pv-surplus");
    const gridSeg    = segsWithX.find(s => s.cls === "seg-gridin");
    const topBraceGroups = [];
    if (battSeg) {
      // Mit Batterie: PV eigene Klammer, Batterie+Einspeisung gemeinsame Klammer
      if (pvSeg) {
        topBraceGroups.push({ x0: pvSeg.x0, x1: pvSeg.x1, xMid: pvSeg.xMid, srcPath: MDI.solar });
      }
      const battGroup = [battSeg, surplusSeg].filter(Boolean);
      if (battGroup.length) {
        topBraceGroups.push({
          x0: battGroup[0].x0, x1: battGroup[battGroup.length - 1].x1,
          xMid: (battGroup[0].x0 + battGroup[battGroup.length - 1].x1) / 2,
          srcPath: MDI.battery,
        });
      }
    } else {
      // Ohne Batterie: PV+Einspeisung gemeinsame Klammer
      const pvGroup = [pvSeg, surplusSeg].filter(Boolean);
      if (pvGroup.length) {
        topBraceGroups.push({
          x0: pvGroup[0].x0, x1: pvGroup[pvGroup.length - 1].x1,
          xMid: (pvGroup[0].x0 + pvGroup[pvGroup.length - 1].x1) / 2,
          srcPath: MDI.solar,
        });
      }
    }
    if (gridSeg) {
      topBraceGroups.push({ x0: gridSeg.x0, x1: gridSeg.x1, xMid: gridSeg.xMid, srcPath: MDI.tower });
    }

    const topBraces = topBraceGroups.map(s => {
      const path  = bracePath(s.x0 + 2, s.x1 - 2, BAR_Y, TOP_TIP_Y);
      const ix = s.xMid - SVG_ICON_HALF, iy = TOP_TIP_Y - SVG_ICON_HALF;
      return `
        <path d="${path}" fill="none"
              style="stroke:var(--primary-text-color,#212121);opacity:0.45"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g transform="translate(${ix},${iy}) scale(1.25)" style="opacity:0.85">
          <path d="${s.srcPath}" style="fill:var(--primary-text-color,#212121)" />
        </g>`;
    }).join("");

    const botBraces = botSegsWithX.map(s => {
      const path  = bracePath(s.x0 + 2, s.x1 - 2, BAR_Y + BAR_H, BOT_TIP_Y);
      const ix = s.xMid - SVG_ICON_HALF, iy = BOT_TIP_Y - SVG_ICON_HALF;
      return `
        <path d="${path}" fill="none"
              style="stroke:var(--primary-text-color,#212121);opacity:0.45"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g transform="translate(${ix},${iy}) scale(1.25)" style="opacity:0.85">
          <path d="${s.mdiPath}" style="fill:var(--primary-text-color,#212121)" />
        </g>`;
    }).join("");

    const LX = BAR_X1 + 18;
    const sideLabels = `
      <text x="${LX}" y="${TOP_TIP_Y}" text-anchor="start" dominant-baseline="central"
            font-size="19" font-weight="700"
            style="fill:var(--secondary-text-color,#757575)">IN</text>
      <text x="${LX}" y="${BOT_TIP_Y}" text-anchor="start" dominant-baseline="central"
            font-size="19" font-weight="700"
            style="fill:var(--secondary-text-color,#757575)">OUT</text>`;

    const flowBar = `
      <div class="flow-wrap">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%"
             style="display:block;overflow:visible;font-family:inherit">
          ${barClip}
          ${barDividers}
          ${barLabels}
          ${topBraces}
          ${botBraces}
          ${sideLabels}
        </svg>
      </div>
    `;

    const row = (icon, label, sub, pw, pwClass = "", indent = false, entityId = null) => `
      <div class="site-row ${indent ? "site-row-indent" : ""}${entityId ? " site-row-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="site-row-icon">${icon}</span>
        <span class="site-row-label">
          <span class="site-row-name">${escHtml(label)}</span>
          ${sub ? `<span class="site-row-sub">${escHtml(sub)}</span>` : ""}
        </span>
        <span class="site-row-pw ${pwClass}">${fmtPow(pw)}</span>
      </div>`;

    const section = (title, total, rows) => `
      <div class="site-section">
        <div class="site-section-head">
          <span class="site-section-title">${escHtml(title)}</span>
          <span class="site-section-total">${fmtPow(total)}</span>
        </div>
        ${rows}
      </div>`;

    const inTotal  = pvPow + battDischPow + bezugPow;
    const outTotal = homePow + chargePow + battChargePow + feedinPow;

    const lpRows = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow  = kw(ents.charge_power);
        const unit   = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const val    = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        const lpTitle = this._hass?.states[ents.mode]?.attributes?.loadpoint_title ?? lpName;
        const label  = val ? `${lpTitle} – ${val}` : lpTitle;
        const icon   = unit.includes("°")
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z"/></svg>`;
        return row(icon, label, "", lpPow, "site-pw-blue", true, ents.charge_power);
      }).join("");

    const pvRows = pvSources.length > 1
      ? pvSources.map(s => {
          const p = kw(site[s.key]);
          return p > 0.005 ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z\"/></svg>", s.label, "", p, "site-pw-green", true, site[s.key]) : "";
        }).join("")
      : "";

    const battRowIcon = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>";
    const battDischRows = battSources.length > 1
      ? battSources.map(s => {
          const p = kw(site[s.key]);
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          const label = bSoc !== null ? `${s.label} – ${bSoc} %` : s.label;
          return p > 0.05 ? row(battRowIcon, label, "", p, "", true, site[s.key]) : "";
        }).join("")
      : "";
    const battChargeRows = battSources.length > 1
      ? battSources.map(s => {
          const p = kw(site[s.key]);
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          const label = bSoc !== null ? `${s.label} – ${bSoc} %` : s.label;
          return p < -0.05 ? row(battRowIcon, label, "", Math.abs(p), "", true, site[s.key]) : "";
        }).join("")
      : "";

    const inSection = section(this._t("in"), inTotal, [
      row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z\"/></svg>", this._t("generation"), "", pvPow, "site-pw-green", false, site.pv_power),
      pvRows,
      battDischPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>",
              batterySoc !== null ? `${this._t("battDischarge")} – ${Math.round(batterySoc)} %` : this._t("battDischarge"),
              "", battDischPow, "", false, site.battery_power) : "",
      battDischRows,
      bezugPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z\"/></svg>", this._t("gridImport"), "", bezugPow, "", false, site.grid_power) : "",
    ].join(""));

    const outSection = section(this._t("out"), outTotal, [
      row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z\"/></svg>", this._t("consumption"), "", homePow, "", false, site.home_power),
      chargePow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z\"/></svg>", this._t("chargePoint"), "", chargePow, "site-pw-blue") + lpRows : "",
      battChargePow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>",
              batterySoc !== null ? `${this._t("battCharge")} – ${Math.round(batterySoc)} %` : this._t("battCharge"),
              "", battChargePow, "", false, site.battery_power) : "",
      battChargeRows,
      feedinPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z\"/></svg>", this._t("gridExport"), "", feedinPow, "site-pw-yellow", false, site.grid_power) : "",
    ].join(""));

    const energyRow = (mdiPath, label, v, entityId) => v === null ? "" : `
      <div class="site-row${entityId ? " site-row-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="site-row-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="${mdiPath}"/></svg></span>
        <span class="site-row-label"><span class="site-row-name">${escHtml(label)}</span></span>
        <span class="site-row-pw">${fmtKwh(v)}</span>
      </div>`;
    const energyRows = [
      energyRow(MDI.solar,   this._t("generation"),    pvKwh,     site.pv_energy ?? pvEnergyIds[0]),
      energyRow(MDI.tower,   this._t("gridImport"),    gridKwh,   site.grid_energy),
      energyRow(MDI.tower,   this._t("gridExport"),    exportKwh, site.grid_return_energy),
      energyRow(MDI.battery, this._t("battCharge"),    battCKwh,  site.battery_energy),
      energyRow(MDI.battery, this._t("battDischarge"), battDKwh,  site.battery_return_energy),
    ].join("");
    const energySection = energyRows ? `
          <div class="site-section-gap"></div>
          <div class="site-section">
            <div class="site-section-head">
              <span class="site-section-title">${this._t("energyTotals")}</span>
            </div>
            ${energyRows}
          </div>` : "";

    const siteExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");

    return `
      <div class="site-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("overview"))}</span>
        </div>
        <div class="flow-wrap-clickable" role="button" tabindex="0" data-action="toggle-site"
             title="${siteExpanded ? this._t("siteCollapse") : this._t("siteExpand")}">
          ${flowBar}
        </div>
        <div class="site-table" style="${siteExpanded ? '' : 'display:none'}">
          ${inSection}
          <div class="site-section-gap"></div>
          ${outSection}
          ${energySection}
        </div>
        ${this._renderStatsFooter()}
      </div>`;
  },
};
