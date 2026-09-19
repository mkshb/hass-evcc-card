// Entity state accessors: every one of them must survive a missing entity,
// because the card renders before discovery has filled in every id.
import { test } from "node:test";
import assert from "node:assert/strict";
import { stateVal, attr, unitStr, displayUnit, isOn } from "../../src/utils/state.js";

const hass = {
  states: {
    "sensor.charge_power":   { state: "4100", attributes: { unit_of_measurement: "W", friendly_name: "Charge power" } },
    "sensor.vehicle_soc":    { state: "72",   attributes: {} },
    "switch.boost":          { state: "on",   attributes: {} },
    "switch.legacy_boost":   { state: "true", attributes: {} },
    "switch.off":            { state: "off",  attributes: {} },
    "sensor.unavailable":    { state: "unavailable" },
  },
};

test("stateVal returns the state, null when the entity is missing", () => {
  assert.equal(stateVal(hass, "sensor.charge_power"), "4100");
  assert.equal(stateVal(hass, "sensor.does_not_exist"), null);
});

test("stateVal keeps unavailable as a value, it is not the same as missing", () => {
  assert.equal(stateVal(hass, "sensor.unavailable"), "unavailable");
});

test("attr reads an attribute, null when entity or attribute is missing", () => {
  assert.equal(attr(hass, "sensor.charge_power", "friendly_name"), "Charge power");
  assert.equal(attr(hass, "sensor.charge_power", "nope"), null);
  assert.equal(attr(hass, "sensor.does_not_exist", "friendly_name"), null);
  assert.equal(attr(hass, "sensor.unavailable", "unit_of_measurement"), null);
});

test("unitStr falls back to an empty string, never null", () => {
  assert.equal(unitStr(hass, "sensor.charge_power"), "W");
  assert.equal(unitStr(hass, "sensor.vehicle_soc"), "");
  assert.equal(unitStr(hass, "sensor.does_not_exist"), "");
});

test("displayUnit infers % for soc entities that carry no unit", () => {
  assert.equal(displayUnit(hass, "sensor.vehicle_soc"), "%");
  assert.equal(displayUnit(hass, "sensor.charge_power"), "W", "a real unit always wins");
  assert.equal(displayUnit(hass, "sensor.does_not_exist"), "", "no unit and no soc in the id");
});

test("isOn accepts on and the string true, everything else is off", () => {
  assert.equal(isOn(hass, "switch.boost"), true);
  assert.equal(isOn(hass, "switch.legacy_boost"), true);
  assert.equal(isOn(hass, "switch.off"), false);
  assert.equal(isOn(hass, "sensor.unavailable"), false);
  assert.equal(isOn(hass, "switch.does_not_exist"), false);
});
