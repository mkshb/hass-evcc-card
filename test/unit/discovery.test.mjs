// detectIntegration decides which evcc installation the card talks to. With two
// ha-evcc config entries the prefix and the entry id must come from the same
// one, so this exercises the grouping directly, with a hand-built registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectIntegration, detectPrefix, featureKeyOf, locateEntity, installedPrefixes, selectLoadpoints, discoverEntities } from "../../src/core/entity-discovery.js";
import { loadpointFilter } from "../../src/core/constants.js";

// A site entity carries the prefix (pv_power is a site feature, no loadpoint).
const entry = (prefix, entryId) => [
  { entity_id: `binary_sensor.${prefix}openwb_charging`, platform: "evcc_intg", config_entry_id: entryId },
  { entity_id: `sensor.${prefix}pv_power`,               platform: "evcc_intg", config_entry_id: entryId },
];
const hassWith = (entities) => ({ callWS: async () => entities });

test("a single instance yields its prefix and entry id", async () => {
  const got = await detectIntegration(hassWith(entry("evcc_", "A")));
  assert.equal(got.prefix, "evcc_");
  assert.equal(got.entryId, "A");
  assert.deepEqual(got.instances, [{ prefix: "evcc_", entryId: "A" }]);
});

test("a non-default prefix is detected from the site entity", async () => {
  const got = await detectIntegration(hassWith(entry("myevcc_", "A")));
  assert.equal(got.prefix, "myevcc_");
});

test("entities of other integrations are ignored", async () => {
  const foreign = [{ entity_id: "sensor.solar_pv_power", platform: "other", config_entry_id: "X" }];
  const got = await detectIntegration(hassWith([...foreign, ...entry("evcc_", "A")]));
  assert.equal(got.entryId, "A", "the foreign entry id must not leak in");
});

test("without any evcc entity it falls back without an entry id", async () => {
  const got = await detectIntegration(hassWith([]));
  assert.deepEqual(got, { prefix: "evcc_", entryId: null, instances: [] });
});

test("a failing registry call does not throw", async () => {
  const got = await detectIntegration({ callWS: async () => { throw new Error("nope"); } });
  assert.deepEqual(got, { prefix: "evcc_", entryId: null, instances: [] });
});

// --- two config entries ------------------------------------------------------

const two = [...entry("evcc_", "A"), ...entry("evcc2_", "B")];

test("both instances are reported, in registry order", async () => {
  const got = await detectIntegration(hassWith(two));
  assert.deepEqual(got.instances, [{ prefix: "evcc_", entryId: "A" }, { prefix: "evcc2_", entryId: "B" }]);
});

test("without a preference the first registry entry wins", async () => {
  const got = await detectIntegration(hassWith(two));
  assert.equal(got.prefix, "evcc_");
  assert.equal(got.entryId, "A");
});

test("the preferred prefix selects the entry id of the SAME instance", async () => {
  const got = await detectIntegration(hassWith(two), "evcc2_");
  assert.equal(got.prefix, "evcc2_");
  assert.equal(got.entryId, "B", "taking A here would query the wrong evcc installation");
});

test("registry order does not override the preference", async () => {
  const reversed = [...entry("evcc2_", "B"), ...entry("evcc_", "A")];
  const got = await detectIntegration(hassWith(reversed), "evcc_");
  assert.equal(got.prefix, "evcc_");
  assert.equal(got.entryId, "A");
});

test("an unknown preferred prefix falls back to the first instance", async () => {
  const got = await detectIntegration(hassWith(two), "typo_");
  assert.equal(got.prefix, "evcc_");
  assert.equal(got.entryId, "A");
});

test("an entry whose entities carry no config_entry_id still yields a prefix", async () => {
  const orphan = entry("evcc_", undefined).map(({ config_entry_id, ...rest }) => rest);
  const got = await detectIntegration(hassWith(orphan));
  assert.equal(got.prefix, "evcc_");
  assert.equal(got.entryId, null);
});

test("detectPrefix stays a thin wrapper returning only the prefix", async () => {
  assert.equal(await detectPrefix(hassWith(entry("myevcc_", "A"))), "myevcc_");
  assert.equal(await detectPrefix(hassWith([])), "evcc_");
});

// --- featureKeyOf ------------------------------------------------------------
// Config keyed by feature (`slider_steps`) is matched through this, so a key
// must reach exactly the feature it names.

test("an entity resolves to the feature it was discovered under", () => {
  assert.equal(featureKeyOf("number.evcc_openwb_limit_soc"), "limit_soc");
  assert.equal(featureKeyOf("select.evcc_openwb_min_soc"), "min_soc");
  assert.equal(featureKeyOf("select.evcc_openwb_max_current"), "max_current");
  assert.equal(featureKeyOf("sensor.evcc_pv_power"), "pv_power", "a site entity has no loadpoint part");
});

test("the longest feature wins, so a shorter one cannot swallow it", () => {
  assert.notEqual(featureKeyOf("number.evcc_openwb_limit_soc"), "soc");
  assert.notEqual(featureKeyOf("select.evcc_openwb_min_soc"), "soc");
});

test("the domain is part of the match", () => {
  assert.equal(featureKeyOf("number.evcc_openwb_limit_soc"), "limit_soc");
  assert.equal(featureKeyOf("sensor.evcc_openwb_limit_soc"), null, "no sensor feature with that suffix");
});

test("a custom prefix is honoured and a foreign entity yields null", () => {
  assert.equal(featureKeyOf("number.myevcc_openwb_limit_soc", "myevcc_"), "limit_soc");
  assert.equal(featureKeyOf("number.myevcc_openwb_limit_soc"), null, "wrong prefix must not match");
  assert.equal(featureKeyOf("number.other_integration_limit_soc"), null);
  assert.equal(featureKeyOf("evcc_openwb_limit_soc"), null, "not an entity id");
});

// --- locateEntity ------------------------------------------------------------
// The card picker asks which installation and loadpoint an entity belongs to,
// synchronously, so the prefixes come from the hass.entities registry mirror.

// states + entities for one installation: a site entity, a loadpoint and an
// entity discovery files under meters (a name in front of a site suffix, no
// charge_power next to it), plus a foreign entity with an evcc-looking id.
const installation = (prefix) => [
  `sensor.${prefix}pv_power`,
  `sensor.${prefix}openwb_charge_power`,
  `select.${prefix}openwb_mode`,
  `sensor.${prefix}garage_battery_soc`,
];
const hassOf = (...prefixes) => {
  const hass = { states: {}, entities: {} };
  for (const prefix of prefixes) {
    for (const id of installation(prefix)) {
      hass.states[id]   = { entity_id: id, state: "1" };
      hass.entities[id] = { entity_id: id, platform: "evcc_intg" };
    }
  }
  hass.states["sensor.evcc_openwb_charge_power_foreign"]   = { entity_id: "x", state: "1" };
  hass.entities["sensor.evcc_openwb_charge_power_foreign"] = { entity_id: "x", platform: "other" };
  return hass;
};

test("installedPrefixes reads every installation off the registry mirror", () => {
  assert.deepEqual(installedPrefixes(hassOf("evcc_", "my_evcc_")).sort(), ["evcc_", "my_evcc_"]);
  assert.deepEqual(installedPrefixes({ states: {} }), [], "no registry mirror, no prefixes");
});

test("a named meter ending in a site suffix does not pass as an installation", () => {
  // sensor.evcc_garage_battery_soc reads as prefix "evcc_garage_" plus battery_soc,
  // but no core site sensor sits under that prefix.
  assert.deepEqual(installedPrefixes(hassOf("evcc_")), ["evcc_"]);
});

test("a loadpoint entity yields its prefix and loadpoint, a site entity no loadpoint", () => {
  const hass = hassOf("evcc_");
  assert.deepEqual(locateEntity(hass, "select.evcc_openwb_mode"), { prefix: "evcc_", loadpoint: "openwb" });
  assert.deepEqual(locateEntity(hass, "sensor.evcc_pv_power"),    { prefix: "evcc_", loadpoint: "" });
});

test("a prefix with an underscore of its own is not cut short", () => {
  const hass = hassOf("my_evcc_");
  assert.deepEqual(locateEntity(hass, "sensor.my_evcc_openwb_charge_power"), { prefix: "my_evcc_", loadpoint: "openwb" });
  assert.deepEqual(locateEntity(hass, "sensor.my_evcc_pv_power"),            { prefix: "my_evcc_", loadpoint: "" });
});

test("with two installations each entity lands in its own", () => {
  const hass = hassOf("evcc_", "my_evcc_");
  assert.equal(locateEntity(hass, "select.evcc_openwb_mode").prefix,    "evcc_");
  assert.equal(locateEntity(hass, "select.my_evcc_openwb_mode").prefix, "my_evcc_");
});

test("an entity filed under meters is site data without a loadpoint", () => {
  assert.deepEqual(locateEntity(hassOf("evcc_"), "sensor.evcc_garage_battery_soc"), { prefix: "evcc_", loadpoint: "" });
});

test("a foreign entity and an unknown id yield null", () => {
  const hass = hassOf("evcc_");
  assert.equal(locateEntity(hass, "sensor.evcc_openwb_charge_power_foreign"), null, "platform is not evcc_intg");
  assert.equal(locateEntity(hass, "sensor.evcc_openwb_not_a_feature"), null, "not in the registry");
  assert.equal(locateEntity({ states: hass.states }, "select.evcc_openwb_mode"), null, "no registry mirror");
});

// --- loadpointFilter / selectLoadpoints --------------------------------------
// The `loadpoints` option is read in one place, so a single name and a list
// mean the same thing to the validator, the render, the size estimate and the
// priority view alike.

test("loadpointFilter turns the option into a list, or null when unset", () => {
  assert.equal(loadpointFilter({}), null);
  assert.equal(loadpointFilter({ loadpoints: null }), null);
  assert.equal(loadpointFilter(undefined), null);
  assert.deepEqual(loadpointFilter({ loadpoints: "openwb" }), ["openwb"]);
  assert.deepEqual(loadpointFilter({ loadpoints: ["openwb", "wp"] }), ["openwb", "wp"]);
});

test("selectLoadpoints narrows to the configured names and keeps their entities", () => {
  const found = { openwb: { charge_power: "a" }, wp: { charge_power: "b" } };
  assert.deepEqual(selectLoadpoints(found, { loadpoints: "wp" }), { wp: { charge_power: "b" } });
  assert.deepEqual(selectLoadpoints(found, { loadpoints: ["openwb", "nope"] }), { openwb: { charge_power: "a" } });
  assert.equal(selectLoadpoints(found, {}), found, "without the option every loadpoint stays");
});

// --- discoverEntities with a prefix that extends another ----------------------
// "evcc_" and "evcc_demo_" side by side: every demo entity id also starts with
// "evcc_", and read under that prefix "evcc_demo_openwb_charge_power" would be a
// loadpoint called "demo_openwb" of the first installation.

test("a longer installed prefix keeps its entities out of the shorter one", () => {
  const hass = hassOf("evcc_", "evcc_demo_");
  const prod = discoverEntities(hass, "evcc_");
  assert.deepEqual(Object.keys(prod.loadpoints), ["openwb"]);
  assert.ok(!Object.keys(prod.meters).some(m => m.startsWith("demo")), `meters: ${Object.keys(prod.meters)}`);
  assert.equal(prod.site.pv_power, "sensor.evcc_pv_power");
  const demo = discoverEntities(hass, "evcc_demo_");
  assert.deepEqual(Object.keys(demo.loadpoints), ["openwb"]);
  assert.equal(demo.site.pv_power, "sensor.evcc_demo_pv_power");
});

test("without a registry mirror the shorter prefix still reads everything, as before", () => {
  const hass = hassOf("evcc_", "evcc_demo_");
  const prod = discoverEntities({ states: hass.states }, "evcc_");
  assert.ok("demo_openwb" in prod.loadpoints, "no hass.entities, no way to tell the installations apart");
});

test("locateEntity files a demo entity under the demo installation", () => {
  const hass = hassOf("evcc_", "evcc_demo_");
  assert.deepEqual(locateEntity(hass, "select.evcc_demo_openwb_mode"), { prefix: "evcc_demo_", loadpoint: "openwb" });
  assert.deepEqual(locateEntity(hass, "select.evcc_openwb_mode"),      { prefix: "evcc_",      loadpoint: "openwb" });
});
