// Charts drawn in pixels. Methods are mixed into EvccCard.prototype.
//
// A chart is an SVG in the width it has on screen, so that its text keeps one
// size on a narrow and on a wide card, and its lanes keep their height. The
// width is measured per chart by a ResizeObserver; a new width renders the
// card again. Until the first measurement the card's own width less its
// padding stands in.

// The text of the axes, and the width of a character as a share of the font
// size, to size what is drawn around a text without measuring it.
export const AXIS_FONT = 11;
export const CHAR = 0.6;

const FALLBACK_W = 400, CARD_PADDING = 32;

export const chartPx = {
  // The width chart `key` is drawn in.
  _chartW(key) {
    return this._chartWidths?.[key] || (this.offsetWidth > 100 ? this.offsetWidth - CARD_PADDING : FALLBACK_W);
  },

  // The left margin for axis labels of up to `chars` characters.
  _chartMargin(chars) {
    return Math.ceil(Math.max(1, chars) * AXIS_FONT * CHAR) + 8;
  },

  // Measures `el` as chart `key`, in place of the element measured before; a
  // chart taken out of the page reports no width and is left alone. The card
  // renders in the next frame, not inside the callback: the new drawing
  // changes the chart's height, and a size that changes while the observer
  // delivers is a "ResizeObserver loop" error in WebKit. Charts measured in
  // the same frame share one render.
  _observeChart(el, key) {
    if (typeof ResizeObserver !== "function") return;
    this._chartObservers ??= {};
    const ro = this._chartObservers[key] ??= new ResizeObserver(entries => {
      const w = Math.round(entries[entries.length - 1].contentRect.width);
      this._chartWidths ??= {};
      if (w < 100 || w === this._chartWidths[key]) return;
      this._chartWidths[key] = w;
      if (this._chartFrame) return;
      this._chartFrame = requestAnimationFrame(() => {
        this._chartFrame = null;
        if (this.isConnected) this._render();
      });
    });
    ro.disconnect();
    ro.observe(el);
  },
};
