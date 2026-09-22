import { FEATURES, loadpointFilter } from "./constants.js";
import { isOn } from "../utils/state.js";

// Longest suffix first: `limit_soc` has to win over `soc` for the same entity.
const SORTED_FEATURES = [...FEATURES].sort((a, b) => b.suffix.length - a.suffix.length);

const SITE_FEATURES = FEATURES.filter(f => !f.lp);

// The prefix an entity id reveals when it is a site entity: everything in front
// of a known site suffix. A loadpoint entity yields null, its prefix cannot be
// told apart from the loadpoint name without more context.
function sitePrefixOf(entityId) {
  const dotIdx = entityId.indexOf(".");
  const domain = entityId.slice(0, dotIdx);
  const slug   = entityId.slice(dotIdx + 1);
  for (const feat of SITE_FEATURES) {
    if (feat.domain === domain && slug.endsWith(feat.suffix)) {
      const detected = slug.slice(0, slug.length - feat.suffix.length);
      if (detected.length > 0) return detected;
    }
  }
  return null;
}

// Detect the entity prefix AND the integration's config_entry_id from a single
// `config/entity_registry/list` call. The entry_id is required by the ha-evcc
// WebSocket data API commands (evcc_intg/forecast|sessions|plan_preview); every
// evcc_intg registry entry carries it in `config_entry_id`.
//
// Both values are taken from the SAME config entry. ha-evcc builds the entity
// prefix from the entry title (system_id = slugify(config_entry.title)), so a
// second evcc instance means a second prefix and a second entry id. Reading the
// prefix from one entry and the entry id from another would show the entities of
// one installation while asking the other one for forecast, sessions and plan
// previews. `preferredPrefix` is the card's configured prefix, which decides
// which instance is meant; without it the first entry in the registry wins.
export async function detectIntegration(hass, preferredPrefix = null) {
  try {
    const entities = await hass.callWS({ type: "config/entity_registry/list" });
    const evccEnts = entities.filter(e => e.platform === "evcc_intg");
    if (evccEnts.length === 0) return { prefix: "evcc_", entryId: null, instances: [] };

    // One group per config entry, in registry order; the prefix of a group comes
    // from its own first site entity.
    const byEntry = new Map();
    for (const ent of evccEnts) {
      const key = ent.config_entry_id ?? null;
      if (!byEntry.has(key)) byEntry.set(key, { entryId: key, prefix: null });
      const group = byEntry.get(key);
      if (!group.prefix) group.prefix = sitePrefixOf(ent.entity_id);
    }

    const instances = [...byEntry.values()].map(g => ({ prefix: g.prefix ?? "evcc_", entryId: g.entryId }));
    const chosen = (preferredPrefix && instances.find(i => i.prefix === preferredPrefix)) || instances[0];
    return { prefix: chosen.prefix, entryId: chosen.entryId, instances };
  } catch (e) {
    console.warn("[evcc-card] Could not detect integration from entity registry:", e);
    return { prefix: "evcc_", entryId: null, instances: [] };
  }
}

// Backwards-compatible thin wrapper: the editor only needs the prefix.
export async function detectPrefix(hass) {
  return (await detectIntegration(hass)).prefix;
}

// Resolve an entity id back to the ha-evcc feature key it was discovered under,
// i.e. its FEATURES suffix. Config that is keyed by feature (`slider_steps`)
// has to match against this instead of against the tail of the entity id: a
// short key like `soc` is the tail of `min_soc` and of `limit_soc` alike, and
// would silently steer both. Returns null for anything outside FEATURES.
export function featureKeyOf(entityId, prefix = "evcc_") {
  const dotIdx = entityId.indexOf(".");
  if (dotIdx < 0) return null;
  const domain = entityId.slice(0, dotIdx);
  const slug   = entityId.slice(dotIdx + 1);
  if (!slug.startsWith(prefix)) return null;
  const rest = slug.slice(prefix.length);

  for (const feat of SORTED_FEATURES) {
    if (feat.domain !== domain) continue;
    if (rest === feat.suffix || rest.endsWith("_" + feat.suffix)) return feat.suffix;
  }
  return null;
}

export function discoverEntities(hass, prefix = "evcc_") {
  const sortedFeatures = SORTED_FEATURES;
  const prefixLen = prefix.length;

  const loadpoints = {};
  const site = {};
  const meters = {};

  // A second installation whose prefix extends this one ("evcc_" next to
  // "evcc_demo_") shares the start of every entity id. Read under the shorter
  // prefix, its loadpoints would turn up here as "demo_carport" and its
  // vehicles as meters, so anything under a longer installed prefix is skipped.
  const foreign = installedPrefixes(hass).filter(p => p.length > prefixLen && p.startsWith(prefix));

  for (const entityId of Object.keys(hass.states)) {
    const dotIdx = entityId.indexOf(".");
    if (dotIdx < 0) continue;
    const domain = entityId.slice(0, dotIdx);
    const slug   = entityId.slice(dotIdx + 1);

    if (!slug.startsWith(prefix)) continue;
    if (foreign.some(p => slug.startsWith(p))) continue;

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

// The prefixes of every ha-evcc installation, without a round trip: HA mirrors
// the entity registry into `hass.entities` (platform per entity, disabled ones
// left out), and each installation's site entities reveal its prefix the same
// way detectIntegration() reads it from the registry itself. A candidate only
// counts when one of the core site sensors sits under it: a named meter like
// `sensor.evcc_garage_battery_soc` ends in a site suffix too and would
// otherwise pass off "evcc_garage_" as an installation of its own.
const CORE_SITE_FEATURES = SITE_FEATURES.filter(f => f.core);
export function installedPrefixes(hass) {
  const entities = hass?.entities || {};
  const found = new Set();
  for (const ent of Object.values(entities)) {
    if (ent?.platform !== "evcc_intg") continue;
    const prefix = sitePrefixOf(ent.entity_id);
    if (!prefix || found.has(prefix)) continue;
    if (CORE_SITE_FEATURES.some(f => entities[`${f.domain}.${prefix}${f.suffix}`]?.platform === "evcc_intg")) {
      found.add(prefix);
    }
  }
  return [...found];
}

// Which installation and loadpoint an entity belongs to. The card picker asks
// synchronously, so the registry-backed detection with its WebSocket call is
// out; `hass.entities` answers instead: it says whether the entity is ha-evcc's
// at all, and the installed prefixes narrow the cut between prefix and loadpoint
// name down to the ones that exist. Guessing the cut from the id alone would go
// wrong on every prefix with an underscore of its own ("my_evcc_" reads as
// prefix "my_" plus loadpoint "evcc_..."). The longest installed prefix the id
// starts with is tried first: with both "evcc_" and "evcc_home_" installed, an
// id under the longer one is far more likely to be its own than a loadpoint of
// the shorter one that happens to be called "home_...".
// Returns { prefix, loadpoint } with an empty loadpoint for a site entity, or
// null when the entity is not ha-evcc's or matches no known feature. What
// discoverEntities() files under meters (named PV, battery and grid meters,
// vehicle entities) is site data as well: no loadpoint, the site views fit.
export function locateEntity(hass, entityId) {
  if (hass?.entities?.[entityId]?.platform !== "evcc_intg") return null;
  if (!hass.states?.[entityId]) return null;
  const slug = entityId.slice(entityId.indexOf(".") + 1);

  const candidates = installedPrefixes(hass)
    .filter(prefix => slug.startsWith(prefix))
    .sort((a, b) => b.length - a.length);

  for (const prefix of candidates) {
    const { loadpoints, site, meters } = discoverEntities(hass, prefix);
    for (const [lp, ents] of Object.entries(loadpoints)) {
      if (Object.values(ents).includes(entityId)) return { prefix, loadpoint: lp };
    }
    if (Object.values(site).includes(entityId)) return { prefix, loadpoint: "" };
    for (const ents of Object.values(meters)) {
      if (Object.values(ents).includes(entityId)) return { prefix, loadpoint: "" };
    }
  }
  return null;
}

// ha-evcc 2026.8.8+: true when the loadpoint is disabled in the evcc config.
// Older integration versions never create the sensor, so this stays false.
export function isLoadpointDisabled(hass, ents) {
  return !!ents.disabled_in_config && isOn(hass, ents.disabled_in_config);
}

// The discovered loadpoints narrowed by the card's `loadpoints` option; without
// the option every discovered loadpoint is in.
export function selectLoadpoints(loadpoints, config) {
  const filter = loadpointFilter(config);
  if (!filter) return loadpoints;
  return Object.fromEntries(Object.entries(loadpoints).filter(([lp]) => filter.includes(lp)));
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
