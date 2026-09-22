import { discoverEntities, selectLoadpoints, partitionDisabledLoadpoints } from "../core/entity-discovery.js";
import { stateVal, attr } from "../utils/state.js";
import { escHtml, escAttr } from "../utils/html.js";

// Priority mode with drag & drop ordering. Methods are mixed into EvccCard.prototype.
export const priorityView = {
  _renderPriorityMode(visible) {
    const lpKeys = Object.keys(visible);
    if (lpKeys.length === 0) return this._renderEmpty(visible);

    const items = lpKeys.map(lp => {
      const ents = visible[lp];
      const pid  = ents.priority;
      const raw  = pid ? parseFloat(stateVal(this._hass, pid)) : NaN;
      const cur  = isNaN(raw) ? 0 : raw;
      const max  = pid ? (attr(this._hass, pid, "max") ?? Infinity) : Infinity;
      const min  = pid ? (attr(this._hass, pid, "min") ?? 0) : 0;
      const title = this._loadpointTitle(lp, ents);
      return { lp, title, priorityEnt: pid, currentValue: cur, hasState: !isNaN(raw), max, min };
    });

    const signature = [...lpKeys].sort().join("|");
    if (!this._priorityDraft || this._priorityDraft.signature !== signature) {
      const sorted = items.slice().sort((a, b) =>
        b.currentValue - a.currentValue || a.title.localeCompare(b.title));
      this._priorityDraft = { signature, order: sorted.map(i => i.lp) };
    }

    const order = this._priorityDraft.order;
    const N = order.length;
    const byLp = Object.fromEntries(items.map(i => [i.lp, i]));

    const targetFor = (idx, it) => {
      if (!it.priorityEnt) return null;
      const raw = N - 1 - idx;
      return Math.min(it.max, Math.max(it.min, raw));
    };

    const lastApplied = this._priorityDraft.lastApplied || {};
    let dirty = false;
    const rowsHtml = order.map((lp, idx) => {
      const it = byLp[lp];
      const target = targetFor(idx, it);
      const noEnt = !it.priorityEnt;
      let changed = !noEnt && target !== it.currentValue;
      // Optimistic suppress: we just wrote `target` via Apply but HA state hasn't propagated yet
      if (changed && lastApplied[lp] === target) changed = false;
      if (changed) dirty = true;
      const targetDisplay = noEnt
        ? `<span class="priority-no-ent">${this._t("priorityNoEntity")}</span>`
        : `${target}${changed ? `<span class="priority-was">(${it.currentValue})</span>` : ""}`;
      return `
        <div class="priority-row${noEnt ? " no-entity" : ""}" data-lp="${escAttr(lp)}">
          <span class="priority-handle" aria-hidden="true">⋮⋮</span>
          <span class="priority-name">${escHtml(it.title)}</span>
          <span class="priority-target${changed ? " changed" : ""}">${targetDisplay}</span>
        </div>`;
    }).join("");

    const singleNote = N === 1
      ? `<div class="priority-empty-note">${this._t("prioritySingleNote")}</div>`
      : "";

    return `
      <div class="priority-mode" data-priority-root>
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("priority"))}</span>
        </div>
        <div class="priority-hint">${this._t("priorityHint")}</div>
        <div class="priority-list">${rowsHtml}</div>
        ${singleNote}
        <div class="priority-actions">
          <button class="priority-btn reset" ${dirty ? "" : "disabled"}
                  data-priority-reset>${this._t("priorityReset")}</button>
          <button class="priority-btn apply" ${dirty ? "" : "disabled"}
                  data-priority-apply>${this._t("priorityApply")}</button>
        </div>
      </div>`;
  },

  async _priorityApply(visible) {
    if (!this._priorityDraft) return;
    const order = this._priorityDraft.order;
    const N = order.length;
    const changes = [];
    const lastApplied = {};
    order.forEach((lp, idx) => {
      const pid = visible[lp]?.priority;
      if (!pid) return;
      const raw = parseFloat(stateVal(this._hass, pid));
      const max = attr(this._hass, pid, "max") ?? Infinity;
      const min = attr(this._hass, pid, "min") ?? 0;
      const target = Math.min(max, Math.max(min, N - 1 - idx));
      lastApplied[lp] = target;
      if (isNaN(raw) || raw !== target) changes.push({ pid, target });
    });
    if (!changes.length) return;
    this._priorityDraft.lastApplied = lastApplied;
    this._lastRenderKey = null;
    this._render();
    await Promise.all(changes.map(c => this._setNumberValue(c.pid, c.target)));
  },

  _attachPriorityListeners() {
    const root = this.shadowRoot.querySelector("[data-priority-root]");
    if (!root) return;

    const list = root.querySelector(".priority-list");

    this._fresh(".priority-row", root).forEach(row => {
      const handle = row.querySelector(".priority-handle");
      if (!handle || row.classList.contains("no-entity")) return;

      handle.addEventListener("pointerdown",        (e) => this._priorityDragStart(e, list, row, handle));
      handle.addEventListener("pointermove",        (e) => this._priorityDragMove(e));
      handle.addEventListener("pointerup",          (e) => this._priorityDragEnd(e));
      handle.addEventListener("pointercancel",      (e) => this._priorityDragEnd(e));
      // Fallback: if the handle loses capture for any other reason (e.g. the
      // element is detached), still leave the drag state cleanly.
      handle.addEventListener("lostpointercapture", (e) => this._priorityDragEnd(e));
    });

    const applyBtn = this._fresh("[data-priority-apply]", root)[0];
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        const visible = this._currentVisible();
        if (visible) this._priorityApply(visible);
      });
    }

    const resetBtn = this._fresh("[data-priority-reset]", root)[0];
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        this._priorityDraft = null;
        this._lastRenderKey = null;
        this._render();
      });
    }
  },

  // ---- Priority drag & drop ------------------------------------------------
  // Model: on pointerdown the slot geometry of the list is frozen once. The
  // dragged row is taken out of the flow (position: absolute via CSS) and a
  // placeholder of the same height is put in its slot, so the list keeps
  // exactly N slots with unchanged boundaries for the whole drag. The target
  // index is derived from the centre of the dragged row against those frozen
  // slots; nothing is measured live, so there is no feedback loop.
  _priorityDragStart(e, list, row, handle) {
    if (this._priorityDragging) return;
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();

    // Geometry snapshot before any DOM mutation. offsetTop/offsetHeight are
    // relative to .priority-list (position: relative), the same frame the
    // absolutely positioned row uses below.
    const rows  = [...list.querySelectorAll(".priority-row")];
    const slots = rows.map(r => ({ top: r.offsetTop, h: r.offsetHeight }));
    const idx   = rows.indexOf(row);
    const baseTop = row.offsetTop;
    const rowH    = row.offsetHeight;
    // Keep the row inside the list (overflow: hidden would clip it otherwise).
    const minDy = -baseTop;
    const maxDy = Math.max(minDy, list.clientHeight - rowH - baseTop);

    const placeholder = document.createElement("div");
    placeholder.className = "priority-placeholder";
    placeholder.style.height = rowH + "px";
    list.insertBefore(placeholder, row);

    row.classList.add("priority-dragging");
    row.style.top = baseTop + "px";

    this._isDragging    = true;
    this._pendingRender = false;
    this._priorityDragging = {
      list, row, placeholder, handle, pointerId: e.pointerId,
      startY: e.clientY, slots, idx, baseTop, rowH, minDy, maxDy,
    };
    try { handle.setPointerCapture(e.pointerId); } catch (_) {}
  },

  _priorityDragMove(e) {
    const d = this._priorityDragging;
    if (!d || e.pointerId !== d.pointerId) return;

    const dy = Math.min(d.maxDy, Math.max(d.minDy, e.clientY - d.startY));
    d.row.style.transform = `translateY(${dy}px)`;

    // Target slot: first frozen slot whose midpoint lies below the centre of
    // the dragged row. No early exit, so the placeholder tracks the pointer
    // directly instead of advancing one position per event.
    const center = d.baseTop + dy + d.rowH / 2;
    let idx = d.slots.findIndex(s => center < s.top + s.h / 2);
    if (idx === -1) idx = d.slots.length - 1;
    if (idx === d.idx) return;
    d.idx = idx;

    const others = [...d.list.querySelectorAll(".priority-row")].filter(r => r !== d.row);
    d.list.insertBefore(d.placeholder, others[idx] || null);
  },

  _priorityDragEnd(e) {
    const d = this._priorityDragging;
    if (!d || (e && e.pointerId !== d.pointerId)) return;
    this._priorityDragging = null;
    try { d.handle.releasePointerCapture(d.pointerId); } catch (_) {}

    if (d.placeholder.parentNode) d.placeholder.parentNode.insertBefore(d.row, d.placeholder);
    d.placeholder.remove();
    d.row.classList.remove("priority-dragging");
    d.row.style.transform = "";
    d.row.style.top       = "";

    if (this._priorityDraft) {
      this._priorityDraft.order =
        [...d.list.querySelectorAll(".priority-row")].map(r => r.dataset.lp);
    }

    this._isDragging    = false;
    this._pendingRender = false;
    this._lastRenderKey = null;
    this._render();
  },

  _currentVisible() {
    if (!this._hass) return null;
    const prefix = this._getPrefix();
    const { loadpoints } = discoverEntities(this._hass, prefix);
    const visible = selectLoadpoints(loadpoints, this._config);
    // Config-disabled loadpoints have no interactive entities - callers of
    // _currentVisible (plan/priority interactions) can never act on them.
    return partitionDisabledLoadpoints(this._hass, visible).enabled;
  },
};

// Priority mode.
// Part of the card stylesheet, see src/styles.js.
export const priorityCss = `
      .priority-mode { display: flex; flex-direction: column; gap: 12px; }
      .priority-hint { font-size: .8rem; color: var(--secondary-text-color); }
      .priority-list {
        position: relative;
        display: flex; flex-direction: column;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        overflow: hidden;
        background: var(--card-background-color);
      }
      .priority-row {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px;
        background: var(--card-background-color);
        user-select: none;
        border-bottom: 1px solid var(--divider-color);
        transition: background .15s ease;
      }
      .priority-row:last-child { border-bottom: none; }
      .priority-row.no-entity { opacity: .55; }
      .priority-handle {
        cursor: grab;
        font-size: 1.2rem; line-height: 1;
        color: var(--secondary-text-color);
        touch-action: none;
        padding: 4px 6px;
        user-select: none;
      }
      .priority-handle:active { cursor: grabbing; }
      .priority-row.no-entity .priority-handle { cursor: not-allowed; }
      .priority-row.priority-dragging {
        /* Out of the flow; left/right stretch it to the list width regardless
           of box-sizing, so no inline width is needed. */
        position: absolute; left: 0; right: 0; z-index: 5;
        opacity: .92;
        box-shadow: 0 4px 14px rgba(0, 0, 0, .22);
        background: var(--card-background-color);
        border-bottom: none;
        will-change: transform;
      }
      .priority-placeholder {
        background: var(--divider-color);
        opacity: .25;
      }
      .priority-name { flex: 1; font-weight: 500; }
      .priority-target {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        min-width: 2.5em;
        text-align: right;
      }
      .priority-target.changed { color: var(--evcc-amber); }
      .priority-was {
        font-weight: 400;
        color: var(--secondary-text-color);
        margin-left: 4px;
        font-size: .8em;
      }
      .priority-no-ent {
        font-weight: 400;
        font-size: .8em;
        color: var(--secondary-text-color);
      }
      .priority-empty-note {
        font-size: .8rem;
        color: var(--secondary-text-color);
        font-style: italic;
      }
      .priority-actions {
        display: flex; gap: 8px; justify-content: flex-end;
      }
      .priority-btn {
        padding: 6px 14px;
        border-radius: 4px;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        font: inherit;
      }
      .priority-btn:hover:not(:disabled) {
        background: var(--secondary-background-color);
      }
      .priority-btn:disabled { opacity: .5; cursor: not-allowed; }
      .priority-btn.apply:not(:disabled) {
        background: var(--evcc-green);
        color: white;
        border-color: transparent;
      }
`;
