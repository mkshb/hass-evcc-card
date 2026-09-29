// discoverVehicles finds the vehicles ha-evcc knows from their own entities,
// none of which depends on a loadpoint: an unplugged vehicle has to stay in.
import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverVehicles, selectVehicle } from "../../src/core/entity-discovery.js";
import { vehicleSlug, validateCardConfig } from "../../src/core/constants.js";

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

test("the vehicle of a card: the name, the list of one the mode started with, or nothing", () => {
  assert.equal(vehicleSlug({}), null);
  assert.equal(vehicleSlug({ vehicle: "ex30" }), "ex30");
  assert.equal(vehicleSlug({ vehicles: "ex30" }), "ex30");
  assert.equal(vehicleSlug({ vehicles: ["id7"] }), "id7");
  assert.equal(vehicleSlug({ vehicle: " ex30 " }), "ex30");
});

test("which vehicle a card shows: the named one, or the only one there is", () => {
  const found = { ex30: { a: 1 }, id7: { b: 2 } };
  assert.equal(selectVehicle(found, {}), null, "several vehicles and no name: the card has to ask");
  assert.deepEqual(selectVehicle({ ex30: { a: 1 } }, {}), ["ex30", { a: 1 }], "one vehicle needs no name");
  assert.deepEqual(selectVehicle(found, { vehicle: "ID7" }), ["id7", { b: 2 }], "compared without case");
  assert.equal(selectVehicle(found, { vehicle: "tesla" }), null, "a name that is not there is no vehicle");
  assert.equal(selectVehicle({}, { vehicle: "ex30" }), null);
});

test("one card, one vehicle: a list of several is rejected, the options of the first shape too", () => {
  assert.doesNotThrow(() => validateCardConfig({ vehicle: "ex30" }));
  assert.doesNotThrow(() => validateCardConfig({ vehicles: ["ex30"] }));
  assert.doesNotThrow(() => validateCardConfig({ vehicles: "ex30" }));
  assert.throws(() => validateCardConfig({ vehicles: ["ex30", "id7"] }), /one vehicle/);
  for (const bad of [[], [""], 5]) {
    assert.throws(() => validateCardConfig({ vehicles: bad }), /vehicle/);
  }
  assert.throws(() => validateCardConfig({ vehicle_devices: { ex30: "none" } }), /vehicle_device/);
  assert.throws(() => validateCardConfig({ vehicle_images: { ex30: "/local/a.png" } }), /vehicle_image/);
});
