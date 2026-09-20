// detectIntegration decides which evcc installation the card talks to. With two
// ha-evcc config entries the prefix and the entry id must come from the same
// one, so this exercises the grouping directly, with a hand-built registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { detectIntegration, detectPrefix, featureKeyOf } from "../../src/core/entity-discovery.js";

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
