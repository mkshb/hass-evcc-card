import { stateVal, unitStr } from "../utils/state.js";
import { evccDate } from "../utils/format.js";
import { normalizeStatsPeriod, legacyStatsPeriod } from "../core/constants.js";
import { escHtml } from "../utils/html.js";

// Statistics from evcc_intg/sessions (EVCC-style header, stacked chart) plus the stats dispatchers. Methods are mixed into EvccCard.prototype.
export const statisticsView = {
  // ---- Sessions-based statistics (ha-evcc evcc_intg/sessions) -------------
  // The raw session list lets the card compute every period + KPI itself, so
  // the stats mode no longer depends on user-configured stat_* template sensors
  // or HA-Recorder delta reconstruction. Gated on _hasCmd("sessions"); older
  // integrations keep the entity/Recorder path below.

  _sessionDate(s) {
    const raw = s?.created || s?.finished;
    if (!raw) return null;
    return evccDate(raw);
  },

  // The locale of the chart labels: the configured language, else the one from
  // HA, else English, the reference locale, like every other text of the card.
  _statsLang() { return (this._config?.language || this._hass?.language || "en").split("-")[0]; },

  // Earliest/latest session date — bounds the month/year stepper.
  _sessionRange(sessions) {
    let min = null, max = null;
    for (const s of sessions) {
      const d = this._sessionDate(s);
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    return { min, max };
  },

  // Scope = the active stats window: month / year / total.
  _sessionInScope(d, scope) {
    if (scope.kind === "month") return d.getFullYear() === scope.year && d.getMonth() === scope.month;
    if (scope.kind === "year")  return d.getFullYear() === scope.year;
    return true; // total
  },

  _scopeKey(scope) {
    return scope.kind === "month" ? `m${scope.year}-${scope.month}`
         : scope.kind === "year"  ? `y${scope.year}` : "total";
  },

  // Active scope for the stats block, from the scope tab + stepper selection
  // (lazily defaulting to the most recent month/year present in the data).
  _statsScopeObj(sessions) {
    const tab = this._statsScope ?? "month";
    if (tab === "total") return { kind: "total" };
    const ref = this._sessionRange(sessions).max ?? new Date();
    if (this._statsYearSel  == null) this._statsYearSel  = ref.getFullYear();
    if (this._statsMonthSel == null) this._statsMonthSel = ref.getMonth();   // 0-based month index
    if (tab === "year") return { kind: "year", year: this._statsYearSel };
    return { kind: "month", year: this._statsYearSel, month: this._statsMonthSel };
  },

  // Footer scope (compact, no stepper): current month / current year / all.
  _footerScope() {
    const p = normalizeStatsPeriod(this._config.stats_period, "total");
    const now = new Date();
    if (p === "month") return { kind: "month", year: now.getFullYear(), month: now.getMonth() };
    if (p === "year")  return { kind: "year",  year: now.getFullYear() };
    return { kind: "total" };
  },

  // Currency symbol for session price values (the sessions response carries none).
  _statsCurrency() {
    const c = this._wsCache["forecast:grid"]?.result?.data?.currency
           ?? this._wsCache["forecast:planner"]?.result?.data?.currency;
    if (c) return c;
    const { priceId } = this._getStatEntityIds("total");
    const u = priceId ? unitStr(this._hass, priceId) : "";
    return u ? u.replace(/\s*\/\s*kwh$/i, "") : "";
  },

  // --- metric + grouping for the EVCC-style stacked chart ------------------
  // Per-session value for the selected metric: energy (kWh) | cost (currency) | co2 (kg).
  _metricVal(s, metric) {
    const e = Number(s.chargedEnergy);
    if (metric === "cost") { const p = Number(s.price); return isFinite(p) ? p : null; }
    if (metric === "co2")  { const c = Number(s.co2PerKWh); return (isFinite(e) && isFinite(c)) ? e * c / 1000 : null; }
    return isFinite(e) ? e : null;
  },

  _metricFmt(metric, currency) {
    if (metric === "cost") return { unit: escHtml(currency || ""), axis: escHtml(currency || ""), fmt: v => v.toFixed(2) };
    if (metric === "co2")  return { unit: "kg", axis: "kg", fmt: v => v >= 10 ? String(Math.round(v)) : v.toFixed(2) };
    return { unit: "kWh", axis: "kWh", fmt: v => v >= 100 ? String(Math.round(v)) : v.toFixed(1) };
  },

  // X-axis skeleton for the scope: bucket key per date + ordered bucket descriptors.
  _scopeAxis(scope, sessions) {
    const lang = this._statsLang(), now = new Date();
    if (scope.kind === "month") {
      const days = new Date(scope.year, scope.month + 1, 0).getDate();
      const buckets = [];
      for (let day = 1; day <= days; day++) {
        const date = new Date(scope.year, scope.month, day);
        buckets.push({ key: day,
          labelStr:  date.toLocaleDateString(lang, { day: "numeric" }),
          labelFull: date.toLocaleDateString(lang, { day: "numeric", month: "short" }),
          isCurrent: scope.year === now.getFullYear() && scope.month === now.getMonth() && day === now.getDate() });
      }
      return { keyOf: d => (d.getFullYear() === scope.year && d.getMonth() === scope.month) ? d.getDate() : null, buckets };
    }
    if (scope.kind === "year") {
      const last = scope.year === now.getFullYear() ? now.getMonth() : 11;
      const buckets = [];
      for (let m = 0; m <= last; m++) {
        const date = new Date(scope.year, m, 1);
        buckets.push({ key: m,
          labelStr:  date.toLocaleDateString(lang, { month: "short" }),
          labelFull: date.toLocaleDateString(lang, { month: "long", year: "numeric" }),
          isCurrent: scope.year === now.getFullYear() && m === now.getMonth() });
      }
      return { keyOf: d => d.getFullYear() === scope.year ? d.getMonth() : null, buckets };
    }
    // total: yearly; if ≤1 year of data, fall back to that year's months
    const years = [...new Set(sessions.map(s => { const d = this._sessionDate(s); return d ? d.getFullYear() : null; }).filter(v => v != null))].sort((a, b) => a - b);
    if (years.length <= 1) return this._scopeAxis({ kind: "year", year: years.length ? years[0] : now.getFullYear() }, sessions);
    const buckets = years.map(y => ({ key: y, labelStr: String(y), labelFull: String(y), isCurrent: y === now.getFullYear() }));
    return { keyOf: d => d.getFullYear(), buckets };
  },

  // Ordered series for the grouping. solar → [solar, grid]; loadpoint/vehicle → distinct (energy desc).
  _groupSeries(scope, sessions, grouping) {
    if (grouping === "solar") return [
      { key: "__solar", label: this._t("statsGroupSolar"), color: "var(--evcc-green,#22c55e)" },
      { key: "__grid",  label: this._t("grid"),            color: "var(--primary-color,#3b82f6)" },
    ];
    const pal = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
    const field = grouping === "loadpoint" ? "loadpoint" : "vehicle";
    const totals = {};
    for (const s of sessions) {
      const d = this._sessionDate(s); if (!d || !this._sessionInScope(d, scope)) continue;
      const n = s[field] || "—";
      totals[n] = (totals[n] || 0) + (Number(s.chargedEnergy) || 0);
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([n], i) => ({ key: n, label: n, color: pal[i % pal.length] }));
  },

  // Stacked buckets: each bucket gets seg{seriesKey:value} + total for the chosen metric.
  _sessionStacks(sessions, scope, metric, grouping, series) {
    const axis = this._scopeAxis(scope, sessions);
    const pos = {}; axis.buckets.forEach((b, i) => { pos[b.key] = i; b.seg = {}; b.total = 0; });
    const known = new Set(series.map(s => s.key));
    const field = grouping === "loadpoint" ? "loadpoint" : "vehicle";
    for (const s of sessions) {
      const d = this._sessionDate(s); if (!d) continue;
      const bk = axis.keyOf(d); if (bk == null || !(bk in pos)) continue;
      const v = this._metricVal(s, metric); if (v == null) continue;
      const b = axis.buckets[pos[bk]];
      if (grouping === "solar") {
        if (metric === "energy") {
          const sp = Number(s.solarPercentage);
          const frac = isFinite(sp) ? Math.max(0, Math.min(100, sp)) / 100 : 0;
          b.seg.__solar = (b.seg.__solar || 0) + v * frac;
          b.seg.__grid  = (b.seg.__grid  || 0) + v * (1 - frac);
        } else {
          // cost/CO₂: solar self-consumption carries ~no marginal cost/emissions → attribute to grid.
          b.seg.__grid = (b.seg.__grid || 0) + v;
        }
      } else {
        const key = s[field] || "—";
        if (!known.has(key)) continue;
        b.seg[key] = (b.seg[key] || 0) + v;
      }
      b.total += v;
    }
    return axis.buckets;
  },

  _computeSessionStats(sessions, scope) {
    let kwh = 0, solarKwh = 0, cost = 0, co2wSum = 0, co2w = 0;
    let hasSolar = false, hasPrice = false, hasCo2 = false, count = 0;
    for (const s of sessions) {
      const d = this._sessionDate(s);
      if (!d || !this._sessionInScope(d, scope)) continue;
      const e = Number(s.chargedEnergy) || 0;
      kwh += e; count++;
      const sp = Number(s.solarPercentage);
      if (isFinite(sp)) { solarKwh += e * Math.max(0, Math.min(100, sp)) / 100; hasSolar = true; }
      const p = Number(s.price);
      if (isFinite(p)) { cost += p; hasPrice = true; }
      const c = Number(s.co2PerKWh);
      if (isFinite(c)) { co2wSum += e * c; co2w += e; hasCo2 = true; }
    }

    return {
      kwh,
      solarPct:  (hasSolar && kwh > 0) ? solarKwh / kwh * 100 : null,
      avgPrice:  (hasPrice && kwh > 0) ? cost / kwh : null,
      totalCost: hasPrice ? cost : null,
      avgCo2:    (hasCo2 && co2w > 0) ? co2wSum / co2w : null,
      count, hasSolar, hasPrice, hasCo2,
    };
  },

  // KPI memo per (sessions cache timestamp, scope); the footer reuses this.
  _sessionStats(sessions, scope) {
    const ts = this._wsCache["sessions::"]?.ts ?? 0;
    const key = this._scopeKey(scope);
    if (!this._sessionStatsMemo || this._sessionStatsMemo.ts !== ts) this._sessionStatsMemo = { ts, byKey: {} };
    if (!this._sessionStatsMemo.byKey[key]) this._sessionStatsMemo.byKey[key] = this._computeSessionStats(sessions, scope);
    return this._sessionStatsMemo.byKey[key];
  },

  // Metric toggle (Energie / Kosten / CO₂) — selects what the bars represent.
  _renderStatsMetricTabs() {
    const cur = this._statsMetric ?? "energy";
    const defs = [
      { key: "energy", tKey: "statsMetricEnergy" },
      { key: "cost",   tKey: "statsMetricCost"   },
      { key: "co2",    tKey: "statsMetricCo2"    },
    ];
    const btns = defs.map(d => `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-metric="${d.key}">${this._t(d.tKey)}</button>`).join("");
    return `<div class="stats-period-tabs stats-period-tabs--small">${btns}</div>`;
  },

  // Grouping toggle (Sonne / Ladepunkt / Fahrzeug) — selects how bars are stacked.
  _renderStatsGroupTabs() {
    const cur = this._statsGroup ?? "solar";
    const defs = [
      { key: "solar",     tKey: "statsGroupSolar"     },
      { key: "loadpoint", tKey: "statsGroupLoadpoint" },
      { key: "vehicle",   tKey: "statsGroupVehicle"   },
    ];
    const btns = defs.map(d => `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-group="${d.key}">${this._t(d.tKey)}</button>`).join("");
    return `<div class="stats-period-tabs stats-period-tabs--small">${btns}</div>`;
  },

  // Scope tabs (Month / Year / Total) for the sessions stats path. Reuses the
  // .stats-period-tab styling but carries data-scope (handled separately from the
  // legacy entity-path data-period tabs).
  _renderStatsScopeTabs() {
    const cur = this._statsScope ?? "month";
    const defs = [
      { key: "month", tKey: "statsPeriodMonth" },
      { key: "year",  tKey: "statsPeriodYear"  },
      { key: "total", tKey: "statsPeriodTotal" },
    ];
    const btns = defs.map(d =>
      `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-scope="${d.key}">${this._t(d.tKey)}</button>`
    ).join("");
    return `<div class="stats-period-tabs">${btns}</div>`;
  },

  // Two independent steppers like EVCC: a month stepper (month scope only, wraps
  // freely) and a year stepper (month + year scope, bounded to the data range).
  // Steppers live on their OWN full-width line (CSS flex-basis:100%), right-aligned,
  // always reserved (even in 'total') so switching Month/Year/Total never reflows
  // the controls. The year stepper stays anchored right; month appears to its left
  // only in month scope. Fixed label widths stop the year from shifting.
  _renderStatsSteppers(sessions, scope) {
    const lang = this._statsLang();
    const now = new Date();
    const { min, max } = this._sessionRange(sessions);
    const y = scope.year ?? (max ? max.getFullYear() : now.getFullYear());
    const minY = min ? min.getFullYear() : y;
    const maxY = max ? max.getFullYear() : y;
    const one = (group, label, atStart, atEnd) => `
      <div class="stats-stepper">
        <button class="stats-step-btn" data-stats-step="prev" data-stats-unit="${group}" ${atStart ? "disabled" : ""} aria-label="prev">‹</button>
        <span class="stats-step-label stats-step-label--${group}">${label}</span>
        <button class="stats-step-btn" data-stats-step="next" data-stats-unit="${group}" ${atEnd ? "disabled" : ""} aria-label="next">›</button>
      </div>`;
    let inner = "";
    if (scope.kind !== "total") {
      const monthLbl = new Date(y, scope.kind === "month" ? scope.month : 0, 1).toLocaleDateString(lang, { month: "long" });
      const month = scope.kind === "month" ? one("month", monthLbl, false, false) : "";
      inner = month + one("year", String(y), y <= minY, y >= maxY);
    }
    return `<div class="stats-steppers">${inner}</div>`;
  },

  // EVCC-style stacked multi-series bar chart for the sessions stats. `series` is
  // an ordered [{key,label,color}]; each bucket carries seg{key:value} + total.
  // Stashes the data on the instance so the tooltip handler can look it up by index.
  _renderSessionChart(buckets, series, metric, currency) {
    this._statsChartData = { buckets, series, metric, currency };
    const mf = this._metricFmt(metric, currency);
    const ML = 22, MR = 6, MT = 20, MB = 18, W = 280, H = 110, CW = W - ML - MR, CH = H - MT - MB;
    const n = buckets.length || 1;
    const GAP = n > 20 ? 1 : 2;
    const bw = Math.max(1, Math.floor((CW - GAP * (n - 1)) / n));
    const offset = Math.round((CW - (bw * n + GAP * (n - 1))) / 2);
    const barX0 = i => ML + offset + i * (bw + GAP);
    const maxVal = Math.max(...buckets.map(b => b.total || 0), 0.1);
    const rawStep = maxVal / 5, stepExp = Math.floor(Math.log10(Math.max(rawStep, 0.001))), stepBase = Math.pow(10, stepExp), stepF = rawStep / stepBase;
    const tickStep = (stepF <= 1 ? 1 : stepF <= 2 ? 2 : stepF <= 5 ? 5 : 10) * stepBase;
    const numTicks = Math.ceil(maxVal / tickStep), niceMax = tickStep * numTicks;
    const toY = v => MT + CH - Math.round((v / niceMax) * CH);
    const grid = Array.from({ length: numTicks + 1 }, (_, i) => {
      const val = i * tickStep, y = toY(val), lbl = tickStep >= 1 ? Math.round(val) : val.toFixed(1);
      return `<line x1="${ML}" y1="${y}" x2="${W - MR}" y2="${y}" stroke="var(--divider-color,#374151)" stroke-width="${i === 0 ? 1 : 0.5}" opacity="${i === 0 ? 0.9 : 0.35}"/>`
           + `<text x="${ML - 3}" y="${y + 3}" text-anchor="end" font-size="6.5" fill="var(--secondary-text-color,#888)">${lbl}</text>`;
    }).join("");
    const axisLbl = `<text x="${ML - 3}" y="${MT - 8}" text-anchor="end" font-size="6.5" fill="var(--secondary-text-color,#888)">${mf.axis}</text>`;
    const showEvery = n > 15 ? Math.ceil(n / 7) : 1;
    const bars = buckets.map((b, i) => {
      const x0 = barX0(i), cx = x0 + bw / 2;
      const op = b.isCurrent ? "0.95" : "0.6";
      let bottom = toY(0), segs = "";
      for (const s of series) {
        const val = b.seg[s.key] || 0; if (val <= 0) continue;
        const h = Math.round((val / niceMax) * CH); if (h <= 0) continue;
        const y = bottom - h;
        segs += `<rect x="${x0}" y="${y}" width="${bw}" height="${h}" fill="${s.color}" opacity="${op}"/>`;
        bottom = y;
      }
      const showLabel = (i % showEvery === 0) || i === n - 1;
      const labelSvg = showLabel ? `<text x="${cx}" y="${H - MB + 12}" text-anchor="middle" font-size="6.5" fill="var(--secondary-text-color,#888)" opacity="${b.isCurrent ? "1" : "0.75"}">${b.labelStr}</text>` : "";
      const hit = `<rect class="evcc-bar" data-idx="${i}" x="${x0}" y="${MT}" width="${bw}" height="${CH}" fill="transparent" style="cursor:pointer"/>`;
      return segs + hit + labelSvg;
    }).join("");
    const legend = `<div class="stats-legend">${series.map(s => `<span class="sl-item"><span class="sl-dot" style="background:${s.color}"></span>${escHtml(s.label)}</span>`).join("")}</div>`;
    return `<div class="evcc-chart-wrap"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${grid}${axisLbl}${bars}</svg><div class="evcc-chart-tooltip" data-morph-keep hidden></div></div>${legend}`;
  },

  _renderStatsBlockSessions(sessions) {
    const scope   = this._statsScopeObj(sessions);
    const metric  = this._statsMetric ?? "energy";
    const grouping = this._statsGroup ?? "solar";
    const cur     = this._statsCurrency();
    const k       = this._sessionStats(sessions, scope);

    // KPI tiles (period summary, independent of the selected metric).
    const kpi = (v, label, fmt, color) => `
      <div class="stats-kpi">
        <div class="stats-kpi-val"${color ? ` style="color:${color}"` : ""}>${v != null ? fmt(v) : "–"}</div>
        <div class="stats-kpi-lbl">${label}</div>
      </div>`;
    const kpis = [ kpi(k.kwh, this._t("statsTotalCharged"), v => `${Math.round(v)} kWh`, null) ];
    if (k.hasSolar) kpis.push(kpi(k.solarPct, this._t("statsSolarShare"), v => `${Math.round(v)} %`, k.solarPct > 0 ? "var(--evcc-green)" : null));
    if (k.hasPrice) kpis.push(kpi(k.totalCost, this._t("statsTotalCost"), v => `${v.toFixed(2)} ${escHtml(cur)}`, null));
    if (k.hasCo2)   kpis.push(kpi(k.avgCo2, this._t("statsAvgCo2"), v => `${v >= 10 ? Math.round(v) : v.toFixed(1)} g/kWh`, null));

    // Stacked chart for the selected metric × grouping.
    const series = this._groupSeries(scope, sessions, grouping);
    const buckets = this._sessionStacks(sessions, scope, metric, grouping, series);
    const hasBars = buckets.some(b => (b.total || 0) > 0);
    const chartHtml = `
      <div class="stats-chart-section">
        ${hasBars ? this._renderSessionChart(buckets, series, metric, cur) : `<div class="stats-chart-loading">${this._t("statsNoSessions")}</div>`}
      </div>`;

    return `
      <div>
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("statistics"))}</span>
        </div>
        <div class="stats-controls">
          ${this._renderStatsScopeTabs()}
          ${this._renderStatsSteppers(sessions, scope)}
        </div>
        <div class="stats-controls">
          ${this._renderStatsMetricTabs()}
          ${this._renderStatsGroupTabs()}
        </div>
        <div class="stats-kpi-row">${kpis.join("")}</div>
        ${chartHtml}
      </div>`;
  },

  _renderStatsFooterSessions(sessions) {
    const scope = this._footerScope();
    const k = this._sessionStats(sessions, scope);
    const cur = this._statsCurrency();
    const labelKey = scope.kind === "month" ? "statsPeriodMonth" : scope.kind === "year" ? "statsPeriodYear" : "statsPeriodTotal";
    const periodLabel = this._t(labelKey);
    const items = [
      `<span class="sf-item"><span class="sf-val">${Math.round(k.kwh)} kWh</span><span class="sf-lbl">${this._t("statsCharged")}</span></span>`,
      k.hasSolar ? `<span class="sf-item"><span class="sf-val" style="color:var(--evcc-green)">${Math.round(k.solarPct)} %</span><span class="sf-lbl">${this._t("statsSolarShare")}</span></span>` : "",
      k.hasPrice ? `<span class="sf-item"><span class="sf-val">${k.avgPrice.toFixed(2)} ${escHtml(cur)}/kWh</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
    ].filter(Boolean);
    if (k.kwh <= 0) return "";
    return `<div class="stats-footer"><div class="sf-period">${periodLabel}</div><div class="sf-items">${items.join('<span class="sf-sep"></span>')}</div></div>`;
  },

  _renderStatsFooter() {
    if (normalizeStatsPeriod(this._config.stats_period, "total") === "none") return "";
    if (this._hasCmd("sessions")) {
      const res = this._wsSessions();
      if (res && res.data && Array.isArray(res.data.sessions)) {
        return this._renderStatsFooterSessions(res.data.sessions);
      }
      // pending/error → fall through to the entity path below
    }
    // The legacy path has periods of its own, so the configured value is mapped
    // onto them here. Not via this._statsPeriod: that one follows the period
    // tabs of the stats mode, the footer stays on what the config asked for.
    const period = legacyStatsPeriod(this._config.stats_period, "total");
    const { kwhId, solarId, priceId } = this._getStatEntityIds(period);
    if (!kwhId && !solarId && !priceId) return "";

    const val = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const kwh   = val(kwhId);
    const solar = val(solarId);
    const price = val(priceId);

    const periodTKey = { "30d": "statsPeriod30d", "365d": "statsPeriod365d", "thisYear": "statsPeriodThisYear", "total": "statsPeriodTotal" }[period] ?? "statsPeriodTotal";
    const periodLabel = this._t(periodTKey);

    const items = [
      kwhId   ? `<span class="sf-item"><span class="sf-val">${Math.round(kwh)} kWh</span><span class="sf-lbl">${this._t("statsCharged")}</span></span>` : "",
      solarId ? `<span class="sf-item"><span class="sf-val" style="color:var(--evcc-green)">${Math.round(solar)} %</span><span class="sf-lbl">${this._t("statsSolarShare")}</span></span>` : "",
      priceId ? `<span class="sf-item"><span class="sf-val">${price.toFixed(2)} ${escHtml(unitStr(this._hass, priceId))}</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
    ].filter(Boolean);

    if (items.length === 0) return "";
    return `<div class="stats-footer"><div class="sf-period">${periodLabel}</div><div class="sf-items">${items.join('<span class="sf-sep"></span>')}</div></div>`;
  },

  _renderStatsBlock() {
    // Sessions-first: when ha-evcc exposes the sessions command, compute the
    // stats entirely from the raw session list (no stat_* sensors, no Recorder).
    // Fall back to the entity/Recorder path for older integrations or while the
    // first session fetch is still in flight.
    if (this._hasCmd("sessions")) {
      const res = this._wsSessions();
      if (res && res.data && Array.isArray(res.data.sessions)) {
        return this._renderStatsBlockSessions(res.data.sessions);
      }
      if (!res) {
        return `
          <div>
            <div class="lp-header"><span class="lp-name">${escHtml(this._config.title || this._t("statistics"))}</span></div>
            ${this._renderStatsScopeTabs()}
            <div class="stats-chart-loading">…</div>
          </div>`;
      }
      // res.error → fall through to the entity path
    }
    return this._renderStatsBlockEntities();
  },

  // Listeners of both statistics paths: the period, scope, metric and group
  // tabs, the month and year steppers and the chart tooltip. Called by
  // _attachListeners() after every render.
  _attachStatsListeners() {
    this._fresh("button.stats-period-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        // Sessions path: data-scope/-metric/-group. Legacy entity path: data-period.
        if      (btn.dataset.scope)  this._statsScope  = btn.dataset.scope;
        else if (btn.dataset.metric) this._statsMetric = btn.dataset.metric;
        else if (btn.dataset.group)  this._statsGroup  = btn.dataset.group;
        else                         this._statsPeriod = btn.dataset.period;
        this._render();
      });
    });

    // Two independent steppers: month (wraps 0-11) and year (sessions stats path).
    this._fresh("button[data-stats-step]").forEach(btn => {
      btn.addEventListener("click", () => {
        const dir = btn.dataset.statsStep === "next" ? 1 : -1;
        const now = new Date();
        if (btn.dataset.statsUnit === "year") {
          this._statsYearSel = (this._statsYearSel ?? now.getFullYear()) + dir;
        } else {
          const m = (this._statsMonthSel ?? now.getMonth()) + dir;
          this._statsMonthSel = (m + 12) % 12;
        }
        this._render();
      });
    });

    const chartWrap = this._fresh(".evcc-chart-wrap")[0];
    if (chartWrap) {
      const tooltip = chartWrap.querySelector(".evcc-chart-tooltip");
      const dot = (color) => `<span class="ectt-dot" style="background:${color}"></span>`;
      const barKey = (bar) => bar.dataset.idx != null ? "i" + bar.dataset.idx : (bar.dataset.label || "") + (bar.dataset.total || "");
      const positionTooltip = (bar) => {
        const barRect  = bar.getBoundingClientRect();
        const wrapRect = chartWrap.getBoundingClientRect();
        const rawLeft  = barRect.left - wrapRect.left + barRect.width / 2;
        tooltip.hidden = false;
        const ttW  = tooltip.getBoundingClientRect().width;
        const left = Math.min(wrapRect.width - ttW / 2 - 4, Math.max(ttW / 2 + 4, rawLeft));
        tooltip.style.left = `${left}px`;
      };
      const showTooltip = (bar) => {
        // Sessions stacked chart: look the bucket up by index.
        if (bar.dataset.idx != null && this._statsChartData) {
          const { buckets, series, metric, currency } = this._statsChartData;
          const b = buckets[+bar.dataset.idx];
          if (!b || !(b.total > 0)) { tooltip.hidden = true; return; }
          const mf = this._metricFmt(metric, currency);
          const rows = series.filter(s => (b.seg[s.key] || 0) > 0)
            .map(s => `<div class="ectt-row">${dot(s.color)}<span class="ectt-name">${escHtml(s.label)}</span><span class="ectt-val">${mf.fmt(b.seg[s.key])} ${mf.unit}</span></div>`).join("");
          tooltip.innerHTML = `<div class="ectt-header">${escHtml(b.labelFull || b.labelStr)}</div>${rows}<div class="ectt-summary">${mf.fmt(b.total)} ${mf.unit} ${this._t("total")}</div>`;
          positionTooltip(bar);
          tooltip.dataset.activeBar = barKey(bar);
          return;
        }
        // Legacy entity chart (solar/grid).
        const total = bar.dataset.total;
        if (!total) { tooltip.hidden = true; return; }
        const solar = bar.dataset.solar ? parseFloat(bar.dataset.solar) : null;
        const grid  = solar != null ? (parseFloat(total) - solar).toFixed(1) : null;
        const solarColor = getComputedStyle(chartWrap).getPropertyValue("--evcc-green").trim() || "#22c55e";
        const gridColor  = getComputedStyle(chartWrap).getPropertyValue("--primary-color").trim() || "#3b82f6";
        tooltip.innerHTML =
          `<div class="ectt-header">${escHtml(bar.dataset.label)}</div>` +
          (solar != null ? `<div class="ectt-row">${dot(solarColor)}<span class="ectt-name">${this._t("solar")}</span><span class="ectt-val">${bar.dataset.solar} kWh</span></div>` : "") +
          (grid  != null ? `<div class="ectt-row">${dot(gridColor)}<span class="ectt-name">${this._t("grid")}</span><span class="ectt-val">${grid} kWh</span></div>` : "") +
          `<div class="ectt-summary">${total} kWh ${this._t("total")}</div>`;
        positionTooltip(bar);
        tooltip.dataset.activeBar = barKey(bar);
      };
      chartWrap.addEventListener("mouseover", (e) => {
        const bar = e.target.closest(".evcc-bar");
        if (bar) showTooltip(bar);
      });
      chartWrap.addEventListener("mouseout", (e) => {
        if (e.target.closest(".evcc-bar")) tooltip.hidden = true;
      });
      chartWrap.addEventListener("click", (e) => {
        const bar = e.target.closest(".evcc-bar");
        if (bar) {
          const key = barKey(bar);
          if (!tooltip.hidden && tooltip.dataset.activeBar === key) {
            tooltip.hidden = true;
          } else {
            showTooltip(bar);
          }
        } else {
          tooltip.hidden = true;
        }
      });
    }
  },
};

// Both statistics paths: tabs, footer, KPI row, chart and tooltip.
// Part of the card stylesheet, see src/styles.js.
export const statsCss = `
      .stats-period-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
      .stats-period-tab {
        padding: 2px 10px; border-radius: 999px;
        border: 1px solid var(--divider-color, #e5e7eb);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s;
      }
      .stats-period-tab.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .stats-period-tabs--small .stats-period-tab { font-size: .65rem; padding: 1px 8px; }

      .stats-footer-wrap {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 8px;
      }
      .stats-footer-wrap .stats-footer { border-top: none; margin-top: 6px; padding-top: 0; }

      .stats-footer {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 10px;
      }
      .sf-period {
        font-size: .6rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700;
        color: var(--secondary-text-color); text-align: center; margin-bottom: 6px; opacity: 0.7;
      }
      .sf-items { display: flex; align-items: center; }
      .sf-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .sf-val  { font-size: .82rem; font-weight: 700; }
      .sf-lbl  { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .sf-sep  { width: 1px; height: 28px; background: var(--divider-color, #333); flex-shrink: 0; }

      .stats-no-data {
        font-size: .76rem; color: var(--warning-color, #f4b942);
        background: rgba(244,185,66,.08);
        border: 1px solid var(--warning-color, #f4b942);
        border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; line-height: 1.6;
      }
      .stats-no-data-link {
        display: inline-block; margin-top: 4px; color: var(--primary-color);
        text-decoration: none; font-weight: 600;
      }
      .stats-no-data-link:hover { text-decoration: underline; }

      .stats-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .stats-kpi {
        background: var(--secondary-background-color, rgba(255,255,255,.05));
        border-radius: 8px; padding: 10px 8px; text-align: center;
        display: flex; flex-direction: column; gap: 3px;
      }
      .stats-kpi-val { font-size: 1.1rem; font-weight: 800; line-height: 1; }
      .stats-kpi-lbl { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .stats-chart-section { margin-top: 4px; }
      .stats-stepper { display: flex; align-items: center; justify-content: center; }
      .stats-step-btn {
        border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: transparent;
        color: var(--primary-text-color); border-radius: 8px; width: 26px; height: 24px; line-height: 1;
        font-size: 1rem; cursor: pointer; padding: 0;
      }
      .stats-step-btn:hover:not([disabled]) { background: var(--secondary-background-color, rgba(127,127,127,0.12)); }
      .stats-step-btn[disabled] { opacity: 0.35; cursor: default; }
      .stats-stepper { gap: 4px; }
      .stats-step-label { text-align: center; font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; }
      .stats-step-label--month { width: 74px; }
      .stats-step-label--year { width: 42px; }
      .stats-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .stats-controls .stats-period-tabs { margin-bottom: 0; }
      .stats-steppers { flex: 0 0 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-height: 26px; }
      .stats-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; margin-top: 8px; font-size: 0.74rem; color: var(--secondary-text-color); }
      .sl-item { display: inline-flex; align-items: center; gap: 5px; }
      .sl-dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
      .evcc-chart-wrap { position: relative; margin-left: -16px; margin-right: 0; }
      .evcc-chart-tooltip {
        position: absolute; top: 0; transform: translateX(-50%);
        background: var(--ha-card-background, var(--card-background-color, #1f2937));
        border-radius: 8px; padding: 8px 12px;
        font-size: 12px; line-height: 1.6; white-space: nowrap;
        pointer-events: none; z-index: 10;
        box-shadow: 0 4px 16px rgba(0,0,0,.35);
      }
      .ectt-header { font-weight: 700; margin-bottom: 4px; }
      .ectt-row { display: flex; align-items: center; gap: 6px; }
      .ectt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .ectt-name { flex: 1; color: var(--primary-text-color); }
      .ectt-val { font-weight: 600; margin-left: 12px; }
      .ectt-summary { margin-top: 6px; padding-top: 5px; border-top: 1px solid var(--divider-color, #374151); font-weight: 700; }
      .stats-chart-title {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 8px;
      }
      .stats-chart-loading {
        height: 75px; display: flex; align-items: center; justify-content: center;
        color: var(--secondary-text-color); font-size: .75rem; opacity: .5;
      }
      .stats-solar-hint {
        font-size: .72rem; color: var(--secondary-text-color);
        margin-top: 10px; padding: 6px 10px;
        background: color-mix(in srgb, var(--evcc-green) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--evcc-green) 25%, transparent);
        border-radius: 6px; line-height: 1.4;
      }
`;
