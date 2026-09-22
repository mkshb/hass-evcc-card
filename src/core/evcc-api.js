import { discoverEntities } from "./entity-discovery.js";
import { stateVal } from "../utils/state.js";

// ha-evcc WebSocket data API (capabilities, forecast, sessions, plan_preview). Methods are mixed into EvccCard.prototype.
export const evccApi = {
  // ── ha-evcc WebSocket data API ──────────────────────────────────────────
  // On-demand request/response commands served by evcc_intg. They return data
  // that does not map to entities (forecast curves, raw session history, plan
  // previews). Reads are slow-changing, so results are cached with a TTL.

  _hasCmd(name) {
    return Array.isArray(this._caps?.commands) && this._caps.commands.includes(name);
  },

  // Probe capabilities once. Older ha-evcc versions lack the command and the
  // callWS rejects — we then mark the feature set empty so the UI degrades.
  _loadCapabilities() {
    if (this._capsLoaded || this._capsLoading || !this._hass) return this._capsLoading;
    // A prefix change swaps the entry while this is in flight; the answer for
    // the old entry is then dropped and the new one's probe is already running.
    const entryId = this._entryId;
    const stale   = () => entryId !== this._entryId;
    this._capsLoading = this._hass
      .callWS({ type: "evcc_intg/capabilities", entry_id: entryId })
      .then(res => {
        if (stale()) return;
        this._caps = {
          version:  res?.version ?? null,
          commands: Array.isArray(res?.commands) ? res.commands : [],
        };
        // Build the loadpoint slug -> evcc API index map (ha-evcc 2026.6.x+),
        // so the plan preview targets the right loadpoint without guessing.
        this._lpIndexMap = {};
        for (const lp of (Array.isArray(res?.loadpoints) ? res.loadpoints : [])) {
          if (lp && lp.id != null && lp.index != null) this._lpIndexMap[lp.id] = Number(lp.index);
        }
      })
      .catch(e => {
        if (stale()) return;
        console.warn("[evcc-card] evcc_intg/capabilities not available:", e?.message || e);
        this._caps = { version: null, commands: [] };
      })
      .then(() => {
        if (stale()) return;
        this._capsLoaded  = true;
        this._capsLoading = null;
        // Pre-fetch debug probes so data is cached before the debug block renders.
        this._prefetchDebugProbes();
        this._render();
      });
    return this._capsLoading;
  },

  // Kick off WS probes in the background so they are cached for the debug block.
  // Results arrive asynchronously; _wsFetch.finally() triggers a re-render.
  _prefetchDebugProbes() {
    if (this._hasCmd("forecast"))     { this._wsForecast("grid"); this._wsForecast("planner"); }
    if (this._hasCmd("sessions"))     this._wsSessions();
    // plan_preview needs a loadpoint — skip here, probe only in debug report.
  },

  // Generic cached WS fetch. Returns fresh cached data synchronously; otherwise
  // kicks off the request (de-duplicated per cacheKey) and triggers a re-render
  // when it lands. Returns null while data is pending or on error.
  // Returns: null (pending/no hass), { data } on success, { error } on failure.
  _wsFetch(type, params, cacheKey, ttlMs) {
    if (!this._hass || !this._entryId) return null;

    const cached = this._wsCache[cacheKey];
    const now = Date.now();
    if (cached && (now - cached.ts) < ttlMs) return cached.result;

    if (!this._wsInflight[cacheKey]) {
      const entryId = this._entryId;
      const stale   = () => entryId !== this._entryId;   // entry swapped meanwhile, see _syncIntegrationInstance
      this._wsInflight[cacheKey] = this._hass
        .callWS({ type, entry_id: entryId, ...params })
        .then(data => {
          if (stale()) return;
          this._wsCache[cacheKey] = { ts: Date.now(), result: { data } };
        })
        .catch(e => {
          if (stale()) return;
          const msg = e?.message || (typeof e === "object" ? JSON.stringify(e) : String(e));
          console.warn(`[evcc-card] ${type} failed:`, msg);
          this._wsCache[cacheKey] = { ts: Date.now(), result: { error: msg } };
        })
        .finally(() => {
          if (stale()) return;
          delete this._wsInflight[cacheKey];
          // Throttle the re-render to avoid rapid DOM replacements.
          if (!this._wsRenderTimer) {
            this._wsRenderTimer = setTimeout(() => {
              this._wsRenderTimer = null;
              this._render();
            }, 500);
          }
        });
    }
    // Serve stale result while a refresh is in flight, else null (pending).
    return cached ? cached.result : null;
  },

  // kind: grid | feedin | co2 | solar | planner  →  { kind, rates[], smartCostType?, currency? }
  // capabilities + the "planner" kind ship in the same ha-evcc release, so
  // _hasCmd("forecast") already implies planner is accepted - no kind-level probe needed.
  _wsForecast(kind) {
    if (!this._hasCmd("forecast")) return null;
    return this._wsFetch("evcc_intg/forecast", { kind }, `forecast:${kind}`, 5 * 60 * 1000);
  },

  // year/month optional  →  { sessions[] }
  _wsSessions(year, month) {
    if (!this._hasCmd("sessions")) return null;
    const params = {};
    if (year  != null) params.year  = year;
    if (month != null) params.month = month;
    return this._wsFetch("evcc_intg/sessions", params, `sessions:${year ?? ""}:${month ?? ""}`, 5 * 60 * 1000);
  },

  // Canonical params + cache key for a plan_preview request. Shared by every
  // call site so the cached-read, the fetch and the invalidation all agree.
  _planPreviewParams(opts) {
    return {
      loadpoint: opts.loadpoint,
      kind:      opts.kind,
      value:     String(opts.value),
      timestamp: opts.timestamp,
    };
  },

  // The key carries the plan settings on top of the request parameters: the
  // static preview takes neither the precondition nor the continuous flag,
  // evcc applies the vehicle's current settings itself, so a cached preview is
  // only good for the settings it was computed with. Once HA reports a changed
  // setting, the render path finds nothing under the new key and fetches.
  _planPreviewKey(opts) {
    return "plan:" + JSON.stringify(this._planPreviewParams(opts)) + "|" + (opts.settings ?? "");
  },

  // The plan settings of a loadpoint as HA reports them, for the preview key.
  _planSettingsKey(lpName) {
    const ents = this._cachedEntities?.loadpoints?.[lpName]
      || discoverEntities(this._hass, this._getPrefix()).loadpoints[lpName] || {};
    const pre  = ents.plan_strategy_precondition ? stateVal(this._hass, ents.plan_strategy_precondition) : "";
    const cont = ents.plan_strategy_continuous   ? stateVal(this._hass, ents.plan_strategy_continuous)   : "";
    return `${pre}|${cont}`;
  },

  // opts: { loadpoint:int, kind:"soc"|"energy", value, timestamp }  →
  //       { duration, power, rates[], smartCostType, currency }
  // The ha-evcc 'plan_preview' command (2026.6.x) requires all four params; it is
  // a static, read-only preview (no 'repeating' kind, timestamp is mandatory).
  // Initiates a backend call (subject to _wsFetch TTL + in-flight coalescing).
  _wsPlanPreview(opts) {
    if (!this._hasCmd("plan_preview")) return null;
    const params = this._planPreviewParams(opts);
    return this._wsFetch("evcc_intg/plan_preview", params, this._planPreviewKey(opts), 60 * 1000);
  },

  // Render-path read: serve the cached preview regardless of age, and prime
  // exactly one fetch if nothing is cached or in flight. Unlike _wsPlanPreview,
  // this never re-hits the backend on TTL expiry — a result, once cached, is
  // served until the user changes an input (which re-fetches via
  // _requestPlanPreview). That keeps an idle plan card at zero backend calls,
  // as agreed with ha-evcc (marq24/ha-evcc#298): plan_preview is uncached
  // server-side, so the card must not generate background/idle traffic.
  _wsPlanPreviewCached(opts) {
    if (!this._hasCmd("plan_preview")) return null;
    const cacheKey = this._planPreviewKey(opts);
    const cached = this._wsCache[cacheKey];
    if (cached) return cached.result;
    if (!this._wsInflight[cacheKey]) this._wsPlanPreview(opts);
    return null;
  },

  // plan_preview expects the integer evcc loadpoint index (1-based), but the card
  // keys loadpoints by name slug. Resolution order:
  //   1. authoritative map from evcc_intg/capabilities (ha-evcc 2026.6.x+)
  //   2. explicit config override  plan_loadpoint_index: { <slug>: <int> }
  //   3. fallback heuristic: position in the deterministically sorted discovery list
  // The map is exact; the override + heuristic only cover older integrations that
  // do not yet return the loadpoint list in their capabilities response.
  // Returns the 1-based index, or null if the loadpoint is unknown.
  _lpIndex(lpName) {
    const fromCaps = this._lpIndexMap?.[lpName];
    if (fromCaps != null) return fromCaps;
    const override = this._config?.plan_loadpoint_index;
    if (override && override[lpName] != null) {
      const n = parseInt(override[lpName], 10);
      if (n > 0) return n;
    }
    const prefix = this._getPrefix();
    const names = Object.keys(discoverEntities(this._hass, prefix).loadpoints).sort();
    const idx = names.indexOf(lpName);
    return idx >= 0 ? idx + 1 : null;
  },

  // Debounced plan preview fetch — called after SOC/time/vehicle changes.
  _requestPlanPreview(lpName) {
    const state = this._planState[lpName];
    if (!state || !state.soc || !state.time || !this._hasCmd("plan_preview")) return;
    const lpIdx = this._lpIndex(lpName);
    if (lpIdx == null) return;

    clearTimeout(this._planPreviewDebounce[lpName]);
    this._planPreviewDebounce[lpName] = setTimeout(() => {
      // Convert datetime-local value to ISO 8601 with timezone offset
      const d = new Date(state.time);
      if (isNaN(d.getTime())) return;
      const ts = d.toISOString();
      const opts = { loadpoint: lpIdx, kind: "soc", value: state.soc, timestamp: ts, settings: this._planSettingsKey(lpName) };
      const cacheKey = this._planPreviewKey(opts);
      // Drop previews for OTHER inputs of this loadpoint (bounds the cache), but
      // keep the current one — refetching what we already have wastes a backend call.
      const pfx = `plan:{"loadpoint":${lpIdx},`;
      for (const key of Object.keys(this._wsCache)) {
        if (key.startsWith(pfx) && key !== cacheKey) delete this._wsCache[key];
      }
      // Already cached (e.g. primed by the render path) or in flight → no refetch.
      if (this._wsCache[cacheKey] || this._wsInflight[cacheKey]) return;
      this._wsPlanPreview(opts);
    }, 500);
  },
};
