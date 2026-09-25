export const EVCC_CARD_VERSION = "0.8.7";

export const FEATURES = [
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
  // ha-evcc 2026.9.5+ (evcc 0.316): the share of the minimum charging power that
  // has to come from solar, 0 to 100 %. evcc locks it while a power threshold is set.
  { suffix: "solar_share",         domain: "number",        type: "slider",        lp: true  },
  { suffix: "enable_threshold",    domain: "number",        type: "info",          lp: true  },
  { suffix: "disable_threshold",   domain: "number",        type: "info",          lp: true  },
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
  { suffix: "plan_energy",             domain: "sensor", type: "info", lp: true },
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
export const SMART_MODE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V19A1,1 0 0,1 14,20H10A1,1 0 0,1 9,19V17.2C7.21,16.16 6,14.22 6,12A6,6 0 0,1 12,6M14,21V22A1,1 0 0,1 13,23H11A1,1 0 0,1 10,22V21H14M20,11H23V13H20V11M1,11H4V13H1V11M13,1V4H11V1H13M4.92,3.5L7.05,5.64L5.63,7.05L3.5,4.93L4.92,3.5M16.95,5.63L19.07,3.5L20.5,4.93L18.37,7.05L16.95,5.63Z"/></svg>`;

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

export function normalizeStatsPeriod(value, fallback = "total") {
  return STATS_PERIOD_ALIASES[value] ?? fallback;
}

// How a normalised period falls back onto the legacy entity/recorder path,
// which has periods of its own. A configured legacy value is passed through
// untouched instead (365d is "the last 365 days", not the calendar year), so
// existing dashboards keep exactly the view they had.
export const STATS_PERIOD_LEGACY_VALUES = ["30d", "365d", "thisYear", "total"];
export const STATS_PERIOD_TO_LEGACY = { month: "30d", year: "thisYear", total: "total", none: "total" };

// The legacy period a configured value ends up on. Used by the stats mode and
// by the compact footer, so both reach the same stat_* entities.
export function legacyStatsPeriod(value, fallback = "total") {
  return STATS_PERIOD_LEGACY_VALUES.includes(value)
    ? value
    : STATS_PERIOD_TO_LEGACY[normalizeStatsPeriod(value, fallback)];
}

// Fallback height per mode in Home Assistant's units (one unit is 50 px), used
// only before the card has rendered once; a rendered card measures itself. The
// numbers are the bare card: the detail table and the statistics footer are
// added below, because a configuration can switch both off and that moves a
// site card by a factor of five.
export const CARD_SIZES = {
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
export const CARD_SIZE_DETAILS = { site: 8, flow: 6 };
export const CARD_SIZE_FOOTER  = { site: 1, flow: 1, grid: 1, site2: 1 };

// Every mode the card renders, and the values the other enumerated options take.
// setConfig() rejects anything outside these lists. The modes are spelled out
// rather than read off CARD_SIZES: a mode is a view and a _render branch, the
// height table is an estimate that may or may not know it. `site2` is the
// former name of `grid` and stays valid so dashboards carrying it keep working.
export const CARD_MODES = [
  "loadpoint", "compact", "plan", "repeatplan", "priority",
  "site", "flow", "grid", "site2", "stats", "battery", "debug",
];
export const CARD_SIZE_OPTIONS        = ["small", "medium", "large"];
export const DISABLED_LOADPOINT_MODES = ["hide", "dim", "show"];
export const STATS_PERIOD_OPTIONS     = Object.keys(STATS_PERIOD_ALIASES);

// The `loadpoints` option as a list, or null when it is not set. A single name
// is shorthand for a list of one. Every reader of the option goes through here,
// so the shorthand and "not set" mean the same thing everywhere; a value that
// is set but empty never gets past validateCardConfig().
export function loadpointFilter(config) {
  const raw = config?.loadpoints;
  if (raw === undefined || raw === null) return null;
  return Array.isArray(raw) ? raw : [raw];
}

// Home Assistant expects setConfig() to throw on a configuration the card cannot
// render: it catches the error and shows its own error card with the message, so
// a typo in the YAML is visible instead of quietly rendering something else. The
// messages are English because that is where they end up, in the HA error card.
export function validateCardConfig(config) {
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
export const RENDER_ATTRS = [
  "options", "min", "max", "step", "unit_of_measurement", "device_class",
  "title", "loadpoint_title", "vehicle", "soc", "time", "weekdays",
];

// Settings the user can drop from the loadpoint/compact card via
// `hide_settings: [...]`. Keys are the ha-evcc feature suffixes (plus the two
// non-slider controls); the label keys are shared with the card itself.
export const HIDEABLE_SETTINGS = [
  ["limit_soc",                    "targetSoc"],
  ["min_soc",                      "minSoc"],
  ["phases",                       "phases"],
  ["max_current",                  "maxCurrent"],
  ["min_current",                  "minCurrent"],
  ["battery_boost",                "batteryBoost"],
  ["solar_share",                  "solarShare"],
  ["priority",                     "priority"],
  ["smart_cost_limit",             "smartCostLimitPrice"],
  ["smart_feed_in_priority_limit", "feedInPriorityLimit"],
];

// ha-evcc entities that are created disabled in the entity registry although a
// control of the loadpoint card depends on them. While one of them is off, the
// loadpoint header shows a warning triangle to administrators (unless
// `hide_disabled_hint`), and the debug view and the editor offer to enable it.
//   hide:   the hide_settings key that drops the control, and the triangle with it
//   needs:  the control only exists next to this entity, enabled or disabled
//   energy: only while the vehicle charges by energy instead of SoC
//   what:   translation key naming what the card is missing
export const DISABLED_NEEDED = [
  { domain: "button", suffix: "smart_cost_limit",             hide: "smart_cost_limit",             needs: "number.smart_cost_limit",             what: "disabledWhatSmartCostClear" },
  { domain: "number", suffix: "smart_feed_in_priority_limit", hide: "smart_feed_in_priority_limit",                                               what: "disabledWhatFeedIn" },
  { domain: "button", suffix: "smart_feed_in_priority_limit", hide: "smart_feed_in_priority_limit", needs: "number.smart_feed_in_priority_limit", what: "disabledWhatFeedInClear" },
  { domain: "number", suffix: "limit_energy",                 hide: "limit_soc",                    energy: true,                                   what: "disabledWhatLimitEnergy" },
  { domain: "sensor", suffix: "phase_action",                 needs: "select.phases_configured",                                              what: "disabledWhatPhaseAction" },
  { domain: "sensor", suffix: "charge_currents_0",            needs: "sensor.charge_current",                                                 what: "disabledWhatPhaseCurrents" },
  { domain: "sensor", suffix: "charge_currents_1",            needs: "sensor.charge_current",                                                 what: "disabledWhatPhaseCurrents" },
  { domain: "sensor", suffix: "charge_currents_2",            needs: "sensor.charge_current",                                                 what: "disabledWhatPhaseCurrents" },
];

export const CHARGE_MODES = {
  "off":   { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13,3H11V13H13V3M17.83,5.17L16.41,6.59C17.99,7.86 19,9.81 19,12A7,7 0 0,1 12,19A7,7 0 0,1 5,12C5,9.81 6.01,7.86 7.58,6.58L6.17,5.17C4.23,6.82 3,9.26 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12C21,9.26 19.77,6.82 17.83,5.17Z"/></svg>`,  tKey: "modeOff"  },
  // 'smart' replaces 'pv'/'minpv' with evcc PR 32490 (ha-evcc 2026.8.3+).
  // Rendered only when the mode entity actually offers it, so old and new
  // setups both keep exactly their own set of buttons.
  "smart": { icon: SMART_MODE_ICON, tKey: "modeSmart" },
  "pv":    { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`,  tKey: "modePV"   },
  "minpv": { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="position:relative;top:4px;left:-6px;opacity:0.8"><path d="M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z"/></svg>`, tKey: "modeMinPV"},
  "now":   { icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11 15H6L13 1V9H18L11 23V15Z"/></svg>`,  tKey: "modeNow"  },
};
