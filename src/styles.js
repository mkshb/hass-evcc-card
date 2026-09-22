import { loadpointCss } from "./views/loadpoint-view.js";
import { sliderCss } from "./components/soc-control.js";
import { siteCss } from "./views/site-view.js";
import { flowCss } from "./views/flow-view.js";
import { gridCss } from "./views/grid-view.js";
import { statsCss } from "./views/statistics-view.js";
import { batteryCss } from "./views/battery-view.js";
import { planCss } from "./views/planning-view.js";
import { debugCss } from "./views/debug-view.js";
import { priorityCss } from "./views/priority-view.js";

// The card stylesheet. What every mode needs sits here; each view exports the
// CSS of its own markup, and the pieces are joined in this order into one
// constant string with nothing per instance in it, so every card on the page
// shares one parsed sheet.
const baseCss = `
      :host {
        display: block;
        --evcc-green:  var(--success-color,  #22c55e);
        --evcc-red:    var(--error-color,    #ef4444);
        --evcc-amber:  var(--warning-color,  #f59e0b);
        --evcc-blue:   #3b82f6;
        --evcc-orange: #f97316;
        --evcc-yellow: #eab308;
        --evcc-gray:   var(--disabled-color, #6b7280);
        --evcc-bolt:   #facc15;
      }
      .evcc-scale-wrap { container-type: inline-size; }
      @container (min-width: 450px) { .evcc-scale-wrap:not([data-size]) { zoom: 1.15; } }
      @container (min-width: 650px) { .evcc-scale-wrap:not([data-size]) { zoom: 1.3;  } }
      .evcc-scale-wrap[data-size="small"]  { zoom: 1.0;  }
      .evcc-scale-wrap[data-size="medium"] { zoom: 1.15; }
      .evcc-scale-wrap[data-size="large"]  { zoom: 1.30; }
      ha-card {
        color: var(--primary-text-color);
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
      }
      .card-content { padding: 12px 16px 16px; }

      .empty { text-align: center; padding: 24px; color: var(--secondary-text-color); font-size: .9rem; line-height: 1.8; }
      .empty code { background: var(--code-editor-background-color, #1e1e1e); color: var(--primary-color); padding: 1px 6px; border-radius: 4px; font-size: .82rem; }
      .empty-debug-hint { margin-top: 12px; font-size: .82rem; }
      button.debug-link {
        background: transparent; border: 1px solid var(--divider-color, #4b5563);
        color: var(--primary-color); border-radius: 6px;
        padding: 3px 10px; margin-left: 4px; cursor: pointer; font: inherit;
      }
      button.debug-link:hover { background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
`;

const CSS = [
  baseCss, loadpointCss, sliderCss, siteCss, flowCss, gridCss,
  statsCss, batteryCss, planCss, debugCss, priorityCss,
].join("\n");

// _render() replaces the shadow root's innerHTML on every update, and a <style>
// element in there is parsed again each time: around 680 lines of CSS, up to
// every 300 ms and once per card on the dashboard. A constructed CSSStyleSheet
// is parsed once per page and adopted by every shadow root, where it survives
// each innerHTML replacement. null where the browser cannot construct one.
let sharedSheet;
function sharedStyleSheet() {
  if (sharedSheet !== undefined) return sharedSheet;
  try {
    sharedSheet = new CSSStyleSheet();
    sharedSheet.replaceSync(CSS);
  } catch {
    sharedSheet = null;
  }
  return sharedSheet;
}

// Attached to EvccCard.prototype.
export const styles = {
  _styles() {
    return CSS;
  },

  // Adopts the shared sheet on this card's shadow root, once, and returns the
  // markup _render() has to inline: nothing when the sheet is adopted, the
  // <style> element as before when constructed sheets are not supported.
  _styleTag() {
    const root  = this.shadowRoot;
    const sheet = sharedStyleSheet();
    if (sheet && root && Array.isArray(root.adoptedStyleSheets)) {
      if (!root.adoptedStyleSheets.includes(sheet)) {
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
      }
      return "";
    }
    return `<style>${CSS}</style>`;
  },
};
