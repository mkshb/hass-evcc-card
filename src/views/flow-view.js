import { _discoverDeviceSources } from "../core/entity-discovery.js";
import { stateVal, attr, unitStr } from "../utils/state.js";
import { escHtml } from "../utils/html.js";

// Flow mode (Sankey). Methods are mixed into EvccCard.prototype.
export const flowView = {
  _renderFlowBlock(site, loadpoints = {}) {
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

    const batterySoc = kwh(site.battery_soc);

    const fmt     = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const useWatt = Math.max(pvPow + battDischPow + bezugPow, homePow + chargePow + battChargePow + feedinPow) < 1;
    const fmtPow  = v => useWatt ? `${Math.round(v * 1000)} W` : `${fmt(v)} kW`;
    const fmtKw   = v => `${fmt(v)} kW`;
    const fmtKwh  = v => v === null ? "–" : `${fmt(v)} kWh`;

    // --- Source nodes (top) ---
    const sources = [];
    if (pvPow > 0.01)        sources.push({ id: "pv",   label: this._t("generation"),    pow: pvPow,        color: "var(--evcc-green)",  entity: site.pv_power });
    if (battDischPow > 0.01) sources.push({ id: "batt", label: batterySoc !== null ? `${this._t("battDischarge")} ${Math.round(batterySoc)} %` : this._t("battDischarge"), pow: battDischPow, color: "var(--evcc-orange)", entity: site.battery_power });
    if (bezugPow > 0.01)     sources.push({ id: "grid", label: this._t("gridImport"),    pow: bezugPow,     color: "var(--evcc-red)",    entity: site.grid_power });

    // --- Consumer nodes (bottom) ---
    const consumers = [];
    if (homePow > 0.01)       consumers.push({ id: "home",   label: this._t("consumption"),  pow: homePow,       color: "var(--secondary-text-color)", entity: site.home_power });
    // Individual loadpoints
    Object.entries(loadpoints).forEach(([lpName, ents]) => {
      const lpPow = kw(ents.charge_power);
      if (lpPow > 0.01) {
        const unit = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const soc  = ents.vehicle_soc ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0) : null;
        const isHeat = unit.includes("°");
        consumers.push({
          id: isHeat ? "heat" : "ev",
          label: lpName,
          pow: lpPow,
          color: "var(--evcc-blue)",
          entity: ents.charge_power,
          sub: soc !== null ? `${soc} ${unit}` : "",
        });
      }
    });
    if (battChargePow > 0.01) consumers.push({ id: "battc",  label: batterySoc !== null ? `${this._t("battCharge")} ${Math.round(batterySoc)} %` : this._t("battCharge"), pow: battChargePow, color: "var(--evcc-orange)", entity: site.battery_power });
    if (feedinPow > 0.01)     consumers.push({ id: "feedin", label: this._t("gridExport"),   pow: feedinPow,     color: "var(--evcc-yellow)",          entity: site.grid_power });

    if (sources.length === 0)   sources.push({ id: "none", label: "–", pow: 0.001, color: "var(--secondary-text-color)", entity: null });
    if (consumers.length === 0) consumers.push({ id: "none", label: "–", pow: 0.001, color: "var(--secondary-text-color)", entity: null });

    const totalSrc = sources.reduce((s, n) => s + n.pow, 0);
    const totalDst = consumers.reduce((s, n) => s + n.pow, 0);

    // --- PV-first flow distribution ---
    // flows[i][j] = power from source i to consumer j
    const flows = sources.map(() => consumers.map(() => 0));

    // Distribute PV first, then battery, then grid
    const srcOrder = ["pv", "batt", "grid", "none"];
    const sortedSrcIdx = [...sources.keys()].sort((a, b) =>
      srcOrder.indexOf(sources[a].id) - srcOrder.indexOf(sources[b].id)
    );

    const remaining = consumers.map(c => c.pow);
    for (const si of sortedSrcIdx) {
      let avail = sources[si].pow;
      for (let ci = 0; ci < consumers.length && avail > 0.001; ci++) {
        const take = Math.min(avail, remaining[ci]);
        if (take > 0.001) {
          flows[si][ci] = take;
          avail -= take;
          remaining[ci] -= take;
        }
      }
    }

    // --- Horizontal Sankey SVG (HA-style with icons) ---
    const MDI_ICON = {
      pv:     "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      batt:   "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      grid:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:   "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:     "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      heat:   "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };
    // Map node id to icon
    const srcIconMap = { pv: MDI_ICON.pv, batt: MDI_ICON.batt, grid: MDI_ICON.grid };
    const dstIconMap = { home: MDI_ICON.home, ev: MDI_ICON.ev, heat: MDI_ICON.heat, battc: MDI_ICON.batt, feedin: MDI_ICON.grid };

    // Short sub-label: SoC for battery nodes (LP nodes already have sub set)
    sources.forEach(s => {
      s.sub = (s.id === "batt" && batterySoc !== null) ? `${Math.round(batterySoc)} %` : "";
    });
    consumers.forEach(c => {
      if (c.sub === undefined) c.sub = (c.id === "battc" && batterySoc !== null) ? `${Math.round(batterySoc)} %` : "";
    });

    const NODE_W = 8;
    const NODE_GAP = 6;
    const ICON_SIZE = 16;
    const LABEL_PAD = 6;
    const FLOW_GAP = 140;
    const SVG_PAD = 4;

    // Compute total heights proportional to power
    const maxH = 120;
    const scaleH = maxH / Math.max(totalSrc, totalDst, 0.001);

    const srcHeights = sources.map(s => Math.max(10, s.pow * scaleH));
    const dstHeights = consumers.map(c => Math.max(10, c.pow * scaleH));

    const srcTotalH = srcHeights.reduce((a, b) => a + b, 0) + (sources.length - 1) * NODE_GAP;
    const dstTotalH = dstHeights.reduce((a, b) => a + b, 0) + (consumers.length - 1) * NODE_GAP;
    const contentH  = Math.max(srcTotalH, dstTotalH, 50);

    // Label area: icon(16) + gap(4) + text(~55) = ~75
    const srcLabelW = 80;
    const dstLabelW = 80;
    const SVG_W = srcLabelW + NODE_W + FLOW_GAP + NODE_W + dstLabelW;
    const SVG_H = contentH + 2 * SVG_PAD;

    const srcX = srcLabelW;
    const dstX = srcLabelW + NODE_W + FLOW_GAP;

    const srcStartY = SVG_PAD + (contentH - srcTotalH) / 2;
    const dstStartY = SVG_PAD + (contentH - dstTotalH) / 2;

    let cumSrcY = srcStartY;
    const srcNodes = sources.map((s, i) => {
      const y = cumSrcY;
      const h = srcHeights[i];
      cumSrcY += h + NODE_GAP;
      return { ...s, x: srcX, y, h, cy: y + h / 2 };
    });

    let cumDstY = dstStartY;
    const dstNodes = consumers.map((c, i) => {
      const y = cumDstY;
      const h = dstHeights[i];
      cumDstY += h + NODE_GAP;
      return { ...c, x: dstX, y, h, cy: y + h / 2 };
    });

    const sankeyId = `sankey-${this._cardId}`;

    // --- Flow paths ---
    const srcRightOffsets = srcNodes.map(() => 0);
    const dstLeftOffsets  = dstNodes.map(() => 0);
    const flowPaths = [];

    for (let si = 0; si < sources.length; si++) {
      for (let ci = 0; ci < consumers.length; ci++) {
        const f = flows[si][ci];
        if (f < 0.001) continue;

        const sn = srcNodes[si];
        const dn = dstNodes[ci];

        const srcBandH = (f / sn.pow) * sn.h;
        const dstBandH = (f / dn.pow) * dn.h;

        const sy0 = sn.y + srcRightOffsets[si];
        const sy1 = sy0 + srcBandH;
        const dy0 = dn.y + dstLeftOffsets[ci];
        const dy1 = dy0 + dstBandH;

        srcRightOffsets[si] += srcBandH;
        dstLeftOffsets[ci]  += dstBandH;

        const sx = srcX + NODE_W;
        const dx = dstX;
        const cx1 = sx + FLOW_GAP * 0.45;
        const cx2 = dx - FLOW_GAP * 0.45;

        const path = [
          `M ${sx} ${sy0}`,
          `C ${cx1} ${sy0}, ${cx2} ${dy0}, ${dx} ${dy0}`,
          `L ${dx} ${dy1}`,
          `C ${cx2} ${dy1}, ${cx1} ${sy1}, ${sx} ${sy1}`,
          `Z`
        ].join(" ");

        flowPaths.push(`<path d="${path}" fill="${sn.color}" opacity="0.35"/>`);
      }
    }

    // --- Node rects + labels as clickable groups ---
    const svgMdi = (path, x, y, color) =>
      `<g transform="translate(${x},${y}) scale(0.667)"><path d="${path}" fill="${color}"/></g>`;

    const srcGroups = srcNodes.map(s => {
      const iconPath = srcIconMap[s.id] || "";
      const iconX = s.x - LABEL_PAD - ICON_SIZE;
      const iconY = s.cy - ICON_SIZE / 2;
      const textX = iconX - 4;
      const sub = s.sub ? `
        <text x="${textX}" y="${s.cy + 12}" text-anchor="end" dominant-baseline="central"
              font-size="9" style="fill:var(--secondary-text-color)">${escHtml(s.sub)}</text>` : "";
      const inner = `
        <rect x="${s.x}" y="${s.y}" width="${NODE_W}" height="${s.h}" rx="3" fill="${s.color}"/>
        ${iconPath ? svgMdi(iconPath, iconX, iconY, s.color) : ""}
        <text x="${textX}" y="${s.cy - (s.sub ? 2 : 0)}" text-anchor="end" dominant-baseline="central"
              font-size="11" font-weight="700" style="fill:var(--primary-text-color)">${fmtPow(s.pow)}</text>
        ${sub}`;
      return s.entity
        ? `<g data-more-info="${s.entity}" style="cursor:pointer" class="sankey-node">${inner}</g>`
        : inner;
    }).join("");

    const dstGroups = dstNodes.map(d => {
      const iconPath = dstIconMap[d.id] || "";
      const iconX = d.x + NODE_W + LABEL_PAD;
      const iconY = d.cy - ICON_SIZE / 2;
      const textX = iconX + ICON_SIZE + 4;
      const sub = d.sub ? `
        <text x="${textX}" y="${d.cy + 12}" text-anchor="start" dominant-baseline="central"
              font-size="9" style="fill:var(--secondary-text-color)">${escHtml(d.sub)}</text>` : "";
      const inner = `
        <rect x="${d.x}" y="${d.y}" width="${NODE_W}" height="${d.h}" rx="3" fill="${d.color}"/>
        ${iconPath ? svgMdi(iconPath, iconX, iconY, d.color) : ""}
        <text x="${textX}" y="${d.cy - (d.sub ? 2 : 0)}" text-anchor="start" dominant-baseline="central"
              font-size="11" font-weight="700" style="fill:var(--primary-text-color)">${fmtPow(d.pow)}</text>
        ${sub}`;
      return d.entity
        ? `<g data-more-info="${d.entity}" style="cursor:pointer" class="sankey-node">${inner}</g>`
        : inner;
    }).join("");

    const siteExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");

    const chevronX = srcLabelW + NODE_W + FLOW_GAP / 2 - 9;
    const chevronY = SVG_H / 2 - 9;
    const chevronD = siteExpanded
      ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
      : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z";

    const sankeySvg = `
      <div class="sankey-wrap" role="button" tabindex="0" style="cursor:pointer"
           onclick="if(!event.target.closest('[data-more-info]'))window.__evccCards.get('${this._cardId}')._toggleSite()">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" preserveAspectRatio="xMidYMid meet"
             style="display:block;overflow:visible;font-family:inherit">
          ${flowPaths.join("")}
          ${srcGroups}
          ${dstGroups}
          <g class="sankey-center-chevron" transform="translate(${chevronX},${chevronY}) scale(0.75)"
             style="fill:var(--primary-text-color);opacity:0.35;pointer-events:none">
            <path d="${chevronD}"/>
          </g>
        </svg>
      </div>
    `;

    // --- MDI icon paths for table ---
    const MDI = {
      solar:   "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      battery: "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      tower:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:    "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:      "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      heat:    "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };

    // --- IN/OUT table ---
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
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="${MDI.heat || "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z"}"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="${MDI.ev}"/></svg>`;
        return row(icon, label, "", lpPow, "site-pw-blue", true, ents.charge_power);
      }).join("");

    const pvRows = pvSources.length > 1
      ? pvSources.map(s => {
          const p = kw(site[s.key]);
          return p > 0.005 ? row(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z"/></svg>`, s.label, "", p, "site-pw-green", true, site[s.key]) : "";
        }).join("")
      : "";

    const battRowIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="${MDI.battery}"/></svg>`;
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

    const svgIcon = (path) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="${path}"/></svg>`;

    const inSection = section(this._t("in"), inTotal, [
      row(svgIcon(MDI.solar), this._t("generation"), "", pvPow, "site-pw-green", false, site.pv_power),
      pvRows,
      battDischPow > 0.05
        ? row(svgIcon(MDI.battery),
              batterySoc !== null ? `${this._t("battDischarge")} – ${Math.round(batterySoc)} %` : this._t("battDischarge"),
              "", battDischPow, "", false, site.battery_power) : "",
      battDischRows,
      bezugPow > 0.05
        ? row(svgIcon(MDI.tower), this._t("gridImport"), "", bezugPow, "", false, site.grid_power) : "",
    ].join(""));

    const outSection = section(this._t("out"), outTotal, [
      row(svgIcon(MDI.home), this._t("consumption"), "", homePow, "", false, site.home_power),
      chargePow > 0.05
        ? row(svgIcon(MDI.ev), this._t("chargePoint"), "", chargePow, "site-pw-blue") + lpRows : "",
      battChargePow > 0.05
        ? row(svgIcon(MDI.battery),
              batterySoc !== null ? `${this._t("battCharge")} – ${Math.round(batterySoc)} %` : this._t("battCharge"),
              "", battChargePow, "", false, site.battery_power) : "",
      battChargeRows,
      feedinPow > 0.05
        ? row(svgIcon(MDI.tower), this._t("gridExport"), "", feedinPow, "site-pw-yellow", false, site.grid_power) : "",
    ].join(""));

    return `
      <div class="site-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("energyFlow") || this._t("overview"))}</span>
        </div>
        ${sankeySvg}
        <div class="site-table" style="${siteExpanded ? '' : 'display:none'}">
          ${inSection}
          <div class="site-section-gap"></div>
          ${outSection}
        </div>
        ${this._renderStatsFooter()}
      </div>`;
  },
};
