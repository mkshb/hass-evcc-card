import { stateVal, attr, isLive } from "../utils/state.js";
import { escHtml, escAttr } from "../utils/html.js";
import { evccDate, fmtPrice, priceScale } from "../utils/format.js";
import { HA_EVCC_MIN_VERSION, FORECAST_SECTIONS } from "../core/constants.js";

const HOUR = 3600 * 1000;
// The forecast is drawn in quarter hours from the one running now, at most
// four days ahead as on evcc's forecast page.
const SLOT     = 15 * 60 * 1000;
const MAX_SPAN = 4 * 24 * HOUR;
// A rest of today shorter than this joins tomorrow's page, so that the prices
// for tomorrow, which come in the afternoon, stand on the first page with it.
const JOIN_TODAY = 12 * HOUR;
// A last day shorter than this joins the day before (as in the optimizer).
const MIN_PAGE = 2 * HOUR;
// While shown the card renders again this often: the header says how long
// until the next cheap hours, and _wsFetch asks ha-evcc again after its TTL.
const REFRESH = 60 * 1000;
// Below this power (W) a solar slot counts as dark.
const DARK_W = 50;

// Chart geometry in viewBox units, as in the optimizer; the SVG scales to the
// card width.
const W = 400, ML = 26, MR = 4;
const CW = W - ML - MR;
const LANE_PRICE = 64, LANE_SOLAR = 44, MT = 6, MB = 18;
// The tags naming the lowest and highest value of a bar lane, and the room
// above such a lane that the tag over its highest bar needs.
const TAG_FONT = 7, TAG_ROOM = 13;

const f1 = v => v.toFixed(1);

// The known values of a series from now on (the slots up to its first gap),
// ranked in thirds as a reader would sort them: "low", "mid" and "high". A
// series that does not change ranks nothing.
function ranked(vals) {
  let n = 0;
  while (n < vals.length && vals[n] != null) n++;
  const known = vals.slice(0, n);
  const min = n ? Math.min(...known) : null, max = n ? Math.max(...known) : null;
  const fixed = !n || max - min < 1e-6;
  const sorted = [...known].sort((a, b) => a - b);
  const t1 = sorted[Math.floor(n / 3)], t2 = sorted[Math.floor(n * 2 / 3)];
  const level = k => {
    const v = vals[k];
    if (v == null || fixed) return null;
    return v <= t1 ? "low" : v >= t2 ? "high" : "mid";
  };
  return { n, min, max, fixed, level, kMin: known.indexOf(min), kMax: known.indexOf(max) };
}

// Forecast mode. Methods are mixed into EvccCard.prototype.
//
// What the coming hours bring, to read off rather than to act on: the grid
// price now, large, with the lowest and highest price ahead and when it turns
// cheap (the header of the battery mode), then the solar forecast and the grid
// price on one time axis, a day per page (the chart of the optimizer mode).
// Green marks the cheapest third of the known prices; the smart cost limits of
// the loadpoints and the battery's grid charge limit are drawn as lines. When
// evcc optimizes for CO₂, its emission forecast gets a lane of its own below
// the price, green in the cleanest third, with the limits set in g/kWh. The
// data is ha-evcc's evcc_intg/forecast (kinds grid, feedin, solar, and planner
// for CO₂).
export const forecastView = {
  _renderForecastBlock(site, loadpoints) {
    const head = `
      <div class="lp-header">
        <span class="lp-name">${escHtml(this._config.title || this._t("forecast"))}</span>
      </div>`;
    const note = (text) => `<div class="fc-block">${head}<div class="opt-note">${escHtml(text)}</div></div>`;

    if (this._haEvccTooOld()) return note(this._t("fcTooOld", { ver: HA_EVCC_MIN_VERSION }));
    if (!this._capsLoaded) return note(this._t("fcLoading"));
    if (!this._hasCmd("forecast")) return note(this._t("fcTooOld", { ver: HA_EVCC_MIN_VERSION }));

    this._fcScheduleRefresh();
    const grid = this._wsForecast("grid"), solar = this._wsForecast("solar"), feedin = this._wsForecast("feedin");
    // The planner's curve is the CO₂ forecast while evcc optimizes for CO₂.
    const planner = this._wsForecast("planner");
    if (grid === null && solar === null) return note(this._t("fcLoading"));
    const sec = this._fcSections();
    if (!sec.size) return note(this._t("fcNoSections"));
    const full = this._fcModelOf(grid, feedin, solar, planner);
    // `sections` leaves out what is not wanted: the price with its header and
    // the feed-in rate, the CO₂ lane, the solar lane. The model stays cached.
    const m = full && { ...full,
      hasPrice: full.hasPrice && sec.has("price"), hasFeed: full.hasFeed && sec.has("price"),
      hasCo2: full.hasCo2 && sec.has("co2"), hasSolar: full.hasSolar && sec.has("solar") };
    if (!m || (!m.hasPrice && !m.hasSolar && !m.hasCo2)) {
      // Still waiting for one of the two: not yet "nothing".
      return note(this._t(grid === null || solar === null ? "fcLoading" : "fcEmpty"));
    }

    const pages = this._fcPages(m);
    const pi    = Math.max(0, pages.findIndex(p => p.day === this._fcPageDay));
    const page  = pages[pi];
    const sel   = this._fcSelected(m, page);
    const limits = m.hasPrice || m.hasCo2 ? this._fcLimits(site, loadpoints) : [];
    this._fcLast = { m, pages, pi, page, sel, limits };

    return `
      <div class="fc-block">
        ${head}
        ${this._renderFcHeader(m)}
        <div class="opt-section">
          <div class="opt-section-head">
            <span class="opt-section-title">${this._t("fcTimeline")}</span>
            ${this._renderFcStepper(pages, pi)}
          </div>
          ${this._renderFcChart(m, page, sel, limits)}
          ${this._renderFcLegend(m, limits)}
          <div class="opt-detail fc-detail" aria-live="polite">${this._renderFcDetail(m, sel)}</div>
        </div>
      </div>`;
  },

  // The sections the card shows: all unless `sections` names some.
  _fcSections() {
    const raw = this._config.sections;
    if (raw === undefined || raw === null) return new Set(FORECAST_SECTIONS);
    return new Set((Array.isArray(raw) ? raw : [raw]).filter(s => FORECAST_SECTIONS.includes(s)));
  },

  _fcScheduleRefresh() {
    if (this._fcRefreshTimer) return;
    this._fcRefreshTimer = setTimeout(() => {
      this._fcRefreshTimer = null;
      if (this.isConnected && this._config.mode === "forecast") this._render();
    }, REFRESH);
  },

  // ── Model ──────────────────────────────────────────────────────────────

  // Rebuilt when ha-evcc answered something new (_wsFetch keeps the cached
  // object for an unchanged answer) or a new quarter hour began.
  _fcModelOf(grid, feedin, solar, planner) {
    const t0 = Math.floor(Date.now() / SLOT) * SLOT;
    const src = this._fcModelSrc;
    if (!src || src.grid !== grid || src.feedin !== feedin || src.solar !== solar || src.planner !== planner || src.t0 !== t0) {
      this._fcModelSrc = { grid, feedin, solar, planner, t0 };
      const co2 = planner?.data?.smartCostType === "co2" ? planner.data : null;
      this._fcModelVal = this._fcModel(grid?.data, feedin?.data, solar?.data, co2, t0);
    }
    return this._fcModelVal;
  },

  // The forecast on a grid of quarter hours from t0: per slot the grid price
  // and the feed-in rate (per kWh, null where evcc has none yet), the solar
  // power (W) and the CO₂ intensity (g/kWh). Null when nothing lies ahead.
  _fcModel(grid, feedin, solar, co2data, t0) {
    const rates = data => (Array.isArray(data?.rates) ? data.rates : [])
      .map(r => ({ s: evccDate(r?.start)?.getTime(), e: evccDate(r?.end)?.getTime(), v: Number(r?.value) }))
      .filter(r => Number.isFinite(r.s) && Number.isFinite(r.e) && r.e > r.s && r.e > t0 && Number.isFinite(r.v))
      .sort((a, b) => a.s - b.s);
    const g = rates(grid), f = rates(feedin), so = rates(solar), c = rates(co2data);
    const last = Math.max(0, ...g.map(r => r.e), ...so.map(r => r.e), ...c.map(r => r.e));
    const end  = Math.min(t0 + MAX_SPAN, last);
    if (end <= t0) return null;

    const ts = [];
    for (let t = t0; t < end; t += SLOT) ts.push(t);
    const n = ts.length;
    // The value of the rate that holds the start of each slot; the rates are
    // sorted, so one pass walks them along.
    const along = list => {
      let i = 0;
      return ts.map(t => {
        while (i < list.length && list[i].e <= t) i++;
        return i < list.length && list[i].s <= t ? list[i].v : null;
      });
    };
    const price = along(g), feed = along(f), pv = along(so).map(v => (v == null ? null : Math.max(0, v))), co2 = along(c);

    const p = ranked(price), cr = ranked(co2);
    const LEVELS = { low: "cheap", mid: "mid", high: "dear" };
    return {
      n, ts, end: k => ts[k] + SLOT, price, feed, pv,
      pn: p.n, min: p.min, max: p.max, fixed: p.fixed, kMin: p.kMin, kMax: p.kMax,
      level: k => LEVELS[p.level(k)] ?? null,
      co2, cn: cr.n, co2Fixed: cr.fixed, co2Level: cr.level,
      hasPrice: p.n > 0, hasFeed: feed.some(v => v != null),
      hasSolar: pv.some(v => v != null && v > DARK_W),
      hasCo2: cr.n > 0,
      currency: grid?.currency ?? null,
    };
  },

  // The slot that holds `t`, or null outside the forecast.
  _fcSlotOf(m, t) {
    const k = Math.floor((t - m.ts[0]) / SLOT);
    return k >= 0 && k < m.n ? k : null;
  },

  // The smart cost limits of the loadpoints and the battery's grid charge
  // limit, those that are set. `on` is the lane a limit belongs to: one in
  // g/kWh to the CO₂ lane, any other to the price. Loadpoints with the same
  // limit share one line.
  _fcLimits(site, loadpoints) {
    const out = [];
    const num = id => {
      if (!id || !isLive(this._hass, id)) return null;
      const v = parseFloat(stateVal(this._hass, id));
      return Number.isFinite(v) ? v : null;
    };
    const on = id => attr(this._hass, id, "unit_of_measurement") === "g/kWh" ? "co2" : "price";
    const smart = [];
    for (const [lp, ents] of Object.entries(loadpoints || {})) {
      const v = num(ents.smart_cost_limit);
      if (v == null) continue;
      const lane = on(ents.smart_cost_limit);
      const same = smart.find(l => l.v === v && l.on === lane);
      if (same) same.names.push(this._loadpointTitle(lp, ents));
      else smart.push({ v, on: lane, names: [this._loadpointTitle(lp, ents)], id: ents.smart_cost_limit });
    }
    for (const l of smart) {
      const several = smart.filter(o => o.on === l.on).length > 1;
      out.push({ kind: "smart", on: l.on, v: l.v, id: l.id,
                 label: several ? `${this._t("fcSmartLimit")} ${l.names.join(", ")}` : this._t("fcSmartLimit") });
    }
    const battId = site?.battery_grid_charge_limit;
    const batt = num(battId);
    if (batt != null) out.push({ kind: "batt", on: on(battId), v: batt, id: battId, label: this._t("fcBattLimit") });
    return out;
  },

  // ── Pages ──────────────────────────────────────────────────────────────

  // One page per calendar day; a short rest of today joins tomorrow, a short
  // last day the one before.
  _fcPages(m) {
    const pages = [];
    for (let k = 0; k < m.n; k++) {
      const d = new Date(m.ts[k]);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const last = pages[pages.length - 1];
      if (last && last.day === day) last.b = k;
      else pages.push({ a: k, b: k, day, joined: false });
    }
    const span = p => m.end(p.b) - m.ts[p.a];
    if (pages.length > 1 && span(pages[0]) < JOIN_TODAY) {
      pages[1].a = pages[0].a; pages[1].day = pages[0].day; pages[1].joined = true; pages.shift();
    }
    if (pages.length > 1 && span(pages[pages.length - 1]) < MIN_PAGE) { pages[pages.length - 2].b = pages[pages.length - 1].b; pages.pop(); }
    return pages;
  },

  _fcPageLabel(page) {
    return page.joined ? this._t("fcTodayTomorrow") : this._optDayLabel(page.day);
  },

  _renderFcStepper(pages, pi) {
    const label = `<span class="opt-step-label">${escHtml(this._fcPageLabel(pages[pi]))}</span>`;
    if (pages.length < 2) return label;
    return `
      <span class="opt-stepper">
        <button type="button" class="fc-step" data-fc-step="-1" ${pi > 0 ? "" : "disabled"} aria-label="${escAttr(this._t("battPrevDay"))}">‹</button>
        ${label}
        <button type="button" class="fc-step" data-fc-step="1" ${pi < pages.length - 1 ? "" : "disabled"} aria-label="${escAttr(this._t("battNextDay"))}">›</button>
      </span>`;
  },

  // The slot picked when it is on the page, else now on its page, else the
  // first slot of the page.
  _fcSelected(m, page) {
    const k = this._fcSel != null ? this._fcSlotOf(m, this._fcSel) : null;
    if (k != null && k >= page.a && k <= page.b) return k;
    return page.a;
  },

  // ── Header ─────────────────────────────────────────────────────────────

  _fcPrice(v, m, opts) {
    return fmtPrice(v, m.currency, this._hass?.language || "en", opts);
  },

  // "45 min", "2 h", "2 h 30 min".
  _fcDuration(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    const h = Math.floor(min / 60), r = min % 60;
    return [h ? `${h} h` : "", r || !h ? `${r} min` : ""].filter(Boolean).join(" ");
  },

  // "in 2 h 30 min" from now to the start of slot k; "now" for the running one.
  _fcFromNow(m, k) {
    return k === 0 ? this._t("battActiveNow") : this._t("fcIn", { dur: this._fcDuration(m.ts[k] - Date.now()) });
  },

  // The grid price now, large, as the battery mode shows the state of charge:
  // green in the cheapest third, red in the dearest. Beside it the lowest and
  // highest price ahead, below it how long the price stays or until it turns
  // cheap. The times are buttons that show their slot in the chart.
  _renderFcHeader(m) {
    if (!m.hasPrice) return "";
    const lvl   = m.level(0);
    const color = lvl === "cheap" ? "var(--evcc-green)" : lvl === "dear" ? "var(--evcc-red)" : "var(--primary-text-color)";
    const unit  = priceScale(m.currency, this._hass?.language || "en").unit.replace(/\/kWh$/, "");
    const jump  = (k, inner, cls, label) =>
      `<button type="button" class="fc-jump ${cls}" data-fc-jump="${k}" aria-label="${escAttr(label)}">${inner}</button>`;
    const stat  = (key, k) => {
      const val = `${this._fcPrice(m.price[k], m, { unit: "short" })} · ${this._battTimeLabel(new Date(m.ts[k]))}`;
      return jump(k, `<span class="batt-stat-label">${this._t(key)}</span><span class="batt-stat-val">${escHtml(val)}</span>`,
        "batt-stat", `${this._t(key)} ${val}, ${this._t("fcShowInChart")}`);
    };

    let hint = "";
    if (lvl) {
      // How far the current level runs, and the next cheap slot after it.
      let e = 0;
      while (e + 1 < m.pn && m.level(e + 1) === lvl) e++;
      let text, k = null;
      if (lvl === "cheap") {
        // Plain text: its time is where the cheap hours end, nothing to show.
        const to = e + 1 < m.pn ? m.ts[e + 1] : null;
        text = to != null
          ? this._t("fcCheapUntil", { time: this._battTimeLabel(new Date(to)), dur: this._fcDuration(to - Date.now()) })
          : this._t("fcCheapToEnd");
      } else {
        for (let j = 1; j < m.pn; j++) if (m.level(j) === "cheap") { k = j; break; }
        text = k != null ? this._t("fcCheapFrom", { time: this._battTimeLabel(new Date(m.ts[k])), dur: this._fcDuration(m.ts[k] - Date.now()) }) : "";
      }
      const chip = `<span class="fc-chip fc-${lvl}">${escHtml(this._t(`fcNow_${lvl}`))}</span>`;
      hint = `<div class="batt-optimizer">${chip}${text ? (k != null ? jump(k, escHtml(text), "fc-hint", `${text}, ${this._t("fcShowInChart")}`) : `<span>${escHtml(text)}</span>`) : ""}</div>`;
    }

    return `
      <div class="batt-status">
        <div class="batt-status-main">
          <span class="batt-status-soc fc-now" style="color:${color}">${escHtml(this._fcPrice(m.price[0], m, { unit: false }))}${unit ? `<small>${escHtml(unit)}</small>` : ""}</span>
          ${m.fixed ? "" : `<div class="batt-status-stats">${stat("fcLowest", m.kMin)}${stat("fcHighest", m.kMax)}</div>`}
        </div>
        ${hint}
      </div>`;
  },

  // ── Chart ──────────────────────────────────────────────────────────────

  // A bar lane over the range of the values and limits, as evcc's price chart
  // with zoom: when all of them are above zero the lane starts a round step
  // below the lowest, so that prices between 41 and 59 ct do not look flat;
  // with a value at or below zero it keeps the zero line. The step is a round
  // number of the unit shown (ct for a price in €, `factor` 100). Returns the
  // values of the grid lines in the series' own unit and the base the bars
  // grow from.
  _fcScale(vals, factor) {
    const s = { factor };
    const vmin = Math.min(...vals) * s.factor, vmax = Math.max(...vals) * s.factor;
    const zoom = vmin > 0;
    const hi = Math.max(0, vmax), lo = Math.min(0, vmin);
    const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    // Zoomed, the lowest bar keeps a height: the base lies below it, never on it.
    const below = st => zoom ? (Math.ceil(vmin / st - 1e-9) - 1) * st : Math.floor(lo / st + 1e-9) * st;
    const step = steps.find(st => (Math.ceil(hi / st - 1e-9) * st - below(st)) / st <= 3) ?? 1000;
    const bot = below(step), top = Math.max(bot + step, Math.ceil(hi / step - 1e-9) * step);
    const lines = [];
    for (let v = bot; v <= top + step / 2; v += step) lines.push(v / s.factor);
    return { top: top / s.factor, bot: bot / s.factor, base: zoom ? bot / s.factor : 0, lines, factor: s.factor };
  },

  // The lowest and highest value of a lane on the page, named in a tag above
  // its bar as on evcc's price chart; the first slot where several share it.
  // `yp` maps a value to the lane, `cx` a slot to the middle of its bar.
  _fcExtremeTags(l, a, b, yp, cx) {
    let kMin = -1, kMax = -1;
    for (let k = a; k <= b; k++) {
      const v = l.vals[k];
      if (v == null) continue;
      if (kMin < 0 || v < l.vals[kMin]) kMin = k;
      if (kMax < 0 || v > l.vals[kMax]) kMax = k;
    }
    if (kMin < 0 || l.vals[kMax] - l.vals[kMin] < 1e-9) return "";
    const tag = (k, cls) => {
      const text = l.tag(l.vals[k]);
      const w = text.length * TAG_FONT * 0.58 + 6, h = TAG_FONT + 4;
      const x = Math.max(ML, Math.min(W - MR - w, cx(k) - w / 2));
      const y = Math.max(MT, yp(Math.max(0, l.vals[k])) - h - 2);
      return `<g class="fc-tag ${cls}"><rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${h}" rx="2.5"/>` +
        `<text x="${f1(x + w / 2)}" y="${f1(y + h - 3)}" text-anchor="middle" font-size="${TAG_FONT}" font-weight="600">${escHtml(text)}</text></g>`;
    };
    return tag(kMin, "fc-tag-min") + tag(kMax, "fc-tag-max");
  },

  // The lanes as the optimizer draws them: name above, grid lines with their
  // values on the left, hour lines every few hours with the weekday at
  // midnight, the hours labelled under the last lane. A pointer or the arrow
  // keys pick a slot in all lanes.
  _renderFcChart(m, page, sel, limits) {
    const lang = this._hass?.language || "en";
    const t0 = m.ts[page.a], t1 = m.end(page.b);
    const x  = t => ML + (t - t0) / (t1 - t0) * CW;
    const sx = k => x(m.ts[k]), sw = CW / (page.b - page.a + 1);
    const bx = k => sx(k) + Math.min(0.5, sw / 4), bw = Math.max(0.4, sw - Math.min(1, sw / 2));
    const cx = sx(sel) + sw / 2;

    const span = (t1 - t0) / HOUR;
    const step = span > 16 ? 6 : span > 6 ? 3 : 1;
    const ticks = [];
    const first = new Date(t0); first.setMinutes(0, 0, 0);
    for (let t = first.getTime() + HOUR; t < t1; t += HOUR) {
      if (new Date(t).getHours() % step === 0) ticks.push(t);
    }
    const grid = (y, label) =>
      `<line x1="${ML}" x2="${W - MR}" y1="${f1(y)}" y2="${f1(y)}" stroke="var(--divider-color,#444)" stroke-width="0.5"/>` +
      `<text x="${ML - 4}" y="${f1(y + 3)}" text-anchor="end" font-size="7" fill="var(--secondary-text-color,#888)">${escHtml(label)}</text>`;

    const lanes = [];
    const ps = priceScale(m.currency, lang);
    if (m.hasSolar) lanes.push({ kind: "solar", h: LANE_SOLAR, title: this._t("optPv"), sub: this._fcSolarSums(m, page) });
    if (m.hasPrice && !m.fixed) lanes.push({ kind: "bars", h: LANE_PRICE, title: this._t("optLanePrice"),
      vals: m.price, known: m.pn, green: k => m.level(k) === "cheap", factor: ps.factor, unit: ps.unit.replace(/\/kWh$/, ""),
      limits: limits.filter(l => l.on === "price"), none: this._t("fcNoPrices"), id: "price",
      tag: v => this._fcPrice(v, m, { unit: "short" }) });
    if (m.hasCo2 && !m.co2Fixed) lanes.push({ kind: "bars", h: LANE_PRICE, title: this._t("fcLaneCo2"),
      vals: m.co2, known: m.cn, green: k => m.co2Level(k) === "low", factor: 1, unit: "g",
      limits: limits.filter(l => l.on === "co2"), none: this._t("fcNoCo2"), id: "co2",
      tag: v => `${this._battNum(v, 0)} g` });

    const blocks = lanes.map((l, li) => {
      const last = li === lanes.length - 1;
      const y0 = MT + (l.kind === "bars" ? TAG_ROOM : 0), y1 = y0 + l.h;
      const H = y1 + (last ? MB : 4);
      let s = "";
      for (const t of ticks) {
        const midnight = new Date(t).getHours() === 0;
        s += `<line x1="${f1(x(t))}" x2="${f1(x(t))}" y1="${y0}" y2="${y1}" stroke="var(--divider-color,#444)" stroke-width="${midnight ? 0.8 : 0.3}"/>`;
        if (!last) continue;
        const d = new Date(t);
        const lbl  = midnight ? d.toLocaleDateString(lang, { weekday: "short" }) : `${d.getHours()}`;
        const font = midnight ? `font-weight="600" fill="var(--primary-text-color,#fff)"` : `fill="var(--secondary-text-color,#888)"`;
        s += `<text x="${f1(x(t))}" y="${H - 6}" text-anchor="middle" font-size="7" ${font}>${escHtml(lbl)}</text>`;
      }

      // The grid price and the CO₂ intensity: a bar per slot, the lowest
      // third green, the limits of the lane as lines, hatched where the
      // series has no values yet.
      if (l.kind === "bars") {
        const sc = this._fcScale([...l.vals.filter(v => v != null), ...l.limits.map(o => o.v)], l.factor);
        const yp = v => y0 + (sc.top - v) / ((sc.top - sc.bot) || 1) * l.h;
        sc.lines.forEach(v => {
          const num = (v * sc.factor).toLocaleString(lang, { maximumFractionDigits: 2 });
          s += grid(yp(v), Math.abs(v - sc.top) < 1e-9 && l.unit ? `${num} ${l.unit}` : num);
        });
        const pe = Math.min(page.b, l.known - 1);
        for (let k = page.a; k <= pe; k++) {
          const ya = yp(Math.max(sc.base, l.vals[k])), yb = yp(Math.min(sc.base, l.vals[k]));
          if (yb - ya < 0.05) continue;
          s += `<rect class="fc-bar${l.green(k) ? " fc-cheap" : ""}" x="${f1(bx(k))}" y="${f1(ya)}" width="${f1(bw)}" height="${f1(yb - ya)}"/>`;
        }
        if (pe >= page.a) {
          const xe = f1(x(m.end(pe)));
          for (const lim of l.limits) {
            const y = f1(yp(lim.v));
            s += `<line class="fc-limit fc-limit-${lim.kind}" x1="${ML}" x2="${xe}" y1="${y}" y2="${y}"/>`;
          }
        }
        const na = Math.max(page.a, l.known);
        if (na <= page.b) {
          const xa = x(m.ts[na]), xb = W - MR, pid = `fc-none-${l.id}`;
          s += `<defs><pattern id="${pid}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
            `<line x1="0" y1="0" x2="0" y2="4" stroke="var(--secondary-text-color,#888)" stroke-width="1" opacity="0.25"/></pattern></defs>` +
            `<rect x="${f1(xa)}" y="${y0}" width="${f1(xb - xa)}" height="${l.h}" fill="url(#${pid})"/>`;
          if (xb - xa > 60) s += `<text x="${f1((xa + xb) / 2)}" y="${f1(y0 + l.h / 2 + 3)}" text-anchor="middle" font-size="7.5" fill="var(--secondary-text-color,#888)">${escHtml(l.none)}</text>`;
        }
        if (pe >= page.a) s += this._fcExtremeTags(l, page.a, pe, yp, k => bx(k) + bw / 2);
      }

      if (l.kind === "solar") {
        const peak = Math.max(...m.pv.filter(v => v != null)) / 1000;
        const unitKw = peak <= 2 ? 0.5 : peak <= 6 ? 1 : peak <= 12 ? 2 : peak <= 30 ? 5 : 10;
        const top = Math.max(unitKw, Math.ceil(peak / unitKw) * unitKw);
        const ys = w => y0 + (1 - w / 1000 / top) * l.h;
        s += grid(ys(top * 1000), `${this._battNum(top)} kW`) + grid(ys(0), "0");
        const pts = [];
        for (let k = page.a; k <= page.b; k++) if (m.pv[k] != null) pts.push([sx(k) + sw / 2, ys(m.pv[k])]);
        if (pts.length > 1) {
          const line = pts.map(([px, py]) => `${f1(px)},${f1(py)}`).join(" ");
          s += `<path d="M${f1(pts[0][0])},${f1(ys(0))}L${line.replace(/ /g, "L")}L${f1(pts[pts.length - 1][0])},${f1(ys(0))}Z" fill="var(--evcc-green)" opacity="0.15"/>` +
            `<polyline fill="none" stroke="var(--evcc-green)" stroke-width="1.5" stroke-linejoin="round" points="${line}"/>`;
        }
      }

      s += `<line class="fc-cursor" x1="${f1(cx)}" x2="${f1(cx)}" y1="${y0}" y2="${y1}" stroke="var(--primary-text-color,#fff)" stroke-width="0.6" opacity="0.6"/>`;
      return `<div class="opt-lane">
          <div class="opt-lane-name">${escHtml(l.title)}${l.sub ? `<span class="fc-lane-sub">${escHtml(l.sub)}</span>` : ""}</div>
          <svg viewBox="0 0 ${W} ${H}" class="opt-chart-svg" aria-hidden="true">${s}</svg>
        </div>`;
    });

    const label = this._t("fcChartLabel", { day: this._fcPageLabel(page) });
    return `<div class="fc-chart" tabindex="0" role="group" aria-label="${escAttr(label)}">${blocks.join("")}</div>`;
  },

  // The solar energy of the days on a page: today what is still to come (left
  // out once nothing is), a day the forecast does not reach the end of is left out.
  _fcSolarSums(m, page) {
    const lang = this._hass?.language || "en";
    const days = new Map();
    for (let k = page.a; k <= page.b; k++) {
      const d = new Date(m.ts[k]); d.setHours(0, 0, 0, 0);
      const day = d.getTime();
      days.set(day, (days.get(day) ?? 0) + (m.pv[k] ?? 0) * SLOT / HOUR);
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const out = [];
    for (const [day, wh] of days) {
      const next = new Date(day); next.setDate(next.getDate() + 1);
      if (next.getTime() > m.end(m.n - 1)) continue;
      const diff = Math.round((day - today.getTime()) / (24 * HOUR));
      // After sunset today has nothing left to say.
      if (diff === 0 && wh < 50) continue;
      const name = diff === 0 ? this._t("fcTodayRest") : diff === 1 ? this._t("battTomorrow")
        : new Date(day).toLocaleDateString(lang, { weekday: "long" });
      out.push(`${name} ${(wh / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kWh`);
    }
    return out.join(" · ");
  },

  // The limits name their value and open their entity.
  _renderFcLegend(m, limits) {
    const sw = (cls, color) => `<i class="opt-swatch ${cls}" style="--sw:${color}"></i>`;
    const items = [];
    const limit = (l, val) =>
      `<span class="fc-leg-limit" data-more-info="${escAttr(l.id)}"><i class="fc-swatch-limit fc-limit-${l.kind}"></i>${escHtml(l.label)} ${escHtml(val)}</span>`;
    if (m.hasSolar) items.push(`<span>${sw("line", "var(--evcc-green)")}${escHtml(this._t("optPv"))}</span>`);
    if (m.hasPrice && !m.fixed) {
      items.push(`<span>${sw("box", "var(--evcc-green)")}${escHtml(this._t("fcCheapest"))}</span>`);
      items.push(`<span>${sw("box", "var(--fc-bar)")}${escHtml(this._t("optLanePrice"))}</span>`);
      for (const l of limits.filter(o => o.on === "price")) items.push(limit(l, this._fcPrice(l.v, m, { unit: "short" })));
    }
    if (m.hasCo2 && !m.co2Fixed) {
      items.push(`<span>${sw("box", "var(--evcc-green)")}${escHtml(this._t("fcCleanest"))}</span>`);
      items.push(`<span>${sw("box", "var(--fc-bar)")}${escHtml(this._t("fcLaneCo2"))}</span>`);
      for (const l of limits.filter(o => o.on === "co2")) items.push(limit(l, `${this._battNum(l.v, 0)} g`));
    }
    return items.length ? `<div class="opt-legend">${items.join("")}</div>` : "";
  },

  // The values of slot k, under the chart.
  _renderFcDetail(m, k) {
    const lang = this._hass?.language || "en";
    const row = (label, val, swatch = "") =>
      `<span class="opt-dk">${swatch}${escHtml(label)}</span><span class="opt-dv">${escHtml(val)}</span>`;
    const d = new Date(m.ts[k]);
    const when = `${d.toLocaleDateString(lang, { weekday: "short" })} ${this._t("optRange", { from: this._optClock(m.ts[k]), to: this._optClock(m.end(k)) })}`;
    let h = `<span class="opt-dt fc-dt"><span>${escHtml(when)}</span><span class="fc-rel">${escHtml(this._fcFromNow(m, k))}</span></span>`;
    if (m.hasSolar) h += row(this._t("optPv"), m.pv[k] != null ? this._optKw(m.pv[k]) : "–", `<i class="opt-swatch line" style="--sw:var(--evcc-green)"></i>`);
    if (m.hasPrice) {
      const cheap = m.level(k) === "cheap";
      h += row(this._t("optLanePrice"), m.price[k] != null ? this._fcPrice(m.price[k], m) : this._t("fcNoPrice"),
        m.fixed ? `<i class="opt-swatch box fc-noswatch"></i>` : `<i class="opt-swatch box" style="--sw:${cheap ? "var(--evcc-green)" : "var(--fc-bar)"}"></i>`);
    }
    if (m.hasCo2) {
      const clean = m.co2Level(k) === "low";
      h += row(this._t("fcLaneCo2"), m.co2[k] != null ? `${this._battNum(m.co2[k], 0)} g/kWh` : this._t("fcNoCo2"),
        m.co2Fixed ? `<i class="opt-swatch box fc-noswatch"></i>` : `<i class="opt-swatch box" style="--sw:${clean ? "var(--evcc-green)" : "var(--fc-bar)"}"></i>`);
    }
    if (m.hasFeed && m.feed[k] != null) h += row(this._t("fcFeedIn"), this._fcPrice(m.feed[k], m), `<i class="opt-swatch box fc-noswatch"></i>`);
    return h;
  },

  // ── Interaction ────────────────────────────────────────────────────────

  // Picks slot k: the cursor and the values right away, without a render, as
  // a pointer crossing the chart would otherwise render the card per slot.
  _fcSelect(k) {
    const last = this._fcLast;
    if (!last || k == null) return;
    const { m, page } = last;
    k = Math.max(page.a, Math.min(page.b, k));
    this._fcSel = m.ts[k];
    last.sel = k;
    const t0 = m.ts[page.a], t1 = m.end(page.b);
    const cx = f1(ML + ((m.ts[k] + SLOT / 2) - t0) / (t1 - t0) * CW);
    const root = this.shadowRoot;
    for (const cur of root.querySelectorAll(".fc-cursor")) { cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); }
    const det = root.querySelector(".fc-detail");
    if (det) det.innerHTML = this._renderFcDetail(m, k);
  },

  _fcSlotAt(el, clientX) {
    const last = this._fcLast;
    if (!last) return null;
    const { m, page } = last;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    const vx = (clientX - r.left) / r.width * W;
    const k = page.a + Math.floor((vx - ML) / CW * (page.b - page.a + 1));
    return Math.max(page.a, Math.min(page.b, k));
  },

  _attachForecastListeners() {
    this._fresh(".fc-chart").forEach(el => {
      const pick = ev => this._fcSelect(this._fcSlotAt(el, ev.clientX));
      el.addEventListener("pointermove", ev => { if (ev.pointerType === "mouse") pick(ev); });
      el.addEventListener("pointerdown", pick);
      el.addEventListener("keydown", ev => {
        const last = this._fcLast;
        if (!last) return;
        const to = { ArrowLeft: last.sel - 1, ArrowRight: last.sel + 1, Home: last.page.a, End: last.page.b }[ev.key];
        if (to === undefined) return;
        ev.preventDefault();
        this._fcSelect(to);
      });
    });

    this._fresh("button.fc-step").forEach(btn => {
      btn.addEventListener("click", () => {
        const last = this._fcLast;
        if (!last || btn.disabled) return;
        const page = last.pages[last.pi + Number(btn.dataset.fcStep)];
        if (!page) return;
        this._fcPageDay = page.day;
        this._fcSel = null;
        this._render();
      });
    });

    // A time in the header opens its page with the cursor on it.
    this._fresh("button.fc-jump").forEach(btn => {
      btn.addEventListener("click", () => {
        const last = this._fcLast;
        if (!last) return;
        const k = Number(btn.dataset.fcJump);
        const page = last.pages.find(p => k >= p.a && k <= p.b);
        if (!page) return;
        this._fcPageDay = page.day;
        this._fcSel = last.m.ts[k];
        this._render();
      });
    });
  },
};

// Forecast mode. The header borrows the battery mode's classes, the chart the
// optimizer's; only what differs is here.
// Part of the card stylesheet, see src/styles.js.
export const forecastCss = `
      .fc-block { display: flex; flex-direction: column; gap: 12px;
        --fc-bar: color-mix(in srgb, var(--secondary-text-color) 45%, transparent);
        --fc-batt: #a855f7; }
      .fc-block .lp-header { margin-bottom: 0; }
      .fc-now small { font-size: .9rem; font-weight: 600; margin-left: 2px; }
      .fc-jump { font: inherit; color: inherit; background: none; border: none; padding: 0; margin: 0; text-align: left; cursor: pointer; border-radius: 4px; }
      .fc-jump:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .fc-jump.batt-stat:hover .batt-stat-val, .fc-jump.fc-hint:hover { text-decoration: underline dotted; text-underline-offset: 3px; }
      .fc-chip { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 10px; font-size: .74rem; font-weight: 600;
        background: color-mix(in srgb, var(--fc-c) 18%, transparent); color: var(--primary-text-color); --fc-c: var(--secondary-text-color); }
      .fc-chip.fc-cheap { --fc-c: var(--evcc-green); }
      .fc-chip.fc-dear  { --fc-c: var(--evcc-red); }
      .fc-step { background: none; border: none; color: var(--primary-text-color); font-size: 1rem; line-height: 1; padding: 2px 6px; cursor: pointer; border-radius: 4px; font-family: inherit; }
      .fc-step:disabled { opacity: .3; cursor: default; }
      .fc-step:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .fc-chart { display: flex; flex-direction: column; gap: 8px; touch-action: pan-y; cursor: crosshair; border-radius: 4px; }
      .fc-chart:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .fc-lane-sub { font-weight: 400; font-size: .74rem; color: var(--secondary-text-color); margin-left: 6px; }
      .fc-bar { fill: var(--fc-bar); }
      .fc-bar.fc-cheap { fill: var(--evcc-green); opacity: .9; }
      .fc-limit { stroke-width: .8; fill: none; }
      .fc-tag rect { fill: var(--fc-tag); }
      .fc-tag text { fill: var(--fc-tag-text, #fff); }
      .fc-tag-min { --fc-tag: var(--evcc-green); }
      .fc-tag-max { --fc-tag: var(--secondary-text-color); --fc-tag-text: var(--card-background-color, #fff); }
      .fc-limit-smart { stroke: var(--primary-text-color); stroke-dasharray: 4 3; opacity: .7; }
      .fc-limit-batt  { stroke: var(--fc-batt); stroke-width: 1; stroke-dasharray: 2 2; }
      .fc-leg-limit { cursor: pointer; }
      .fc-leg-limit:hover { color: var(--primary-text-color); }
      .fc-swatch-limit { display: inline-block; width: 12px; height: 0; border-top: 1.5px dashed var(--primary-text-color); }
      .fc-swatch-limit.fc-limit-batt { border-top: 1.5px dotted var(--fc-batt); }
      .fc-dt { display: flex; justify-content: space-between; gap: 8px; }
      .fc-rel { font-weight: 400; color: var(--secondary-text-color); }
      .fc-noswatch { visibility: hidden; }
`;
