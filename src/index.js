/**
 * evcc-card - Home Assistant Lovelace card for the ha-evcc integration.
 *
 * Entry point of the Rollup build (`npm run build` -> dist/evcc-card.js).
 * Layout of src/:
 *   evcc-card.js         class EvccCard: lifecycle, config, render dispatch
 *   evcc-card-editor.js  class EvccCardEditor: the visual editor
 *   core/                constants (FEATURES, version), entity discovery, ha-evcc WebSocket API
 *   views/               one file per card mode (loadpoint, site, flow, grid, stats, plan, ...)
 *   components/          controls shared by views (sliders with direct input)
 *   utils/               state access, formatting, HTML escaping, translations
 *   listeners.js         event delegation for the whole card
 *   styles.js            the card stylesheet
 * Views, components, listeners and styles are objects of methods mixed into
 * EvccCard.prototype (see the end of evcc-card.js). Locales stay separate files
 * next to the bundle (dist/locales/) and are fetched at runtime.
 */

import { EVCC_CARD_VERSION } from "./core/constants.js";
import { EvccCard } from "./evcc-card.js";
import { EvccCardEditor } from "./evcc-card-editor.js";

customElements.define("evcc-card-editor", EvccCardEditor);
customElements.define("evcc-card", EvccCard);
window.__evccCards = window.__evccCards || new Map();

console.info(
  `%c evcc-card %c ${EVCC_CARD_VERSION} %c`,
  "background:#1d4ed8;color:#fff;padding:2px 4px;border-radius:3px 0 0 3px;font-weight:bold",
  "background:#22c55e;color:#fff;padding:2px 4px;border-radius:0 3px 3px 0;font-weight:bold",
  "background:transparent"
);

window.customCards = window.customCards || [];
window.customCards.push({
  type:        "evcc-card",
  name:        "EVCC Card",
  description: "Dashboard card for ha-evcc integration.",
  preview:     false,
  version:     EVCC_CARD_VERSION,
}); 
