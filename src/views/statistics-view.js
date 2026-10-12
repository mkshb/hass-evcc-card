import { stateVal, unitStr } from "../utils/state.js";
import { evccDate, fmtPrice, priceCurrency } from "../utils/format.js";
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

  // The average price per kWh of a statistics sensor, as evcc shows it (in
  // ct, the label says per kWh); a sensor without a currency unit as it is.
  _fmtAvgPrice(priceId, price) {
    const unit = unitStr(this._hass, priceId);
    const cur  = priceCurrency(unit);
    return cur === null ? `${price.toFixed(2)}${unit ? ` ${unit}` : ""}` : fmtPrice(price, cur, this._hass?.language, { unit: "short" });
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

  // --- chart metric and breakdown ------------------------------------------
  // A session field as a number; NaN where evcc reports none. Number(null) is
  // 0, which would count a session without a price as one that cost nothing.
  _sessionNum(v) { return v == null || v === "" ? NaN : Number(v); },

  // Share of a session's energy that came from the sun, 0 to 1.
  _solarFrac(s) {
    const sp = this._sessionNum(s.solarPercentage);
    return isFinite(sp) ? Math.max(0, Math.min(100, sp)) / 100 : 0;
  },

  // Per-session value for the selected metric: energy (kWh) | cost (currency) | co2 (kg).
  _metricVal(s, metric) {
    const e = this._sessionNum(s.chargedEnergy);
    if (metric === "cost") { const p = this._sessionNum(s.price); return isFinite(p) ? p : null; }
    if (metric === "co2")  { const c = this._sessionNum(s.co2PerKWh); return (isFinite(e) && isFinite(c)) ? e * c / 1000 : null; }
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
        buckets.push({ key: day, tick: (day - 1) % 7 === 0,
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
        buckets.push({ key: m, tick: true,
          labelStr:  date.toLocaleDateString(lang, { month: "short" }),
          labelFull: date.toLocaleDateString(lang, { month: "long", year: "numeric" }),
          isCurrent: scope.year === now.getFullYear() && m === now.getMonth() });
      }
      return { keyOf: d => d.getFullYear() === scope.year ? d.getMonth() : null, buckets };
    }
    // total: yearly; if ≤1 year of data, fall back to that year's months
    const years = [...new Set(sessions.map(s => { const d = this._sessionDate(s); return d ? d.getFullYear() : null; }).filter(v => v != null))].sort((a, b) => a - b);
    if (years.length <= 1) return this._scopeAxis({ kind: "year", year: years.length ? years[0] : now.getFullYear() }, sessions);
    const buckets = years.map(y => ({ key: y, tick: true, labelStr: String(y), labelFull: String(y), isCurrent: y === now.getFullYear() }));
    return { keyOf: d => d.getFullYear(), buckets };
  },

  // The bars of the chart for the metric: energy splits into solar and grid,
  // cost and CO₂ are one total each (the solar part carries next to none).
  // Each bucket gets seg{seriesKey: value} and total.
  _sessionBuckets(sessions, scope, metric) {
    const axis = this._scopeAxis(scope, sessions);
    const pos = {};
    axis.buckets.forEach((b, i) => { pos[b.key] = i; b.solar = 0; b.total = 0; });
    for (const s of sessions) {
      const d = this._sessionDate(s); if (!d) continue;
      const bk = axis.keyOf(d); if (bk == null || !(bk in pos)) continue;
      const v = this._metricVal(s, metric); if (v == null) continue;
      const b = axis.buckets[pos[bk]];
      if (metric === "energy") b.solar += v * this._solarFrac(s);
      b.total += v;
    }
    for (const b of axis.buckets) b.seg = metric === "energy" ? { solar: b.solar, grid: b.total - b.solar } : { total: b.total };
    return axis.buckets;
  },

  // The scope split by vehicle or charge point, the largest first.
  _sessionBreakdown(sessions, scope, field) {
    const rows = {};
    for (const s of sessions) {
      const d = this._sessionDate(s);
      if (!d || !this._sessionInScope(d, scope)) continue;
      const name = s[field] || "—";
      const r = rows[name] ??= { name, kwh: 0, solar: 0, cost: 0, hasPrice: false, count: 0 };
      const e = this._sessionNum(s.chargedEnergy) || 0;
      r.kwh += e; r.solar += e * this._solarFrac(s); r.count++;
      const p = this._sessionNum(s.price);
      if (isFinite(p)) { r.cost += p; r.hasPrice = true; }
    }
    return Object.values(rows).sort((a, b) => b.kwh - a.kwh);
  },

  _computeSessionStats(sessions, scope) {
    let kwh = 0, solarKwh = 0, cost = 0, co2wSum = 0, co2w = 0, saved = 0, seconds = 0;
    let hasSolar = false, hasPrice = false, hasCo2 = false, hasSaving = false, hasDuration = false, count = 0;
    const vehicles = new Set(), loadpoints = new Set();
    for (const s of sessions) {
      const d = this._sessionDate(s);
      if (!d || !this._sessionInScope(d, scope)) continue;
      const e = this._sessionNum(s.chargedEnergy) || 0;
      kwh += e; count++;
      vehicles.add(s.vehicle || "—"); loadpoints.add(s.loadpoint || "—");
      if (isFinite(this._sessionNum(s.solarPercentage))) { solarKwh += e * this._solarFrac(s); hasSolar = true; }
      const p = this._sessionNum(s.price);
      if (isFinite(p)) { cost += p; hasPrice = true; }
      // Saved: what the energy would have cost at the grid price evcc
      // compares against, minus what it cost. Sessions without that price
      // count with nothing.
      const ref = this._sessionNum(s.referencePricePerKWh);
      if (isFinite(p) && isFinite(ref) && ref > 0) { saved += e * ref - p; hasSaving = true; }
      const c = this._sessionNum(s.co2PerKWh);
      if (isFinite(c)) { co2wSum += e * c; co2w += e; hasCo2 = true; }
      // evcc reports the duration in nanoseconds.
      const ns = this._sessionNum(s.chargeDuration);
      if (isFinite(ns) && ns > 0) { seconds += ns / 1e9; hasDuration = true; }
    }

    return {
      kwh, solarKwh,
      solarPct:  (hasSolar && kwh > 0) ? solarKwh / kwh * 100 : null,
      avgPrice:  (hasPrice && kwh > 0) ? cost / kwh : null,
      totalCost: hasPrice ? cost : null,
      saved:     hasSaving ? saved : null,
      avgCo2:    (hasCo2 && co2w > 0) ? co2wSum / co2w : null,
      seconds:   hasDuration ? seconds : null,
      count, hasSolar, hasPrice, hasCo2, hasSaving,
      vehicles: vehicles.size, loadpoints: loadpoints.size,
    };
  },

  // The session names of the loadpoints the config leaves out of the
  // statistics (stats_exclude_loadpoints, a heat pump for instance): each
  // configured loadpoint by its evcc title, as the sessions name it, and by
  // what was configured, both compared without case. Null for none.
  _statsExcluded() {
    const list = this._config?.stats_exclude_loadpoints;
    if (!Array.isArray(list) || !list.length) return null;
    const lps = this._cachedEntities?.loadpoints ?? {};
    const names = new Set();
    for (const lp of list) {
      names.add(String(lp).toLowerCase());
      if (lps[lp]) names.add(String(this._loadpointTitle(lp, lps[lp])).toLowerCase());
    }
    return names;
  },

  _statsExcludedKey() { return [...(this._statsExcluded() ?? [])].sort().join("|"); },

  // The sessions the statistics count: all but those of excluded loadpoints.
  // Memoised per session list and exclusion, so the KPI memo below and the
  // chart see the same array on every render.
  _statsSessions(sessions) {
    const ex = this._statsExcluded();
    if (!ex) return sessions;
    const key = this._statsExcludedKey();
    const m = this._statsSessionsMemo;
    if (m && m.src === sessions && m.key === key) return m.out;
    const out = sessions.filter(s => !ex.has(String(s.loadpoint ?? "").toLowerCase()));
    this._statsSessionsMemo = { src: sessions, key, out };
    return out;
  },

  // KPI memo per (sessions cache timestamp, exclusion, scope); the footer reuses this.
  _sessionStats(sessions, scope) {
    const ts = this._wsCache["sessions::"]?.ts ?? 0;
    const ex = this._statsExcludedKey();
    const key = this._scopeKey(scope);
    if (!this._sessionStatsMemo || this._sessionStatsMemo.ts !== ts || this._sessionStatsMemo.ex !== ex) this._sessionStatsMemo = { ts, ex, byKey: {} };
    if (!this._sessionStatsMemo.byKey[key]) this._sessionStatsMemo.byKey[key] = this._computeSessionStats(sessions, scope);
    return this._sessionStatsMemo.byKey[key];
  },

  // Small pill tabs in a section head. `attr` names the data attribute the
  // listener reads; a single option needs no switch and renders nothing.
  _renderStatsTabs(attr, cur, defs) {
    if (defs.length < 2) return "";
    const btns = defs.map(d => `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-${attr}="${d.key}">${this._t(d.tKey)}</button>`).join("");
    return `<div class="stats-period-tabs stats-period-tabs--small">${btns}</div>`;
  },

  // Scope tabs (Month / Year / Total) as one segmented control. Reuses the
  // .stats-period-tab class but carries data-scope (handled separately from
  // the legacy entity-path data-period tabs).
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
    return `<div class="stats-scope">${btns}</div>`;
  },

  // One stepper for the selected period: "September 2026" in the month
  // scope, "2026" in the year scope, none for the total. It runs from the
  // first session to the later of the last session and today.
  _renderStatsStepper(sessions, scope) {
    if (scope.kind === "total") return "";
    const lang = this._statsLang();
    const now = new Date();
    const { min, max } = this._sessionRange(sessions);
    const hi = max && max > now ? max : now;
    const lo = min ?? hi;
    const idx = (y, m) => y * 12 + m;
    let label, atStart, atEnd;
    if (scope.kind === "month") {
      label   = new Date(scope.year, scope.month, 1).toLocaleDateString(lang, { month: "long", year: "numeric" });
      atStart = idx(scope.year, scope.month) <= idx(lo.getFullYear(), lo.getMonth());
      atEnd   = idx(scope.year, scope.month) >= idx(hi.getFullYear(), hi.getMonth());
    } else {
      label   = String(scope.year);
      atStart = scope.year <= lo.getFullYear();
      atEnd   = scope.year >= hi.getFullYear();
    }
    return `
      <div class="stats-stepper">
        <button class="stats-step-btn" data-stats-step="prev" ${atStart ? "disabled" : ""} aria-label="${this._t("statsPrev")}">‹</button>
        <span class="stats-step-label">${escHtml(label)}</span>
        <button class="stats-step-btn" data-stats-step="next" ${atEnd ? "disabled" : ""} aria-label="${this._t("statsNext")}">›</button>
      </div>`;
  },

  // Bar chart of the sessions in the axis style of the battery chart: energy
  // stacked into solar and grid, cost and CO₂ as one bar. Stashes the data on
  // the instance so the tooltip handler can look a bar up by index.
  _renderSessionChart(buckets, metric, currency) {
    const series = metric === "energy"
      ? [{ key: "solar", label: this._t("statsGroupSolar"), color: "var(--evcc-green)" },
         { key: "grid",  label: this._t("grid"),            color: "var(--primary-color)" }]
      : [{ key: "total", label: this._t(metric === "cost" ? "statsMetricCost" : "statsMetricCo2"), color: "var(--primary-color)" }];
    this._statsChartData = { buckets, series, metric, currency };
    const mf = this._metricFmt(metric, currency);
    const W = 400, H = 120, ML = 26, MR = 4, MT = 12, MB = 18, CW = W - ML - MR, CH = H - MT - MB;
    const n = buckets.length || 1;
    const slot = CW / n, gap = Math.min(4, slot * 0.25), bw = slot - gap;
    const maxVal = Math.max(...buckets.map(b => b.total || 0), 0.1);
    const rawStep = maxVal / 3, stepBase = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 0.001)))), stepF = rawStep / stepBase;
    const tickStep = (stepF <= 1 ? 1 : stepF <= 2 ? 2 : stepF <= 5 ? 5 : 10) * stepBase;
    const numTicks = Math.ceil(maxVal / tickStep), niceMax = tickStep * numTicks;
    const y = v => MT + CH - v / niceMax * CH;
    const txt = (x, yy, anchor, s) => `<text x="${x}" y="${yy}" text-anchor="${anchor}" font-size="7" fill="var(--secondary-text-color,#888)">${s}</text>`;
    let grid = "";
    for (let i = 0; i <= numTicks; i++) {
      const val = i * tickStep;
      grid += `<line x1="${ML}" x2="${W - MR}" y1="${y(val)}" y2="${y(val)}" stroke="var(--divider-color,#444)" stroke-width="0.5"/>`
            + txt(ML - 4, y(val) + 3, "end", tickStep >= 1 ? Math.round(val) : val.toFixed(1));
    }
    grid += txt(ML - 4, MT - 5, "end", mf.axis);
    const bars = buckets.map((b, i) => {
      const x0 = ML + i * slot + gap / 2, cx = x0 + bw / 2;
      let acc = 0, bottom = y(0), segs = "";
      for (const s of series) {
        const val = b.seg[s.key] || 0; if (val <= 0) continue;
        acc += val;
        const top = y(acc);
        segs += `<rect x="${x0.toFixed(1)}" y="${top.toFixed(1)}" width="${bw.toFixed(1)}" height="${(bottom - top).toFixed(1)}" fill="${s.color}"/>`;
        bottom = top;
      }
      const label = b.tick ? txt(cx.toFixed(1), H - 6, "middle", b.labelStr) : "";
      const hit = `<rect class="evcc-bar" data-idx="${i}" x="${(ML + i * slot).toFixed(1)}" y="${MT}" width="${slot.toFixed(1)}" height="${CH}" fill="transparent"/>`;
      return segs + hit + label;
    }).join("");
    const legend = series.length > 1
      ? `<div class="stats-legend">${series.map(s => `<span class="sl-item"><span class="sl-dot" style="background:${s.color}"></span>${escHtml(s.label)}</span>`).join("")}</div>`
      : "";
    return `<div class="evcc-chart-wrap"><svg viewBox="0 0 ${W} ${H}" class="stats-chart-svg" role="img">${grid}${bars}</svg><div class="evcc-chart-tooltip" data-morph-keep hidden></div></div>${legend}`;
  },

  // The scope by vehicle or charge point: one row each with a bar split into
  // solar and grid, scaled to the largest row. Only where there is more than
  // one of them; the switch only where both have more than one.
  _renderStatsBreakdown(sessions, scope, k, cur) {
    const opts = [
      { key: "vehicle",   tKey: "statsGroupVehicle",   title: "statsByVehicle",   n: k.vehicles },
      { key: "loadpoint", tKey: "statsGroupLoadpoint", title: "statsByLoadpoint", n: k.loadpoints },
    ].filter(o => o.n > 1);
    if (!opts.length) return "";
    const sel = opts.find(o => o.key === this._statsGroup) ?? opts[0];
    const rows = this._sessionBreakdown(sessions, scope, sel.key);
    const max = Math.max(...rows.map(r => r.kwh), 0.1);
    const pct = v => `${(v / max * 100).toFixed(1)}%`;
    const kwh = v => `${v >= 100 ? Math.round(v) : v.toFixed(1)} kWh`;
    const body = rows.map(r => {
      const meta = [this._t("statsSessionCount", { n: r.count }), r.hasPrice ? `${r.cost.toFixed(2)} ${escHtml(cur)}`.trim() : ""].filter(Boolean).join(" · ");
      return `
        <div class="stats-group-row">
          <div class="stats-group-top">
            <span class="stats-group-name">${escHtml(r.name)}</span>
            <span class="stats-group-val">${kwh(r.kwh)} <span class="stats-group-meta">· ${meta}</span></span>
          </div>
          <div class="stats-group-bar"><span style="width:${pct(r.solar)};background:var(--evcc-green)"></span><span style="width:${pct(r.kwh - r.solar)};background:var(--primary-color)"></span></div>
        </div>`;
    }).join("");
    return `
      <div class="stats-section">
        <div class="stats-section-head">
          <span class="stats-section-title">${this._t(sel.title)}</span>
          ${this._renderStatsTabs("group", sel.key, opts)}
        </div>
        <div class="stats-groups">${body}</div>
      </div>`;
  },

  _renderStatsBlockSessions(sessions) {
    const scope = this._statsScopeObj(sessions);
    const cur   = this._statsCurrency();
    const k     = this._sessionStats(sessions, scope);
    const money = v => `${v.toFixed(2)} ${escHtml(cur)}`.trim();
    const kwh   = v => v >= 100 ? String(Math.round(v)) : v.toFixed(1);

    const head = `
      <div class="lp-header">
        <span class="lp-name">${escHtml(this._config.title || this._t("statistics"))}</span>
        ${this._renderStatsStepper(sessions, scope)}
      </div>
      ${this._renderStatsScopeTabs()}`;

    // Total, cost and what the solar energy and cheap hours saved; below it
    // the split into solar and grid.
    const side = [
      k.hasPrice  ? `<div class="stats-hero-stat"><span class="stats-lbl">${this._t("cost")}</span><span class="stats-hero-stat-val">${money(k.totalCost)}</span></div>` : "",
      k.hasSaving ? `<div class="stats-hero-stat"><span class="stats-lbl">${this._t("statsSaved")}</span><span class="stats-hero-stat-val stats-good">${money(k.saved)}</span></div>` : "",
    ].join("");
    const solarPct = k.solarPct != null ? Math.round(k.solarPct) : null;
    const split = k.hasSolar && k.kwh > 0 ? `
      <div class="stats-split" role="img" aria-label="${solarPct} % ${this._t("statsGroupSolar")}">
        <span style="width:${(k.solarKwh / k.kwh * 100).toFixed(1)}%;background:var(--evcc-green)"></span><span style="width:${((k.kwh - k.solarKwh) / k.kwh * 100).toFixed(1)}%;background:var(--primary-color)"></span>
      </div>
      <div class="stats-split-lbl">
        <span><b class="stats-good">${solarPct} % ${this._t("statsGroupSolar")}</b> · ${kwh(k.solarKwh)} kWh</span>
        <span><b class="stats-grid">${this._t("grid")}</b> · ${kwh(k.kwh - k.solarKwh)} kWh</span>
      </div>` : "";
    const hero = `
      <div class="stats-overview">
      <div class="stats-hero">
        <div class="stats-hero-main">
          <span class="stats-lbl">${this._t("statsTotalCharged")}</span>
          <span class="stats-hero-val">${kwh(k.kwh)}<small>kWh</small></span>
        </div>
        ${side ? `<div class="stats-hero-side">${side}</div>` : ""}
      </div>
      ${split}
      </div>`;

    if (!k.count) {
      return `<div class="stats">${head}${hero}<div class="stats-chart-loading">${this._t("statsNoSessions")}</div></div>`;
    }

    // The chart offers cost and CO₂ only where the sessions carry them.
    const metrics = [
      { key: "energy", tKey: "statsMetricEnergy" },
      k.hasPrice ? { key: "cost", tKey: "statsMetricCost" } : null,
      k.hasCo2   ? { key: "co2",  tKey: "statsMetricCo2"  } : null,
    ].filter(Boolean);
    const metric = metrics.some(m => m.key === this._statsMetric) ? this._statsMetric : "energy";
    const buckets = this._sessionBuckets(sessions, scope, metric);
    const chart = `
      <div class="stats-section">
        <div class="stats-section-head">
          <span class="stats-section-title">${this._t("statsHistory")}</span>
          ${this._renderStatsTabs("metric", metric, metrics)}
        </div>
        ${this._renderSessionChart(buckets, metric, cur)}
      </div>`;

    const item = (label, text) => `<div class="session-item"><span class="si-label">${label}</span><span class="si-value">${text}</span></div>`;
    const totals = [
      item(this._t("statsSessions"), k.count),
      k.seconds != null ? item(this._t("vehicleChargeDuration"), `${Math.round(k.seconds / 3600)} h`) : "",
      k.avgPrice != null ? item(this._t("statsAvgPrice"), escHtml(fmtPrice(k.avgPrice, cur, this._hass?.language, { unit: "short" }))) : "",
      k.avgCo2 != null ? item(this._t("statsAvgCo2"), `${k.avgCo2 >= 10 ? Math.round(k.avgCo2) : k.avgCo2.toFixed(1)} g/kWh`) : "",
    ].filter(Boolean);
    // Four do not fit in one row; two rows of two rather than one left alone.
    const footer = `
      <div class="session-block stats-totals">
        <div class="session-grid" style="grid-template-columns:repeat(${totals.length === 4 ? 2 : totals.length}, 1fr)">${totals.join("")}</div>
      </div>`;

    return `<div class="stats">${head}${hero}${chart}${this._renderStatsBreakdown(sessions, scope, k, cur)}${footer}</div>`;
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
      k.hasPrice ? `<span class="sf-item"><span class="sf-val">${escHtml(fmtPrice(k.avgPrice, cur, this._hass?.language, { unit: "short" }))}</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
    ].filter(Boolean);
    if (k.kwh <= 0) return "";
    return `<div class="stats-footer"><div class="sf-period">${periodLabel}</div><div class="sf-items">${items.join('<span class="sf-sep"></span>')}</div></div>`;
  },

  _renderStatsFooter() {
    if (normalizeStatsPeriod(this._config.stats_period, "total") === "none") return "";
    if (this._hasCmd("sessions")) {
      const res = this._wsSessions();
      if (res && res.data && Array.isArray(res.data.sessions)) {
        return this._renderStatsFooterSessions(this._statsSessions(res.data.sessions));
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
      priceId ? `<span class="sf-item"><span class="sf-val">${escHtml(this._fmtAvgPrice(priceId, price))}</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
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
        return this._renderStatsBlockSessions(this._statsSessions(res.data.sessions));
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
  // tabs, the period stepper and the chart tooltip. Called by
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

    // The period stepper (sessions stats path): a year in the year scope, a
    // month in the month scope, across the turn of the year.
    this._fresh("button[data-stats-step]").forEach(btn => {
      btn.addEventListener("click", () => {
        const dir = btn.dataset.statsStep === "next" ? 1 : -1;
        const now = new Date();
        const year = this._statsYearSel ?? now.getFullYear();
        if (this._statsScope === "year") {
          this._statsYearSel = year + dir;
        } else {
          const m = (this._statsMonthSel ?? now.getMonth()) + dir;
          this._statsYearSel  = year + Math.floor(m / 12);
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
          const row = (s, v) => `<div class="ectt-row">${dot(s.color)}<span class="ectt-name">${escHtml(s.label)}</span><span class="ectt-val">${mf.fmt(v)} ${mf.unit}</span></div>`;
          // A single series is the total already: one row, no summary line.
          const body = series.length > 1
            ? series.filter(s => (b.seg[s.key] || 0) > 0).map(s => row(s, b.seg[s.key])).join("") + `<div class="ectt-summary">${mf.fmt(b.total)} ${mf.unit} ${this._t("total")}</div>`
            : row(series[0], b.total);
          tooltip.innerHTML = `<div class="ectt-header">${escHtml(b.labelFull || b.labelStr)}</div>${body}`;
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
      .stats-step-label { min-width: 8.5em; }
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
      .stats { display: flex; flex-direction: column; gap: 12px; }
      .stats .lp-header { margin-bottom: 0; }
      .stats-scope {
        display: inline-flex; align-self: flex-start; gap: 2px; padding: 2px;
        border: 1px solid var(--divider-color, #e5e7eb); border-radius: 999px;
      }
      .stats-scope .stats-period-tab { border: 0; padding: 2px 12px; }
      .stats-overview { display: flex; flex-direction: column; gap: 6px; }
      .stats-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 6px 16px; flex-wrap: wrap; }
      .stats-hero-main, .stats-hero-stat { display: flex; flex-direction: column; gap: 2px; }
      .stats-hero-side { display: flex; gap: 18px; }
      .stats-lbl { font-size: .7rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .05em; }
      .stats-hero-val { font-size: 1.9rem; font-weight: 700; line-height: 1; }
      .stats-hero-val small { font-size: .95rem; font-weight: 600; margin-left: 4px; }
      .stats-hero-stat-val { font-size: .95rem; font-weight: 600; white-space: nowrap; }
      .stats-good { color: var(--evcc-green); }
      .stats-grid { color: var(--primary-color); }
      .stats-split, .stats-group-bar { display: flex; overflow: hidden; background: var(--divider-color, #333); }
      .stats-split { height: 8px; border-radius: 4px; margin-top: 6px; }
      .stats-split span, .stats-group-bar span { display: block; height: 100%; }
      .stats-split-lbl { display: flex; justify-content: space-between; gap: 8px; font-size: .76rem; color: var(--secondary-text-color); }
      .stats-split-lbl b { font-weight: 600; }
      .stats-section { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); }
      .stats-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 22px; }
      .stats-section-title { font-size: .82rem; font-weight: 600; }
      .stats-section .stats-period-tabs { margin-bottom: 0; }
      .stats-chart-svg { width: 100%; display: block; }
      .stats .evcc-chart-wrap { margin-left: 0; }
      .stats .stats-legend { justify-content: flex-start; margin-top: 0; font-size: .72rem; }
      .stats-groups { display: flex; flex-direction: column; gap: 10px; }
      .stats-group-top { display: flex; justify-content: space-between; gap: 8px; font-size: .82rem; }
      .stats-group-name { font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .stats-group-val { font-weight: 600; white-space: nowrap; }
      .stats-group-meta { font-weight: 400; font-size: .74rem; color: var(--secondary-text-color); }
      .stats-group-bar { height: 6px; border-radius: 3px; margin-top: 4px; }
      .stats .session-block { margin-top: 0; }
      .stats-totals .session-grid { gap: 10px 16px; }
      .stats-totals .si-label { white-space: nowrap; }
      .stats-solar-hint {
        font-size: .72rem; color: var(--secondary-text-color);
        margin-top: 10px; padding: 6px 10px;
        background: color-mix(in srgb, var(--evcc-green) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--evcc-green) 25%, transparent);
        border-radius: 6px; line-height: 1.4;
      }
`;
