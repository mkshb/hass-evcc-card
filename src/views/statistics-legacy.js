import { stateVal, unitStr } from "../utils/state.js";

// Statistics from stat_* entities and the HA recorder (fallback without the ha-evcc sessions command). Methods are mixed into EvccCard.prototype.
export const statisticsLegacy = {
  _getStatEntityIds(period) {
    const per    = period ?? this._statsPeriod ?? "total";
    const base   = `sensor.${this._getPrefix()}`;
    const find   = id => this._hass?.states[id] ? id : null;
    const sufMap = {
      total:    { kwh: "stat_total_charged_kwh",    solar: "stat_total_solar_percentage",    price: "stat_total_avg_price"    },
      "30d":    { kwh: "stat30_charged_kwh",         solar: "stat30_solar_percentage",         price: "stat30_avg_price"         },
      "365d":   { kwh: "stat365_charged_kwh",        solar: "stat365_solar_percentage",        price: "stat365_avg_price"        },
      thisYear: { kwh: "stat_this_year_charged_kwh", solar: "stat_this_year_solar_percentage", price: "stat_this_year_avg_price" },
    };
    const s = sufMap[per] ?? sufMap.total;
    return {
      kwhId:      find(`${base}${s.kwh}`),
      solarId:    find(`${base}${s.solar}`),
      priceId:    find(`${base}${s.price}`),
      solarKwhId: find(`${base}stat_total_solar_k_wh_template`),
    };
  },

  _renderStatsPeriodTabs(size = "normal") {
    const cur  = this._statsPeriod ?? "total";
    const defs = [
      { key: "30d",      tKey: "statsPeriod30d"      },
      { key: "365d",     tKey: "statsPeriod365d"     },
      { key: "thisYear", tKey: "statsPeriodThisYear" },
      { key: "total",    tKey: "statsPeriodTotal"    },
    ];
    const btns = defs.map(d =>
      `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-period="${d.key}">${this._t(d.tKey)}</button>`
    ).join("");
    return `<div class="stats-period-tabs${size === "small" ? " stats-period-tabs--small" : ""}">${btns}</div>`;
  },

  _maybeRefreshStats() {
    const period = this._statsPeriod ?? "total";
    const age = Date.now() - (this._chartCacheTime[period] ?? 0);
    if (age > 5 * 60 * 1000) {
      this._chartCacheTime[period] = Date.now();
      this._fetchChartData(period);
    }
  },

  async _fetchChartData(period) {
    const { kwhId, solarKwhId } = this._getStatEntityIds("total"); // always use cumulative total entities
    if (!kwhId) return;

    const now   = new Date();
    let startTime, recorderPeriod;

    if (period === "30d") {
      startTime = new Date(now);
      startTime.setDate(startTime.getDate() - 31);
      startTime.setHours(0, 0, 0, 0);
      recorderPeriod = "day";
    } else if (period === "365d") {
      startTime = new Date(now.getFullYear(), now.getMonth() - 14, 1);
      recorderPeriod = "month";
    } else if (period === "thisYear") {
      startTime = new Date(now.getFullYear(), 0, 1);
      recorderPeriod = "month";
    } else { // total
      startTime = new Date(2010, 0, 1);
      recorderPeriod = "month";
    }

    try {
      const ids = [kwhId];
      if (solarKwhId) ids.push(solarKwhId);
      const result = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: startTime.toISOString(),
        statistic_ids: ids,
        period: recorderPeriod,
        types: ["sum"],
      });
      const stats      = result[kwhId]      ?? [];
      let   solarStats = solarKwhId ? (result[solarKwhId] ?? []) : [];

      // Template sensor exists but has too few data points yet → no solar split until it has history
      // Only count on daily queries (most granular), don't overwrite with monthly bucket counts
      if (recorderPeriod === "day") {
        this._solarDataPoints = solarKwhId ? solarStats.length : null;
      } else if (this._solarDataPoints === undefined) {
        this._solarDataPoints = solarKwhId ? solarStats.length : null;
      }
      if (solarStats.length < 3) solarStats = [];

      const liveKwh      = parseFloat(this._hass.states[kwhId]?.state);
      const liveSolarKwh = solarKwhId ? parseFloat(this._hass.states[solarKwhId]?.state) : NaN;

      if      (period === "30d")      this._chartCache[period] = this._computeDailyDeltas(stats, 30, solarStats, isNaN(liveKwh) ? null : liveKwh, isNaN(liveSolarKwh) ? null : liveSolarKwh);
      else if (period === "365d")     this._chartCache[period] = this._computeMonthlyDeltas(stats, 13, solarStats);
      else if (period === "thisYear") this._chartCache[period] = this._computeThisYearMonthly(stats, solarStats);
      else {
        const yearly = this._computeYearlyTotals(stats, solarStats);
        this._chartCache[period] = yearly.length <= 1
          ? this._computeThisYearMonthly(stats, solarStats)  // only one year of data → show months
          : yearly;
      }

      this._render();
    } catch(e) {
      console.warn("[evcc-card] chart error", e);
    }
  },

  _computeDailyDeltas(stats, days, solarStats = [], liveKwh = null, liveSolarKwh = null) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const prevDay = new Date(day);
      prevDay.setDate(prevDay.getDate() - 1);
      const cur   = byKey[toKey(day)] ?? (i === 0 ? liveKwh : null);
      const prev  = byKey[toKey(prevDay)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const sCur  = solarByKey[toKey(day)] ?? (i === 0 ? liveSolarKwh : null);
      const sPrev = solarByKey[toKey(prevDay)];
      const solarDelta = (sCur != null && sPrev != null) ? Math.max(0, sCur - sPrev) : null;
      const labelStr = day.toLocaleDateString(lang, { day: "numeric", month: "numeric" });
      result.push({ delta, solarDelta, label: day, labelStr, isCurrent: i === 0 });
    }
    return result;
  },

  _computeMonthlyDeltas(stats, count, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const result = [];
    for (let i = count - 1; i >= 0; i--) {
      const month     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      const cur   = byKey[toKey(month)];
      const prev  = byKey[toKey(prevMonth)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const sCur  = solarByKey[toKey(month)];
      const sPrev = solarByKey[toKey(prevMonth)];
      const solarDelta = (sCur != null && sPrev != null) ? Math.max(0, sCur - sPrev) : null;
      const labelStr = month.toLocaleDateString(lang, { month: "short" });
      result.push({ delta, solarDelta, label: month, labelStr, isCurrent: i === 0 });
    }
    return result;
  },

  _computeThisYearMonthly(stats, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now  = new Date();
    const year = now.getFullYear();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const result = [];
    for (let m = 0; m <= now.getMonth(); m++) {
      const month     = new Date(year, m, 1);
      const prevMonth = new Date(year, m - 1, 1);
      const cur   = byKey[toKey(month)];
      const prev  = byKey[toKey(prevMonth)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const sCur  = solarByKey[toKey(month)];
      const sPrev = solarByKey[toKey(prevMonth)];
      const solarDelta = (sCur != null && sPrev != null) ? Math.max(0, sCur - sPrev) : null;
      const labelStr = month.toLocaleDateString(lang, { month: "short" });
      result.push({ delta, solarDelta, label: month, labelStr, isCurrent: m === now.getMonth() });
    }
    return result;
  },

  _computeYearlyTotals(stats, solarStats = []) {
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const years = [...new Set(stats.map(s => new Date(s.start).getFullYear()))].sort();
    return years.map(year => {
      let yearTotal = 0, hasAny = false;
      let solarTotal = 0, hasSolar = false;
      for (let m = 0; m <= 11; m++) {
        const cur  = byKey[`${year}-${m}`];
        const prev = byKey[m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`];
        if (cur != null && prev != null) { yearTotal += Math.max(0, cur - prev); hasAny = true; }
        const sCur  = solarByKey[`${year}-${m}`];
        const sPrev = solarByKey[m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`];
        if (sCur != null && sPrev != null) { solarTotal += Math.max(0, sCur - sPrev); hasSolar = true; }
      }
      return {
        delta:      hasAny   ? yearTotal  : null,
        solarDelta: hasSolar ? solarTotal : null,
        label: new Date(year, 0, 1), labelStr: String(year), isCurrent: year === now.getFullYear(),
      };
    });
  },

  _renderBarChart(data) {
    const ML = 22, MR = 6, MT = 20, MB = 18;
    const W = 280, H = 110;
    const CW = W - ML - MR, CH = H - MT - MB;
    const n = data.length;
    const GAP = n > 20 ? 1 : 2;
    // Uniform bar width; center the bar group within CW
    const bw     = Math.floor((CW - GAP * (n - 1)) / n);
    const offset = Math.round((CW - (bw * n + GAP * (n - 1))) / 2);
    const barX0  = i => ML + offset + i * (bw + GAP);
    const barX1  = i => barX0(i) + bw;
    const maxVal = Math.max(...data.map(d => d.delta ?? 0), 0.1);

    // Nice Y-axis: round step up to 1/2/5/10/20/50… then derive tick count
    const rawStep  = maxVal / 5;
    const stepExp  = Math.floor(Math.log10(Math.max(rawStep, 0.001)));
    const stepBase = Math.pow(10, stepExp);
    const stepF    = rawStep / stepBase;
    const tickStep = (stepF <= 1 ? 1 : stepF <= 2 ? 2 : stepF <= 5 ? 5 : 10) * stepBase;
    const numTicks = Math.ceil(maxVal / tickStep);
    const niceMax  = tickStep * numTicks;
    const toY = v => MT + CH - Math.round((v / niceMax) * CH);

    // Grid lines + Y-axis labels (labels left-external, right-aligned)
    const grid = Array.from({ length: numTicks + 1 }, (_, i) => {
      const v = i * tickStep;
      const y = toY(v);
      const lbl = tickStep >= 1 ? Math.round(v) : v.toFixed(1);
      return `<line x1="${ML}" y1="${y}" x2="${W - MR}" y2="${y}"
                stroke="var(--divider-color,#374151)" stroke-width="${i === 0 ? 1 : 0.5}"
                opacity="${i === 0 ? 0.9 : 0.35}"/>
              <text x="${ML - 3}" y="${y + 3}" text-anchor="end" font-size="6.5"
                fill="var(--secondary-text-color,#888)">${lbl}</text>`;
    }).join("");

    // "kWh" above the topmost tick, like HA
    const kwhLbl = `<text x="${ML - 3}" y="${MT - 8}" text-anchor="end" font-size="6.5"
      fill="var(--secondary-text-color,#888)">kWh</text>`;

    // X-axis label spacing
    const showEvery = n > 15 ? Math.ceil(n / 7) : 1;

    const bars = data.map((d, i) => {
      const x0        = barX0(i);
      const x1        = barX1(i);
      const cx        = (x0 + x1) / 2;
      const isCurrent = d.isCurrent ?? (i === n - 1);
      const opacity   = isCurrent ? "0.9" : "0.55";
      const R         = bw >= 4 ? 1.5 : 0;

      let barRect = "";
      if (d.delta != null && d.delta > 0) {
        const totalPx = Math.max(2, Math.round((d.delta / niceMax) * CH));
        const topY    = toY(d.delta);
        const hasSolar = d.solarDelta != null && d.solarDelta > 0;
        if (hasSolar) {
          const solarPx = Math.min(totalPx, Math.round((d.solarDelta / d.delta) * totalPx));
          const gridPx  = totalPx - solarPx;
          barRect =
            (solarPx > 0 ? `<rect x="${x0}" y="${topY}"            width="${bw}" height="${solarPx}" fill="var(--evcc-green,#22c55e)"    opacity="${opacity}" rx="${R}"/>` : "") +
            (gridPx  > 0 ? `<rect x="${x0}" y="${topY + solarPx}"  width="${bw}" height="${gridPx}"  fill="var(--primary-color,#3b82f6)" opacity="${opacity}" rx="${R}"/>` : "");
        } else {
          barRect = `<rect x="${x0}" y="${topY}" width="${bw}" height="${totalPx}"
            fill="var(--primary-color,#3b82f6)" opacity="${opacity}" rx="${R}"/>`;
        }
      }

      const showLabel = (i % showEvery === 0) || i === n - 1;
      const labelSvg  = showLabel
        ? `<text x="${cx}" y="${H - MB + 12}" text-anchor="middle" font-size="6.5"
             fill="var(--secondary-text-color,#888)" opacity="${isCurrent ? "1" : "0.75"}">${d.labelStr}</text>`
        : "";

      const hitRect = `<rect class="evcc-bar" x="${x0}" y="${MT}" width="${bw}" height="${CH}"
        fill="transparent" style="cursor:pointer"
        data-label="${d.labelStr.replace(/"/g, "&quot;")}"
        data-total="${d.delta != null ? d.delta.toFixed(1) : ""}"
        data-solar="${d.solarDelta != null ? d.solarDelta.toFixed(1) : ""}"/>`;

      return `${barRect}${hitRect}${labelSvg}`;
    }).join("");

    return `<div class="evcc-chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
        ${grid}${kwhLbl}${bars}
      </svg>
      <div class="evcc-chart-tooltip" hidden></div>
    </div>`;
  },

  _renderStatsBlockEntities() {
    this._maybeRefreshStats();
    const { kwhId, solarId, priceId } = this._getStatEntityIds();

    const val = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const kwh   = val(kwhId);
    const solar = val(solarId);
    const price = val(priceId);

    const kpi = (v, label, fmt, color) => `
      <div class="stats-kpi">
        <div class="stats-kpi-val"${color ? ` style="color:${color}"` : ""}>${v !== null ? fmt(v) : "–"}</div>
        <div class="stats-kpi-lbl">${label}</div>
      </div>`;

    const kpis = [
      kpi(kwh,   this._t("statsTotalCharged"), v => `${Math.round(v)} kWh`, null),
      kpi(solar, this._t("statsSolarShare"),   v => `${Math.round(v)} %`,   solar > 0 ? "var(--evcc-green)" : null),
      kpi(price, this._t("statsAvgPrice"),     v => `${v.toFixed(2)} ${unitStr(this._hass, priceId)}`, null),
    ].join("");

    const { kwhId: chartKwhId } = this._getStatEntityIds("total");
    const period     = this._statsPeriod ?? "total";
    const chartData  = this._chartCache[period];
    const chartTitle = this._t({ "30d": "statsPeriod30d", "365d": "statsPeriod365d", "thisYear": "statsPeriodThisYear", "total": "statsPeriodTotal" }[period]);
    const chart = chartKwhId ? `
      <div class="stats-chart-section">
        <div class="stats-chart-title">${chartTitle}</div>
        ${chartData
          ? this._renderBarChart(chartData)
          : '<div class="stats-chart-loading">…</div>'}
      </div>` : "";

    const noDataHint = (!kwhId && !solarId && !priceId && this._statsPeriod !== "total")
      ? `<div class="stats-no-data">${this._t("statsNoData")} <a class="stats-no-data-link" href="https://github.com/mkshb/hass-evcc-card#enabling-stat-periods" target="_blank" rel="noopener">📖 ${this._t("statsNoDataLink")}</a></div>`
      : "";

    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const solarHint = (this._solarDataPoints != null && this._solarDataPoints < 3)
      ? `<div class="stats-solar-hint">${this._t("solarHint", { n: this._solarDataPoints })}</div>`
      : "";

    return `
      <div>
        <div class="lp-header">
          <span class="lp-name">${this._config.title || this._t("statistics")}</span>
        </div>
        ${this._renderStatsPeriodTabs()}
        ${noDataHint}
        <div class="stats-kpi-row">${kpis}</div>
        ${chart}
        ${solarHint}
      </div>`;
  },
};
