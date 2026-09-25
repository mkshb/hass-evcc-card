import { DISABLED_NEEDED } from "../core/constants.js";
import { disabledCardEntities } from "../core/entity-discovery.js";
import { escHtml, escAttr } from "../utils/html.js";

// Entities ha-evcc creates disabled although the card would use them. The card
// marks a loadpoint whose controls miss one of them with a warning triangle in
// its header; the list itself, with the switch that enables an entity, sits in
// the debug view and in the editor. Both render it through
// disabledEntitiesHtml(), the editor has no mixins.

const WARN_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/></svg>`;

// Enables `entries` one registry update each and notes the outcome per entity
// id in `enabling`: pending while the call runs, then the reload HA announced,
// a required restart or the error. HA reloads ha-evcc once for a burst of
// updates, its delay starts over with each of them. `changed` re-renders.
export function enableEntities(enable, entries, enabling, changed) {
  for (const e of entries) enabling[e.id] = { status: "pending" };
  changed();
  return Promise.all(entries.map(e => enable(e.id).then(
    res => { enabling[e.id] = res?.require_restart ? { status: "restart" } : { status: "reload", sec: res?.reload_delay ?? 30 }; },
    err => { enabling[e.id] = { status: "failed", error: err?.message || String(err) }; },
  ))).then(changed);
}

// The list of `entries` (disabledCardEntities()), the ones a control depends
// on first, the rest folded away. Administrators get a switch per entity and
// one for all needed ones; an entity leaves the list once it has a state.
export function disabledEntitiesHtml({ entries, enabling, admin, t, optionalOpen = false }) {
  if (!entries.length) return `<div class="disabled-none">${t("disabledNone")}</div>`;
  const status = st => !st ? ""
    : st.status === "pending" ? t("disabledPending")
    : st.status === "reload"  ? t("disabledReload", { sec: st.sec })
    : st.status === "restart" ? t("disabledRestart")
    : t("disabledFailed", { error: st.error });
  const open = e => admin && (!enabling[e.id] || enabling[e.id].status === "failed");
  const row = e => {
    const st = enabling[e.id];
    return `<li class="disabled-row">
        <div class="disabled-main">
          ${e.need ? `<div class="disabled-what">${escHtml(t(e.need.what))} <span class="disabled-owner">${escHtml(e.owner)}</span></div>` : ""}
          <code class="disabled-id">${escHtml(e.id)}</code>
          ${st ? `<div class="disabled-status ${st.status}">${escHtml(status(st))}</div>` : ""}
        </div>
        ${open(e) ? `<button class="disabled-enable" data-enable-entity="${escAttr(e.id)}">${t("disabledEnable")}</button>` : ""}
      </li>`;
  };
  const needed   = entries.filter(e => e.need);
  const optional = entries.filter(e => !e.need);
  const all      = needed.filter(open);
  return `
    <div class="disabled-intro">${t("disabledIntro")}${admin ? "" : " " + t("disabledAdminOnly")}</div>
    ${needed.length ? `<div class="disabled-group">${t("disabledNeeded")}</div>
      <ul class="disabled-list">${needed.map(row).join("")}</ul>` : ""}
    ${all.length > 1 ? `<div class="disabled-all-row"><button class="disabled-enable-all" data-enable-entities="${escAttr(all.map(e => e.id).join(","))}">${t("disabledEnableAll")}</button></div>` : ""}
    ${optional.length ? `<details class="disabled-optional"${optionalOpen ? " open" : ""}>
      <summary>${t("disabledOptional")} (${optional.length})</summary>
      <ul class="disabled-list">${optional.map(row).join("")}</ul>
    </details>` : ""}`;
}

// The CSS of the list, shared by the card sheet and the editor.
export const disabledListCss = `
      .disabled-intro { font-size: .8rem; color: var(--secondary-text-color); margin-bottom: 8px; }
      .disabled-none { font-size: .8rem; color: var(--secondary-text-color); }
      .disabled-group { font-size: .78rem; font-weight: 600; margin: 6px 0 4px; }
      .disabled-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
      .disabled-row { display: flex; align-items: center; gap: 8px; }
      .disabled-main { flex: 1; min-width: 0; }
      .disabled-what { font-size: .82rem; }
      .disabled-owner { color: var(--secondary-text-color); }
      .disabled-id { font-size: .72rem; color: var(--secondary-text-color); word-break: break-all; }
      .disabled-status { font-size: .75rem; color: var(--secondary-text-color); }
      .disabled-status.failed { color: var(--error-color, #ef4444); }
      .disabled-enable, .disabled-enable-all { flex-shrink: 0; background: none; border: 1px solid var(--primary-color); border-radius: 4px; cursor: pointer; font-size: .75rem; color: var(--primary-color); padding: 3px 8px; font-family: inherit; }
      .disabled-enable:disabled, .disabled-enable-all:disabled { opacity: .5; cursor: default; }
      .disabled-all-row { display: flex; justify-content: flex-end; margin-top: 6px; }
      .disabled-optional { margin-top: 8px; font-size: .8rem; }
      .disabled-optional summary { cursor: pointer; color: var(--secondary-text-color); }
      .disabled-optional .disabled-list { margin-top: 6px; }
`;

// Methods mixed into EvccCard.prototype.
export const disabledEntities = {
  // Off in the registry and not enabled since: an entity that has a state was
  // switched on (and ha-evcc reloaded) after the registry was read.
  _isEntityDisabled(id) {
    return this._disabledEntities.has(id) && !this._hass.states[id];
  },

  // The DISABLED_NEEDED entities of a loadpoint whose control the card would
  // show right now if they were on, see the fields there.
  _neededDisabled(ents, lpName) {
    const prefix = this._getPrefix();
    const id = (domain, suffix) => `${domain}.${prefix}${lpName}_${suffix}`;
    // An entity enabled from the card waits for HA's reload of ha-evcc,
    // nothing left to point at; a failed attempt keeps the triangle.
    const pending = eid => this._enabling[eid] && this._enabling[eid].status !== "failed";
    return DISABLED_NEEDED.filter(n => {
      const eid = id(n.domain, n.suffix);
      if (!this._isEntityDisabled(eid) || pending(eid)) return false;
      if (n.hide && this._isSettingHidden(n.hide)) return false;
      if (n.energy && this._socBasedCharging(ents)) return false;
      if (n.needs) {
        const [domain, suffix] = n.needs.split(".");
        if (!ents[suffix] && !this._isEntityDisabled(id(domain, suffix))) return false;
      }
      return true;
    });
  },

  // The triangle in a loadpoint header, only for administrators (nobody else
  // can enable an entity) and switched off by `hide_disabled_hint`. A click
  // opens the list in the debug view.
  _renderDisabledWarn(ents, lpName) {
    if (this._config.hide_disabled_hint || !this._hass.user?.is_admin) return "";
    const missing = this._neededDisabled(ents, lpName);
    if (!missing.length) return "";
    const title = this._t("disabledWarnTitle") + ": " + [...new Set(missing.map(n => this._t(n.what)))].join(", ");
    return `<button class="lp-disabled-warn" data-open-disabled title="${escAttr(title)}" aria-label="${escAttr(title)}">${WARN_ICON}</button>`;
  },

  // The section of the debug view.
  _renderDisabledSection() {
    const entries = disabledCardEntities(this._hass, [...this._disabledEntities], this._getPrefix());
    return `
        <div class="debug-section" id="debug-disabled">
          <div class="debug-section-title">${this._t("disabledTitle")}</div>
          ${disabledEntitiesHtml({ entries, enabling: this._enabling, admin: !!this._hass.user?.is_admin,
                                   t: (k, r) => this._t(k, r), optionalOpen: this._disabledOptionalOpen })}
        </div>`;
  },

  _attachDisabledListeners() {
    // Into the debug view, and back to the card the triangle sat in.
    this._fresh("[data-open-disabled]").forEach(btn => {
      btn.addEventListener("click", () => {
        this._debugReturn = this._config;
        this._config = { ...this._config, mode: "debug" };
        this._lastRenderKey = null;
        this._render();
        this.shadowRoot.getElementById("debug-disabled")?.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    });
    this._fresh(".debug-back").forEach(btn => {
      btn.addEventListener("click", () => {
        this._config = this._debugReturn || this._config;
        this._debugReturn = null;
        this._lastRenderKey = null;
        this._render();
      });
    });

    const rerender = () => { this._lastRenderKey = null; this._render(); };
    const entriesFor = ids => disabledCardEntities(this._hass, ids, this._getPrefix());
    this._fresh("button.disabled-enable").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.disabled = true;
        enableEntities(id => this._enableEntity(id), entriesFor([btn.dataset.enableEntity]), this._enabling, rerender);
      });
    });
    this._fresh("button.disabled-enable-all").forEach(btn => {
      btn.addEventListener("click", () => {
        btn.disabled = true;
        enableEntities(id => this._enableEntity(id), entriesFor(btn.dataset.enableEntities.split(",")), this._enabling, rerender);
      });
    });
    // The morph drops an `open` the template does not carry, so the folded
    // part remembers it here.
    this._fresh("details.disabled-optional").forEach(el => {
      el.addEventListener("toggle", () => { this._disabledOptionalOpen = el.open; });
    });
  },
};

export const disabledCss = disabledListCss + `
      .lp-disabled-warn { display: inline-flex; align-items: center; background: none; border: none; padding: 0 2px; margin-right: 6px; cursor: pointer; color: var(--evcc-amber); flex-shrink: 0; }
      .lp-disabled-warn:hover { filter: brightness(1.15); }
      .debug-back { background: none; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; color: var(--primary-color); padding: 3px 10px; cursor: pointer; font: inherit; font-size: .8rem; }
`;
