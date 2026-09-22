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
import { locateEntity } from "./core/entity-discovery.js";
import { EvccCard } from "./evcc-card.js";
import { EvccCardEditor } from "./evcc-card-editor.js";

customElements.define("evcc-card-editor", EvccCardEditor);
customElements.define("evcc-card", EvccCard);

console.info(
  `%c evcc-card %c ${EVCC_CARD_VERSION} %c`,
  "background:#1d4ed8;color:#fff;padding:2px 4px;border-radius:3px 0 0 3px;font-weight:bold",
  "background:#22c55e;color:#fff;padding:2px 4px;border-radius:0 3px 3px 0;font-weight:bold",
  "background:transparent"
);

// The picker offers matching cards when an entity is added to a dashboard. A
// loadpoint entity gets the two loadpoint views, a site, meter or vehicle
// entity the two site views, anything else is not ours and returns null. The
// labels stay English: the translations are fetched at runtime and the picker
// asks synchronously.
function entitySuggestion(hass, entityId) {
  const hit = locateEntity(hass, entityId);
  if (!hit) return null;
  // Only a second installation needs its prefix written into the config, the
  // default one is what the card detects by itself.
  const base = hit.prefix === "evcc_" ? {} : { prefix: hit.prefix };
  const card = (mode, extra) => ({ type: "custom:evcc-card", mode, ...extra, ...base });
  return hit.loadpoint
    ? [
        { label: "Loadpoint", config: card("loadpoint", { loadpoints: [hit.loadpoint] }) },
        { label: "Compact",   config: card("compact",   { loadpoints: [hit.loadpoint] }) },
      ]
    : [
        { label: "Site", config: card("site") },
        { label: "Flow", config: card("flow") },
      ];
}

// What the Lovelace card picker shows. `preview: true` makes it render a live
// card from getStubConfig() instead of listing the name only; that render also
// happens on an instance without ha-evcc, where the card finds no entity and
// draws its empty state, which the `cardapi` test group holds to.
// `version` is not part of the documented shape. It stays because it costs
// nothing and makes the installed version visible to anything reading the entry.
window.customCards = window.customCards || [];
window.customCards.push({
  type:                "evcc-card",
  name:                "EVCC Card",
  description:         "Dashboard card for ha-evcc integration.",
  preview:             true,
  documentationURL:    "https://github.com/mkshb/hass-evcc-card",
  version:             EVCC_CARD_VERSION,
  getEntitySuggestion: entitySuggestion,
}); 
