import { stateVal, attr, isOn, isLive } from "../utils/state.js";
import { escHtml, escAttr } from "../utils/html.js";
import { evccDate } from "../utils/format.js";

const HOUR = 3600 * 1000;
const DAY  = 24 * HOUR;
// How far the history can be paged back, as in evcc's battery view.
const HIST_MIN_OFFSET = -30;
// The history is drawn from means over this step (see _battDownsample).
const HIST_STEP = 5 * 60 * 1000;

// The optimizer's actions for the current slot, as evcc names them
// (core/site_optimizer.go, currentSlotSuggestion).
const SUGGESTION_ACTIONS = ["normal", "hold", "charge", "holdcharge", "discharge"];

// ha-evcc keeps evcc's optimizer result in memory, as evcc pushes it, so
// asking again costs evcc nothing. evcc runs the optimizer again a few seconds
// after the grid charge limit or grid discharging changed; the card asks
// again that long after its own write. evcc's "optimize" button starts a run
// at once; its icon turns until a new result is in, at most FORECAST_BUSY.
const FORECAST_TTL     = 30 * 1000;
const FORECAST_RECHECK = [3000, 10000];
const FORECAST_BUSY    = 15 * 1000;

// The settings tab last picked, per ha-evcc instance (prefix), so a card that
// is opened again shows it. Storage that fails (private mode, full) only means
// the view starts at the first tab, as it did before.
const TAB_STORE = "evcc-card-battery-tab";
function readTab(prefix) {
  try { return (JSON.parse(localStorage.getItem(TAB_STORE)) || {})[prefix] ?? null; } catch (e) { return null; }
}
function rememberTab(prefix, key) {
  try {
    const all = JSON.parse(localStorage.getItem(TAB_STORE)) || {};
    all[prefix] = key;
    localStorage.setItem(TAB_STORE, JSON.stringify(all));
  } catch (e) { /* the tab still works, only not on the next visit */ }
}

// MDI paths (Material Design Icons, as used by HA).
const MDI = {
  battery:   "M16,20H8V6H16M16.67,4H15V2H9V4H7.33A1.33,1.33 0 0,0 6,5.33V20.67C6,21.4 6.6,22 7.33,22H16.67A1.33,1.33 0 0,0 18,20.67V5.33C18,4.6 17.4,4 16.67,4Z",
  car:       "M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z",
  home:      "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  bolt:      "M11 15H6L13 1V9H18L11 23V15Z",
  sun:       "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  refresh:   "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  lightbulb: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  grid:      "M8.28,5.45L6.5,4.55L7.76,2H16.23L17.5,4.55L15.72,5.44L15,4H9L8.28,5.45M18.62,8H14.09L13.3,5H10.7L9.91,8H5.38L4.1,10.55L5.89,11.44L6.62,10H17.38L18.1,11.45L19.89,10.56L18.62,8M17.77,22H15.7L15.46,21.1L12,15.9L8.53,21.1L8.3,22H6.23L9.12,11H11.19L10.83,12.35L12,14.1L13.16,12.35L12.81,11H14.88L17.77,22M11.4,15L10.5,13.65L9.32,18.13L11.4,15M14.68,18.12L13.5,13.64L12.6,15L14.68,18.12Z",
};

// Opens HA's more-info dialog of the entity on a click, as at the loadpoint
// (listeners.js makes the element focusable and wires the click).
const moreInfo = (entityId) => entityId ? ` data-more-info="${escAttr(entityId)}"` : "";

const icon = (path, size = 18, color = "currentColor") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" style="fill:${color}"><path d="${path}"/></svg>`;

// Battery mode. Methods are mixed into EvccCard.prototype.
//
// Everything the view shows comes from entities and the HA recorder, so it
// works for every evcc setup. What the optimizer adds (the suggestion per
// battery, the SoC forecast, highest/lowest) shows up on its own once the data
// is there; there is no option for it, and without data nothing hints at it.
// `hide_soc_chart: true` leaves the chart out, and with it the recorder query;
// highest/lowest and the recompute button stay in the status.
export const batteryView = {
  _renderBatteryBlock(site) {
    if (!site.battery_soc) return "";
    const forecast = this._battForecast();
    return `
      <div class="battery-block">
        <div class="lp-header">
          ${this._renderSiteDisabledWarn(site)}
          <span class="lp-name">${escHtml(this._config.title || this._t("homeBattery"))}</span>
        </div>
        ${this._renderBattStatus(site, forecast)}
        ${this._config.hide_soc_chart === true ? "" : this._renderBattHistory(site, forecast)}
        ${this._renderBattSettings(site)}
      </div>`;
  },

  // ── Status ──────────────────────────────────────────────────────────────

  // The batteries evcc reports one by one (battery_0 … battery_3). An index
  // without a SoC (ha-evcc creates the entities up front) does not count.
  _battDevices(site) {
    const out = [];
    for (let i = 0; i < 4; i++) {
      const socId = site[`battery_${i}_soc`];
      const soc   = socId ? parseFloat(stateVal(this._hass, socId)) : NaN;
      if (isNaN(soc)) continue;
      const pId   = site[`battery_${i}_power`];
      const power = pId ? parseFloat(stateVal(this._hass, pId)) : NaN;
      out.push({ index: i, socId, powerId: pId, soc, power: isNaN(power) ? null : power, suggestion: this._battSuggestion(socId) });
    }
    return out;
  },

  // The optimizer's suggestion for the current slot, an attribute of the
  // per-battery SoC sensor. Like evcc, the card only shows it when it differs
  // from what the battery does anyway (actionable).
  _battSuggestion(socId) {
    const s = attr(this._hass, socId, "suggestion");
    if (!s || !s.actionable || !SUGGESTION_ACTIONS.includes(s.action)) return null;
    return s;
  },

  // A number in the HA language ("2,9" in German), at most `d` decimals.
  _battNum(v, d = 1) {
    return Number(v).toLocaleString(this._hass?.language || "en", { maximumFractionDigits: d });
  },

  // evcc's power sign: positive discharges, negative charges.
  _battPowerText(power) {
    if (power == null) return "";
    if (Math.abs(power) < 50) return this._t("battIdle");
    const kw = `${this._battNum(Math.abs(power) / 1000)} kW`;
    return power > 0 ? this._t("battDischarging", { power: kw }) : this._t("battCharging", { power: kw });
  },

  _battSocColor(soc) {
    return soc > 80 ? "var(--evcc-green)" : soc > 30 ? "var(--evcc-blue)" : "var(--evcc-amber)";
  },

  _renderBattStatus(site, forecast) {
    const soc     = parseFloat(stateVal(this._hass, site.battery_soc)) || 0;
    const power   = site.battery_power ? parseFloat(stateVal(this._hass, site.battery_power)) : NaN;
    const cap     = site.battery_capacity ? parseFloat(stateVal(this._hass, site.battery_capacity)) : NaN;
    const devices = this._battDevices(site);
    const color   = this._battSocColor(soc);

    const energy = cap > 0
      ? `<div class="batt-stat"${moreInfo(site.battery_capacity)}><span class="batt-stat-label">${this._t("battEnergy")}</span><span class="batt-stat-val">${this._t("battOfTotal", { val: this._battNum(soc / 100 * cap), total: `${this._battNum(cap)} kWh` })}</span></div>`
      : "";
    const powerHtml = !isNaN(power)
      ? `<div class="batt-stat"${moreInfo(site.battery_power)}><span class="batt-stat-label">${this._t("battPower")}</span><span class="batt-stat-val">${this._battPowerText(power)}</span></div>`
      : "";

    // One battery: its suggestion goes into the summary. Several: each row
    // carries its own, the summary only the combined values.
    const single     = devices.length <= 1;
    const suggestion = single ? devices[0]?.suggestion : null;
    const suggestionId = single ? devices[0]?.socId : null;
    const rows = !single ? devices.map(d => `
        <div class="batt-dev-row">
          <span class="batt-dev-name"${moreInfo(d.socId)}>${this._t("battDevice", { n: d.index + 1 })}</span>
          <span class="batt-dev-bar"><span style="width:${Math.min(d.soc, 100)}%;background:${this._battSocColor(d.soc)}"></span></span>
          <span class="batt-dev-soc"${moreInfo(d.socId)}>${Math.round(d.soc)} %</span>
          <span class="batt-dev-power"${moreInfo(d.powerId)}>${this._battPowerText(d.power)}</span>
          ${d.suggestion ? this._renderBattSuggestion(d.suggestion, d.socId) : ""}
        </div>`).join("") : "";

    return `
      <div class="batt-status">
        <div class="batt-status-main">
          <span class="batt-status-icon" style="color:${color}"${moreInfo(site.battery_soc)}>${icon(MDI.battery, 32, color)}</span>
          <span class="batt-status-soc" style="color:${color}"${moreInfo(site.battery_soc)}>${Math.round(soc)} %</span>
          <div class="batt-status-stats">${energy}${powerHtml}</div>
        </div>
        <div class="batt-soc-bar"><span style="width:${Math.min(soc, 100)}%;background:${color}"></span></div>
        ${suggestion || forecast ? `<div class="batt-optimizer">
          ${suggestion ? this._renderBattSuggestion(suggestion, suggestionId) : ""}
          ${this._renderBattExtremes(forecast)}
          ${forecast ? this._renderBattRecompute(site) : ""}
        </div>` : ""}
        ${rows ? `<div class="batt-devs">${rows}</div>` : ""}
      </div>`;
  },

  // The suggestion is an attribute of the battery's SoC sensor, its more-info
  // dialog shows it.
  _renderBattSuggestion(s, socId) {
    return `<span class="batt-suggestion" data-suggestion="${s.action}" title="${this._t("battSuggestion")}"${moreInfo(socId)}>
        ${icon(MDI.lightbulb, 14)}<span>${this._t(`battAction_${s.action}`)}</span>
      </span>`;
  },

  // evcc's "optimize" button (ha-evcc 2026.10.2+); turns while evcc computes.
  _renderBattRecompute(site) {
    if (!isLive(this._hass, site.optimize)) return "";
    const busy  = this._battOptimizeBusy();
    const label = escAttr(this._t("battRecompute"));
    return `<button type="button" class="batt-recompute${busy ? " busy" : ""}" data-entity="${escAttr(site.optimize)}"
        title="${label}" aria-label="${label}"${busy ? ` aria-busy="true" disabled` : ""}>${icon(MDI.refresh, 16)}</button>`;
  },

  // "Highest / lowest" from the forecast; past points are left out.
  _renderBattExtremes(forecast) {
    if (!forecast) return "";
    const now = Date.now();
    const point = (p, high) => {
      const t = evccDate(p?.time);
      if (!t || t.getTime() < now) return "";
      const val = p.limit ? this._t(high ? "battFull" : "battEmpty") : `${Math.round(p.soc)} %`;
      return `<span class="batt-extreme">${this._t(high ? "battHighest" : "battLowest", { val })} · ${this._battTimeLabel(t)}</span>`;
    };
    return point(forecast.highest, true) + point(forecast.lowest, false);
  },

  // "14:30", "morgen 06:15" or "Fr 06:15" relative to today.
  _battTimeLabel(d) {
    const lang  = this._hass?.language || "en";
    const clock = d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" });
    const day   = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff  = Math.round((day(d) - day(new Date())) / DAY);
    if (diff === 0) return clock;
    if (diff === 1) return `${this._t("battTomorrow")} ${clock}`;
    return `${d.toLocaleDateString(lang, { weekday: "short" })} ${clock}`;
  },

  // ── Optimizer forecast ─────────────────────────────────────────────────
  // ha-evcc command evcc_intg/optimizer passes evcc's data through as it is:
  //   { evopt: <evcc's optimizer result>, batteryForecast: { highest, lowest } }
  // both null while the optimizer is off. The card converts it the way evcc's
  // own battery view does (assets/js/components/Battery/history.ts). Null while
  // the command is missing, pending, failed or there is nothing to show.
  _battForecast() {
    if (!this._hasCmd("optimizer")) return null;
    const data = this._wsFetch("evcc_intg/optimizer", {}, "optimizer", FORECAST_TTL)?.data;
    if (!data) return null;
    const series = this._battForecastSeries(data.evopt);
    const bf     = data.batteryForecast;
    if (!series.length && !bf?.highest && !bf?.lowest) return null;
    return { series, highest: bf?.highest ?? null, lowest: bf?.lowest ?? null };
  },

  // Called by every write (actions.js). After an accepted write of the grid
  // charge limit or grid discharging, evcc's "optimize" button is pressed when
  // there is one (an evcc that computes again on its own ignores the second
  // start while running), and the forecast is asked for again; an answer that
  // has not changed draws nothing (_wsFetch).
  _battForecastWritten(entityId, call) {
    const site = this._cachedEntities?.site;
    if (this._config.mode !== "battery" || !site || !this._hasCmd("optimizer")) return;
    if (entityId !== site.battery_grid_charge_limit && entityId !== site.battery_grid_discharge) return;
    Promise.resolve(call).then(() => {
      if (this._battForecast() && isLive(this._hass, site.optimize)) this._battOptimize(site.optimize);
      else this._battForecastRecheck();
    }, () => {});
  },

  _battForecastRecheck() {
    for (const ms of FORECAST_RECHECK) {
      setTimeout(() => {
        if (this.isConnected) this._wsFetch("evcc_intg/optimizer", {}, "optimizer", 0);
      }, ms);
    }
  },

  // Starts an optimizer run in evcc. The button turns from the press until an
  // answer differs from the one before it, at most FORECAST_BUSY; a refused
  // press stops it at once.
  _battOptimize(buttonId) {
    const run = { json: this._wsCache.optimizer?.json, until: Date.now() + FORECAST_BUSY };
    this._battOptimizing = run;
    const end = () => {
      if (this._battOptimizing !== run) return;
      this._battOptimizing = null;
      if (this.isConnected) this._render();
    };
    Promise.resolve(this._pressButton(buttonId)).then(() => this._battForecastRecheck(), end);
    setTimeout(end, FORECAST_BUSY + 50);
    this._render();
  },

  _battOptimizeBusy() {
    const run = this._battOptimizing;
    if (!run) return false;
    if (Date.now() > run.until || this._wsCache.optimizer?.json !== run.json) {
      this._battOptimizing = null;
      return false;
    }
    return true;
  },

  // The combined SoC curve of the home batteries in percent. evcc lists
  // vehicles among the batteries too (type "vehicle"); the details at the same
  // index say which is which. The SoC comes in Wh: summed over the batteries
  // and divided by their summed capacity (kWh), as evcc's combined view does.
  _battForecastSeries(evopt) {
    const bats = evopt?.res?.batteries;
    const ts   = evopt?.details?.timestamp;
    if (!Array.isArray(bats) || !Array.isArray(ts)) return [];
    const homes = bats
      .map((b, i) => ({ soc: b?.state_of_charge, det: evopt.details.batteryDetails?.[i] }))
      .filter(h => h.det?.type === "battery" && h.det.capacity > 0 && Array.isArray(h.soc));
    if (!homes.length) return [];
    const capWh = homes.reduce((a, h) => a + h.det.capacity * 1000, 0);
    const out = [];
    ts.forEach((iso, j) => {
      const t = evccDate(iso)?.getTime();
      if (t == null || homes.some(h => typeof h.soc[j] !== "number")) return;
      out.push({ t, v: homes.reduce((a, h) => a + h.soc[j], 0) / capWh * 100 });
    });
    return out;
  },

  // ── History chart ──────────────────────────────────────────────────────

  // The window of the chart. Without a forecast it ends at "now" and spans two
  // days back; with one it runs from a day back to a day ahead. Paging moves it
  // by a day.
  _battWindow(hasForecast) {
    const offset = this._battHistOffset ?? 0;
    const now    = Date.now();
    const end    = now + offset * DAY + (hasForecast ? DAY : 0);
    return { start: end - 2 * DAY, end, now, offset };
  },

  // The SoC history from the HA recorder, cached per window (by its start
  // hour, so a window that moves with the clock or with the forecast fetches
  // anew). Past windows don't change; the one reaching "now" is refetched
  // every five minutes.
  _battHistory(entityId, start, end) {
    const key    = `${entityId}|${Math.floor(start / HOUR)}`;
    this._battHistCache    ??= {};
    this._battHistInflight ??= {};
    const cached = this._battHistCache[key];
    const ttl    = end >= Date.now() - HOUR ? 5 * 60 * 1000 : 60 * 60 * 1000;
    if ((!cached || Date.now() - cached.ts > ttl) && !this._battHistInflight[key] && this._hass?.callWS) {
      this._battHistInflight[key] = this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(start).toISOString(),
        end_time:   new Date(end).toISOString(),
        entity_ids: [entityId],
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      }).then(res => {
        const pts = this._battDownsample((res?.[entityId] ?? [])
          .map(s => ({ t: (s.lu ?? s.lc ?? 0) * 1000, v: parseFloat(s.s) }))
          .filter(p => !isNaN(p.v)), HIST_STEP);
        // Keep the cache bounded: paging through 30 days leaves 30 windows.
        const keys = Object.keys(this._battHistCache);
        if (keys.length > 40) for (const k of keys.slice(0, keys.length - 40)) delete this._battHistCache[k];
        this._battHistCache[key] = { ts: Date.now(), points: pts };
      }).catch(e => {
        console.warn("[evcc-card] history failed:", e?.message || e);
        this._battHistCache[key] = { ts: Date.now(), points: [] };
      }).finally(() => {
        delete this._battHistInflight[key];
        this._render();
      });
    }
    return cached ? cached.points : null;
  },

  // Time-weighted means per `step`: each state holds until the next one. A
  // sensor that reports every few seconds would otherwise put tens of thousands
  // of points into the SVG, and a state held for seconds (a reconnect that
  // reports 0 %) would draw a spike. The last state is kept as it is.
  _battDownsample(pts, step) {
    if (pts.length < 2) return pts;
    const out = [];
    let b0 = Math.floor(pts[0].t / step) * step, acc = 0, dur = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const v = pts[i].v, next = pts[i + 1].t;
      let t = pts[i].t;
      while (t < next) {
        const seg = Math.min(next, b0 + step) - t;
        acc += v * seg; dur += seg; t += seg;
        if (t >= b0 + step) {
          if (dur > 0) out.push({ t: b0, v: acc / dur });
          b0 += step; acc = 0; dur = 0;
        }
      }
    }
    if (dur > 0) out.push({ t: b0, v: acc / dur });
    out.push(pts[pts.length - 1]);
    return out;
  },

  _renderBattHistory(site, forecast) {
    const fSeries = forecast?.series ?? [];
    const win     = this._battWindow(fSeries.length > 0);
    const histEnd = Math.min(win.end, win.now);
    const hist    = this._battHistory(site.battery_soc, win.start, histEnd);

    // Clip to the window: the cache may hold a wider range (fetched before
    // the forecast arrived). The last state before the window holds at its
    // left edge.
    const inWin  = hist ? hist.filter(p => p.t >= win.start && p.t <= histEnd) : [];
    const before = hist ? hist.filter(p => p.t < win.start).pop() : null;
    let points = before ? [{ t: win.start, v: before.v }, ...inWin] : inWin;
    // The live state closes the line at "now"; the recorder may lag behind.
    if (win.offset === 0) {
      const live = parseFloat(stateVal(this._hass, site.battery_soc));
      if (!isNaN(live)) points.push({ t: win.now, v: live });
    }
    // The forecast continues from there; the slot that is running already is
    // covered by the live value.
    const fut = fSeries.filter(p => p.t > win.now && p.t <= win.end);
    if (fut.length && points.length) fut.unshift(points[points.length - 1]);

    const W = 400, H = 120, ML = 26, MR = 4, MT = 6, MB = 18;
    const CW = W - ML - MR, CH = H - MT - MB;
    const x = t => ML + (t - win.start) / (win.end - win.start) * CW;
    const y = v => MT + (1 - Math.max(0, Math.min(100, v)) / 100) * CH;
    const path = pts => pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
    const area = pts => pts.length ? `${path(pts)}L${x(pts[pts.length - 1].t).toFixed(1)},${y(0)}L${x(pts[0].t).toFixed(1)},${y(0)}Z` : "";

    const grid = [0, 25, 50, 75, 100].map(v =>
      `<line x1="${ML}" x2="${W - MR}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider-color,#444)" stroke-width="0.5"/>` +
      `<text x="${ML - 4}" y="${y(v) + 3}" text-anchor="end" font-size="7" fill="var(--secondary-text-color,#888)">${v}</text>`).join("");

    // Hour ticks every six hours; midnight carries the weekday.
    const lang = this._hass?.language || "en";
    let ticks = "";
    const first = new Date(win.start); first.setMinutes(0, 0, 0);
    for (let t = first.getTime() + HOUR; t < win.end; t += HOUR) {
      const d = new Date(t);
      if (d.getHours() % 6) continue;
      const lbl = d.getHours() === 0 ? d.toLocaleDateString(lang, { weekday: "short" }) : `${d.getHours()}`;
      ticks += `<line x1="${x(t)}" x2="${x(t)}" y1="${MT}" y2="${MT + CH}" stroke="var(--divider-color,#444)" stroke-width="${d.getHours() === 0 ? 0.8 : 0.3}"/>` +
        `<text x="${x(t)}" y="${H - 6}" text-anchor="middle" font-size="7" fill="var(--secondary-text-color,#888)">${lbl}</text>`;
    }

    // Priority and buffer SoC as reference lines.
    const ref = (id, color) => {
      const v = id ? parseFloat(stateVal(this._hass, id)) : NaN;
      return v > 0 && v < 100 ? `<line x1="${ML}" x2="${W - MR}" y1="${y(v)}" y2="${y(v)}" stroke="${color}" stroke-width="0.8" stroke-dasharray="2 2" opacity="0.8"/>` : "";
    };

    const nowLine = win.now > win.start && win.now < win.end
      ? `<line x1="${x(win.now)}" x2="${x(win.now)}" y1="${MT}" y2="${MT + CH}" stroke="var(--primary-text-color,#fff)" stroke-width="0.6" opacity="0.6"/>` : "";

    const loading = hist === null;
    const svg = `
      <svg viewBox="0 0 ${W} ${H}" class="batt-chart-svg" role="img" aria-label="${this._t("battHistory")}">
        <defs>
          <pattern id="batt-stripes" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" stroke="var(--evcc-blue)" stroke-width="1.5" opacity="0.35"/>
          </pattern>
        </defs>
        ${grid}${ticks}
        ${ref(site.priority_soc, "var(--evcc-blue)")}${ref(site.buffer_soc, "var(--evcc-bolt)")}
        ${points.length > 1 ? `<path d="${area(points)}" fill="var(--evcc-blue)" opacity="0.15"/><path d="${path(points)}" fill="none" stroke="var(--evcc-blue)" stroke-width="1.5" stroke-linejoin="round"/>` : ""}
        ${fut.length > 1 ? `<path d="${area(fut)}" fill="url(#batt-stripes)"/><path d="${path(fut)}" fill="none" stroke="var(--evcc-blue)" stroke-width="1.5" stroke-dasharray="4 3"/>` : ""}
        ${nowLine}
      </svg>`;

    const canPrev = win.offset > HIST_MIN_OFFSET;
    const canNext = win.offset < 0;
    return `
      <div class="batt-section">
        <div class="batt-section-head">
          <span class="batt-section-title"${moreInfo(site.battery_soc)}>${this._t("battHistory")}</span>
          <span class="batt-stepper">
            <button class="batt-step" data-batt-step="-1" ${canPrev ? "" : "disabled"} aria-label="${this._t("battPrevDay")}">‹</button>
            <span class="batt-step-label">${win.offset === 0 ? this._t("battNow") : this._t("battDaysAgo", { n: -win.offset })}</span>
            <button class="batt-step" data-batt-step="1" ${canNext ? "" : "disabled"} aria-label="${this._t("battNextDay")}">›</button>
          </span>
        </div>
        <div class="batt-chart${loading ? " loading" : ""}"${moreInfo(site.battery_soc)}>${svg}</div>
      </div>`;
  },

  // ── Settings ───────────────────────────────────────────────────────────
  // As in evcc's battery settings: one tab each for the battery usage, grid
  // charging and grid discharging, every switch in a row with the sentence
  // that says what it does. A tab whose entities ha-evcc does not provide is
  // left out; grid discharging (experimental in evcc) mostly is.

  _battTabs(site) {
    const has = id => isLive(this._hass, id);
    return [
      { key: "usage",     label: this._t("battTabUsage"),         show: has(site.priority_soc) || has(site.buffer_soc) || has(site.battery_discharge_control) },
      { key: "charge",    label: this._t("battTabGridCharge"),    show: has(site.battery_grid_charge_limit) },
      { key: "discharge", label: this._t("battTabGridDischarge"), show: has(site.battery_grid_discharge) },
    ].filter(tab => tab.show);
  },

  _renderBattSettings(site) {
    const tabs = this._battTabs(site);
    if (!tabs.length) return "";
    if (this._battTab === undefined) this._battTab = readTab(this._getPrefix());
    const cur  = tabs.find(tab => tab.key === this._battTab) ? this._battTab : tabs[0].key;
    const body = cur === "charge" ? this._renderBattGridCharge(site)
      : cur === "discharge" ? this._renderBattGridDischarge(site)
      : this._renderBattUsage(site);
    const head = tabs.length > 1
      ? `<div class="batt-tabs" role="tablist">${tabs.map(tab =>
          `<button class="batt-tab${tab.key === cur ? " active" : ""}" role="tab" aria-selected="${tab.key === cur}" data-batt-tab="${tab.key}">${tab.label}</button>`).join("")}</div>`
      : `<div class="batt-section-head"><span class="batt-section-title">${tabs[0].label}</span></div>`;
    return `<div class="batt-section">${head}<div class="batt-tab-body">${body}</div></div>`;
  },

  // A switch on the right of the sentence that says what it does.
  _battSwitchRow(desc, attrs, on, infoId) {
    return `
      <div class="batt-switch-row">
        <span class="batt-switch-desc"${moreInfo(infoId)}>${desc}</span>
        <button class="batt-discharge-toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}" data-on="${on}" ${attrs}>
          <span class="batt-toggle-knob"></span>
        </button>
      </div>`;
  },

  _renderBattUsage(site) {
    const val = id => {
      if (!id) return null;
      const v = parseFloat(stateVal(this._hass, id));
      return isNaN(v) ? null : v;
    };
    const opts = id => id ? (attr(this._hass, id, "options") ?? [])
      .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b) : [];

    const priorityVal    = val(site.priority_soc);
    // evcc reads a buffer SoC of 0 as 100, i.e. no buffer; ha-evcc then
    // reports no value at all.
    const bufferVal      = isLive(this._hass, site.buffer_soc) ? (val(site.buffer_soc) || 100) : null;
    const bufferStartVal = val(site.buffer_start_soc);

    const bufferOpts      = opts(site.buffer_soc).filter(o => (priorityVal === null || o >= priorityVal) && (bufferStartVal === null || bufferStartVal === 0 || o <= bufferStartVal));
    const bufferStartOpts = opts(site.buffer_start_soc).filter(o => o === 0 || bufferVal === null || o >= bufferVal);
    const priorityOpts    = opts(site.priority_soc).filter(o => bufferVal === null || o <= bufferVal);
    const bufferStartLabel = o => o === 0 ? this._t("battBufferStartNever")
      : o === 100 ? this._t("battBufferStartFull") : this._t("battBufferStartAbove", { soc: `${o} %` });

    const inlineSelect = (entityId, v, filtered, labelFn) => {
      if (!entityId || v === null || !filtered.length) return "";
      const options = filtered.map(o =>
        `<option value="${o}"${o === v ? " selected" : ""}>${labelFn ? labelFn(o) : `${o} %`}</option>`).join("");
      return `<select class="batt-inline-select" data-entity="${entityId}">${options}</select>`;
    };

    const item = (path, title, text, id) => `
      <div class="batt-text-item">
        <span class="batt-text-icon">${icon(path, 18, "var(--primary-color)")}</span>
        <div><div class="batt-text-title"${moreInfo(id)}>${title}</div><div class="batt-text-desc">${text}</div></div>
      </div>`;

    const items = [];
    if (site.priority_soc && priorityVal !== null) {
      const sel = inlineSelect(site.priority_soc, priorityVal, priorityOpts);
      items.push(item(MDI.sun, this._t("battPriorityTitle"),
        this._t(priorityVal > 0 ? "battPriority" : "battPriorityNone", { soc: sel }), site.priority_soc));
    }
    if (site.buffer_soc && bufferVal !== null) {
      const sel   = inlineSelect(site.buffer_soc, bufferVal, bufferOpts);
      const start = inlineSelect(site.buffer_start_soc, bufferStartVal, bufferStartOpts, bufferStartLabel);
      items.push(item(MDI.bolt, this._t("battBufferTitle"),
        this._t(bufferVal < 100 ? "battBuffer" : "battBufferNone", { soc: sel, start }), site.buffer_soc));
    }
    const lock = isLive(this._hass, site.battery_discharge_control)
      ? this._battSwitchRow(this._t("battDischargeLock"),
          `data-entity="${site.battery_discharge_control}" data-domain="switch"`, isOn(this._hass, site.battery_discharge_control), site.battery_discharge_control)
      : "";
    return `<div class="batt-text-col">${items.join("")}</div>${lock}`;
  },

  // ── Grid charging and discharging ──────────────────────────────────────
  // evcc compares a tariff with a limit; the limit is switched on by setting
  // it and off by removing it (ha-evcc's clear button). Without the button the
  // limit can only be changed, so its switch is left out.

  _renderBattGridCharge(site) {
    const limitId = site.battery_grid_charge_limit;
    const isCo2   = (attr(this._hass, limitId, "unit_of_measurement") ?? "") === "g/kWh";
    return this._renderBattLimit({
      key: "charge", limitId, activeId: site.battery_grid_charge_active,
      desc: this._t("battGridChargeDesc"), label: this._t(isCo2 ? "battCo2Limit" : "battPriceLimit"),
      kind: "planner", hit: (v, limit) => v <= limit,
    });
  },

  // One switch for the whole of it: on allows discharging into the grid and
  // sets the limit to the feed-in rate of the moment, off disallows it and evcc
  // drops the limit itself. evcc refuses a limit while discharging is not
  // allowed, so the limit shows only while it is; the feed-in rates always do,
  // as the grid rates do on the grid charging tab.
  _renderBattGridDischarge(site) {
    const allowId = site.battery_grid_discharge;
    const allowed = isOn(this._hass, allowId);
    const limitId = isLive(this._hass, site.battery_grid_discharge_limit) ? site.battery_grid_discharge_limit : null;
    const row = this._battSwitchRow(
      `${this._t("battGridDischargeDesc")} <span class="batt-experimental">${this._t("battExperimental")}</span>`,
      `data-batt-discharge="${allowId}" data-limit="${limitId ?? ""}"`, allowed, allowId);
    if (!allowed || !limitId) return row + (this._battSlots("feedin", null, () => false)?.html ?? "");
    return row + this._renderBattLimit({
      limitId, activeId: site.battery_grid_discharge_active, label: this._t("battFeedInLimit"),
      kind: "feedin", hit: (v, limit) => v >= limit, noSwitch: true,
    });
  },

  // `noSwitch`: the limit is switched with something else (grid discharging),
  // only its slider shows.
  _renderBattLimit({ key, limitId, activeId, desc, label, kind, hit, noSwitch = false }) {
    const limit   = parseFloat(stateVal(this._hass, limitId));
    const set     = !isNaN(limit);
    const clearId = noSwitch ? null : this._limitClear(limitId);
    const active  = activeId ? isOn(this._hass, activeId) : false;
    const row = noSwitch ? ""
      : clearId
      ? this._battSwitchRow(desc, `aria-label="${escAttr(label)}" data-batt-limit="${key}" data-entity="${limitId}" data-clear="${clearId}" data-kind="${kind}"`, set, limitId)
      : `<div class="batt-switch-row"><span class="batt-switch-desc"${moreInfo(limitId)}>${desc}</span></div>`;
    const slots = this._battSlots(kind, set ? limit : null, hit);
    const time  = set ? `
        <div class="batt-active-row">
          <span>${this._t("battActiveTime")}</span>
          <span class="batt-active-val">
            ${active ? `<span class="batt-chip active"${moreInfo(activeId)}>${icon(MDI.grid, 12)} ${this._t("battActiveNow")}</span>` : ""}
            ${slots ? this._t("battActiveHours", { active: `${this._battNum(slots.hours)} h`, total: "24 h" }) : ""}
          </span>
        </div>` : "";
    return `
      ${row}
      ${set || !clearId ? this._sliderRow(limitId, label, null, false, this._t("battNoLimit")) : ""}
      ${time}
      ${slots ? slots.html : ""}`;
  },

  // The tariff slots of the next 24 hours, the ones that meet the limit
  // highlighted: when evcc would charge from or discharge into the grid.
  // { html, hours } or null without a forecast.
  _battSlots(kind, limit, hit) {
    const res   = this._wsForecast(kind);
    const rates = res?.data?.rates;
    if (!Array.isArray(rates) || !rates.length) return null;
    const now = Date.now();
    const end = now + DAY;
    const slots = rates.map(r => ({ s: evccDate(r.start)?.getTime(), e: evccDate(r.end)?.getTime(), v: r.value }))
      .filter(r => r.s != null && r.e != null && r.e > now && r.s < end && typeof r.v === "number");
    if (!slots.length) return null;

    // The feed-in tariff is always a price; the planner follows the cost type.
    const isCo2 = kind === "planner" && res.data.smartCostType === "co2";
    const unit  = isCo2 ? "g/kWh" : `${res.data.currency ? escHtml(res.data.currency) : ""}/kWh`;
    const fmt   = v => `${this._battNum(v, isCo2 ? 0 : 3)} ${unit}`;
    const vals  = slots.map(r => r.v);
    const min   = Math.min(...vals), max = Math.max(...vals);
    const lo    = Math.min(min, 0);
    const span  = (max - lo) || 1;

    const W = 400, H = 44, MB = 12;
    const bw = W / slots.length;
    const lang = this._hass?.language || "en";
    let activeMs = 0;
    // Charging green, discharging amber, as evcc tells the two apart.
    const hitColor = kind === "feedin" ? "var(--evcc-amber)" : "var(--evcc-green)";
    const bars = slots.map((r, i) => {
      const on = limit !== null && hit(r.v, limit);
      if (on) activeMs += Math.min(r.e, end) - Math.max(r.s, now);
      const h = Math.max(2, (r.v - lo) / span * (H - MB - 2));
      const d = new Date(r.s);
      const tick = d.getMinutes() === 0 && d.getHours() % 6 === 0
        ? `<text x="${i * bw + bw / 2}" y="${H - 2}" text-anchor="middle" font-size="7" fill="var(--secondary-text-color,#888)">${d.getHours()}</text>` : "";
      return `<rect x="${(i * bw + 0.3).toFixed(1)}" y="${(H - MB - h).toFixed(1)}" width="${Math.max(0.5, bw - 0.6).toFixed(1)}" height="${h.toFixed(1)}" rx="0.5"
          fill="${on ? hitColor : "var(--secondary-text-color,#888)"}" opacity="${on ? 0.9 : 0.3}"><title>${d.toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })} · ${fmt(r.v)}</title></rect>${tick}`;
    }).join("");

    return {
      hours: activeMs / HOUR,
      html: `
      <div class="batt-slots">
        <svg viewBox="0 0 ${W} ${H}" class="batt-slots-svg">${bars}</svg>
        <div class="batt-slots-legend"><span>${this._t(kind === "feedin" ? "battFeedInRate" : isCo2 ? "battCo2Rate" : "battGridRate")}</span><span>${fmt(min)} – ${fmt(max)}</span></div>
      </div>`,
    };
  },

  // The value a limit starts with when it is switched on: the tariff right
  // now, so nothing happens until the price moves; within the entity's range.
  _battLimitStart(limitId, kind) {
    const now   = Date.now();
    const rate  = this._wsForecast(kind)?.data?.rates?.find(r =>
      evccDate(r.start)?.getTime() <= now && evccDate(r.end)?.getTime() > now);
    const unit  = attr(this._hass, limitId, "unit_of_measurement") ?? "";
    const sensor = `sensor.${this._getPrefix()}${kind === "feedin" ? "tariff_feed_in" : unit === "g/kWh" ? "tariff_co2" : "tariff_grid"}`;
    let v = typeof rate?.value === "number" ? rate.value : parseFloat(stateVal(this._hass, sensor));
    const min  = attr(this._hass, limitId, "min") ?? 0;
    const max  = attr(this._hass, limitId, "max") ?? 1;
    const step = attr(this._hass, limitId, "step") ?? 0.005;
    if (isNaN(v)) v = Math.max(min, 0);
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    return Number(v.toFixed(6));
  },

  // Listeners of the battery view: the discharge toggle, the inline selects
  // and the history stepper. Called by _attachListeners() after every render.
  _attachBatteryListeners() {
    // One listener for every switch of the view, deciding by the element's
    // attributes at the time of the click: a render morphs one tab into the
    // next, and a button that was the discharge lock a moment ago may be the
    // grid charging switch now, with the listener it was given back then.
    this._fresh("button.batt-discharge-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on = btn.dataset.on === "true";
        const d  = btn.dataset;
        if (d.battLimit) {
          if (on) this._clearLimit(d.clear, d.entity);
          else    this._setNumberValue(d.entity, this._battLimitStart(d.entity, d.kind));
        } else if (d.battDischarge) {
          const limit = d.limit || null;
          this._setGridDischarge(d.battDischarge, limit, !on, limit ? this._battLimitStart(limit, "feedin") : null);
        } else if (d.entity) {
          this._toggleEntity(d.domain, d.entity, on);
        }
        this._render();
      });
    });

    this._fresh("button.batt-recompute").forEach(btn => {
      btn.addEventListener("click", () => { if (!btn.disabled) this._battOptimize(btn.dataset.entity); });
    });

    this._fresh(".batt-inline-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._setSelectOption(sel.dataset.entity, sel.value);
      });
      sel.addEventListener("click", e => e.stopPropagation());
    });

    this._fresh("button.batt-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        this._battTab = btn.dataset.battTab;
        rememberTab(this._getPrefix(), this._battTab);
        this._render();
      });
    });

    this._fresh("button.batt-step").forEach(btn => {
      btn.addEventListener("click", () => {
        const next = (this._battHistOffset ?? 0) + Number(btn.dataset.battStep);
        this._battHistOffset = Math.max(HIST_MIN_OFFSET, Math.min(0, next));
        this._render();
      });
    });
  },
};

// Battery mode.
// Part of the card stylesheet, see src/styles.js.
export const batteryCss = `
      .battery-block { padding: 0; display: flex; flex-direction: column; gap: 14px; }
      .battery-block [data-more-info] { cursor: pointer; }
      .battery-block [data-more-info]:hover { opacity: .75; }
      .battery-block .lp-header { margin-bottom: 0; }
      .batt-status { display: flex; flex-direction: column; gap: 8px; }
      .batt-status-main { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .batt-status-icon { display: flex; }
      .batt-status-soc { font-size: 1.9rem; font-weight: 700; line-height: 1; }
      .batt-status-stats { display: flex; gap: 16px; margin-left: auto; flex-wrap: wrap; }
      .batt-stat { display: flex; flex-direction: column; gap: 1px; }
      .batt-stat-label { font-size: .7rem; color: var(--secondary-text-color); }
      .batt-stat-val { font-size: .84rem; font-weight: 600; white-space: nowrap; }
      .batt-soc-bar, .batt-dev-bar { display: block; height: 6px; border-radius: 3px; background: var(--divider-color, #333); overflow: hidden; }
      .batt-soc-bar > span, .batt-dev-bar > span { display: block; height: 100%; border-radius: 3px; transition: width .4s; }
      .batt-optimizer { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: .76rem; color: var(--secondary-text-color); }
      .batt-suggestion { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; background: color-mix(in srgb, var(--evcc-bolt) 18%, transparent); color: var(--primary-text-color); font-size: .74rem; }
      .batt-extreme { white-space: nowrap; }
      .batt-recompute { margin-left: auto; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: none; border-radius: 50%; background: none; color: var(--secondary-text-color); cursor: pointer; }
      .batt-recompute:hover { color: var(--primary-text-color); background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); }
      .batt-recompute:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      .batt-recompute.busy { cursor: progress; }
      .batt-recompute.busy svg { animation: batt-spin 1s linear infinite; }
      @keyframes batt-spin { to { transform: rotate(360deg); } }
      .batt-devs { display: flex; flex-direction: column; gap: 6px; }
      .batt-dev-row { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; align-items: center; font-size: .78rem; }
      .batt-dev-power { grid-column: 1 / -1; color: var(--secondary-text-color); font-size: .72rem; }
      .batt-dev-row .batt-suggestion { grid-column: 1 / -1; justify-self: start; }
      .batt-dev-soc { font-weight: 600; }
      .batt-section { display: flex; flex-direction: column; gap: 8px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); }
      .batt-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .batt-section-title { font-size: .82rem; font-weight: 600; }
      .batt-stepper { display: inline-flex; align-items: center; gap: 4px; font-size: .74rem; color: var(--secondary-text-color); }
      .batt-step { background: none; border: none; color: var(--primary-text-color); font-size: 1rem; line-height: 1; padding: 2px 6px; cursor: pointer; border-radius: 4px; }
      .batt-step:disabled { opacity: .3; cursor: default; }
      .batt-step-label { min-width: 64px; text-align: center; }
      .batt-chart-svg, .batt-slots-svg { width: 100%; display: block; }
      .batt-chart.loading { opacity: .5; }
      .batt-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
      .batt-tab { padding: 3px 12px; border-radius: 999px; border: 1px solid var(--divider-color, #e5e7eb); background: transparent; color: var(--secondary-text-color); cursor: pointer; font-size: .76rem; font-weight: 600; font-family: inherit; }
      .batt-tab.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .batt-tab-body { display: flex; flex-direction: column; gap: 12px; padding-top: 4px; }
      .batt-switch-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; font-size: .8rem; line-height: 1.4; }
      .batt-switch-desc { flex: 1; min-width: 0; }
      .batt-active-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: .76rem; color: var(--secondary-text-color); }
      .batt-active-val { display: inline-flex; align-items: center; gap: 8px; color: var(--primary-text-color); font-weight: 600; }
      .batt-experimental { font-size: .7rem; color: var(--secondary-text-color); }
      .batt-chip { display: inline-flex; align-items: center; gap: 4px; font-size: .72rem; padding: 2px 8px; border-radius: 10px; background: var(--divider-color, #333); }
      .batt-chip.active { background: color-mix(in srgb, var(--evcc-green) 22%, transparent); }
      .batt-slots-legend { display: flex; justify-content: space-between; gap: 8px; font-size: .72rem; color: var(--secondary-text-color); margin-top: 2px; }
      .batt-text-col { display: flex; flex-direction: column; gap: 12px; overflow-wrap: anywhere; }
      .batt-text-item { display: flex; gap: 8px; align-items: flex-start; }
      .batt-text-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      .batt-text-title { font-size: .82rem; font-weight: 600; margin-bottom: 2px; }
      .batt-text-desc  { font-size: .76rem; color: var(--secondary-text-color); line-height: 1.4; }
      .batt-inline-select { color: var(--primary-color, #00b4d8); font-weight: 600; font-size: .76rem; font-family: inherit; background: transparent; border: none; border-bottom: 1px dotted var(--primary-color, #00b4d8); cursor: pointer; padding: 0 2px; outline: none; appearance: none; -webkit-appearance: none; }
      .batt-discharge-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; background: var(--divider-color, #444); position: relative; cursor: pointer; flex-shrink: 0; transition: background .2s; }
      .batt-discharge-toggle.on { background: var(--primary-color, #00b4d8); }
      .batt-toggle-knob { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: left .2s; }
      .batt-discharge-toggle.on .batt-toggle-knob { left: 21px; }
`;
