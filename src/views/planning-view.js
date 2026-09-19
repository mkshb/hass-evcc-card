import { discoverEntities } from "../core/entity-discovery.js";
import { stateVal, isOn } from "../utils/state.js";
import { evccDate } from "../utils/format.js";

// Charge plan block with preview chart, plan mode and repeating plans. Methods are mixed into EvccCard.prototype.
export const planningView = {
  _renderPlanBlock(lpName, ents, force = false) {
    const hasVehicle = !!ents.vehicle_soc;
    const planActive = ents.plan_active ? isOn(this._hass, ents.plan_active) : false;
    const planTime   = ents.effective_plan_time
      ? stateVal(this._hass, ents.effective_plan_time) : null;
    const planSoc    = ents.effective_plan_soc
      ? stateVal(this._hass, ents.effective_plan_soc) : null;
    const projStart  = ents.plan_projected_start
      ? stateVal(this._hass, ents.plan_projected_start) : null;
    const projEnd    = ents.plan_projected_end
      ? stateVal(this._hass, ents.plan_projected_end) : null;

    if (!ents.effective_plan_soc || !this._hass.states[ents.effective_plan_soc]) return "";
    // Heating loadpoints (ha-evcc 'is_heating') are not EV charge points — their
    // "SOC" is a target temperature. The EV charge-plan UI/preview does not apply.
    if (this._isHeatingLoadpoint(ents)) return "";
    if (!force && !hasVehicle && !planActive) return "";

    const vehicleEntityId    = ents.vehicle_name || null;
    const vehicleAttrs       = vehicleEntityId ? (this._hass.states[vehicleEntityId]?.attributes ?? {}) : {};
    const allOptions         = (vehicleAttrs.options ?? []).filter(o => o !== "null");
    const vehicleAttr        = vehicleAttrs.vehicle ?? null;

    if (!this._planState[lpName]) {
      this._planState[lpName] = { soc: null, time: null, vehicle: null };
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
      if (id === currentVehicleId && vehicleAttr?.name && vehicleAttr.name !== "null") {
        dbIdToName[id] = vehicleAttr.name;
        return;
      }
      const path = `component.evcc_intg.entity.select.vehiclename.state.${String(id).toLowerCase()}`;
      const translated = this._hass.localize(path);
      dbIdToName[id] = translated || id;
    });

    if (currentVehicleId && currentVehicleId !== "null") {
      if (this._planState[lpName].vehicle && this._planState[lpName].vehicle !== currentVehicleId) {
        this._planState[lpName].soc  = null;
        this._planState[lpName].time = null;
      }
      this._planState[lpName].vehicle = currentVehicleId;
    }
    const defaultVehicle = this._planState[lpName].vehicle;

    const vehicleSelectHtml = allOptions.length > 0 ? `
      <div class="plan-row">
        <label>${this._t("vehicle")}</label>
        <select class="plan-vehicle-select" data-lp="${lpName}" data-entity="${vehicleEntityId ?? ""}">
          ${allOptions.map(id => `
            <option value="${id}" ${id === defaultVehicle ? "selected" : ""}>${dbIdToName[id]}</option>
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
                data-lp="${lpName}">
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
        <select class="plan-precondition-select" data-entity="${preEntityId}" data-lp="${lpName}">
          ${preOptions.map(opt => `
            <option value="${opt}" ${opt === preCurrent ? "selected" : ""}>${fmtPre(opt)}</option>
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
      <div class="plan-block" data-lp="${lpName}">
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
                   value="${defaultDt}" data-lp="${lpName}" />
          </div>
          <div class="plan-row">
            <label>${this._t("targetSoc")}</label>
            <div class="plan-soc-control">
              <input type="range" class="plan-soc-range"
                     min="20" max="100" step="5" value="${defaultSoc}"
                     data-lp="${lpName}" />
              <button type="button" class="slider-val plan-soc-val" data-plan-soc-edit
                      title="${this._t("sliderEditHint")}">${defaultSoc} %</button>
            </div>
          </div>
          ${contHtml}
          ${preHtml}
        </div>
        ${this._renderPlanPreview(lpName)}
        <div class="plan-actions">
          <button class="plan-btn save" data-lp="${lpName}">${this._t("setPlan")}</button>
          ${(planActive || (planTime && planTime !== "unknown" && planTime !== "unavailable"))
            ? `<button class="plan-btn delete" data-lp="${lpName}">${this._t("deletePlan")}</button>`
            : ""}
        </div>
      </div>
    `;
  },

  // Plan preview: shows charging slot chart + summary when SOC and time are set.
  _renderPlanPreview(lpName) {
    if (!this._hasCmd("plan_preview")) return "";
    const state = this._planState[lpName];
    if (!state || !state.soc || !state.time) return "";
    const lpIdx = this._lpIndex(lpName);
    if (lpIdx == null) return "";

    const d = new Date(state.time);
    if (isNaN(d.getTime())) return "";
    const ts = d.toISOString();
    // Cache-only read: serve the cached preview, prime one fetch if absent.
    // Never refetches on its own → an idle plan card makes zero backend calls.
    const res = this._wsPlanPreviewCached({ loadpoint: lpIdx, kind: "soc", value: state.soc, timestamp: ts });
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
    const unit = isCo2 ? "g CO₂/kWh" : (preview.currency ? `${preview.currency}/kWh` : "");

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
    const dur = preview.duration ?? 0;
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    const durStr = `${m}:${String(s).padStart(2, "0")} min`;
    const powerKw = ((preview.power ?? 0) / 1000).toFixed(1).replace(".", ",");

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
      : `${avgVal.toFixed(2)} ${currency}/kWh`;

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
            <span class="lp-name">${this._config.title || lpName}</span>
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
            <span class="lp-name">${name}</span>
          </div>
          ${this._renderRepeatPlansBlock(g)}
        </div>`;
    }).join("");
  },
};
