import { discoverEntities } from "../core/entity-discovery.js";
import { stateVal, isOn } from "../utils/state.js";
import { evccDate, fmtDuration, fmtNum } from "../utils/format.js";
import { escHtml, escAttr } from "../utils/html.js";

// Charge plan block with preview chart, plan mode and repeating plans. Methods are mixed into EvccCard.prototype.
export const planningView = {
  // Whether the loadpoint and compact modes draw the plan block: it needs the
  // plan SoC entity, an EV loadpoint and a vehicle with a SoC or a running
  // plan. The plan chip under the header asks the same, as it jumps there.
  // `force` (the plan mode) drops the last condition.
  _hasPlanBlock(ents, force = false) {
    if (!ents.effective_plan_soc || !this._hass.states[ents.effective_plan_soc]) return false;
    // Heating loadpoints (ha-evcc 'is_heating') are not EV charge points — their
    // "SOC" is a target temperature. The EV charge-plan UI/preview does not apply.
    if (this._isHeatingLoadpoint(ents)) return false;
    const planActive = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    return force || !!ents.vehicle_soc || planActive;
  },

  _renderPlanBlock(lpName, ents, force = false) {
    const planActive = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const planTime   = ents.effective_plan_time
      ? stateVal(this._hass, ents.effective_plan_time) : null;
    const planSoc    = ents.effective_plan_soc
      ? stateVal(this._hass, ents.effective_plan_soc) : null;
    const projStart  = ents.plan_projected_start
      ? stateVal(this._hass, ents.plan_projected_start) : null;
    const projEnd    = ents.plan_projected_end
      ? stateVal(this._hass, ents.plan_projected_end) : null;

    if (!this._hasPlanBlock(ents, force)) return "";

    const vehicleEntityId    = ents.vehicle_name || null;
    const vehicleAttrs       = vehicleEntityId ? (this._hass.states[vehicleEntityId]?.attributes ?? {}) : {};
    // "null" is ha-evcc's "no vehicle assigned": the guest vehicle while a car is
    // plugged in, no vehicle otherwise (evcc's Vehicles/Title.vue).
    const allOptions         = vehicleAttrs.options ?? [];
    const connected          = !!ents.connected && isOn(this._hass, ents.connected);
    const vehicleAttr        = vehicleAttrs.vehicle ?? null;

    if (!this._planState[lpName]) {
      this._planState[lpName] = { soc: null, energy: null, kind: null, time: null, vehicle: null };
    }
    // evcc plans a vehicle with a SoC and a capacity in percent, everything
    // else (guest vehicle, a vehicle without SoC) on the loadpoint in kWh.
    const kind      = this._planKind(ents);
    const maxEnergy = this._planMaxEnergy(ents);
    const planState = this._planState[lpName];
    if (planState.kind !== kind) { planState.kind = kind; planState.energy = null; }
    if (kind === "energy" && planState.energy == null) {
      const planned = ents.plan_energy ? parseFloat(stateVal(this._hass, ents.plan_energy)) : NaN;
      planState.energy = Math.min(maxEnergy, planned > 0 ? Math.round(planned) : 10);
    }

    if (this._planState[lpName].soc == null) {
      const vehicleLimitSoc = vehicleAttr?.limitSoc > 0 ? vehicleAttr.limitSoc : null;
      const entityLimitSoc  = ents.effective_limit_soc
        ? Math.round(parseFloat(stateVal(this._hass, ents.effective_limit_soc))) : null;
      const parsedPlanSoc = parseFloat(planSoc);
      this._planState[lpName].soc = (parsedPlanSoc > 0)
        ? Math.round(parsedPlanSoc)
        : vehicleLimitSoc ?? (entityLimitSoc > 0 ? entityLimitSoc : 80);
    }

    if (this._planState[lpName].time == null) {
      let initDt = "";
      if (planTime && planTime !== "unknown" && planTime !== "unavailable") {
        try {
          const d = new Date(planTime);
          const offset = d.getTimezoneOffset() * 60000;
          initDt = new Date(d - offset).toISOString().slice(0, 16);
        } catch(e) {}
      }
      if (!initDt) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(7, 0, 0, 0);
        const offset = tomorrow.getTimezoneOffset() * 60000;
        initDt = new Date(tomorrow - offset).toISOString().slice(0, 16);
      }
      this._planState[lpName].time = initDt;
    }

    const defaultSoc     = this._planState[lpName].soc;
    const defaultDt      = this._planState[lpName].time;

    const currentVehicleId = vehicleEntityId ? this._hass.states[vehicleEntityId]?.state : null;

    const dbIdToName = {};
    allOptions.forEach(id => {
      if (id === "null") {
        dbIdToName[id] = this._t(connected ? "vehicleGuest" : "vehicleNone");
        return;
      }
      if (id === currentVehicleId && vehicleAttr?.name && vehicleAttr.name !== "null") {
        dbIdToName[id] = vehicleAttr.name;
        return;
      }
      const path = `component.evcc_intg.entity.select.vehiclename.state.${String(id).toLowerCase()}`;
      const translated = this._hass.localize(path);
      dbIdToName[id] = translated || id;
    });

    if (allOptions.includes(currentVehicleId)) {
      if (this._planState[lpName].vehicle && this._planState[lpName].vehicle !== currentVehicleId) {
        this._planState[lpName].soc  = null;
        this._planState[lpName].time = null;
      }
      this._planState[lpName].vehicle = currentVehicleId;
    }
    const defaultVehicle = this._planState[lpName].vehicle;

    const vehicleSelectHtml = allOptions.some(id => id !== "null") ? `
      <div class="plan-row">
        <label>${this._t("vehicle")}</label>
        <select class="plan-vehicle-select" data-lp="${escAttr(lpName)}" data-entity="${vehicleEntityId ?? ""}">
          ${allOptions.map(id => `
            <option value="${escAttr(id)}" ${id === defaultVehicle ? "selected" : ""}>${escHtml(dbIdToName[id])}</option>
          `).join("")}
        </select>
      </div>` : "";

    const fmtDt = (iso) => {
      if (!iso || iso === "unknown" || iso === "unavailable") return null;
      try {
        return new Date(iso).toLocaleString(this._config.language || this._hass?.language || "en", {
          weekday: "short", day: "2-digit", month: "2-digit",
          hour: "2-digit", minute: "2-digit"
        });
      } catch(e) { return null; }
    };

    const startStr = fmtDt(projStart);
    const endStr   = fmtDt(projEnd);

    const contEntityId = ents.plan_strategy_continuous;
    const contState    = contEntityId ? this._hass.states[contEntityId] : null;
    const contOn       = contState ? isOn(this._hass, contEntityId) : false;
    const contHtml     = contState ? `
      <div class="plan-row">
        <label>${this._t("planStrategyContinuous")}</label>
        <button class="toggle ${contOn ? "on" : ""}"
                data-entity="${contEntityId}"
                data-domain="switch"
                data-on="${contOn}"
                data-lp="${escAttr(lpName)}">
          ${contOn ? this._t("toggleOn") : this._t("toggleOff")}
        </button>
      </div>` : "";

    const preEntityId  = ents.plan_strategy_precondition;
    const preState     = preEntityId ? this._hass.states[preEntityId] : null;
    const preOptions   = preState?.attributes?.options ?? [];
    const preCurrent   = preState?.state ?? "0";
    const fmtPre = (sec) => {
      const n = parseInt(sec, 10);
      if (n === 0)      return this._t("preconditionOff");
      if (n >= 604800)  return this._t("preconditionAll");
      if (n < 3600)     return this._t("preconditionMin",  { val: Math.round(n / 60) });
      return this._t("preconditionHour", { val: Math.round(n / 3600) });
    };
    const preHtml = (preState && preOptions.length) ? `
      <div class="plan-row">
        <label>${this._t("planStrategyPrecondition")}</label>
        <select class="plan-precondition-select" data-entity="${preEntityId}" data-lp="${escAttr(lpName)}">
          ${preOptions.map(opt => `
            <option value="${escAttr(opt)}" ${opt === preCurrent ? "selected" : ""}>${fmtPre(opt)}</option>
          `).join("")}
        </select>
      </div>` : "";

    const planBadge = planActive
      ? `<span class="plan-badge active">${this._t("chargingByPlan")}</span>`
      : (planTime && planTime !== "unknown" && planTime !== "unavailable")
        ? `<span class="plan-badge planned">${this._t("planned")}</span>`
        : `<span class="plan-badge">${this._t("noPlan")}</span>`;

    const projectionHtml = (startStr || endStr) ? `
      <div class="plan-projection">
        ${startStr ? `<span style="display:flex;align-items:center;gap:4px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M16.06,3.5L17.5,2.08L18.92,3.5L17.5,4.92L16.06,3.5M7.06,3.5L5.64,2.08L4.22,3.5L5.64,4.92L7.06,3.5M12,6A4,4 0 0,1 16,10V16H13V22H11V16H8V10A4,4 0 0,1 12,6Z"/></svg> ${this._t("planStart")}: <strong>${startStr}</strong></span>` : ""}
        ${endStr   ? `<span>✅ ${this._t("planEnd")}: <strong>${endStr}</strong></span>`      : ""}
      </div>` : "";

    return `
      <div class="plan-block" data-lp="${escAttr(lpName)}">
        <div class="plan-header">
          <span class="session-title">${this._t("chargePlan")}</span>
          ${planBadge}
        </div>
        ${projectionHtml}
        <div class="plan-inputs">
          ${vehicleSelectHtml}
          <div class="plan-row">
            <label>${this._t("finishBy")}</label>
            <input type="datetime-local" class="plan-time-input"
                   value="${defaultDt}" data-lp="${escAttr(lpName)}" />
          </div>
          <div class="plan-row">
            <label>${this._t(kind === "energy" ? "planTargetEnergy" : "targetSoc")}</label>
            <div class="plan-soc-control">
              ${kind === "energy" ? `
              <input type="range" class="plan-soc-range" data-kind="energy"
                     min="1" max="${maxEnergy}" step="1" value="${planState.energy}"
                     data-lp="${escAttr(lpName)}" />
              <button type="button" class="slider-val plan-soc-val" data-plan-soc-edit
                      title="${this._t("sliderEditHint")}">${planState.energy} kWh</button>` : `
              <input type="range" class="plan-soc-range" data-kind="soc"
                     min="20" max="100" step="5" value="${defaultSoc}"
                     data-lp="${escAttr(lpName)}" />
              <button type="button" class="slider-val plan-soc-val" data-plan-soc-edit
                      title="${this._t("sliderEditHint")}">${defaultSoc} %</button>`}
            </div>
          </div>
          ${contHtml}
          ${preHtml}
        </div>
        ${this._renderPlanPreview(lpName)}
        <div class="plan-actions">
          <button class="plan-btn save" data-lp="${escAttr(lpName)}">${this._t("setPlan")}</button>
          ${(planActive || (planTime && planTime !== "unknown" && planTime !== "unavailable"))
            ? `<button class="plan-btn delete" data-lp="${escAttr(lpName)}">${this._t("deletePlan")}</button>`
            : ""}
        </div>
      </div>
    `;
  },

  // "soc" or "energy", the way evcc decides it (socBasedPlanning in core and in
  // the UI's uiLoadpoints.ts): an assigned vehicle that reports a SoC (no
  // "Offline" feature, or a SoC above zero) and has a capacity is planned in
  // percent, anything else on the loadpoint in kWh. The static preview refuses
  // the other kind, so this has to match evcc exactly.
  _planKind(ents) {
    const vehicleId = ents.vehicle_name ? stateVal(this._hass, ents.vehicle_name) : null;
    const vehicle   = vehicleId && vehicleId !== "null"
      ? (this._hass.states[ents.vehicle_name]?.attributes?.vehicle ?? null) : null;
    const capacity  = parseFloat(vehicle?.capacity ?? vehicle?.originObject?.capacity ?? 0) || 0;
    return this._socBasedCharging(ents) && capacity > 0 ? "soc" : "energy";
  },

  // Upper end of the kWh target: the vehicle's capacity when evcc knows it, as
  // in evcc's own plan dialog, else 100 kWh.
  _planMaxEnergy(ents) {
    const vehicleId = ents.vehicle_name ? stateVal(this._hass, ents.vehicle_name) : null;
    const vehicle   = vehicleId && vehicleId !== "null"
      ? (this._hass.states[ents.vehicle_name]?.attributes?.vehicle ?? null) : null;
    const capacity  = parseFloat(vehicle?.capacity ?? vehicle?.originObject?.capacity ?? 0) || 0;
    return capacity > 0 ? Math.ceil(capacity) : 100;
  },

  // The target the plan block collects: { kind, value } or null while unset.
  _planTarget(state) {
    if (!state) return null;
    const value = state.kind === "energy" ? state.energy : state.soc;
    return value ? { kind: state.kind === "energy" ? "energy" : "soc", value } : null;
  },

  // Plan preview: shows charging slot chart + summary when SOC and time are set.
  _renderPlanPreview(lpName) {
    if (!this._hasCmd("plan_preview")) return "";
    const state = this._planState[lpName];
    const target = this._planTarget(state);
    if (!target || !state.time) return "";
    const lpIdx = this._lpIndex(lpName);
    if (lpIdx == null) return "";

    const d = new Date(state.time);
    if (isNaN(d.getTime())) return "";
    const ts = d.toISOString();
    // Cache-only read: serve the cached preview, prime one fetch if absent.
    // Never refetches on its own → an idle plan card makes zero backend calls.
    const res = this._wsPlanPreviewCached({ loadpoint: lpIdx, kind: target.kind, value: target.value, timestamp: ts,
                                            settings: this._planSettingsKey(lpName) });
    if (!res) {
      return `<div class="plan-preview"><div class="plan-preview-loading">${this._t("planPreviewLoading")}</div></div>`;
    }
    if (res.error) {
      return `<div class="plan-preview"><div class="plan-preview-error">${this._t("planPreviewError")}</div></div>`;
    }
    const preview = res.data;
    if (!preview || !Array.isArray(preview.plan) || preview.plan.length === 0) {
      return `<div class="plan-preview"><div class="plan-preview-info">${this._t("planPreviewNoCharge")}</div></div>`;
    }

    // Fetch matching forecast for background bars.
    // CO2 plans use "planner" forecast (tariff API), price plans use "grid".
    const isCo2 = preview.smartCostType === "co2";
    let forecastRates = null;
    if (this._hasCmd("forecast")) {
      const primary = this._wsForecast(isCo2 ? "planner" : "grid");
      if (primary && !primary.error && primary.data?.rates?.length) {
        forecastRates = primary.data.rates;
      }
    }
    const unit = isCo2 ? "g CO₂/kWh" : (preview.currency ? `${escHtml(preview.currency)}/kWh` : "");

    const chart = this._renderPlanPreviewChart(forecastRates, preview.plan, preview, unit);
    const summary = this._renderPlanPreviewSummary(preview, unit);
    return `<div class="plan-preview">${summary}${chart}</div>`;
  },

  _renderPlanPreviewChart(forecastRates, planRates, preview, unit) {
    const now = Date.now();

    // Determine display time range: from now to planTime + 2h buffer, capped at 36h
    const targetTs = preview.planTime ? (evccDate(preview.planTime)?.getTime() ?? null) : null;
    const planEndTimes = planRates.map(r => evccDate(r.end)?.getTime()).filter(t => t != null);
    const planEnd = planEndTimes.length > 0 ? Math.max(...planEndTimes) : now;
    const rangeEnd = targetTs
      ? Math.max(targetTs, planEnd) + 2 * 3600000
      : planEnd + 2 * 3600000;
    const maxRange = 36 * 3600000;
    const displayStart = now;
    const displayEnd = Math.min(rangeEnd, now + maxRange);

    // Build charging time ranges for overlap detection
    const chargingRanges = planRates
      .map(r => ({ start: evccDate(r.start)?.getTime(), end: evccDate(r.end)?.getTime() }))
      .filter(cr => cr.start != null && cr.end != null);
    const isCharging = (s, e) =>
      chargingRanges.some(cr => s < cr.end && e > cr.start);

    // Build slots from forecast, clipped to display range
    const slots = [];
    if (forecastRates && forecastRates.length > 0) {
      for (const r of forecastRates) {
        const s = evccDate(r.start)?.getTime();
        const e = evccDate(r.end)?.getTime();
        if (s == null || e == null) continue;
        if (e <= displayStart || s >= displayEnd) continue;
        slots.push({ start: Math.max(s, displayStart), end: Math.min(e, displayEnd), value: r.value ?? 0, charging: isCharging(s, e) });
      }
    } else {
      for (const r of planRates) {
        const s = evccDate(r.start)?.getTime();
        const e = evccDate(r.end)?.getTime();
        if (s == null || e == null) continue;
        if (e <= displayStart || s >= displayEnd) continue;
        slots.push({ start: Math.max(s, displayStart), end: Math.min(e, displayEnd), value: r.value ?? 0, charging: true });
      }
    }

    if (slots.length === 0) return "";

    // SVG dimensions
    const ML = 4, MR = 4, MT = 2, MB = 26;
    const W = 400, H = 80;
    const CW = W - ML - MR, CH = H - MT - MB;
    const n = slots.length;
    const GAP = 1;
    const bw = Math.max(2, Math.floor((CW - GAP * Math.max(0, n - 1)) / n));
    const totalBarW = bw * n + GAP * (n - 1);
    const xOffset = Math.round((CW - totalBarW) / 2);
    const barX0 = i => ML + xOffset + i * (bw + GAP);

    // Check if forecast (non-charging) values have meaningful variation
    const fVals = slots.filter(s => !s.charging).map(s => s.value);
    const fMax = fVals.length > 0 ? Math.max(...fVals) : 0;
    const fMin = fVals.length > 0 ? Math.min(...fVals) : 0;
    const fRange = fMax - fMin;
    const hasVariation = fRange > 0.001;

    // Bar height: if forecast values vary, scale proportionally.
    // If flat (e.g. fixed price fallback), use fixed heights.
    const barH = (v, charging) => {
      if (hasVariation) {
        const frac = 0.2 + 0.8 * ((v - fMin) / fRange);
        return Math.max(2, Math.round(frac * CH));
      }
      return charging ? CH : Math.round(CH * 0.7);
    };

    // X-axis hour labels — sequential, ~12 labels max
    const showEvery = Math.max(1, Math.ceil(n / 12));
    // Track label x positions to avoid overlaps
    let lastLabelX = -999;

    const bars = slots.map((s, i) => {
      const x0 = barX0(i);
      const cx = x0 + bw / 2;
      const R = bw >= 4 ? 1 : 0;
      const h = barH(s.value, s.charging);
      const y = MT + CH - h;
      const fill = s.charging ? "var(--evcc-green,#22c55e)" : "var(--secondary-text-color,#888)";
      const opacity = s.charging ? "1" : "0.35";

      const barRect = `<rect x="${x0}" y="${y}" width="${bw}" height="${h}"
        fill="${fill}" opacity="${opacity}" rx="${R}"/>`;

      // Hour labels — sequential, no dedup
      let labelSvg = "";
      if (i % showEvery === 0 && (cx - lastLabelX) > 18) {
        const hr = new Date(s.start).getHours();
        labelSvg = `<text x="${cx}" y="${MT + CH + 10}" text-anchor="middle" font-size="7"
             fill="var(--secondary-text-color,#888)">${hr}</text>`;
        lastLabelX = cx;
      }

      return `${barRect}${labelSvg}`;
    }).join("");

    // Target time marker (vertical line + label like evcc)
    let targetMarker = "";
    if (targetTs && slots.length > 1) {
      const slotsStart = slots[0].start;
      const slotsEnd = slots[slots.length - 1].end;
      if (targetTs >= slotsStart && targetTs <= slotsEnd) {
        const frac = (targetTs - slotsStart) / (slotsEnd - slotsStart);
        const tx = ML + xOffset + frac * totalBarW;
        const td = new Date(targetTs);
        const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
        const tLabel = `${dayNames[td.getDay()]}, ${String(td.getHours()).padStart(2,"0")}:${String(td.getMinutes()).padStart(2,"0")}`;
        targetMarker = `
          <line x1="${tx}" y1="${MT + CH}" x2="${tx}" y2="${MT + CH + 14}"
            stroke="var(--evcc-green,#22c55e)" stroke-width="1.5"/>
          <text x="${tx}" y="${MT + CH + 24}" text-anchor="middle" font-size="8"
            fill="var(--evcc-green,#22c55e)" font-weight="600">${tLabel}</text>`;
      }
    }

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"
      style="width:100%;height:auto;display:block">${bars}${targetMarker}</svg>`;
  },

  _renderPlanPreviewSummary(preview, unit) {
    const durStr  = fmtDuration(preview.duration ?? 0);
    const powerKw = fmtNum((preview.power ?? 0) / 1000, 1);

    // Average cost/emission from plan slots
    const planSlots = preview.plan || [];
    const avgVal = planSlots.length > 0
      ? planSlots.reduce((sum, r) => sum + (r.value ?? 0), 0) / planSlots.length
      : 0;

    const isCo2 = preview.smartCostType === "co2";
    const currency = preview.currency || "€";
    const avgLabel = isCo2 ? "CO₂-Emission Ø" : `${this._t("planPreviewCost")} Ø`;
    const avgStr = isCo2
      ? `${Math.round(avgVal)} g/kWh`
      : `${avgVal.toFixed(2)} ${escHtml(currency)}/kWh`;

    return `<div class="plan-preview-header">
      <div class="plan-preview-left">
        <div class="plan-preview-label">${this._t("planPreviewDuration")}</div>
        <div class="plan-preview-value">${durStr} @ ${powerKw} kW</div>
      </div>
      <div class="plan-preview-right">
        <div class="plan-preview-label">${avgLabel}</div>
        <div class="plan-preview-value">${avgStr}</div>
      </div>
    </div>`;
  },

  _renderPlanMode(loadpoints) {
    if (Object.keys(loadpoints).length === 0) return this._renderEmpty(loadpoints);
    return Object.entries(loadpoints).map(([lpName, ents]) => {
      const planHtml    = this._renderPlanBlock(lpName, ents, true);
      const sessionHtml = this._renderSessionInfo(ents);
      if (!planHtml) return "";
      return `
        <div class="loadpoint">
          <div class="lp-header">
            <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          </div>
          ${planHtml}
          ${sessionHtml}
        </div>`;
    }).join("");
  },

  // Repeating plans (ha-evcc 2026.6.1+) are vehicle-scoped switches
  // (switch.<prefix><vehicle>_repeating_plan_N) and therefore never land in the
  // loadpoint buckets of discoverEntities(). We scan hass.states directly and
  // group the plans by vehicle.
  _discoverRepeatingPlans() {
    const prefix    = this._getPrefix();
    const escPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re        = new RegExp(`^switch\\.${escPrefix}(.+)_repeating_plan_(\\d+)$`);
    const states    = this._hass.states;
    const groups     = {};

    for (const entityId of Object.keys(states)) {
      const m = entityId.match(re);
      if (!m) continue;
      const slug = m[1];
      const n    = parseInt(m[2], 10);
      const st   = states[entityId];
      if (!st || st.state === "unavailable" || st.state === "unknown") continue;
      const a = st.attributes || {};
      // Only render plans that actually carry schedule data.
      if (!Array.isArray(a.weekdays) && a.time == null) continue;

      if (!groups[slug]) {
        groups[slug] = { slug, vehicleName: this._vehicleNameForSlug(slug), plans: [] };
      }
      groups[slug].plans.push({
        n,
        entityId,
        active:   st.state === "on",
        weekdays: Array.isArray(a.weekdays) ? a.weekdays.map(Number) : [],
        time:     a.time ?? null,
        soc:      a.soc ?? null,
      });
    }

    let result = Object.values(groups)
      .map(g => ({ ...g, plans: g.plans.sort((x, y) => x.n - y.n) }))
      .filter(g => g.plans.length > 0)
      .sort((x, y) => x.vehicleName.localeCompare(y.vehicleName));

    // Config filter: repeating_plan_vehicles restricts to listed vehicle slugs
    const filter = this._config.repeating_plan_vehicles;
    if (Array.isArray(filter) && filter.length > 0) {
      const allowed = new Set(filter.map(v => String(v).toLowerCase()));
      result = result.filter(g => allowed.has(g.slug.toLowerCase()));
    }

    return result;
  },

  _vehicleNameForSlug(slug) {
    // ha-evcc does not expose the vehicle title on the repeating-plan switch,
    // so derive a readable label from the entity slug (e.g. "mein_auto" → "Mein Auto").
    return String(slug).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  },

  _renderWeekdayBadges(weekdays) {
    // evcc/Go weekday convention: 0 = Sunday … 6 = Saturday.
    // Displayed Monday-first (European order): 1,2,3,4,5,6,0.
    const order = [1, 2, 3, 4, 5, 6, 0];
    const set   = new Set(weekdays || []);
    return order.map(d =>
      `<span class="rplan-day${set.has(d) ? " on" : ""}">${this._t("weekday" + d)}</span>`
    ).join("");
  },

  _renderRepeatPlansBlock(group) {
    const clockSuffix = this._t("clockSuffix");
    const rows = group.plans.map(p => {
      const time = p.time ? `${p.time}${clockSuffix ? " " + clockSuffix : ""}` : "—";
      const soc  = (p.soc != null && p.soc !== "") ? `${p.soc} %` : "—";
      return `
        <div class="rplan-row">
          <div class="rplan-days">${this._renderWeekdayBadges(p.weekdays)}</div>
          <div class="rplan-line">
            <div class="rplan-info">
              <span class="rplan-field"><span class="rplan-label">${this._t("departure")}</span><span class="rplan-value">${time}</span></span>
              <span class="rplan-field"><span class="rplan-label">${this._t("targetSoc")}</span><span class="rplan-value">${soc}</span></span>
            </div>
            <button class="toggle ${p.active ? "on" : ""}"
                    data-entity="${p.entityId}"
                    data-domain="switch"
                    data-on="${p.active}">
              ${p.active ? this._t("toggleOn") : this._t("toggleOff")}
            </button>
          </div>
        </div>`;
    }).join("");
    return `
      <div class="plan-block rplan-block">
        <div class="plan-header">
          <span class="session-title">${this._t("repeatingPlans")}</span>
          <span class="rplan-hint" title="${this._t("repeatingPlansHint")}" aria-label="${this._t("repeatingPlansHint")}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/></svg>
          </span>
        </div>
        <div class="rplan-list">${rows}</div>
      </div>`;
  },

  _renderRepeatPlansMode() {
    const groups = this._discoverRepeatingPlans();
    if (groups.length === 0) {
      return `<div class="empty"><p>${this._t("noRepeatingPlans")}</p></div>`;
    }
    return groups.map(g => {
      const name = (groups.length === 1 && this._config.title) ? this._config.title : g.vehicleName;
      return `
        <div class="loadpoint">
          <div class="lp-header">
            <span class="lp-name">${escHtml(name)}</span>
          </div>
          ${this._renderRepeatPlansBlock(g)}
        </div>`;
    }).join("");
  },

  // Listeners of the charge plan block: precondition, target slider with its
  // direct input, time, vehicle, save and delete. Called by _attachListeners()
  // after every render.
  _attachPlanListeners() {
    this._fresh("select.plan-precondition-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._setSelectOption(sel.dataset.entity, sel.value);
        if (sel.dataset.lp) this._requestPlanPreview(sel.dataset.lp);
      });
    });

    this._fresh("input.plan-soc-range").forEach(input => {
      input.addEventListener("pointerdown", () => {
        this._isDragging    = true;
        this._pendingRender = false;
      });
      input.addEventListener("input", () => {
        const lpName = input.dataset.lp;
        const energy = input.dataset.kind === "energy";
        const val    = parseInt(input.value, 10);
        if (this._planState[lpName]) this._planState[lpName][energy ? "energy" : "soc"] = val;
        const span = input.nextElementSibling;
        if (span) span.textContent = `${val} ${energy ? "kWh" : "%"}`;
      });
      input.addEventListener("pointerup", () => {
        this._isDragging = false;
        this._requestPlanPreview(input.dataset.lp);
        if (this._pendingRender) { this._pendingRender = false; this._render(); }
      });
      input.addEventListener("blur", () => {
        if (this._isDragging) {
          this._isDragging = false;
          if (this._pendingRender) { this._pendingRender = false; this._render(); }
        }
      });
      // Keyboard changes update the state via "input" but never asked for a preview.
      input.addEventListener("keyup", (e) => {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
          this._requestPlanPreview(input.dataset.lp);
        }
      });
    });

    // Direct input for the plan target (local state, no entity behind it).
    this._fresh("button.plan-soc-val[data-plan-soc-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.classList.contains("editing")) { this._closeSliderEdit(); return; }
        const input  = btn.previousElementSibling;
        const lpName = input?.dataset.lp;
        const energy = input?.dataset.kind === "energy";
        this._openSliderEdit(btn, {
          unit:  energy ? "kWh" : "%",
          value: parseInt(input?.value, 10),
          onApply: (val) => {
            if (this._planState[lpName]) this._planState[lpName][energy ? "energy" : "soc"] = val;
            this._requestPlanPreview(lpName);
          },
        });
      });
    });

    this._fresh("input.plan-time-input").forEach(input => {
      input.addEventListener("change", () => {
        const lpName = input.dataset.lp;
        if (this._planState[lpName]) this._planState[lpName].time = input.value;
        this._requestPlanPreview(lpName);
      });
    });

    this._fresh("select.plan-vehicle-select").forEach(sel => {
      sel.addEventListener("change", () => {
        const lpName = sel.dataset.lp;
        const eid    = sel.dataset.entity;
        const val    = sel.value;
        if (this._planState[lpName]) {
          this._planState[lpName].vehicle = val;
          this._planState[lpName].soc     = null;
          this._planState[lpName].time    = null;
        }
        if (eid && this._hass) {
          this._setSelectOption(eid, val);
        }
        this._requestPlanPreview(lpName);
      });
    });

    this._fresh("button.plan-btn.save").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName  = btn.dataset.lp;
        const state   = this._planState[lpName] || {};
        const target  = this._planTarget(state);
        const dtValue = state.time || "";

        if (!dtValue) { alert(this._t("noTimeAlert")); return; }

        const showError = (msg) => {
          const block = btn.closest(".plan-block");
          if (!block) return;
          let errEl = block.querySelector(".plan-error");
          if (!errEl) {
            errEl = document.createElement("div");
            errEl.className = "plan-error";
            block.querySelector(".plan-actions")?.after(errEl);
          }
          errEl.textContent = msg;
        };
        const showSuccess = () => {
          const block = btn.closest(".plan-block");
          if (!block) return;
          const errEl = block.querySelector(".plan-error");
          if (errEl) errEl.remove();
          const badge = block.querySelector(".plan-badge");
          if (badge) { badge.textContent = this._t("planned"); badge.classList.remove("active"); badge.classList.add("planned"); }
        };

        const vehicleDbId = (state.vehicle && state.vehicle !== "null") ? state.vehicle : null;
        const dt  = new Date(dtValue);
        const pad = n => String(n).padStart(2, "0");
        const startdate = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())} ` +
                          `${pad(dt.getHours())}:${pad(dt.getMinutes())}:${pad(dt.getSeconds())}`;

        // A SoC target goes to the vehicle, a kWh target to the loadpoint by its
        // evcc index. ha-evcc takes a call it cannot use without an error and
        // does nothing (set_plan() drops a loadpoint or energy that is not an
        // integer), so a missing index or vehicle is said here instead of
        // leaving a plan badge behind for a plan evcc never received.
        const lpIdx = this._lpIndex(lpName);
        const savePlan = async () => {
          if (!target) return;
          if (target.kind === "soc" && !vehicleDbId) { showError(`❌ ${this._t("planNoTarget")}`); return; }
          if (target.kind === "energy" && lpIdx == null) { showError(`❌ ${this._t("planNoTarget")}`); return; }
          try {
            if (target.kind === "soc") await this._setVehiclePlan(vehicleDbId, target.value, startdate);
            else                       await this._setLoadpointPlan(lpIdx, target.value, startdate);
            window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } }));
            showSuccess();
          } catch(e) {
            showError(`❌ ${e?.message || JSON.stringify(e) || "Unknown error"}`);
          }
        };
        savePlan();
      });
    });

    this._fresh("button.plan-btn.delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName      = btn.dataset.lp;
        const planSt      = this._planState[lpName] || {};
        // A kWh plan lives on the loadpoint, a SoC plan on the vehicle.
        const vehicleDbId = planSt.kind !== "energy" && planSt.vehicle && planSt.vehicle !== "null" ? planSt.vehicle : null;
        const block       = btn.closest(".plan-block");
        const resetBadge  = () => {
          const badge = block?.querySelector(".plan-badge");
          if (badge) { badge.textContent = this._t("noPlan"); badge.classList.remove("active", "planned"); }
        };
        if (vehicleDbId) {
          this._deleteVehiclePlan(vehicleDbId)
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        } else {
          // Deleting works without a kWh target, it only needs the evcc index.
          const lpIdx = this._lpIndex(lpName);
          if (lpIdx == null) { console.warn("[evcc-card] delete plan: no loadpoint index for", lpName); return; }
          this._deleteLoadpointPlan(lpIdx)
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        }
      });
    });
  },
};

// Charge plan block, plan mode and repeating plans.
// Part of the card stylesheet, see src/styles.js.
export const planCss = `
      .plan-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .plan-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .plan-badge { font-size: .7rem; font-weight: 600; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--divider-color); color: var(--secondary-text-color); }
      .plan-badge.planned { background: rgba(0, 120, 180, 0.3); color: #60aaff; }
      .plan-badge.active  { background: color-mix(in srgb, var(--evcc-green) 15%, transparent); color: var(--evcc-green); border-color: var(--evcc-green); }
      .plan-projection { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; color: var(--secondary-text-color); margin-bottom: 10px; padding: 7px 10px; background: var(--secondary-background-color, rgba(0,0,0,.08)); border-radius: 6px; }
      .plan-projection strong { color: var(--primary-text-color); }
      .plan-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .plan-row { display: flex; align-items: center; gap: 8px; font-size: .83rem; flex-wrap: wrap; }
      .plan-row label { flex: 0 0 auto; min-width: 60px; white-space: nowrap; color: var(--secondary-text-color); }
      .plan-soc-control { display: flex; align-items: center; gap: 8px; flex: 1; }
      .plan-soc-range { flex: 1; accent-color: var(--primary-color); }
      .plan-soc-val { min-width: 42px; text-align: right; font-size: .8rem; }
      input.plan-time-input { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; color-scheme: dark light; }
      .plan-actions { display: flex; gap: 8px; }
      .plan-btn { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--divider-color); font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .15s; background: transparent; color: var(--primary-text-color); }
      .plan-btn.save { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .plan-btn.save:hover { filter: brightness(1.1); }
      .plan-btn.delete { color: #ef4444; border-color: #ef444466; }
      .plan-btn.delete:hover { background: #ef444422; }
      select.plan-vehicle-select,
      select.plan-precondition-select { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; }
      .plan-row .toggle { margin-left: auto; }
      .plan-error { margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #ef444422; color: #ef4444; font-size: .78rem; word-break: break-all; }
      .plan-preview { margin: 10px 0 4px; }
      .plan-preview-loading { text-align: center; padding: 12px; font-size: .78rem; color: var(--secondary-text-color); }
      .plan-preview-error, .plan-preview-info { padding: 8px 10px; border-radius: 6px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); font-size: .78rem; }
      .plan-preview-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
      .plan-preview-left, .plan-preview-right { display: flex; flex-direction: column; }
      .plan-preview-right { text-align: right; }
      .plan-preview-label { font-size: .65rem; text-transform: uppercase; letter-spacing: .03em; color: var(--secondary-text-color); }
      .plan-preview-value { font-size: .88rem; font-weight: 600; color: var(--evcc-green,#22c55e); }
      .rplan-block .plan-header { justify-content: flex-start; gap: 6px; }
      .rplan-hint { display: inline-flex; align-items: center; color: var(--secondary-text-color); cursor: help; }
      .rplan-list { display: flex; flex-direction: column; gap: 8px; }
      .rplan-row { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 8px; }
      .rplan-days { display: flex; gap: 3px; flex-wrap: wrap; }
      .rplan-day { font-size: .68rem; font-weight: 600; line-height: 1; padding: 4px 5px; border-radius: 5px; min-width: 15px; text-align: center; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); border: 1px solid transparent; }
      .rplan-day.on { background: var(--primary-color); color: #fff; }
      .rplan-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .rplan-info { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
      .rplan-field { display: inline-flex; align-items: baseline; gap: 5px; }
      .rplan-label { font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
      .rplan-value { font-size: .9rem; font-weight: 600; }
      .rplan-line .toggle { margin-left: auto; }
`;
