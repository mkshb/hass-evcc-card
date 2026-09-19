import { displayUnit } from "./utils/state.js";
import { escHtml } from "./utils/html.js";

// Event delegation for the whole card. Methods are mixed into EvccCard.prototype.
export const listeners = {
  _attachListeners() {
    this.shadowRoot.querySelectorAll("[data-more-info]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId: el.dataset.moreInfo }, bubbles: true, composed: true,
        }));
      });
    });

    this.shadowRoot.querySelectorAll('[data-action="open-debug"]').forEach(btn => {
      btn.addEventListener("click", () => {
        this._origConfig = { ...this._config };
        this._config = { ...this._config, mode: "debug" };
        this._lastRenderKey = null;
        this._render();
      });
    });

    const copyBtn = this.shadowRoot.querySelector(".debug-copy-btn");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const toast = this.shadowRoot.querySelector(".debug-toast");
        const showToast = (msg, tone = "ok") => {
          if (!toast) return;
          toast.textContent = msg;
          toast.className = `debug-toast ${tone}`;
          toast.hidden = false;
          clearTimeout(this._debugToastTimer);
          this._debugToastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
        };
        let md;
        try {
          md = this._buildDebugReport(this._debugMask === true);
        } catch (e) {
          console.error("[evcc-card] _buildDebugReport crashed:", e);
          showToast("Report build failed: " + (e?.message || e), "err");
          return;
        }
        try {
          await navigator.clipboard.writeText(md);
          showToast(this._t("debugCopied"), "ok");
        } catch (e) {
          showToast(this._t("debugCopyFailed"), "err");
          const dbg = this.shadowRoot.querySelector(".debug");
          if (dbg && !dbg.querySelector(".debug-fallback-ta")) {
            const ta = document.createElement("textarea");
            ta.className = "debug-fallback-ta";
            ta.readOnly = true;
            ta.value = md;
            dbg.appendChild(ta);
            ta.focus();
            ta.select();
          }
        }
      });
    }

    const maskTog = this.shadowRoot.querySelector(".debug-mask-toggle");
    if (maskTog) {
      maskTog.addEventListener("change", () => {
        this._debugMask = maskTog.checked;
        this._lastRenderKey = null;
        this._render();
      });
    }

    this.shadowRoot.querySelectorAll("[data-lp-current-toggle]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const lpName   = btn.dataset.lpCurrentToggle;
        // Same fallback as the render: with `charge_current_settings: expanded`
        // the block starts open, so the first click must collapse it.
        const expanded = this._currentBlockExpanded[lpName]
          ?? (this._config.charge_current_settings === "expanded");
        this._currentBlockExpanded[lpName] = !expanded;

        const block = this.shadowRoot.querySelector(`[data-lp-current="${lpName}"]`);
        if (!block) return;
        const body = block.querySelector(".current-block-body");
        if (body) {
          if (!expanded) body.removeAttribute("hidden");
          else body.setAttribute("hidden", "");
        }
        btn.classList.toggle("active", !expanded);
      });
    });

    this.shadowRoot.querySelectorAll("[data-lp-smart-cost-open]").forEach(chip => {
      chip.addEventListener("click", (e) => {
        e.stopPropagation();
        const lpName = chip.dataset.lpSmartCostOpen;
        const block  = this.shadowRoot.querySelector(`[data-lp-current="${lpName}"]`);
        if (!block) return;
        const body = block.querySelector(".current-block-body");
        if (body) body.removeAttribute("hidden");
        this._currentBlockExpanded[lpName] = true;
        const toggleBtn = block.querySelector("[data-lp-current-toggle]");
        if (toggleBtn) toggleBtn.classList.add("active");
        const section = block.querySelector(`[data-lp-smart-cost-section="${lpName}"]`);
        if (section) {
          section.scrollIntoView({ behavior: "smooth", block: "nearest" });
          section.classList.add("smart-cost-highlight");
          setTimeout(() => section.classList.remove("smart-cost-highlight"), 1500);
        }
      });
    });

    this.shadowRoot.querySelectorAll("button.compact-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName   = btn.dataset.lp;
        const tabIdx   = parseInt(btn.dataset.tab);
        this._tabState[lpName] = tabIdx;

        const block = btn.closest("[data-lp-compact]");
        block.querySelectorAll("button.compact-tab").forEach((b, i) =>
          b.classList.toggle("active", i === tabIdx));
        block.querySelectorAll(".compact-panel").forEach((p, i) =>
          i === tabIdx ? p.removeAttribute("hidden") : p.setAttribute("hidden", ""));
      });
    });

    this.shadowRoot.querySelectorAll("button.stats-period-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        // Sessions path: data-scope/-metric/-group. Legacy entity path: data-period.
        if      (btn.dataset.scope)  this._statsScope  = btn.dataset.scope;
        else if (btn.dataset.metric) this._statsMetric = btn.dataset.metric;
        else if (btn.dataset.group)  this._statsGroup  = btn.dataset.group;
        else                         this._statsPeriod = btn.dataset.period;
        this._render();
      });
    });

    // Two independent steppers: month (wraps 0-11) and year (sessions stats path).
    this.shadowRoot.querySelectorAll("button[data-stats-step]").forEach(btn => {
      btn.addEventListener("click", () => {
        const dir = btn.dataset.statsStep === "next" ? 1 : -1;
        const now = new Date();
        if (btn.dataset.statsUnit === "year") {
          this._statsYearSel = (this._statsYearSel ?? now.getFullYear()) + dir;
        } else {
          const m = (this._statsMonthSel ?? now.getMonth()) + dir;
          this._statsMonthSel = (m + 12) % 12;
        }
        this._render();
      });
    });

    const chartWrap = this.shadowRoot.querySelector(".evcc-chart-wrap");
    if (chartWrap) {
      const tooltip = chartWrap.querySelector(".evcc-chart-tooltip");
      const dot = (color) => `<span class="ectt-dot" style="background:${color}"></span>`;
      const barKey = (bar) => bar.dataset.idx != null ? "i" + bar.dataset.idx : (bar.dataset.label || "") + (bar.dataset.total || "");
      const positionTooltip = (bar) => {
        const barRect  = bar.getBoundingClientRect();
        const wrapRect = chartWrap.getBoundingClientRect();
        const rawLeft  = barRect.left - wrapRect.left + barRect.width / 2;
        tooltip.hidden = false;
        const ttW  = tooltip.getBoundingClientRect().width;
        const left = Math.min(wrapRect.width - ttW / 2 - 4, Math.max(ttW / 2 + 4, rawLeft));
        tooltip.style.left = `${left}px`;
      };
      const showTooltip = (bar) => {
        // Sessions stacked chart: look the bucket up by index.
        if (bar.dataset.idx != null && this._statsChartData) {
          const { buckets, series, metric, currency } = this._statsChartData;
          const b = buckets[+bar.dataset.idx];
          if (!b || !(b.total > 0)) { tooltip.hidden = true; return; }
          const mf = this._metricFmt(metric, currency);
          const rows = series.filter(s => (b.seg[s.key] || 0) > 0)
            .map(s => `<div class="ectt-row">${dot(s.color)}<span class="ectt-name">${escHtml(s.label)}</span><span class="ectt-val">${mf.fmt(b.seg[s.key])} ${mf.unit}</span></div>`).join("");
          tooltip.innerHTML = `<div class="ectt-header">${escHtml(b.labelFull || b.labelStr)}</div>${rows}<div class="ectt-summary">${mf.fmt(b.total)} ${mf.unit} ${this._t("total")}</div>`;
          positionTooltip(bar);
          tooltip.dataset.activeBar = barKey(bar);
          return;
        }
        // Legacy entity chart (solar/grid).
        const total = bar.dataset.total;
        if (!total) { tooltip.hidden = true; return; }
        const solar = bar.dataset.solar ? parseFloat(bar.dataset.solar) : null;
        const grid  = solar != null ? (parseFloat(total) - solar).toFixed(1) : null;
        const solarColor = getComputedStyle(chartWrap).getPropertyValue("--evcc-green").trim() || "#22c55e";
        const gridColor  = getComputedStyle(chartWrap).getPropertyValue("--primary-color").trim() || "#3b82f6";
        tooltip.innerHTML =
          `<div class="ectt-header">${escHtml(bar.dataset.label)}</div>` +
          (solar != null ? `<div class="ectt-row">${dot(solarColor)}<span class="ectt-name">${this._t("solar")}</span><span class="ectt-val">${bar.dataset.solar} kWh</span></div>` : "") +
          (grid  != null ? `<div class="ectt-row">${dot(gridColor)}<span class="ectt-name">${this._t("grid")}</span><span class="ectt-val">${grid} kWh</span></div>` : "") +
          `<div class="ectt-summary">${total} kWh ${this._t("total")}</div>`;
        positionTooltip(bar);
        tooltip.dataset.activeBar = barKey(bar);
      };
      chartWrap.addEventListener("mouseover", (e) => {
        const bar = e.target.closest(".evcc-bar");
        if (bar) showTooltip(bar);
      });
      chartWrap.addEventListener("mouseout", (e) => {
        if (e.target.closest(".evcc-bar")) tooltip.hidden = true;
      });
      chartWrap.addEventListener("click", (e) => {
        const bar = e.target.closest(".evcc-bar");
        if (bar) {
          const key = barKey(bar);
          if (!tooltip.hidden && tooltip.dataset.activeBar === key) {
            tooltip.hidden = true;
          } else {
            showTooltip(bar);
          }
        } else {
          tooltip.hidden = true;
        }
      });
    }

    this.shadowRoot.querySelectorAll("button.batt-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        block.querySelectorAll("button.batt-tab").forEach((b, i) =>
          b.classList.toggle("active", i === tabIdx));
        block.querySelectorAll(".batt-tab-content").forEach((c, i) =>
          i === tabIdx ? c.removeAttribute("hidden") : c.setAttribute("hidden", ""));
      });
    });

    this.shadowRoot.querySelectorAll("button.batt-discharge-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._hass.callService(domain, on ? "turn_off" : "turn_on", { entity_id: btn.dataset.entity });
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    this.shadowRoot.querySelectorAll("button.boost-activate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const on = btn.dataset.on === "true";
        this._hass.callService("switch", on ? "turn_off" : "turn_on", { entity_id: btn.dataset.entity });
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    this.shadowRoot.querySelectorAll(".batt-inline-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._hass.callService("select", "select_option", {
          entity_id: sel.dataset.entity,
          option:    sel.value,
        });
      });
      sel.addEventListener("click", e => e.stopPropagation());
    });

    this.shadowRoot.querySelectorAll("button.mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._hass.callService("select", "select_option", {
          entity_id: btn.dataset.entity,
          option:    btn.dataset.value,
        });
      });
    });

    this.shadowRoot.querySelectorAll("button.toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._hass.callService(domain, on ? "turn_off" : "turn_on", {
          entity_id: btn.dataset.entity,
        });
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
        if (btn.dataset.lp) this._requestPlanPreview(btn.dataset.lp);
      });
    });

    this.shadowRoot.querySelectorAll("select.plan-precondition-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._hass.callService("select", "select_option", {
          entity_id: sel.dataset.entity,
          option:    sel.value,
        });
        if (sel.dataset.lp) this._requestPlanPreview(sel.dataset.lp);
      });
    });

    this.shadowRoot.querySelectorAll("button.phase-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._hass.callService("select", "select_option", {
          entity_id: btn.dataset.entity,
          option:    btn.dataset.value,
        });
        const group = btn.closest(".phase-btn-group");
        if (group) {
          group.querySelectorAll(".phase-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        }
      });
    });

    this.shadowRoot.querySelectorAll("input[data-boost-entity]").forEach(input => {
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
    this.shadowRoot.querySelectorAll("button.boost-val[data-boost-edit]").forEach(btn => {
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

    this.shadowRoot.querySelectorAll("input.plan-soc-range").forEach(input => {
      input.addEventListener("pointerdown", () => {
        this._isDragging    = true;
        this._pendingRender = false;
      });
      input.addEventListener("input", () => {
        const lpName = input.dataset.lp;
        const val    = parseInt(input.value, 10);
        if (this._planState[lpName]) this._planState[lpName].soc = val;
        const span = input.nextElementSibling;
        if (span) span.textContent = `${val} %`;
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
    this.shadowRoot.querySelectorAll("button.plan-soc-val[data-plan-soc-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.classList.contains("editing")) { this._closeSliderEdit(); return; }
        const input  = btn.previousElementSibling;
        const lpName = input?.dataset.lp;
        this._openSliderEdit(btn, {
          unit:  "%",
          value: parseInt(input?.value, 10),
          onApply: (val) => {
            if (this._planState[lpName]) this._planState[lpName].soc = val;
            this._requestPlanPreview(lpName);
          },
        });
      });
    });

    this.shadowRoot.querySelectorAll("input.plan-time-input").forEach(input => {
      input.addEventListener("change", () => {
        const lpName = input.dataset.lp;
        if (this._planState[lpName]) this._planState[lpName].time = input.value;
        this._requestPlanPreview(lpName);
      });
    });

    this.shadowRoot.querySelectorAll("select.plan-vehicle-select").forEach(sel => {
      sel.addEventListener("focus", () => {
        this._pendingRender = false;
      });
      sel.addEventListener("blur", () => {
        this._isDragging = false;
        if (this._pendingRender) { this._pendingRender = false; this._render(); }
      });
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
          this._hass.callService("select", "select_option", { entity_id: eid, option: val });
        }
        this._requestPlanPreview(lpName);
      });
    });

    this.shadowRoot.querySelectorAll("button.plan-btn.save").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName  = btn.dataset.lp;
        const state   = this._planState[lpName] || {};
        const soc     = state.soc || 80;
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

        const tryServices = async () => {
          let lastErr = null;
          if (vehicleDbId) {
            try {
              await this._hass.callService("evcc_intg", "set_vehicle_plan", { vehicle: vehicleDbId, soc, startdate });
              window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } }));
              showSuccess();
              return;
            } catch(e) { lastErr = e; }
          }
          try {
            await this._hass.callService("evcc_intg", "set_loadpoint_plan", { loadpoint: lpName, soc, startdate });
            window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } }));
            showSuccess();
            return;
          } catch(e) { lastErr = e; }
          showError(`❌ ${lastErr?.message || JSON.stringify(lastErr) || "Unknown error"}`);
        };
        tryServices();
      });
    });

    this.shadowRoot.querySelectorAll("button.plan-btn.delete").forEach(btn => {
      btn.addEventListener("click", () => {
        const lpName      = btn.dataset.lp;
        const planSt      = this._planState[lpName] || {};
        const vehicleDbId = (planSt.vehicle && planSt.vehicle !== "null") ? planSt.vehicle : null;
        const block       = btn.closest(".plan-block");
        const resetBadge  = () => {
          const badge = block?.querySelector(".plan-badge");
          if (badge) { badge.textContent = this._t("noPlan"); badge.classList.remove("active", "planned"); }
        };
        if (vehicleDbId) {
          this._hass.callService("evcc_intg", "del_vehicle_plan", { vehicle: vehicleDbId })
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        } else {
          this._hass.callService("evcc_intg", "set_loadpoint_plan", { loadpoint: lpName, soc: 0, startdate: "" })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        }
      });
    });

    this.shadowRoot.querySelectorAll("button.smart-cost-clear-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._hass.callService("button", "press", { entity_id: btn.dataset.entity });
      });
    });

    this.shadowRoot.querySelectorAll("input[type=range]:not(.plan-soc-range):not([data-boost-entity])").forEach(input => {
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
        if (domain === "select") {
          if (this._sliderOptions(entityId).length > 0) {
            this._hass.callService("select", "select_option", { entity_id: entityId, option: this._sliderValueFor(input) });
          }
        } else {
          this._hass.callService("number", "set_value", { entity_id: entityId, value: parseFloat(input.value) });
        }
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
      input.addEventListener("keyup", (e) => {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) return;
        const domain   = input.dataset.domain;
        const entityId = input.dataset.entity;
        this._sliderWrite(entityId, domain, domain === "select" ? this._sliderValueFor(input) : parseFloat(input.value));
      });
    });

    this.shadowRoot.querySelectorAll("button.slider-val[data-slider-edit]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        if (btn.classList.contains("editing")) this._closeSliderEdit();
        else this._openSliderEdit(btn);
      });
    });

    this._attachPriorityListeners();
  },
};
