import { HIDEABLE_SETTINGS } from "../core/constants.js";
import { featureKeyOf } from "../core/entity-discovery.js";
import { stateVal, attr, displayUnit, isOn } from "../utils/state.js";
import { stepDecimals, fmtNum } from "../utils/format.js";
import { escHtml, escAttr } from "../utils/html.js";

// Sliders with direct-input panel, step override, write-back and battery boost. Methods are mixed into EvccCard.prototype.
export const socControl = {
  _renderSliders(ents) {
    // Heating loadpoints expose limit/min as a target temperature (°C), not a SoC,
    // so relabel the sliders accordingly (value/unit already come from the entity).
    const heating = this._isHeatingLoadpoint(ents);
    const SLIDER_FEATURES = [
      { key: "limit_soc",   label: this._t(heating ? "targetTemp" : "targetSoc") },
      { key: "min_soc",     label: this._t(heating ? "minTemp"    : "minSoc")    },
    ];

    const rows = SLIDER_FEATURES
      .filter(({ key }) => ents[key] && !this._isSettingHidden(key))
      .map(({ key, label }) => this._sliderRow(ents[key], label));

    return rows.length ? `<div class="sliders">${rows.join("")}</div>` : "";
  },

  // `hide_settings: [smart_cost_limit, priority, phases, …]` — see HIDEABLE_SETTINGS.
  _isSettingHidden(key) {
    const h = this._config?.hide_settings;
    return Array.isArray(h) && h.includes(key);
  },

  _renderCurrentBlock(ents, lpName = "") {
    const hide          = k => this._isSettingHidden(k);
    const hasPhases     = !!ents.phases_configured && !hide("phases");
    const hasMaxCurrent = !!ents.max_current && !hide("max_current");
    const hasMinCurrent = !!ents.min_current && !hide("min_current");
    const hasCurrent    = hasMaxCurrent || hasMinCurrent;
    const hasSmartCost  = !!ents.smart_cost_limit && !hide("smart_cost_limit");
    const hasFeedIn     = !!ents.smart_feed_in_priority_limit && !hide("smart_feed_in_priority_limit");
    const hasPriority   = !!ents.priority && !hide("priority");
    const hasBoost      = !!ents.battery_boost_limit && !hide("battery_boost");
    // Everything hidden or missing: no block, no gear button.
    if (!hasPhases && !hasCurrent && !hasSmartCost && !hasFeedIn && !hasPriority && !hasBoost) return "";

    const configDefault = this._config.charge_current_settings === "expanded";
    const expanded = this._currentBlockExpanded[lpName] !== undefined
      ? this._currentBlockExpanded[lpName]
      : configDefault;

    let phasesHtml = "";
    if (hasPhases) {
      const entityId = ents.phases_configured;
      const current  = stateVal(this._hass, entityId);
      const options  = this._hass.states[entityId]?.attributes?.options ?? [];
      const PHASE_LABELS = {
        "automatischer Wechsel": this._t("phaseAuto"), "automatic": this._t("phaseAuto"), "auto": this._t("phaseAuto"), "0": this._t("phaseAuto"),
        "1-phasig": "1", "1": "1",
        "3-phasig": "3", "3": "3",
      };
      const buttons = options.map(opt => `
        <button class="phase-btn ${opt === current ? "active" : ""}"
                data-entity="${entityId}" data-value="${escAttr(opt)}">
          ${PHASE_LABELS[opt] ?? escHtml(opt)}
        </button>`).join("");
      phasesHtml = `
        <div class="select-row">
          <span>${this._t("phases")}</span>
          <div class="phase-btn-group">${buttons}</div>
        </div>`;
    }

    const currentRows = [
      hasMaxCurrent ? this._sliderRow(ents.max_current, this._t("maxCurrent")) : "",
      hasMinCurrent ? this._sliderRow(ents.min_current, this._t("minCurrent")) : "",
    ].join("");

    const gearIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>`;

    return `
      <div class="current-block" data-lp-current="${escAttr(lpName)}">
        <div class="block-title-row">
          <span class="block-title">${this._t("chargeSettings")}</span>
          <button class="current-toggle-btn ${expanded ? "active" : ""}"
                  data-lp-current-toggle="${escAttr(lpName)}"
                  title="${expanded ? this._t("hideSettings") : this._t("showSettings")}">
            ${gearIcon}
          </button>
        </div>
        <div class="current-block-body" ${expanded ? "" : "hidden"}>
          ${phasesHtml}
          ${currentRows}
          ${(hasPhases || hasCurrent) && (hasBoost || hasPriority || hasSmartCost || hasFeedIn) ? `<hr class="settings-divider">` : ""}
          ${hasBoost ? this._renderBatteryBoost(ents) : ""}
          ${hasBoost && (hasPriority || hasSmartCost || hasFeedIn) ? `<hr class="settings-divider">` : ""}
          ${hasPriority ? this._sliderRow(ents.priority, this._t("priority")) : ""}
          ${hasPriority && (hasSmartCost || hasFeedIn) ? `<hr class="settings-divider">` : ""}
          ${hasSmartCost ? (() => {
            const unit      = attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "";
            const isCo2     = unit === "g/kWh";
            const label     = isCo2 ? this._t("smartCostLimitCo2") : this._t("smartCostLimitPrice");
            const scTariffId = isCo2 ? `sensor.${this._getPrefix()}tariff_co2` : `sensor.${this._getPrefix()}tariff_grid`;
            const scTariff   = parseFloat(this._hass.states[scTariffId]?.state ?? "NaN");
            const active     = !isNaN(scTariff) && scTariff <= parseFloat(stateVal(this._hass, ents.smart_cost_limit) || 0);
            const clearId   = ents.smart_cost_limit.replace(/^number\./, "button.");
            const hasClear  = !!this._hass.states[clearId];
            return `<div class="smart-cost-section" data-lp-smart-cost-section="${escAttr(lpName)}">` +
              this._sliderRow(ents.smart_cost_limit, label) +
              (active ? `<div class="smart-active-hint">⚡ ${this._t("smartCostActive")}</div>` : "") +
              (hasClear ? `<div class="smart-cost-clear-row"><button class="smart-cost-clear-btn" data-entity="${clearId}">✕ ${this._t("smartCostClear")}</button></div>` : "") +
              `</div>`;
          })() : ""}
          ${hasSmartCost && hasFeedIn ? `<hr class="settings-divider">` : ""}
          ${hasFeedIn ? (() => {
            // Feed-in priority: above this feed-in limit, evcc prioritizes selling to the
            // grid over PV-surplus charging. Like the smart charging limit, the limit follows
            // evcc's global cost type, so the unit is currency/kWh (price mode) or g/kWh
            // (CO2 mode); _sliderRow renders whichever unit the entity reports. The
            // integration's binary_sensor is the authoritative "active" signal in both modes.
            const active     = ents.smart_feed_in_priority_active
              ? isOn(this._hass, ents.smart_feed_in_priority_active)
              : false;
            const clearId   = ents.smart_feed_in_priority_limit.replace(/^number\./, "button.");
            const hasClear  = !!this._hass.states[clearId];
            return `<div class="smart-cost-section" data-lp-feed-in-section="${escAttr(lpName)}">` +
              this._sliderRow(ents.smart_feed_in_priority_limit, this._t("feedInPriorityLimit")) +
              (active ? `<div class="smart-active-hint">⚡ ${this._t("feedInPriorityActive")}</div>` : "") +
              (hasClear ? `<div class="smart-cost-clear-row"><button class="smart-cost-clear-btn" data-entity="${clearId}">✕ ${this._t("smartCostClear")}</button></div>` : "") +
              `</div>`;
          })() : ""}
        </div>
      </div>`;
  },

  _sliderOptions(entityId) {
    return (attr(this._hass, entityId, "options") ?? [])
      .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
  },

  // The user-facing value behind a range input: select-backed sliders carry an
  // option index, number sliders carry the value itself.
  _sliderValueFor(input) {
    if (input.dataset.domain !== "select") return input.value;
    const opts = this._sliderOptions(input.dataset.entity);
    if (opts.length === 0) return input.value;
    const idx = Math.min(Math.max(Math.round(parseFloat(input.value)) || 0, 0), opts.length - 1);
    return String(opts[idx]);
  },

  _sliderRow(entityId, label, zeroLabel = null) {
    const domain  = entityId.split(".")[0];
    const _v      = parseFloat(stateVal(this._hass, entityId));
    const val     = isNaN(_v) ? 0 : _v;
    const unit    = displayUnit(this._hass, entityId);
    let min, max, step, sliderVal;

    if (domain === "select") {
      // Select-backed sliders walk option INDEXES, not values: ha-evcc option
      // lists are not uniform (min_current offers 0.125/0.25/0.5 A besides the
      // 1 A grid since 2026.8.9), so a value-based step would create hundreds
      // of slider positions that don't exist as options.
      const opts = this._sliderOptions(entityId);
      min  = 0;
      max  = Math.max(opts.length - 1, 0);
      step = 1;
      // For the same reason `slider_steps` cannot apply here. Where ha-evcc
      // exposes a feature as a select, a configured step would have to mean
      // "every n-th option", which is not what the config asks for. Say so
      // once instead of ignoring the entry without a word.
      this._warnSliderStepIgnored(entityId);
      sliderVal = opts.length
        ? opts.reduce((best, o, i) => Math.abs(o - val) < Math.abs(opts[best] - val) ? i : best, 0)
        : 0;
    } else {
      min  = attr(this._hass, entityId, "min")  ?? 0;
      max  = attr(this._hass, entityId, "max")  ?? 100;
      // `slider_steps: { smart_cost_limit: 0.01 }` overrides the entity's own step.
      step = this._sliderStepOverride(entityId) ?? (attr(this._hass, entityId, "step") ?? 1);
      sliderVal = val;
    }

    // The value doubles as a tap target that opens the direct-input panel
    // (see _openSliderEdit); it must stay the range input's next sibling
    // because the live "input" handler updates it by that relation.
    return `
      <div class="slider-row">
        <label>${label}</label>
        <div class="slider-control">
          <input type="range"
                 min="${min}" max="${max}" step="${step}" value="${sliderVal}"
                 data-entity="${entityId}"
                 data-domain="${domain}" />
          <button type="button" class="slider-val" data-slider-edit
                  title="${this._t("sliderEditHint")}">${zeroLabel && val === 0 ? zeroLabel : `${val} ${escHtml(unit)}`}</button>
        </div>
      </div>`;
  },

  // Optional per-feature step override from the card config, keyed by the
  // ha-evcc feature key: `slider_steps: { smart_cost_limit: 0.01, limit_soc: 5 }`.
  // The key is matched against the feature the entity was discovered under, not
  // against the tail of its id, so `soc` cannot steer `min_soc` and `limit_soc`
  // at once. Only meaningful for number-backed sliders; select-backed ones walk
  // options (see _warnSliderStepIgnored).
  _sliderStepOverride(entityId) {
    const key = this._sliderStepKey(entityId);
    if (!key) return null;
    const step = parseFloat(this._config.slider_steps[key]);
    return step > 0 ? step : null;
  },

  // The `slider_steps` key that applies to this entity, or null.
  _sliderStepKey(entityId) {
    const steps = this._config?.slider_steps;
    if (!steps || typeof steps !== "object") return null;
    const key = featureKeyOf(entityId, this._getPrefix());
    return key && Object.prototype.hasOwnProperty.call(steps, key) ? key : null;
  },

  // A step configured for a select-backed slider never takes effect. Warn once
  // per key and value, so the config change is visible in the console too.
  _warnSliderStepIgnored(entityId) {
    const key = this._sliderStepKey(entityId);
    if (!key) return;
    const seen = this._warnedSliderSteps ??= new Set();
    const mark = `${key}=${this._config.slider_steps[key]}`;
    if (seen.has(mark)) return;
    seen.add(mark);
    console.warn(`[evcc-card] slider_steps.${key} is ignored: ha-evcc provides ${entityId} as a select, `
      + "and that slider walks the option list. slider_steps only applies to number entities.");
  },

  _sliderWrite(entityId, domain, value) {
    if (domain === "select") {
      if (this._sliderOptions(entityId).length === 0) return;
      this._setSelectOption(entityId, String(value));
    } else {
      this._setNumberValue(entityId, value);
    }
  },

  // ── Slider direct input ──────────────────────────────────────────────
  // Tapping the value next to a slider opens a touch-sized row below it:
  // [−] [ value unit ] [+] [apply] [cancel] (SVG icons). −/+ walk the slider step (or the next
  // select option), the field takes an exact value (comma or dot), ✓/Enter
  // writes, ✕/Escape discards. One panel at a time; hass updates are deferred
  // while it is open, exactly like during a drag.
  // `local` (optional) describes a slider that does not go through _sliderWrite,
  // e.g. the charge-plan target or battery boost: { unit, value, onApply(value),
  // format?(value) → label }. Entity sliders derive everything from the range
  // input's data attributes and write via _sliderWrite.
  _openSliderEdit(btn, local = null) {
    this._closeSliderEdit();
    const input = btn.previousElementSibling;
    const row   = btn.closest(".slider-row, .plan-row");
    if (!input || !row || input.type !== "range") return;

    const entityId = local ? null : input.dataset.entity;
    const domain   = local ? "number" : input.dataset.domain;
    const unit     = local ? (local.unit ?? "") : displayUnit(this._hass, entityId);
    const opts     = domain === "select" ? this._sliderOptions(entityId) : [];
    const min      = parseFloat(input.min), max = parseFloat(input.max);
    const step     = parseFloat(input.step) || 1;
    const decimals = domain === "select" ? 3 : stepDecimals(step);
    const raw      = local ? parseFloat(local.value) : parseFloat(stateVal(this._hass, entityId));
    let cur        = !isNaN(raw) ? raw : (domain === "select" ? (opts[0] ?? 0) : min);

    const panel = document.createElement("div");
    panel.className = "slider-edit";
    panel.innerHTML = `
      <button type="button" class="slider-edit-btn" data-edit-dec aria-label="−"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19,13H5V11H19V13Z"/></svg></button>
      <div class="slider-edit-field">
        <input type="text" inputmode="decimal" class="slider-edit-input" autocomplete="off" spellcheck="false" />
        <span class="slider-edit-unit">${escHtml(unit)}</span>
      </div>
      <button type="button" class="slider-edit-btn" data-edit-inc aria-label="+"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg></button>
      <button type="button" class="slider-edit-btn slider-edit-ok" data-edit-ok
              title="${this._t("sliderEditApply")}" aria-label="${this._t("sliderEditApply")}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg></button>
      <button type="button" class="slider-edit-btn slider-edit-cancel" data-edit-cancel
              title="${this._t("sliderEditCancel")}" aria-label="${this._t("sliderEditCancel")}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button>`;
    row.appendChild(panel);
    btn.classList.add("editing");
    this._sliderEditing   = true;
    this._sliderEditPanel = panel;

    // Any click elsewhere on the page dismisses the panel. Inside the card a tab
    // switch or the gear toggle (both only flip `hidden`, no re-render) would
    // otherwise leave the panel open in a hidden section; outside the card
    // nothing else ever closes it, and an open panel keeps hass updates deferred
    // for as long as it lives. Listening on the document covers both (the
    // composed path still names the shadow nodes). Runs in the capture phase so
    // the click still reaches its own target; a pending re-render is deferred
    // past the click for the same reason. A hidden tab (phone lock, app switch)
    // closes the panel too, so the card is live again when it comes back.
    this._sliderEditOutside = (e) => {
      const path = e.composedPath();
      if (path.includes(panel) || path.includes(btn)) return;
      this._closeSliderEdit(true);
    };
    this._sliderEditHidden = () => { if (document.hidden) this._closeSliderEdit(); };
    document.addEventListener("click", this._sliderEditOutside, true);
    document.addEventListener("visibilitychange", this._sliderEditHidden);

    const field = panel.querySelector(".slider-edit-input");
    const parse = () => parseFloat(String(field.value).trim().replace(",", "."));
    const snap  = v => {
      if (isNaN(v)) return cur;
      if (domain === "select") {
        return opts.length ? opts.reduce((b, o) => Math.abs(o - v) < Math.abs(b - v) ? o : b, opts[0]) : v;
      }
      const clamped = Math.min(Math.max(v, min), max);
      return Number((Math.round((clamped - min) / step) * step + min).toFixed(decimals));
    };
    const show  = () => { field.value = fmtNum(cur, decimals); };
    const nudge = dir => {
      if (domain === "select") {
        const i = opts.indexOf(snap(parse()));
        cur = opts[Math.min(Math.max((i < 0 ? 0 : i) + dir, 0), opts.length - 1)] ?? cur;
      } else {
        cur = snap(snap(parse()) + dir * step);
      }
      show();
    };
    const apply = () => {
      cur = snap(parse());
      // Reflect immediately; for entity sliders the next hass update re-renders anyway.
      input.value     = domain === "select" ? String(Math.max(opts.indexOf(cur), 0)) : String(cur);
      btn.textContent = local?.format ? local.format(cur) : `${fmtNum(cur, decimals)} ${unit}`;
      if (local) local.onApply?.(cur);
      else       this._sliderWrite(entityId, domain, cur);
      this._closeSliderEdit();
    };
    show();

    panel.querySelector("[data-edit-dec]").addEventListener("click", () => nudge(-1));
    panel.querySelector("[data-edit-inc]").addEventListener("click", () => nudge(+1));
    panel.querySelector("[data-edit-ok]").addEventListener("click", apply);
    panel.querySelector("[data-edit-cancel]").addEventListener("click", () => this._closeSliderEdit());
    field.addEventListener("keydown", e => {
      if (e.key === "Enter")       { e.preventDefault(); apply(); }
      else if (e.key === "Escape") { e.preventDefault(); this._closeSliderEdit(); }
    });
    field.focus();
    field.select();
  },

  _closeSliderEdit(deferRender = false) {
    const panel = this._sliderEditPanel;
    if (panel) {
      panel.parentNode?.querySelector(".slider-val.editing")?.classList.remove("editing");
      panel.remove();
    }
    this._sliderEditPanel = null;
    this._dropSliderEditOutside();
    if (this._sliderEditing) {
      this._sliderEditing = false;
      if (this._pendingRender) {
        if (deferRender) {
          // The click that closed this panel may open another one before the
          // timeout runs; the flag then stays set and closing that panel renders.
          setTimeout(() => {
            if (this._sliderEditing || !this._pendingRender) return;
            this._pendingRender = false;
            this._render();
          }, 0);
        } else {
          this._pendingRender = false;
          this._render();
        }
      }
    }
  },

  _dropSliderEditOutside() {
    if (this._sliderEditOutside) {
      document.removeEventListener("click", this._sliderEditOutside, true);
      this._sliderEditOutside = null;
    }
    if (this._sliderEditHidden) {
      document.removeEventListener("visibilitychange", this._sliderEditHidden);
      this._sliderEditHidden = null;
    }
  },

  _boostCommit(input) {
    this._isDragging = false;
    const val      = parseInt(input.value, 10);
    const entityId = input.dataset.boostEntity;

    this._boostPending = { entityId, val, ts: Date.now() };
    const options = JSON.parse(input.dataset.options || "[]");
    const numOpts = options.map(o => parseInt(o)).filter(o => !isNaN(o));
    const nearest = numOpts.reduce((p, c) =>
      Math.abs(c - val) < Math.abs(p - val) ? c : p, numOpts[0] ?? val);
    this._setSelectOption(entityId, String(nearest));

    if (this._pendingRender) { this._pendingRender = false; this._render(); }
  },

  _renderBatteryBoost(ents) {
    if (!ents.battery_boost_limit) return "";

    const limitId  = ents.battery_boost_limit;
    const current  = stateVal(this._hass, limitId);
    const options  = this._hass.states[limitId]?.attributes?.options ?? [];
    const pctOpts  = options.map(o => parseInt(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
    const min      = pctOpts[0] ?? 0;
    const max      = pctOpts[pctOpts.length - 1] ?? 100;
    const step     = pctOpts.length > 1 ? (pctOpts[1] - pctOpts[0]) : 5;
    const limitPct = (!current || current === "unknown") ? 100 : parseInt(current);
    let   curPct   = limitPct;
    if (this._boostPending && this._boostPending.entityId === limitId &&
        Date.now() - this._boostPending.ts < 2500) {
      curPct = this._boostPending.val;
    }
    const label    = curPct === 100 ? this._t("toggleOff") : curPct === 0 ? `0 % (${this._t("fullDischarge")})` : `${curPct} %`;
    return `
      <div class="slider-row">
        <label>${this._t("batteryBoost")}</label>
        <div class="slider-control">
          <input type="range"
                 min="${min}" max="${max}" step="${step}" value="${curPct}"
                 data-boost-entity="${limitId}"
                 data-options='${escAttr(JSON.stringify(options))}' />
          <button type="button" class="slider-val boost-val" data-boost-edit
                  title="${this._t("sliderEditHint")}">${label}</button>
        </div>
      </div>`;
  },

  // Listeners of the sliders: the battery boost range with its direct input,
  // the clear button of the smart cost limits, every other range (drag,
  // keyboard, write-back) and the tap target that opens the direct input.
  // Called by _attachListeners() after every render.
  _attachSliderListeners() {
    this._fresh("input[data-boost-entity]").forEach(input => {
      input.addEventListener("pointerdown", () => { this._isDragging = true; this._pendingRender = false; });
      input.addEventListener("input", () => {
        const val     = parseInt(input.value, 10);
        const display = input.nextElementSibling;
        if (!display) return;
        display.textContent = val === 100 ? this._t("toggleOff") : val === 0 ? `0 % (${this._t("fullDischarge")})` : `${val} %`;
      });
      input.addEventListener("pointerup",  () => this._boostCommit(input));
      input.addEventListener("blur",       () => this._boostCommit(input));
    });

    // Direct input for battery boost: the range already carries the option
    // list, so apply just moves the range and reuses _boostCommit.
    this._fresh("button.boost-val[data-boost-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.classList.contains("editing")) { this._closeSliderEdit(); return; }
        const input = btn.previousElementSibling;
        this._openSliderEdit(btn, {
          unit:    "%",
          value:   parseInt(input?.value, 10),
          format:  v => v === 100 ? this._t("toggleOff") : v === 0 ? `0 % (${this._t("fullDischarge")})` : `${v} %`,
          onApply: () => this._boostCommit(input),
        });
      });
    });

    this._fresh("button.smart-cost-clear-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._pressButton(btn.dataset.entity);
      });
    });

    this._fresh("input[type=range]:not(.plan-soc-range):not([data-boost-entity])").forEach(input => {
      input.addEventListener("pointerdown", () => {
        this._isDragging    = true;
        this._pendingRender = false;
      });
      input.addEventListener("input", () => {
        const span = input.nextElementSibling;
        if (span) span.textContent = `${this._sliderValueFor(input)} ${displayUnit(this._hass, input.dataset.entity)}`;
      });
      input.addEventListener("pointerup", () => {
        this._isDragging = false;
        const domain   = input.dataset.domain;
        const entityId = input.dataset.entity;
        this._sliderWrite(entityId, domain, domain === "select" ? this._sliderValueFor(input) : parseFloat(input.value));
        if (this._pendingRender) { this._pendingRender = false; this._render(); }
      });
      input.addEventListener("blur", () => {
        if (this._isDragging) {
          this._isDragging = false;
          if (this._pendingRender) { this._pendingRender = false; this._render(); }
        }
      });
      // Keyboard changes (arrows, Home/End, PageUp/Down) never went through
      // pointerup, so they updated the label but were never written to HA.
      // The value at the first keydown is the reference (key repeat fires
      // keydown again, keyup once): a key that moved nothing, e.g. at a bound
      // of the range, causes no write.
      const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
      let keyStart = null;
      input.addEventListener("keydown", (e) => {
        if (NAV_KEYS.includes(e.key) && keyStart === null) keyStart = input.value;
      });
      input.addEventListener("keyup", (e) => {
        if (!NAV_KEYS.includes(e.key)) return;
        const unchanged = keyStart !== null && keyStart === input.value;
        keyStart = null;
        if (unchanged) return;
        const domain   = input.dataset.domain;
        const entityId = input.dataset.entity;
        this._sliderWrite(entityId, domain, domain === "select" ? this._sliderValueFor(input) : parseFloat(input.value));
      });
    });

    this._fresh("button.slider-val[data-slider-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.classList.contains("editing")) this._closeSliderEdit();
        else this._openSliderEdit(btn);
      });
    });
  },
};

// Sliders, the direct-input panel and the charge settings block.
// Part of the card stylesheet, see src/styles.js.
export const sliderCss = `
      .sliders { margin-bottom: 10px; }
      .slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: .83rem; flex-wrap: wrap; }
      .slider-row label { flex: 0 0 auto; min-width: 70px; white-space: nowrap; color: var(--secondary-text-color); }
      .slider-control { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 120px; }
      .slider-control input { flex: 1; min-width: 0; accent-color: var(--primary-color); }
      .slider-val { flex-shrink: 0; min-width: 52px; text-align: right; font-size: .8rem; }
      /* The value is a tap target: same look as before, but a thumb-sized hit
         area (padding + negative margin keeps the row height unchanged). */
      button.slider-val {
        background: none; border: none; font-family: inherit; color: inherit; cursor: pointer;
        padding: 8px 6px; margin: -8px -6px; border-radius: 6px; line-height: 1.2;
        text-decoration: underline dotted; text-decoration-color: var(--secondary-text-color, #888);
        text-underline-offset: 3px; touch-action: manipulation;
      }
      button.slider-val:hover, button.slider-val.editing { color: var(--primary-color); text-decoration-color: currentColor; }
      button.slider-val:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      /* Direct-input panel: full-width row under the slider, every control ≥44px. */
      .slider-edit { flex: 0 0 100%; display: flex; align-items: center; gap: 8px; margin: 6px 0 2px; }
      .slider-edit-btn {
        flex: 0 0 auto; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--divider-color, #555); border-radius: 8px; cursor: pointer; font-family: inherit;
        background: var(--secondary-background-color, rgba(127,127,127,0.12)); color: var(--primary-text-color);
        font-size: 1.3rem; line-height: 1; padding: 0; touch-action: manipulation; user-select: none;
      }
      .slider-edit-btn:active { filter: brightness(0.9); }
      .slider-edit-ok     { color: var(--evcc-green); font-weight: 700; }
      .slider-edit-cancel { color: var(--secondary-text-color); }
      .slider-edit-field {
        flex: 1 1 80px; min-width: 64px; min-height: 44px; display: flex; align-items: center; box-sizing: border-box;
        border: 1px solid var(--divider-color, #555); border-radius: 8px; padding: 0 10px;
        background: var(--card-background-color, #fff);
      }
      .slider-edit-field:focus-within { border-color: var(--primary-color); }
      .slider-edit-input {
        flex: 1; min-width: 0; width: 100%; border: none; background: none; outline: none;
        font-family: inherit; font-size: 1.15rem; color: var(--primary-text-color); text-align: right; padding: 0;
      }
      .slider-edit-unit { flex: 0 0 auto; margin-left: 6px; font-size: .9rem; color: var(--secondary-text-color); white-space: nowrap; }
      /* Narrow cards (≈300 px): 4 × 40 px buttons + 4 gaps + a 64 px field still fit the content box. */
      @container (max-width: 340px) {
        .slider-edit { gap: 6px; }
        .slider-edit-btn { min-width: 40px; }
        .slider-edit-field { flex-basis: 64px; min-width: 64px; padding: 0 8px; }
      }
      .smart-active-hint { font-size: .75rem; color: var(--evcc-green); margin-top: -4px; margin-bottom: 8px; }
      .smart-cost-clear-row { display: flex; justify-content: flex-end; margin-top: 6px; margin-bottom: 2px; }
      .smart-cost-clear-btn { background: none; border: 1px solid var(--divider-color, #555); border-radius: 4px; cursor: pointer; font-size: .75rem; color: var(--secondary-text-color); padding: 3px 8px; font-family: inherit; transition: border-color .15s, color .15s; }
      .smart-cost-clear-btn:hover { border-color: var(--evcc-red); color: var(--evcc-red); }
      .smart-cost-chip { display: inline-flex; align-items: center; gap: 3px; font-size: .72rem; color: var(--secondary-text-color); white-space: nowrap; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
      .smart-cost-chip:hover { color: var(--primary-color); }
      .smart-cost-chip.active { color: var(--evcc-green); }
      .smart-cost-chip.active:hover { color: var(--evcc-green); filter: brightness(1.2); }
      .settings-divider { border: none; border-top: 1px solid var(--divider-color, #e5e7eb); margin: 8px 0; }
      @keyframes smart-cost-pulse { 0%,100% { background: transparent; } 40% { background: color-mix(in srgb, var(--primary-color) 15%, transparent); } }
      .smart-cost-highlight { border-radius: 6px; animation: smart-cost-pulse 1.5s ease; }

      .current-block {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 10px; padding-top: 10px; margin-bottom: 10px;
      }
      .block-title-row {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
      }
      .block-title {
        font-size: .7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: .08em; color: var(--secondary-text-color);
      }
      .current-toggle-btn {
        background: transparent; border: none; border-radius: 50%;
        color: var(--secondary-text-color); cursor: pointer;
        padding: 3px; display: flex; align-items: center; justify-content: center;
        transition: color .15s, background .15s; margin: -3px;
      }
      .current-toggle-btn:hover {
        color: var(--primary-color);
        background: var(--secondary-background-color, rgba(0,0,0,.06));
      }
      .current-toggle-btn.active { color: var(--primary-color); }
      .current-block-body[hidden] { display: none; }

      .selects { margin-bottom: 10px; }
      .select-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      .phase-btn-group, .pill-btn-group { display: flex; gap: 4px; }
      button.phase-btn, button.pill-btn {
        padding: 3px 10px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s; white-space: nowrap;
      }
      button.phase-btn.active, button.pill-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
`;
