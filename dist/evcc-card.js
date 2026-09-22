/* hass-evcc-card. Built from src/ with Rollup; edit the sources, not this file. */
const EVCC_CARD_VERSION = "0.8.3";

const FEATURES = [
  { suffix: "mode",                domain: "select",        type: "mode",          lp: true,  core: true },
  { suffix: "min_current",         domain: "select",        type: "select_slider", lp: true,  core: true },
  { suffix: "max_current",         domain: "select",        type: "select_slider", lp: true,  core: true },
  { suffix: "min_soc",             domain: "select",        type: "select_slider", lp: true  },
  { suffix: "limit_soc",           domain: "number",        type: "slider",        lp: true,  core: true },
  { suffix: "limit_soc",           domain: "select",        type: "select_slider", lp: true,  core: true },
  { suffix: "limit_energy",        domain: "number",        type: "slider",        lp: true  },
  { suffix: "smart_cost_limit",    domain: "number",        type: "slider",        lp: true  },
  { suffix: "smart_feed_in_priority_limit", domain: "number", type: "slider",      lp: true  },
  { suffix: "priority",            domain: "number",        type: "slider",        lp: true  },
  { suffix: "phases_configured",   domain: "select",        type: "select",        lp: true  },
  { suffix: "vehicle_name",        domain: "select",        type: "select",        lp: true  },
  { suffix: "battery_boost_limit", domain: "select",        type: "select_slider", lp: true  },
  { suffix: "battery_boost",       domain: "switch",        type: "toggle",        lp: true  },
  { suffix: "plan_strategy_continuous",   domain: "switch", type: "toggle",        lp: true  },
  { suffix: "plan_strategy_precondition", domain: "select", type: "select",        lp: true  },
  // ha-evcc 2026.8.3+ (evcc PR 32490, still a draft): companion selector of the
  // new 'smart' mode, replaces the retired 'minpv' mode. Only exists when evcc
  // reports 'alwaysCharge' for the loadpoint, and never for switch devices.
  { suffix: "always_charge",       domain: "select",        type: "select",        lp: true  },
  { suffix: "phase_action",        domain: "sensor",        type: "info",          lp: true  },
  { suffix: "phase_remaining",     domain: "sensor",        type: "info",          lp: true  },
  { suffix: "pv_action",           domain: "sensor",        type: "info",          lp: true  },
  { suffix: "pv_remaining",        domain: "sensor",        type: "info",          lp: true  },

  { suffix: "charge_power",        domain: "sensor",        type: "power",         lp: true,  core: true },
  { suffix: "charge_current",      domain: "sensor",        type: "current",       lp: true,  core: true },
  { suffix: "charge_currents_0",   domain: "sensor",        type: "current",       lp: true  },
  { suffix: "charge_currents_1",   domain: "sensor",        type: "current",       lp: true  },
  { suffix: "charge_currents_2",   domain: "sensor",        type: "current",       lp: true  },
  { suffix: "charge_duration",     domain: "sensor",        type: "info",          lp: true  },
  { suffix: "charge_remaining_duration", domain: "sensor",  type: "info",          lp: true  },
  { suffix: "charged_energy",      domain: "sensor",        type: "energy",        lp: true  },
  { suffix: "effective_limit_soc", domain: "sensor",        type: "info",          lp: true  },
  { suffix: "vehicle_soc",         domain: "sensor",        type: "soc",           lp: true  },
  { suffix: "vehicle_range",       domain: "sensor",        type: "range",         lp: true  },
  { suffix: "vehicle_odometer",    domain: "sensor",        type: "info",          lp: true  },
  { suffix: "session_energy",          domain: "sensor", type: "info", lp: true },
  { suffix: "session_price",           domain: "sensor", type: "info", lp: true },
  { suffix: "session_price_per_kwh",   domain: "sensor", type: "info", lp: true },
  { suffix: "session_co2_per_kwh",     domain: "sensor", type: "info", lp: true },
  { suffix: "session_solar_percentage",domain: "sensor", type: "info", lp: true },
  { suffix: "phases_active",       domain: "sensor",        type: "info",          lp: true  },

  { suffix: "effective_plan_soc",      domain: "sensor", type: "info", lp: true },
  { suffix: "effective_plan_time",     domain: "sensor", type: "info", lp: true },
  { suffix: "plan_projected_start",    domain: "sensor", type: "info", lp: true },
  { suffix: "plan_projected_end",      domain: "sensor", type: "info", lp: true },
  { suffix: "vehicle_plans_soc",       domain: "sensor", type: "info", lp: true },
  { suffix: "vehicle_plans_time",      domain: "sensor", type: "info", lp: true },

  { suffix: "repeating_plan_2",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_3",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_4",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_5",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_6",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_7",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_8",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_9",  domain: "switch", type: "toggle", lp: true },
  { suffix: "repeating_plan_10", domain: "switch", type: "toggle", lp: true },

  { suffix: "charging",            domain: "binary_sensor", type: "status_bool",   lp: true,  core: true },
  { suffix: "connected",           domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "enabled",             domain: "binary_sensor", type: "status_bool", lp: true,  core: true },
  // ha-evcc 2026.8.8+: reports whether the loadpoint is disabled in the evcc
  // configuration. A disabled loadpoint keeps ONLY this entity - everything
  // else (charging, mode, ...) is not created by the integration at all.
  { suffix: "disabled_in_config",  domain: "binary_sensor", type: "status_bool", lp: true  },
  { suffix: "smart_cost_active",   domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "smart_feed_in_priority_active", domain: "binary_sensor", type: "status_bool", lp: true  },
  { suffix: "plan_active",         domain: "binary_sensor", type: "status_bool",   lp: true  },
  { suffix: "vehicle_detection_active", domain: "binary_sensor", type: "status_bool", lp: true },
  { suffix: "vehicle_climater_active",  domain: "binary_sensor", type: "status_bool", lp: true },
  { suffix: "vehicle_welcome_active",   domain: "binary_sensor", type: "status_bool", lp: true },

  { suffix: "grid_power",          domain: "sensor",        type: "power",         lp: false, core: true },
  { suffix: "pv_power",            domain: "sensor",        type: "power",         lp: false, core: true },
  { suffix: "pv_0_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_1_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_2_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "pv_3_power",          domain: "sensor",        type: "power",         lp: false },
  { suffix: "home_power",          domain: "sensor",        type: "power",         lp: false, core: true },
  { suffix: "battery_power",        domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_0_power",     domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_1_power",     domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_2_power",     domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_3_power",     domain: "sensor",        type: "power",         lp: false },
  { suffix: "battery_soc",         domain: "sensor",        type: "soc",           lp: false },
  { suffix: "battery_0_soc",       domain: "sensor",        type: "soc",           lp: false },
  { suffix: "battery_1_soc",       domain: "sensor",        type: "soc",           lp: false },
  { suffix: "battery_2_soc",       domain: "sensor",        type: "soc",           lp: false },
  { suffix: "battery_3_soc",       domain: "sensor",        type: "soc",           lp: false },
  { suffix: "battery_capacity",    domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_energy",           domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_0_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_1_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_2_energy",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "pv_3_energy",         domain: "sensor",        type: "info",          lp: false },
  // Site lifetime energy counters. grid_* and battery_* exist since
  // ha-evcc 2026.9.x and are disabled by default in the HA entity registry,
  // so they only show up once the user enables the sensors.
  { suffix: "grid_energy",           domain: "sensor",      type: "info",          lp: false },
  { suffix: "grid_return_energy",    domain: "sensor",      type: "info",          lp: false },
  { suffix: "battery_energy",        domain: "sensor",      type: "info",          lp: false },
  { suffix: "battery_return_energy", domain: "sensor",      type: "info",          lp: false },
  { suffix: "tariff_grid",         domain: "sensor",        type: "info",          lp: false },
  { suffix: "tariff_feed_in",      domain: "sensor",        type: "info",          lp: false },
  { suffix: "tariff_co2",          domain: "sensor",        type: "info",          lp: false },

  { suffix: "battery_mode",        domain: "select",        type: "select",        lp: false },
  { suffix: "priority_soc",        domain: "select",        type: "select_slider", lp: false },
  { suffix: "buffer_soc",          domain: "select",        type: "select_slider", lp: false },
  { suffix: "buffer_start_soc",    domain: "select",        type: "select_slider", lp: false },
  { suffix: "residual_power",      domain: "number",        type: "slider",        lp: false },
  { suffix: "battery_discharge_control", domain: "switch",  type: "toggle",        lp: false },
  { suffix: "battery_grid_charge_active", domain: "binary_sensor", type: "status_bool", lp: false },
  { suffix: "battery_grid_charge_limit",  domain: "number",        type: "slider",      lp: false },
];

// Icon for the "smart" mode. Used twice: for the native 'smart' mode of evcc
// PR 32490, and for the "pv relabelled as Smart" pseudo-mode that older evcc
// versions need when PV is hidden but a dynamic tariff exists (Mode.vue).
const SMART_MODE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V19A1,1 0 0,1 14,20H10A1,1 0 0,1 9,19V17.2C7.21,16.16 6,14.22 6,12A6,6 0 0,1 12,6M14,21V22A1,1 0 0,1 13,23H11A1,1 0 0,1 10,22V21H14M20,11H23V13H20V11M1,11H4V13H1V11M13,1V4H11V1H13M4.92,3.5L7.05,5.64L5.63,7.05L3.5,4.93L4.92,3.5M16.95,5.63L19.07,3.5L20.5,4.93L18.37,7.05L16.95,5.63Z"/></svg>`;

// `stats_period` exists in two vocabularies. The current one, which the editor
// writes and the README documents: month | year | total | none. And the legacy
// one from before the sessions stats path, still valid in existing YAML:
// 30d | 365d | thisYear | total.
//
// Everything is normalised to the current vocabulary here, in one place, so the
// two stats paths cannot drift apart again. The fallback is the caller's,
// because the defaults differ: the stats mode opens on the most recent month,
// the compact footer under site/grid/flow summarises everything.
const STATS_PERIOD_ALIASES = {
  month: "month", "30d": "month",
  year:  "year",  "365d": "year", thisYear: "year",
  total: "total",
  none:  "none",
};

function normalizeStatsPeriod(value, fallback = "total") {
  return STATS_PERIOD_ALIASES[value] ?? fallback;
}

// How a normalised period falls back onto the legacy entity/recorder path,
// which has periods of its own. A configured legacy value is passed through
// untouched instead (365d is "the last 365 days", not the calendar year), so
// existing dashboards keep exactly the view they had.
const STATS_PERIOD_LEGACY_VALUES = ["30d", "365d", "thisYear", "total"];
const STATS_PERIOD_TO_LEGACY = { month: "30d", year: "thisYear", total: "total", none: "total" };

// The legacy period a configured value ends up on. Used by the stats mode and
// by the compact footer, so both reach the same stat_* entities.
function legacyStatsPeriod(value, fallback = "total") {
  return STATS_PERIOD_LEGACY_VALUES.includes(value)
    ? value
    : STATS_PERIOD_TO_LEGACY[normalizeStatsPeriod(value, fallback)];
}

// Fallback height per mode in Home Assistant's units (one unit is 50 px), used
// only before the card has rendered once; a rendered card measures itself. The
// numbers are the bare card: the detail table and the statistics footer are
// added below, because a configuration can switch both off and that moves a
// site card by a factor of five.
const CARD_SIZES = {
  loadpoint:  16,
  compact:     6,
  plan:       10,
  repeatplan:  5,
  priority:    5,
  site:        3,
  flow:        6,
  grid:        7,
  site2:       7,   // legacy alias of grid
  stats:      10,
  battery:     7,
  debug:      20,
};

// The expandable detail table under the flow bar (`site_details`), and the
// statistics footer (`stats_period: none` removes it). Both measured at 420 px.
const CARD_SIZE_DETAILS = { site: 8, flow: 6 };
const CARD_SIZE_FOOTER  = { site: 1, flow: 1, grid: 1, site2: 1 };

// Every mode the card renders, and the values the other enumerated options take.
// setConfig() rejects anything outside these lists. The modes are spelled out
// rather than read off CARD_SIZES: a mode is a view and a _render branch, the
// height table is an estimate that may or may not know it. `site2` is the
// former name of `grid` and stays valid so dashboards carrying it keep working.
const CARD_MODES = [
  "loadpoint", "compact", "plan", "repeatplan", "priority",
  "site", "flow", "grid", "site2", "stats", "battery", "debug",
];
const CARD_SIZE_OPTIONS        = ["small", "medium", "large"];
const DISABLED_LOADPOINT_MODES = ["hide", "dim", "show"];
const STATS_PERIOD_OPTIONS     = Object.keys(STATS_PERIOD_ALIASES);

// The `loadpoints` option as a list, or null when it is not set. A single name
// is shorthand for a list of one. Every reader of the option goes through here,
// so the shorthand and "not set" mean the same thing everywhere; a value that
// is set but empty never gets past validateCardConfig().
function loadpointFilter(config) {
  const raw = config?.loadpoints;
  if (raw === undefined || raw === null) return null;
  return Array.isArray(raw) ? raw : [raw];
}

// Home Assistant expects setConfig() to throw on a configuration the card cannot
// render: it catches the error and shows its own error card with the message, so
// a typo in the YAML is visible instead of quietly rendering something else. The
// messages are English because that is where they end up, in the HA error card.
function validateCardConfig(config) {
  const c = config || {};
  const oneOf = (key, valid) => {
    if (c[key] === undefined || c[key] === null) return;
    if (!valid.includes(c[key])) {
      throw new Error(`evcc-card: ${key} "${c[key]}" is not valid. Use one of: ${valid.join(", ")}`);
    }
  };
  oneOf("mode",                CARD_MODES);
  oneOf("size",                CARD_SIZE_OPTIONS);
  oneOf("disabled_loadpoints", DISABLED_LOADPOINT_MODES);
  oneOf("stats_period",        STATS_PERIOD_OPTIONS);

  for (const key of ["prefix", "language"]) {
    const v = c[key];
    if (v === undefined || v === null) continue;
    if (typeof v !== "string" || !v.trim()) {
      throw new Error(`evcc-card: ${key} has to be a non-empty string`);
    }
  }

  const list = loadpointFilter(c);
  if (list && (!list.length || list.some(lp => typeof lp !== "string" || !lp.trim()))) {
    throw new Error("evcc-card: loadpoints has to be a loadpoint name or a list of names");
  }
}

// Entity attributes the card reads while rendering. The render key is built from
// these next to the state, because HA hands out a new state object for a pure
// attribute change too: a select whose options change, a number whose min/max
// moves, a vehicle whose metadata arrives. Without them the card would keep
// showing the previous options or slider bounds.
//
// This list is not documentation, it is load bearing: an attribute missing here
// is an attribute whose change the card ignores. The test group `renderkey`
// proxies the attribute objects during a render of every mode and fails when
// something outside this list is read.
const RENDER_ATTRS = [
  "options", "min", "max", "step", "unit_of_measurement", "device_class",
  "title", "loadpoint_title", "vehicle", "soc", "time", "weekdays",
];

// Settings the user can drop from the loadpoint/compact card via
// `hide_settings: [...]`. Keys are the ha-evcc feature suffixes (plus the two
// non-slider controls); the label keys are shared with the card itself.
const HIDEABLE_SETTINGS = [
  ["limit_soc",                    "targetSoc"],
  ["min_soc",                      "minSoc"],
  ["phases",                       "phases"],
  ["max_current",                  "maxCurrent"],
  ["min_current",                  "minCurrent"],
  ["battery_boost",                "batteryBoost"],
  ["priority",                     "priority"],
  ["smart_cost_limit",             "smartCostLimitPrice"],
  ["smart_feed_in_priority_limit", "feedInPriorityLimit"],
];

const CHARGE_MODES = {
  "off":   { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13,3H11V13H13V3M17.83,5.17L16.41,6.59C17.99,7.86 19,9.81 19,12A7,7 0 0,1 12,19A7,7 0 0,1 5,12C5,9.81 6.01,7.86 7.58,6.58L6.17,5.17C4.23,6.82 3,9.26 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12C21,9.26 19.77,6.82 17.83,5.17Z"/></svg>`,  tKey: "modeOff"  },
  // 'smart' replaces 'pv'/'minpv' with evcc PR 32490 (ha-evcc 2026.8.3+).
  // Rendered only when the mode entity actually offers it, so old and new
  // setups both keep exactly their own set of buttons.
  "smart": { icon: SMART_MODE_ICON, tKey: "modeSmart" },
  "pv":    { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`,  tKey: "modePV"   },
  "minpv": { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="position:relative;top:4px;left:-6px;opacity:0.8"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`, tKey: "modeMinPV"},
  "now":   { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>`,  tKey: "modeNow"  },
};

function stateVal(hass, entityId) {
  return hass.states[entityId]?.state ?? null;
}

function attr(hass, entityId, key) {
  return hass.states[entityId]?.attributes?.[key] ?? null;
}

function unitStr(hass, entityId) {
  return attr(hass, entityId, "unit_of_measurement") ?? "";
}

function displayUnit(hass, entityId) {
  const rawUnit = unitStr(hass, entityId);
  return rawUnit || (entityId.includes("soc") ? "%" : "");
}

function isOn(hass, entityId) {
  const s = stateVal(hass, entityId);
  return s === "on" || s === "true";
}

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
async function detectIntegration(hass, preferredPrefix = null) {
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
async function detectPrefix(hass) {
  return (await detectIntegration(hass)).prefix;
}

// Resolve an entity id back to the ha-evcc feature key it was discovered under,
// i.e. its FEATURES suffix. Config that is keyed by feature (`slider_steps`)
// has to match against this instead of against the tail of the entity id: a
// short key like `soc` is the tail of `min_soc` and of `limit_soc` alike, and
// would silently steer both. Returns null for anything outside FEATURES.
function featureKeyOf(entityId, prefix = "evcc_") {
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

function discoverEntities(hass, prefix = "evcc_") {
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
function installedPrefixes(hass) {
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
function locateEntity(hass, entityId) {
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
function isLoadpointDisabled(hass, ents) {
  return !!ents.disabled_in_config && isOn(hass, ents.disabled_in_config);
}

// The discovered loadpoints narrowed by the card's `loadpoints` option; without
// the option every discovered loadpoint is in.
function selectLoadpoints(loadpoints, config) {
  const filter = loadpointFilter(config);
  if (!filter) return loadpoints;
  return Object.fromEntries(Object.entries(loadpoints).filter(([lp]) => filter.includes(lp)));
}

// Split a loadpoints map into enabled/disabled buckets (config-disabled ones).
function partitionDisabledLoadpoints(hass, loadpoints) {
  const enabled = {};
  const disabled = {};
  for (const [name, ents] of Object.entries(loadpoints)) {
    if (isLoadpointDisabled(hass, ents)) disabled[name] = ents;
    else enabled[name] = ents;
  }
  return { enabled, disabled };
}

function _discoverDeviceSources(site, prefix, primarySuffix, secondarySuffix) {
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

// The card builds its DOM from template literals, so anything that is free text
// in an evcc or HA configuration has to pass through these before it reaches
// innerHTML: loadpoint, vehicle and device titles, units, the currency, the
// card title and the option lists of the ha-evcc select entities. Entity ids
// are not escaped: HA validates them down to [a-z0-9_] plus one dot.

function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function escAttr(str) {
  return escHtml(str);
}

// Decimal places implied by a slider step (0.005 → 3, 1 → 0).
function stepDecimals(step) {
  const s = String(step);
  if (s.includes("e-")) return parseInt(s.split("e-")[1], 10) || 0;
  return (s.split(".")[1] || "").length;
}

// Round to `decimals` places and drop trailing zeros ("0.250" → "0.25").
function fmtNum(v, decimals) {
  const n = Number(v);
  if (isNaN(n)) return "";
  return String(Number(n.toFixed(decimals)));
}

// Parse an evcc-sourced timestamp that may be an RFC3339 string OR a unix
// timestamp (seconds or ms). Mirrors ha-evcc 2026.7.0 dual-format handling
// (marq24/ha-evcc, commit b2f0957). Returns a Date, or null if unparseable.
// Used only for RAW evcc values (WS forecast/plan rates, session created/
// finished); HA-recorder buckets and device_class:timestamp sensor states are
// always ISO and keep using new Date() directly.
function evccDate(v) {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // unix seconds vs milliseconds
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (/^\d+$/.test(t)) return evccDate(Number(t)); // numeric string
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtRemainingDuration(hass, entityId) {
  if (!entityId || !hass) return "";
  const raw = parseFloat(stateVal(hass, entityId));
  if (isNaN(raw) || raw <= 0) return "";
  const unit = (unitStr(hass, entityId) || "").toLowerCase();
  const seconds = unit.startsWith("min") ? raw * 60
                : unit.startsWith("h")   ? raw * 3600
                                         : raw;
  const totalMin = Math.round(seconds / 60);
  if (totalMin <= 0) return "";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

function fmtCountdownFromISO(iso) {
  if (!iso || iso === "unknown" || iso === "unavailable") return "";
  const target = Date.parse(iso);
  if (isNaN(target)) return "";
  const sec = Math.max(0, Math.round((target - Date.now()) / 1000));
  if (sec <= 0) return "";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function fmtCountdownFromTimestamp(hass, entityId) {
  if (!entityId || !hass) return "";
  return fmtCountdownFromISO(stateVal(hass, entityId));
}

function socFillGradient(soc, minSoc, limitSoc) {
  const s   = Math.max(0.01, soc);
  const min = Math.max(0, minSoc  || 0);
  const lim = Math.min(100, limitSoc || 100);
  const amber = "var(--evcc-amber)", blue = "var(--evcc-blue)", green = "var(--evcc-green)";
  if (min <= 0 && lim >= 100) return blue;
  const stops = [];
  if (min > 0) {
    const minRel = Math.min((min / s) * 100, 100).toFixed(1);
    stops.push(`${amber} 0%`, `${amber} ${minRel}%`);
    if (s > min) stops.push(`${blue} ${minRel}%`);
  } else {
    stops.push(`${blue} 0%`);
  }
  if (lim < 100 && s > lim) {
    const limRel = Math.min((lim / s) * 100, 100).toFixed(1);
    stops.push(`${blue} ${limRel}%`, `${green} ${limRel}%`, `${green} 100%`);
  } else {
    stops.push(`${blue} 100%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

function socTrackBg(minSoc, limitSoc) {
  const min = Math.max(0, minSoc  || 0);
  const lim = Math.min(100, limitSoc || 100);
  const base = "var(--divider-color, #e5e7eb)";
  if (min <= 0 && lim >= 100) return base;
  const stops = [];
  if (min > 0) stops.push(`rgba(245,158,11,.13) 0%`, `rgba(245,158,11,.13) ${min}%`, `${base} ${min}%`);
  else         stops.push(`${base} 0%`);
  if (lim < 100) stops.push(`${base} ${lim}%`, `rgba(34,197,94,.13) ${lim}%`, `rgba(34,197,94,.13) 100%`);
  else           stops.push(`${base} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/* ── Shared translation cache (used by both EvccCard and EvccCardEditor) ── */
let _sharedTranslations = {};
let _sharedTranslationsReady = false;
let _sharedTranslationsLoading = null;   // Promise while loading, null otherwise

async function loadSharedTranslations() {
  if (_sharedTranslationsReady) return;
  if (_sharedTranslationsLoading) return _sharedTranslationsLoading;

  _sharedTranslationsLoading = (async () => {
    const base = new URL("locales/", import.meta.url).href;
    let langs = ["de", "en"];
    try {
      const idxResp = await fetch(`${base}index.json?v=${EVCC_CARD_VERSION}`);
      if (idxResp.ok) langs = await idxResp.json();
      else console.warn("[evcc-card] locales/index.json not found, using fallback:", langs);
    } catch (e) {
      console.warn("[evcc-card] Could not load locales/index.json, using fallback:", langs);
    }
    const results = await Promise.allSettled(
      langs.map(lang =>
        fetch(`${base}${lang}.json?v=${EVCC_CARD_VERSION}`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(data => ({ lang, data }))
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        _sharedTranslations[result.value.lang] = result.value.data;
      } else {
        console.warn("[evcc-card] Failed to load translation:", result.reason);
      }
    }
    _sharedTranslationsReady = true;
    _sharedTranslationsLoading = null;
  })();

  return _sharedTranslationsLoading;
}

function sharedTranslations() { return _sharedTranslations; }
function sharedTranslationsReady() { return _sharedTranslationsReady; }

// Every write the card sends to Home Assistant. Methods are mixed into EvccCard.prototype.
const actions = {
  // ── Service calls ───────────────────────────────────────────────────────
  // The card writes only through these methods, so domain, service and payload
  // of every operable control sit in one file instead of next to the listener
  // that happens to trigger them. The `contracts` group of the test suite pins
  // each of them down. They all return what hass returns, callers that report
  // failures await the promise or chain on it.

  _setSelectOption(entityId, option) {
    return this._hass.callService("select", "select_option", { entity_id: entityId, option });
  },

  _setNumberValue(entityId, value) {
    return this._hass.callService("number", "set_value", { entity_id: entityId, value });
  },

  // Toggles pass the state they currently show, not the one they want: a
  // control rendered "on" turns off.
  _toggleEntity(domain, entityId, isOn) {
    return this._hass.callService(domain, isOn ? "turn_off" : "turn_on", { entity_id: entityId });
  },

  _pressButton(entityId) {
    return this._hass.callService("button", "press", { entity_id: entityId });
  },

  // ── ha-evcc plan services ───────────────────────────────────────────────
  // A vehicle known to evcc carries its plan itself and is planned in percent.
  // A loadpoint is planned in kWh and is addressed by its 1-based evcc index,
  // never by its name. ha-evcc registers these services without a schema and
  // drops a call whose `loadpoint`/`energy` is not an integer inside set_plan(),
  // without an error and with an empty response, so a caller that cannot supply
  // both must not call at all instead of reporting a plan that evcc never got.

  _setVehiclePlan(vehicle, soc, startdate) {
    return this._hass.callService("evcc_intg", "set_vehicle_plan", { vehicle, soc, startdate });
  },

  _setLoadpointPlan(loadpointIndex, energy, startdate) {
    return this._hass.callService("evcc_intg", "set_loadpoint_plan", {
      loadpoint: Math.round(loadpointIndex),
      energy:    Math.round(energy),
      startdate,
    });
  },

  _deleteVehiclePlan(vehicle) {
    return this._hass.callService("evcc_intg", "del_vehicle_plan", { vehicle });
  },

  _deleteLoadpointPlan(loadpointIndex) {
    return this._hass.callService("evcc_intg", "del_loadpoint_plan", {
      loadpoint: Math.round(loadpointIndex),
    });
  },
};

// ha-evcc WebSocket data API (capabilities, forecast, sessions, plan_preview). Methods are mixed into EvccCard.prototype.
const evccApi = {
  // ── ha-evcc WebSocket data API ──────────────────────────────────────────
  // On-demand request/response commands served by evcc_intg. They return data
  // that does not map to entities (forecast curves, raw session history, plan
  // previews). Reads are slow-changing, so results are cached with a TTL.

  _hasCmd(name) {
    return Array.isArray(this._caps?.commands) && this._caps.commands.includes(name);
  },

  // Probe capabilities once. Older ha-evcc versions lack the command and the
  // callWS rejects — we then mark the feature set empty so the UI degrades.
  _loadCapabilities() {
    if (this._capsLoaded || this._capsLoading || !this._hass) return this._capsLoading;
    // A prefix change swaps the entry while this is in flight; the answer for
    // the old entry is then dropped and the new one's probe is already running.
    const entryId = this._entryId;
    const stale   = () => entryId !== this._entryId;
    this._capsLoading = this._hass
      .callWS({ type: "evcc_intg/capabilities", entry_id: entryId })
      .then(res => {
        if (stale()) return;
        this._caps = {
          version:  res?.version ?? null,
          commands: Array.isArray(res?.commands) ? res.commands : [],
        };
        // Build the loadpoint slug -> evcc API index map (ha-evcc 2026.6.x+),
        // so the plan preview targets the right loadpoint without guessing.
        this._lpIndexMap = {};
        for (const lp of (Array.isArray(res?.loadpoints) ? res.loadpoints : [])) {
          if (lp && lp.id != null && lp.index != null) this._lpIndexMap[lp.id] = Number(lp.index);
        }
      })
      .catch(e => {
        if (stale()) return;
        console.warn("[evcc-card] evcc_intg/capabilities not available:", e?.message || e);
        this._caps = { version: null, commands: [] };
      })
      .then(() => {
        if (stale()) return;
        this._capsLoaded  = true;
        this._capsLoading = null;
        // Pre-fetch debug probes so data is cached before the debug block renders.
        this._prefetchDebugProbes();
        this._render();
      });
    return this._capsLoading;
  },

  // Kick off WS probes in the background so they are cached for the debug block.
  // Results arrive asynchronously; _wsFetch.finally() triggers a re-render.
  _prefetchDebugProbes() {
    if (this._hasCmd("forecast"))     { this._wsForecast("grid"); this._wsForecast("planner"); }
    if (this._hasCmd("sessions"))     this._wsSessions();
    // plan_preview needs a loadpoint — skip here, probe only in debug report.
  },

  // Generic cached WS fetch. Returns fresh cached data synchronously; otherwise
  // kicks off the request (de-duplicated per cacheKey) and triggers a re-render
  // when it lands. Returns null while data is pending or on error.
  // Returns: null (pending/no hass), { data } on success, { error } on failure.
  _wsFetch(type, params, cacheKey, ttlMs) {
    if (!this._hass || !this._entryId) return null;

    const cached = this._wsCache[cacheKey];
    const now = Date.now();
    if (cached && (now - cached.ts) < ttlMs) return cached.result;

    if (!this._wsInflight[cacheKey]) {
      const entryId = this._entryId;
      const stale   = () => entryId !== this._entryId;   // entry swapped meanwhile, see _syncIntegrationInstance
      this._wsInflight[cacheKey] = this._hass
        .callWS({ type, entry_id: entryId, ...params })
        .then(data => {
          if (stale()) return;
          this._wsCache[cacheKey] = { ts: Date.now(), result: { data } };
        })
        .catch(e => {
          if (stale()) return;
          const msg = e?.message || (typeof e === "object" ? JSON.stringify(e) : String(e));
          console.warn(`[evcc-card] ${type} failed:`, msg);
          this._wsCache[cacheKey] = { ts: Date.now(), result: { error: msg } };
        })
        .finally(() => {
          if (stale()) return;
          delete this._wsInflight[cacheKey];
          // Throttle the re-render to avoid rapid DOM replacements.
          if (!this._wsRenderTimer) {
            this._wsRenderTimer = setTimeout(() => {
              this._wsRenderTimer = null;
              this._render();
            }, 500);
          }
        });
    }
    // Serve stale result while a refresh is in flight, else null (pending).
    return cached ? cached.result : null;
  },

  // kind: grid | feedin | co2 | solar | planner  →  { kind, rates[], smartCostType?, currency? }
  // capabilities + the "planner" kind ship in the same ha-evcc release, so
  // _hasCmd("forecast") already implies planner is accepted - no kind-level probe needed.
  _wsForecast(kind) {
    if (!this._hasCmd("forecast")) return null;
    return this._wsFetch("evcc_intg/forecast", { kind }, `forecast:${kind}`, 5 * 60 * 1000);
  },

  // year/month optional  →  { sessions[] }
  _wsSessions(year, month) {
    if (!this._hasCmd("sessions")) return null;
    const params = {};
    if (year  != null) params.year  = year;
    if (month != null) params.month = month;
    return this._wsFetch("evcc_intg/sessions", params, `sessions:${year ?? ""}:${month ?? ""}`, 5 * 60 * 1000);
  },

  // Canonical params + cache key for a plan_preview request. Shared by every
  // call site so the cached-read, the fetch and the invalidation all agree.
  _planPreviewParams(opts) {
    return {
      loadpoint: opts.loadpoint,
      kind:      opts.kind,
      value:     String(opts.value),
      timestamp: opts.timestamp,
    };
  },

  _planPreviewKey(opts) {
    return "plan:" + JSON.stringify(this._planPreviewParams(opts));
  },

  // opts: { loadpoint:int, kind:"soc"|"energy", value, timestamp }  →
  //       { duration, power, rates[], smartCostType, currency }
  // The ha-evcc 'plan_preview' command (2026.6.x) requires all four params; it is
  // a static, read-only preview (no 'repeating' kind, timestamp is mandatory).
  // Initiates a backend call (subject to _wsFetch TTL + in-flight coalescing).
  _wsPlanPreview(opts) {
    if (!this._hasCmd("plan_preview")) return null;
    const params = this._planPreviewParams(opts);
    return this._wsFetch("evcc_intg/plan_preview", params, this._planPreviewKey(opts), 60 * 1000);
  },

  // Render-path read: serve the cached preview regardless of age, and prime
  // exactly one fetch if nothing is cached or in flight. Unlike _wsPlanPreview,
  // this never re-hits the backend on TTL expiry — a result, once cached, is
  // served until the user changes an input (which re-fetches via
  // _requestPlanPreview). That keeps an idle plan card at zero backend calls,
  // as agreed with ha-evcc (marq24/ha-evcc#298): plan_preview is uncached
  // server-side, so the card must not generate background/idle traffic.
  _wsPlanPreviewCached(opts) {
    if (!this._hasCmd("plan_preview")) return null;
    const cacheKey = this._planPreviewKey(opts);
    const cached = this._wsCache[cacheKey];
    if (cached) return cached.result;
    if (!this._wsInflight[cacheKey]) this._wsPlanPreview(opts);
    return null;
  },

  // plan_preview expects the integer evcc loadpoint index (1-based), but the card
  // keys loadpoints by name slug. Resolution order:
  //   1. authoritative map from evcc_intg/capabilities (ha-evcc 2026.6.x+)
  //   2. explicit config override  plan_loadpoint_index: { <slug>: <int> }
  //   3. fallback heuristic: position in the deterministically sorted discovery list
  // The map is exact; the override + heuristic only cover older integrations that
  // do not yet return the loadpoint list in their capabilities response.
  // Returns the 1-based index, or null if the loadpoint is unknown.
  _lpIndex(lpName) {
    const fromCaps = this._lpIndexMap?.[lpName];
    if (fromCaps != null) return fromCaps;
    const override = this._config?.plan_loadpoint_index;
    if (override && override[lpName] != null) {
      const n = parseInt(override[lpName], 10);
      if (n > 0) return n;
    }
    const prefix = this._getPrefix();
    const names = Object.keys(discoverEntities(this._hass, prefix).loadpoints).sort();
    const idx = names.indexOf(lpName);
    return idx >= 0 ? idx + 1 : null;
  },

  // Debounced plan preview fetch — called after SOC/time/vehicle changes.
  _requestPlanPreview(lpName) {
    const state = this._planState[lpName];
    if (!state || !state.soc || !state.time || !this._hasCmd("plan_preview")) return;
    const lpIdx = this._lpIndex(lpName);
    if (lpIdx == null) return;

    clearTimeout(this._planPreviewDebounce[lpName]);
    this._planPreviewDebounce[lpName] = setTimeout(() => {
      // Convert datetime-local value to ISO 8601 with timezone offset
      const d = new Date(state.time);
      if (isNaN(d.getTime())) return;
      const ts = d.toISOString();
      const opts = { loadpoint: lpIdx, kind: "soc", value: state.soc, timestamp: ts };
      const cacheKey = this._planPreviewKey(opts);
      // Drop previews for OTHER inputs of this loadpoint (bounds the cache), but
      // keep the current one — refetching what we already have wastes a backend call.
      const pfx = `plan:{"loadpoint":${lpIdx},`;
      for (const key of Object.keys(this._wsCache)) {
        if (key.startsWith(pfx) && key !== cacheKey) delete this._wsCache[key];
      }
      // Already cached (e.g. primed by the render path) or in flight → no refetch.
      if (this._wsCache[cacheKey] || this._wsInflight[cacheKey]) return;
      this._wsPlanPreview(opts);
    }, 500);
  },
};

// A value that maps onto one ha-evcc entity opens that entity's more-info
// dialog on a click, the way the rows of the site and flow views do. The
// delegation in listeners.js attaches the handler, the focus and the keys to
// every element carrying the attribute; empty when the entity is not discovered.
const moreInfo = (entityId) => entityId ? ` data-more-info="${escAttr(entityId)}"` : "";

// Loadpoint and compact modes: header, mode selector, power row, vehicle and session info, toggles. Methods are mixed into EvccCard.prototype.
const loadpointView = {
  _renderLoadpoint(lpName, ents) {
    const charging   = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected  = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusClass = charging ? "charging" : connected ? "connected" : "ready";

    const noPlan = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);
    const noPv   = Array.isArray(this._config.no_pv)   && this._config.no_pv.includes(lpName);
    const remaining = charging ? fmtRemainingDuration(this._hass, ents.charge_remaining_duration) : "";

    return `
      <div class="loadpoint">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          ${remaining ? `<span class="lp-remaining" title="${this._t("remaining")}"${moreInfo(ents.charge_remaining_duration)}>${remaining}</span>` : ""}
          <span class="lp-badge ${statusClass}"${moreInfo(charging ? ents.charging : ents.connected)}>
            ${statusLabel}
          </span>
        </div>
        ${this._renderActionIndicator(ents)}
        ${this._renderModeSelector(ents, noPv)}
        ${this._renderVehicleInfo(ents, charging, lpName)}
        ${this._renderPowerRow(ents, charging)}
        ${this._renderSliders(ents)}
        ${this._renderCurrentBlock(ents, lpName)}
        ${this._renderToggles(ents)}
        ${noPlan ? "" : this._renderPlanBlock(lpName, ents)}
        ${this._renderSessionInfo(ents, charging)}
      </div>
    `;
  },

  _renderCompactLoadpoint(lpName, ents) {
    const charging    = ents.charging  ? isOn(this._hass, ents.charging)  : false;
    const connected   = ents.connected ? isOn(this._hass, ents.connected) : false;
    const statusLabel = charging ? this._t("charging") : connected ? this._t("connected") : this._t("ready");
    const statusClass = charging ? "charging" : connected ? "connected" : "ready";
    const noPlan      = Array.isArray(this._config.no_plan) && this._config.no_plan.includes(lpName);
    const noPv        = Array.isArray(this._config.no_pv)   && this._config.no_pv.includes(lpName);

    if (this._tabState[lpName] === undefined) this._tabState[lpName] = 0;
    const activeTab = this._tabState[lpName];

    const tabs = [
      { key: "tabControl",  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>` },
      { key: "tabSettings", icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3,17V19H9V17H3M3,5V7H13V5H3M13,21V19H21V17H13V15H11V21H13M7,9V11H3V13H7V15H9V9H7M21,13V11H11V13H21M15,9H17V7H21V5H17V3H15V9Z"/></svg>` },
      { key: "tabPlan",     icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,19H5V8H19V19Z"/></svg>` },
      { key: "tabSession",  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M22,21H2V3H4V19H6V17H10V19H12V16H16V19H18V17H22V21Z"/></svg>` },
    ];

    const tabBar = `
      <div class="compact-tabs">
        ${tabs.map((tab, i) => `
          <button class="compact-tab ${activeTab === i ? "active" : ""}"
                  data-lp="${escAttr(lpName)}" data-tab="${i}">
            <span class="compact-tab-icon">${tab.icon}</span>
            <span class="compact-tab-label">${this._t(tab.key)}</span>
          </button>
        `).join("")}
      </div>`;

    const tabContent = [
      `<div class="compact-panel" ${activeTab !== 0 ? 'hidden' : ''}>
        ${this._renderModeSelector(ents, noPv)}
        ${this._renderVehicleInfo(ents, charging, lpName)}
        ${this._renderPowerRow(ents, charging)}
      </div>`,
      `<div class="compact-panel" ${activeTab !== 1 ? 'hidden' : ''}>
        ${this._renderSliders(ents)}
        ${this._renderCurrentBlock(ents, lpName)}
        ${this._renderToggles(ents)}
      </div>`,
      `<div class="compact-panel" ${activeTab !== 2 ? 'hidden' : ''}>
        ${noPlan ? "" : this._renderPlanBlock(lpName, ents)}
      </div>`,
      `<div class="compact-panel" ${activeTab !== 3 ? 'hidden' : ''}>
        ${this._renderSessionInfo(ents, charging)}
      </div>`,
    ].join("");

    const remaining = charging ? fmtRemainingDuration(this._hass, ents.charge_remaining_duration) : "";

    return `
      <div class="loadpoint" data-lp-compact="${escAttr(lpName)}">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          ${remaining ? `<span class="lp-remaining" title="${this._t("remaining")}"${moreInfo(ents.charge_remaining_duration)}>${remaining}</span>` : ""}
          <span class="lp-badge ${statusClass}"${moreInfo(charging ? ents.charging : ents.connected)}>
            ${statusLabel}
          </span>
        </div>
        ${this._renderActionIndicator(ents)}
        ${tabBar}
        ${tabContent}
      </div>
    `;
  },

  _loadpointTitle(lp, ents) {
    const hass = this._hass;
    // 1) a loadpoint_title attribute on the mode entity, when one is present
    const fromAttr = ents.mode && attr(hass, ents.mode, "loadpoint_title");
    if (fromAttr) return fromAttr;
    // 2) the device registry: ha-evcc names the loadpoint device like
    //    "evcc - Ladepunkt openWB [evcc]" — extract the title by locating the lp slug
    //    inside the device name case-insensitively (underscores match space/dash too).
    const probeEntity = ents.mode || ents.charge_power || ents.priority;
    const entReg = hass?.entities?.[probeEntity];
    const devId  = entReg?.device_id;
    const dev    = devId ? hass?.devices?.[devId] : null;
    if (dev?.name_by_user) return dev.name_by_user;
    const devName = dev?.name;
    if (devName) {
      const slugPattern = lp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[ _\\-]");
      const re = new RegExp(`(${slugPattern})`, "i");
      const m = devName.match(re);
      if (m) return m[1];
      return devName.replace(/^\[evcc\]\s*/i, "").trim() || lp;
    }
    return lp;
  },

  // phase_remaining is delivered as a raw seconds value (unlike pv_remaining,
  // which ha-evcc exposes as an absolute timestamp). Convert it to an absolute
  // target ISO so the generic _tickCountdowns() loop can count it down live.
  // The target is cached per entity and only re-anchored when the integration
  // reports a new remaining value, so frequent re-renders don't reset it.
  _phaseTargetISO(entityId, rawState) {
    const sec = Math.round(parseFloat(rawState));
    if (isNaN(sec) || sec <= 0) return null;
    this._phaseTargets = this._phaseTargets || {};
    const cached = this._phaseTargets[entityId];
    if (!cached || cached.raw !== String(rawState)) {
      this._phaseTargets[entityId] = {
        raw: String(rawState),
        iso: new Date(Date.now() + sec * 1000).toISOString(),
      };
    }
    return this._phaseTargets[entityId].iso;
  },

  _renderActionIndicator(ents) {
    const flashIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>`;
    const sunIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`;

    const fmtCountdown = (sec) => {
      const n = Math.max(0, Math.round(parseFloat(sec)));
      if (isNaN(n) || n <= 0) return "";
      if (n < 60) return `${n}s`;
      return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
    };

    const chips = [];

    if (ents.phase_action && this._hass.states[ents.phase_action]) {
      const state = stateVal(this._hass, ents.phase_action);
      if (state === "scale1p" || state === "scale3p") {
        const key    = state === "scale1p" ? "phaseActionScale1p" : "phaseActionScale3p";
        const raw    = ents.phase_remaining ? stateVal(this._hass, ents.phase_remaining) : "";
        const target = ents.phase_remaining ? this._phaseTargetISO(ents.phase_remaining, raw) : null;
        const span   = target
          ? `<span data-countdown-target="${target}" data-countdown-label="${key}">${this._t(key, { val: fmtCountdownFromISO(target) || "—" })}</span>`
          : `<span>${this._t(key, { val: fmtCountdown(raw) || "—" })}</span>`;
        chips.push(`
          <div class="lp-action-chip phase">
            ${flashIcon}
            ${span}
          </div>`);
      }
    }

    if (ents.pv_action && this._hass.states[ents.pv_action]) {
      const state = stateVal(this._hass, ents.pv_action);
      if (state === "enable" || state === "disable") {
        const ts  = ents.pv_remaining ? (stateVal(this._hass, ents.pv_remaining) || "") : "";
        const cd  = fmtCountdownFromTimestamp(this._hass, ents.pv_remaining);
        const key = state === "enable" ? "pvActionEnable" : "pvActionDisable";
        chips.push(`
          <div class="lp-action-chip pv">
            ${sunIcon}
            <span data-countdown-target="${ts}" data-countdown-label="${key}">${this._t(key, { val: cd || "—" })}</span>
          </div>`);
      }
    }

    const vehicleStatuses = [
      { key: "vehicle_detection_active", label: "vehicleDetectionActive", icon: "M9.61 16.11C9.61 14.03 10.59 12.19 12.1 11H5L6.5 6.5H17.5L18.72 10.16C19.56 10.53 20.3 11.07 20.91 11.74L18.92 6C18.72 5.42 18.16 5 17.5 5H6.5C5.84 5 5.28 5.42 5.08 6L3 12V20C3 20.55 3.45 21 4 21H5C5.55 21 6 20.55 6 20V19H10.29C9.86 18.13 9.61 17.15 9.61 16.11M6.5 16C5.67 16 5 15.33 5 14.5S5.67 13 6.5 13 8 13.67 8 14.5 7.33 16 6.5 16M20.71 20.7L20.7 20.71L20.71 20.7M16.11 11.61C18.61 11.61 20.61 13.61 20.61 16.11C20.61 17 20.36 17.82 19.92 18.5L23 21.61L21.61 23L18.5 19.93C17.8 20.36 17 20.61 16.11 20.61C13.61 20.61 11.61 18.61 11.61 16.11S13.61 11.61 16.11 11.61M16.11 13.61C14.73 13.61 13.61 14.73 13.61 16.11S14.73 18.61 16.11 18.61 18.61 17.5 18.61 16.11 17.5 13.61 16.11 13.61" },
      { key: "vehicle_climater_active",  label: "vehicleClimaterActive",  icon: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z" },
      { key: "vehicle_welcome_active",   label: "vehicleWelcomeActive",   icon: "M22,12V20A2,2 0 0,1 20,22H4A2,2 0 0,1 2,20V12A1,1 0 0,1 1,11V8A2,2 0 0,1 3,6H6.17C6.06,5.69 6,5.35 6,5A3,3 0 0,1 9,2C10,2 10.88,2.5 11.43,3.24V3.23L12,4L12.57,3.23V3.24C13.12,2.5 14,2 15,2A3,3 0 0,1 18,5C18,5.35 17.94,5.69 17.83,6H21A2,2 0 0,1 23,8V11A1,1 0 0,1 22,12M4,20H11V12H4V20M20,20V12H13V20H20M9,4A1,1 0 0,0 8,5A1,1 0 0,0 9,6A1,1 0 0,0 10,5A1,1 0 0,0 9,4M15,4A1,1 0 0,0 14,5A1,1 0 0,0 15,6A1,1 0 0,0 16,5A1,1 0 0,0 15,4M3,8V10H11V8H3M13,8V10H21V8H13Z" },
    ];
    for (const vs of vehicleStatuses) {
      if (ents[vs.key] && isOn(this._hass, ents[vs.key])) {
        chips.push(`
          <div class="lp-action-chip vehicle">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="${vs.icon}"/></svg>
            <span>${this._t(vs.label)}</span>
          </div>`);
      }
    }

    return chips.length ? `<div class="lp-action-row">${chips.join("")}</div>` : "";
  },

  _renderModeSelector(ents, hidePv = false) {
    if (!ents.mode) return "";
    const current = stateVal(this._hass, ents.mode);

    // evcc 0.310 "switch devices" no longer offer the 'minpv' mode, and with
    // evcc PR 32490 a loadpoint offers 'smart' instead of 'pv'/'minpv' (ha-evcc
    // then swaps the whole option list to [off, smart, now]). Render only the
    // modes the entity actually exposes; fall back to the classic set when
    // options are not yet loaded, so nothing regresses on older integrations.
    const available = attr(this._hass, ents.mode, "options");
    const offered   = Array.isArray(available) && available.length ? available : null;
    const hasSmart  = !!offered && offered.includes("smart");

    // Mirror evcc's Mode.vue: when PV is hidden (no solar configured) the modes
    // depend on whether a dynamic tariff is available (smartCostAvailable). The
    // ha-evcc integration exposes no such flag, so we proxy it via a valid
    // tariff sensor value (same signal used by the smart-cost block below).
    // Obsolete once evcc offers a real 'smart' mode, hence the hasSmart guard.
    let hidden    = [];
    let pvAsSmart = false;
    if (hidePv && !hasSmart) {
      const isCo2     = (attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "") === "g/kWh";
      const tariffId  = `sensor.${this._getPrefix()}${isCo2 ? "tariff_co2" : "tariff_grid"}`;
      const smartCost = !isNaN(parseFloat(this._hass.states[tariffId]?.state ?? "NaN"));
      if (smartCost) { hidden = ["minpv"];        pvAsSmart = true; }  // [Off, Smart, Now]
      else           { hidden = ["pv", "minpv"]; }                     // [Off, Now]
    }

    const buttons = Object.entries(CHARGE_MODES)
      .filter(([val]) => {
        if (val === current)      return true;
        if (hidden.includes(val)) return false;
        if (offered)              return offered.includes(val);
        return val !== "smart";   // options unknown: keep the pre-32391 set
      })
      .map(([val, cfg]) => {
        const isSmart = pvAsSmart && val === "pv";
        const icon    = isSmart ? SMART_MODE_ICON : cfg.icon;
        const label   = isSmart ? this._t("modeSmart") : this._t(cfg.tKey);
        return `
      <button class="mode-btn ${current === val ? "active" : ""}"
              data-entity="${ents.mode}" data-value="${val}">
        <span class="mode-icon">${icon}</span>
        <span class="mode-label">${label}</span>
      </button>
    `;
      }).join("");
    const alwaysCharge = this._renderAlwaysCharge(ents);
    return `<div class="mode-row${alwaysCharge ? " has-sub" : ""}">${buttons}</div>${alwaysCharge}`;
  },

  // Companion of the 'smart' mode (evcc PR 32490, ha-evcc 2026.8.3+): charge
  // without interruption at least at min current, either permanently ('on') or
  // for the running session only ('once'). ha-evcc marks the entity unavailable
  // while the loadpoint is not in 'smart' mode, so the row disappears by itself
  // whenever it does not apply.
  _renderAlwaysCharge(ents) {
    const entityId = ents.always_charge;
    if (!entityId) return "";
    const current = stateVal(this._hass, entityId);
    if (current === null || current === "unavailable" || current === "unknown") return "";

    const options = attr(this._hass, entityId, "options");
    if (!Array.isArray(options) || !options.length) return "";

    const LABELS = {
      "off":  this._t("alwaysChargeOff"),
      "on":   this._t("alwaysChargeOn"),
      "once": this._t("alwaysChargeOnce"),
    };
    const buttons = options.map(opt => `
        <button class="phase-btn ${opt === current ? "active" : ""}"
                data-entity="${entityId}" data-value="${escAttr(opt)}">
          ${LABELS[opt] ?? escHtml(opt)}
        </button>`).join("");

    // Same subline evcc shows under its Always-charge dropdown, as a tooltip so
    // the compact row stays a single line.
    const minA = ents.min_current ? stateVal(this._hass, ents.min_current) : null;
    const hint = minA !== null && !isNaN(parseFloat(minA))
      ? this._t("alwaysChargeHint", { val: minA }) : "";

    return `
      <div class="select-row alwayscharge-row">
        <span${hint ? ` title="${escAttr(hint)}"` : ""}>${this._t("alwaysCharge")}</span>
        <div class="phase-btn-group">${buttons}</div>
      </div>`;
  },

  _renderVehicleInfo(ents, charging = false, lpName = "") {
    if (!ents.vehicle_soc && !ents.vehicle_name) return "";
    const vehicleAttrs = ents.vehicle_name
      ? (this._hass.states[ents.vehicle_name]?.attributes ?? {}) : {};
    const vehicleName  = vehicleAttrs.vehicle?.name || null;
    const validName    = vehicleName && vehicleName !== "null" ? vehicleName : null;

    if (!ents.vehicle_soc && !validName) return "";

    const soc   = ents.vehicle_soc ? parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0 : null;
    const range = ents.vehicle_range
      ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_range))) : null;
    const limit  = ents.limit_soc ? parseFloat(stateVal(this._hass, ents.limit_soc))  : null;
    const minSoc = ents.min_soc   ? parseFloat(stateVal(this._hass, ents.min_soc))    : null;
    const fillBg  = soc !== null ? socFillGradient(soc, minSoc ?? 0, limit ?? 100) : "var(--evcc-blue)";
    const trackBg = socTrackBg(minSoc ?? 0, limit ?? 100);

    const _rawLimit  = ents.smart_cost_limit ? parseFloat(stateVal(this._hass, ents.smart_cost_limit)) : NaN;
    const smartLimit = ents.smart_cost_limit && !isNaN(_rawLimit) ? _rawLimit : null;
    const smartUnit  = smartLimit !== null
      ? (attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "") : "";
    const isCo2Chip  = smartUnit === "g/kWh";
    const prefix     = this._getPrefix();
    const tariffId   = isCo2Chip ? `sensor.${prefix}tariff_co2` : `sensor.${prefix}tariff_grid`;
    const tariffVal  = parseFloat(this._hass.states[tariffId]?.state ?? "NaN");
    const smartActive = smartLimit !== null && !isNaN(tariffVal) && tariffVal <= smartLimit;
    const leafIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z"/></svg>`;
    const euroIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M15,18.5C12.49,18.5 10.32,17.08 9.24,15H15V13H8.58C8.53,12.67 8.5,12.34 8.5,12C8.5,11.66 8.53,11.33 8.58,11H15V9H9.24C10.32,6.92 12.5,5.5 15,5.5C16.61,5.5 18.09,6.09 19.23,7.07L21,5.3C19.41,3.87 17.3,3 15,3C11.08,3 7.76,5.51 6.52,9H3V11H6.06C6.02,11.33 6,11.66 6,12C6,12.34 6.02,12.67 6.06,13H3V15H6.52C7.76,18.49 11.08,21 15,21C17.31,21 19.41,20.13 21,18.7L19.22,16.93C18.09,17.91 16.61,18.5 15,18.5Z"/></svg>`;
    const smartChip  = smartLimit !== null ? `
      <button class="smart-cost-chip ${smartActive ? "active" : ""}"
              data-lp-smart-cost-open="${escAttr(lpName)}">
        ${isCo2Chip ? leafIcon : euroIcon} ≤ ${smartLimit} ${isCo2Chip ? "g" : escHtml(smartUnit)}
      </button>` : "";

    const _boostLimitRaw = ents.battery_boost_limit
      ? parseInt(stateVal(this._hass, ents.battery_boost_limit), 10) : NaN;
    const boostLimit     = isNaN(_boostLimitRaw) ? 100 : _boostLimitRaw;
    const showBoostChip  = !!ents.battery_boost && boostLimit < 100;
    const boostOn        = showBoostChip ? isOn(this._hass, ents.battery_boost) : false;
    const battPlusIcon   = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M16,20H8V14H10V12H8V6H16V20M14,4V2H10V4H8C6.89,4 6,4.89 6,6V20A2,2 0 0,0 8,22H16A2,2 0 0,0 18,20V6C18,4.89 17.11,4 16,4H14M11,9H13V11H15V13H13V15H11V13H9V11H11V9Z"/></svg>`;
    const boostChip      = showBoostChip ? `
      <button class="boost-activate-btn ${boostOn ? "on" : ""}"
              data-entity="${ents.battery_boost}"
              data-domain="switch"
              data-on="${boostOn}">
        ${battPlusIcon} ${this._t("boostShort", { val: boostLimit })}
      </button>` : "";

    return `
      <div class="soc-section">
        <div class="soc-label-row">
          ${validName ? `<span class="vehicle-name"${moreInfo(ents.vehicle_name)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M5,11L6.5,6.5H17.5L19,11M17.5,16A1.5,1.5 0 0,1 16,14.5A1.5,1.5 0 0,1 17.5,13A1.5,1.5 0 0,1 19,14.5A1.5,1.5 0 0,1 17.5,16M6.5,16A1.5,1.5 0 0,1 5,14.5A1.5,1.5 0 0,1 6.5,13A1.5,1.5 0 0,1 8,14.5A1.5,1.5 0 0,1 6.5,16M18.92,6C18.72,5.42 18.16,5 17.5,5H6.5C5.84,5 5.28,5.42 5.08,6L3,12V20A1,1 0 0,0 4,21H5A1,1 0 0,0 6,20V19H18V20A1,1 0 0,0 19,21H20A1,1 0 0,0 21,20V12L18.92,6Z"/></svg> ${escHtml(validName)}</span>` : ""}
          ${soc !== null ? `<span data-live-entity="${ents.vehicle_soc}" data-live-type="soc-pct"${moreInfo(ents.vehicle_soc)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${escHtml(unitStr(this._hass, ents.vehicle_soc))}</span>` : ""}
          ${range !== null ? `<span${moreInfo(ents.vehicle_range)}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="var(--secondary-text-color)"><path d="M11.5 0L9 8H11V16H13V8H15L11.5 0M3 18V20H21V18L11.5 16L3 18Z"/></svg> ${range} km</span>` : ""}
        </div>
        ${soc !== null ? `
        <div class="soc-track" style="background:${trackBg}">
          <div class="soc-fill ${charging ? 'charging' : ''}"
               data-live-entity="${ents.vehicle_soc}" data-live-type="soc-fill"
               data-min-soc="${minSoc ?? 0}" data-limit-soc="${limit ?? 100}"
               style="width:${soc}%;background:${fillBg}"></div>
          ${minSoc !== null ? `<div class="soc-min-marker"   style="left:${Math.min(minSoc,100)}%"></div>` : ""}
          ${limit  !== null ? `<div class="soc-limit-marker" style="left:${Math.min(limit,100)}%"></div>`  : ""}
        </div>` : ""}
        ${boostChip ? `<div class="boost-activate-row">${boostChip}</div>` : ""}
        ${smartChip ? `<div class="smart-cost-row">${smartChip}</div>` : ""}
      </div>
    `;
  },

  _renderPowerRow(ents, charging) {
    if (!ents.charge_power) return "";
    const power = parseFloat(stateVal(this._hass, ents.charge_power)).toFixed(1);
    const unit  = unitStr(this._hass, ents.charge_power);

    // Phasenstrom-Sensoren (echte Messwerte, standardmäßig deaktiviert)
    const hasPhaseCurrents = ents.charge_currents_0 || ents.charge_currents_1 || ents.charge_currents_2;
    const phaseCurrents = hasPhaseCurrents
      ? [0, 1, 2].map(i => {
          const val = ents[`charge_currents_${i}`]
            ? parseFloat(stateVal(this._hass, ents[`charge_currents_${i}`]))
            : null;
          return (val === null || isNaN(val)) ? null : val;
        })
      : null;

    // Fallback: offeredCurrent (wenn keine Phasenstrom-Sensoren vorhanden)
    const current = !hasPhaseCurrents && ents.charge_current
      ? stateVal(this._hass, ents.charge_current) : null;

    // Phasen-Label nur wenn keine Einzelwerte sichtbar
    const phases = !hasPhaseCurrents && ents.phases_active
      ? parseInt(stateVal(this._hass, ents.phases_active)) || null : null;
    const phasesLabel = phases === 1 ? this._t("phasesSingle")
                      : phases === 3 ? this._t("phasesTriple")
                      : phases !== null ? `${phases}` : null;

    // Show only phases with current > 0 (robust for arbitrary phase assignments).
    const activePhases = phaseCurrents ? phaseCurrents.filter(v => v !== null && v > 0) : null;
    const phaseStr = activePhases && activePhases.length > 0
      ? activePhases.map(v => Math.round(v)).join(" / ") + " A"
      : null;

    // Show hint when offeredCurrent is displayed (no phase current entities available).
    const hint = current !== null
      ? `<div class="power-currents-hint">${this._t("phaseCurrentsHint")}</div>`
      : "";

    return `
      <div class="power-row ${charging ? "charging" : ""}">
        <span class="power-value"
              data-live-entity="${ents.charge_power}" data-live-type="power"${moreInfo(ents.charge_power)}>
          ${power} ${escHtml(unit)}
        </span>
        ${phaseStr ? `<span class="power-sep">·</span><span class="power-current"${moreInfo(ents.charge_currents_0 || ents.charge_currents_1 || ents.charge_currents_2)}>${phaseStr}</span>` : ""}
        ${current !== null ? `<span class="power-sep">·</span><span class="power-current"${moreInfo(ents.charge_current)}>${current} A</span>` : ""}
        ${phasesLabel !== null ? `<span class="power-sep">·</span><span class="power-phases"${moreInfo(ents.phases_active)}>${phasesLabel}</span>` : ""}
      </div>
      ${hint}
    `;
  },

  _renderSessionInfo(ents, charging = false) {
    const hasAny = ents.session_energy || ents.session_price || ents.session_price_per_kwh || ents.session_co2_per_kwh || ents.session_solar_percentage;
    if (!hasAny) return "";

    const fmtVal = (entityId, decimals = 2) => {
      const v = parseFloat(stateVal(this._hass, entityId));
      if (isNaN(v)) return "—";
      const unit = unitStr(this._hass, entityId);
      return `${v.toFixed(decimals)}${unit ? " " + escHtml(unit) : ""}`;
    };

    const energy      = ents.session_energy          ? (() => { const v = parseFloat(stateVal(this._hass, ents.session_energy)); return isNaN(v) ? "—" : `${v.toFixed(2)} kWh`; })() : null;
    const price       = ents.session_price           ? (() => { const v = parseFloat(stateVal(this._hass, ents.session_price)); const u = unitStr(this._hass, ents.session_price) || "€"; return isNaN(v) ? "—" : `${v.toFixed(2)} ${escHtml(u)}`; })() : null;
    const fmtPerKwh = (entityId, decimals) => {
      const v = parseFloat(stateVal(this._hass, entityId));
      if (isNaN(v)) return "—";
      const unit = (unitStr(this._hass, entityId) || "").replace("/kWh", "").trim();
      return `${v.toFixed(decimals)}${unit ? " " + escHtml(unit) : ""}`;
    };
    const pricePerKwh = ents.session_price_per_kwh   ? fmtPerKwh(ents.session_price_per_kwh, 3) : null;
    const co2PerKwh   = ents.session_co2_per_kwh     ? fmtPerKwh(ents.session_co2_per_kwh, 0)   : null;
    const solar       = ents.session_solar_percentage? (() => { const v = parseFloat(stateVal(this._hass, ents.session_solar_percentage)); return isNaN(v) ? "—" : `${Math.round(v)} %`; })() : null;

    const items = [
      energy      ? `<div class="session-item"${moreInfo(ents.session_energy)}><span class="si-label">${this._t("energy")}</span><span class="si-value">${energy}</span></div>`          : "",
      price       ? `<div class="session-item"${moreInfo(ents.session_price)}><span class="si-label">${this._t("cost")}</span><span class="si-value">${price}</span></div>`              : "",
      pricePerKwh ? `<div class="session-item"${moreInfo(ents.session_price_per_kwh)}><span class="si-label">${this._t("sessionPricePerKwh")}</span><span class="si-value">${pricePerKwh}</span></div>` : "",
      co2PerKwh   ? `<div class="session-item"${moreInfo(ents.session_co2_per_kwh)}><span class="si-label">${this._t("sessionCo2PerKwh")}</span><span class="si-value">${co2PerKwh}</span></div>`     : "",
      solar       ? `<div class="session-item"${moreInfo(ents.session_solar_percentage)}><span class="si-label">${this._t("sessionSolar")}</span><span class="si-value">${solar}</span></div>`           : "",
    ].filter(Boolean);

    return `
      <div class="session-block">
        <div class="session-title">${charging ? this._t("chargeSessionCurrent") : this._t("chargeSessionLast")}</div>
        <div class="session-grid">${items.join("")}</div>
      </div>
    `;
  },

  // ha-evcc marks heating loadpoints (is_heating) by giving their SOC entities a
  // temperature device_class / °C unit (see force_celsius in the integration). Such
  // loadpoints are not EV charge points, so the charge-plan block is skipped for them.
  _isHeatingLoadpoint(ents) {
    const probe = ents.effective_plan_soc || ents.effective_limit_soc || ents.vehicle_soc;
    if (!probe) return false;
    const a = this._hass?.states[probe]?.attributes;
    if (!a) return false;
    return a.device_class === "temperature" || a.unit_of_measurement === "°C";
  },

  _renderToggles(ents) {
    const TOGGLE_FEATURES = [];
    const rows = TOGGLE_FEATURES
      .filter(({ key }) => ents[key])
      .map(({ key, label }) => {
        const entityId = ents[key];
        const on       = isOn(this._hass, entityId);
        const domain   = entityId.split(".")[0];
        return `
          <div class="toggle-row">
            <span>${label}</span>
            <button class="toggle ${on ? "on" : ""}"
                    data-entity="${entityId}"
                    data-domain="${domain}"
                    data-on="${on}">
              ${on ? this._t("toggleOn") : this._t("toggleOff")}
            </button>
          </div>
        `;
      });
    return rows.length ? `<div class="toggles">${rows.join("")}</div>` : "";
  },

  _renderEmpty(allLoadpoints = {}) {
    const available = Object.keys(allLoadpoints);
    const hint = available.length > 0
      ? `<p>${this._t("availableLoadpoints", { list: `<code>${available.map(escHtml).join(", ")}</code>` })}</p>`
      : "";
    return `
      <div class="empty">
        <p>${this._t("noLoadpoints")}</p>
        ${hint}
        <p class="empty-debug-hint">
          ${this._t("emptyTryDebug")}
          <button class="debug-link" data-action="open-debug">${this._t("openDebugMode")}</button>
        </p>
      </div>
    `;
  },

  // Placeholder when every (matching) loadpoint is disabled in the evcc
  // config and disabled_loadpoints is 'hide' - avoids an empty-looking card.
  _renderAllDisabled() {
    return `
      <div class="empty">
        <p>${this._t("allLoadpointsDisabled")}</p>
      </div>
    `;
  },

  // Dimmed stub for a loadpoint disabled in the evcc config
  // (disabled_loadpoints: dim). Only its disabled_in_config entity exists,
  // so there is nothing interactive to render.
  _renderDisabledLoadpoint(lpName, ents) {
    return `
      <div class="loadpoint lp-disabled" data-entity="${ents.disabled_in_config || ""}">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
          <span class="lp-badge disabled">${this._t("loadpointDisabled")}</span>
        </div>
      </div>
    `;
  },

  // Listeners of the loadpoint and compact views: the charge settings toggle
  // and the jump to the smart cost limit, the compact tabs, the boost chip,
  // the mode buttons, the entity toggles and the phase buttons. Called by
  // _attachListeners() after every render.
  _attachLoadpointListeners() {
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

    this.shadowRoot.querySelectorAll("button.boost-activate-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const on = btn.dataset.on === "true";
        this._toggleEntity("switch", btn.dataset.entity, on);
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    this.shadowRoot.querySelectorAll("button.mode-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._setSelectOption(btn.dataset.entity, btn.dataset.value);
      });
    });

    this.shadowRoot.querySelectorAll("button.toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._toggleEntity(domain, btn.dataset.entity, on);
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
        if (btn.dataset.lp) this._requestPlanPreview(btn.dataset.lp);
      });
    });

    this.shadowRoot.querySelectorAll("button.phase-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._setSelectOption(btn.dataset.entity, btn.dataset.value);
        const group = btn.closest(".phase-btn-group");
        if (group) {
          group.querySelectorAll(".phase-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        }
      });
    });
  },
};

// Loadpoint and compact modes: header, badges, action chips, mode row, vehicle
// and power row, the entity toggles and the session block.
// Part of the card stylesheet, see src/styles.js.
const loadpointCss = `
      .loadpoint {
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color, #e5e7eb);
        margin-bottom: 0;
      }
      .loadpoint:first-child { padding-top: 0; }
      .loadpoint:last-child { border-bottom: none; padding-bottom: 0; }
      /* The header values of a loadpoint open more-info; the site rows and the
         grid chips carry their own hover, this one covers the inline values. */
      .loadpoint [data-more-info] { cursor: pointer; }
      .loadpoint [data-more-info]:hover { opacity: .75; }
      .lp-header {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;
      }
      .lp-name { font-size: 1rem; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px; }
      .lp-badge {
        font-size: .75rem; font-weight: 600; padding: 2px 10px;
        border-radius: 999px; border: 1px solid currentColor;
      }
      .lp-badge.charging  { color: var(--evcc-green);  background: color-mix(in srgb, var(--evcc-green)  15%, transparent); }
      .lp-badge.connected { color: var(--evcc-blue);   background: color-mix(in srgb, var(--evcc-blue)   15%, transparent); }
      .lp-badge.ready     { color: var(--evcc-gray);   background: color-mix(in srgb, var(--evcc-gray)   15%, transparent); }
      .lp-badge.disabled  { color: var(--evcc-gray);   background: color-mix(in srgb, var(--evcc-gray)   15%, transparent); }
      .loadpoint.lp-disabled { opacity: 0.55; }
      .lp-action-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; }
      .lp-action-chip {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 8px; border-radius: 999px;
        font-size: .72rem; font-weight: 600;
        border: 1px solid var(--divider-color, #4b5563);
        color: var(--primary-text-color);
      }
      .lp-action-chip svg { width: 14px; height: 14px; flex: 0 0 14px; }
      .lp-action-chip.phase { color: var(--evcc-bolt, #ffae00); border-color: color-mix(in srgb, var(--evcc-bolt, #ffae00) 50%, transparent); background: color-mix(in srgb, var(--evcc-bolt, #ffae00) 10%, transparent); }
      .lp-action-chip.pv    { color: var(--evcc-green, #0a0);  border-color: color-mix(in srgb, var(--evcc-green, #0a0)  50%, transparent); background: color-mix(in srgb, var(--evcc-green, #0a0)  10%, transparent); }
      .lp-action-chip.vehicle { color: var(--info-color, #2196f3); border-color: color-mix(in srgb, var(--info-color, #2196f3) 50%, transparent); background: color-mix(in srgb, var(--info-color, #2196f3) 10%, transparent); }
      .lp-remaining {
        font-size: .85em; color: var(--secondary-text-color);
        margin-right: 8px; white-space: nowrap;
      }

      .mode-row { display: flex; gap: 6px; margin-bottom: 12px; }
      .mode-row.has-sub { margin-bottom: 6px; }
      .alwayscharge-row { margin-bottom: 12px; }
      .mode-btn {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 8px 2px; min-width: 0;
        border: 1px solid var(--divider-color, #e5e7eb); border-radius: 8px;
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .7rem; transition: all .15s; overflow: hidden;
      }
      .mode-btn:hover { border-color: var(--primary-color); }
      .mode-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .mode-icon { display: flex; align-items: center; justify-content: center; line-height: 1; min-height: 20px; }
      .mode-label { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      .soc-section { margin-bottom: 12px; }
      .soc-label-row {
        display: flex; justify-content: space-between;
        font-size: .85rem; margin-bottom: 6px; color: var(--secondary-text-color);
      }
      .vehicle-name { font-weight: 500; color: var(--primary-text-color); }
      .smart-cost-row { display: flex; justify-content: flex-end; margin-top: 4px; }
      .boost-activate-row { display: flex; justify-content: flex-start; margin-top: 6px; margin-bottom: 2px; }
      .boost-activate-btn {
        display: inline-flex; align-items: center; gap: 4px;
        background: none; border: 1px solid var(--divider-color, #555);
        border-radius: 4px; cursor: pointer;
        font-size: .75rem; color: var(--secondary-text-color);
        padding: 3px 8px; font-family: inherit;
        transition: border-color .15s, color .15s, background .15s;
      }
      .boost-activate-btn:hover { border-color: var(--evcc-bolt, #ffae00); color: var(--evcc-bolt, #ffae00); }
      .boost-activate-btn.on { color: var(--evcc-bolt, #ffae00); border-color: var(--evcc-bolt, #ffae00); background: rgba(255,174,0,0.08); }
      .soc-track {
        position: relative; height: 8px;
        background: var(--divider-color, #e5e7eb); border-radius: 4px; overflow: visible;
      }
      @keyframes soc-pulse {
        0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; }
      }
      .soc-fill { height: 100%; border-radius: 4px; transition: width .4s ease; }
      .soc-fill.charging { animation: soc-pulse 1.4s ease-in-out infinite; }
      .soc-limit-marker {
        position: absolute; top: -3px; width: 3px; height: 14px;
        background: #22c55e; border-radius: 2px; transform: translateX(-50%);
      }
      .soc-min-marker {
        position: absolute; top: -3px; width: 3px; height: 14px;
        background: #f59e0b; border-radius: 2px; transform: translateX(-50%);
      }

      .power-row { display: flex; align-items: flex-end; gap: 8px; margin-bottom: 12px; color: var(--secondary-text-color); flex-wrap: wrap; }
      .power-row.charging { color: #22c55e; }
      .power-value { font-size: 1.6rem; font-weight: 700; }
      .power-sep { font-size: .8rem; color: var(--secondary-text-color); align-self: flex-end; padding-bottom: .2rem; }
      .power-current { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }
      .power-phases  { font-size: .82rem; align-self: flex-end; padding-bottom: .2rem; }
      .power-currents-hint { font-size: .72rem; color: var(--secondary-text-color, #757575); margin-top: 2px; opacity: .8; }

      .toggles { margin-bottom: 10px; }
      .toggle-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      button.toggle {
        padding: 3px 14px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s;
      }
      button.toggle.on { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }

      .session-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .session-title { font-size: .7rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text-color); margin-bottom: 8px; }
      .session-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 6px; }
      .session-item { display: flex; flex-direction: column; gap: 2px; }
      .si-label { font-size: .7rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .05em; }
      .si-value { font-size: .95rem; font-weight: 600; color: var(--primary-text-color); }
`;

// Sliders with direct-input panel, step override, write-back and battery boost. Methods are mixed into EvccCard.prototype.
const socControl = {
  _renderSliders(ents) {
    // Heating loadpoints expose limit/min as a target temperature (°C), not a SoC,
    // so relabel the sliders accordingly (value/unit already come from the entity).
    const heating = this._isHeatingLoadpoint(ents);
    const SLIDER_FEATURES = [
      { key: "limit_soc",   label: this._t(heating ? "targetTemp" : "targetSoc") },
      { key: "min_soc",     label: this._t(heating ? "minTemp"    : "minSoc")    },
    ];

    const rows = SLIDER_FEATURES
      .filter(({ key }) => ents[key] && !this._isSettingHidden(key))
      .map(({ key, label }) => this._sliderRow(ents[key], label));

    return rows.length ? `<div class="sliders">${rows.join("")}</div>` : "";
  },

  // `hide_settings: [smart_cost_limit, priority, phases, …]` — see HIDEABLE_SETTINGS.
  _isSettingHidden(key) {
    const h = this._config?.hide_settings;
    return Array.isArray(h) && h.includes(key);
  },

  _renderCurrentBlock(ents, lpName = "") {
    const hide          = k => this._isSettingHidden(k);
    const hasPhases     = !!ents.phases_configured && !hide("phases");
    const hasMaxCurrent = !!ents.max_current && !hide("max_current");
    const hasMinCurrent = !!ents.min_current && !hide("min_current");
    const hasCurrent    = hasMaxCurrent || hasMinCurrent;
    const hasSmartCost  = !!ents.smart_cost_limit && !hide("smart_cost_limit");
    const hasFeedIn     = !!ents.smart_feed_in_priority_limit && !hide("smart_feed_in_priority_limit");
    const hasPriority   = !!ents.priority && !hide("priority");
    const hasBoost      = !!ents.battery_boost_limit && !hide("battery_boost");
    // Everything hidden or missing: no block, no gear button.
    if (!hasPhases && !hasCurrent && !hasSmartCost && !hasFeedIn && !hasPriority && !hasBoost) return "";

    const configDefault = this._config.charge_current_settings === "expanded";
    const expanded = this._currentBlockExpanded[lpName] !== undefined
      ? this._currentBlockExpanded[lpName]
      : configDefault;

    let phasesHtml = "";
    if (hasPhases) {
      const entityId = ents.phases_configured;
      const current  = stateVal(this._hass, entityId);
      const options  = this._hass.states[entityId]?.attributes?.options ?? [];
      const PHASE_LABELS = {
        "automatischer Wechsel": this._t("phaseAuto"), "automatic": this._t("phaseAuto"), "auto": this._t("phaseAuto"), "0": this._t("phaseAuto"),
        "1-phasig": "1", "1": "1",
        "3-phasig": "3", "3": "3",
      };
      const buttons = options.map(opt => `
        <button class="phase-btn ${opt === current ? "active" : ""}"
                data-entity="${entityId}" data-value="${escAttr(opt)}">
          ${PHASE_LABELS[opt] ?? escHtml(opt)}
        </button>`).join("");
      phasesHtml = `
        <div class="select-row">
          <span>${this._t("phases")}</span>
          <div class="phase-btn-group">${buttons}</div>
        </div>`;
    }

    const currentRows = [
      hasMaxCurrent ? this._sliderRow(ents.max_current, this._t("maxCurrent")) : "",
      hasMinCurrent ? this._sliderRow(ents.min_current, this._t("minCurrent")) : "",
    ].join("");

    const gearIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.68 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z"/></svg>`;

    return `
      <div class="current-block" data-lp-current="${escAttr(lpName)}">
        <div class="block-title-row">
          <span class="block-title">${this._t("chargeSettings")}</span>
          <button class="current-toggle-btn ${expanded ? "active" : ""}"
                  data-lp-current-toggle="${escAttr(lpName)}"
                  title="${expanded ? this._t("hideSettings") : this._t("showSettings")}">
            ${gearIcon}
          </button>
        </div>
        <div class="current-block-body" ${expanded ? "" : "hidden"}>
          ${phasesHtml}
          ${currentRows}
          ${(hasPhases || hasCurrent) && (hasBoost || hasPriority || hasSmartCost || hasFeedIn) ? `<hr class="settings-divider">` : ""}
          ${hasBoost ? this._renderBatteryBoost(ents) : ""}
          ${hasBoost && (hasPriority || hasSmartCost || hasFeedIn) ? `<hr class="settings-divider">` : ""}
          ${hasPriority ? this._sliderRow(ents.priority, this._t("priority")) : ""}
          ${hasPriority && (hasSmartCost || hasFeedIn) ? `<hr class="settings-divider">` : ""}
          ${hasSmartCost ? (() => {
            const unit      = attr(this._hass, ents.smart_cost_limit, "unit_of_measurement") ?? "";
            const isCo2     = unit === "g/kWh";
            const label     = isCo2 ? this._t("smartCostLimitCo2") : this._t("smartCostLimitPrice");
            const scTariffId = isCo2 ? `sensor.${this._getPrefix()}tariff_co2` : `sensor.${this._getPrefix()}tariff_grid`;
            const scTariff   = parseFloat(this._hass.states[scTariffId]?.state ?? "NaN");
            const active     = !isNaN(scTariff) && scTariff <= parseFloat(stateVal(this._hass, ents.smart_cost_limit) || 0);
            const clearId   = ents.smart_cost_limit.replace(/^number\./, "button.");
            const hasClear  = !!this._hass.states[clearId];
            return `<div class="smart-cost-section" data-lp-smart-cost-section="${escAttr(lpName)}">` +
              this._sliderRow(ents.smart_cost_limit, label) +
              (active ? `<div class="smart-active-hint">⚡ ${this._t("smartCostActive")}</div>` : "") +
              (hasClear ? `<div class="smart-cost-clear-row"><button class="smart-cost-clear-btn" data-entity="${clearId}">✕ ${this._t("smartCostClear")}</button></div>` : "") +
              `</div>`;
          })() : ""}
          ${hasSmartCost && hasFeedIn ? `<hr class="settings-divider">` : ""}
          ${hasFeedIn ? (() => {
            // Feed-in priority: above this feed-in limit, evcc prioritizes selling to the
            // grid over PV-surplus charging. Like the smart charging limit, the limit follows
            // evcc's global cost type, so the unit is currency/kWh (price mode) or g/kWh
            // (CO2 mode); _sliderRow renders whichever unit the entity reports. The
            // integration's binary_sensor is the authoritative "active" signal in both modes.
            const active     = ents.smart_feed_in_priority_active
              ? isOn(this._hass, ents.smart_feed_in_priority_active)
              : false;
            const clearId   = ents.smart_feed_in_priority_limit.replace(/^number\./, "button.");
            const hasClear  = !!this._hass.states[clearId];
            return `<div class="smart-cost-section" data-lp-feed-in-section="${escAttr(lpName)}">` +
              this._sliderRow(ents.smart_feed_in_priority_limit, this._t("feedInPriorityLimit")) +
              (active ? `<div class="smart-active-hint">⚡ ${this._t("feedInPriorityActive")}</div>` : "") +
              (hasClear ? `<div class="smart-cost-clear-row"><button class="smart-cost-clear-btn" data-entity="${clearId}">✕ ${this._t("smartCostClear")}</button></div>` : "") +
              `</div>`;
          })() : ""}
        </div>
      </div>`;
  },

  _sliderOptions(entityId) {
    return (attr(this._hass, entityId, "options") ?? [])
      .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
  },

  // The user-facing value behind a range input: select-backed sliders carry an
  // option index, number sliders carry the value itself.
  _sliderValueFor(input) {
    if (input.dataset.domain !== "select") return input.value;
    const opts = this._sliderOptions(input.dataset.entity);
    if (opts.length === 0) return input.value;
    const idx = Math.min(Math.max(Math.round(parseFloat(input.value)) || 0, 0), opts.length - 1);
    return String(opts[idx]);
  },

  _sliderRow(entityId, label, zeroLabel = null) {
    const domain  = entityId.split(".")[0];
    const _v      = parseFloat(stateVal(this._hass, entityId));
    const val     = isNaN(_v) ? 0 : _v;
    const unit    = displayUnit(this._hass, entityId);
    let min, max, step, sliderVal;

    if (domain === "select") {
      // Select-backed sliders walk option INDEXES, not values: ha-evcc option
      // lists are not uniform (min_current offers 0.125/0.25/0.5 A besides the
      // 1 A grid since 2026.8.9), so a value-based step would create hundreds
      // of slider positions that don't exist as options.
      const opts = this._sliderOptions(entityId);
      min  = 0;
      max  = Math.max(opts.length - 1, 0);
      step = 1;
      // For the same reason `slider_steps` cannot apply here. Where ha-evcc
      // exposes a feature as a select, a configured step would have to mean
      // "every n-th option", which is not what the config asks for. Say so
      // once instead of ignoring the entry without a word.
      this._warnSliderStepIgnored(entityId);
      sliderVal = opts.length
        ? opts.reduce((best, o, i) => Math.abs(o - val) < Math.abs(opts[best] - val) ? i : best, 0)
        : 0;
    } else {
      min  = attr(this._hass, entityId, "min")  ?? 0;
      max  = attr(this._hass, entityId, "max")  ?? 100;
      // `slider_steps: { smart_cost_limit: 0.01 }` overrides the entity's own step.
      step = this._sliderStepOverride(entityId) ?? (attr(this._hass, entityId, "step") ?? 1);
      sliderVal = val;
    }

    // The value doubles as a tap target that opens the direct-input panel
    // (see _openSliderEdit); it must stay the range input's next sibling
    // because the live "input" handler updates it by that relation.
    return `
      <div class="slider-row">
        <label>${label}</label>
        <div class="slider-control">
          <input type="range"
                 min="${min}" max="${max}" step="${step}" value="${sliderVal}"
                 data-entity="${entityId}"
                 data-domain="${domain}" />
          <button type="button" class="slider-val" data-slider-edit
                  title="${this._t("sliderEditHint")}">${zeroLabel && val === 0 ? zeroLabel : `${val} ${escHtml(unit)}`}</button>
        </div>
      </div>`;
  },

  // Optional per-feature step override from the card config, keyed by the
  // ha-evcc feature key: `slider_steps: { smart_cost_limit: 0.01, limit_soc: 5 }`.
  // The key is matched against the feature the entity was discovered under, not
  // against the tail of its id, so `soc` cannot steer `min_soc` and `limit_soc`
  // at once. Only meaningful for number-backed sliders; select-backed ones walk
  // options (see _warnSliderStepIgnored).
  _sliderStepOverride(entityId) {
    const key = this._sliderStepKey(entityId);
    if (!key) return null;
    const step = parseFloat(this._config.slider_steps[key]);
    return step > 0 ? step : null;
  },

  // The `slider_steps` key that applies to this entity, or null.
  _sliderStepKey(entityId) {
    const steps = this._config?.slider_steps;
    if (!steps || typeof steps !== "object") return null;
    const key = featureKeyOf(entityId, this._getPrefix());
    return key && Object.prototype.hasOwnProperty.call(steps, key) ? key : null;
  },

  // A step configured for a select-backed slider never takes effect. Warn once
  // per key and value, so the config change is visible in the console too.
  _warnSliderStepIgnored(entityId) {
    const key = this._sliderStepKey(entityId);
    if (!key) return;
    const seen = this._warnedSliderSteps ??= new Set();
    const mark = `${key}=${this._config.slider_steps[key]}`;
    if (seen.has(mark)) return;
    seen.add(mark);
    console.warn(`[evcc-card] slider_steps.${key} is ignored: ha-evcc provides ${entityId} as a select, `
      + "and that slider walks the option list. slider_steps only applies to number entities.");
  },

  _sliderWrite(entityId, domain, value) {
    if (domain === "select") {
      if (this._sliderOptions(entityId).length === 0) return;
      this._setSelectOption(entityId, String(value));
    } else {
      this._setNumberValue(entityId, value);
    }
  },

  // ── Slider direct input ──────────────────────────────────────────────
  // Tapping the value next to a slider opens a touch-sized row below it:
  // [−] [ value unit ] [+] [apply] [cancel] (SVG icons). −/+ walk the slider step (or the next
  // select option), the field takes an exact value (comma or dot), ✓/Enter
  // writes, ✕/Escape discards. One panel at a time; hass updates are deferred
  // while it is open, exactly like during a drag.
  // `local` (optional) describes a slider that does not go through _sliderWrite,
  // e.g. the charge-plan target or battery boost: { unit, value, onApply(value),
  // format?(value) → label }. Entity sliders derive everything from the range
  // input's data attributes and write via _sliderWrite.
  _openSliderEdit(btn, local = null) {
    this._closeSliderEdit();
    const input = btn.previousElementSibling;
    const row   = btn.closest(".slider-row, .plan-row");
    if (!input || !row || input.type !== "range") return;

    const entityId = local ? null : input.dataset.entity;
    const domain   = local ? "number" : input.dataset.domain;
    const unit     = local ? (local.unit ?? "") : displayUnit(this._hass, entityId);
    const opts     = domain === "select" ? this._sliderOptions(entityId) : [];
    const min      = parseFloat(input.min), max = parseFloat(input.max);
    const step     = parseFloat(input.step) || 1;
    const decimals = domain === "select" ? 3 : stepDecimals(step);
    const raw      = local ? parseFloat(local.value) : parseFloat(stateVal(this._hass, entityId));
    let cur        = !isNaN(raw) ? raw : (domain === "select" ? (opts[0] ?? 0) : min);

    const panel = document.createElement("div");
    panel.className = "slider-edit";
    panel.innerHTML = `
      <button type="button" class="slider-edit-btn" data-edit-dec aria-label="−"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19,13H5V11H19V13Z"/></svg></button>
      <div class="slider-edit-field">
        <input type="text" inputmode="decimal" class="slider-edit-input" autocomplete="off" spellcheck="false" />
        <span class="slider-edit-unit">${escHtml(unit)}</span>
      </div>
      <button type="button" class="slider-edit-btn" data-edit-inc aria-label="+"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/></svg></button>
      <button type="button" class="slider-edit-btn slider-edit-ok" data-edit-ok
              title="${this._t("sliderEditApply")}" aria-label="${this._t("sliderEditApply")}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z"/></svg></button>
      <button type="button" class="slider-edit-btn slider-edit-cancel" data-edit-cancel
              title="${this._t("sliderEditCancel")}" aria-label="${this._t("sliderEditCancel")}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg></button>`;
    row.appendChild(panel);
    btn.classList.add("editing");
    this._sliderEditing   = true;
    this._sliderEditPanel = panel;

    // Any click elsewhere on the page dismisses the panel. Inside the card a tab
    // switch or the gear toggle (both only flip `hidden`, no re-render) would
    // otherwise leave the panel open in a hidden section; outside the card
    // nothing else ever closes it, and an open panel keeps hass updates deferred
    // for as long as it lives. Listening on the document covers both (the
    // composed path still names the shadow nodes). Runs in the capture phase so
    // the click still reaches its own target; a pending re-render is deferred
    // past the click for the same reason. A hidden tab (phone lock, app switch)
    // closes the panel too, so the card is live again when it comes back.
    this._sliderEditOutside = (e) => {
      const path = e.composedPath();
      if (path.includes(panel) || path.includes(btn)) return;
      this._closeSliderEdit(true);
    };
    this._sliderEditHidden = () => { if (document.hidden) this._closeSliderEdit(); };
    document.addEventListener("click", this._sliderEditOutside, true);
    document.addEventListener("visibilitychange", this._sliderEditHidden);

    const field = panel.querySelector(".slider-edit-input");
    const parse = () => parseFloat(String(field.value).trim().replace(",", "."));
    const snap  = v => {
      if (isNaN(v)) return cur;
      if (domain === "select") {
        return opts.length ? opts.reduce((b, o) => Math.abs(o - v) < Math.abs(b - v) ? o : b, opts[0]) : v;
      }
      const clamped = Math.min(Math.max(v, min), max);
      return Number((Math.round((clamped - min) / step) * step + min).toFixed(decimals));
    };
    const show  = () => { field.value = fmtNum(cur, decimals); };
    const nudge = dir => {
      if (domain === "select") {
        const i = opts.indexOf(snap(parse()));
        cur = opts[Math.min(Math.max((i < 0 ? 0 : i) + dir, 0), opts.length - 1)] ?? cur;
      } else {
        cur = snap(snap(parse()) + dir * step);
      }
      show();
    };
    const apply = () => {
      cur = snap(parse());
      // Reflect immediately; for entity sliders the next hass update re-renders anyway.
      input.value     = domain === "select" ? String(Math.max(opts.indexOf(cur), 0)) : String(cur);
      btn.textContent = local?.format ? local.format(cur) : `${fmtNum(cur, decimals)} ${unit}`;
      if (local) local.onApply?.(cur);
      else       this._sliderWrite(entityId, domain, cur);
      this._closeSliderEdit();
    };
    show();

    panel.querySelector("[data-edit-dec]").addEventListener("click", () => nudge(-1));
    panel.querySelector("[data-edit-inc]").addEventListener("click", () => nudge(+1));
    panel.querySelector("[data-edit-ok]").addEventListener("click", apply);
    panel.querySelector("[data-edit-cancel]").addEventListener("click", () => this._closeSliderEdit());
    field.addEventListener("keydown", e => {
      if (e.key === "Enter")       { e.preventDefault(); apply(); }
      else if (e.key === "Escape") { e.preventDefault(); this._closeSliderEdit(); }
    });
    field.focus();
    field.select();
  },

  _closeSliderEdit(deferRender = false) {
    const panel = this._sliderEditPanel;
    if (panel) {
      panel.parentNode?.querySelector(".slider-val.editing")?.classList.remove("editing");
      panel.remove();
    }
    this._sliderEditPanel = null;
    this._dropSliderEditOutside();
    if (this._sliderEditing) {
      this._sliderEditing = false;
      if (this._pendingRender) {
        if (deferRender) {
          // The click that closed this panel may open another one before the
          // timeout runs; the flag then stays set and closing that panel renders.
          setTimeout(() => {
            if (this._sliderEditing || !this._pendingRender) return;
            this._pendingRender = false;
            this._render();
          }, 0);
        } else {
          this._pendingRender = false;
          this._render();
        }
      }
    }
  },

  _dropSliderEditOutside() {
    if (this._sliderEditOutside) {
      document.removeEventListener("click", this._sliderEditOutside, true);
      this._sliderEditOutside = null;
    }
    if (this._sliderEditHidden) {
      document.removeEventListener("visibilitychange", this._sliderEditHidden);
      this._sliderEditHidden = null;
    }
  },

  _boostCommit(input) {
    this._isDragging = false;
    const val      = parseInt(input.value, 10);
    const entityId = input.dataset.boostEntity;

    this._boostPending = { entityId, val, ts: Date.now() };
    const options = JSON.parse(input.dataset.options || "[]");
    const numOpts = options.map(o => parseInt(o)).filter(o => !isNaN(o));
    const nearest = numOpts.reduce((p, c) =>
      Math.abs(c - val) < Math.abs(p - val) ? c : p, numOpts[0] ?? val);
    this._setSelectOption(entityId, String(nearest));

    if (this._pendingRender) { this._pendingRender = false; this._render(); }
  },

  _renderBatteryBoost(ents) {
    if (!ents.battery_boost_limit) return "";

    const limitId  = ents.battery_boost_limit;
    const current  = stateVal(this._hass, limitId);
    const options  = this._hass.states[limitId]?.attributes?.options ?? [];
    const pctOpts  = options.map(o => parseInt(o)).filter(o => !isNaN(o)).sort((a, b) => a - b);
    const min      = pctOpts[0] ?? 0;
    const max      = pctOpts[pctOpts.length - 1] ?? 100;
    const step     = pctOpts.length > 1 ? (pctOpts[1] - pctOpts[0]) : 5;
    const limitPct = (!current || current === "unknown") ? 100 : parseInt(current);
    let   curPct   = limitPct;
    if (this._boostPending && this._boostPending.entityId === limitId &&
        Date.now() - this._boostPending.ts < 2500) {
      curPct = this._boostPending.val;
    }
    const label    = curPct === 100 ? this._t("toggleOff") : curPct === 0 ? `0 % (${this._t("fullDischarge")})` : `${curPct} %`;
    return `
      <div class="slider-row">
        <label>${this._t("batteryBoost")}</label>
        <div class="slider-control">
          <input type="range"
                 min="${min}" max="${max}" step="${step}" value="${curPct}"
                 data-boost-entity="${limitId}"
                 data-options='${escAttr(JSON.stringify(options))}' />
          <button type="button" class="slider-val boost-val" data-boost-edit
                  title="${this._t("sliderEditHint")}">${label}</button>
        </div>
      </div>`;
  },

  // Listeners of the sliders: the battery boost range with its direct input,
  // the clear button of the smart cost limits, every other range (drag,
  // keyboard, write-back) and the tap target that opens the direct input.
  // Called by _attachListeners() after every render.
  _attachSliderListeners() {
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

    this.shadowRoot.querySelectorAll("button.smart-cost-clear-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this._pressButton(btn.dataset.entity);
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
        this._sliderWrite(entityId, domain, domain === "select" ? this._sliderValueFor(input) : parseFloat(input.value));
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
      // The value at the first keydown is the reference (key repeat fires
      // keydown again, keyup once): a key that moved nothing, e.g. at a bound
      // of the range, causes no write.
      const NAV_KEYS = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"];
      let keyStart = null;
      input.addEventListener("keydown", (e) => {
        if (NAV_KEYS.includes(e.key) && keyStart === null) keyStart = input.value;
      });
      input.addEventListener("keyup", (e) => {
        if (!NAV_KEYS.includes(e.key)) return;
        const unchanged = keyStart !== null && keyStart === input.value;
        keyStart = null;
        if (unchanged) return;
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
  },
};

// Sliders, the direct-input panel and the charge settings block.
// Part of the card stylesheet, see src/styles.js.
const sliderCss = `
      .sliders { margin-bottom: 10px; }
      .slider-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: .83rem; flex-wrap: wrap; }
      .slider-row label { flex: 0 0 auto; min-width: 70px; white-space: nowrap; color: var(--secondary-text-color); }
      .slider-control { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 120px; }
      .slider-control input { flex: 1; min-width: 0; accent-color: var(--primary-color); }
      .slider-val { flex-shrink: 0; min-width: 52px; text-align: right; font-size: .8rem; }
      /* The value is a tap target: same look as before, but a thumb-sized hit
         area (padding + negative margin keeps the row height unchanged). */
      button.slider-val {
        background: none; border: none; font-family: inherit; color: inherit; cursor: pointer;
        padding: 8px 6px; margin: -8px -6px; border-radius: 6px; line-height: 1.2;
        text-decoration: underline dotted; text-decoration-color: var(--secondary-text-color, #888);
        text-underline-offset: 3px; touch-action: manipulation;
      }
      button.slider-val:hover, button.slider-val.editing { color: var(--primary-color); text-decoration-color: currentColor; }
      button.slider-val:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
      /* Direct-input panel: full-width row under the slider, every control ≥44px. */
      .slider-edit { flex: 0 0 100%; display: flex; align-items: center; gap: 8px; margin: 6px 0 2px; }
      .slider-edit-btn {
        flex: 0 0 auto; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center;
        border: 1px solid var(--divider-color, #555); border-radius: 8px; cursor: pointer; font-family: inherit;
        background: var(--secondary-background-color, rgba(127,127,127,0.12)); color: var(--primary-text-color);
        font-size: 1.3rem; line-height: 1; padding: 0; touch-action: manipulation; user-select: none;
      }
      .slider-edit-btn:active { filter: brightness(0.9); }
      .slider-edit-ok     { color: var(--evcc-green); font-weight: 700; }
      .slider-edit-cancel { color: var(--secondary-text-color); }
      .slider-edit-field {
        flex: 1 1 80px; min-width: 64px; min-height: 44px; display: flex; align-items: center; box-sizing: border-box;
        border: 1px solid var(--divider-color, #555); border-radius: 8px; padding: 0 10px;
        background: var(--card-background-color, #fff);
      }
      .slider-edit-field:focus-within { border-color: var(--primary-color); }
      .slider-edit-input {
        flex: 1; min-width: 0; width: 100%; border: none; background: none; outline: none;
        font-family: inherit; font-size: 1.15rem; color: var(--primary-text-color); text-align: right; padding: 0;
      }
      .slider-edit-unit { flex: 0 0 auto; margin-left: 6px; font-size: .9rem; color: var(--secondary-text-color); white-space: nowrap; }
      /* Narrow cards (≈300 px): 4 × 40 px buttons + 4 gaps + a 64 px field still fit the content box. */
      @container (max-width: 340px) {
        .slider-edit { gap: 6px; }
        .slider-edit-btn { min-width: 40px; }
        .slider-edit-field { flex-basis: 64px; min-width: 64px; padding: 0 8px; }
      }
      .smart-active-hint { font-size: .75rem; color: var(--evcc-green); margin-top: -4px; margin-bottom: 8px; }
      .smart-cost-clear-row { display: flex; justify-content: flex-end; margin-top: 6px; margin-bottom: 2px; }
      .smart-cost-clear-btn { background: none; border: 1px solid var(--divider-color, #555); border-radius: 4px; cursor: pointer; font-size: .75rem; color: var(--secondary-text-color); padding: 3px 8px; font-family: inherit; transition: border-color .15s, color .15s; }
      .smart-cost-clear-btn:hover { border-color: var(--evcc-red); color: var(--evcc-red); }
      .smart-cost-chip { display: inline-flex; align-items: center; gap: 3px; font-size: .72rem; color: var(--secondary-text-color); white-space: nowrap; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
      .smart-cost-chip:hover { color: var(--primary-color); }
      .smart-cost-chip.active { color: var(--evcc-green); }
      .smart-cost-chip.active:hover { color: var(--evcc-green); filter: brightness(1.2); }
      .settings-divider { border: none; border-top: 1px solid var(--divider-color, #e5e7eb); margin: 8px 0; }
      @keyframes smart-cost-pulse { 0%,100% { background: transparent; } 40% { background: color-mix(in srgb, var(--primary-color) 15%, transparent); } }
      .smart-cost-highlight { border-radius: 6px; animation: smart-cost-pulse 1.5s ease; }

      .current-block {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 10px; padding-top: 10px; margin-bottom: 10px;
      }
      .block-title-row {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
      }
      .block-title {
        font-size: .7rem; font-weight: 600; text-transform: uppercase;
        letter-spacing: .08em; color: var(--secondary-text-color);
      }
      .current-toggle-btn {
        background: transparent; border: none; border-radius: 50%;
        color: var(--secondary-text-color); cursor: pointer;
        padding: 3px; display: flex; align-items: center; justify-content: center;
        transition: color .15s, background .15s; margin: -3px;
      }
      .current-toggle-btn:hover {
        color: var(--primary-color);
        background: var(--secondary-background-color, rgba(0,0,0,.06));
      }
      .current-toggle-btn.active { color: var(--primary-color); }
      .current-block-body[hidden] { display: none; }

      .selects { margin-bottom: 10px; }
      .select-row { display: flex; justify-content: space-between; align-items: center; font-size: .83rem; margin-bottom: 6px; flex-wrap: wrap; gap: 4px; }
      .phase-btn-group { display: flex; gap: 4px; }
      button.phase-btn {
        padding: 3px 10px; border-radius: 999px; border: 1px solid var(--divider-color);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .75rem; font-weight: 600; transition: all .15s; white-space: nowrap;
      }
      button.phase-btn.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
`;

// Charge plan block with preview chart, plan mode and repeating plans. Methods are mixed into EvccCard.prototype.
const planningView = {
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
        <select class="plan-vehicle-select" data-lp="${escAttr(lpName)}" data-entity="${vehicleEntityId ?? ""}">
          ${allOptions.map(id => `
            <option value="${escAttr(id)}" ${id === defaultVehicle ? "selected" : ""}>${escHtml(dbIdToName[id])}</option>
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
                data-lp="${escAttr(lpName)}">
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
        <select class="plan-precondition-select" data-entity="${preEntityId}" data-lp="${escAttr(lpName)}">
          ${preOptions.map(opt => `
            <option value="${escAttr(opt)}" ${opt === preCurrent ? "selected" : ""}>${fmtPre(opt)}</option>
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
      <div class="plan-block" data-lp="${escAttr(lpName)}">
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
                   value="${defaultDt}" data-lp="${escAttr(lpName)}" />
          </div>
          <div class="plan-row">
            <label>${this._t("targetSoc")}</label>
            <div class="plan-soc-control">
              <input type="range" class="plan-soc-range"
                     min="20" max="100" step="5" value="${defaultSoc}"
                     data-lp="${escAttr(lpName)}" />
              <button type="button" class="slider-val plan-soc-val" data-plan-soc-edit
                      title="${this._t("sliderEditHint")}">${defaultSoc} %</button>
            </div>
          </div>
          ${contHtml}
          ${preHtml}
        </div>
        ${this._renderPlanPreview(lpName)}
        <div class="plan-actions">
          <button class="plan-btn save" data-lp="${escAttr(lpName)}">${this._t("setPlan")}</button>
          ${(planActive || (planTime && planTime !== "unknown" && planTime !== "unavailable"))
            ? `<button class="plan-btn delete" data-lp="${escAttr(lpName)}">${this._t("deletePlan")}</button>`
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
    const unit = isCo2 ? "g CO₂/kWh" : (preview.currency ? `${escHtml(preview.currency)}/kWh` : "");

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
      : `${avgVal.toFixed(2)} ${escHtml(currency)}/kWh`;

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
            <span class="lp-name">${escHtml(this._config.title || lpName)}</span>
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
            <span class="lp-name">${escHtml(name)}</span>
          </div>
          ${this._renderRepeatPlansBlock(g)}
        </div>`;
    }).join("");
  },

  // Listeners of the charge plan block: precondition, target slider with its
  // direct input, time, vehicle, save and delete. Called by _attachListeners()
  // after every render.
  _attachPlanListeners() {
    this.shadowRoot.querySelectorAll("select.plan-precondition-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._setSelectOption(sel.dataset.entity, sel.value);
        if (sel.dataset.lp) this._requestPlanPreview(sel.dataset.lp);
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
          this._setSelectOption(eid, val);
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

        // Only a vehicle evcc knows can be planned from here: its plan is the SoC
        // this block collects. A loadpoint plan is an energy target in kWh, which
        // the card does not ask for yet, and ha-evcc would accept a call without
        // one and do nothing, leaving a plan badge behind for a plan that does
        // not exist. So say it instead of pretending.
        const savePlan = async () => {
          if (!vehicleDbId) { showError(`❌ ${this._t("planNeedsVehicle")}`); return; }
          try {
            await this._setVehiclePlan(vehicleDbId, soc, startdate);
            window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } }));
            showSuccess();
          } catch(e) {
            showError(`❌ ${e?.message || JSON.stringify(e) || "Unknown error"}`);
          }
        };
        savePlan();
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
          this._deleteVehiclePlan(vehicleDbId)
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        } else {
          // Deleting works without a kWh target, it only needs the evcc index.
          const lpIdx = this._lpIndex(lpName);
          if (lpIdx == null) { console.warn("[evcc-card] delete plan: no loadpoint index for", lpName); return; }
          this._deleteLoadpointPlan(lpIdx)
            .then(() => { resetBadge(); window.dispatchEvent(new CustomEvent("evcc-plan-reset", { detail: { lpName } })); })
            .catch(e => console.warn("[evcc-card] delete plan:", e));
        }
      });
    });
  },
};

// Charge plan block, plan mode and repeating plans.
// Part of the card stylesheet, see src/styles.js.
const planCss = `
      .plan-block { border-top: 1px solid var(--divider-color, #e5e7eb); margin-top: 10px; padding-top: 10px; }
      .plan-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .plan-badge { font-size: .7rem; font-weight: 600; padding: 2px 9px; border-radius: 999px; border: 1px solid var(--divider-color); color: var(--secondary-text-color); }
      .plan-badge.planned { background: rgba(0, 120, 180, 0.3); color: #60aaff; }
      .plan-badge.active  { background: color-mix(in srgb, var(--evcc-green) 15%, transparent); color: var(--evcc-green); border-color: var(--evcc-green); }
      .plan-projection { display: flex; flex-direction: column; gap: 3px; font-size: .78rem; color: var(--secondary-text-color); margin-bottom: 10px; padding: 7px 10px; background: var(--secondary-background-color, rgba(0,0,0,.08)); border-radius: 6px; }
      .plan-projection strong { color: var(--primary-text-color); }
      .plan-inputs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px; }
      .plan-row { display: flex; align-items: center; gap: 8px; font-size: .83rem; flex-wrap: wrap; }
      .plan-row label { flex: 0 0 auto; min-width: 60px; white-space: nowrap; color: var(--secondary-text-color); }
      .plan-soc-control { display: flex; align-items: center; gap: 8px; flex: 1; }
      .plan-soc-range { flex: 1; accent-color: var(--primary-color); }
      .plan-soc-val { min-width: 42px; text-align: right; font-size: .8rem; }
      input.plan-time-input { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; color-scheme: dark light; }
      .plan-actions { display: flex; gap: 8px; }
      .plan-btn { flex: 1; padding: 7px 10px; border-radius: 7px; border: 1px solid var(--divider-color); font-size: .8rem; font-weight: 600; cursor: pointer; transition: all .15s; background: transparent; color: var(--primary-text-color); }
      .plan-btn.save { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .plan-btn.save:hover { filter: brightness(1.1); }
      .plan-btn.delete { color: #ef4444; border-color: #ef444466; }
      .plan-btn.delete:hover { background: #ef444422; }
      select.plan-vehicle-select,
      select.plan-precondition-select { flex: 1; padding: 4px 8px; border: 1px solid var(--divider-color, #4b5563); border-radius: 6px; background: var(--card-background-color); color: var(--primary-text-color); font-size: .82rem; }
      .plan-row .toggle { margin-left: auto; }
      .plan-error { margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #ef444422; color: #ef4444; font-size: .78rem; word-break: break-all; }
      .plan-preview { margin: 10px 0 4px; }
      .plan-preview-loading { text-align: center; padding: 12px; font-size: .78rem; color: var(--secondary-text-color); }
      .plan-preview-error, .plan-preview-info { padding: 8px 10px; border-radius: 6px; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); font-size: .78rem; }
      .plan-preview-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
      .plan-preview-left, .plan-preview-right { display: flex; flex-direction: column; }
      .plan-preview-right { text-align: right; }
      .plan-preview-label { font-size: .65rem; text-transform: uppercase; letter-spacing: .03em; color: var(--secondary-text-color); }
      .plan-preview-value { font-size: .88rem; font-weight: 600; color: var(--evcc-green,#22c55e); }
      .rplan-block .plan-header { justify-content: flex-start; gap: 6px; }
      .rplan-hint { display: inline-flex; align-items: center; color: var(--secondary-text-color); cursor: help; }
      .rplan-list { display: flex; flex-direction: column; gap: 8px; }
      .rplan-row { display: flex; flex-direction: column; gap: 6px; padding: 8px 10px; border: 1px solid var(--divider-color); border-radius: 8px; }
      .rplan-days { display: flex; gap: 3px; flex-wrap: wrap; }
      .rplan-day { font-size: .68rem; font-weight: 600; line-height: 1; padding: 4px 5px; border-radius: 5px; min-width: 15px; text-align: center; background: var(--secondary-background-color, rgba(0,0,0,.08)); color: var(--secondary-text-color); border: 1px solid transparent; }
      .rplan-day.on { background: var(--primary-color); color: #fff; }
      .rplan-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .rplan-info { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
      .rplan-field { display: inline-flex; align-items: baseline; gap: 5px; }
      .rplan-label { font-size: .68rem; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
      .rplan-value { font-size: .9rem; font-weight: 600; }
      .rplan-line .toggle { margin-left: auto; }
`;

// Priority mode with drag & drop ordering. Methods are mixed into EvccCard.prototype.
const priorityView = {
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

    root.querySelectorAll(".priority-row").forEach(row => {
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

    const applyBtn = root.querySelector("[data-priority-apply]");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        const visible = this._currentVisible();
        if (visible) this._priorityApply(visible);
      });
    }

    const resetBtn = root.querySelector("[data-priority-reset]");
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
const priorityCss = `
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

// Site mode. Methods are mixed into EvccCard.prototype.
const siteView = {
  _renderSiteBlock(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };
    const kwh = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;

    const nameFromEntity = (entityId) => entityId ? (attr(this._hass, entityId, "title") ?? null) : null;
    const pvSources = _discoverDeviceSources(site, "pv", "power", "energy").map(s => ({
      ...s,
      label: nameFromEntity(site[s.key]) ?? `PV ${s.idx + 1}`,
    }));
    const pvPow = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const pvEnergyIds = pvSources.map(s => site[s.energyKey]).filter(Boolean);
    const pvKwh = pvEnergyIds.length > 0
      ? pvEnergyIds.reduce((sum, id) => sum + (kwh(id) ?? 0), 0)
      : kwh(site.pv_energy);
    const battSources = _discoverDeviceSources(site, "battery", "power", "soc").map(s => ({
      ...s,
      label: nameFromEntity(site[s.key]) ?? `${this._t("battery")} ${s.idx + 1}`,
    }));
    const gridPow = kw(site.grid_power);
    const battPow = kw(site.battery_power);
    const homePow = kw(site.home_power);

    const chargePow = Object.values(loadpoints)
      .reduce((sum, ents) => sum + kw(ents.charge_power), 0);

    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;

    const totalIn  = Math.max(pvPow + battDischPow + bezugPow, 0.001);

    const pvPct      = Math.round(pvPow      / totalIn * 100);
    const battDPct   = Math.round(battDischPow / totalIn * 100);
    const gridInPct  = Math.round(bezugPow   / totalIn * 100);

    const houseOnlyPow = homePow;
    const totalOut = Math.max(houseOnlyPow + chargePow + battChargePow + feedinPow, 0.001);
    const homePct   = Math.round(houseOnlyPow  / totalOut * 100);
    const chargePct = Math.round(chargePow     / totalOut * 100);
    const battCPct  = Math.round(battChargePow / totalOut * 100);
    const feedinPct = Math.round(feedinPow     / totalOut * 100);

    const pvSurplusPow = Math.min(feedinPow, pvPow);
    const pvSelfPow    = Math.max(pvPow - pvSurplusPow, 0);
    const pvSelfPct    = Math.round(pvSelfPow    / totalIn * 100);
    const pvSurplusPct = Math.round(pvSurplusPow / totalIn * 100);

    const fmt     = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const useWatt = Math.max(totalIn, totalOut) < 1;
    const fmtPow  = v => useWatt ? `${Math.round(v * 1000)} W` : `${fmt(v)} kW`;
    const fmtKw   = v => `${fmt(v)} kW`;
    const fmtKwh  = v => v === null ? "–" : `${fmt(v)} kWh`;

    const batterySoc = kwh(site.battery_soc);
    // Lifetime meter readings; kwh() yields null for a missing entity and the
    // matching row below stays hidden.
    const gridKwh    = kwh(site.grid_energy);
    const exportKwh  = kwh(site.grid_return_energy);
    const battCKwh   = kwh(site.battery_energy);
    const battDKwh   = kwh(site.battery_return_energy);

    const hasBatt   = site.battery_power && (battDischPow > 0.05 || battChargePow > 0.05);
    const hasGrid   = bezugPow > 0.05 || feedinPow > 0.05;
    const hasPV     = pvPow > 0.05;
    const hasCharge = chargePow > 0.05;

    const segments = [
      { cls: "seg-pv",         pct: pvSelfPct,    label: fmtPow(pvSelfPow),    color: "var(--evcc-green)",  show: pvSelfPow > 0.05 },
      { cls: "seg-battd",      pct: battDPct,     label: fmtPow(battDischPow), color: "var(--evcc-orange)", show: battDischPow > 0.05 },
      { cls: "seg-pv-surplus", pct: pvSurplusPct, label: fmtPow(pvSurplusPow), color: "var(--evcc-yellow)", show: pvSurplusPow > 0.05 },
      { cls: "seg-gridin",     pct: gridInPct,    label: fmtPow(bezugPow),     color: "var(--evcc-red)",    show: bezugPow > 0.05 },
    ].filter(s => s.pct > 0);

    const segTotal = segments.reduce((s, x) => s + x.pct, 0);
    if (segTotal > 0 && segTotal !== 100) {
      const scale = 100 / segTotal;
      segments.forEach(s => s.pct = Math.round(s.pct * scale));
      const diff = 100 - segments.reduce((s, x) => s + x.pct, 0);
      if (segments.length) segments[segments.length - 1].pct += diff;
    }

    const topLabels = [
      hasPV         ? { icon: "☀️",  val: fmtKw(pvPow),        pct: pvPct / 2 } : null,
      battDischPow > 0.05 ? { icon: "🔋↑", val: fmtKw(battDischPow), pct: pvPct + battDPct / 2 } : null,
      bezugPow > 0.05     ? { icon: "⚡↓", val: fmtKw(bezugPow),     pct: pvPct + battDPct + gridInPct / 2 } : null,
    ].filter(Boolean);

    const bottomSegs = [
      { icon: "🏠",  val: fmtPow(houseOnlyPow), pct: homePct,   show: houseOnlyPow > 0.05 },
      { icon: "🔌",  val: fmtPow(chargePow),     pct: chargePct, show: hasCharge },
      { icon: "🔋",  val: fmtPow(battChargePow), pct: battCPct,  show: battChargePow > 0.05 },
      { icon: "🗼",  val: fmtPow(feedinPow),     pct: feedinPct, show: feedinPow > 0.05 },
    ].filter(s => s.show);

    let cumPct = 0;
    bottomSegs.forEach(s => {
      s.midPct = cumPct + s.pct / 2;
      cumPct += s.pct;
    });

    const SVG_W        = 1000;
    const LABEL_W      = 60;
    const BRACE_TOP_H  = 40;
    const BAR_H        = 48;
    const BRACE_BOT_H  = 40;
    const BAR_Y        = BRACE_TOP_H;
    const BAR_X0       = 0;
    const BAR_X1       = SVG_W - LABEL_W;
    const BAR_W        = BAR_X1 - BAR_X0;
    const SVG_H        = BRACE_TOP_H + BAR_H + BRACE_BOT_H;
    const R            = 5;

    const TOP_TIP_Y    = BAR_Y - BRACE_TOP_H + 10;
    const BOT_TIP_Y    = BAR_Y + BAR_H + BRACE_BOT_H - 10;

    const COL_BRACE    = "currentColor";
    const COL_TEXT     = "currentColor";
    const COL_LABEL    = "currentColor";

    const BRACE_R = 14;
    const BRACE_GAP = 8;
    const bracePath = (x0, x1, barEdgeY, tipY) => {
      const r = Math.min(BRACE_R, Math.abs(tipY - barEdgeY) / 2, (x1 - x0) / 4);
      const startY = tipY < barEdgeY ? barEdgeY - BRACE_GAP : barEdgeY + BRACE_GAP;
      if (tipY < barEdgeY) {
        return [
          `M ${x0} ${startY}`,
          `L ${x0} ${tipY + r}`,
          `A ${r} ${r} 0 0 1 ${x0 + r} ${tipY}`,
          `L ${x1 - r} ${tipY}`,
          `A ${r} ${r} 0 0 1 ${x1} ${tipY + r}`,
          `L ${x1} ${startY}`,
        ].join(" ");
      } else {
        return [
          `M ${x0} ${startY}`,
          `L ${x0} ${tipY - r}`,
          `A ${r} ${r} 0 0 0 ${x0 + r} ${tipY}`,
          `L ${x1 - r} ${tipY}`,
          `A ${r} ${r} 0 0 0 ${x1} ${tipY - r}`,
          `L ${x1} ${startY}`,
        ].join(" ");
      }
    };

    let cumX = BAR_X0;
    const segsWithX = segments.map(s => {
      const w  = Math.round(s.pct / 100 * BAR_W);
      const x0 = cumX;
      const x1 = cumX + w;
      cumX = x1;
      return { ...s, x0, x1, xMid: (x0 + x1) / 2, w };
    });
    if (segsWithX.length) segsWithX[segsWithX.length - 1].x1 = BAR_X1;

    let cumXB = BAR_X0;
    const botSegsWithX = bottomSegs.map(s => {
      const w  = Math.round(s.pct / 100 * BAR_W);
      const x0 = cumXB;
      const x1 = cumXB + w;
      cumXB = x1;
      return { ...s, x0, x1, xMid: (x0 + x1) / 2 };
    });
    if (botSegsWithX.length) botSegsWithX[botSegsWithX.length - 1].x1 = BAR_X1;
    botSegsWithX.forEach(s => { s.xMid = (s.x0 + s.x1) / 2; });

    const barRects = segsWithX.map(s =>
      `<rect x="${s.x0}" y="${BAR_Y}" width="${s.x1 - s.x0}" height="${BAR_H}" fill="${s.color}" />`
    ).join("");

    const barClip = `
      <defs>
        <clipPath id="bar-clip">
          <rect x="${BAR_X0}" y="${BAR_Y}" width="${BAR_W}" height="${BAR_H}" rx="${R}" ry="${R}" />
        </clipPath>
      </defs>
      <g clip-path="url(#bar-clip)">${barRects}</g>`;

    const barDividers = segsWithX.slice(0, -1).map(s =>
      `<line x1="${s.x1}" y1="${BAR_Y}" x2="${s.x1}" y2="${BAR_Y + BAR_H}"
             stroke="rgba(0,0,0,0.20)" stroke-width="2" />`
    ).join("");

    const barLabels = segsWithX.map(s => {
      if (s.w < 40) return "";
      const fs = s.w < 80 ? 18 : 24;
      return `<text x="${s.xMid}" y="${BAR_Y + BAR_H / 2 + (fs === 18 ? 6 : 8)}"
                    text-anchor="middle" font-size="${fs}" font-weight="700"
                    fill="#fff" style="text-shadow:0 1px 3px rgba(0,0,0,0.5)">${escHtml(s.label)}</text>`;
    }).join("");

    const MDI = {
      solar:   "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      battery: "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      tower:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:    "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:      "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      solpan:  "M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z",
      heat:    "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };
    const srcPathMap = { "seg-pv": MDI.solar, "seg-pv-surplus": MDI.solar, "seg-battd": MDI.battery, "seg-gridin": MDI.tower };
    segsWithX.forEach(s => { s.srcPath = srcPathMap[s.cls] || ""; });
    const botPathMap = { "🏠": MDI.home, "🔌": MDI.ev, "🔋": MDI.battery, "🗼": MDI.tower };
    botSegsWithX.forEach(s => { s.mdiPath = botPathMap[s.icon] || ""; });

    const SVG_ICON_HALF = 12;

    const pvSeg      = segsWithX.find(s => s.cls === "seg-pv");
    const battSeg    = segsWithX.find(s => s.cls === "seg-battd");
    const surplusSeg = segsWithX.find(s => s.cls === "seg-pv-surplus");
    const gridSeg    = segsWithX.find(s => s.cls === "seg-gridin");
    const topBraceGroups = [];
    if (battSeg) {
      // Mit Batterie: PV eigene Klammer, Batterie+Einspeisung gemeinsame Klammer
      if (pvSeg) {
        topBraceGroups.push({ x0: pvSeg.x0, x1: pvSeg.x1, xMid: pvSeg.xMid, srcPath: MDI.solar });
      }
      const battGroup = [battSeg, surplusSeg].filter(Boolean);
      if (battGroup.length) {
        topBraceGroups.push({
          x0: battGroup[0].x0, x1: battGroup[battGroup.length - 1].x1,
          xMid: (battGroup[0].x0 + battGroup[battGroup.length - 1].x1) / 2,
          srcPath: MDI.battery,
        });
      }
    } else {
      // Ohne Batterie: PV+Einspeisung gemeinsame Klammer
      const pvGroup = [pvSeg, surplusSeg].filter(Boolean);
      if (pvGroup.length) {
        topBraceGroups.push({
          x0: pvGroup[0].x0, x1: pvGroup[pvGroup.length - 1].x1,
          xMid: (pvGroup[0].x0 + pvGroup[pvGroup.length - 1].x1) / 2,
          srcPath: MDI.solar,
        });
      }
    }
    if (gridSeg) {
      topBraceGroups.push({ x0: gridSeg.x0, x1: gridSeg.x1, xMid: gridSeg.xMid, srcPath: MDI.tower });
    }

    const topBraces = topBraceGroups.map(s => {
      const path  = bracePath(s.x0 + 2, s.x1 - 2, BAR_Y, TOP_TIP_Y);
      const ix = s.xMid - SVG_ICON_HALF, iy = TOP_TIP_Y - SVG_ICON_HALF;
      return `
        <path d="${path}" fill="none"
              style="stroke:var(--primary-text-color,#212121);opacity:0.45"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g transform="translate(${ix},${iy}) scale(1.25)" style="opacity:0.85">
          <path d="${s.srcPath}" style="fill:var(--primary-text-color,#212121)" />
        </g>`;
    }).join("");

    const botBraces = botSegsWithX.map(s => {
      const path  = bracePath(s.x0 + 2, s.x1 - 2, BAR_Y + BAR_H, BOT_TIP_Y);
      const ix = s.xMid - SVG_ICON_HALF, iy = BOT_TIP_Y - SVG_ICON_HALF;
      return `
        <path d="${path}" fill="none"
              style="stroke:var(--primary-text-color,#212121);opacity:0.45"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <g transform="translate(${ix},${iy}) scale(1.25)" style="opacity:0.85">
          <path d="${s.mdiPath}" style="fill:var(--primary-text-color,#212121)" />
        </g>`;
    }).join("");

    const LX = BAR_X1 + 18;
    const sideLabels = `
      <text x="${LX}" y="${TOP_TIP_Y}" text-anchor="start" dominant-baseline="central"
            font-size="19" font-weight="700"
            style="fill:var(--secondary-text-color,#757575)">IN</text>
      <text x="${LX}" y="${BOT_TIP_Y}" text-anchor="start" dominant-baseline="central"
            font-size="19" font-weight="700"
            style="fill:var(--secondary-text-color,#757575)">OUT</text>`;

    const flowBar = `
      <div class="flow-wrap">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%"
             style="display:block;overflow:visible;font-family:inherit">
          ${barClip}
          ${barDividers}
          ${barLabels}
          ${topBraces}
          ${botBraces}
          ${sideLabels}
        </svg>
      </div>
    `;

    const row = (icon, label, sub, pw, pwClass = "", indent = false, entityId = null) => `
      <div class="site-row ${indent ? "site-row-indent" : ""}${entityId ? " site-row-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="site-row-icon">${icon}</span>
        <span class="site-row-label">
          <span class="site-row-name">${escHtml(label)}</span>
          ${sub ? `<span class="site-row-sub">${escHtml(sub)}</span>` : ""}
        </span>
        <span class="site-row-pw ${pwClass}">${fmtPow(pw)}</span>
      </div>`;

    const section = (title, total, rows) => `
      <div class="site-section">
        <div class="site-section-head">
          <span class="site-section-title">${escHtml(title)}</span>
          <span class="site-section-total">${fmtPow(total)}</span>
        </div>
        ${rows}
      </div>`;

    const inTotal  = pvPow + battDischPow + bezugPow;
    const outTotal = homePow + chargePow + battChargePow + feedinPow;

    const lpRows = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow  = kw(ents.charge_power);
        const unit   = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const val    = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        const lpTitle = this._hass?.states[ents.mode]?.attributes?.loadpoint_title ?? lpName;
        const label  = val ? `${lpTitle} – ${val}` : lpTitle;
        const icon   = unit.includes("°")
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z"/></svg>`;
        return row(icon, label, "", lpPow, "site-pw-blue", true, ents.charge_power);
      }).join("");

    const pvRows = pvSources.length > 1
      ? pvSources.map(s => {
          const p = kw(site[s.key]);
          return p > 0.005 ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z\"/></svg>", s.label, "", p, "site-pw-green", true, site[s.key]) : "";
        }).join("")
      : "";

    const battRowIcon = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>";
    const battDischRows = battSources.length > 1
      ? battSources.map(s => {
          const p = kw(site[s.key]);
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          const label = bSoc !== null ? `${s.label} – ${bSoc} %` : s.label;
          return p > 0.05 ? row(battRowIcon, label, "", p, "", true, site[s.key]) : "";
        }).join("")
      : "";
    const battChargeRows = battSources.length > 1
      ? battSources.map(s => {
          const p = kw(site[s.key]);
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          const label = bSoc !== null ? `${s.label} – ${bSoc} %` : s.label;
          return p < -0.05 ? row(battRowIcon, label, "", Math.abs(p), "", true, site[s.key]) : "";
        }).join("")
      : "";

    const inSection = section(this._t("in"), inTotal, [
      row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z\"/></svg>", this._t("generation"), "", pvPow, "site-pw-green", false, site.pv_power),
      pvRows,
      battDischPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>",
              batterySoc !== null ? `${this._t("battDischarge")} – ${Math.round(batterySoc)} %` : this._t("battDischarge"),
              "", battDischPow, "", false, site.battery_power) : "",
      battDischRows,
      bezugPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z\"/></svg>", this._t("gridImport"), "", bezugPow, "", false, site.grid_power) : "",
    ].join(""));

    const outSection = section(this._t("out"), outTotal, [
      row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z\"/></svg>", this._t("consumption"), "", homePow, "", false, site.home_power),
      chargePow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z\"/></svg>", this._t("chargePoint"), "", chargePow, "site-pw-blue") + lpRows : "",
      battChargePow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z\"/></svg>",
              batterySoc !== null ? `${this._t("battCharge")} – ${Math.round(batterySoc)} %` : this._t("battCharge"),
              "", battChargePow, "", false, site.battery_power) : "",
      battChargeRows,
      feedinPow > 0.05
        ? row("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" width=\"14\" height=\"14\" fill=\"currentColor\" style=\"vertical-align:middle\"><path d=\"M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z\"/></svg>", this._t("gridExport"), "", feedinPow, "site-pw-yellow", false, site.grid_power) : "",
    ].join(""));

    const energyRow = (mdiPath, label, v, entityId) => v === null ? "" : `
      <div class="site-row${entityId ? " site-row-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="site-row-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="${mdiPath}"/></svg></span>
        <span class="site-row-label"><span class="site-row-name">${escHtml(label)}</span></span>
        <span class="site-row-pw">${fmtKwh(v)}</span>
      </div>`;
    const energyRows = [
      energyRow(MDI.solar,   this._t("generation"),    pvKwh,     site.pv_energy ?? pvEnergyIds[0]),
      energyRow(MDI.tower,   this._t("gridImport"),    gridKwh,   site.grid_energy),
      energyRow(MDI.tower,   this._t("gridExport"),    exportKwh, site.grid_return_energy),
      energyRow(MDI.battery, this._t("battCharge"),    battCKwh,  site.battery_energy),
      energyRow(MDI.battery, this._t("battDischarge"), battDKwh,  site.battery_return_energy),
    ].join("");
    const energySection = energyRows ? `
          <div class="site-section-gap"></div>
          <div class="site-section">
            <div class="site-section-head">
              <span class="site-section-title">${this._t("energyTotals")}</span>
            </div>
            ${energyRows}
          </div>` : "";

    const siteExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");

    return `
      <div class="site-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("overview"))}</span>
        </div>
        <div class="flow-wrap-clickable" role="button" tabindex="0" data-action="toggle-site"
             title="${siteExpanded ? this._t("siteCollapse") : this._t("siteExpand")}">
          ${flowBar}
        </div>
        <div class="site-table" style="${siteExpanded ? '' : 'display:none'}">
          ${inSection}
          <div class="site-section-gap"></div>
          ${outSection}
          ${energySection}
        </div>
        ${this._renderStatsFooter()}
      </div>`;
  },
};

// Site mode: the flow bar and the IN/OUT detail table, which the flow mode shares.
// Part of the card stylesheet, see src/styles.js.
const siteCss = `
      .site-block { padding: 0; }
      .site-table-hidden { display: none; }
      .flow-wrap-clickable {
        cursor: pointer;
        border-radius: 6px;
        transition: opacity .15s;
      }
      .flow-wrap-clickable:hover { opacity: 0.85; }

      .flow-wrap {
        margin-bottom: 18px;
        padding: 0;
      }
      .flow-wrap svg {
        overflow: visible;
      }
      .flow-overlay {
        color: var(--primary-text-color, #212121);
      }
      .site-table { display: flex; flex-direction: column; }
      .site-section-gap { border-top: 1px solid var(--divider-color, #333); margin: 10px 0 12px; }
      .site-section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--divider-color, #333); }
      .site-section-title { font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: var(--secondary-text-color); }
      .site-section-total { font-size: 1rem; font-weight: 700; }
      .site-row { display: grid; grid-template-columns: 1.4rem 1fr auto; gap: 0 6px; align-items: center; padding: 5px 0; font-size: .78rem; }
      .site-row-clickable { cursor: pointer; border-radius: 4px; }
      .site-row-clickable:hover { background: var(--secondary-background-color, rgba(255,255,255,0.05)); }
      .site-row-icon  { display: flex; align-items: center; justify-content: center; }
      .site-row-label { display: flex; flex-direction: column; gap: 1px; }
      .site-row-name  { font-size: .8rem; }
      .site-row-sub   { font-size: .68rem; color: var(--secondary-text-color); }
      .site-row-pw    { font-weight: 700; font-size: .82rem; min-width: 48px; text-align: right; }
      .site-row-indent { padding-left: 1.2rem; position: relative; }
      .site-row-indent::before {
        content: "└";
        position: absolute;
        left: 0.15rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: .75rem;
        color: var(--secondary-text-color);
        opacity: 0.6;
      }
      .site-row-indent .site-row-icon { opacity: 0.7; }
      .site-row-indent .site-row-name { font-size: .75rem; color: var(--secondary-text-color); }
      .site-row-indent .site-row-pw   { font-size: .78rem; }
      .site-pw-green  { color: #22c55e; }
      .site-pw-blue   { color: #3b82f6; }
      .site-pw-yellow { color: #facc15; }
`;

// Flow mode (Sankey). Methods are mixed into EvccCard.prototype.
const flowView = {
  _renderFlowBlock(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };
    const kwh = id => id ? parseFloat(stateVal(this._hass, id)) || 0 : null;

    const nameFromEntity = (entityId) => entityId ? (attr(this._hass, entityId, "title") ?? null) : null;
    const pvSources = _discoverDeviceSources(site, "pv", "power", "energy").map(s => ({
      ...s,
      label: nameFromEntity(site[s.key]) ?? `PV ${s.idx + 1}`,
    }));
    const pvPow = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const battSources = _discoverDeviceSources(site, "battery", "power", "soc").map(s => ({
      ...s,
      label: nameFromEntity(site[s.key]) ?? `${this._t("battery")} ${s.idx + 1}`,
    }));
    const gridPow = kw(site.grid_power);
    const battPow = kw(site.battery_power);
    const homePow = kw(site.home_power);
    const chargePow = Object.values(loadpoints)
      .reduce((sum, ents) => sum + kw(ents.charge_power), 0);

    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;

    const batterySoc = kwh(site.battery_soc);

    const fmt     = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const useWatt = Math.max(pvPow + battDischPow + bezugPow, homePow + chargePow + battChargePow + feedinPow) < 1;
    const fmtPow  = v => useWatt ? `${Math.round(v * 1000)} W` : `${fmt(v)} kW`;
    const fmtKw   = v => `${fmt(v)} kW`;
    const fmtKwh  = v => v === null ? "–" : `${fmt(v)} kWh`;

    // --- Source nodes (top) ---
    const sources = [];
    if (pvPow > 0.01)        sources.push({ id: "pv",   label: this._t("generation"),    pow: pvPow,        color: "var(--evcc-green)",  entity: site.pv_power });
    if (battDischPow > 0.01) sources.push({ id: "batt", label: batterySoc !== null ? `${this._t("battDischarge")} ${Math.round(batterySoc)} %` : this._t("battDischarge"), pow: battDischPow, color: "var(--evcc-orange)", entity: site.battery_power });
    if (bezugPow > 0.01)     sources.push({ id: "grid", label: this._t("gridImport"),    pow: bezugPow,     color: "var(--evcc-red)",    entity: site.grid_power });

    // --- Consumer nodes (bottom) ---
    const consumers = [];
    if (homePow > 0.01)       consumers.push({ id: "home",   label: this._t("consumption"),  pow: homePow,       color: "var(--secondary-text-color)", entity: site.home_power });
    // Individual loadpoints
    Object.entries(loadpoints).forEach(([lpName, ents]) => {
      const lpPow = kw(ents.charge_power);
      if (lpPow > 0.01) {
        const unit = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const soc  = ents.vehicle_soc ? Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0) : null;
        const isHeat = unit.includes("°");
        consumers.push({
          id: isHeat ? "heat" : "ev",
          label: lpName,
          pow: lpPow,
          color: "var(--evcc-blue)",
          entity: ents.charge_power,
          sub: soc !== null ? `${soc} ${unit}` : "",
        });
      }
    });
    if (battChargePow > 0.01) consumers.push({ id: "battc",  label: batterySoc !== null ? `${this._t("battCharge")} ${Math.round(batterySoc)} %` : this._t("battCharge"), pow: battChargePow, color: "var(--evcc-orange)", entity: site.battery_power });
    if (feedinPow > 0.01)     consumers.push({ id: "feedin", label: this._t("gridExport"),   pow: feedinPow,     color: "var(--evcc-yellow)",          entity: site.grid_power });

    if (sources.length === 0)   sources.push({ id: "none", label: "–", pow: 0.001, color: "var(--secondary-text-color)", entity: null });
    if (consumers.length === 0) consumers.push({ id: "none", label: "–", pow: 0.001, color: "var(--secondary-text-color)", entity: null });

    const totalSrc = sources.reduce((s, n) => s + n.pow, 0);
    const totalDst = consumers.reduce((s, n) => s + n.pow, 0);

    // --- PV-first flow distribution ---
    // flows[i][j] = power from source i to consumer j
    const flows = sources.map(() => consumers.map(() => 0));

    // Distribute PV first, then battery, then grid
    const srcOrder = ["pv", "batt", "grid", "none"];
    const sortedSrcIdx = [...sources.keys()].sort((a, b) =>
      srcOrder.indexOf(sources[a].id) - srcOrder.indexOf(sources[b].id)
    );

    const remaining = consumers.map(c => c.pow);
    for (const si of sortedSrcIdx) {
      let avail = sources[si].pow;
      for (let ci = 0; ci < consumers.length && avail > 0.001; ci++) {
        const take = Math.min(avail, remaining[ci]);
        if (take > 0.001) {
          flows[si][ci] = take;
          avail -= take;
          remaining[ci] -= take;
        }
      }
    }

    // --- Horizontal Sankey SVG (HA-style with icons) ---
    const MDI_ICON = {
      pv:     "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      batt:   "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      grid:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:   "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:     "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      heat:   "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };
    // Map node id to icon
    const srcIconMap = { pv: MDI_ICON.pv, batt: MDI_ICON.batt, grid: MDI_ICON.grid };
    const dstIconMap = { home: MDI_ICON.home, ev: MDI_ICON.ev, heat: MDI_ICON.heat, battc: MDI_ICON.batt, feedin: MDI_ICON.grid };

    // Short sub-label: SoC for battery nodes (LP nodes already have sub set)
    sources.forEach(s => {
      s.sub = (s.id === "batt" && batterySoc !== null) ? `${Math.round(batterySoc)} %` : "";
    });
    consumers.forEach(c => {
      if (c.sub === undefined) c.sub = (c.id === "battc" && batterySoc !== null) ? `${Math.round(batterySoc)} %` : "";
    });

    const NODE_W = 8;
    const NODE_GAP = 6;
    const ICON_SIZE = 16;
    const LABEL_PAD = 6;
    const FLOW_GAP = 140;
    const SVG_PAD = 4;

    // Compute total heights proportional to power
    const maxH = 120;
    const scaleH = maxH / Math.max(totalSrc, totalDst, 0.001);

    const srcHeights = sources.map(s => Math.max(10, s.pow * scaleH));
    const dstHeights = consumers.map(c => Math.max(10, c.pow * scaleH));

    const srcTotalH = srcHeights.reduce((a, b) => a + b, 0) + (sources.length - 1) * NODE_GAP;
    const dstTotalH = dstHeights.reduce((a, b) => a + b, 0) + (consumers.length - 1) * NODE_GAP;
    const contentH  = Math.max(srcTotalH, dstTotalH, 50);

    // Label area: icon(16) + gap(4) + text(~55) = ~75
    const srcLabelW = 80;
    const dstLabelW = 80;
    const SVG_W = srcLabelW + NODE_W + FLOW_GAP + NODE_W + dstLabelW;
    const SVG_H = contentH + 2 * SVG_PAD;

    const srcX = srcLabelW;
    const dstX = srcLabelW + NODE_W + FLOW_GAP;

    const srcStartY = SVG_PAD + (contentH - srcTotalH) / 2;
    const dstStartY = SVG_PAD + (contentH - dstTotalH) / 2;

    let cumSrcY = srcStartY;
    const srcNodes = sources.map((s, i) => {
      const y = cumSrcY;
      const h = srcHeights[i];
      cumSrcY += h + NODE_GAP;
      return { ...s, x: srcX, y, h, cy: y + h / 2 };
    });

    let cumDstY = dstStartY;
    const dstNodes = consumers.map((c, i) => {
      const y = cumDstY;
      const h = dstHeights[i];
      cumDstY += h + NODE_GAP;
      return { ...c, x: dstX, y, h, cy: y + h / 2 };
    });

    this._spreadSankeyLabels(srcNodes);
    this._spreadSankeyLabels(dstNodes);

    // --- Flow paths ---
    const srcRightOffsets = srcNodes.map(() => 0);
    const dstLeftOffsets  = dstNodes.map(() => 0);
    const flowPaths = [];

    for (let si = 0; si < sources.length; si++) {
      for (let ci = 0; ci < consumers.length; ci++) {
        const f = flows[si][ci];
        if (f < 0.001) continue;

        const sn = srcNodes[si];
        const dn = dstNodes[ci];

        const srcBandH = (f / sn.pow) * sn.h;
        const dstBandH = (f / dn.pow) * dn.h;

        const sy0 = sn.y + srcRightOffsets[si];
        const sy1 = sy0 + srcBandH;
        const dy0 = dn.y + dstLeftOffsets[ci];
        const dy1 = dy0 + dstBandH;

        srcRightOffsets[si] += srcBandH;
        dstLeftOffsets[ci]  += dstBandH;

        const sx = srcX + NODE_W;
        const dx = dstX;
        const cx1 = sx + FLOW_GAP * 0.45;
        const cx2 = dx - FLOW_GAP * 0.45;

        const path = [
          `M ${sx} ${sy0}`,
          `C ${cx1} ${sy0}, ${cx2} ${dy0}, ${dx} ${dy0}`,
          `L ${dx} ${dy1}`,
          `C ${cx2} ${dy1}, ${cx1} ${sy1}, ${sx} ${sy1}`,
          `Z`
        ].join(" ");

        flowPaths.push(`<path d="${path}" fill="${sn.color}" opacity="0.35"/>`);
      }
    }

    // --- Node rects + labels as clickable groups ---
    const svgMdi = (path, x, y, color) =>
      `<g transform="translate(${x},${y}) scale(0.667)"><path d="${path}" fill="${color}"/></g>`;

    const srcGroups = srcNodes.map(s => {
      const iconPath = srcIconMap[s.id] || "";
      const iconX = s.x - LABEL_PAD - ICON_SIZE;
      const iconY = s.labelY - ICON_SIZE / 2;
      const textX = iconX - 4;
      const sub = s.sub ? `
        <text x="${textX}" y="${s.labelY + 12}" text-anchor="end" dominant-baseline="central"
              font-size="9" style="fill:var(--secondary-text-color)">${escHtml(s.sub)}</text>` : "";
      const inner = `
        <rect x="${s.x}" y="${s.y}" width="${NODE_W}" height="${s.h}" rx="3" fill="${s.color}"/>
        ${iconPath ? svgMdi(iconPath, iconX, iconY, s.color) : ""}
        <text x="${textX}" y="${s.labelY - (s.sub ? 2 : 0)}" text-anchor="end" dominant-baseline="central"
              font-size="11" font-weight="700" style="fill:var(--primary-text-color)">${fmtPow(s.pow)}</text>
        ${sub}`;
      return s.entity
        ? `<g data-more-info="${s.entity}" style="cursor:pointer" class="sankey-node">${inner}</g>`
        : inner;
    }).join("");

    const dstGroups = dstNodes.map(d => {
      const iconPath = dstIconMap[d.id] || "";
      const iconX = d.x + NODE_W + LABEL_PAD;
      const iconY = d.labelY - ICON_SIZE / 2;
      const textX = iconX + ICON_SIZE + 4;
      const sub = d.sub ? `
        <text x="${textX}" y="${d.labelY + 12}" text-anchor="start" dominant-baseline="central"
              font-size="9" style="fill:var(--secondary-text-color)">${escHtml(d.sub)}</text>` : "";
      const inner = `
        <rect x="${d.x}" y="${d.y}" width="${NODE_W}" height="${d.h}" rx="3" fill="${d.color}"/>
        ${iconPath ? svgMdi(iconPath, iconX, iconY, d.color) : ""}
        <text x="${textX}" y="${d.labelY - (d.sub ? 2 : 0)}" text-anchor="start" dominant-baseline="central"
              font-size="11" font-weight="700" style="fill:var(--primary-text-color)">${fmtPow(d.pow)}</text>
        ${sub}`;
      return d.entity
        ? `<g data-more-info="${d.entity}" style="cursor:pointer" class="sankey-node">${inner}</g>`
        : inner;
    }).join("");

    const siteExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");

    const chevronX = srcLabelW + NODE_W + FLOW_GAP / 2 - 9;
    const chevronY = SVG_H / 2 - 9;
    const chevronD = siteExpanded
      ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
      : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z";

    const sankeySvg = `
      <div class="sankey-wrap" role="button" tabindex="0" style="cursor:pointer" data-action="toggle-site">
        <svg viewBox="0 0 ${SVG_W} ${SVG_H}" width="100%" preserveAspectRatio="xMidYMid meet"
             style="display:block;overflow:visible;font-family:inherit">
          ${flowPaths.join("")}
          ${srcGroups}
          ${dstGroups}
          <g class="sankey-center-chevron" transform="translate(${chevronX},${chevronY}) scale(0.75)"
             style="fill:var(--primary-text-color);opacity:0.35;pointer-events:none">
            <path d="${chevronD}"/>
          </g>
        </svg>
      </div>
    `;

    // --- MDI icon paths for table ---
    const MDI = {
      solar:   "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
      battery: "M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z",
      tower:   "M11,7.5L9.5,3H14.5L13,7.5H15L18,3H21L15,12H17L21,21H15L12,15L9,21H3L7,12H9L3,3H6L9,7.5H11M12,13.5L13.9,19H10.1L12,13.5Z",
      home:    "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
      ev:      "M19.77,7.23L19.78,7.22L16.06,3.5L15,4.56L17.11,6.67C16.17,7.03 15.5,7.93 15.5,9A2.5,2.5 0 0,0 18,11.5C18.36,11.5 18.69,11.42 19,11.29V18.5A1,1 0 0,1 18,19.5A1,1 0 0,1 17,18.5V14A2,2 0 0,0 15,12H14V5A2,2 0 0,0 12,3H6A2,2 0 0,0 4,5V21H14V13.5H15.5V18.5A2.5,2.5 0 0,0 18,21A2.5,2.5 0 0,0 20.5,18.5V9C20.5,8.31 20.22,7.68 19.77,7.23M18,10A1,1 0 0,1 17,9A1,1 0 0,1 18,8A1,1 0 0,1 19,9A1,1 0 0,1 18,10M12,10H6V5H12V10Z",
      heat:    "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z",
    };

    // --- IN/OUT table ---
    const row = (icon, label, sub, pw, pwClass = "", indent = false, entityId = null) => `
      <div class="site-row ${indent ? "site-row-indent" : ""}${entityId ? " site-row-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="site-row-icon">${icon}</span>
        <span class="site-row-label">
          <span class="site-row-name">${escHtml(label)}</span>
          ${sub ? `<span class="site-row-sub">${escHtml(sub)}</span>` : ""}
        </span>
        <span class="site-row-pw ${pwClass}">${fmtPow(pw)}</span>
      </div>`;

    const section = (title, total, rows) => `
      <div class="site-section">
        <div class="site-section-head">
          <span class="site-section-title">${escHtml(title)}</span>
          <span class="site-section-total">${fmtPow(total)}</span>
        </div>
        ${rows}
      </div>`;

    const inTotal  = pvPow + battDischPow + bezugPow;
    const outTotal = homePow + chargePow + battChargePow + feedinPow;

    const lpRows = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow  = kw(ents.charge_power);
        const unit   = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const val    = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        const lpTitle = this._hass?.states[ents.mode]?.attributes?.loadpoint_title ?? lpName;
        const label  = val ? `${lpTitle} – ${val}` : lpTitle;
        const icon   = unit.includes("°")
          ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="${MDI.heat || "M15,13V5A3,3 0 0,0 12,2A3,3 0 0,0 9,5V13A5,5 0 0,0 12,22A5,5 0 0,0 15,13M12,4A1,1 0 0,1 13,5V14.08C14.16,14.54 15,15.67 15,17A3,3 0 0,1 12,20A3,3 0 0,1 9,17C9,15.67 9.84,14.54 11,14.08V5A1,1 0 0,1 12,4Z"}"/></svg>`
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="var(--secondary-text-color)" style="vertical-align:middle"><path d="${MDI.ev}"/></svg>`;
        return row(icon, label, "", lpPow, "site-pw-blue", true, ents.charge_power);
      }).join("");

    const pvRows = pvSources.length > 1
      ? pvSources.map(s => {
          const p = kw(site[s.key]);
          return p > 0.005 ? row(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="M4,6H20A2,2 0 0,1 22,8V16A2,2 0 0,1 20,18H4A2,2 0 0,1 2,16V8A2,2 0 0,1 4,6M4,8V16H20V8H4M5,9H11V13H5V9M12,9H19V13H12V9M5,14H11V16H5V14M12,14H19V16H12V14Z"/></svg>`, s.label, "", p, "site-pw-green", true, site[s.key]) : "";
        }).join("")
      : "";

    const battRowIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="${MDI.battery}"/></svg>`;
    const battDischRows = battSources.length > 1
      ? battSources.map(s => {
          const p = kw(site[s.key]);
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          const label = bSoc !== null ? `${s.label} – ${bSoc} %` : s.label;
          return p > 0.05 ? row(battRowIcon, label, "", p, "", true, site[s.key]) : "";
        }).join("")
      : "";
    const battChargeRows = battSources.length > 1
      ? battSources.map(s => {
          const p = kw(site[s.key]);
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          const label = bSoc !== null ? `${s.label} – ${bSoc} %` : s.label;
          return p < -0.05 ? row(battRowIcon, label, "", Math.abs(p), "", true, site[s.key]) : "";
        }).join("")
      : "";

    const svgIcon = (path) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="vertical-align:middle"><path d="${path}"/></svg>`;

    const inSection = section(this._t("in"), inTotal, [
      row(svgIcon(MDI.solar), this._t("generation"), "", pvPow, "site-pw-green", false, site.pv_power),
      pvRows,
      battDischPow > 0.05
        ? row(svgIcon(MDI.battery),
              batterySoc !== null ? `${this._t("battDischarge")} – ${Math.round(batterySoc)} %` : this._t("battDischarge"),
              "", battDischPow, "", false, site.battery_power) : "",
      battDischRows,
      bezugPow > 0.05
        ? row(svgIcon(MDI.tower), this._t("gridImport"), "", bezugPow, "", false, site.grid_power) : "",
    ].join(""));

    const outSection = section(this._t("out"), outTotal, [
      row(svgIcon(MDI.home), this._t("consumption"), "", homePow, "", false, site.home_power),
      chargePow > 0.05
        ? row(svgIcon(MDI.ev), this._t("chargePoint"), "", chargePow, "site-pw-blue") + lpRows : "",
      battChargePow > 0.05
        ? row(svgIcon(MDI.battery),
              batterySoc !== null ? `${this._t("battCharge")} – ${Math.round(batterySoc)} %` : this._t("battCharge"),
              "", battChargePow, "", false, site.battery_power) : "",
      battChargeRows,
      feedinPow > 0.05
        ? row(svgIcon(MDI.tower), this._t("gridExport"), "", feedinPow, "site-pw-yellow", false, site.grid_power) : "",
    ].join(""));

    return `
      <div class="site-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("energyFlow") || this._t("overview"))}</span>
        </div>
        ${sankeySvg}
        <div class="site-table" style="${siteExpanded ? '' : 'display:none'}">
          ${inSection}
          <div class="site-section-gap"></div>
          ${outSection}
        </div>
        ${this._renderStatsFooter()}
      </div>`;
  },

  // A Sankey label sits at the centre of its node, which works as long as the
  // bands are thick. They are not when the values are small: a node is at least
  // 10 units high with a 6 unit gap, so two centres can be 16 apart while a
  // label with its sub-line (42 °C under 0.0 kW) needs about 26. The labels
  // then print on top of each other, most visibly on the consumer side where a
  // heating loadpoint and the feed-in meet.
  //
  // So the anchors are pushed apart to the distance the text actually needs,
  // while the nodes and the bands stay exactly where the power says. Labels
  // that already have room keep their centre, which leaves every diagram with
  // thick bands exactly as it was.
  _spreadSankeyLabels(nodes) {
    // Extent of a label around its anchor: the value line is 11 units and
    // centred, the sub-line sits 12 below it at 9 units.
    const up   = n => n.sub ? 7.5 : 5.5;
    const down = n => n.sub ? 16.5 : 5.5;
    const GAP  = 2;

    for (const n of nodes) n.labelY = n.cy;
    if (nodes.length < 2) return;

    for (let i = 1; i < nodes.length; i++) {
      const min = nodes[i - 1].labelY + down(nodes[i - 1]) + GAP + up(nodes[i]);
      if (nodes[i].labelY < min) nodes[i].labelY = min;
    }

    // Everything was pushed downwards, so the stack now hangs below the nodes
    // by as much as the last label moved. Half of that goes back up, which
    // spreads the offset evenly over both ends.
    const shift = (nodes[nodes.length - 1].labelY - nodes[nodes.length - 1].cy) / 2;
    if (shift > 0) for (const n of nodes) n.labelY -= shift;
  },
};

// Flow mode: the Sankey graphic.
// Part of the card stylesheet, see src/styles.js.
const flowCss = `
      .sankey-wrap { padding: 12px 0 8px; }
      .sankey-wrap svg { overflow: visible; }
      .sankey-node { opacity: 1; transition: opacity .15s; }
      .sankey-node:hover { opacity: 0.7; }
      .sankey-center-chevron { transition: opacity .15s; }
      .sankey-wrap:hover .sankey-center-chevron { opacity: 0.7 !important; }
`;

// Grid mode (site2). Methods are mixed into EvccCard.prototype.
const gridView = {
  _renderSiteBlock2(site, loadpoints = {}) {
    const kw = id => {
      if (!id) return 0;
      const raw  = parseFloat(stateVal(this._hass, id)) || 0;
      const unit = unitStr(this._hass, id);
      return unit === "kW" ? raw : raw / 1000;
    };

    const pvSources = _discoverDeviceSources(site, "pv", "power");

    const battSources = _discoverDeviceSources(site, "battery", "power", "soc").map(s => ({
      ...s,
      label: (site[s.key] ? (attr(this._hass, site[s.key], "title") ?? null) : null) ?? `${this._t("battery")} ${s.idx + 1}`,
    }));

    const pvPow         = pvSources.length > 0
      ? pvSources.reduce((sum, s) => sum + kw(site[s.key]), 0)
      : kw(site.pv_power);
    const gridPow       = kw(site.grid_power);
    const battPow       = kw(site.battery_power);
    const homePow       = kw(site.home_power);
    const feedinPow     = gridPow < 0 ? Math.abs(gridPow) : 0;
    const bezugPow      = gridPow > 0 ? gridPow : 0;
    const battDischPow  = battPow > 0 ? battPow : 0;
    const battChargePow = battPow < 0 ? Math.abs(battPow) : 0;

    const totalIn = pvPow + battDischPow + bezugPow;
    const pvShare = totalIn > 0.05 ? Math.round(pvPow / totalIn * 100) : 0;

    const fmt   = v => v < 10 ? v.toFixed(1) : Math.round(v).toString();
    const fmtKw = v => `${fmt(v)} kW`;

    const importing = bezugPow > 0.05;
    const exporting = feedinPow > 0.05;
    const netColor  = importing ? "var(--evcc-red)" : exporting ? "var(--evcc-green)" : "var(--secondary-text-color)";
    const netAbs    = importing ? bezugPow : feedinPow;
    const netValStr = (importing || exporting)
      ? `${importing ? "+" : "−"}${fmtKw(netAbs)}`
      : "–";
    const netLabel  = importing
      ? this._t("gridImport")
      : exporting
        ? this._t("gridExport")
        : this._t("gridNeutral") || "–";

    const pvBadge = pvShare > 0
      ? `<div class="s2-pv-badge">
           <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>
           ${pvShare} % ${this._t("solar")}
         </div>`
      : "";

    const chip = (dot, label, sub, entityId = null) =>
      `<div class="s2-chip${entityId ? " s2-chip-clickable" : ""}"${entityId ? ` data-more-info="${entityId}"` : ""}>
        <span class="s2-chip-dot" style="background:${dot}"></span>
        <span class="s2-chip-name">${escHtml(label)}</span>
        ${sub ? `<span class="s2-chip-sub">${escHtml(sub)}</span>` : ""}
      </div>`;

    const lpChips = Object.entries(loadpoints)
      .filter(([, ents]) => kw(ents.charge_power) > 0.05)
      .map(([lpName, ents]) => {
        const lpPow = kw(ents.charge_power);
        const unit  = ents.vehicle_soc ? unitStr(this._hass, ents.vehicle_soc) : "";
        const soc   = ents.vehicle_soc
          ? `${Math.round(parseFloat(stateVal(this._hass, ents.vehicle_soc)) || 0)} ${unit}`
          : "";
        const lpTitle = this._hass?.states[ents.mode]?.attributes?.loadpoint_title ?? lpName;
        return chip("var(--evcc-blue)", lpTitle, soc ? `${fmtKw(lpPow)} · ${soc}` : fmtKw(lpPow), ents.charge_power);
      }).join("");

    const aggBattSoc = site.battery_soc ? Math.round(parseFloat(stateVal(this._hass, site.battery_soc)) || 0) : null;

    const battDischChips = battSources.length > 1
      ? battSources.flatMap(s => {
          const p = kw(site[s.key]);
          if (p <= 0.05) return [];
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          return [chip("var(--evcc-orange)", s.label, bSoc !== null ? `${fmtKw(p)} · ${bSoc} %` : fmtKw(p), site[s.key])];
        })
      : battDischPow > 0.05 ? [chip("var(--evcc-orange)", this._t("battDischarge"), aggBattSoc !== null ? `${fmtKw(battDischPow)} · ${aggBattSoc} %` : fmtKw(battDischPow), site.battery_power)] : [];

    const battChargeChips = battSources.length > 1
      ? battSources.flatMap(s => {
          const p = kw(site[s.key]);
          if (p >= -0.05) return [];
          const bSoc = site[s.socKey] ? Math.round(parseFloat(stateVal(this._hass, site[s.socKey])) || 0) : null;
          return [chip("var(--evcc-orange)", s.label, bSoc !== null ? `${fmtKw(Math.abs(p))} · ${bSoc} %` : fmtKw(Math.abs(p)), site[s.key])];
        })
      : battChargePow > 0.05 ? [chip("var(--evcc-orange)", this._t("battCharge"), aggBattSoc !== null ? `${fmtKw(battChargePow)} · ${aggBattSoc} %` : fmtKw(battChargePow), site.battery_power)] : [];

    const srcChips = [
      pvPow        > 0.05 ? chip("var(--evcc-green)",  this._t("generation"),    fmtKw(pvPow),    site.pv_power)    : "",
      bezugPow     > 0.05 ? chip("var(--evcc-red)",    this._t("gridImport"),    fmtKw(bezugPow), site.grid_power)  : "",
      ...battDischChips,
    ].filter(Boolean).join("");

    const dstChips = [
      homePow      > 0.05 ? chip("var(--secondary-text-color)", this._t("consumption"), fmtKw(homePow),   site.home_power)  : "",
      lpChips,
      ...battChargeChips,
      feedinPow    > 0.05 ? chip("var(--evcc-yellow)", this._t("gridExport"),   fmtKw(feedinPow), site.grid_power)  : "",
    ].filter(Boolean).join("");

    const section = (labelKey, chips) => chips
      ? `<div class="s2-section">
           <div class="s2-section-label">${this._t(labelKey)}</div>
           <div class="s2-chips">${chips}</div>
         </div>`
      : "";

    return `
      <div class="s2-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("grid"))}</span>
        </div>
        <div class="s2-net">
          <div class="s2-net-label">${this._t("gridStatus")}</div>
          <div class="s2-net-value" style="color:${netColor}">${netValStr}</div>
          <div class="s2-net-status" style="color:${netColor}">${netLabel}</div>
          ${pvBadge}
        </div>
        ${section("generation", srcChips)}
        ${section("consumption", dstChips)}
        ${this._renderStatsFooter()}
      </div>`;
  },
};

// Grid mode.
// Part of the card stylesheet, see src/styles.js.
const gridCss = `
      .s2-net {
        text-align: center; padding: 14px 0 16px;
        border-bottom: 1px solid var(--divider-color, #333); margin-bottom: 14px;
      }
      .s2-net-label {
        font-size: .6rem; font-weight: 700; letter-spacing: .1em;
        text-transform: uppercase; color: var(--secondary-text-color); margin-bottom: 4px;
      }
      .s2-net-value { font-size: 2.2rem; font-weight: 800; line-height: 1; letter-spacing: -.02em; }
      .s2-net-status { font-size: .75rem; font-weight: 600; margin-top: 4px; }
      .s2-pv-badge {
        display: inline-flex; align-items: center; gap: 4px;
        margin-top: 8px; background: rgba(34,197,94,0.12); color: #22c55e;
        border-radius: 20px; padding: 3px 10px; font-size: .68rem; font-weight: 700;
      }
      .s2-section { margin-bottom: 12px; }
      .s2-section-label {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 6px;
      }
      .s2-chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .s2-chip {
        display: inline-flex; align-items: center; gap: 5px;
        background: var(--secondary-background-color, rgba(255,255,255,0.05));
        border-radius: 20px; padding: 5px 11px; font-size: .72rem; font-weight: 600;
        border: 1px solid var(--divider-color, #333);
      }
      .s2-chip-clickable { cursor: pointer; }
      .s2-chip-clickable:hover { opacity: 0.75; }
      .s2-chip-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
      .s2-chip-sub { font-size: .62rem; color: var(--secondary-text-color); font-weight: 400; }
`;

// Statistics from stat_* entities and the HA recorder (fallback without the ha-evcc sessions command). Methods are mixed into EvccCard.prototype.
const statisticsLegacy = {
  _getStatEntityIds(period) {
    const per    = period ?? this._statsPeriod ?? "total";
    const base   = `sensor.${this._getPrefix()}`;
    const find   = id => this._hass?.states[id] ? id : null;
    const sufMap = {
      total:    { kwh: "stat_total_charged_kwh",    solar: "stat_total_solar_percentage",    price: "stat_total_avg_price"    },
      "30d":    { kwh: "stat30_charged_kwh",         solar: "stat30_solar_percentage",         price: "stat30_avg_price"         },
      "365d":   { kwh: "stat365_charged_kwh",        solar: "stat365_solar_percentage",        price: "stat365_avg_price"        },
      thisYear: { kwh: "stat_this_year_charged_kwh", solar: "stat_this_year_solar_percentage", price: "stat_this_year_avg_price" },
    };
    const s = sufMap[per] ?? sufMap.total;
    return {
      kwhId:      find(`${base}${s.kwh}`),
      solarId:    find(`${base}${s.solar}`),
      priceId:    find(`${base}${s.price}`),
      solarKwhId: find(`${base}stat_total_solar_k_wh_template`),
    };
  },

  _renderStatsPeriodTabs(size = "normal") {
    const cur  = this._statsPeriod ?? "total";
    const defs = [
      { key: "30d",      tKey: "statsPeriod30d"      },
      { key: "365d",     tKey: "statsPeriod365d"     },
      { key: "thisYear", tKey: "statsPeriodThisYear" },
      { key: "total",    tKey: "statsPeriodTotal"    },
    ];
    const btns = defs.map(d =>
      `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-period="${d.key}">${this._t(d.tKey)}</button>`
    ).join("");
    return `<div class="stats-period-tabs${size === "small" ? " stats-period-tabs--small" : ""}">${btns}</div>`;
  },

  _maybeRefreshStats() {
    const period = this._statsPeriod ?? "total";
    const age = Date.now() - (this._chartCacheTime[period] ?? 0);
    if (age > 5 * 60 * 1000) {
      this._chartCacheTime[period] = Date.now();
      this._fetchChartData(period);
    }
  },

  async _fetchChartData(period) {
    const { kwhId, solarKwhId } = this._getStatEntityIds("total"); // always use cumulative total entities
    if (!kwhId) return;

    const now   = new Date();
    let startTime, recorderPeriod;

    if (period === "30d") {
      startTime = new Date(now);
      startTime.setDate(startTime.getDate() - 31);
      startTime.setHours(0, 0, 0, 0);
      recorderPeriod = "day";
    } else if (period === "365d") {
      startTime = new Date(now.getFullYear(), now.getMonth() - 14, 1);
      recorderPeriod = "month";
    } else if (period === "thisYear") {
      startTime = new Date(now.getFullYear(), 0, 1);
      recorderPeriod = "month";
    } else { // total
      startTime = new Date(2010, 0, 1);
      recorderPeriod = "month";
    }

    try {
      const ids = [kwhId];
      if (solarKwhId) ids.push(solarKwhId);
      const result = await this._hass.callWS({
        type: "recorder/statistics_during_period",
        start_time: startTime.toISOString(),
        statistic_ids: ids,
        period: recorderPeriod,
        types: ["sum"],
      });
      const stats      = result[kwhId]      ?? [];
      let   solarStats = solarKwhId ? (result[solarKwhId] ?? []) : [];

      // Template sensor exists but has too few data points yet → no solar split until it has history
      // Only count on daily queries (most granular), don't overwrite with monthly bucket counts
      if (recorderPeriod === "day") {
        this._solarDataPoints = solarKwhId ? solarStats.length : null;
      } else if (this._solarDataPoints === undefined) {
        this._solarDataPoints = solarKwhId ? solarStats.length : null;
      }
      if (solarStats.length < 3) solarStats = [];

      const liveKwh      = parseFloat(this._hass.states[kwhId]?.state);
      const liveSolarKwh = solarKwhId ? parseFloat(this._hass.states[solarKwhId]?.state) : NaN;

      if      (period === "30d")      this._chartCache[period] = this._computeDailyDeltas(stats, 30, solarStats, isNaN(liveKwh) ? null : liveKwh, isNaN(liveSolarKwh) ? null : liveSolarKwh);
      else if (period === "365d")     this._chartCache[period] = this._computeMonthlyDeltas(stats, 13, solarStats);
      else if (period === "thisYear") this._chartCache[period] = this._computeThisYearMonthly(stats, solarStats);
      else {
        const yearly = this._computeYearlyTotals(stats, solarStats);
        this._chartCache[period] = yearly.length <= 1
          ? this._computeThisYearMonthly(stats, solarStats)  // only one year of data → show months
          : yearly;
      }

      this._render();
    } catch(e) {
      console.warn("[evcc-card] chart error", e);
    }
  },

  _computeDailyDeltas(stats, days, solarStats = [], liveKwh = null, liveSolarKwh = null) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const prevDay = new Date(day);
      prevDay.setDate(prevDay.getDate() - 1);
      const cur   = byKey[toKey(day)] ?? (i === 0 ? liveKwh : null);
      const prev  = byKey[toKey(prevDay)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const sCur  = solarByKey[toKey(day)] ?? (i === 0 ? liveSolarKwh : null);
      const sPrev = solarByKey[toKey(prevDay)];
      const solarDelta = (sCur != null && sPrev != null) ? Math.max(0, sCur - sPrev) : null;
      const labelStr = day.toLocaleDateString(lang, { day: "numeric", month: "numeric" });
      result.push({ delta, solarDelta, label: day, labelStr, isCurrent: i === 0 });
    }
    return result;
  },

  _computeMonthlyDeltas(stats, count, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const result = [];
    for (let i = count - 1; i >= 0; i--) {
      const month     = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      const cur   = byKey[toKey(month)];
      const prev  = byKey[toKey(prevMonth)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const sCur  = solarByKey[toKey(month)];
      const sPrev = solarByKey[toKey(prevMonth)];
      const solarDelta = (sCur != null && sPrev != null) ? Math.max(0, sCur - sPrev) : null;
      const labelStr = month.toLocaleDateString(lang, { month: "short" });
      result.push({ delta, solarDelta, label: month, labelStr, isCurrent: i === 0 });
    }
    return result;
  },

  _computeThisYearMonthly(stats, solarStats = []) {
    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const now  = new Date();
    const year = now.getFullYear();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const result = [];
    for (let m = 0; m <= now.getMonth(); m++) {
      const month     = new Date(year, m, 1);
      const prevMonth = new Date(year, m - 1, 1);
      const cur   = byKey[toKey(month)];
      const prev  = byKey[toKey(prevMonth)];
      const delta = (cur != null && prev != null) ? Math.max(0, cur - prev) : null;
      const sCur  = solarByKey[toKey(month)];
      const sPrev = solarByKey[toKey(prevMonth)];
      const solarDelta = (sCur != null && sPrev != null) ? Math.max(0, sCur - sPrev) : null;
      const labelStr = month.toLocaleDateString(lang, { month: "short" });
      result.push({ delta, solarDelta, label: month, labelStr, isCurrent: m === now.getMonth() });
    }
    return result;
  },

  _computeYearlyTotals(stats, solarStats = []) {
    const now = new Date();
    const toKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}`; };
    const byKey = {};
    stats.forEach(s => { byKey[toKey(s.start)] = s.sum; });
    const solarByKey = {};
    solarStats.forEach(s => { solarByKey[toKey(s.start)] = s.sum; });
    const years = [...new Set(stats.map(s => new Date(s.start).getFullYear()))].sort();
    return years.map(year => {
      let yearTotal = 0, hasAny = false;
      let solarTotal = 0, hasSolar = false;
      for (let m = 0; m <= 11; m++) {
        const cur  = byKey[`${year}-${m}`];
        const prev = byKey[m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`];
        if (cur != null && prev != null) { yearTotal += Math.max(0, cur - prev); hasAny = true; }
        const sCur  = solarByKey[`${year}-${m}`];
        const sPrev = solarByKey[m === 0 ? `${year - 1}-11` : `${year}-${m - 1}`];
        if (sCur != null && sPrev != null) { solarTotal += Math.max(0, sCur - sPrev); hasSolar = true; }
      }
      return {
        delta:      hasAny   ? yearTotal  : null,
        solarDelta: hasSolar ? solarTotal : null,
        label: new Date(year, 0, 1), labelStr: String(year), isCurrent: year === now.getFullYear(),
      };
    });
  },

  _renderBarChart(data) {
    const ML = 22, MR = 6, MT = 20, MB = 18;
    const W = 280, H = 110;
    const CW = W - ML - MR, CH = H - MT - MB;
    const n = data.length;
    const GAP = n > 20 ? 1 : 2;
    // Uniform bar width; center the bar group within CW
    const bw     = Math.floor((CW - GAP * (n - 1)) / n);
    const offset = Math.round((CW - (bw * n + GAP * (n - 1))) / 2);
    const barX0  = i => ML + offset + i * (bw + GAP);
    const barX1  = i => barX0(i) + bw;
    const maxVal = Math.max(...data.map(d => d.delta ?? 0), 0.1);

    // Nice Y-axis: round step up to 1/2/5/10/20/50… then derive tick count
    const rawStep  = maxVal / 5;
    const stepExp  = Math.floor(Math.log10(Math.max(rawStep, 0.001)));
    const stepBase = Math.pow(10, stepExp);
    const stepF    = rawStep / stepBase;
    const tickStep = (stepF <= 1 ? 1 : stepF <= 2 ? 2 : stepF <= 5 ? 5 : 10) * stepBase;
    const numTicks = Math.ceil(maxVal / tickStep);
    const niceMax  = tickStep * numTicks;
    const toY = v => MT + CH - Math.round((v / niceMax) * CH);

    // Grid lines + Y-axis labels (labels left-external, right-aligned)
    const grid = Array.from({ length: numTicks + 1 }, (_, i) => {
      const v = i * tickStep;
      const y = toY(v);
      const lbl = tickStep >= 1 ? Math.round(v) : v.toFixed(1);
      return `<line x1="${ML}" y1="${y}" x2="${W - MR}" y2="${y}"
                stroke="var(--divider-color,#374151)" stroke-width="${i === 0 ? 1 : 0.5}"
                opacity="${i === 0 ? 0.9 : 0.35}"/>
              <text x="${ML - 3}" y="${y + 3}" text-anchor="end" font-size="6.5"
                fill="var(--secondary-text-color,#888)">${lbl}</text>`;
    }).join("");

    // "kWh" above the topmost tick, like HA
    const kwhLbl = `<text x="${ML - 3}" y="${MT - 8}" text-anchor="end" font-size="6.5"
      fill="var(--secondary-text-color,#888)">kWh</text>`;

    // X-axis label spacing
    const showEvery = n > 15 ? Math.ceil(n / 7) : 1;

    const bars = data.map((d, i) => {
      const x0        = barX0(i);
      const x1        = barX1(i);
      const cx        = (x0 + x1) / 2;
      const isCurrent = d.isCurrent ?? (i === n - 1);
      const opacity   = isCurrent ? "0.9" : "0.55";
      const R         = bw >= 4 ? 1.5 : 0;

      let barRect = "";
      if (d.delta != null && d.delta > 0) {
        const totalPx = Math.max(2, Math.round((d.delta / niceMax) * CH));
        const topY    = toY(d.delta);
        const hasSolar = d.solarDelta != null && d.solarDelta > 0;
        if (hasSolar) {
          const solarPx = Math.min(totalPx, Math.round((d.solarDelta / d.delta) * totalPx));
          const gridPx  = totalPx - solarPx;
          barRect =
            (solarPx > 0 ? `<rect x="${x0}" y="${topY}"            width="${bw}" height="${solarPx}" fill="var(--evcc-green,#22c55e)"    opacity="${opacity}" rx="${R}"/>` : "") +
            (gridPx  > 0 ? `<rect x="${x0}" y="${topY + solarPx}"  width="${bw}" height="${gridPx}"  fill="var(--primary-color,#3b82f6)" opacity="${opacity}" rx="${R}"/>` : "");
        } else {
          barRect = `<rect x="${x0}" y="${topY}" width="${bw}" height="${totalPx}"
            fill="var(--primary-color,#3b82f6)" opacity="${opacity}" rx="${R}"/>`;
        }
      }

      const showLabel = (i % showEvery === 0) || i === n - 1;
      const labelSvg  = showLabel
        ? `<text x="${cx}" y="${H - MB + 12}" text-anchor="middle" font-size="6.5"
             fill="var(--secondary-text-color,#888)" opacity="${isCurrent ? "1" : "0.75"}">${d.labelStr}</text>`
        : "";

      const hitRect = `<rect class="evcc-bar" x="${x0}" y="${MT}" width="${bw}" height="${CH}"
        fill="transparent" style="cursor:pointer"
        data-label="${escAttr(d.labelStr)}"
        data-total="${d.delta != null ? d.delta.toFixed(1) : ""}"
        data-solar="${d.solarDelta != null ? d.solarDelta.toFixed(1) : ""}"/>`;

      return `${barRect}${hitRect}${labelSvg}`;
    }).join("");

    return `<div class="evcc-chart-wrap">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">
        ${grid}${kwhLbl}${bars}
      </svg>
      <div class="evcc-chart-tooltip" hidden></div>
    </div>`;
  },

  _renderStatsBlockEntities() {
    this._maybeRefreshStats();
    const { kwhId, solarId, priceId } = this._getStatEntityIds();

    const val = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const kwh   = val(kwhId);
    const solar = val(solarId);
    const price = val(priceId);

    const kpi = (v, label, fmt, color) => `
      <div class="stats-kpi">
        <div class="stats-kpi-val"${color ? ` style="color:${color}"` : ""}>${v !== null ? fmt(v) : "–"}</div>
        <div class="stats-kpi-lbl">${label}</div>
      </div>`;

    const kpis = [
      kpi(kwh,   this._t("statsTotalCharged"), v => `${Math.round(v)} kWh`, null),
      kpi(solar, this._t("statsSolarShare"),   v => `${Math.round(v)} %`,   solar > 0 ? "var(--evcc-green)" : null),
      kpi(price, this._t("statsAvgPrice"),     v => `${v.toFixed(2)} ${escHtml(unitStr(this._hass, priceId))}`, null),
    ].join("");

    const { kwhId: chartKwhId } = this._getStatEntityIds("total");
    const period     = this._statsPeriod ?? "total";
    const chartData  = this._chartCache[period];
    const chartTitle = this._t({ "30d": "statsPeriod30d", "365d": "statsPeriod365d", "thisYear": "statsPeriodThisYear", "total": "statsPeriodTotal" }[period]);
    const chart = chartKwhId ? `
      <div class="stats-chart-section">
        <div class="stats-chart-title">${chartTitle}</div>
        ${chartData
          ? this._renderBarChart(chartData)
          : '<div class="stats-chart-loading">…</div>'}
      </div>` : "";

    const noDataHint = (!kwhId && !solarId && !priceId && this._statsPeriod !== "total")
      ? `<div class="stats-no-data">${this._t("statsNoData")} <a class="stats-no-data-link" href="https://github.com/mkshb/hass-evcc-card#enabling-stat-periods" target="_blank" rel="noopener">📖 ${this._t("statsNoDataLink")}</a></div>`
      : "";

    const lang = (this._config?.language || this._hass?.language || "de").split("-")[0];
    const solarHint = (this._solarDataPoints != null && this._solarDataPoints < 3)
      ? `<div class="stats-solar-hint">${this._t("solarHint", { n: this._solarDataPoints })}</div>`
      : "";

    return `
      <div>
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("statistics"))}</span>
        </div>
        ${this._renderStatsPeriodTabs()}
        ${noDataHint}
        <div class="stats-kpi-row">${kpis}</div>
        ${chart}
        ${solarHint}
      </div>`;
  },
};

// Statistics from evcc_intg/sessions (EVCC-style header, stacked chart) plus the stats dispatchers. Methods are mixed into EvccCard.prototype.
const statisticsView = {
  // ---- Sessions-based statistics (ha-evcc evcc_intg/sessions) -------------
  // The raw session list lets the card compute every period + KPI itself, so
  // the stats mode no longer depends on user-configured stat_* template sensors
  // or HA-Recorder delta reconstruction. Gated on _hasCmd("sessions"); older
  // integrations keep the entity/Recorder path below.

  _sessionDate(s) {
    const raw = s?.created || s?.finished;
    if (!raw) return null;
    return evccDate(raw);
  },

  _statsLang() { return (this._config?.language || this._hass?.language || "de").split("-")[0]; },

  // Earliest/latest session date — bounds the month/year stepper.
  _sessionRange(sessions) {
    let min = null, max = null;
    for (const s of sessions) {
      const d = this._sessionDate(s);
      if (!d) continue;
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
    return { min, max };
  },

  // Scope = the active stats window: month / year / total.
  _sessionInScope(d, scope) {
    if (scope.kind === "month") return d.getFullYear() === scope.year && d.getMonth() === scope.month;
    if (scope.kind === "year")  return d.getFullYear() === scope.year;
    return true; // total
  },

  _scopeKey(scope) {
    return scope.kind === "month" ? `m${scope.year}-${scope.month}`
         : scope.kind === "year"  ? `y${scope.year}` : "total";
  },

  // Active scope for the stats block, from the scope tab + stepper selection
  // (lazily defaulting to the most recent month/year present in the data).
  _statsScopeObj(sessions) {
    const tab = this._statsScope ?? "month";
    if (tab === "total") return { kind: "total" };
    const ref = this._sessionRange(sessions).max ?? new Date();
    if (this._statsYearSel  == null) this._statsYearSel  = ref.getFullYear();
    if (this._statsMonthSel == null) this._statsMonthSel = ref.getMonth();   // 0-based month index
    if (tab === "year") return { kind: "year", year: this._statsYearSel };
    return { kind: "month", year: this._statsYearSel, month: this._statsMonthSel };
  },

  // Footer scope (compact, no stepper): current month / current year / all.
  _footerScope() {
    const p = normalizeStatsPeriod(this._config.stats_period, "total");
    const now = new Date();
    if (p === "month") return { kind: "month", year: now.getFullYear(), month: now.getMonth() };
    if (p === "year")  return { kind: "year",  year: now.getFullYear() };
    return { kind: "total" };
  },

  // Currency symbol for session price values (the sessions response carries none).
  _statsCurrency() {
    const c = this._wsCache["forecast:grid"]?.result?.data?.currency
           ?? this._wsCache["forecast:planner"]?.result?.data?.currency;
    if (c) return c;
    const { priceId } = this._getStatEntityIds("total");
    const u = priceId ? unitStr(this._hass, priceId) : "";
    return u ? u.replace(/\s*\/\s*kwh$/i, "") : "";
  },

  // --- metric + grouping for the EVCC-style stacked chart ------------------
  // Per-session value for the selected metric: energy (kWh) | cost (currency) | co2 (kg).
  _metricVal(s, metric) {
    const e = Number(s.chargedEnergy);
    if (metric === "cost") { const p = Number(s.price); return isFinite(p) ? p : null; }
    if (metric === "co2")  { const c = Number(s.co2PerKWh); return (isFinite(e) && isFinite(c)) ? e * c / 1000 : null; }
    return isFinite(e) ? e : null;
  },

  _metricFmt(metric, currency) {
    if (metric === "cost") return { unit: escHtml(currency || ""), axis: escHtml(currency || ""), fmt: v => v.toFixed(2) };
    if (metric === "co2")  return { unit: "kg", axis: "kg", fmt: v => v >= 10 ? String(Math.round(v)) : v.toFixed(2) };
    return { unit: "kWh", axis: "kWh", fmt: v => v >= 100 ? String(Math.round(v)) : v.toFixed(1) };
  },

  // X-axis skeleton for the scope: bucket key per date + ordered bucket descriptors.
  _scopeAxis(scope, sessions) {
    const lang = this._statsLang(), now = new Date();
    if (scope.kind === "month") {
      const days = new Date(scope.year, scope.month + 1, 0).getDate();
      const buckets = [];
      for (let day = 1; day <= days; day++) {
        const date = new Date(scope.year, scope.month, day);
        buckets.push({ key: day,
          labelStr:  date.toLocaleDateString(lang, { day: "numeric" }),
          labelFull: date.toLocaleDateString(lang, { day: "numeric", month: "short" }),
          isCurrent: scope.year === now.getFullYear() && scope.month === now.getMonth() && day === now.getDate() });
      }
      return { keyOf: d => (d.getFullYear() === scope.year && d.getMonth() === scope.month) ? d.getDate() : null, buckets };
    }
    if (scope.kind === "year") {
      const last = scope.year === now.getFullYear() ? now.getMonth() : 11;
      const buckets = [];
      for (let m = 0; m <= last; m++) {
        const date = new Date(scope.year, m, 1);
        buckets.push({ key: m,
          labelStr:  date.toLocaleDateString(lang, { month: "short" }),
          labelFull: date.toLocaleDateString(lang, { month: "long", year: "numeric" }),
          isCurrent: scope.year === now.getFullYear() && m === now.getMonth() });
      }
      return { keyOf: d => d.getFullYear() === scope.year ? d.getMonth() : null, buckets };
    }
    // total: yearly; if ≤1 year of data, fall back to that year's months
    const years = [...new Set(sessions.map(s => { const d = this._sessionDate(s); return d ? d.getFullYear() : null; }).filter(v => v != null))].sort((a, b) => a - b);
    if (years.length <= 1) return this._scopeAxis({ kind: "year", year: years.length ? years[0] : now.getFullYear() }, sessions);
    const buckets = years.map(y => ({ key: y, labelStr: String(y), labelFull: String(y), isCurrent: y === now.getFullYear() }));
    return { keyOf: d => d.getFullYear(), buckets };
  },

  // Ordered series for the grouping. solar → [solar, grid]; loadpoint/vehicle → distinct (energy desc).
  _groupSeries(scope, sessions, grouping) {
    if (grouping === "solar") return [
      { key: "__solar", label: this._t("statsGroupSolar"), color: "var(--evcc-green,#22c55e)" },
      { key: "__grid",  label: this._t("grid"),            color: "var(--primary-color,#3b82f6)" },
    ];
    const pal = ["#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
    const field = grouping === "loadpoint" ? "loadpoint" : "vehicle";
    const totals = {};
    for (const s of sessions) {
      const d = this._sessionDate(s); if (!d || !this._sessionInScope(d, scope)) continue;
      const n = s[field] || "—";
      totals[n] = (totals[n] || 0) + (Number(s.chargedEnergy) || 0);
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([n], i) => ({ key: n, label: n, color: pal[i % pal.length] }));
  },

  // Stacked buckets: each bucket gets seg{seriesKey:value} + total for the chosen metric.
  _sessionStacks(sessions, scope, metric, grouping, series) {
    const axis = this._scopeAxis(scope, sessions);
    const pos = {}; axis.buckets.forEach((b, i) => { pos[b.key] = i; b.seg = {}; b.total = 0; });
    const known = new Set(series.map(s => s.key));
    const field = grouping === "loadpoint" ? "loadpoint" : "vehicle";
    for (const s of sessions) {
      const d = this._sessionDate(s); if (!d) continue;
      const bk = axis.keyOf(d); if (bk == null || !(bk in pos)) continue;
      const v = this._metricVal(s, metric); if (v == null) continue;
      const b = axis.buckets[pos[bk]];
      if (grouping === "solar") {
        if (metric === "energy") {
          const sp = Number(s.solarPercentage);
          const frac = isFinite(sp) ? Math.max(0, Math.min(100, sp)) / 100 : 0;
          b.seg.__solar = (b.seg.__solar || 0) + v * frac;
          b.seg.__grid  = (b.seg.__grid  || 0) + v * (1 - frac);
        } else {
          // cost/CO₂: solar self-consumption carries ~no marginal cost/emissions → attribute to grid.
          b.seg.__grid = (b.seg.__grid || 0) + v;
        }
      } else {
        const key = s[field] || "—";
        if (!known.has(key)) continue;
        b.seg[key] = (b.seg[key] || 0) + v;
      }
      b.total += v;
    }
    return axis.buckets;
  },

  _computeSessionStats(sessions, scope) {
    let kwh = 0, solarKwh = 0, cost = 0, co2wSum = 0, co2w = 0;
    let hasSolar = false, hasPrice = false, hasCo2 = false, count = 0;
    for (const s of sessions) {
      const d = this._sessionDate(s);
      if (!d || !this._sessionInScope(d, scope)) continue;
      const e = Number(s.chargedEnergy) || 0;
      kwh += e; count++;
      const sp = Number(s.solarPercentage);
      if (isFinite(sp)) { solarKwh += e * Math.max(0, Math.min(100, sp)) / 100; hasSolar = true; }
      const p = Number(s.price);
      if (isFinite(p)) { cost += p; hasPrice = true; }
      const c = Number(s.co2PerKWh);
      if (isFinite(c)) { co2wSum += e * c; co2w += e; hasCo2 = true; }
    }

    return {
      kwh,
      solarPct:  (hasSolar && kwh > 0) ? solarKwh / kwh * 100 : null,
      avgPrice:  (hasPrice && kwh > 0) ? cost / kwh : null,
      totalCost: hasPrice ? cost : null,
      avgCo2:    (hasCo2 && co2w > 0) ? co2wSum / co2w : null,
      count, hasSolar, hasPrice, hasCo2,
    };
  },

  // KPI memo per (sessions cache timestamp, scope); the footer reuses this.
  _sessionStats(sessions, scope) {
    const ts = this._wsCache["sessions::"]?.ts ?? 0;
    const key = this._scopeKey(scope);
    if (!this._sessionStatsMemo || this._sessionStatsMemo.ts !== ts) this._sessionStatsMemo = { ts, byKey: {} };
    if (!this._sessionStatsMemo.byKey[key]) this._sessionStatsMemo.byKey[key] = this._computeSessionStats(sessions, scope);
    return this._sessionStatsMemo.byKey[key];
  },

  // Metric toggle (Energie / Kosten / CO₂) — selects what the bars represent.
  _renderStatsMetricTabs() {
    const cur = this._statsMetric ?? "energy";
    const defs = [
      { key: "energy", tKey: "statsMetricEnergy" },
      { key: "cost",   tKey: "statsMetricCost"   },
      { key: "co2",    tKey: "statsMetricCo2"    },
    ];
    const btns = defs.map(d => `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-metric="${d.key}">${this._t(d.tKey)}</button>`).join("");
    return `<div class="stats-period-tabs stats-period-tabs--small">${btns}</div>`;
  },

  // Grouping toggle (Sonne / Ladepunkt / Fahrzeug) — selects how bars are stacked.
  _renderStatsGroupTabs() {
    const cur = this._statsGroup ?? "solar";
    const defs = [
      { key: "solar",     tKey: "statsGroupSolar"     },
      { key: "loadpoint", tKey: "statsGroupLoadpoint" },
      { key: "vehicle",   tKey: "statsGroupVehicle"   },
    ];
    const btns = defs.map(d => `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-group="${d.key}">${this._t(d.tKey)}</button>`).join("");
    return `<div class="stats-period-tabs stats-period-tabs--small">${btns}</div>`;
  },

  // Scope tabs (Month / Year / Total) for the sessions stats path. Reuses the
  // .stats-period-tab styling but carries data-scope (handled separately from the
  // legacy entity-path data-period tabs).
  _renderStatsScopeTabs() {
    const cur = this._statsScope ?? "month";
    const defs = [
      { key: "month", tKey: "statsPeriodMonth" },
      { key: "year",  tKey: "statsPeriodYear"  },
      { key: "total", tKey: "statsPeriodTotal" },
    ];
    const btns = defs.map(d =>
      `<button class="stats-period-tab${d.key === cur ? " active" : ""}" data-scope="${d.key}">${this._t(d.tKey)}</button>`
    ).join("");
    return `<div class="stats-period-tabs">${btns}</div>`;
  },

  // Two independent steppers like EVCC: a month stepper (month scope only, wraps
  // freely) and a year stepper (month + year scope, bounded to the data range).
  // Steppers live on their OWN full-width line (CSS flex-basis:100%), right-aligned,
  // always reserved (even in 'total') so switching Month/Year/Total never reflows
  // the controls. The year stepper stays anchored right; month appears to its left
  // only in month scope. Fixed label widths stop the year from shifting.
  _renderStatsSteppers(sessions, scope) {
    const lang = this._statsLang();
    const now = new Date();
    const { min, max } = this._sessionRange(sessions);
    const y = scope.year ?? (max ? max.getFullYear() : now.getFullYear());
    const minY = min ? min.getFullYear() : y;
    const maxY = max ? max.getFullYear() : y;
    const one = (group, label, atStart, atEnd) => `
      <div class="stats-stepper">
        <button class="stats-step-btn" data-stats-step="prev" data-stats-unit="${group}" ${atStart ? "disabled" : ""} aria-label="prev">‹</button>
        <span class="stats-step-label stats-step-label--${group}">${label}</span>
        <button class="stats-step-btn" data-stats-step="next" data-stats-unit="${group}" ${atEnd ? "disabled" : ""} aria-label="next">›</button>
      </div>`;
    let inner = "";
    if (scope.kind !== "total") {
      const monthLbl = new Date(y, scope.kind === "month" ? scope.month : 0, 1).toLocaleDateString(lang, { month: "long" });
      const month = scope.kind === "month" ? one("month", monthLbl, false, false) : "";
      inner = month + one("year", String(y), y <= minY, y >= maxY);
    }
    return `<div class="stats-steppers">${inner}</div>`;
  },

  // EVCC-style stacked multi-series bar chart for the sessions stats. `series` is
  // an ordered [{key,label,color}]; each bucket carries seg{key:value} + total.
  // Stashes the data on the instance so the tooltip handler can look it up by index.
  _renderSessionChart(buckets, series, metric, currency) {
    this._statsChartData = { buckets, series, metric, currency };
    const mf = this._metricFmt(metric, currency);
    const ML = 22, MR = 6, MT = 20, MB = 18, W = 280, H = 110, CW = W - ML - MR, CH = H - MT - MB;
    const n = buckets.length || 1;
    const GAP = n > 20 ? 1 : 2;
    const bw = Math.max(1, Math.floor((CW - GAP * (n - 1)) / n));
    const offset = Math.round((CW - (bw * n + GAP * (n - 1))) / 2);
    const barX0 = i => ML + offset + i * (bw + GAP);
    const maxVal = Math.max(...buckets.map(b => b.total || 0), 0.1);
    const rawStep = maxVal / 5, stepExp = Math.floor(Math.log10(Math.max(rawStep, 0.001))), stepBase = Math.pow(10, stepExp), stepF = rawStep / stepBase;
    const tickStep = (stepF <= 1 ? 1 : stepF <= 2 ? 2 : stepF <= 5 ? 5 : 10) * stepBase;
    const numTicks = Math.ceil(maxVal / tickStep), niceMax = tickStep * numTicks;
    const toY = v => MT + CH - Math.round((v / niceMax) * CH);
    const grid = Array.from({ length: numTicks + 1 }, (_, i) => {
      const val = i * tickStep, y = toY(val), lbl = tickStep >= 1 ? Math.round(val) : val.toFixed(1);
      return `<line x1="${ML}" y1="${y}" x2="${W - MR}" y2="${y}" stroke="var(--divider-color,#374151)" stroke-width="${i === 0 ? 1 : 0.5}" opacity="${i === 0 ? 0.9 : 0.35}"/>`
           + `<text x="${ML - 3}" y="${y + 3}" text-anchor="end" font-size="6.5" fill="var(--secondary-text-color,#888)">${lbl}</text>`;
    }).join("");
    const axisLbl = `<text x="${ML - 3}" y="${MT - 8}" text-anchor="end" font-size="6.5" fill="var(--secondary-text-color,#888)">${mf.axis}</text>`;
    const showEvery = n > 15 ? Math.ceil(n / 7) : 1;
    const bars = buckets.map((b, i) => {
      const x0 = barX0(i), cx = x0 + bw / 2;
      const op = b.isCurrent ? "0.95" : "0.6";
      let bottom = toY(0), segs = "";
      for (const s of series) {
        const val = b.seg[s.key] || 0; if (val <= 0) continue;
        const h = Math.round((val / niceMax) * CH); if (h <= 0) continue;
        const y = bottom - h;
        segs += `<rect x="${x0}" y="${y}" width="${bw}" height="${h}" fill="${s.color}" opacity="${op}"/>`;
        bottom = y;
      }
      const showLabel = (i % showEvery === 0) || i === n - 1;
      const labelSvg = showLabel ? `<text x="${cx}" y="${H - MB + 12}" text-anchor="middle" font-size="6.5" fill="var(--secondary-text-color,#888)" opacity="${b.isCurrent ? "1" : "0.75"}">${b.labelStr}</text>` : "";
      const hit = `<rect class="evcc-bar" data-idx="${i}" x="${x0}" y="${MT}" width="${bw}" height="${CH}" fill="transparent" style="cursor:pointer"/>`;
      return segs + hit + labelSvg;
    }).join("");
    const legend = `<div class="stats-legend">${series.map(s => `<span class="sl-item"><span class="sl-dot" style="background:${s.color}"></span>${escHtml(s.label)}</span>`).join("")}</div>`;
    return `<div class="evcc-chart-wrap"><svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block">${grid}${axisLbl}${bars}</svg><div class="evcc-chart-tooltip" hidden></div></div>${legend}`;
  },

  _renderStatsBlockSessions(sessions) {
    const scope   = this._statsScopeObj(sessions);
    const metric  = this._statsMetric ?? "energy";
    const grouping = this._statsGroup ?? "solar";
    const cur     = this._statsCurrency();
    const k       = this._sessionStats(sessions, scope);

    // KPI tiles (period summary, independent of the selected metric).
    const kpi = (v, label, fmt, color) => `
      <div class="stats-kpi">
        <div class="stats-kpi-val"${color ? ` style="color:${color}"` : ""}>${v != null ? fmt(v) : "–"}</div>
        <div class="stats-kpi-lbl">${label}</div>
      </div>`;
    const kpis = [ kpi(k.kwh, this._t("statsTotalCharged"), v => `${Math.round(v)} kWh`, null) ];
    if (k.hasSolar) kpis.push(kpi(k.solarPct, this._t("statsSolarShare"), v => `${Math.round(v)} %`, k.solarPct > 0 ? "var(--evcc-green)" : null));
    if (k.hasPrice) kpis.push(kpi(k.totalCost, this._t("statsTotalCost"), v => `${v.toFixed(2)} ${escHtml(cur)}`, null));
    if (k.hasCo2)   kpis.push(kpi(k.avgCo2, this._t("statsAvgCo2"), v => `${v >= 10 ? Math.round(v) : v.toFixed(1)} g/kWh`, null));

    // Stacked chart for the selected metric × grouping.
    const series = this._groupSeries(scope, sessions, grouping);
    const buckets = this._sessionStacks(sessions, scope, metric, grouping, series);
    const hasBars = buckets.some(b => (b.total || 0) > 0);
    const chartHtml = `
      <div class="stats-chart-section">
        ${hasBars ? this._renderSessionChart(buckets, series, metric, cur) : `<div class="stats-chart-loading">${this._t("statsNoSessions")}</div>`}
      </div>`;

    return `
      <div>
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("statistics"))}</span>
        </div>
        <div class="stats-controls">
          ${this._renderStatsScopeTabs()}
          ${this._renderStatsSteppers(sessions, scope)}
        </div>
        <div class="stats-controls">
          ${this._renderStatsMetricTabs()}
          ${this._renderStatsGroupTabs()}
        </div>
        <div class="stats-kpi-row">${kpis.join("")}</div>
        ${chartHtml}
      </div>`;
  },

  _renderStatsFooterSessions(sessions) {
    const scope = this._footerScope();
    const k = this._sessionStats(sessions, scope);
    const cur = this._statsCurrency();
    const labelKey = scope.kind === "month" ? "statsPeriodMonth" : scope.kind === "year" ? "statsPeriodYear" : "statsPeriodTotal";
    const periodLabel = this._t(labelKey);
    const items = [
      `<span class="sf-item"><span class="sf-val">${Math.round(k.kwh)} kWh</span><span class="sf-lbl">${this._t("statsCharged")}</span></span>`,
      k.hasSolar ? `<span class="sf-item"><span class="sf-val" style="color:var(--evcc-green)">${Math.round(k.solarPct)} %</span><span class="sf-lbl">${this._t("statsSolarShare")}</span></span>` : "",
      k.hasPrice ? `<span class="sf-item"><span class="sf-val">${k.avgPrice.toFixed(2)} ${escHtml(cur)}/kWh</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
    ].filter(Boolean);
    if (k.kwh <= 0) return "";
    return `<div class="stats-footer"><div class="sf-period">${periodLabel}</div><div class="sf-items">${items.join('<span class="sf-sep"></span>')}</div></div>`;
  },

  _renderStatsFooter() {
    if (normalizeStatsPeriod(this._config.stats_period, "total") === "none") return "";
    if (this._hasCmd("sessions")) {
      const res = this._wsSessions();
      if (res && res.data && Array.isArray(res.data.sessions)) {
        return this._renderStatsFooterSessions(res.data.sessions);
      }
      // pending/error → fall through to the entity path below
    }
    // The legacy path has periods of its own, so the configured value is mapped
    // onto them here. Not via this._statsPeriod: that one follows the period
    // tabs of the stats mode, the footer stays on what the config asked for.
    const period = legacyStatsPeriod(this._config.stats_period, "total");
    const { kwhId, solarId, priceId } = this._getStatEntityIds(period);
    if (!kwhId && !solarId && !priceId) return "";

    const val = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const kwh   = val(kwhId);
    const solar = val(solarId);
    const price = val(priceId);

    const periodTKey = { "30d": "statsPeriod30d", "365d": "statsPeriod365d", "thisYear": "statsPeriodThisYear", "total": "statsPeriodTotal" }[period] ?? "statsPeriodTotal";
    const periodLabel = this._t(periodTKey);

    const items = [
      kwhId   ? `<span class="sf-item"><span class="sf-val">${Math.round(kwh)} kWh</span><span class="sf-lbl">${this._t("statsCharged")}</span></span>` : "",
      solarId ? `<span class="sf-item"><span class="sf-val" style="color:var(--evcc-green)">${Math.round(solar)} %</span><span class="sf-lbl">${this._t("statsSolarShare")}</span></span>` : "",
      priceId ? `<span class="sf-item"><span class="sf-val">${price.toFixed(2)} ${escHtml(unitStr(this._hass, priceId))}</span><span class="sf-lbl">${this._t("statsAvgPrice")}</span></span>` : "",
    ].filter(Boolean);

    if (items.length === 0) return "";
    return `<div class="stats-footer"><div class="sf-period">${periodLabel}</div><div class="sf-items">${items.join('<span class="sf-sep"></span>')}</div></div>`;
  },

  _renderStatsBlock() {
    // Sessions-first: when ha-evcc exposes the sessions command, compute the
    // stats entirely from the raw session list (no stat_* sensors, no Recorder).
    // Fall back to the entity/Recorder path for older integrations or while the
    // first session fetch is still in flight.
    if (this._hasCmd("sessions")) {
      const res = this._wsSessions();
      if (res && res.data && Array.isArray(res.data.sessions)) {
        return this._renderStatsBlockSessions(res.data.sessions);
      }
      if (!res) {
        return `
          <div>
            <div class="lp-header"><span class="lp-name">${escHtml(this._config.title || this._t("statistics"))}</span></div>
            ${this._renderStatsScopeTabs()}
            <div class="stats-chart-loading">…</div>
          </div>`;
      }
      // res.error → fall through to the entity path
    }
    return this._renderStatsBlockEntities();
  },

  // Listeners of both statistics paths: the period, scope, metric and group
  // tabs, the month and year steppers and the chart tooltip. Called by
  // _attachListeners() after every render.
  _attachStatsListeners() {
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
  },
};

// Both statistics paths: tabs, footer, KPI row, chart and tooltip.
// Part of the card stylesheet, see src/styles.js.
const statsCss = `
      .stats-period-tabs { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 10px; }
      .stats-period-tab {
        padding: 2px 10px; border-radius: 999px;
        border: 1px solid var(--divider-color, #e5e7eb);
        background: transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .72rem; font-weight: 600; transition: all .15s;
      }
      .stats-period-tab.active { background: var(--primary-color); color: #fff; border-color: var(--primary-color); }
      .stats-period-tabs--small .stats-period-tab { font-size: .65rem; padding: 1px 8px; }

      .stats-footer-wrap {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 8px;
      }
      .stats-footer-wrap .stats-footer { border-top: none; margin-top: 6px; padding-top: 0; }

      .stats-footer {
        border-top: 1px solid var(--divider-color, #333);
        margin-top: 12px; padding-top: 10px;
      }
      .sf-period {
        font-size: .6rem; text-transform: uppercase; letter-spacing: .08em; font-weight: 700;
        color: var(--secondary-text-color); text-align: center; margin-bottom: 6px; opacity: 0.7;
      }
      .sf-items { display: flex; align-items: center; }
      .sf-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; }
      .sf-val  { font-size: .82rem; font-weight: 700; }
      .sf-lbl  { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .sf-sep  { width: 1px; height: 28px; background: var(--divider-color, #333); flex-shrink: 0; }

      .stats-no-data {
        font-size: .76rem; color: var(--warning-color, #f4b942);
        background: rgba(244,185,66,.08);
        border: 1px solid var(--warning-color, #f4b942);
        border-radius: 6px; padding: 10px 12px; margin-bottom: 10px; line-height: 1.6;
      }
      .stats-no-data-link {
        display: inline-block; margin-top: 4px; color: var(--primary-color);
        text-decoration: none; font-weight: 600;
      }
      .stats-no-data-link:hover { text-decoration: underline; }

      .stats-kpi-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
      .stats-kpi {
        background: var(--secondary-background-color, rgba(255,255,255,.05));
        border-radius: 8px; padding: 10px 8px; text-align: center;
        display: flex; flex-direction: column; gap: 3px;
      }
      .stats-kpi-val { font-size: 1.1rem; font-weight: 800; line-height: 1; }
      .stats-kpi-lbl { font-size: .58rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .06em; font-weight: 600; }
      .stats-chart-section { margin-top: 4px; }
      .stats-stepper { display: flex; align-items: center; justify-content: center; }
      .stats-step-btn {
        border: 1px solid var(--divider-color, rgba(127,127,127,0.3)); background: transparent;
        color: var(--primary-text-color); border-radius: 8px; width: 26px; height: 24px; line-height: 1;
        font-size: 1rem; cursor: pointer; padding: 0;
      }
      .stats-step-btn:hover:not([disabled]) { background: var(--secondary-background-color, rgba(127,127,127,0.12)); }
      .stats-step-btn[disabled] { opacity: 0.35; cursor: default; }
      .stats-stepper { gap: 4px; }
      .stats-step-label { text-align: center; font-weight: 600; font-size: 0.85rem; white-space: nowrap; overflow: hidden; }
      .stats-step-label--month { width: 74px; }
      .stats-step-label--year { width: 42px; }
      .stats-controls { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
      .stats-controls .stats-period-tabs { margin-bottom: 0; }
      .stats-steppers { flex: 0 0 100%; display: flex; align-items: center; justify-content: flex-end; gap: 10px; min-height: 26px; }
      .stats-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 12px; margin-top: 8px; font-size: 0.74rem; color: var(--secondary-text-color); }
      .sl-item { display: inline-flex; align-items: center; gap: 5px; }
      .sl-dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
      .evcc-chart-wrap { position: relative; margin-left: -16px; margin-right: 0; }
      .evcc-chart-tooltip {
        position: absolute; top: 0; transform: translateX(-50%);
        background: var(--ha-card-background, var(--card-background-color, #1f2937));
        border-radius: 8px; padding: 8px 12px;
        font-size: 12px; line-height: 1.6; white-space: nowrap;
        pointer-events: none; z-index: 10;
        box-shadow: 0 4px 16px rgba(0,0,0,.35);
      }
      .ectt-header { font-weight: 700; margin-bottom: 4px; }
      .ectt-row { display: flex; align-items: center; gap: 6px; }
      .ectt-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
      .ectt-name { flex: 1; color: var(--primary-text-color); }
      .ectt-val { font-weight: 600; margin-left: 12px; }
      .ectt-summary { margin-top: 6px; padding-top: 5px; border-top: 1px solid var(--divider-color, #374151); font-weight: 700; }
      .stats-chart-title {
        font-size: .58rem; font-weight: 700; letter-spacing: .12em;
        text-transform: uppercase; color: var(--secondary-text-color); opacity: .55; margin-bottom: 8px;
      }
      .stats-chart-loading {
        height: 75px; display: flex; align-items: center; justify-content: center;
        color: var(--secondary-text-color); font-size: .75rem; opacity: .5;
      }
      .stats-solar-hint {
        font-size: .72rem; color: var(--secondary-text-color);
        margin-top: 10px; padding: 6px 10px;
        background: color-mix(in srgb, var(--evcc-green) 8%, transparent);
        border: 1px solid color-mix(in srgb, var(--evcc-green) 25%, transparent);
        border-radius: 6px; line-height: 1.4;
      }
`;

// Battery mode. Methods are mixed into EvccCard.prototype.
const batteryView = {
  _renderBatteryBlock(site) {
    const socId         = site.battery_soc;
    const powerId       = site.battery_power;
    const capId         = site.battery_capacity;
    const dischargeId   = site.battery_discharge_control;
    const prioritySocId      = site.priority_soc;
    const bufferSocId        = site.buffer_soc;
    const bufferStartSocId   = site.buffer_start_soc;

    if (!socId) return "";

    const soc         = parseFloat(stateVal(this._hass, socId)) || 0;
    const power       = powerId ? parseFloat(stateVal(this._hass, powerId)) || 0 : null;
    const cap         = capId   ? parseFloat(stateVal(this._hass, capId))   || 0 : null;
    const dischargeOn = dischargeId ? isOn(this._hass, dischargeId) : null;
    const socColor    = soc > 80 ? "var(--evcc-green)" : soc > 30 ? "var(--evcc-blue)" : "var(--evcc-amber)";

    const getVal  = id => id ? (parseFloat(stateVal(this._hass, id)) || 0) : null;
    const getOpts = id => id ? (attr(this._hass, id, "options") ?? [])
      .map(o => parseFloat(o)).filter(o => !isNaN(o)).sort((a, b) => a - b) : [];

    const priorityVal      = getVal(prioritySocId);
    const bufferVal        = getVal(bufferSocId);
    const bufferStartVal   = getVal(bufferStartSocId);

    const bufferSocOpts      = getOpts(bufferSocId).filter(o => (priorityVal === null || o >= priorityVal) && (bufferStartVal === null || bufferStartVal === 0 || o <= bufferStartVal));
    const bufferStartSocOpts = getOpts(bufferStartSocId).filter(o => o === 0 || bufferVal === null || o >= bufferVal);
    const prioritySocOpts    = getOpts(prioritySocId).filter(o => bufferVal === null || o <= bufferVal);
    const bufferStartLabel   = o => o === 0 ? this._t("battBufferStartSocZero") : this._t("battBufferStartSocAt", { val: o });

    const inlineSelect = (entityId, val, filteredOpts, labelFn) => {
      if (!entityId || val === null || !filteredOpts.length) return "";
      const options = filteredOpts.map(o =>
        `<option value="${o}"${o === val ? " selected" : ""}>${labelFn ? labelFn(o) : `${o} %`}</option>`
      ).join("");
      return `<select class="batt-inline-select" data-entity="${entityId}">${options}</select>`;
    };

    const splitPct    = priorityVal ?? 0;
    const carZonePct  = 100 - splitPct;
    const hausZonePct = splitPct;
    const socFillH    = Math.min(soc, 100);

    const visual = `
      <div class="batt-visual">
        <div class="batt-cap-tip"></div>
        <div class="batt-body">
          ${splitPct > 0 && splitPct < 100 ? `
            <div class="batt-zone batt-zone-car" style="flex:${carZonePct}">
              <span class="batt-zone-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="rgba(255,255,255,0.5)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
            </div>
            <div class="batt-divider-line"></div>
            <div class="batt-zone batt-zone-haus" style="flex:${hausZonePct}">
              <span class="batt-zone-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="rgba(255,255,255,0.5)"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg></span>
            </div>` : `
            <div class="batt-zone batt-zone-car" style="flex:1">
              <span class="batt-zone-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="rgba(255,255,255,0.5)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
            </div>`}
          <div class="batt-soc-overlay" style="height:${socFillH}%;background:${socColor}"></div>
        </div>
      </div>`;

    const powerStr = power !== null
      ? (Math.abs(power) < 50 ? this._t("battReady")
        : `${(Math.abs(power)/1000).toFixed(2)} kW ${power > 0 ? "↑" : "↓"}`)
      : "";
    const info = `
      <div class="batt-info-col">
        <div class="batt-info-label">${this._t("battLevel")}</div>
        <div class="batt-info-pct" style="color:${socColor}">${Math.round(soc)} %</div>
        ${cap ? `<div class="batt-info-kwh">${(soc/100*cap).toFixed(1)} / ${cap} kWh</div>` : ""}
        ${powerStr ? `<div class="batt-info-power">${powerStr}</div>` : ""}
      </div>`;

    const dischargeHtml = dischargeOn !== null ? `
      <div class="batt-discharge-row">
        <button class="batt-discharge-toggle ${dischargeOn ? "on" : ""}"
                data-entity="${dischargeId}" data-domain="switch" data-on="${dischargeOn}">
          <span class="batt-toggle-knob"></span>
        </button>
        <span>${this._t("battDischargeLabel")}</span>
      </div>` : "";

    const tabUsage = `
      <div class="batt-usage-content">
        <div class="batt-main-row">
          <div class="batt-text-col">
            ${bufferSocId ? `
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="fill:var(--evcc-bolt)"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battBoostTitle")}</div>
                <div class="batt-text-desc">${this._t("battBoostDesc", { val: inlineSelect(bufferSocId, bufferVal, bufferSocOpts) })}</div>
                ${bufferStartSocId ? `<div class="batt-text-desc">${this._t("battBufferStartDesc", { val: inlineSelect(bufferStartSocId, bufferStartVal, bufferStartSocOpts, bufferStartLabel) })}</div>` : ""}
              </div>
            </div>` : ""}
            ${prioritySocId ? `
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" style="fill:var(--evcc-blue)"><path d="M16,6L19,10H5L8,6H16M16,4H8L3,10V16H5V18H8V16H16V18H19V16H21V10L16,4M7,12A1,1 0 0,1 8,11A1,1 0 0,1 9,12A1,1 0 0,1 8,13A1,1 0 0,1 7,12M15,12A1,1 0 0,1 16,11A1,1 0 0,1 17,12A1,1 0 0,1 16,13A1,1 0 0,1 15,12Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battCarPrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battCarPrioDesc", { val: inlineSelect(prioritySocId, priorityVal, prioritySocOpts) })}</div>
              </div>
            </div>
            <div class="batt-text-item">
              <span class="batt-text-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="var(--secondary-text-color)"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z"/></svg></span>
              <div>
                <div class="batt-text-title">${this._t("battHomePrioTitle")}</div>
                <div class="batt-text-desc">${this._t("battHomePrioDesc", { val: inlineSelect(prioritySocId, priorityVal, prioritySocOpts) })}</div>
              </div>
            </div>` : ""}
          </div>
          <div class="batt-visual-col">
            ${bufferVal !== null ? `<span class="batt-marker-top">${bufferVal} %</span>` : ""}
            ${visual}
            ${info}
          </div>
        </div>
        ${dischargeHtml}
      </div>`;

    return `
      <div class="battery-block">
        <div class="lp-header">
          <span class="lp-name">${escHtml(this._config.title || this._t("homeBattery"))}</span>
        </div>
        ${tabUsage}
      </div>`;
  },

  // Listeners of the battery view: the discharge toggle and the inline
  // selects. Called by _attachListeners() after every render.
  _attachBatteryListeners() {
    this.shadowRoot.querySelectorAll("button.batt-discharge-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const on     = btn.dataset.on === "true";
        const domain = btn.dataset.domain;
        this._toggleEntity(domain, btn.dataset.entity, on);
        btn.classList.toggle("on", !on);
        btn.dataset.on = String(!on);
      });
    });

    this.shadowRoot.querySelectorAll(".batt-inline-select").forEach(sel => {
      sel.addEventListener("change", () => {
        this._setSelectOption(sel.dataset.entity, sel.value);
      });
      sel.addEventListener("click", e => e.stopPropagation());
    });
  },
};

// Battery mode.
// Part of the card stylesheet, see src/styles.js.
const batteryCss = `
      .battery-block { padding: 0; }
      .batt-main-row { display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
      .batt-text-col { flex: 1; min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; gap: 12px; }
      .batt-text-item { display: flex; gap: 8px; align-items: flex-start; }
      .batt-text-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; }
      .batt-text-title { font-size: .82rem; font-weight: 600; margin-bottom: 2px; }
      .batt-text-desc  { font-size: .76rem; color: var(--secondary-text-color); line-height: 1.4; }
      .batt-inline-select { color: var(--primary-color, #00b4d8); font-weight: 600; font-size: .76rem; font-family: inherit; background: transparent; border: none; border-bottom: 1px dotted var(--primary-color, #00b4d8); cursor: pointer; padding: 0 2px; outline: none; appearance: none; -webkit-appearance: none; }
      .batt-visual-col { display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; align-self: flex-start; }
      .batt-marker-top { display: none; }
      .batt-visual { display: flex; flex-direction: column; align-items: center; width: 56px; }
      .batt-cap-tip { width: 22px; height: 5px; background: var(--divider-color, #555); border-radius: 3px 3px 0 0; margin-bottom: 1px; }
      .batt-body { width: 56px; height: 130px; border: 2px solid var(--divider-color, #555); border-radius: 5px; overflow: hidden; display: flex; flex-direction: column; position: relative; }
      .batt-zone { display: flex; align-items: center; justify-content: center; position: relative; z-index: 1; min-height: 20px; }
      .batt-zone-car  { background: #22c55e18; }
      .batt-zone-haus { background: #3b82f618; }
      .batt-zone-icon { font-size: 1.2rem; }
      .batt-divider-line { height: 2px; background: var(--divider-color, #555); flex-shrink: 0; z-index: 2; }
      .batt-soc-overlay { position: absolute; bottom: 0; left: 0; right: 0; z-index: 0; border-radius: 0 0 3px 3px; transition: height .4s; opacity: 0.55; }
      .batt-info-col { display: flex; flex-direction: column; gap: 2px; align-items: center; text-align: center; }
      .batt-info-label { font-size: .7rem; color: var(--secondary-text-color); line-height: 1.2; }
      .batt-info-pct   { font-size: 1.1rem; font-weight: 700; line-height: 1.1; }
      .batt-info-kwh, .batt-info-power { font-size: .7rem; color: var(--secondary-text-color); line-height: 1.2; white-space: nowrap; }
      .batt-discharge-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding-top: 10px; border-top: 1px solid var(--divider-color, #333); font-size: .84rem; }
      .batt-discharge-toggle { width: 42px; height: 24px; border-radius: 12px; border: none; background: var(--divider-color, #444); position: relative; cursor: pointer; flex-shrink: 0; transition: background .2s; }
      .batt-discharge-toggle.on { background: var(--primary-color, #00b4d8); }
      .batt-toggle-knob { position: absolute; width: 18px; height: 18px; border-radius: 50%; background: white; top: 3px; left: 3px; transition: left .2s; }
      .batt-discharge-toggle.on .batt-toggle-knob { left: 21px; }
      @container (max-width: 420px) {
        .batt-main-row { flex-direction: column; gap: 14px; }
        .batt-visual-col { align-self: stretch; justify-content: flex-start; }
      }
`;

// Debug mode: expected entities, config dump, debug report. Methods are mixed into EvccCard.prototype.
const debugView = {
  _expectedLpSuffixes() {
    if (!this._cachedLpSuffixes) {
      this._cachedLpSuffixes = Array.from(new Set(FEATURES.filter(f => f.lp).map(f => f.suffix)));
    }
    return this._cachedLpSuffixes;
  },

  _expectedSiteSuffixes() {
    if (!this._cachedSiteSuffixes) {
      this._cachedSiteSuffixes = Array.from(new Set(FEATURES.filter(f => !f.lp).map(f => f.suffix)));
    }
    return this._cachedSiteSuffixes;
  },

  _coreLpSuffixes() {
    if (!this._cachedCoreLp) {
      this._cachedCoreLp = new Set(FEATURES.filter(f => f.lp && f.core).map(f => f.suffix));
    }
    return this._cachedCoreLp;
  },

  _coreSiteSuffixes() {
    if (!this._cachedCoreSite) {
      this._cachedCoreSite = new Set(FEATURES.filter(f => !f.lp && f.core).map(f => f.suffix));
    }
    return this._cachedCoreSite;
  },

  // Drops indexed features (pv_N_*, battery_N_*, charge_currents_N) from `suffixes`
  // when the previous index is also missing in `found`. So `pv_2_power` only
  // counts as "expected" if `pv_1_power` is present.
  _filterIndexedExpected(suffixes, found) {
    return suffixes.filter(s => {
      const mIdx = s.match(/^(pv|battery)_(\d+)_(.+)$/);
      if (mIdx) {
        const [, base, idxStr, stem] = mIdx;
        const idx = parseInt(idxStr, 10);
        if (idx === 0) return true;
        return found[`${base}_${idx-1}_${stem}`] != null;
      }
      const mCc = s.match(/^charge_currents_(\d+)$/);
      if (mCc) {
        const idx = parseInt(mCc[1], 10);
        if (idx === 0) return true;
        return found[`charge_currents_${idx-1}`] != null;
      }
      return true;
    });
  },

  // Splits a set of expected suffixes into { core, optional, missingCore, missingOpt }
  // relative to `found` (an object whose keys are the entity suffixes that exist).
  // Indexed features with N >= 1 (pv_2_*, battery_3_*, charge_currents_1, …) are
  // excluded from the missing-optional list because the actual count depends on
  // hardware (number of PV strings / batteries / phases) and is naturally variable.
  _splitCoreOptional(expected, found, coreSet) {
    const foundKeys   = new Set(Object.keys(found));
    const isIndexedHigh = s =>
      /^(pv|battery)_[1-9]\d*_/.test(s) || /^charge_currents_[1-9]\d*$/.test(s);
    const core        = expected.filter(s => coreSet.has(s));
    const opt         = expected.filter(s => !coreSet.has(s));
    const missingCore = core.filter(s => !foundKeys.has(s));
    const missingOpt  = opt.filter(s => !foundKeys.has(s) && !isIndexedHigh(s));
    const foundCore   = core.filter(s => foundKeys.has(s));
    const foundOpt    = opt.filter(s => foundKeys.has(s));
    return {
      core: core.length, foundCore: foundCore.length, missingCore,
      opt:  opt.length,  foundOpt:  foundOpt.length,  missingOpt,
    };
  },

  _formatConfigYaml(cfg, maskNames = false) {
    if (!cfg || typeof cfg !== "object") return String(cfg ?? "—");
    const out = ["type: custom:evcc-card"];
    const lpMaskCount = { i: 0 };
    const maskValue = (key, val) => {
      if (!maskNames) return val;
      if (key === "title") return "***";
      if (key === "loadpoints" || key === "no_plan" || key === "no_pv" || key === "repeating_plan_vehicles") {
        if (Array.isArray(val)) return val.map(() => `lp_${++lpMaskCount.i}`);
        if (typeof val === "string") return `lp_${++lpMaskCount.i}`;
      }
      return val;
    };
    for (const [k, raw] of Object.entries(cfg)) {
      if (k === "type") continue;
      const v = maskValue(k, raw);
      if (Array.isArray(v)) {
        if (v.length === 0) out.push(`${k}: []`);
        else out.push(`${k}:\n${v.map(item => `  - ${item}`).join("\n")}`);
      } else if (v != null && typeof v === "object") {
        out.push(`${k}: ${JSON.stringify(v)}`);
      } else {
        out.push(`${k}: ${v}`);
      }
    }
    return out.join("\n");
  },

  _renderDebugBlock(loadpoints, site, meters) {
    const prefix    = this._getPrefix();
    const haVer     = this._hass?.config?.version || "?";
    const lang      = (this._config.language
      || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
    const cfgLang   = this._config.language || null;
    const ua        = (typeof navigator !== "undefined" ? navigator.userAgent : "—");
    const evccCount = Object.keys(this._hass?.states || {})
      .filter(id => id.split(".")[1]?.startsWith(prefix)).length;

    const allLp   = this._expectedLpSuffixes();
    const allSite = this._expectedSiteSuffixes();
    const coreLp  = this._coreLpSuffixes();
    const coreSite = this._coreSiteSuffixes();

    const lpNames    = Object.keys(loadpoints || {});
    const meterNames = Object.keys(meters || {});
    const loadedLocales = Object.keys(this._translations || {});

    const expectedSite = this._filterIndexedExpected(allSite, site || {});
    const siteSplit    = this._splitCoreOptional(expectedSite, site || {}, coreSite);

    const pill = (tone, text) => `<span class="debug-pill ${tone}">${text}</span>`;
    const escUa = escHtml(ua);

    const lpRows = lpNames.length === 0
      ? `<div class="debug-empty">—</div>`
      : `<ul class="debug-list">${lpNames.map(name => {
          const ents     = loadpoints[name];
          const expected = this._filterIndexedExpected(allLp, ents);
          const split    = this._splitCoreOptional(expected, ents, coreLp);
          const coreTone = split.missingCore.length === 0 ? "ok" : "err";
          return `
            <li>
              <div class="debug-list-head">
                <code>${escHtml(name)}</code>
                ${pill(coreTone, `${this._t("debugCore")} ${split.foundCore}/${split.core}`)}
                ${pill("info", `${this._t("debugOptional")} ${split.foundOpt}/${split.opt}`)}
              </div>
              ${split.missingCore.length
                ? `<div class="debug-missing"><strong>${this._t("debugMissingCore")}:</strong> <code>${split.missingCore.join(", ")}</code></div>`
                : ""}
              ${split.missingOpt.length
                ? `<details class="debug-missing-opt"><summary>${this._t("debugMissingOptional")} (${split.missingOpt.length})</summary><code>${split.missingOpt.slice(0, 20).join(", ")}${split.missingOpt.length > 20 ? `, +${split.missingOpt.length - 20}` : ""}</code></details>`
                : ""}
            </li>`;
        }).join("")}</ul>`;

    const meterRows = meterNames.length === 0
      ? `<div class="debug-empty">—</div>`
      : `<ul class="debug-list">${meterNames.map(name => {
          const count = Object.keys(meters[name]).length;
          return `<li>
            <div class="debug-list-head">
              <code>${escHtml(name)}</code>
              <span class="debug-count">${count} ${this._t("debugEntities")}</span>
              ${pill("warn", this._t("debugOrphan"))}
            </div>
            <div class="debug-missing">${this._t("debugOrphanHint")}</div>
          </li>`;
        }).join("")}</ul>`;

    const cfgSource = this._origConfig || this._config;
    const cfgYaml = this._formatConfigYaml(cfgSource, this._debugMask === true);
    const cfgNote = this._origConfig
      ? `<div class="debug-cfg-note">${this._t("debugCfgFromEmptyState")}</div>`
      : "";

    return `
      <div class="debug">
        <div class="debug-header">
          <div class="debug-title">🐞 ${this._t("debugTitle")}</div>
          <div class="debug-actions">
            <button class="debug-copy-btn">${this._t("debugCopyReport")}</button>
            <label class="debug-mask">
              <input type="checkbox" class="debug-mask-toggle" ${this._debugMask ? "checked" : ""}/>
              ${this._t("debugMaskNames")}
            </label>
          </div>
          <div class="debug-toast" hidden></div>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugVersions")}</div>
          <ul class="debug-kv">
            <li><strong>Card:</strong> <code>${EVCC_CARD_VERSION}</code></li>
            <li><strong>Home Assistant:</strong> <code>${escHtml(haVer)}</code></li>
            <li><strong>Browser:</strong> <code>${escUa}</code></li>
            <li><strong>Language:</strong> <code>${escHtml(lang)}</code>${cfgLang ? ` (configured: <code>${escHtml(cfgLang)}</code>)` : ""}</li>
          </ul>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugIntegration")}</div>
          <ul class="debug-kv">
            <li><strong>${this._t("debugEvccEntities")}:</strong> ${evccCount} ${evccCount > 0 ? pill("ok", "OK") : pill("err", "0")}</li>
            <li><strong>${this._t("debugPrefixAuto")}:</strong> <code>${escHtml(this._detectedPrefix || "—")}</code></li>
            <li><strong>${this._t("debugPrefixCfg")}:</strong> <code>${escHtml(this._config.prefix || "—")}</code></li>
          </ul>
          ${evccCount === 0 ? `<div class="debug-warn-box">${this._t("debugNoIntg")}</div>` : ""}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">WebSocket API</div>
          <ul class="debug-kv">
            <li><strong>Config entry id:</strong> <code>${escHtml(this._entryId || "—")}</code></li>
            ${!this._capsLoaded
              ? `<li><em>Probing capabilities…</em></li>`
              : !this._caps || this._caps.commands.length === 0
                ? `<li>${pill("warn", "not supported")} <em>(older ha-evcc / unknown command)</em></li>`
                : (() => {
                    const items = [];
                    items.push(`<li><strong>Integration version:</strong> <code>${escHtml(this._caps.version ?? "—")}</code></li>`);
                    items.push(`<li><strong>Commands:</strong> ${this._caps.commands.map(c => `<code>${escHtml(c)}</code>`).join(", ")}</li>`);
                    const lpMap = Object.entries(this._lpIndexMap || {});
                    items.push(`<li><strong>Loadpoint index map:</strong> ${lpMap.length ? lpMap.map(([id, i]) => `<code>${escHtml(id)}=${i}</code>`).join(", ") : `${pill("warn", "fallback")} <em>(heuristic/override; older ha-evcc)</em>`}</li>`);
                    // Show cached probe results (prefetched by _prefetchDebugProbes).
                    const fmtProbe = (label, cacheKey, fmt) => {
                      const c = this._wsCache[cacheKey];
                      if (!c) return `<li><strong>${label}:</strong> <em>loading…</em></li>`;
                      if (c.result.error) return `<li><strong>${label}:</strong> ${pill("err", "error")} <code>${escHtml(c.result.error)}</code></li>`;
                      return `<li><strong>${label}:</strong> ${fmt(c.result.data)}</li>`;
                    };
                    if (this._hasCmd("forecast"))
                      items.push(fmtProbe("forecast (grid)", "forecast:grid",
                        d => `${Array.isArray(d?.rates) ? d.rates.length : 0} rates${d?.unit ? ` (${escHtml(d.unit)})` : ""}`));
                    if (this._hasCmd("sessions"))
                      items.push(fmtProbe("sessions", "sessions::",
                        d => `${Array.isArray(d?.sessions) ? d.sessions.length : 0} sessions`));
                    return items.join("\n");
                  })()
            }
          </ul>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugLoadpoints")} (${lpNames.length})</div>
          ${lpRows}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugSiteFeatures")}</div>
          <div class="debug-list-head" style="margin-bottom:6px">
            ${pill(siteSplit.missingCore.length === 0 ? "ok" : "err", `${this._t("debugCore")} ${siteSplit.foundCore}/${siteSplit.core}`)}
            ${pill("info", `${this._t("debugOptional")} ${siteSplit.foundOpt}/${siteSplit.opt}`)}
          </div>
          ${siteSplit.missingCore.length ? `<div class="debug-suffix-list debug-missing"><strong>${this._t("debugMissingCore")}:</strong> <code>${siteSplit.missingCore.join(", ")}</code></div>` : ""}
          ${siteSplit.missingOpt.length ? `<details class="debug-missing-opt"><summary>${this._t("debugMissingOptional")} (${siteSplit.missingOpt.length})</summary><code>${siteSplit.missingOpt.slice(0, 24).join(", ")}${siteSplit.missingOpt.length > 24 ? `, +${siteSplit.missingOpt.length - 24}` : ""}</code></details>` : ""}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugMeters")} (${meterNames.length})</div>
          ${meterRows}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugCardConfig")}</div>
          ${cfgNote}
          <pre class="debug-yaml">${escHtml(cfgYaml)}</pre>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">${this._t("debugTranslations")}</div>
          <ul class="debug-kv">
            <li><strong>${this._t("debugLoaded")}:</strong> <code>${escHtml(loadedLocales.join(", ")) || "—"}</code></li>
          </ul>
        </div>
      </div>
    `;
  },

  _buildDebugReport(maskNames = false) {
    const prefix    = this._getPrefix();
    const haVer     = this._hass?.config?.version || "?";
    const lang      = (this._config.language
      || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
    const cfgLang   = this._config.language || null;
    const ua        = (typeof navigator !== "undefined" ? navigator.userAgent : "—").slice(0, 300);
    const evccCount = Object.keys(this._hass?.states || {})
      .filter(id => id.split(".")[1]?.startsWith(prefix)).length;

    const { loadpoints, site, meters } = discoverEntities(this._hass, prefix);

    const allLp    = this._expectedLpSuffixes();
    const allSite  = this._expectedSiteSuffixes();
    const coreLp   = this._coreLpSuffixes();
    const coreSite = this._coreSiteSuffixes();

    const lpNames    = Object.keys(loadpoints);
    const meterNames = Object.keys(meters);
    const lpMask    = Object.fromEntries(lpNames.map((n, i)    => [n, `lp_${i+1}`]));
    const meterMask = Object.fromEntries(meterNames.map((n, i) => [n, `meter_${i+1}`]));
    const dispLp    = n => maskNames ? lpMask[n]    : n;
    const dispMeter = n => maskNames ? meterMask[n] : n;

    const expectedSite = this._filterIndexedExpected(allSite, site);
    const siteSplit    = this._splitCoreOptional(expectedSite, site, coreSite);
    const loadedLocales = Object.keys(this._translations || {});

    const fmtList = (arr, max = 12) =>
      arr.length === 0 ? "—"
        : arr.slice(0, max).join(", ") + (arr.length > max ? `, +${arr.length - max}` : "");

    const out = [];
    out.push(`<details><summary>EVCC Card Debug Report (auto-generated)</summary>`);
    out.push(``);
    out.push(`**Versions**`);
    out.push(`- Card: ${EVCC_CARD_VERSION}`);
    out.push(`- Home Assistant: ${haVer}`);
    out.push(`- Browser: ${ua}`);
    out.push(`- Language: ${lang}${cfgLang ? ` (configured: ${cfgLang})` : ""}`);
    out.push(``);
    out.push(`**Integration**`);
    out.push(`- evcc entity IDs (\`${prefix}*\`): ${evccCount}`);
    out.push(`- Prefix detected: ${this._detectedPrefix ? `\`${this._detectedPrefix}\`` : "*(none)*"}`);
    out.push(`- Prefix configured: ${this._config.prefix ? `\`${this._config.prefix}\`` : "*(none)*"}`);
    out.push(``);

    // ── WebSocket data API (evcc_intg/forecast|sessions|plan_preview) ──
    out.push(`**WebSocket API**`);
    out.push(`- Config entry id: ${this._entryId ? `\`${this._entryId}\`` : "*(not found)*"}`);
    if (!this._capsLoaded) {
      out.push(`- Capabilities: *(probing…)*`);
    } else if (!this._caps || this._caps.commands.length === 0) {
      out.push(`- Capabilities: *not supported (older ha-evcc / unknown command)*`);
    } else {
      out.push(`- Integration version: \`${this._caps.version ?? "—"}\``);
      out.push(`- Commands: ${this._caps.commands.map(c => `\`${c}\``).join(", ")}`);

      // Live probes — read from cache (populated by visual debug block render).
      // Show prefetched probe results (cached by _prefetchDebugProbes).
      const probe = (label, cacheKey, fmt) => {
        const c = this._wsCache[cacheKey];
        if (!c) { out.push(`- ${label}: *(not fetched)*`); return; }
        if (c.result.error) { out.push(`- ${label}: **error** \`${c.result.error}\``); return; }
        out.push(`- ${label}: ${fmt(c.result.data)}`);
      };
      if (this._hasCmd("forecast"))
        probe("forecast (grid)", "forecast:grid",
          d => `${Array.isArray(d?.rates) ? d.rates.length : 0} rates${d?.unit ? ` (${d.unit})` : ""}`);
      if (this._hasCmd("sessions"))
        probe("sessions", "sessions::",
          d => `${Array.isArray(d?.sessions) ? d.sessions.length : 0} sessions`);
    }
    out.push(``);

    out.push(`**Loadpoints** (${lpNames.length})`);
    if (lpNames.length === 0) {
      out.push(`*(none detected)*`);
    } else {
      out.push(`| Name | Core | Optional | Missing core | Missing optional |`);
      out.push(`|---|---|---|---|---|`);
      for (const name of lpNames) {
        const ents     = loadpoints[name];
        const expected = this._filterIndexedExpected(allLp, ents);
        const sp       = this._splitCoreOptional(expected, ents, coreLp);
        const coreMark = sp.missingCore.length === 0 ? "✓" : "✗";
        out.push(`| \`${dispLp(name)}\` | ${sp.foundCore}/${sp.core} ${coreMark} | ${sp.foundOpt}/${sp.opt} | ${fmtList(sp.missingCore, 10)} | ${fmtList(sp.missingOpt, 10)} |`);
      }
    }
    out.push(``);
    out.push(`**Site features** — Core ${siteSplit.foundCore}/${siteSplit.core} ${siteSplit.missingCore.length === 0 ? "✓" : "✗"} · Optional ${siteSplit.foundOpt}/${siteSplit.opt}`);
    if (siteSplit.missingCore.length) out.push(`- Missing core: \`${siteSplit.missingCore.join(", ")}\``);
    if (siteSplit.missingOpt.length)  out.push(`- Missing optional: \`${fmtList(siteSplit.missingOpt, 24)}\``);
    out.push(``);
    out.push(`**Meters / orphan groups** (${meterNames.length})`);
    if (meterNames.length === 0) {
      out.push(`*(none)*`);
    } else {
      for (const name of meterNames) {
        const count = Object.keys(meters[name]).length;
        out.push(`- \`${dispMeter(name)}\` — ${count} entities (no \`charge_power\`)`);
      }
    }
    out.push(``);
    out.push(`**Card configuration**${this._origConfig ? " *(restored from empty state)*" : ""}`);
    out.push("```yaml");
    out.push(this._formatConfigYaml(this._origConfig || this._config, maskNames));
    out.push("```");
    out.push(``);
    out.push(`**Translations**`);
    out.push(`- Loaded: ${loadedLocales.join(", ") || "—"}`);
    out.push(``);
    out.push(`</details>`);
    return out.join("\n");
  },

  // Listeners of the debug view: the report copy button and the mask toggle.
  // Called by _attachListeners() after every render.
  _attachDebugListeners() {
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
  },
};

// Debug mode.
// Part of the card stylesheet, see src/styles.js.
const debugCss = `
      .debug { font-size: .85rem; color: var(--primary-text-color); }
      .debug code { background: color-mix(in srgb, var(--primary-text-color) 8%, transparent); padding: 1px 5px; border-radius: 4px; font-size: .78rem; word-break: break-word; }
      .debug-header {
        display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
        padding-bottom: 10px; margin-bottom: 10px;
        border-bottom: 1px solid var(--divider-color, #4b5563);
      }
      .debug-title { font-size: 1rem; font-weight: 600; flex: 1; }
      .debug-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      .debug-copy-btn {
        background: var(--primary-color); color: var(--text-primary-color, white);
        border: none; border-radius: 6px; padding: 6px 14px; cursor: pointer;
        font: inherit; font-weight: 600;
      }
      .debug-copy-btn:hover { filter: brightness(1.1); }
      .debug-mask { display: inline-flex; align-items: center; gap: 6px; font-size: .8rem; color: var(--secondary-text-color); cursor: pointer; }
      .debug-mask input { margin: 0; }
      .debug-toast {
        flex-basis: 100%; padding: 6px 10px; border-radius: 6px;
        font-size: .78rem; font-weight: 600;
      }
      .debug-toast.ok  { background: color-mix(in srgb, var(--evcc-green, #0a0)  18%, transparent); color: var(--evcc-green, #0a0); }
      .debug-toast.err { background: color-mix(in srgb, #ef4444 18%, transparent); color: #ef4444; }

      .debug-section { margin: 12px 0; }
      .debug-section-title { font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; }
      .debug-kv { list-style: none; padding: 0; margin: 0; }
      .debug-kv li { padding: 3px 0; line-height: 1.5; }
      .debug-kv strong { color: var(--secondary-text-color); font-weight: 500; margin-right: 6px; }
      .debug-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
      .debug-list > li {
        padding: 8px 10px; border-radius: 6px;
        background: color-mix(in srgb, var(--primary-text-color) 4%, transparent);
        border: 1px solid var(--divider-color, #4b5563);
      }
      .debug-list-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .debug-count { color: var(--secondary-text-color); font-size: .78rem; }
      .debug-missing { margin-top: 4px; font-size: .76rem; color: var(--secondary-text-color); line-height: 1.5; }
      .debug-suffix-list { margin: 4px 0; font-size: .78rem; line-height: 1.6; }
      .debug-empty { color: var(--secondary-text-color); font-style: italic; padding: 4px 0; }
      .debug-pill {
        display: inline-flex; align-items: center; padding: 1px 8px;
        border-radius: 999px; font-size: .7rem; font-weight: 700;
      }
      .debug-pill.ok   { background: color-mix(in srgb, var(--evcc-green, #0a0)  20%, transparent); color: var(--evcc-green, #0a0); }
      .debug-pill.warn { background: color-mix(in srgb, var(--evcc-amber, #f59e0b) 20%, transparent); color: var(--evcc-amber, #f59e0b); }
      .debug-pill.err  { background: color-mix(in srgb, #ef4444 20%, transparent); color: #ef4444; }
      .debug-pill.info { background: color-mix(in srgb, var(--primary-text-color) 12%, transparent); color: var(--secondary-text-color); }
      .debug-missing-opt { margin-top: 6px; font-size: .76rem; color: var(--secondary-text-color); }
      .debug-missing-opt summary { cursor: pointer; user-select: none; padding: 2px 0; }
      .debug-missing-opt code { margin-top: 4px; display: inline-block; word-break: break-word; }
      .debug-warn-box { margin-top: 8px; padding: 8px 10px; border-radius: 6px; background: color-mix(in srgb, #ef4444 14%, transparent); color: #ef4444; font-size: .82rem; }
      .debug-cfg-note { margin-bottom: 6px; padding: 6px 10px; border-radius: 6px; background: color-mix(in srgb, var(--primary-color) 12%, transparent); color: var(--primary-color); font-size: .76rem; }
      .debug-yaml {
        background: var(--code-editor-background-color, #1e1e1e);
        color: var(--primary-text-color); padding: 10px; border-radius: 6px;
        font-size: .78rem; line-height: 1.5; white-space: pre-wrap; word-break: break-word;
        margin: 0; max-height: 220px; overflow: auto;
      }
      .debug-fallback-ta {
        width: 100%; min-height: 180px; margin-top: 8px;
        font-family: monospace; font-size: .75rem; padding: 8px;
        border-radius: 6px; border: 1px solid var(--divider-color, #4b5563);
        background: var(--card-background-color); color: var(--primary-text-color);
      }
      .compact-tabs {
        display: flex; gap: 4px; margin-bottom: 12px;
        border-bottom: 1px solid var(--divider-color, #e5e7eb); padding-bottom: 0;
      }
      .compact-tab {
        flex: 1; display: flex; flex-direction: column; align-items: center;
        gap: 2px; padding: 6px 4px 8px; background: transparent; border: none;
        border-bottom: 2px solid transparent; color: var(--secondary-text-color);
        cursor: pointer; font-size: .68rem; margin-bottom: -1px;
        transition: color .15s, border-color .15s;
      }
      .compact-tab:hover { color: var(--primary-text-color); }
      .compact-tab.active { color: var(--primary-color); border-bottom-color: var(--primary-color); font-weight: 600; }
      .compact-tab-icon  { font-size: 1rem; line-height: 1; }
      .compact-tab-label { font-size: .68rem; }
      .compact-panel[hidden] { display: none; }
      .compact-panel .plan-block,
      .compact-panel .session-block { border-top: none; margin-top: 0; padding-top: 0; }
`;

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
const listeners = {
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

    this._attachLoadpointListeners();
    this._attachSliderListeners();
    this._attachPlanListeners();
    this._attachStatsListeners();
    this._attachBatteryListeners();
    this._attachDebugListeners();
    this._attachPriorityListeners();
  },
};

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
const styles = {
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

class EvccCard extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass          = null;
    this._config        = {};
    this._isDragging    = false;
    this._pendingRender = false;
    this._sliderEditing = false;   // direct-input panel open (defers re-renders like a drag)
    this._sliderEditPanel = null;
    this._renderTimer   = null;
    this._lastRenderKey = null;
    this._countdownInterval = null;
    this._planState     = {};
    this._planPreviewDebounce = {};
    this._tabState      = {};
    this._statsPeriod   = "total";
    this._chartCache     = {};
    this._chartCacheTime = {};
    this._translations  = sharedTranslations();
    this._translationsReady = false;

    this._siteTableExpanded = undefined; // undefined = use config default
    this._currentBlockExpanded = {};
    this._detectedPrefix = null;
    this._cachedEntities   = null;  // { loadpoints, site } — invalidated when entity IDs change
    this._cachedEntityIdKey = null; // sorted join of evcc entity IDs + prefix

    // ha-evcc WebSocket data API (evcc_intg/forecast|sessions|plan_preview).
    this._entryId             = null;   // config_entry_id, needed by the WS commands
    this._integrationDetected = false;  // entity-registry probe done once
    this._detectingIntegration = false;
    this._evccInstances = null;         // [{ prefix, entryId }] from that probe, registry order
    this._instancePrefix = undefined;   // config.prefix the current entry_id was chosen for
    this._caps        = null;   // { version, commands[] } from evcc_intg/capabilities
    this._capsLoaded  = false;
    this._capsLoading = null;   // in-flight promise guard
    this._lpIndexMap  = {};     // loadpoint slug -> evcc API index (from capabilities)
    this._wsCache     = {};     // cacheKey -> { ts, data }
    this._wsInflight  = {};     // cacheKey -> Promise (de-dup concurrent fetches)

    this._onPlanReset = (e) => {
      const lpName = e.detail?.lpName;
      setTimeout(() => {
        if (lpName) {
          delete this._planState[lpName];
          clearTimeout(this._planPreviewDebounce[lpName]);
          delete this._planPreviewDebounce[lpName];
        } else {
          this._planState = {};
          for (const k of Object.keys(this._planPreviewDebounce)) clearTimeout(this._planPreviewDebounce[k]);
          this._planPreviewDebounce = {};
        }
        // Purge preview cache entries
        for (const key of Object.keys(this._wsCache)) {
          if (key.startsWith("plan:")) delete this._wsCache[key];
        }
        if (this._hass) this._render();
      }, 1500);
    };
  }

  // Lovelace may detach a card and attach the same instance again (view switch,
  // re-order, edit mode). Everything disconnectedCallback tears down has to be
  // rebuilt here, or the re-mounted card is only half alive.
  connectedCallback() {
    window.addEventListener("evcc-plan-reset", this._onPlanReset);
    if (!this._countdownInterval) {
      this._countdownInterval = setInterval(() => this._tickCountdowns(), 1000);
    }
    // A render that was cancelled on detach is scheduled again from the state
    // we already hold; the setter renders only when something changed.
    if (this._hass) this.hass = this._hass;
  }

  disconnectedCallback() {
    window.removeEventListener("evcc-plan-reset", this._onPlanReset);
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
    // Nothing may render on a detached element: the deferred work would run
    // against a DOM nobody sees, and the re-mount renders from the state held.
    if (this._renderTimer)   { clearTimeout(this._renderTimer);   this._renderTimer   = null; }
    if (this._wsRenderTimer) { clearTimeout(this._wsRenderTimer); this._wsRenderTimer = null; }
    // The re-mount sets the same hass object again; without a snapshot the
    // setter compares the key instead of the state identities, so the render
    // cancelled here is picked up and an unchanged card renders nothing.
    this._seenStates = null;
    for (const k of Object.keys(this._planPreviewDebounce)) clearTimeout(this._planPreviewDebounce[k]);
    this._planPreviewDebounce = {};
    // An open direct-input panel would keep hass updates deferred after re-mount.
    this._pendingRender = false;
    this._closeSliderEdit();
    // Drop the on-demand WS caches. Capabilities and entry_id are kept on
    // purpose: they do not change while the page lives, and re-probing them on
    // every re-mount would be a backend call for nothing.
    this._wsCache    = {};
    this._wsInflight = {};
  }

  async _loadTranslations() {
    await loadSharedTranslations();
    this._translations = sharedTranslations();
    this._translationsReady = true;
  }

  _getPrefix() {
    return this._config.prefix || this._detectedPrefix || "evcc_";
  }

  set hass(hass) {
    this._hass = hass;

    if (!this._integrationDetected && !this._detectingIntegration) {
      this._detectingIntegration = true;
      const probePrefix = this._config.prefix || null;
      detectIntegration(hass, probePrefix).then(({ prefix, entryId, instances }) => {
        this._detectingIntegration = false;
        this._integrationDetected = true;
        this._evccInstances = instances;
        this._instancePrefix = probePrefix;
        this._entryId = entryId;
        // Probe the ha-evcc WebSocket data API once the entry_id is known.
        this._loadCapabilities();
        // The config may have changed while the registry call was in flight.
        this._syncIntegrationInstance();
        // Honour an explicitly configured prefix, but still keep the detected one.
        const changed = (!this._config.prefix && prefix !== this._detectedPrefix);
        this._detectedPrefix = prefix;
        if (changed) {
          this._lastRenderKey = null;
          if (this._renderTimer) {
            clearTimeout(this._renderTimer);
            this._renderTimer = null;
          }
          this._render();
        }
      });
    }

    this._syncIntegrationInstance();

    if (this._isDragging || this._sliderEditing) {
      this._pendingRender = true;
      this._updateLiveValues();
      return;
    }
    // Home Assistant sets `hass` on every state change anywhere in the system,
    // and the key below walks every evcc entity with its attributes. HA keeps
    // the state object of an entity that did not change, so when no evcc
    // entity carries a new object the key cannot differ from the last one and
    // is not built at all.
    if (!this._evccStatesChanged(hass)) return;
    const key = this._buildRenderKey(hass);
    if (key === this._lastRenderKey) return;

    if (this._renderTimer) return;
    this._renderTimer = setTimeout(() => {
      this._renderTimer   = null;
      this._lastRenderKey = this._buildRenderKey(this._hass);
      this._render();
    }, 300);
  }

  // The registry probe runs once, but `prefix` can change afterwards (editor,
  // YAML reload). Re-pick the instance from the probe result so entry_id and
  // prefix always name the same installation; everything derived from the
  // entry (capabilities, loadpoint index map, WS caches) starts over.
  _syncIntegrationInstance() {
    if (!this._evccInstances) return;
    const wanted = this._config.prefix || null;
    if (wanted === this._instancePrefix) return;
    this._instancePrefix = wanted;
    const chosen  = (wanted && this._evccInstances.find(i => i.prefix === wanted)) || this._evccInstances[0] || null;
    const entryId = chosen?.entryId ?? null;
    if (entryId === this._entryId) return;
    this._entryId     = entryId;
    this._caps        = null;
    this._capsLoaded  = false;
    this._capsLoading = null;
    this._lpIndexMap  = {};
    this._wsCache     = {};
    this._wsInflight  = {};
    this._loadCapabilities();
  }

  // The evcc entity ids under the current prefix. Re-filtered only when the
  // entity count or the prefix changes, not on every value update. Returns true
  // when the list was rebuilt, so a caller comparing states knows the set moved.
  _refreshEvccIds(hass) {
    const prefix     = this._getPrefix();
    const stateCount = Object.keys(hass.states).length;
    if (this._evccIds && this._evccIdsCount === stateCount && this._evccIdsPrefix === prefix) return false;
    this._evccIdsCount  = stateCount;
    this._evccIdsPrefix = prefix;
    this._evccIds       = Object.keys(hass.states).filter(id => id.split(".")[1]?.startsWith(prefix));
    return true;
  }

  // True when a hass update can change the render key: an evcc entity carries
  // a new state object, the set of evcc entities moved, the language changed,
  // or no key has been built yet. The snapshot is the previous `states` table;
  // HA copies the table on every update and keeps the untouched entries, so an
  // identity check per evcc entity is enough and no string is built. The
  // snapshot is taken here in every case, or a change seen once would be
  // reported again on the next update.
  _evccStatesChanged(hass) {
    const idsMoved = this._refreshEvccIds(hass);
    const seen     = this._seenStates;
    const lang     = this._config.language || (hass.language ?? "en");
    this._seenStates = hass.states;
    if (idsMoved || !seen || this._lastRenderKey === null || lang !== this._seenLang) {
      this._seenLang = lang;
      return true;
    }
    return this._evccIds.some(id => hass.states[id] !== seen[id]);
  }

  _buildRenderKey(hass) {
    if (!hass) return "";
    this._refreshEvccIds(hass);

    const lang = this._config.language || (hass.language ?? "en");
    // \u001f (unit separator) keeps attribute values from colliding with the
    // key's own delimiters; a title or an option may contain anything else.
    return lang + "|" + this._evccIds.map(id => {
      const s = hass.states[id];
      if (!s) return `${id}=`;
      let part = `${id}=${s.state}`;
      const a = s.attributes;
      if (a) {
        for (const name of RENDER_ATTRS) {
          const v = a[name];
          if (v === undefined) continue;
          part += `\u001f${name}=${typeof v === "object" && v !== null ? JSON.stringify(v) : v}`;
        }
      }
      return part;
    }).join("|");
  }

  // Home Assistant sizes the layout from this, one unit being 50 px, in the
  // masonry view and as the row span in a section. A rendered card measures
  // itself, because no per-mode estimate survives the configuration: a collapsed
  // detail table, a hidden footer, the number of loadpoints and the `size` scale
  // each move the height, and a site card runs from 2 to 12 units across them.
  // HA asks again whenever it relayouts, so this is the value it sees in
  // practice; the estimate covers the moment before the first render and the
  // time the translations are still loading, when the shadow root holds the
  // loading placeholder, an ha-card of its own that says nothing about the
  // card's height.
  getCardSize() {
    if (this._translationsReady) {
      const rendered = this.shadowRoot?.querySelector("ha-card")?.getBoundingClientRect().height;
      if (rendered > 0) return Math.max(1, Math.ceil(rendered / 50));
    }
    return this._estimatedCardSize();
  }

  // The pre-render fallback: the bare card per mode, plus the two blocks a
  // configuration can remove. It must answer without hass and without a single
  // discovered entity, so it never returns 0. The `size` scale is not in here:
  // it only stretches the card once it renders, and then the measurement wins.
  _estimatedCardSize() {
    const mode = this._config?.mode || "loadpoint";
    let rows = CARD_SIZES[mode] ?? CARD_SIZES.loadpoint;
    if (mode === "loadpoint" || mode === "compact") rows *= this._sizedLoadpointCount();
    if (this._config?.site_details !== "collapsed") rows += CARD_SIZE_DETAILS[mode] ?? 0;
    if (normalizeStatsPeriod(this._config?.stats_period, "total") !== "none") {
      rows += CARD_SIZE_FOOTER[mode] ?? 0;
    }
    return Math.max(1, rows);
  }

  // How many loadpoints the card would draw: the discovered ones narrowed by the
  // `loadpoints` filter. Nothing is discovered before the first render, so a
  // configured filter still yields a count there and everything else falls back
  // to one loadpoint rather than to zero.
  _sizedLoadpointCount() {
    const filter = loadpointFilter(this._config);
    const found  = this._cachedEntities?.loadpoints || {};
    const n = Object.keys(found).length
      ? Object.keys(selectLoadpoints(found, this._config)).length
      : (filter ? filter.length : 0);
    return Math.max(1, n);
  }

  // Width only, on purpose. A cell of the sections grid is 56 px high with an
  // 8 px gap, and a card that declares no `rows` keeps its own height instead of
  // being fitted into that raster. This card's height depends on how many
  // loadpoints were discovered, whether the detail tables are expanded and
  // whether a plan is running, so any fixed row count is wrong in one of two
  // ways: too tall leaves an empty area under the card, too short lets the
  // content spill over the card below it. `min_columns` is the one useful limit:
  // a column is about 30 px, and the card starts to run over its own edge below
  // roughly 272 px. The layout editor resizes in steps of three columns unless
  // its precision mode is on, so the floor sits on that raster: nine columns,
  // about 334 px. Eight would fit as well, but reads as nine to everyone who
  // drags the handle, and nobody runs the card narrower than that anyway.
  getGridOptions() {
    return { min_columns: 9 };
  }

  static getConfigElement() {
    return document.createElement("evcc-card-editor");
  }

  static getStubConfig() {
    return { mode: "loadpoint" };
  }

  setConfig(config) {
    // Throws before anything is applied, so a rejected config leaves the card on
    // the one it had and Home Assistant shows its error card with the reason.
    validateCardConfig(config);
    this._config = config || {};
    this._syncIntegrationInstance();
    // Both stats paths are fed from the same normalised value, so the current
    // vocabulary (month/year/total/none) and the legacy one (30d/365d/thisYear)
    // steer them the same way. The stats mode opens on the most recent month
    // when nothing is configured; `none` only hides the footer, so the full view
    // shows that default too.
    const rawPeriod  = config?.stats_period;
    const scope      = normalizeStatsPeriod(rawPeriod, "month");
    this._statsScope = scope === "none" ? "month" : scope;
    // The legacy path keeps a configured legacy value exactly as it is, and
    // defaults to "total" rather than to the stats mode's most recent month.
    this._statsPeriod = legacyStatsPeriod(rawPeriod, "total");
    if (this._statsMetric == null) this._statsMetric = "energy"; // energy | cost | co2
    if (this._statsGroup  == null) this._statsGroup  = "solar";  // solar | loadpoint | vehicle

    if (!this._translationsReady && !this._loadingTranslations) {
      this._loadingTranslations = true;
      this._loadTranslations().then(() => {
        this._loadingTranslations = false;
        if (this._hass) this._render();
      });
    } else if (this._hass && this._translationsReady) {
      this._lastRenderKey = null;
      this._render();
    }
  }

  _toggleSite() {
    const wasExpanded = this._siteTableExpanded !== undefined
      ? this._siteTableExpanded
      : (this._config.site_details !== "collapsed");
    this._siteTableExpanded = !wasExpanded;

    const root = this.shadowRoot;
    const table = root?.querySelector(".site-table");
    if (table) table.style.display = wasExpanded ? "none" : "";
    const wrap = root?.querySelector(".flow-wrap-clickable");
    if (wrap) {
      wrap.title = !wasExpanded ? this._t("siteCollapse") : this._t("siteExpand");
    }
    const chevronPath = root?.querySelector(".sankey-center-chevron path");
    if (chevronPath) chevronPath.setAttribute("d", !wasExpanded
      ? "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z"
      : "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z");
  }

  _t(key, replacements = {}) {
    // Use pre-resolved strings from current render cycle; fall back to resolving on demand
    const strings = this._renderStrings ?? (() => {
      const lang = (this._config.language
        || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
      return this._translations[lang] || this._translations["en"] || {};
    })();

    let val = strings[key] ?? key;

    for (const [k, v] of Object.entries(replacements)) {
      val = val.replace(`{${k}}`, v);
    }

    return val;
  }

  _render() {
    if (!this._hass) return;
    // A priority drag holds live DOM references (row, placeholder, captured
    // handle). Replacing the shadow DOM now would orphan it and leave
    // _isDragging stuck. Defer; _priorityDragEnd re-renders.
    if (this._priorityDragging) { this._pendingRender = true; return; }
    // A full re-render replaces the shadow DOM, so an open direct-input panel is
    // gone afterwards; clear the flag or hass updates would stay deferred.
    this._sliderEditing   = false;
    this._sliderEditPanel = null;
    this._dropSliderEditOutside();
    if (!this._translationsReady) {
      if (!this.shadowRoot.firstChild) {
        this.shadowRoot.innerHTML = `
          <style>:host{display:block}
          .loading{padding:24px;text-align:center;color:var(--secondary-text-color);font-size:.9rem}</style>
          <ha-card><div class="loading">⏳</div></ha-card>`;
      }
      return;
    }

    // Resolve language strings once per render — reused by all _t() calls
    const lang = (this._config.language
      || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
    this._renderStrings = this._translations[lang] || this._translations["en"] || {};

    const prefix = this._getPrefix();

    // Cache discoverEntities() — only re-run when the set of entity IDs changes (not on value updates)
    const idsForKey = Object.keys(this._hass.states).filter(id => id.split(".")[1]?.startsWith(prefix));
    const evccIdKey = prefix + "|" + idsForKey.sort().join(",");
    if (evccIdKey !== this._cachedEntityIdKey) {
      this._cachedEntityIdKey = evccIdKey;
      this._cachedEntities    = discoverEntities(this._hass, prefix);
    }
    const { loadpoints, site, meters } = this._cachedEntities;

    const visible = selectLoadpoints(loadpoints, this._config);

    // disabled_loadpoints: hide (default) | dim | show - how to treat
    // loadpoints that are disabled in the evcc config (ha-evcc 2026.8.8+).
    // setConfig() has already rejected anything outside DISABLED_LOADPOINT_MODES.
    const dlpOpt = this._config.disabled_loadpoints || "hide";
    const { enabled: lpEnabled, disabled: lpDisabled } =
      partitionDisabledLoadpoints(this._hass, visible);
    // Interactive modes (plan/priority) can never work on a disabled
    // loadpoint - its entities don't exist - so those always get lpEnabled.
    const lpVisible = dlpOpt === "show" ? visible : lpEnabled;
    const dimmed    = dlpOpt === "dim"  ? lpDisabled : {};
    const allDisabled = Object.keys(visible).length > 0
      && Object.keys(lpEnabled).length === 0;

    this.shadowRoot.innerHTML = `
      ${this._styleTag()}
      <div class="evcc-scale-wrap"${this._config.size ? ` data-size="${this._config.size}"` : ""}><ha-card>
        <div class="card-content">
        ${this._config.mode === "debug"
            ? this._renderDebugBlock(loadpoints, site, meters)
            : this._config.mode === "battery"
            ? this._renderBatteryBlock(site)
            : this._config.mode === "site"
              ? this._renderSiteBlock(site, loadpoints)
              : this._config.mode === "flow"
              ? this._renderFlowBlock(site, loadpoints)
              : (this._config.mode === "grid" || this._config.mode === "site2")
              ? this._renderSiteBlock2(site, loadpoints)
              : this._config.mode === "stats"
              ? this._renderStatsBlock()
              : this._config.mode === "plan"
                ? this._renderPlanMode(lpEnabled)
                : this._config.mode === "repeatplan"
                ? this._renderRepeatPlansMode()
                : this._config.mode === "priority"
                  ? this._renderPriorityMode(lpEnabled)
                : this._config.mode === "compact"
                  ? (Object.keys(lpVisible).length === 0 && Object.keys(dimmed).length === 0
                      ? (allDisabled
                          ? this._renderAllDisabled()
                          : this._renderEmpty(loadpoints))
                      : Object.entries(lpVisible)
                          .map(([lp, ents]) => this._renderCompactLoadpoint(lp, ents))
                          .join("")
                        + Object.entries(dimmed)
                          .map(([lp, ents]) => this._renderDisabledLoadpoint(lp, ents))
                          .join(""))
                  : Object.keys(lpVisible).length === 0 && Object.keys(dimmed).length === 0
              ? (allDisabled
                  ? this._renderAllDisabled()
                  : this._renderEmpty(loadpoints))
              : Object.entries(lpVisible)
                  .map(([lp, ents]) => this._renderLoadpoint(lp, ents))
                  .join("")
                + Object.entries(dimmed)
                  .map(([lp, ents]) => this._renderDisabledLoadpoint(lp, ents))
                  .join("")
          }
        </div>
      </ha-card></div>
    `;
    this._attachListeners();
  }

  _updateLiveValues() {
    const root = this.shadowRoot;
    root.querySelectorAll("[data-live-entity]").forEach(el => {
      const entityId = el.dataset.liveEntity;
      const type     = el.dataset.liveType;
      if (!entityId) return;

      if (type === "soc-fill") {
        const soc      = parseFloat(stateVal(this._hass, entityId)) || 0;
        const minSoc   = parseFloat(el.dataset.minSoc)   || 0;
        const limitSoc = parseFloat(el.dataset.limitSoc) || 100;
        el.style.width      = `${soc}%`;
        el.style.background = socFillGradient(soc, minSoc, limitSoc);
      } else if (type === "soc-pct") {
        const soc = parseFloat(stateVal(this._hass, entityId)) || 0;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M15.67,4H14V2H10V4H8.33C7.6,4 7,4.6 7,5.33V20.67C7,21.4 7.6,22 8.33,22H15.67C16.4,22 17,21.4 17,20.67V5.33C17,4.6 16.4,4 15.67,4M13,18H11V16H9L12,11V14H14L13,18Z"/></svg> ${Math.round(soc)} ${escHtml(unitStr(this._hass, entityId))}`;
      } else if (type === "power") {
        el.textContent = `${parseFloat(stateVal(this._hass, entityId)).toFixed(1)} ${unitStr(this._hass, entityId)}`;
      }
    });
  }

  _tickCountdowns() {
    const root = this.shadowRoot;
    if (!root) return;
    root.querySelectorAll("[data-countdown-target]").forEach(el => {
      const ts = el.dataset.countdownTarget;
      if (!ts) return;
      const target = Date.parse(ts);
      if (isNaN(target)) return;
      const sec = Math.max(0, Math.round((target - Date.now()) / 1000));
      const cd = sec <= 0
        ? ""
        : sec < 60
          ? `${sec}s`
          : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
      const key = el.dataset.countdownLabel;
      if (key) {
        el.textContent = this._t(key, { val: cd || "—" });
      }
    });
  }
}

// Mode views, components and shared behaviour are plain objects of methods
// (no framework): mix them into the prototype, refusing silent overrides.
const mixins = [actions, evccApi, loadpointView, socControl, planningView, priorityView, siteView, flowView, gridView, statisticsLegacy, statisticsView, batteryView, debugView, listeners, styles];
for (const m of mixins) {
  for (const key of Object.keys(m)) {
    if (key in EvccCard.prototype) throw new Error(`evcc-card: duplicate method ${key}`);
  }
}
Object.assign(EvccCard.prototype, ...mixins);

class EvccCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = null;
    this._availableLoadpoints = [];
    this._detectedPrefix = null;
    this._detectingPrefix = false;
    this._instances = [];   // every ha-evcc entry in the registry, first one is the default
  }

  _t(key, replacements = {}) {
    const lang = (this._config?.language
      || (this._hass?.language ?? "en")).split("-")[0].toLowerCase();
    const t = sharedTranslations();
    const strings = t[lang] || t["en"] || {};
    let val = strings[key] ?? key;
    for (const [k, v] of Object.entries(replacements)) val = val.replace(`{${k}}`, v);
    return val;
  }

  set hass(hass) {
    this._hass = hass;
    if (!sharedTranslationsReady()) {
      loadSharedTranslations().then(() => this._render());
    }
    if (!this._detectedPrefix && !this._detectingPrefix) {
      this._detectingPrefix = true;
      detectIntegration(hass).then(({ prefix, instances }) => {
        this._detectingPrefix = false;
        this._detectedPrefix = prefix;
        this._instances = instances;
        this._discoverLoadpoints();
        this._render();
      });
      return;
    }
    const prev = this._availableLoadpoints.join(",");
    this._discoverLoadpoints();
    const next = this._availableLoadpoints.join(",");
    if (prev !== next) this._render();
  }

  setConfig(config) {
    this._config = { ...config };
    if (this.shadowRoot?.activeElement?.tagName === "INPUT") return;
    this._discoverLoadpoints();
    this._render();
  }

  _getPrefix() {
    return this._config.prefix || this._detectedPrefix || "evcc_";
  }

  _discoverLoadpoints() {
    if (!this._hass) return;
    const prefix = this._getPrefix();
    const { loadpoints } = discoverEntities(this._hass, prefix);
    this._availableLoadpoints = Object.keys(loadpoints).sort();
  }

  _esc(str) {
    return escHtml(str);
  }

  _fire() {
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: { ...this._config } },
      bubbles: true,
      composed: true,
    }));
  }

  // The ha-evcc entries the registry reports, as select options. Only shown
  // with more than one entry, or when the config names a prefix the registry
  // does not know, so it can be cleared. The registry carries no entry title,
  // so the prefix stands in for it, underscores read as spaces.
  _instanceOptions() {
    const cfg = this._config.prefix;
    const opts = this._instances.map((inst, i) => {
      const name = inst.prefix.replace(/_$/, "").replace(/_/g, " ");
      return [inst.prefix, i === 0 ? `${name} (${this._t("editorInstanceDefault")})` : name];
    });
    if (cfg && !this._instances.some(inst => inst.prefix === cfg)) opts.push([cfg, cfg]);
    return opts.length > 1 || (cfg && !this._instances.some(inst => inst.prefix === cfg)) ? opts : null;
  }

  _sel(id, options, current) {
    return `<select id="${id}" class="ha-select">
      ${options.map(([val, label]) =>
        `<option value="${val}"${current === val ? " selected" : ""}>${label}</option>`
      ).join("")}
    </select>`;
  }

  _checkboxes(type, selected) {
    const lps = this._availableLoadpoints;
    if (lps.length === 0) return `<div class="hint">${this._t("editorNoLoadpointsFound")}</div>`;
    return lps.map(lp => `
      <label class="cb-row">
        <input type="checkbox" data-field="${type}" data-lp="${this._esc(lp)}" ${selected.includes(lp) ? "checked" : ""}>
        <span>${this._esc(lp)}</span>
      </label>
    `).join("");
  }

  _vehicleCheckboxes(type, selected) {
    const slugs = this._availableVehicleSlugs;
    if (slugs.length === 0) return `<div class="hint">${this._t("editorNoVehiclesFound")}</div>`;
    return slugs.map(slug => {
      const label = String(slug).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      return `
      <label class="cb-row">
        <input type="checkbox" data-field="${type}" data-lp="${this._esc(slug)}" ${selected.includes(slug) ? "checked" : ""}>
        <span>${this._esc(label)}</span>
      </label>`;
    }).join("");
  }

  get _availableVehicleSlugs() {
    if (!this._hass) return [];
    const prefix = this._getPrefix();
    const escPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`^switch\\.${escPrefix}(.+)_repeating_plan_\\d+$`);
    const slugs = new Set();
    for (const entityId of Object.keys(this._hass.states)) {
      const m = entityId.match(re);
      if (m) slugs.add(m[1]);
    }
    return [...slugs].sort();
  }

  _render() {
    const c    = this._config;
    const mode = c.mode || "loadpoint";
    const selLps = Array.isArray(c.loadpoints) ? c.loadpoints : [];
    const noPlan  = Array.isArray(c.no_plan)   ? c.no_plan   : [];
    const noPv    = Array.isArray(c.no_pv)     ? c.no_pv     : [];

    const showLoadpoints    = ["loadpoint", "compact", "plan", "priority"].includes(mode);
    const showNoPlan        = ["loadpoint", "compact"].includes(mode);
    const showChargeCurrent = ["loadpoint", "compact"].includes(mode);
    const hideSettings      = Array.isArray(c.hide_settings) ? c.hide_settings : [];
    const showSiteDetails   = ["site", "flow"].includes(mode);
    const showStatsPeriod   = ["stats", "site", "flow", "grid"].includes(mode);
    const showVehicleFilter = mode === "repeatplan";
    const rplanVehicles     = Array.isArray(c.repeating_plan_vehicles) ? c.repeating_plan_vehicles : [];
    const instanceOptions   = this._instanceOptions();

    // `stats_period` has no implicit value: unconfigured, every mode follows its
    // own default (the stats mode opens on the most recent month, the compact
    // footer under site/flow/grid sums everything up). The editor names that
    // default instead of preselecting an option the card does not use.
    const statsPeriodOptions = [
      ["",      this._t("editorStatsPeriodDefault", {
                  val: mode === "stats" ? this._t("statsPeriodMonth") : this._t("editorStatsPeriodTotal") })],
      ["month", this._t("statsPeriodMonth")],
      ["year",  this._t("statsPeriodYear")],
      ["total", this._t("editorStatsPeriodTotal")],
      ["none",  this._t("editorStatsPeriodNone")],
    ];
    // The legacy vocabulary stays valid in existing YAML and keeps its own
    // meaning (365d is a rolling window, not the calendar year). So the select
    // offers the configured legacy value as an option of its own rather than
    // showing a neighbouring one, and rewrites it only when the user picks
    // something else.
    const legacyPeriodLabels = {
      "30d":      "editorStatsPeriod30d",
      "365d":     "editorStatsPeriod365d",
      "thisYear": "editorStatsPeriodThisYear",
    };
    if (legacyPeriodLabels[c.stats_period]) {
      statsPeriodOptions.push([c.stats_period, this._t(legacyPeriodLabels[c.stats_period])]);
    }

    const titlePlaceholder = {
      loadpoint: this._t("editorTitlePlaceholderLoadpoint"),
      compact:   this._t("editorTitlePlaceholderCompact"),
      plan:      this._t("editorTitlePlaceholderPlan"),
      repeatplan:this._t("editorTitlePlaceholderRepeatplan"),
      priority:  this._t("editorTitlePlaceholderPriority"),
      site:      this._t("editorTitlePlaceholderSite"),
      flow:      this._t("editorTitlePlaceholderFlow"),
      grid:      this._t("editorTitlePlaceholderGrid"),
      stats:     this._t("editorTitlePlaceholderStats"),
      battery:   this._t("editorTitlePlaceholderBattery"),
    }[mode] || this._t("editorTitlePlaceholderLoadpoint");

    const modeDesc = {
      loadpoint:  this._t("editorModeDescLoadpoint"),
      compact:    this._t("editorModeDescCompact"),
      site:       this._t("editorModeDescSite"),
      flow:       this._t("editorModeDescFlow"),
      grid:       this._t("editorModeDescGrid"),
      battery:    this._t("editorModeDescBattery"),
      stats:      this._t("editorModeDescStats"),
      plan:       this._t("editorModeDescPlan"),
      repeatplan: this._t("editorModeDescRepeatplan"),
      priority:   this._t("editorModeDescPriority"),
      debug:      this._t("editorModeDescDebug"),
    }[mode] || "";

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .form { display: flex; flex-direction: column; gap: 16px; }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field-label { font-size: .875rem; font-weight: 500; color: var(--primary-text-color); }
        .section-title { font-size: .75rem; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: var(--secondary-text-color); }
        .hint { font-size: .75rem; color: var(--secondary-text-color); }
        .ha-select, .ha-input {
          width: 100%; padding: 8px 12px; border-radius: 4px; font-size: 1rem;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color, #e0e0e0);
          box-sizing: border-box; font-family: inherit;
        }
        .ha-select:focus, .ha-input:focus { outline: none; border-color: var(--primary-color); }
        .cb-row { display: flex; align-items: center; gap: 8px; font-size: .875rem; cursor: pointer; padding: 4px 0; }
        .cb-row input[type="checkbox"] { accent-color: var(--primary-color); width: 16px; height: 16px; cursor: pointer; }
      </style>
      <div class="form">
        <div class="field">
          <label class="field-label" for="mode">${this._t("editorModeLabel")}</label>
          ${this._sel("mode", [
            ["loadpoint", this._t("editorModeLoadpoint")],
            ["compact",   this._t("editorModeCompact")],
            ["site",      this._t("editorModeSite")],
            ["flow",      this._t("editorModeFlow")],
            ["grid",      this._t("editorModeGrid")],
            ["battery",   this._t("editorModeBattery")],
            ["stats",     this._t("editorModeStats")],
            ["plan",      this._t("editorModePlan")],
            ["repeatplan",this._t("editorModeRepeatplan")],
            ["priority",  this._t("editorModePriority")],
            ["debug",     this._t("editorModeDebug")],
          ], mode)}
          ${modeDesc ? `<div class="hint">${modeDesc}</div>` : ""}
        </div>
        ${instanceOptions ? `
        <div class="field">
          <label class="field-label" for="prefix">${this._t("editorInstanceLabel")}</label>
          ${this._sel("prefix", instanceOptions, this._getPrefix())}
          <div class="hint">${this._t("editorInstanceHint")}</div>
        </div>
        ` : ""}
        <div class="field">
          <label class="field-label" for="title">${this._t("editorTitleLabel")} <span class="hint" style="display:inline">(${this._t("editorOptional")})</span></label>
          <input id="title" class="ha-input" type="text" value="${this._esc(c.title || "")}" placeholder="${titlePlaceholder}">
        </div>
        <div class="field">
          <label class="field-label" for="language">${this._t("editorLanguageLabel")}</label>
          ${this._sel("language", [
            ["",   this._t("editorLanguageAuto")],
            ["de", this._t("editorLanguageNameDe")],
            ["en", this._t("editorLanguageNameEn")],
            ["es", this._t("editorLanguageNameEs")],
            ["fr", this._t("editorLanguageNameFr")],
            ["hr", this._t("editorLanguageNameHr")],
            ["nl", this._t("editorLanguageNameNl")],
            ["pl", this._t("editorLanguageNamePl")],
            ["pt", this._t("editorLanguageNamePt")],
          ], c.language || "")}
        </div>
        <div class="field">
          <label class="field-label" for="size">${this._t("editorSizeLabel")}</label>
          ${this._sel("size", [
            ["",       this._t("editorSizeAuto")],
            ["small",  this._t("editorSizeSmall")],
            ["medium", this._t("editorSizeMedium")],
            ["large",  this._t("editorSizeLarge")],
          ], c.size || "")}
        </div>
        ${showLoadpoints ? `
        <div class="field">
          <div class="section-title">${this._t("editorShowLoadpointsTitle")}</div>
          <div class="hint">${this._t("editorShowLoadpointsHint")}</div>
          ${this._checkboxes("loadpoints", selLps)}
        </div>
        ` : ""}
        ${showLoadpoints ? `
        <div class="field">
          <label class="field-label" for="disabled_loadpoints">${this._t("editorDisabledLoadpointsLabel")}</label>
          ${this._sel("disabled_loadpoints", [
            ["",     this._t("editorDisabledLoadpointsHide")],
            ["dim",  this._t("editorDisabledLoadpointsDim")],
            ["show", this._t("editorDisabledLoadpointsShow")],
          ], c.disabled_loadpoints || "")}
          <div class="hint">${this._t("editorDisabledLoadpointsHint")}</div>
        </div>
        ` : ""}
        ${showVehicleFilter ? `
        <div class="field">
          <div class="section-title">${this._t("editorVehicleFilterTitle")}</div>
          <div class="hint">${this._t("editorVehicleFilterHint")}</div>
          ${this._vehicleCheckboxes("repeating_plan_vehicles", rplanVehicles)}
        </div>
        ` : ""}
        ${showNoPlan ? `
        <div class="field">
          <div class="section-title">${this._t("editorNoPlanForTitle")}</div>
          ${this._checkboxes("no_plan", noPlan)}
        </div>
        ` : ""}
        ${showNoPlan ? `
        <div class="field">
          <div class="section-title">${this._t("editorNoPvForTitle")}</div>
          ${this._checkboxes("no_pv", noPv)}
        </div>
        ` : ""}
        ${showChargeCurrent ? `
        <div class="field">
          <label class="field-label" for="charge_current_settings">${this._t("editorChargeCurrentSettingsLabel")}</label>
          ${this._sel("charge_current_settings", [
            ["collapsed", this._t("editorCollapsed")],
            ["expanded",  this._t("editorExpanded")],
          ], c.charge_current_settings || "collapsed")}
        </div>
        ` : ""}
        ${showChargeCurrent ? `
        <div class="field">
          <div class="section-title">${this._t("editorHideSettingsTitle")}</div>
          <div class="hint">${this._t("editorHideSettingsHint")}</div>
          ${HIDEABLE_SETTINGS.map(([key, labelKey]) => `
            <label class="cb-row">
              <input type="checkbox" data-field="hide_settings" data-lp="${key}" ${hideSettings.includes(key) ? "checked" : ""}>
              <span>${this._esc(this._t(labelKey))}</span>
            </label>`).join("")}
        </div>
        ` : ""}
        ${showSiteDetails ? `
        <div class="field">
          <label class="field-label" for="site_details">${this._t("editorSiteDetailsLabel")}</label>
          ${this._sel("site_details", [
            ["expanded",  this._t("editorExpanded")],
            ["collapsed", this._t("editorCollapsed")],
          ], c.site_details || "expanded")}
        </div>
        ` : ""}
        ${showStatsPeriod ? `
        <div class="field">
          <label class="field-label" for="stats_period">${this._t("editorStatsPeriodLabel")}</label>
          ${this._sel("stats_period", statsPeriodOptions, c.stats_period || "")}
        </div>
        ` : ""}
      </div>
    `;

    this._addListeners();
  }

  _addListeners() {
    ["mode", "language", "site_details", "charge_current_settings", "stats_period", "size", "disabled_loadpoints"].forEach(id => {
      const el = this.shadowRoot.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        this._config = { ...this._config, [id]: el.value || undefined };
        this._fire();
        if (id === "mode") this._render();
      });
    });

    // Instance: the first entry is what the card detects on its own, so picking
    // it drops `prefix` from the config. Loadpoint and vehicle selections belong
    // to the instance they were made for and are cleared along with the switch.
    const prefixEl = this.shadowRoot.getElementById("prefix");
    if (prefixEl) {
      prefixEl.addEventListener("change", () => {
        const chosen = prefixEl.value;
        const isDefault = this._instances.length > 0 && chosen === this._instances[0].prefix;
        this._config = {
          ...this._config,
          prefix: isDefault ? undefined : chosen,
          loadpoints: undefined, no_plan: undefined, no_pv: undefined, repeating_plan_vehicles: undefined,
        };
        this._discoverLoadpoints();
        this._fire();
        this._render();
      });
    }

    const titleEl = this.shadowRoot.getElementById("title");
    if (titleEl) {
      titleEl.addEventListener("input", () => {
        const val = titleEl.value.trim();
        this._config = { ...this._config, title: val || undefined };
        this._fire();
      });
    }

    this.shadowRoot.querySelectorAll("input[type=checkbox]").forEach(cb => {
      cb.addEventListener("change", () => {
        const field = cb.dataset.field;
        const lp    = cb.dataset.lp;
        const current = Array.isArray(this._config[field]) ? [...this._config[field]] : [];
        if (cb.checked) {
          if (!current.includes(lp)) current.push(lp);
        } else {
          const idx = current.indexOf(lp);
          if (idx > -1) current.splice(idx, 1);
        }
        this._config = { ...this._config, [field]: current.length > 0 ? current : undefined };
        this._fire();
      });
    });
  }
}

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
