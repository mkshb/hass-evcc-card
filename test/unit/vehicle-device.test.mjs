// The device of a vehicle's own integration: found by what it carries and what
// it is called, its entities sorted by class and unit, by name only where those
// leave a choice. Hand-built registries, one trap per test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyVehicleDevice, findVehicleDevice, resolveVehicleDevice, listVehicleDevices, evccVehicleTitle } from "../../src/core/vehicle-device.js";

// ent: [entity_id, state, attributes, translation_key]
function hassOf(devices) {
  const hass = { devices: {}, entities: {}, states: {} };
  for (const [id, dev] of Object.entries(devices)) {
    hass.devices[id] = { id, name: dev.name, model: dev.model ?? null, name_by_user: dev.name_by_user ?? null,
                         identifiers: [[dev.integration ?? "car", id]] };
    for (const [entityId, state, attributes = {}, tk = null] of dev.ents) {
      hass.entities[entityId] = { entity_id: entityId, device_id: id, translation_key: tk, hidden: dev.hidden?.includes(entityId) };
      hass.states[entityId] = { state, attributes };
    }
  }
  return hass;
}
const pct = { unit_of_measurement: "%", device_class: "battery" };
const km  = (stateClass = "measurement") => ({ unit_of_measurement: "km", device_class: "distance", state_class: stateClass });
const car = (name, extra = []) => ({ name, ents: [[`sensor.${name}_battery`, "70", pct], [`sensor.${name}_range`, "250", km()], ...extra] });

test("roles: range is not the distance to service, the odometer not a trip meter", () => {
  const hass = hassOf({ d: { name: "Car", ents: [
    ["sensor.car_a", "70", pct],
    ["sensor.car_b", "18525", km(), "distance_to_service"],
    ["sensor.car_c", "257", km(), "distance_to_empty_battery"],
    ["sensor.car_d", "19.9", km("total_increasing"), "trip_meter_automatic"],
    ["sensor.car_e", "11503", km("total_increasing"), "odometer"],
    ["sensor.car_f", "69", { unit_of_measurement: "kWh", device_class: "energy_storage" }],
    ["sensor.car_g", "90", { unit_of_measurement: "%" }, "target_battery_charge_level"],
    ["lock.car", "locked"], ["device_tracker.car", "home", { source_type: "gps" }],
  ] } });
  assert.deepEqual(classifyVehicleDevice(hass, "d").roles, {
    soc: "sensor.car_a", odometer: "sensor.car_e", range: "sensor.car_c", capacity: "sensor.car_f",
    target_soc: "sensor.car_g", lock: "lock.car", location: "device_tracker.car",
  });
});

test("roles: without telling names the rising counter is the odometer, the one distance left the range", () => {
  const hass = hassOf({ d: { name: "Car", ents: [
    ["sensor.car_x1", "70", pct], ["sensor.car_x2", "300", km()], ["sensor.car_x3", "42000", km("total_increasing")],
  ] } });
  const { roles } = classifyVehicleDevice(hass, "d");
  assert.equal(roles.odometer, "sensor.car_x3");
  assert.equal(roles.range, "sensor.car_x2");
});

test("roles: two unnamed distances are no range, a wrong guess is worse than none", () => {
  const hass = hassOf({ d: { name: "Car", ents: [["sensor.car_x1", "70", pct], ["sensor.car_x2", "300", km()], ["sensor.car_x4", "120", km()]] } });
  assert.equal(classifyVehicleDevice(hass, "d").roles.range, undefined);
});

test("roles: the 12 V battery is not the charge level", () => {
  const hass = hassOf({ d: { name: "Car", ents: [["sensor.car_12v_battery", "98", pct], ["sensor.car_hv", "55", pct], ["sensor.car_range", "200", km()]] } });
  assert.equal(classifyVehicleDevice(hass, "d").roles.soc, "sensor.car_hv");
});

test("groups: doors and warnings are collected, the rest are details, nothing twice", () => {
  const hass = hassOf({ d: { name: "Car", hidden: ["sensor.car_hidden"], ents: [
    ["sensor.car_battery", "70", pct], ["sensor.car_range", "250", km()],
    ["binary_sensor.car_door", "off", { device_class: "door" }], ["binary_sensor.car_window", "on", { device_class: "window" }],
    ["binary_sensor.car_tyre", "off", { device_class: "problem" }], ["binary_sensor.car_engine", "off", { device_class: "running" }],
    ["sensor.car_consumption", "19", { unit_of_measurement: "kWh/100km" }], ["sensor.car_hidden", "1"], ["button.car_honk", "unknown"],
  ] } });
  const got = classifyVehicleDevice(hass, "d");
  assert.deepEqual(got.openings, ["binary_sensor.car_door", "binary_sensor.car_window"]);
  assert.deepEqual(got.problems, ["binary_sensor.car_tyre"]);
  assert.deepEqual(got.actions, ["button.car_honk"]);
  assert.deepEqual(got.details, ["binary_sensor.car_engine", "sensor.car_consumption"]);
});

test("search: title or slug in name or model, and the device has to be a vehicle", () => {
  const hass = hassOf({
    app:   { name: "EX30", ents: [["device_tracker.ex30", "home"]] },
    volvo: { ...car("volvo_ex30"), name: "Volvo EX30" },
    other: { ...car("tesla"), name: "Tesla" },
    model: { ...car("vw"), name: "Mein Auto", model: "ID.7 Pro" },
  });
  assert.equal(findVehicleDevice(hass, "ex30", "EX30"), "volvo");
  assert.equal(findVehicleDevice(hass, "id7", "id7"), "model", "the model counts, punctuation does not");
  assert.equal(findVehicleDevice(hass, "polestar", "Polestar 2"), null);
});

test("search: a short name inside an unrelated device does not link it", () => {
  const hass = hassOf({ nas: { name: "Druid70 NAS", ents: [["sensor.nas_temp", "40", { unit_of_measurement: "°C" }]] } });
  assert.equal(findVehicleDevice(hass, "id7", "id7"), null);
});

test("search: ha-evcc's own vehicle device is never the answer; of several the one with more entities", () => {
  const hass = hassOf({
    evcc:   { ...car("evcc_ex30"), name: "evcc - Fahrzeug EX30 [evcc]", integration: "evcc_intg" },
    helper: { ...car("ex30_helper"), name: "EX30 Helfer" },
    volvo:  { ...car("volvo_ex30", [["lock.volvo_ex30", "locked"]]), name: "Volvo EX30" },
  });
  assert.equal(findVehicleDevice(hass, "ex30", "EX30"), "volvo");
});

test("vehicle_devices: override, none, off, and a device that is gone", () => {
  const hass = hassOf({ volvo: { ...car("volvo_ex30"), name: "Volvo EX30" }, app: { name: "EX30", ents: [["device_tracker.ex30", "home"]] } });
  assert.equal(resolveVehicleDevice(hass, {}, "ex30", "EX30"), "volvo");
  assert.equal(resolveVehicleDevice(hass, { vehicle_devices: { ex30: "app" } }, "ex30", "EX30"), "app", "the user's pick needs no vehicle check");
  assert.equal(resolveVehicleDevice(hass, { vehicle_devices: { ex30: "none" } }, "ex30", "EX30"), null);
  assert.equal(resolveVehicleDevice(hass, { vehicle_devices: false }, "ex30", "EX30"), null);
  assert.equal(resolveVehicleDevice(hass, { vehicle_devices: { ex30: "deleted" } }, "ex30", "EX30"), null, "no silent fallback to another device");
  assert.equal(resolveVehicleDevice(hass, { vehicle_devices: { id7: "app" } }, "ex30", "EX30"), "volvo", "other vehicles stay automatic");
});

test("editor list: vehicles first, ha-evcc devices and devices without entities left out", () => {
  const hass = hassOf({
    lamp:  { name: "Lampe", ents: [["light.lampe", "on"]] },
    volvo: { ...car("volvo_ex30"), name: "Volvo EX30" },
    evcc:  { ...car("evcc_ex30"), name: "evcc - Fahrzeug EX30 [evcc]", integration: "evcc_intg" },
    empty: { name: "Leer", ents: [] },
  });
  assert.deepEqual(listVehicleDevices(hass), [
    { id: "volvo", name: "Volvo EX30", vehicleLike: true }, { id: "lamp", name: "Lampe", vehicleLike: false }]);
});

test("the evcc title is read off ha-evcc's vehicle device, whatever slugify replaced", () => {
  const hass = hassOf({
    a: { name: "evcc - Fahrzeug blue e-Golf [evcc_demo]", integration: "evcc_intg", ents: [["sensor.evcc_demo_blue_e_golf_configvehicle_soc", "50"]] },
    b: { name: "evcc - Vehicle id7 [evcc]", name_by_user: "Dienstwagen", integration: "evcc_intg", ents: [["switch.evcc_id7_repeating_plan_2", "off"]] },
  });
  assert.equal(evccVehicleTitle(hass, "blue_e_golf", { soc: "sensor.evcc_demo_blue_e_golf_configvehicle_soc", repeating_plans: [] }), "blue e-Golf");
  assert.equal(evccVehicleTitle(hass, "id7", { repeating_plans: ["switch.evcc_id7_repeating_plan_2"] }), "Dienstwagen");
  assert.equal(evccVehicleTitle(hass, "ex30", { repeating_plans: [] }), null);
});

test("what the vehicle is doing: read off device classes and status options, never off names", async () => {
  const { vehicleDeviceState } = await import("../../src/core/vehicle-device.js");
  const build = (engine, charge, plug) => hassOf({ d: { name: "Car", ents: [
    ["sensor.car_battery", "70", pct], ["sensor.car_range", "250", km()],
    ["binary_sensor.car_x1", engine, { device_class: "running" }],
    ["sensor.car_x2", charge, { device_class: "enum", options: ["charging", "idle", "done"] }],
    ["sensor.car_x3", plug, { device_class: "enum", options: ["connected", "disconnected", "fault"] }],
    ["sensor.car_x4", "available", { device_class: "enum", options: ["available", "car_in_use"] }],
  ] } });
  const state = (...a) => { const h = build(...a); return vehicleDeviceState(h, classifyVehicleDevice(h, "d").roles); };
  const roles = classifyVehicleDevice(build("off", "idle", "disconnected"), "d").roles;
  assert.equal(roles.driving, "binary_sensor.car_x1");
  assert.equal(roles.charging, "sensor.car_x2");
  assert.equal(roles.plugged, "sensor.car_x3");
  assert.equal(state("off", "idle", "disconnected"), "parked");
  assert.equal(state("on", "idle", "disconnected"), "driving");
  assert.equal(state("off", "idle", "connected"), "connected");
  assert.equal(state("off", "charging", "connected"), "charging");
  assert.equal(state("on", "charging", "connected"), "charging", "a charging car is not driving");
  assert.equal(state("unknown", "unavailable", "unknown"), "parked", "unknown counts as no");
  assert.equal(vehicleDeviceState(build("on", "idle", "connected"), {}), "parked", "no roles, no claim");
});

test("vehicle pictures: paths Home Assistant serves and http(s), nothing else", async () => {
  const { isVehicleImageUrl, isVehicleImage, isMediaSourceId } = await import("../../src/core/constants.js");
  assert.equal(isMediaSourceId("media-source://media_source/local/ex30.png"), true);
  assert.equal(isVehicleImage("media-source://media_source/local/ex30.png"), true);
  assert.equal(isVehicleImageUrl("media-source://media_source/local/ex30.png"), false, "a media item is no address the browser can load");
  assert.equal(isVehicleImage("media-source://"), false);
  for (const ok of ["/local/ex30.png", "/api/image/serve/abc/512x512", "https://example.org/a.webp", "http://ha.local:8123/local/a.png"]) {
    assert.equal(isVehicleImageUrl(ok), true, ok);
  }
  for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "//evil.example/a.png", "local/a.png", "", " ", "/local/a b.png", null, 5]) {
    assert.equal(isVehicleImageUrl(bad), false, String(bad));
  }
});

test("an image entity on the device is the picture role", () => {
  const hass = hassOf({ d: { name: "Car", ents: [["sensor.car_battery", "70", pct], ["sensor.car_range", "250", km()], ["image.car", "2026-01-01T00:00:00", { entity_picture: "/api/image_proxy/image.car?token=x" }]] } });
  assert.equal(classifyVehicleDevice(hass, "d").roles.image, "image.car");
});
