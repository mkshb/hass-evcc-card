import { FEATURES } from "./constants.js";
import { isOn } from "../utils/state.js";

// Detect the entity prefix AND the integration's config_entry_id from a single
// `config/entity_registry/list` call. The entry_id is required by the ha-evcc
// WebSocket data API commands (evcc_intg/forecast|sessions|plan_preview); every
// evcc_intg registry entry carries it in `config_entry_id`.
export async function detectIntegration(hass) {
  try {
    const entities = await hass.callWS({ type: "config/entity_registry/list" });
    const evccEnts = entities.filter(e => e.platform === "evcc_intg");
    if (evccEnts.length === 0) return { prefix: "evcc_", entryId: null };

    const entryId = evccEnts.find(e => e.config_entry_id)?.config_entry_id ?? null;

    const siteSuffixes = FEATURES.filter(f => !f.lp);
    for (const ent of evccEnts) {
      const dotIdx = ent.entity_id.indexOf(".");
      const domain = ent.entity_id.slice(0, dotIdx);
      const slug   = ent.entity_id.slice(dotIdx + 1);

      for (const feat of siteSuffixes) {
        if (feat.domain === domain && slug.endsWith(feat.suffix)) {
          const detected = slug.slice(0, slug.length - feat.suffix.length);
          if (detected.length > 0) return { prefix: detected, entryId };
        }
      }
    }
    return { prefix: "evcc_", entryId };
  } catch (e) {
    console.warn("[evcc-card] Could not detect integration from entity registry:", e);
    return { prefix: "evcc_", entryId: null };
  }
}

// Backwards-compatible thin wrapper: the editor only needs the prefix.
export async function detectPrefix(hass) {
  return (await detectIntegration(hass)).prefix;
}

export function discoverEntities(hass, prefix = "evcc_") {
  const sortedFeatures = [...FEATURES].sort((a, b) => b.suffix.length - a.suffix.length);
  const prefixLen = prefix.length;

  const loadpoints = {};
  const site = {};
  const meters = {};

  for (const entityId of Object.keys(hass.states)) {
    const dotIdx = entityId.indexOf(".");
    if (dotIdx < 0) continue;
    const domain = entityId.slice(0, dotIdx);
    const slug   = entityId.slice(dotIdx + 1);

    if (!slug.startsWith(prefix)) continue;

    const rest = slug.slice(prefixLen);

    let matched = null;
    for (const feat of sortedFeatures) {
      if (feat.domain !== domain) continue;
      if (rest === feat.suffix) {
        matched = { feat, lpName: "" };
        break;
      }
      if (rest.endsWith("_" + feat.suffix)) {
        const lpName = rest.slice(0, rest.length - feat.suffix.length - 1);
        matched = { feat, lpName };
        break;
      }
    }

    if (!matched) continue;

    const { feat, lpName } = matched;

    if (!lpName) {
      site[feat.suffix] = entityId;
    } else {
      if (!loadpoints[lpName]) loadpoints[lpName] = {};
      if (!loadpoints[lpName][feat.suffix]) {
        loadpoints[lpName][feat.suffix] = entityId;
      }
    }
  }

  // charge_power is mandatory for every real EVCC loadpoint. Anything else
  // (custom-named meters, batteries, PV/grid devices in ha-evcc 2026.5+) goes
  // to the meters bucket so it doesn't pollute the loadpoint list.
  // Exception: a loadpoint disabled in the evcc config (ha-evcc 2026.8.8+)
  // only exposes its `disabled_in_config` binary sensor - keep it as a
  // loadpoint so the card can hide/dim it instead of misfiling it as a meter.
  for (const name of Object.keys(loadpoints)) {
    if (!loadpoints[name].charge_power && !loadpoints[name].disabled_in_config) {
      meters[name] = loadpoints[name];
      delete loadpoints[name];
    }
  }

  return { loadpoints, site, meters };
}

// ha-evcc 2026.8.8+: true when the loadpoint is disabled in the evcc config.
// Older integration versions never create the sensor, so this stays false.
export function isLoadpointDisabled(hass, ents) {
  return !!ents.disabled_in_config && isOn(hass, ents.disabled_in_config);
}

// Split a loadpoints map into enabled/disabled buckets (config-disabled ones).
export function partitionDisabledLoadpoints(hass, loadpoints) {
  const enabled = {};
  const disabled = {};
  for (const [name, ents] of Object.entries(loadpoints)) {
    if (isLoadpointDisabled(hass, ents)) disabled[name] = ents;
    else enabled[name] = ents;
  }
  return { enabled, disabled };
}

export function _discoverDeviceSources(site, prefix, primarySuffix, secondarySuffix) {
  const sources = [];
  for (let i = 0; i < 32; i++) {
    const key = `${prefix}_${i}_${primarySuffix}`;
    if (!site[key]) break;
    const entry = { key, idx: i };
    if (secondarySuffix) {
      const secKey = `${prefix}_${i}_${secondarySuffix}`;
      if (secondarySuffix === "soc") entry.socKey = secKey;
      else if (secondarySuffix === "energy") entry.energyKey = secKey;
    }
    sources.push(entry);
  }
  return sources;
}
