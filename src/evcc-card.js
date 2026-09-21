import { detectIntegration, discoverEntities, selectLoadpoints, partitionDisabledLoadpoints } from "./core/entity-discovery.js";
import { CARD_SIZES, CARD_SIZE_DETAILS, CARD_SIZE_FOOTER, RENDER_ATTRS, normalizeStatsPeriod, legacyStatsPeriod, validateCardConfig, loadpointFilter } from "./core/constants.js";
import { stateVal, unitStr } from "./utils/state.js";
import { escHtml } from "./utils/html.js";
import { socFillGradient } from "./utils/format.js";
import { loadSharedTranslations, sharedTranslations } from "./utils/translations.js";

import { actions } from "./core/actions.js";
import { evccApi } from "./core/evcc-api.js";
import { loadpointView } from "./views/loadpoint-view.js";
import { socControl } from "./components/soc-control.js";
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
    for (const k of Object.keys(this._planPreviewDebounce)) clearTimeout(this._planPreviewDebounce[k]);
    this._planPreviewDebounce = {};
    // An open direct-input panel would keep hass updates deferred after re-mount.
    this._pendingRender = false;
    this._closeSliderEdit();
    // Drop the on-demand WS caches. Capabilities and entry_id are kept on
    // purpose: they do not change while the page lives, and re-probing them on
    // every re-mount would be a backend call for nothing.
    this._wsCache    = {};
    this._wsInflight = {};
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
      detectIntegration(hass, probePrefix).then(({ prefix, entryId, instances }) => {
        this._detectingIntegration = false;
        this._integrationDetected = true;
        this._evccInstances = instances;
        this._instancePrefix = probePrefix;
        this._entryId = entryId;
        // Probe the ha-evcc WebSocket data API once the entry_id is known.
        this._loadCapabilities();
        // The config may have changed while the registry call was in flight.
        this._syncIntegrationInstance();
        // Honour an explicitly configured prefix, but still keep the detected one.
        const changed = (!this._config.prefix && prefix !== this._detectedPrefix);
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

    if (this._isDragging || this._sliderEditing) {
      this._pendingRender = true;
      this._updateLiveValues();
      return;
    }
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

  _buildRenderKey(hass) {
    if (!hass) return "";
    const prefix     = this._getPrefix();
    const stateCount = Object.keys(hass.states).length;

    // Re-filter evcc entity IDs only when entity count or prefix changes (not on every value update)
    if (!this._evccIds || this._evccIdsCount !== stateCount || this._evccIdsPrefix !== prefix) {
      this._evccIdsCount  = stateCount;
      this._evccIdsPrefix = prefix;
      this._evccIds       = Object.keys(hass.states).filter(id => id.split(".")[1]?.startsWith(prefix));
    }

    const lang = this._config.language || (hass.language ?? "de");
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
        || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();
      return this._translations[lang] || this._translations["en"] || {};
    })();

    let val = strings[key] ?? key;

    for (const [k, v] of Object.entries(replacements)) {
      val = val.replace(`{${k}}`, v);
    }

    return val;
  }

  _render() {
    if (!this._hass) return;
    // A priority drag holds live DOM references (row, placeholder, captured
    // handle). Replacing the shadow DOM now would orphan it and leave
    // _isDragging stuck. Defer; _priorityDragEnd re-renders.
    if (this._priorityDragging) { this._pendingRender = true; return; }
    // A full re-render replaces the shadow DOM, so an open direct-input panel is
    // gone afterwards; clear the flag or hass updates would stay deferred.
    this._sliderEditing   = false;
    this._sliderEditPanel = null;
    this._dropSliderEditOutside();
    if (!this._translationsReady) {
      if (!this.shadowRoot.firstChild) {
        this.shadowRoot.innerHTML = `
          <style>:host{display:block}
          .loading{padding:24px;text-align:center;color:var(--secondary-text-color);font-size:.9rem}</style>
          <ha-card><div class="loading">⏳</div></ha-card>`;
      }
      return;
    }

    // Resolve language strings once per render — reused by all _t() calls
    const lang = (this._config.language
      || (this._hass?.language ?? "de")).split("-")[0].toLowerCase();
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

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
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
    `;
    this._attachListeners();
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
      if (!ts) return;
      const target = Date.parse(ts);
      if (isNaN(target)) return;
      const sec = Math.max(0, Math.round((target - Date.now()) / 1000));
      const cd = sec <= 0
        ? ""
        : sec < 60
          ? `${sec}s`
          : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
      const key = el.dataset.countdownLabel;
      if (key) {
        el.textContent = this._t(key, { val: cd || "—" });
      }
    });
  }
}

// Mode views, components and shared behaviour are plain objects of methods
// (no framework): mix them into the prototype, refusing silent overrides.
const mixins = [actions, evccApi, loadpointView, socControl, planningView, priorityView, siteView, flowView, gridView, statisticsLegacy, statisticsView, batteryView, debugView, listeners, styles];
for (const m of mixins) {
  for (const key of Object.keys(m)) {
    if (key in EvccCard.prototype) throw new Error(`evcc-card: duplicate method ${key}`);
  }
}
Object.assign(EvccCard.prototype, ...mixins);
