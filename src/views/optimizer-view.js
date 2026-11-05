import { escHtml, escAttr } from "../utils/html.js";
import { evccDate, fmtPrice } from "../utils/format.js";
import { HA_EVCC_OPTIMIZER_VERSION } from "../core/constants.js";
import { AXIS_FONT } from "../components/chart-px.js";

const HOUR = 3600 * 1000;
// Below this mean power (W) a slot counts as idle: the solver leaves small
// rests that are no action.
const IDLE_W = 50;
// A day of the plan shorter than this joins its neighbour instead of getting a
// page of its own (a plan computed at 23:30, or one that ends at 00:15).
const MIN_PAGE = 2 * HOUR;
// While the card shows the plan it asks ha-evcc again this often; ha-evcc
// holds evcc's result in memory, an unchanged answer draws nothing.
const REFRESH = 60 * 1000;

// Chart geometry in pixels, the SVG in the width the chart has on screen
// (src/components/chart-px.js). The left margin follows the longest axis label.
const MR = 4, MT = 8, MB = 24;

// The view last picked (chart or list), per ha-evcc instance (prefix), as the
// battery mode keeps its tab. Storage that fails only means the chart shows.
const VIEW_STORE = "evcc-card-optimizer-view";
function readView(prefix) {
  try { return (JSON.parse(localStorage.getItem(VIEW_STORE)) || {})[prefix] ?? null; } catch (e) { return null; }
}
function rememberView(prefix, view) {
  try {
    const all = JSON.parse(localStorage.getItem(VIEW_STORE)) || {};
    all[prefix] = view;
    localStorage.setItem(VIEW_STORE, JSON.stringify(all));
  } catch (e) { /* the view still switches, only not for the next visit */ }
}

// What the home battery does in a slot. evcc's own suggestion is not part of
// what ha-evcc passes on, so the card reads it off the plan: charging or
// discharging power, the state of charge against its limits and the grid.
// `color` is a CSS variable of the block; null draws no band.
const ACTIONS = {
  pv:     { key: "optActPv",     color: "--opt-pv-charge" },
  grid:   { key: "optActGrid",   color: "--opt-grid-charge" },
  dis:    { key: "optActDis",    color: "--opt-dis" },
  hold:   { key: "optActHold",   color: "--opt-hold" },
  full:   { key: "optActFull",   color: null },
  empty:  { key: "optActEmpty",  color: null },
  normal: { key: "optActNormal", color: null },
};
const EVENT_KEYS = {
  pv: "optEvPv", grid: "optEvGrid", dis: "optEvDis", hold: "optEvHold",
  full: "optEvFull", empty: "optEvEmpty", normal: "optEvNormal",
};

// MDI paths (Material Design Icons, as used by HA).
const MDI = {
  battery: "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  car:     "M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z",
};
const icon = (path, size = 18) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:currentColor" aria-hidden="true"><path d="${path}"/></svg>`;

const f1 = v => v.toFixed(1);

// Optimizer mode. Methods are mixed into EvccCard.prototype.
//
// A read-only picture of what evcc's optimizer plans: the home battery, every
// vehicle it plans for and the energy around them on one time axis, a day per
// page, or the same plan as a list of the moments something changes. The data
// is evcc's optimizer result as ha-evcc passes it on (evcc_intg/optimizer);
// the card computes nothing of its own beyond reading it.
export const optimizerView = {
  _renderOptimizerBlock(site) {
    const head = (extra = "") => `
      <div class="lp-header">
        ${this._renderOptDisabledWarn(site)}
        <span class="lp-name">${escHtml(this._config.title || this._t("optimizer"))}</span>
        ${extra}
      </div>`;
    const note = (text) => `<div class="optimizer-block">${head()}<div class="opt-note">${escHtml(text)}</div></div>`;

    if (this._haEvccTooOld()) return note(this._t("optTooOld", { ver: HA_EVCC_OPTIMIZER_VERSION }));
    if (!this._capsLoaded) return note(this._t("optLoading"));
    if (!this._hasCmd("optimizer")) return note(this._t("optTooOld", { ver: HA_EVCC_OPTIMIZER_VERSION }));

    this._optScheduleRefresh();
    const result = this._wsOptimizer();
    if (!result) return note(this._t("optLoading"));
    if (result.error) return note(this._t("optError"));
    const m = this._optModelOf(result.data);
    if (!m) return note(this._t("optOff"));

    const pages = this._optPages(m);
    const pi    = this._optPageIndex(pages);
    const page  = pages[pi];
    const sel   = this._optSelected(m, page);
    this._optLast = { m, pages, pi, page, sel };

    if (this._optView === undefined) this._optView = readView(this._getPrefix()) === "list" ? "list" : "chart";
    const list = this._optView === "list";

    const ok     = m.status === "Optimal";
    const status = m.status ? `<span class="opt-status${ok ? "" : " warn"}">${escHtml(ok ? this._t("optStatusOptimal") : m.status)}</span>` : "";
    return `
      <div class="optimizer-block">
        ${head(status + this._renderBattRecompute(site, "optRecompute"))}
        ${this._renderOptMeta(m)}
        ${this._renderOptSummary(m, result.data?.batteryForecast)}
        <div class="opt-section">
          <div class="opt-section-head">
            <span class="opt-section-title">${this._t("optPlan")}</span>
            ${list ? "" : this._renderOptStepper(pages, pi)}
            <span class="opt-seg" role="group" aria-label="${escAttr(this._t("optViewLabel"))}">
              <button type="button" class="opt-seg-btn" data-opt-view="chart" aria-pressed="${!list}">${this._t("optViewChart")}</button>
              <button type="button" class="opt-seg-btn" data-opt-view="list" aria-pressed="${list}">${this._t("optViewList")}</button>
            </span>
          </div>
          ${list ? this._renderOptEvents(m) : `
            ${this._renderOptChart(m, page, sel)}
            ${this._renderOptLegend(m)}
            <div class="opt-detail" aria-live="polite">${this._renderOptDetail(m, sel)}</div>`}
        </div>
      </div>`;
  },

  // The triangle in the header: only evcc's "optimize" button counts here.
  _renderOptDisabledWarn(site) {
    return this._disabledWarnButton(() => this._siteNeededDisabled(site).filter(n => n.optimizer));
  },

  // The card asks for the plan again while it is shown, as the plan changes
  // without any entity the card reads changing with it.
  _optScheduleRefresh() {
    if (this._optRefreshTimer) return;
    this._optRefreshTimer = setTimeout(() => {
      this._optRefreshTimer = null;
      if (this.isConnected && this._config.mode === "optimizer") this._render();
    }, REFRESH);
  },

  // ── Model ──────────────────────────────────────────────────────────────

  // The model is rebuilt only when ha-evcc answered something new: _wsFetch
  // keeps the cached object for an unchanged answer.
  _optModelOf(data) {
    if (this._optModelSrc !== data) {
      this._optModelSrc = data;
      this._optModelVal = this._optModel(data?.evopt);
    }
    return this._optModelVal;
  },

  // evcc's optimizer result in units the view draws: times in ms, energy per
  // slot (Wh) as mean power (W), state of charge in Wh and percent. Null when
  // there is no plan (the optimizer is off or has not run yet).
  _optModel(ev) {
    const res = ev?.res, req = ev?.req ?? {}, det = ev?.details ?? {};
    const iso = det.timestamp;
    if (!res || !Array.isArray(iso) || !iso.length) return null;
    const ts = iso.map(v => evccDate(v)?.getTime());
    if (ts.some(t => t == null || isNaN(t))) return null;
    const n   = ts.length;
    const num = (arr) => Array.from({ length: n }, (_, k) => {
      const v = Array.isArray(arr) ? Number(arr[k]) : NaN;
      return Number.isFinite(v) ? v : 0;
    });
    const tsr = req.time_series ?? {};
    // Slot length from evcc's dt (seconds; the first slot runs to the next
    // quarter hour), else from the timestamps.
    const dur = ts.map((t, k) => {
      const d = Number(tsr.dt?.[k]);
      if (Number.isFinite(d) && d > 0) return d * 1000;
      const next = k + 1 < n ? ts[k + 1] : t + (k ? ts[k] - ts[k - 1] : 15 * 60 * 1000);
      return Math.max(60 * 1000, next - t);
    });
    const end   = k => ts[k] + dur[k];
    const watts = arr => num(arr).map((wh, k) => wh / (dur[k] / HOUR));
    const has   = arr => Array.isArray(arr) && arr.length >= n;

    const pv  = watts(tsr.ft);
    const imp = watts(res.grid_import);
    const exp = watts(res.grid_export);
    const demand = Array.isArray(det.demandDetails) && det.demandDetails.length
      ? det.demandDetails.map(d => ({ type: d?.type, title: d?.title || null, w: watts(d?.values) }))
      : [{ type: "home", title: null, w: watts(tsr.gt) }];
    const demandW = k => demand.reduce((a, d) => a + d.w[k], 0);

    // Prices come per Wh; the card shows them per kWh.
    const pN = has(tsr.p_N) ? num(tsr.p_N).map(v => v * 1000) : null;
    const pE = has(tsr.p_E) ? num(tsr.p_E).map(v => v * 1000) : null;
    const priceFixed = !pN || Math.max(...pN) - Math.min(...pN) < 1e-4;
    // What the grid costs over the plan: import at the grid price less export
    // at the feed-in rate, slot by slot.
    const cost = pN ? num(res.grid_import).reduce((a, wh, k) => a + wh / 1000 * pN[k], 0)
      - (pE ? num(res.grid_export).reduce((a, wh, k) => a + wh / 1000 * pE[k], 0) : 0) : null;

    const batteries = (Array.isArray(res.batteries) ? res.batteries : []).map((b, i) => {
      const d = det.batteryDetails?.[i] ?? {}, q = req.batteries?.[i] ?? {};
      const capWh = q.s_capacity > 0 ? q.s_capacity : d.capacity > 0 ? d.capacity * 1000 : null;
      const socWh = num(b?.state_of_charge);
      const initWh = Number.isFinite(q.s_initial) ? q.s_initial : socWh[0];
      const pct = wh => capWh ? Math.max(0, Math.min(100, wh / capWh * 100)) : null;
      const goals = [];
      if (Array.isArray(q.s_goal)) q.s_goal.forEach((v, k) => { if (k < n && v > 0) goals.push({ k, pct: pct(v) }); });
      return {
        type: d.type || "battery",
        title: d.title || d.name || `${this._t("battery")} ${i + 1}`,
        capWh, sMin: Number.isFinite(q.s_min) ? q.s_min : 0, sMax: Number.isFinite(q.s_max) ? q.s_max : capWh,
        charge: watts(b?.charging_power), discharge: watts(b?.discharging_power),
        socWh, initWh, pct, goals,
        // SoC at the end of slot k, and at its start (the end of the one before).
        socPct: k => pct(socWh[k]),
        startPct: k => pct(k ? socWh[k - 1] : initWh),
      };
    });
    const homes    = batteries.filter(b => b.type === "battery");
    const vehicles = batteries.filter(b => b.type !== "battery");
    const vehicleW = k => vehicles.reduce((a, v) => a + v.charge[k], 0);

    for (const h of homes) {
      const near = h.capWh ? h.capWh * 0.005 : 20;
      h.acts = Array.from({ length: n }, (_, k) => {
        if (h.charge[k] > IDLE_W) {
          // More than the solar surplus goes in while the grid delivers: grid charging.
          const surplus = Math.max(0, pv[k] - demandW(k) - vehicleW(k));
          return imp[k] > IDLE_W && h.charge[k] > surplus + IDLE_W ? "grid" : "pv";
        }
        if (h.discharge[k] > IDLE_W) return "dis";
        if (h.socWh[k] <= h.sMin + near) return "empty";
        if (h.sMax != null && h.socWh[k] >= h.sMax - near) return "full";
        if (imp[k] > IDLE_W) return "hold";
        return "normal";
      });
      // For the summary and the list: a single slot between two equal ones is
      // no change of its own (the battery pausing while a vehicle charges).
      h.steady = h.acts.slice();
      for (let k = 1; k < n - 1; k++) {
        if (h.steady[k] !== h.steady[k - 1] && h.steady[k - 1] === h.steady[k + 1]) h.steady[k] = h.steady[k - 1];
      }
    }

    return {
      status: res.status ?? null, updated: evccDate(ev.updated)?.getTime() ?? null,
      n, ts, dur, end, pv, imp, exp, demand, demandW, pN, pE, priceFixed, cost,
      homes, vehicles,
    };
  },

  // The slot that holds `t`, or null outside the plan.
  _optSlotOf(m, t) {
    for (let k = 0; k < m.n; k++) if (t >= m.ts[k] && t < m.end(k)) return k;
    return null;
  },

  // The slot running now. The plan starts when evcc computed it, so its first
  // slots may be over by the time the card shows it; the summary and the list
  // start here. Before the plan its first slot, after it its last.
  _optNow(m) {
    const t = Date.now();
    if (t < m.ts[0]) return 0;
    return this._optSlotOf(m, t) ?? m.n - 1;
  },

  // ── Pages ──────────────────────────────────────────────────────────────

  // One page per calendar day of the plan. A short first or last day joins
  // its neighbour.
  _optPages(m) {
    const pages = [];
    for (let k = 0; k < m.n; k++) {
      const d = new Date(m.ts[k]);
      const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const last = pages[pages.length - 1];
      if (last && last.day === day) last.b = k;
      else pages.push({ a: k, b: k, day });
    }
    const span = p => m.end(p.b) - m.ts[p.a];
    if (pages.length > 1 && span(pages[0]) < MIN_PAGE) { pages[1].a = pages[0].a; pages.shift(); }
    if (pages.length > 1 && span(pages[pages.length - 1]) < MIN_PAGE) { pages[pages.length - 2].b = pages[pages.length - 1].b; pages.pop(); }
    return pages;
  },

  // The page shown is kept as its day, so it stays put while evcc computes a
  // new plan; a day the plan no longer covers falls back to the first page.
  _optPageIndex(pages) {
    const i = pages.findIndex(p => p.day === this._optPageDay);
    return i >= 0 ? i : 0;
  },

  // "Today", "Tomorrow" or the weekday.
  _optDayLabel(day) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((day - today.getTime()) / (24 * HOUR));
    if (diff === 0) return this._t("optToday");
    if (diff === 1) return this._t("optTomorrow");
    return new Date(day).toLocaleDateString(this._hass?.language || "en", { weekday: "long" });
  },

  _renderOptStepper(pages, pi) {
    if (pages.length < 2) return `<span class="opt-step-label">${escHtml(this._optDayLabel(pages[0].day))}</span>`;
    return `
      <span class="opt-stepper">
        <button type="button" class="opt-step" data-opt-step="-1" ${pi > 0 ? "" : "disabled"} aria-label="${escAttr(this._t("battPrevDay"))}">‹</button>
        <span class="opt-step-label">${escHtml(this._optDayLabel(pages[pi].day))}</span>
        <button type="button" class="opt-step" data-opt-step="1" ${pi < pages.length - 1 ? "" : "disabled"} aria-label="${escAttr(this._t("battNextDay"))}">›</button>
      </span>`;
  },

  // The selected slot on the page: the one picked, else the running slot on
  // its page, else the first slot of the page.
  _optSelected(m, page) {
    const k = this._optSel != null ? this._optSlotOf(m, this._optSel) : null;
    if (k != null && k >= page.a && k <= page.b) return k;
    const now = this._optNow(m);
    return now >= page.a && now <= page.b ? now : page.a;
  },

  // ── Header and summary ─────────────────────────────────────────────────

  _optClock(t) {
    return new Date(t).toLocaleTimeString(this._hass?.language || "en", { hour: "2-digit", minute: "2-digit" });
  },

  _optCurrency() {
    return this._statsCurrency();
  },

  _renderOptMeta(m) {
    const lang = this._hass?.language || "en";
    const cur  = this._optCurrency();
    const items = [];
    if (m.updated) items.push(this._t("optPlanFrom", { time: `<b>${this._optClock(m.updated)}</b>` }));
    if (m.cost != null && cur) {
      items.push(this._t("optGridCost", { val: `<b>${escHtml(m.cost.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} ${escHtml(cur)}</b>` }));
    }
    if (m.pN && m.priceFixed && cur) {
      let p = this._t("optPriceGrid", { val: `<b>${escHtml(fmtPrice(m.pN[0], cur, lang))}</b>` });
      if (m.pE) p += ` · ${this._t("optPriceFeedIn", { val: `<b>${escHtml(fmtPrice(m.pE[0], cur, lang))}</b>` })}`;
      items.push(p);
    }
    return items.length ? `<div class="opt-meta">${items.map(i => `<span>${i}</span>`).join("")}</div>` : "";
  },

  _optActChip(a) {
    const c = ACTIONS[a].color;
    return `<span class="opt-chip"${c ? ` style="--chip:var(${c})"` : ""}>${escHtml(this._t(ACTIONS[a].key))}</span>`;
  },

  _optKw(w) {
    return `${this._battNum(w / 1000)} kW`;
  },

  _optPct(v) {
    return v == null ? "" : `${Math.round(v)} %`;
  },

  // evcc's highest and lowest SoC ahead, as in the battery mode.
  _optExtremes(forecast) {
    const out = [];
    for (const [p, high] of [[forecast?.highest, true], [forecast?.lowest, false]]) {
      const t = evccDate(p?.time);
      if (!t || t.getTime() < Date.now()) continue;
      const val = p.limit ? this._t(high ? "battFull" : "battEmpty") : `${Math.round(p.soc)} %`;
      out.push(`${this._t(high ? "battHighest" : "battLowest", { val })} ${this._battTimeLabel(t)}`);
    }
    return out;
  },

  // The charge windows of a vehicle: runs of slots that charge, from slot
  // `from` on (a window running then starts there).
  _optWindows(m, v, from = 0) {
    const out = [];
    let s = -1;
    for (let k = from; k <= m.n; k++) {
      const on = k < m.n && v.charge[k] > IDLE_W;
      if (on && s < 0) s = k;
      if (!on && s >= 0) { out.push([s, k - 1]); s = -1; }
    }
    return out;
  },

  // What happens from now on: the slots of the plan that are over are left out.
  _renderOptSummary(m, forecast) {
    const s = this._optNow(m);
    const rows = [];
    m.homes.forEach((h, i) => {
      const a0 = h.steady[s];
      let k = s;
      while (k < m.n && h.steady[k] === a0) k++;
      const next = k < m.n ? h.steady[k] : null;
      const sub = [next ? this._t("optThen", { act: this._t(ACTIONS[next].key) }) : this._t("optStays")];
      // evcc's highest and lowest are for the home batteries together.
      if (i === 0 && m.homes.length === 1) sub.push(...this._optExtremes(forecast));
      rows.push(`
        <div class="opt-row">
          <span class="opt-row-icon">${icon(MDI.battery)}</span>
          <span class="opt-row-what">${escHtml(h.title)}${this._optActChip(a0)}</span>
          <span class="opt-row-when">${next ? escHtml(this._t("optUntil", { time: this._battTimeLabel(new Date(m.ts[k])) })) : ""}</span>
          <span class="opt-row-sub">${escHtml(sub.join(" · "))}</span>
        </div>`);
    });
    for (const v of m.vehicles) {
      const wins = this._optWindows(m, v, s);
      const first = wins[0];
      const maxW = Math.max(0, ...wins.flatMap(([a, b]) => v.charge.slice(a, b + 1)));
      const sub = [];
      if (wins.length > 1) sub.push(this._t("optWindows", { n: wins.length }));
      if (wins.length) sub.push(this._t("optUpTo", { val: this._optKw(maxW) }));
      if (v.capWh) sub.push(`${this._optPct(v.startPct(s)).replace(" %", "")} → ${this._optPct(v.socPct(m.n - 1))}`);
      const goal = v.goals.filter(g => g.k >= s).pop();
      if (goal && goal.pct != null) sub.push(this._t("optGoal", { soc: this._optPct(goal.pct), time: this._battTimeLabel(new Date(m.end(goal.k))) }));
      rows.push(`
        <div class="opt-row">
          <span class="opt-row-icon">${icon(MDI.car)}</span>
          <span class="opt-row-what">${escHtml(v.title)}${wins.length ? `<span class="opt-chip" style="--chip:var(--opt-veh)">${escHtml(this._t("optCharging"))}</span>` : ""}</span>
          <span class="opt-row-when">${escHtml(first
            ? this._t("optRange", { from: this._battTimeLabel(new Date(m.ts[first[0]])), to: this._optClock(m.end(first[1])) })
            : this._t("optNoCharge"))}</span>
          ${sub.length ? `<span class="opt-row-sub">${escHtml(sub.join(" · "))}</span>` : ""}
        </div>`);
    }
    return rows.length ? `<div class="opt-rows">${rows.join("")}</div>` : "";
  },

  // ── Chart ──────────────────────────────────────────────────────────────

  // The lanes of the chart, top to bottom: the grid price only when it
  // changes over the plan, the power, then each home battery and vehicle.
  // `h` is the plot height in viewBox units.
  _optLanes(m) {
    const lanes = [];
    if (!m.priceFixed) lanes.push({ kind: "price", h: 48, title: this._t("optLanePrice") });
    lanes.push({ kind: "energy", h: 110, title: this._t("optLanePower") });
    for (const h of m.homes) lanes.push({ kind: "home", h: 88, title: h.title, ref: h });
    for (const v of m.vehicles) lanes.push({ kind: "vehicle", h: 60, title: v.title, ref: v });
    return lanes;
  },

  // Each lane is a chart of its own, drawn like the state of charge chart of
  // the battery mode: its name above it, grid lines with their values on the
  // left, hour lines every few hours with the weekday at midnight, the plan
  // dashed and hatched as that chart draws its forecast, and what happens
  // meanwhile as faint bands behind it. The power and the price are bars as
  // in the tariff chart of the plan. The hours are labelled under the last
  // lane; a pointer or the arrow keys pick a slot across all lanes.
  _renderOptChart(m, page, sel) {
    const lanes = this._optLanes(m);
    const lang = this._hass?.language || "en";

    // The scale and the axis labels of each lane first: the longest label
    // sets the left margin. Price and power span the whole plan, so a series
    // is read on one scale on every page.
    for (const l of lanes) {
      if (l.kind === "price") {
        l.hi = Math.max(0, ...m.pN); l.lo = Math.min(0, ...m.pN);
        const cur = this._optCurrency();
        l.axis = [...(l.hi > 0 ? [[l.hi, fmtPrice(l.hi, cur, lang, { unit: false })]] : []), [0, "0"],
                  ...(l.lo < 0 ? [[l.lo, fmtPrice(l.lo, cur, lang, { unit: false })]] : [])];
      } else if (l.kind === "energy") {
        // As in evcc's own chart: consumption and charging stacked above the
        // zero line, the home battery's discharging below it; solar and grid
        // as lines, the grid importing above and exporting below zero. The
        // scale follows what is shown, so a series left alone is read on its
        // own scale.
        const shown = this._optSeries(m).filter(sr => !this._optHidden?.has(sr.key));
        l.areas = shown.filter(sr => sr.kind === "box");
        l.lines = shown.filter(sr => sr.kind !== "box");
        const all   = Array.from({ length: m.n }, (_, k) => k);
        const upW   = Math.max(0, ...all.map(k => Math.max(l.areas.reduce((a, sr) => a + sr.w[k], 0), ...l.lines.map(sr => sr.w[k]))));
        const downW = Math.max(0, ...all.map(k => Math.max(l.areas.reduce((a, sr) => a + (sr.neg?.[k] ?? 0), 0), ...l.lines.map(sr => -sr.w[k]))));
        const range = (upW + downW) / 1000;
        l.unit  = range <= 2 ? 0.5 : range <= 6 ? 1 : range <= 12 ? 2 : range <= 30 ? 5 : 10;
        l.topKw = Math.max(l.unit, Math.ceil(upW / 1000 / l.unit) * l.unit);
        l.botKw = downW > 50 ? Math.ceil(downW / 1000 / l.unit) * l.unit : 0;
        l.axis = [];
        for (let v = -l.botKw; v <= l.topKw + 1e-9; v += l.unit) {
          l.axis.push([v * 1000, Math.abs(v - l.topKw) < 1e-9 ? `${this._battNum(v)} kW` : this._battNum(v)]);
        }
      } else {
        l.axis = (l.h >= 70 ? [0, 25, 50, 75, 100] : [0, 50, 100]).map(v => [v, String(v)]);
      }
    }
    const W = this._chartW("optimizer"), ML = this._chartMargin(Math.max(...lanes.flatMap(l => l.axis.map(([, t]) => t.length))));
    const CW = W - ML - MR;
    this._optLast.g = { W, ML, CW };

    const t0 = m.ts[page.a], t1 = m.end(page.b);
    const x  = t => ML + (t - t0) / (t1 - t0) * CW;
    const slots = [];
    for (let k = page.a; k <= page.b; k++) slots.push(k);
    const sx = k => x(m.ts[k]), sw = k => Math.max(0.3, x(m.end(k)) - x(m.ts[k]));
    // A bar inside its slot, a gap of one unit to the next.
    const bx = k => sx(k) + Math.min(0.5, sw(k) / 4), bw = k => Math.max(0.4, sw(k) - Math.min(1, sw(k) / 2));
    const cx = sx(sel) + sw(sel) / 2;

    // Hour lines: every six hours on a full day, as in the battery mode, more
    // often on a shorter one.
    const span = (t1 - t0) / HOUR;
    const step = span > 16 ? 6 : span > 6 ? 3 : 1;
    const ticks = [];
    const first = new Date(t0); first.setMinutes(0, 0, 0);
    for (let t = first.getTime() + HOUR; t < t1; t += HOUR) {
      if (new Date(t).getHours() % step === 0) ticks.push(t);
    }

    const grid = (y, label) =>
      `<line x1="${ML}" x2="${W - MR}" y1="${f1(y)}" y2="${f1(y)}" stroke="var(--divider-color,#444)" stroke-width="0.5"/>` +
      `<text x="${ML - 5}" y="${f1(y + AXIS_FONT * 0.35)}" text-anchor="end" font-size="${AXIS_FONT}" fill="var(--secondary-text-color,#888)">${escHtml(label)}</text>`;
    const stripes = (id, color) =>
      `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">` +
      `<line x1="0" y1="0" x2="0" y2="4" stroke="var(${color})" stroke-width="1.5" opacity="0.35"/></pattern>`;

    const blocks = lanes.map((l, li) => {
      const last = li === lanes.length - 1;
      const H  = MT + l.h + (last ? MB : 4);
      const y0 = MT, y1 = MT + l.h;
      let s = "";

      for (const t of ticks) {
        const midnight = new Date(t).getHours() === 0;
        s += `<line x1="${f1(x(t))}" x2="${f1(x(t))}" y1="${y0}" y2="${y1}" stroke="var(--divider-color,#444)" stroke-width="${midnight ? 0.8 : 0.3}"/>`;
        if (!last) continue;
        const d = new Date(t);
        const lbl  = midnight ? d.toLocaleDateString(lang, { weekday: "short" }) : `${d.getHours()}`;
        const font = midnight ? `font-weight="600" fill="var(--primary-text-color,#fff)"` : `fill="var(--secondary-text-color,#888)"`;
        s += `<text x="${f1(x(t))}" y="${H - 7}" text-anchor="middle" font-size="${AXIS_FONT}" ${font}>${escHtml(lbl)}</text>`;
      }

      if (l.kind === "price") {
        // From the zero line up, and down for negative prices.
        const { hi, lo } = l;
        const yp = p => y0 + (hi - p) / ((hi - lo) || 1) * l.h;
        for (const [v, label] of l.axis) s += grid(yp(v), label);
        for (const k of slots) {
          const ya = yp(Math.max(0, m.pN[k])), yb = yp(Math.min(0, m.pN[k]));
          if (yb - ya < 0.05) continue;
          s += `<rect class="opt-price-bar" x="${f1(bx(k))}" y="${f1(ya)}" width="${f1(bw(k))}" height="${f1(yb - ya)}" fill="var(--secondary-text-color)" opacity=".35"/>`;
        }
      }

      if (l.kind === "energy") {
        const { areas, lines, topKw, botKw } = l;
        const y = w => y0 + (topKw - w / 1000) / (topKw + botKw) * l.h;
        for (const [v, label] of l.axis) s += grid(y(v), label);
        // One bar per slot, as the tariff chart of the plan draws them: a gap
        // between the bars, the series of a slot stacked inside its bar.
        const clean = w => (w > 5 ? w : 0);
        let up = slots.map(() => 0), down = slots.map(() => 0);
        const group = (sr, from, to, extra = "") => {
          const rects = slots.map((k, i) => {
            const ya = y(from[i]), yb = y(to[i]);
            if (Math.abs(ya - yb) < 0.05) return "";
            return `<rect x="${f1(bx(k))}" y="${f1(Math.min(ya, yb))}" width="${f1(bw(k))}" height="${f1(Math.max(0.4, Math.abs(ya - yb)))}"/>`;
          }).join("");
          return rects ? `<g class="opt-bars" data-series="${escAttr(sr.key)}" fill="var(${sr.color})"${extra}>${rects}</g>` : "";
        };
        for (const sr of areas) {
          const hi = slots.map((k, i) => up[i] + clean(sr.w[k]));
          s += group(sr, up, hi);
          up = hi;
          if (!sr.neg) continue;
          const lo = slots.map((k, i) => down[i] - clean(sr.neg[k]));
          s += group(sr, down, lo, ` opacity=".75"`);
          down = lo;
        }
        // Lines on a casing in the card colour, readable over the bars.
        for (const sr of lines) {
          const pts = slots.map(k => `${f1(sx(k) + sw(k) / 2)},${f1(y(sr.w[k]))}`).join(" ");
          s += `<polyline fill="none" stroke="var(--ha-card-background, var(--card-background-color, #fff))" stroke-width="3" stroke-linejoin="round" points="${pts}"/>` +
            `<polyline class="opt-line" data-series="${escAttr(sr.key)}" fill="none" stroke="var(${sr.color})" stroke-width="1.5" stroke-linejoin="round" points="${pts}"/>`;
        }
      }

      if (l.kind === "home" || l.kind === "vehicle") {
        const b = l.ref;
        const color = l.kind === "home" ? "--opt-batt" : "--opt-veh";
        const ys = p => y0 + (1 - Math.max(0, Math.min(100, p)) / 100) * l.h;
        // What happens meanwhile, as bands behind the curve: the battery's
        // action, the vehicle's charge windows.
        const band = (a, e, c) => {
          const xa = sx(a), xb = x(m.end(e));
          return `<rect class="opt-band" x="${f1(xa)}" y="${y0}" width="${f1(Math.max(0.5, xb - xa))}" height="${l.h}" fill="var(${c})" opacity="0.14"/>`;
        };
        if (l.kind === "home") {
          for (let k = page.a; k <= page.b;) {
            let e = k;
            while (e + 1 <= page.b && b.acts[e + 1] === b.acts[k]) e++;
            const c = ACTIONS[b.acts[k]].color;
            if (c) s += band(k, e, c);
            k = e + 1;
          }
        } else {
          for (const [a, e] of this._optWindows(m, b)) {
            if (e >= page.a && a <= page.b) s += band(Math.max(a, page.a), Math.min(e, page.b), "--opt-veh");
          }
        }
        for (const [v, label] of l.axis) s += grid(ys(v), label);
        if (l.kind === "home") {
          const min = b.pct(b.sMin);
          if (min != null && min > 0) s += `<line x1="${ML}" x2="${W - MR}" y1="${f1(ys(min))}" y2="${f1(ys(min))}" stroke="var(--secondary-text-color)" stroke-width="0.8" stroke-dasharray="1.5 3" stroke-linecap="round"/>`;
        }
        if (b.capWh) {
          const pts = [[sx(page.a), ys(b.startPct(page.a))], ...slots.map(k => [x(m.end(k)), ys(b.socPct(k))])];
          const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${f1(px)},${f1(py)}`).join("");
          const id = `opt-stripes-${li}`;
          s += `<defs>${stripes(id, color)}</defs>`;
          s += `<path d="${path}L${f1(pts[pts.length - 1][0])},${f1(ys(0))}L${f1(pts[0][0])},${f1(ys(0))}Z" fill="url(#${id})"/>`;
          s += `<path class="opt-soc" d="${path}" fill="none" stroke="var(${color})" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round"/>`;
          for (const g of b.goals) {
            if (g.k >= page.a && g.k <= page.b && g.pct != null) s += `<circle cx="${f1(x(m.end(g.k)))}" cy="${f1(ys(g.pct))}" r="2.5" fill="var(${color})"/>`;
          }
        }
      }

      s += `<line class="opt-cursor" x1="${f1(cx)}" x2="${f1(cx)}" y1="${y0}" y2="${y1}" stroke="var(--primary-text-color,#fff)" stroke-width="1" opacity="0.6"/>`;
      return `<div class="opt-lane">
          <div class="opt-lane-name">${escHtml(l.title)}</div>
          <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="opt-chart-svg" aria-hidden="true">${s}</svg>
        </div>`;
    });

    const label = this._t("optChartLabel", { day: this._optDayLabel(page.day) });
    return `<div class="opt-chart" tabindex="0" role="group" aria-label="${escAttr(label)}">${blocks.join("")}</div>`;
  },

  // The series of the power lane: bars stacked bottom up (consumption, then
  // the charging of vehicles and home batteries), the solar forecast and the
  // grid import as lines. Keyed for the legend, which hides them one by one.
  _optSeries(m) {
    return [
      ...m.demand.map((d, i) => ({ key: `demand:${i}`, label: d.title || this._t(d.type === "heating" ? "optHeating" : "optHome"),
                                   color: d.type === "heating" ? "--opt-heat" : "--opt-home", kind: "box", w: d.w })),
      ...m.vehicles.map((v, i) => ({ key: `vehicle:${i}`, label: v.title, color: "--opt-veh", kind: "box", w: v.charge })),
      ...m.homes.map((h, i) => ({ key: `battery:${i}`, label: h.title, color: "--opt-batt", kind: "box", w: h.charge, neg: h.discharge })),
      { key: "pv",   label: this._t("optPv"),   color: "--opt-pv",  kind: "line", w: m.pv },
      { key: "grid", label: this._t("optGrid"), color: "--opt-imp", kind: "line", w: m.imp.map((v, k) => v - m.exp[k]) },
    ];
  },

  // The power lane's entries are buttons: a click hides the series in the
  // chart (not in the values below it) and shows it again. Held by the card
  // only, a card opened again shows everything. The colours of the battery's
  // band only explain it.
  _renderOptLegend(m) {
    const swatch = (color, kind) => `<i class="opt-swatch ${kind}" style="--sw:var(${color})"></i>`;
    const series = this._optSeries(m).map(sr => {
      const shown = !this._optHidden?.has(sr.key);
      return `<button type="button" class="opt-leg" data-opt-series="${escAttr(sr.key)}" aria-pressed="${shown}">${swatch(sr.color, sr.kind)}${escHtml(sr.label)}</button>`;
    });
    const bands = ["pv", "grid", "dis", "hold"].filter(a => m.homes.some(h => h.acts.includes(a)))
      .map(a => `<span>${swatch(ACTIONS[a].color, "band")}${escHtml(this._t(ACTIONS[a].key))}</span>`);
    return `<div class="opt-legend">${[...series, ...bands].join("")}</div>`;
  },

  // The values of slot k, under the chart.
  _renderOptDetail(m, k) {
    const lang = this._hass?.language || "en";
    const row = (label, val, color) =>
      `<span class="opt-dk">${color ? `<i class="opt-swatch box" style="--sw:var(${color})"></i>` : ""}${escHtml(label)}</span><span class="opt-dv">${escHtml(val)}</span>`;
    const d = new Date(m.ts[k]);
    let h = `<span class="opt-dt">${escHtml(`${d.toLocaleDateString(lang, { weekday: "short" })} ${this._t("optRange", { from: this._optClock(m.ts[k]), to: this._optClock(m.end(k)) })}`)}</span>`;
    if (m.pN && !m.priceFixed) h += row(this._t("optLanePrice"), fmtPrice(m.pN[k], this._optCurrency(), lang));
    h += row(this._t("optPv"), this._optKw(m.pv[k]), "--opt-pv");
    h += row(this._t("optDemand"), this._optKw(m.demandW(k)), "--opt-home");
    h += row(this._t("optGrid"), m.imp[k] > IDLE_W ? this._t("optGridImport", { val: this._optKw(m.imp[k]) })
      : m.exp[k] > IDLE_W ? this._t("optGridExport", { val: this._optKw(m.exp[k]) }) : "0 kW", "--opt-imp");
    for (const b of m.homes) {
      const p = b.charge[k] > IDLE_W ? `+${this._optKw(b.charge[k])}` : b.discharge[k] > IDLE_W ? `−${this._optKw(b.discharge[k])}` : "0 kW";
      h += row(b.title, [this._t(ACTIONS[b.acts[k]].key), p, this._optPct(b.socPct(k))].filter(Boolean).join(" · "), "--opt-batt");
    }
    for (const v of m.vehicles) {
      const c = v.charge[k] > IDLE_W ? this._t("battCharging", { power: this._optKw(v.charge[k]) }) : this._t("optNotCharging");
      h += row(v.title, [c, this._optPct(v.socPct(k))].filter(Boolean).join(" · "), "--opt-veh");
    }
    return h;
  },

  // ── List ───────────────────────────────────────────────────────────────

  // The moments something changes from slot `s` (now) on: each home
  // battery's action (one-slot blips left out, see `steady`), each vehicle's
  // charge windows and goals.
  _optEvents(m, s) {
    const evs = [];
    for (const h of m.homes) {
      const minPct = this._optPct(h.pct(h.sMin));
      let k = s;
      while (k < m.n) {
        let e = k;
        while (e + 1 < m.n && h.steady[e + 1] === h.steady[k]) e++;
        const a = h.steady[k];
        const moving = a === "pv" || a === "grid" || a === "dis";
        const until = e < m.n - 1 ? this._t("optUntil", { time: this._optClock(m.end(e)) }) : this._t("optUntilEnd");
        const sub = moving && h.capWh ? `${until} · ${this._optPct(h.startPct(k)).replace(" %", "")} → ${this._optPct(h.socPct(e))}` : until;
        evs.push({ k, color: ACTIONS[a].color || "--secondary-text-color", name: h.title, text: this._t(EVENT_KEYS[a], { soc: minPct }), sub });
        k = e + 1;
      }
    }
    for (const v of m.vehicles) {
      for (const [a, e] of this._optWindows(m, v, s)) {
        const maxW = Math.max(...v.charge.slice(a, e + 1));
        const sub = [this._t("optUntil", { time: this._optClock(m.end(e)) }), this._t("optUpTo", { val: this._optKw(maxW) })];
        if (v.capWh) sub.push(`${this._optPct(v.startPct(a)).replace(" %", "")} → ${this._optPct(v.socPct(e))}`);
        evs.push({ k: a, color: "--opt-veh", name: v.title, text: this._t("optEvCharge"), sub: sub.join(" · ") });
      }
      for (const g of v.goals) {
        if (g.pct == null || g.k < s) continue;
        evs.push({ k: g.k, color: "--opt-veh", name: v.title, text: this._t("optEvGoal", { soc: this._optPct(g.pct) }), sub: this._t("optUntil", { time: this._optClock(m.end(g.k)) }) });
      }
    }
    return evs.sort((p, q) => p.k - q.k);
  },

  _renderOptEvents(m) {
    const now = this._optNow(m);
    let lastDay = null, out = "";
    for (const ev of this._optEvents(m, now)) {
      const d = new Date(m.ts[ev.k]); d.setHours(0, 0, 0, 0);
      if (d.getTime() !== lastDay) {
        lastDay = d.getTime();
        out += `<div class="opt-ev-day">${escHtml(this._optDayLabel(lastDay))}</div>`;
      }
      const time = ev.k === now ? this._t("battActiveNow") : this._optClock(m.ts[ev.k]);
      out += `<button type="button" class="opt-ev" data-opt-k="${ev.k}">
          <span class="opt-ev-t">${escHtml(time)}</span>
          <i class="opt-swatch box" style="--sw:var(${ev.color})"></i>
          <span class="opt-ev-x"><b>${escHtml(ev.name)}</b> ${escHtml(ev.text)}</span>
          <span class="opt-ev-s">${escHtml(ev.sub)}</span>
        </button>`;
    }
    return `<div class="opt-events">${out || `<div class="opt-note">${escHtml(this._t("optNoEvents"))}</div>`}</div>`;
  },

  // ── Interaction ────────────────────────────────────────────────────────

  // Picks slot k: the state for the next render, and the cursor and the
  // values right away, as a pointer moving over the chart would otherwise
  // render the whole card for every slot it crosses.
  _optSelect(k) {
    const last = this._optLast;
    if (!last || k == null) return;
    const { m, page } = last;
    k = Math.max(page.a, Math.min(page.b, k));
    this._optSel = m.ts[k];
    last.sel = k;
    const root = this.shadowRoot;
    const t0 = m.ts[page.a], t1 = m.end(page.b), { ML, CW } = last.g;
    const x = t => ML + (t - t0) / (t1 - t0) * CW;
    const cx = f1((x(m.ts[k]) + x(m.end(k))) / 2);
    for (const cur of root.querySelectorAll(".opt-cursor")) { cur.setAttribute("x1", cx); cur.setAttribute("x2", cx); }
    const det = root.querySelector(".opt-detail");
    if (det) det.innerHTML = this._renderOptDetail(m, k);
  },

  // The slot under a pointer at clientX over the chart element.
  _optSlotAt(el, clientX) {
    const last = this._optLast;
    if (!last) return null;
    const { m, page, g: { W, ML, CW } } = last;
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    const vx = (clientX - r.left) / r.width * W;
    const t0 = m.ts[page.a], t1 = m.end(page.b);
    const t = t0 + (vx - ML) / CW * (t1 - t0);
    if (t < t0) return page.a;
    if (t >= t1) return page.b;
    return this._optSlotOf(m, t);
  },

  _attachOptimizerListeners() {
    this._fresh(".opt-chart").forEach(el => {
      this._observeChart(el, "optimizer");
      const pick = ev => this._optSelect(this._optSlotAt(el, ev.clientX));
      el.addEventListener("pointermove", ev => { if (ev.pointerType === "mouse") pick(ev); });
      el.addEventListener("pointerdown", pick);
      el.addEventListener("keydown", ev => {
        const last = this._optLast;
        if (!last) return;
        const k = last.sel;
        const to = { ArrowLeft: k - 1, ArrowRight: k + 1, Home: last.page.a, End: last.page.b }[ev.key];
        if (to === undefined) return;
        ev.preventDefault();
        this._optSelect(to);
      });
    });

    this._fresh("button.opt-step").forEach(btn => {
      btn.addEventListener("click", () => {
        const last = this._optLast;
        if (!last || btn.disabled) return;
        const page = last.pages[last.pi + Number(btn.dataset.optStep)];
        if (!page) return;
        this._optPageDay = page.day;
        this._optSel = null;
        this._render();
      });
    });

    this._fresh("button.opt-seg-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._optView = btn.dataset.optView === "list" ? "list" : "chart";
        rememberView(this._getPrefix(), this._optView);
        this._render();
      });
    });

    this._fresh("button.opt-leg").forEach(btn => {
      btn.addEventListener("click", () => {
        this._optHidden ??= new Set();
        const key = btn.dataset.optSeries;
        if (this._optHidden.has(key)) this._optHidden.delete(key); else this._optHidden.add(key);
        this._render();
      });
    });

    // An entry of the list opens the chart on its day, at its slot.
    this._fresh("button.opt-ev").forEach(btn => {
      btn.addEventListener("click", () => {
        const last = this._optLast;
        if (!last) return;
        const k = Number(btn.dataset.optK);
        const page = last.pages.find(p => k >= p.a && k <= p.b);
        if (page) this._optPageDay = page.day;
        this._optSel = last.m.ts[k];
        this._optView = "chart";
        rememberView(this._getPrefix(), "chart");
        this._render();
      });
    });
  },
};

// Optimizer mode.
// Part of the card stylesheet, see src/styles.js.
export const optimizerCss = `
      /* The colours of the flow, site and grid views: solar green, grid import
         red, home battery orange, charge points blue, consumption grey (other
         consumers such as a heat pump a lighter grey). The battery's band says
         where its energy comes from or goes in the same colours. */
      .optimizer-block { display: flex; flex-direction: column; gap: 12px;
        --opt-home: color-mix(in srgb, var(--secondary-text-color) 45%, transparent);
        --opt-heat: color-mix(in srgb, var(--secondary-text-color) 22%, transparent);
        --opt-veh: var(--evcc-blue);
        --opt-batt: var(--evcc-orange);
        --opt-pv: var(--evcc-green);
        --opt-imp: var(--evcc-red);
        --opt-pv-charge: var(--evcc-green);
        --opt-grid-charge: var(--evcc-red);
        --opt-dis: var(--evcc-orange);
        --opt-hold: color-mix(in srgb, var(--secondary-text-color) 55%, transparent); }
      .optimizer-block .lp-header { margin-bottom: 0; }
      .opt-note { font-size: .82rem; color: var(--secondary-text-color); line-height: 1.5; }
      .opt-status { font-size: .7rem; font-weight: 600; padding: 2px 9px; border-radius: 999px; white-space: nowrap;
        color: var(--evcc-green); border: 1px solid var(--evcc-green); background: color-mix(in srgb, var(--evcc-green) 12%, transparent); }
      .opt-status.warn { color: var(--evcc-amber); border-color: var(--evcc-amber); background: color-mix(in srgb, var(--evcc-amber) 12%, transparent); }
      .optimizer-block .batt-recompute { margin-left: 4px; }
      .opt-meta { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: .74rem; color: var(--secondary-text-color); }
      .opt-meta b { color: var(--primary-text-color); font-weight: 600; font-variant-numeric: tabular-nums; }
      .opt-rows { display: flex; flex-direction: column; gap: 8px; }
      .opt-row { display: grid; grid-template-columns: 20px 1fr auto; gap: 2px 8px; align-items: center; font-size: .82rem; }
      .opt-row-icon { display: flex; color: var(--secondary-text-color); }
      .opt-row-what { font-weight: 600; min-width: 0; overflow-wrap: anywhere; }
      .opt-row-when { font-size: .76rem; color: var(--secondary-text-color); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .opt-row-sub { grid-column: 2 / -1; font-size: .72rem; color: var(--secondary-text-color); }
      .opt-chip { display: inline-block; margin-left: 6px; padding: 1px 7px; border-radius: 10px; font-size: .7rem; font-weight: 600;
        background: color-mix(in srgb, var(--chip, var(--secondary-text-color)) 20%, transparent); }
      .opt-section { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); }
      .opt-section-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .opt-section-title { font-size: .82rem; font-weight: 600; }
      .opt-stepper { display: inline-flex; align-items: center; gap: 2px; font-size: .78rem; font-weight: 600; }
      .opt-step { background: none; border: none; color: var(--primary-text-color); font-size: 1rem; line-height: 1; padding: 2px 6px; cursor: pointer; border-radius: 4px; font-family: inherit; }
      .opt-step:disabled { opacity: .3; cursor: default; }
      .opt-step:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .opt-step-label { min-width: 56px; text-align: center; font-size: .78rem; font-weight: 600; }
      .opt-seg { display: inline-flex; margin-left: auto; border: 1px solid var(--divider-color, #444); border-radius: 999px; padding: 2px; gap: 2px; }
      .opt-seg-btn { font-family: inherit; font-size: .7rem; font-weight: 500; border: none; background: none; color: var(--secondary-text-color); padding: 2px 9px; border-radius: 999px; cursor: pointer; }
      .opt-seg-btn[aria-pressed="true"] { background: color-mix(in srgb, var(--primary-text-color) 9%, transparent); color: var(--primary-text-color); font-weight: 600; }
      .opt-seg-btn:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .opt-chart { display: flex; flex-direction: column; gap: 8px; touch-action: pan-y; cursor: crosshair; border-radius: 4px; }
      .opt-chart:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .opt-chart-svg { width: 100%; height: auto; display: block; }
      .opt-lane { display: flex; flex-direction: column; gap: 2px; }
      .opt-lane-name { font-size: .78rem; font-weight: 600; }
      .opt-legend { display: flex; flex-wrap: wrap; gap: 3px 12px; font-size: .7rem; color: var(--secondary-text-color); }
      .opt-legend > span, .opt-leg { display: inline-flex; align-items: center; gap: 5px; }
      .opt-leg { font: inherit; color: inherit; background: none; border: none; padding: 1px 2px; margin: -1px -2px; border-radius: 4px; cursor: pointer; }
      .opt-leg:hover { color: var(--primary-text-color); }
      .opt-leg:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .opt-leg[aria-pressed="false"] { opacity: .45; text-decoration: line-through; }
      .opt-swatch { display: inline-block; flex: none; background: var(--sw); }
      .opt-swatch.box { width: 8px; height: 8px; border-radius: 2px; }
      .opt-swatch.line { width: 12px; height: 2px; }
      .opt-swatch.band { width: 10px; height: 10px; border-radius: 2px; opacity: .45; }
      .opt-detail { display: grid; grid-template-columns: 1fr auto; gap: 2px 12px; padding: 8px 10px; border-radius: 8px; font-size: .76rem;
        background: color-mix(in srgb, var(--primary-text-color) 5%, transparent); font-variant-numeric: tabular-nums; }
      .opt-dt { grid-column: 1 / -1; font-weight: 600; margin-bottom: 2px; }
      .opt-dk { display: flex; align-items: center; gap: 6px; color: var(--secondary-text-color); min-width: 0; }
      .opt-dv { text-align: right; }
      .opt-events { display: flex; flex-direction: column; gap: 1px; }
      .opt-ev-day { font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--secondary-text-color); margin: 6px 0 2px; }
      .opt-ev-day:first-child { margin-top: 0; }
      .opt-ev { display: grid; grid-template-columns: 42px 10px 1fr; gap: 0 8px; align-items: baseline; width: 100%; padding: 4px 6px; border: none; border-radius: 6px;
        background: none; color: inherit; font-family: inherit; font-size: .8rem; text-align: left; cursor: pointer; }
      .opt-ev:hover { background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); }
      .opt-ev:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
      .opt-ev .opt-swatch { align-self: center; }
      .opt-ev-t { color: var(--secondary-text-color); font-variant-numeric: tabular-nums; }
      .opt-ev-x b { font-weight: 600; }
      .opt-ev-s { grid-column: 3; font-size: .72rem; color: var(--secondary-text-color); }
`;
