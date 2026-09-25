import { detectIntegration, discoverEntities, selectLoadpoints, partitionDisabledLoadpoints } from "./core/entity-discovery.js";
import { CARD_SIZES, CARD_SIZE_DETAILS, CARD_SIZE_FOOTER, RENDER_ATTRS, normalizeStatsPeriod, legacyStatsPeriod, validateCardConfig, loadpointFilter } from "./core/constants.js";
import { stateVal, unitStr } from "./utils/state.js";
import { escHtml } from "./utils/html.js";
import { morphInto } from "./utils/morph.js";
import { socFillGradient, fmtCountdownFromISO } from "./utils/format.js";
import { loadSharedTranslations, sharedTranslations } from "./utils/translations.js";

import { actions } from "./core/actions.js";
import { evccApi } from "./core/evcc-api.js";
import { loadpointView } from "./views/loadpoint-view.js";
import { socControl } from "./components/soc-control.js";
import { disabledEntities } from "./components/disabled-entities.js";
import { planningView } from "./views/planning-view.js";
import { priorityView } from "./views/priority-view.js";
import { siteView } from "./views/site-view.js";
import { flowView } from "./views/flow-view.js";
import { gridView } from "./views/grid-view.js";
import { statisticsLegacy } from "./views/statistics-legacy.js";
import { statisticsView } from "./views/statistics-view.js";
import { batteryView } from "./views/battery-view.js";
import { debugView } from "./views/debug-view.js";
import { listeners } from "./listeners.js";
import { styles } from "./styles.js";

export class EvccCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass          = null;
    this._config        = {};
    this._isDragging    = false;
    this._pendingRender = false;
    this._sliderEditing = false;   // direct-input panel open (defers re-renders like a drag)
    this._sliderEditPanel = null;
    this._inputFocused  = null;   // focused select or date input, see _inputBusy()
    this._readIds       = null;   // entity ids the last render read, see _render()
    this._expected      = {};     // entity id -> value written, not yet reported back (actions.js)
    this._disabledEntities = new Set();   // ha-evcc entities disabled in the registry (detectIntegration)
    this._enabling      = {};     // entity id -> outcome of enabling it from the card (disabled-entities.js)
    this._debugReturn   = null;   // the config the warning triangle left for the debug view
    this._renderTimer   = null;
    this._lastRenderKey = null;
    this._countdownInterval = null;
    this._planState     = {};
    this._planPreviewDebounce = {};
    this._tabState      = {};
    this._statsPeriod   = "total";
    this._chartCache     = {};
    this._chartCacheTime = {};
    this._translations  = sharedTranslations();
    this._translationsReady = false;

    this._siteTableExpanded = undefined; // undefined = use config default
    this._currentBlockExpanded = {};
    this._detectedPrefix = null;
    this._cachedEntities   = null;  // { loadpoints, site } — invalidated when entity IDs change
    this._cachedEntityIdKey = null; // sorted join of evcc entity IDs + prefix

    // ha-evcc WebSocket data API (evcc_intg/forecast|sessions|plan_preview).
    this._entryId             = null;   // config_entry_id, needed by the WS commands
    this._integrationDetected = false;  // entity-registry probe done once
    this._detectingIntegration = false;
    this._evccInstances = null;         // [{ prefix, entryId }] from that probe, registry order
    this._instancePrefix = undefined;   // config.prefix the current entry_id was chosen for
    this._caps        = null;   // { version, commands[] } from evcc_intg/capabilities
    this._capsLoaded  = false;
    this._capsLoading = null;   // in-flight promise guard
    this._lpIndexMap  = {};     // loadpoint slug -> evcc API index (from capabilities)
    this._wsCache     = {};     // cacheKey -> { ts, data }
    this._wsInflight  = {};     // cacheKey -> Promise (de-dup concurrent fetches)

    this._onPlanReset = (e) => {
      const lpName = e.detail?.lpName;
      setTimeout(() => {
        if (lpName) {
          delete this._planState[lpName];
          clearTimeout(this._planPreviewDebounce[lpName]);
          delete this._planPreviewDebounce[lpName];
        } else {
          this._planState = {};
          for (const k of Object.keys(this._planPreviewDebounce)) clearTimeout(this._planPreviewDebounce[k]);
          this._planPreviewDebounce = {};
        }
        // Purge preview cache entries
        for (const key of Object.keys(this._wsCache)) {
          if (key.startsWith("plan:")) delete this._wsCache[key];
        }
        if (this._hass) this._render();
      }, 1500);
    };
  }

  // Lovelace may detach a card and attach the same instance again (view switch,
  // re-order, edit mode). Everything disconnectedCallback tears down has to be
  // rebuilt here, or the re-mounted card is only half alive.
  connectedCallback() {
    window.addEventListener("evcc-plan-reset", this._onPlanReset);
    if (!this._countdownInterval) {
      this._countdownInterval = setInterval(() => this._tickCountdowns(), 1000);
    }
    // A render that was cancelled on detach is scheduled again from the state
    // we already hold; the setter renders only when something changed.
    if (this._hass) this.hass = this._hass;
  }

  disconnectedCallback() {
    window.removeEventListener("evcc-plan-reset", this._onPlanReset);
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
    // Nothing may render on a detached element: the deferred work would run
    // against a DOM nobody sees, and the re-mount renders from the state held.
    if (this._renderTimer)   { clearTimeout(this._renderTimer);   this._renderTimer   = null; }
    if (this._wsRenderTimer) { clearTimeout(this._wsRenderTimer); this._wsRenderTimer = null; }
    // The re-mount sets the same hass object again; without a snapshot the
    // setter compares the key instead of the state identities, so the render
    // cancelled here is picked up and an unchanged card renders nothing.
    this._seenStates = null;
    for (const k of Object.keys(this._planPreviewDebounce)) clearTimeout(this._planPreviewDebounce[k]);
    this._planPreviewDebounce = {};
    // An open direct-input panel or a focused input would keep hass updates
    // deferred after re-mount; a detached element gets no blur.
    this._pendingRender = false;
    this._inputFocused  = null;
    this._closeSliderEdit();
    // The WebSocket caches stay, like the capabilities and the entry id: a view
    // switch would otherwise show the footer, the forecast and the plan preview
    // as loading and fetch them again. _wsFetch refreshes sessions and forecast
    // after their TTL and serves the old value meanwhile; a plan preview is
    // served until the input changes. Only a switch of the ha-evcc instance
    // drops them (_syncIntegrationInstance).
  }

  async _loadTranslations() {
    await loadSharedTranslations();
    this._translations = sharedTranslations();
    this._translationsReady = true;
  }

  _getPrefix() {
    return this._config.prefix || this._detectedPrefix || "evcc_";
  }

  set hass(hass) {
    this._hass = hass;

    if (!this._integrationDetected && !this._detectingIntegration) {
      this._detectingIntegration = true;
      const probePrefix = this._config.prefix || null;
      detectIntegration(hass, probePrefix).then(({ prefix, entryId, instances, disabled }) => {
        this._detectingIntegration = false;
        this._integrationDetected = true;
        this._disabledEntities = new Set(disabled);
        this._evccInstances = instances;
        this._instancePrefix = probePrefix;
        this._entryId = entryId;
        // Probe the ha-evcc WebSocket data API once the entry_id is known.
        this._loadCapabilities();
        // The config may have changed while the registry call was in flight.
        this._syncIntegrationInstance();
        // Honour an explicitly configured prefix, but still keep the detected one.
        // A disabled entity can change what a view offers (a limit without its
        // clear button, the warning triangle), so those renders start over too.
        const changed = (!this._config.prefix && prefix !== this._detectedPrefix) || disabled.length > 0;
        this._detectedPrefix = prefix;
        if (changed) {
          this._lastRenderKey = null;
          if (this._renderTimer) {
            clearTimeout(this._renderTimer);
            this._renderTimer = null;
          }
          this._render();
        }
      });
    }

    this._syncIntegrationInstance();

    if (this._inputBusy()) {
      this._pendingRender = true;
      this._updateLiveValues();
      return;
    }
    // Home Assistant sets `hass` on every state change anywhere in the system,
    // and the key below walks every evcc entity with its attributes. HA keeps
    // the state object of an entity that did not change, so when no evcc
    // entity carries a new object the key cannot differ from the last one and
    // is not built at all.
    if (!this._evccStatesChanged(hass)) return;
    const key = this._buildRenderKey(hass);
    if (key === this._lastRenderKey) return;

    if (this._renderTimer) return;
    this._renderTimer = setTimeout(() => {
      this._renderTimer   = null;
      this._lastRenderKey = this._buildRenderKey(this._hass);
      this._render();
    }, 300);
  }

  // The registry probe runs once, but `prefix` can change afterwards (editor,
  // YAML reload). Re-pick the instance from the probe result so entry_id and
  // prefix always name the same installation; everything derived from the
  // entry (capabilities, loadpoint index map, WS caches) starts over.
  _syncIntegrationInstance() {
    if (!this._evccInstances) return;
    const wanted = this._config.prefix || null;
    if (wanted === this._instancePrefix) return;
    this._instancePrefix = wanted;
    const chosen  = (wanted && this._evccInstances.find(i => i.prefix === wanted)) || this._evccInstances[0] || null;
    const entryId = chosen?.entryId ?? null;
    if (entryId === this._entryId) return;
    this._entryId     = entryId;
    this._caps        = null;
    this._capsLoaded  = false;
    this._capsLoading = null;
    this._lpIndexMap  = {};
    this._wsCache     = {};
    this._wsInflight  = {};
    this._loadCapabilities();
  }

  // The evcc entity ids under the current prefix. Re-filtered only when the
  // entity count or the prefix changes, not on every value update. Returns true
  // when the list was rebuilt, so a caller comparing states knows the set moved.
  _refreshEvccIds(hass) {
    const prefix     = this._getPrefix();
    const stateCount = Object.keys(hass.states).length;
    if (this._evccIds && this._evccIdsCount === stateCount && this._evccIdsPrefix === prefix) return false;
    this._evccIdsCount  = stateCount;
    this._evccIdsPrefix = prefix;
    this._evccIds       = Object.keys(hass.states).filter(id => id.split(".")[1]?.startsWith(prefix));
    return true;
  }

  // True when a hass update can change what the card shows: an entity the last
  // render read carries a new state object, the set of evcc entities moved,
  // the language changed, or no key has been built yet. The snapshot is the previous `states` table;
  // HA copies the table on every update and keeps the untouched entries, so an
  // identity check per evcc entity is enough and no string is built. The
  // snapshot is taken here in every case, or a change seen once would be
  // reported again on the next update.
  _evccStatesChanged(hass) {
    const idsMoved = this._refreshEvccIds(hass);
    const seen     = this._seenStates;
    const lang     = this._config.language || (hass.language ?? "en");
    this._seenStates = hass.states;
    if (idsMoved || !seen || this._lastRenderKey === null || lang !== this._seenLang) {
      this._seenLang = lang;
      return true;
    }
    // The entities the last render read, or every evcc entity before the
    // first render. An entity that appears or disappears moves the count and
    // has forced a full check above.
    const ids = this._readIds ?? this._evccIds;
    for (const id of ids) if (hass.states[id] !== seen[id]) return true;
    return false;
  }

  _buildRenderKey(hass) {
    if (!hass) return "";
    this._refreshEvccIds(hass);

    const lang = this._config.language || (hass.language ?? "en");
    // \u001f (unit separator) keeps attribute values from colliding with the
    // key's own delimiters; a title or an option may contain anything else.
    return lang + "|" + this._evccIds.map(id => {
      const s = hass.states[id];
      if (!s) return `${id}=`;
      let part = `${id}=${s.state}`;
      const a = s.attributes;
      if (a) {
        for (const name of RENDER_ATTRS) {
          const v = a[name];
          if (v === undefined) continue;
          part += `\u001f${name}=${typeof v === "object" && v !== null ? JSON.stringify(v) : v}`;
        }
      }
      return part;
    }).join("|");
  }

  // Home Assistant sizes the layout from this, one unit being 50 px, in the
  // masonry view and as the row span in a section. A rendered card measures
  // itself, because no per-mode estimate survives the configuration: a collapsed
  // detail table, a hidden footer, the number of loadpoints and the `size` scale
  // each move the height, and a site card runs from 2 to 12 units across them.
  // HA asks again whenever it relayouts, so this is the value it sees in
  // practice; the estimate covers the moment before the first render and the
  // time the translations are still loading, when the shadow root holds the
  // loading placeholder, an ha-card of its own that says nothing about the
  // card's height.
  getCardSize() {
    if (this._translationsReady) {
      const rendered = this.shadowRoot?.querySelector("ha-card")?.getBoundingClientRect().height;
      if (rendered > 0) return Math.max(1, Math.ceil(rendered / 50));
    }
    return this._estimatedCardSize();
  }

  // The pre-render fallback: the bare card per mode, plus the two blocks a
  // configuration can remove. It must answer without hass and without a single
  // discovered entity, so it never returns 0. The `size` scale is not in here:
  // it only stretches the card once it renders, and then the measurement wins.
  _estimatedCardSize() {
    const mode = this._config?.mode || "loadpoint";
    let rows = CARD_SIZES[mode] ?? CARD_SIZES.loadpoint;
    if (mode === "loadpoint" || mode === "compact") rows *= this._sizedLoadpointCount();
    if (this._config?.site_details !== "collapsed") rows += CARD_SIZE_DETAILS[mode] ?? 0;
    if (normalizeStatsPeriod(this._config?.stats_period, "total") !== "none") {
      rows += CARD_SIZE_FOOTER[mode] ?? 0;
    }
    return Math.max(1, rows);
  }

  // How many loadpoints the card would draw: the discovered ones narrowed by the
  // `loadpoints` filter. Nothing is discovered before the first render, so a
  // configured filter still yields a count there and everything else falls back
  // to one loadpoint rather than to zero.
  _sizedLoadpointCount() {
    const filter = loadpointFilter(this._config);
    const found  = this._cachedEntities?.loadpoints || {};
    const n = Object.keys(found).length
      ? Object.keys(selectLoadpoints(found, this._config)).length
      : (filter ? filter.length : 0);
    return Math.max(1, n);
  }

  // Width only, on purpose. A cell of the sections grid is 56 px high with an
  // 8 px gap, and a card that declares no `rows` keeps its own height instead of
  // being fitted into that raster. This card's height depends on how many
  // loadpoints were discovered, whether the detail tables are expanded and
  // whether a plan is running, so any fixed row count is wrong in one of two
  // ways: too tall leaves an empty area under the card, too short lets the
  // content spill over the card below it. `min_columns` is the one useful limit:
  // a column is about 30 px, and the card starts to run over its own edge below
  // roughly 272 px. The layout editor resizes in steps of three columns unless
  // its precision mode is on, so the floor sits on that raster: nine columns,
  // about 334 px. Eight would fit as well, but reads as nine to everyone who
  // drags the handle, and nobody runs the card narrower than that anyway.
  getGridOptions() {
    return { min_columns: 9 };
  }

  static getConfigElement() {
    return document.createElement("evcc-card-editor");
  }

  static getStubConfig() {
    return { mode: "loadpoint" };
  }

  setConfig(config) {
    // Throws before anything is applied, so a rejected config leaves the card on
    // the one it had and Home Assistant shows its error card with the reason.
    validateCardConfig(config);
    this._config = config || {};
    this._debugReturn = null;
    this._syncIntegrationInstance();
    // Both stats paths are fed from the same normalised value, so the current
    // vocabulary (month/year/total/none) and the legacy one (30d/365d/thisYear)
    // steer them the same way. The stats mode opens on the most recent month
    // when nothing is configured; `none` only hides the footer, so the full view
    // shows that default too.
    const rawPeriod  = config?.stats_period;
    const scope      = normalizeStatsPeriod(rawPeriod, "month");
    this._statsScope = scope === "none" ? "month" : scope;
    // The legacy path keeps a configured legacy value exactly as it is, and
    // defaults to "total" rather than to the stats mode's most recent month.
    this._statsPeriod = legacyStatsPeriod(rawPeriod, "total");
    if (this._statsMetric == null) this._statsMetric = "energy"; // energy | cost | co2
    if (this._statsGroup  == null) this._statsGroup  = "solar";  // solar | loadpoint | vehicle

    if (!this._translationsReady && !this._loadingTranslations) {
      this._loadingTranslations = true;
      this._loadTranslations().then(() => {
        this._loadingTranslations = false;
        if (this._hass) this._render();
      });
    } else if (this._hass && this._translationsReady) {
      this._lastRenderKey = null;
      this._render();
    }
  }

  _toggleSite() {
    const wasExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");
    this._siteTableExpanded = !wasExpanded;

    const root = this.shadowRoot;
    const table = root?.querySelector(".site-table");
    if (table) table.style.display = wasExpanded ? "none" : "";
    const wrap = root?.querySelector(".flow-wrap-clickable");
    if (wrap) {
      wrap.title = !wasExpanded ? this._t("siteCollapse") : this._t("siteExpand");
    }
    const chevronPath = root?.querySelector(".sankey-center-chevron path");
    if (chevronPath) chevronPath.setAttribute("d", !wasExpanded
      ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
      : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z");
  }

  _t(key, replacements = {}) {
    // Use pre-resolved strings from current render cycle; fall back to resolving on demand
    const strings = this._renderStrings ?? (() => {
      const lang = (this._config.language
        || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
      return this._translations[lang] || this._translations["en"] || {};
    })();

    let val = strings[key] ?? key;

    for (const [k, v] of Object.entries(replacements)) {
      val = val.replace(`{${k}}`, v);
    }

    return val;
  }

  // True while the user is in the middle of something the DOM must not be
  // replaced under: a slider drag, an open direct-input panel, a priority drag,
  // or a focused select or date input (an open dropdown or picker would close,
  // a half-typed time would be gone). The end of each interaction runs the
  // render that was deferred meanwhile.
  _inputBusy() {
    return !!(this._isDragging || this._sliderEditing || this._priorityDragging || this._inputFocused);
  }

  // The focus guard for selects and date inputs, set by the shared listener in
  // listeners.js; lifted on change (the choice is made) and on blur.
  _holdInput(el)    { this._inputFocused = el; }
  _releaseInput(el) {
    if (this._inputFocused !== el && this._inputFocused?.isConnected) return;
    this._inputFocused = null;
    // The deferred render runs as a task, after every listener of the event
    // that lifted the guard: the view's own change handler still has to read
    // the value the user picked, and a render in between would have put the
    // state's value back first.
    if (this._pendingRender) {
      setTimeout(() => {
        if (this._inputBusy() || !this._pendingRender) return;
        this._pendingRender = false;
        this._render();
      }, 0);
    }
  }

  _render() {
    if (!this._hass) return;
    // Whoever asks for the render, the hass setter, a WebSocket result, a plan
    // reset or a tab: nothing replaces the DOM under the user's hands. The
    // interaction that holds it renders when it ends (pointerup, panel close,
    // drag end, blur).
    if (this._inputBusy()) { this._pendingRender = true; return; }

    // What this render reads from hass.states is what the next hass update is
    // compared against: a loadpoint card is not redrawn because the PV power
    // moved. Every read goes through hass.states[id], so a recording proxy on
    // the states table catches them all, including the ones views make past
    // the discovery (tariff sensors, clear buttons, stat_* entities) and the
    // ones that find nothing. A render that bailed out early (translations
    // still loading) leaves the previous set in place.
    const real  = this._hass;
    const reads = new Set();
    // The same proxy hands out the value the card just wrote for an entity HA
    // has not answered for yet (_expectedState), so every view draws the
    // pressed mode or the flipped toggle without knowing about it.
    this._hass = { ...real, states: new Proxy(real.states, {
      get: (t, k) => {
        if (typeof k !== "string") return t[k];
        reads.add(k);
        return this._expectedState(k, t[k]);
      },
    }) };
    let done = false;
    try {
      done = this._renderNow();
    } finally {
      this._hass = real;
      if (done) this._readIds = reads;
    }
  }

  // The render itself. Returns true when the card was drawn, false when it
  // showed the loading placeholder instead.
  _renderNow() {
    if (!this._translationsReady) {
      if (!this.shadowRoot.firstChild) {
        this.shadowRoot.innerHTML = `
          <style>:host{display:block}
          .loading{padding:24px;text-align:center;color:var(--secondary-text-color);font-size:.9rem}</style>
          <ha-card><div class="loading">⏳</div></ha-card>`;
      }
      return false;
    }

    // Resolve language strings once per render — reused by all _t() calls
    const lang = (this._config.language
      || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
    this._renderStrings = this._translations[lang] || this._translations["en"] || {};

    const prefix = this._getPrefix();

    // Cache discoverEntities() — only re-run when the set of entity IDs changes (not on value updates)
    const idsForKey = Object.keys(this._hass.states).filter(id => id.split(".")[1]?.startsWith(prefix));
    const evccIdKey = prefix + "|" + idsForKey.sort().join(",");
    if (evccIdKey !== this._cachedEntityIdKey) {
      this._cachedEntityIdKey = evccIdKey;
      this._cachedEntities    = discoverEntities(this._hass, prefix);
    }
    const { loadpoints, site, meters } = this._cachedEntities;

    const visible = selectLoadpoints(loadpoints, this._config);

    // disabled_loadpoints: hide (default) | dim | show - how to treat
    // loadpoints that are disabled in the evcc config (ha-evcc 2026.8.8+).
    // setConfig() has already rejected anything outside DISABLED_LOADPOINT_MODES.
    const dlpOpt = this._config.disabled_loadpoints || "hide";
    const { enabled: lpEnabled, disabled: lpDisabled } =
      partitionDisabledLoadpoints(this._hass, visible);
    // Interactive modes (plan/priority) can never work on a disabled
    // loadpoint - its entities don't exist - so those always get lpEnabled.
    const lpVisible = dlpOpt === "show" ? visible : lpEnabled;
    const dimmed    = dlpOpt === "dim"  ? lpDisabled : {};
    const allDisabled = Object.keys(visible).length > 0
      && Object.keys(lpEnabled).length === 0;

    // Morphed into the live tree, not assigned: the elements that are still
    // rendered keep their identity, so focus, hover, a running animation, the
    // chart tooltip and the listeners survive the update. See src/utils/morph.js.
    morphInto(this.shadowRoot, `
      ${this._styleTag()}
      <div class="evcc-scale-wrap"${this._config.size ? ` data-size="${this._config.size}"` : ""}><ha-card>
        <div class="card-content">
        ${this._config.mode === "debug"
            ? this._renderDebugBlock(loadpoints, site, meters)
            : this._config.mode === "battery"
            ? this._renderBatteryBlock(site)
            : this._config.mode === "site"
              ? this._renderSiteBlock(site, loadpoints)
              : this._config.mode === "flow"
              ? this._renderFlowBlock(site, loadpoints)
              : (this._config.mode === "grid" || this._config.mode === "site2")
              ? this._renderSiteBlock2(site, loadpoints)
              : this._config.mode === "stats"
              ? this._renderStatsBlock()
              : this._config.mode === "plan"
                ? this._renderPlanMode(lpEnabled)
                : this._config.mode === "repeatplan"
                ? this._renderRepeatPlansMode()
                : this._config.mode === "priority"
                  ? this._renderPriorityMode(lpEnabled)
                : this._config.mode === "compact"
                  ? (Object.keys(lpVisible).length === 0 && Object.keys(dimmed).length === 0
                      ? (allDisabled
                          ? this._renderAllDisabled()
                          : this._renderEmpty(loadpoints))
                      : Object.entries(lpVisible)
                          .map(([lp, ents]) => this._renderCompactLoadpoint(lp, ents))
                          .join("")
                        + Object.entries(dimmed)
                          .map(([lp, ents]) => this._renderDisabledLoadpoint(lp, ents))
                          .join(""))
                  : Object.keys(lpVisible).length === 0 && Object.keys(dimmed).length === 0
              ? (allDisabled
                  ? this._renderAllDisabled()
                  : this._renderEmpty(loadpoints))
              : Object.entries(lpVisible)
                  .map(([lp, ents]) => this._renderLoadpoint(lp, ents))
                  .join("")
                + Object.entries(dimmed)
                  .map(([lp, ents]) => this._renderDisabledLoadpoint(lp, ents))
                  .join("")
          }
        </div>
      </ha-card></div>
    `);
    this._attachListeners();
    return true;
  }

  _updateLiveValues() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-live-entity]").forEach(el => {
      const entityId = el.dataset.liveEntity;
      const type     = el.dataset.liveType;
      if (!entityId) return;

      if (type === "soc-fill") {
        const soc      = parseFloat(stateVal(this._hass, entityId)) || 0;
        const minSoc   = parseFloat(el.dataset.minSoc)   || 0;
        const limitSoc = parseFloat(el.dataset.limitSoc) || 100;
        el.style.width      = `${soc}%`;
        el.style.background = socFillGradient(soc, minSoc, limitSoc);
      } else if (type === "soc-pct") {
        const soc = parseFloat(stateVal(this._hass, entityId)) || 0;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${escHtml(unitStr(this._hass, entityId))}`;
      } else if (type === "power") {
        el.textContent = `${parseFloat(stateVal(this._hass, entityId)).toFixed(1)} ${unitStr(this._hass, entityId)}`;
      }
    });
  }

  _tickCountdowns() {
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll("[data-countdown-target]").forEach(el => {
      const ts = el.dataset.countdownTarget;
      if (!ts || isNaN(Date.parse(ts))) return;
      const cd = fmtCountdownFromISO(ts);
      // A run-out timer leaves like evcc's, until the next render drops the chip,
      // and takes the row with it when it was the last chip there.
      const chip = el.closest(".lp-action-chip");
      if (chip) this._hideActionChip(chip, !cd);
      const key = el.dataset.countdownLabel;
      if (key && cd) {
        el.textContent = this._t(key, { val: cd });
      }
    });
    // A chip that names a point in time (the plan start) leaves once it has
    // passed, as the render would not draw it any more.
    root.querySelectorAll(".lp-action-chip[data-hide-after]").forEach(chip => {
      const ts = Date.parse(chip.dataset.hideAfter);
      if (!isNaN(ts)) this._hideActionChip(chip, ts <= Date.now());
    });
  }

  _hideActionChip(chip, hidden) {
    chip.hidden = hidden;
    const row = chip.closest(".lp-action-row");
    if (row) row.hidden = [...row.querySelectorAll(".lp-action-chip")].every(c => c.hidden);
  }
}

// Mode views, components and shared behaviour are plain objects of methods
// (no framework): mix them into the prototype, refusing silent overrides.
const mixins = [actions, evccApi, loadpointView, socControl, disabledEntities, planningView, priorityView, siteView, flowView, gridView, statisticsLegacy, statisticsView, batteryView, debugView, listeners, styles];
for (const m of mixins) {
  for (const key of Object.keys(m)) {
    if (key in EvccCard.prototype) throw new Error(`evcc-card: duplicate method ${key}`);
  }
}
Object.assign(EvccCard.prototype, ...mixins);
