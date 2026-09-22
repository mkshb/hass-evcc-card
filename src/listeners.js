// Non-native click targets: everything the card wires a click handler to that
// is not a <button>, <input>, <select> or <a> and so gets no keyboard support
// from the browser. They are made focusable and get the button role here,
// once per render, instead of every view remembering to do it.
const NON_NATIVE_CLICKABLES = "[data-more-info], [data-action], [data-lp-current-toggle], [data-lp-smart-cost-open]";
const NATIVE = "button, input, select, textarea, a[href]";

// The listeners every view shares: keyboard activation, more-info, the site
// table toggle and the jump into the debug view. Everything a single view owns
// is attached by that view's _attach<Name>Listeners(), called at the end. Methods
// are mixed into EvccCard.prototype.
export const listeners = {
  _attachListeners() {
    // Keyboard activation for the button-role elements: Enter and Space click
    // them, as a native button would. Bound to the shadow root once; the root
    // survives every innerHTML replacement, the elements inside do not.
    if (!this._keyboardBound) {
      this._keyboardBound = true;
      this.shadowRoot.addEventListener("keydown", (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const el = e.target?.closest?.('[role="button"]');
        if (!el || el.matches(NATIVE)) return;
        e.preventDefault();
        // dispatched rather than el.click(): SVG elements (the flow nodes) have no click()
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
      });
    }
    this.shadowRoot.querySelectorAll(NON_NATIVE_CLICKABLES).forEach(el => {
      if (el.matches(NATIVE)) return;
      if (!el.hasAttribute("role"))     el.setAttribute("role", "button");
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    });

    this.shadowRoot.querySelectorAll("[data-more-info]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("hass-more-info", {
          detail: { entityId: el.dataset.moreInfo }, bubbles: true, composed: true,
        }));
      });
    });

    // The site and flow views fold their detail table on a click on the flow
    // graphic. A click on a node inside it opens more-info instead: that handler
    // above stops propagation, and the check here keeps the two apart even when
    // the click lands on a node that has no more-info listener attached.
    this.shadowRoot.querySelectorAll('[data-action="toggle-site"]').forEach(el => {
      el.addEventListener("click", (e) => {
        if (e.target.closest("[data-more-info]")) return;
        this._toggleSite();
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

    // A focused select or date input holds every render back, see _inputBusy():
    // replacing the DOM would close an open dropdown or picker and wipe a
    // half-typed time. Registered before the views' own handlers, so a change
    // handler that renders finds the guard already lifted.
    this.shadowRoot.querySelectorAll("select, input[type=datetime-local]").forEach(el => {
      el.addEventListener("focus",  () => this._holdInput(el));
      el.addEventListener("change", () => this._releaseInput(el));
      el.addEventListener("blur",   () => this._releaseInput(el));
    });

    this._attachLoadpointListeners();
    this._attachSliderListeners();
    this._attachPlanListeners();
    this._attachStatsListeners();
    this._attachBatteryListeners();
    this._attachDebugListeners();
    this._attachPriorityListeners();
  },
};
