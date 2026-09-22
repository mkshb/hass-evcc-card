// discoverVehicles finds the vehicles ha-evcc knows from their own entities,
// none of which depends on a loadpoint: an unplugged vehicle has to stay in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverVehicles, selectVehicles } from "../../src/core/entity-discovery.js";
import { vehicleFilter, validateCardConfig } from "../../src/core/constants.js";

const hassOf = (ids, entities = {}) => ({ states: Object.fromEntries(ids.map(id => [id, { state: "1" }])), entities });

test("vehicle sensors, plan switches and session totals land under one slug", () => {
  const got = discoverVehicles(hassOf([
    "sensor.evcc_ex30_configvehicle_soc",
    "sensor.evcc_ex30_configvehicle_limitsoc",
    "switch.evcc_ex30_repeating_plan_10",
    "switch.evcc_ex30_repeating_plan_2",
    "sensor.evcc_cstotal_ex30_charging_sessions_vehicle_cost",
  ]));
  assert.deepEqual(Object.keys(got), ["ex30"]);
  assert.equal(got.ex30.soc, "sensor.evcc_ex30_configvehicle_soc");
  assert.equal(got.ex30.limit_soc, "sensor.evcc_ex30_configvehicle_limitsoc");
  assert.equal(got.ex30.sessions_cost, "sensor.evcc_cstotal_ex30_charging_sessions_vehicle_cost");
  assert.deepEqual(got.ex30.repeating_plans,
    ["switch.evcc_ex30_repeating_plan_2", "switch.evcc_ex30_repeating_plan_10"], "plan order is numeric");
});

test("a vehicle without the extended vehicle data is still found", () => {
  const got = discoverVehicles(hassOf(["switch.evcc_id7_repeating_plan_2"]));
  assert.deepEqual(got, { id7: { repeating_plans: ["switch.evcc_id7_repeating_plan_2"] } });
});

test("a slug with underscores stays in one piece", () => {
  const got = discoverVehicles(hassOf(["sensor.evcc_tesla_model_3_configvehicle_range"]));
  assert.equal(got.tesla_model_3.range, "sensor.evcc_tesla_model_3_configvehicle_range");
});

test("loadpoint entities and loadpoint session totals are no vehicles", () => {
  const got = discoverVehicles(hassOf([
    "sensor.evcc_openwb_vehicle_soc",
    "sensor.evcc_openwb_vehicle_range",
    "sensor.evcc_cstotal_openwb_charging_sessions_loadpoint_cost",
    "sensor.evcc_battery_soc",
  ]));
  assert.deepEqual(got, {});
});

test("the wrong domain does not count", () => {
  assert.deepEqual(discoverVehicles(hassOf(["number.evcc_ex30_configvehicle_soc"])), {});
});

test("a custom prefix is honoured", () => {
  const hass = hassOf(["sensor.myevcc_ex30_configvehicle_soc", "sensor.evcc_id7_configvehicle_soc"]);
  assert.deepEqual(Object.keys(discoverVehicles(hass, "myevcc_")), ["ex30"]);
});

test("vehicles of an installation with a longer prefix stay out", () => {
  const reg = id => [id, { entity_id: id, platform: "evcc_intg" }];
  const entities = Object.fromEntries([
    reg("sensor.evcc_pv_power"), reg("sensor.evcc_demo_pv_power"),
  ]);
  const hass = hassOf([
    "sensor.evcc_ex30_configvehicle_soc",
    "sensor.evcc_demo_vehicle_1_configvehicle_soc",
  ], entities);
  assert.deepEqual(Object.keys(discoverVehicles(hass, "evcc_")), ["ex30"]);
  assert.deepEqual(Object.keys(discoverVehicles(hass, "evcc_demo_")), ["vehicle_1"]);
});

test("vehicles option: list, single name, not set", () => {
  assert.equal(vehicleFilter({}), null);
  assert.deepEqual(vehicleFilter({ vehicles: "ex30" }), ["ex30"]);
  const found = { ex30: {}, id7: {} };
  assert.deepEqual(Object.keys(selectVehicles(found, {})), ["ex30", "id7"]);
  assert.deepEqual(Object.keys(selectVehicles(found, { vehicles: ["ID7"] })), ["id7"], "compared without case");
  assert.deepEqual(selectVehicles(found, { vehicles: "tesla" }), {});
});

test("vehicles option is validated like loadpoints", () => {
  assert.doesNotThrow(() => validateCardConfig({ mode: "vehicle", vehicles: ["ex30"] }));
  assert.doesNotThrow(() => validateCardConfig({ mode: "vehicle", vehicles: "ex30" }));
  for (const bad of [[], [""], 5]) {
    assert.throws(() => validateCardConfig({ vehicles: bad }), /vehicles/);
  }
});
