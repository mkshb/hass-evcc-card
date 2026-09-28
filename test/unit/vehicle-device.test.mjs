// The device of a vehicle's own integration: found by what it carries and what
// it is called, its entities sorted by class and unit, by name only where those
// leave a choice. Hand-built registries, one trap per test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyVehicleDevice, findVehicleDevice, resolveVehicleDevice, listVehicleDevices, evccVehicleTitle,
         vehicleOverride, hasVehicleDeviceData, vehicleRoleCandidates, vehicleActionCandidates } from "../../src/core/vehicle-device.js";

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

// A vehicle whose values sit somewhere else: `vehicle_entities` names them by
// hand, role by role, and the functions as a list.
function withLoose(hass, entities) {
  for (const [entityId, state, attributes = {}] of entities) {
    hass.entities[entityId] = { entity_id: entityId, device_id: null };
    hass.states[entityId] = { state, attributes };
  }
  return hass;
}

test("vehicle_entities: what the config names takes the role, \"none\" switches it off", () => {
  const hass = withLoose(hassOf({ d: { name: "Car", ents: [
    ["sensor.car_battery", "70", pct], ["sensor.car_range", "250", km()],
    ["sensor.car_odo", "11500", km("total_increasing"), "odometer"],
    ["device_tracker.car", "home", { source_type: "gps" }],
  ] } }), [["sensor.loose_soc", "66", { unit_of_measurement: "%" }]]);

  const got = classifyVehicleDevice(hass, "d", { soc: "sensor.loose_soc", location: "none" });
  assert.equal(got.roles.soc, "sensor.loose_soc", "an entity outside the device does just as well");
  assert.equal(got.roles.location, undefined, "\"none\" leaves the role empty");
  assert.equal(got.roles.range, "sensor.car_range", "a role the config says nothing about stays as it was");
  assert.ok(got.details.includes("sensor.car_battery"), "the sensor the role let go turns up in the details");
  assert.ok(!got.details.includes("sensor.loose_soc"), "the details are the device's, nothing is added to them");
});

test("vehicle_entities: the functions are exactly the configured list, in its order", () => {
  const btn = (name, tk) => [`button.car_${name}`, "unknown", {}, tk];
  const hass = withLoose(hassOf({ d: car("car", [btn("hupen", "honk"), btn("blinken", "flash"), btn("aktualisieren", "refresh")]) }),
                         [["script.fenster_zu", "off"]]);
  assert.deepEqual(classifyVehicleDevice(hass, "d").actions,
    ["button.car_aktualisieren", "button.car_blinken", "button.car_hupen"], "found by itself: every button of the device");
  assert.deepEqual(classifyVehicleDevice(hass, "d", { actions: ["button.car_hupen", "script.fenster_zu"] }).actions,
    ["button.car_hupen", "script.fenster_zu"], "the list replaces what was found, its order included");
  assert.deepEqual(classifyVehicleDevice(hass, "d", { actions: [] }).actions, [], "an empty list means no functions at all");
});

test("vehicle_entities: preconditioning as one entity or as a configured pair of commands", () => {
  const btn = name => [`button.car_${name}`, "unknown", {}];
  const hass = hassOf({ d: car("car", [btn("w1"), btn("w2"), ["switch.car_heizung", "off", {}]]) });
  assert.equal(classifyVehicleDevice(hass, "d").climate, null, "nothing in the words points at preconditioning");
  assert.deepEqual(classifyVehicleDevice(hass, "d", { climate: "switch.car_heizung" }).climate, { entity: "switch.car_heizung" });

  const pair = classifyVehicleDevice(hass, "d", { climate_start: "button.car_w1", climate_stop: "button.car_w2" });
  assert.deepEqual(pair.climate, { start: "button.car_w1", stop: "button.car_w2" });
  assert.deepEqual(pair.actions, [], "a command that preconditions is no plain function any more");

  const off = classifyVehicleDevice(hassOf({ d: car("car", [["climate.car", "off", {}]]) }), "d", { climate: "none" });
  assert.equal(off.climate, null, "\"none\" switches off the preconditioning found by itself");
});

test("vehicle_entities: without a device the config alone makes up the vehicle", () => {
  const hass = withLoose({ devices: {}, entities: {}, states: {} },
    [["sensor.ex30_soc", "55", { unit_of_measurement: "%" }], ["lock.ex30", "locked"]]);
  const got = classifyVehicleDevice(hass, null, { soc: "sensor.ex30_soc", lock: "lock.ex30" });
  assert.deepEqual(got.roles, { soc: "sensor.ex30_soc", lock: "lock.ex30" });
  assert.deepEqual(got.details, []);
  assert.equal(hasVehicleDeviceData(got), true);
  assert.equal(hasVehicleDeviceData(classifyVehicleDevice(hass, null, {})), false, "nothing configured, nothing to show");
});

test("vehicle_entities: the roles of the card's vehicle, anything else is no mapping", () => {
  assert.deepEqual(vehicleOverride({ vehicle_entities: { soc: "sensor.a" } }), { soc: "sensor.a" });
  for (const bad of [undefined, null, {}, { vehicle_entities: "x" }, { vehicle_entities: ["x"] }, { vehicle_entities: null }]) {
    assert.equal(vehicleOverride(bad), null, JSON.stringify(bad));
  }
});

test("the editor's lists: entities that fit the role, the vehicle's device first", () => {
  const hass = withLoose(hassOf({ d: car("car", [["button.car_honk", "unknown"], ["lock.car", "locked"]]) }),
    [["sensor.loose_soc", "66", { unit_of_measurement: "%" }], ["sensor.loose_power", "3400", { unit_of_measurement: "W" }],
     ["script.fenster_zu", "off"]]);

  const soc = vehicleRoleCandidates(hass, "soc", "d");
  assert.deepEqual(soc.device.map(e => e.entityId), ["sensor.car_battery"]);
  assert.deepEqual(soc.other.map(e => e.entityId), ["sensor.loose_soc"], "a power sensor is no charge level");

  const lock = vehicleRoleCandidates(hass, "lock", "d");
  assert.deepEqual(lock.device.map(e => e.entityId), ["lock.car"]);

  const funcs = vehicleActionCandidates(hass, "d");
  assert.deepEqual(funcs.device.map(e => e.entityId), ["button.car_honk"]);
  assert.deepEqual(funcs.other.map(e => e.entityId), ["script.fenster_zu"], "a script is a function as well");
  assert.deepEqual(vehicleRoleCandidates(hass, "made_up", "d"), { device: [], other: [] });
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

test("search: the name has to stand as whole words, a longer word does not contain it", () => {
  const hass = hassOf({ mower: { ...car("mower", [["sensor.mower_distance", "812", km("total_increasing")]]), name: "Automower 430X" } });
  assert.equal(findVehicleDevice(hass, "auto", "Auto"), null);
  assert.equal(findVehicleDevice(hass, "car", "car"), null);
});

test("search: ha-evcc's own vehicle device is never the answer; of several the one with more entities", () => {
  const hass = hassOf({
    evcc:   { ...car("evcc_ex30"), name: "evcc - Fahrzeug EX30 [evcc]", integration: "evcc_intg" },
    helper: { ...car("ex30_helper"), name: "EX30 Helfer" },
    volvo:  { ...car("volvo_ex30", [["lock.volvo_ex30", "locked"]]), name: "Volvo EX30" },
  });
  assert.equal(findVehicleDevice(hass, "ex30", "EX30"), "volvo");
});

test("vehicle_device: override, none, off, and a device that is gone", () => {
  const hass = hassOf({ volvo: { ...car("volvo_ex30"), name: "Volvo EX30" }, app: { name: "EX30", ents: [["device_tracker.ex30", "home"]] } });
  assert.equal(resolveVehicleDevice(hass, {}, "ex30", "EX30"), "volvo");
  assert.equal(resolveVehicleDevice(hass, { vehicle_device: "app" }, "ex30", "EX30"), "app", "the user's pick needs no vehicle check");
  assert.equal(resolveVehicleDevice(hass, { vehicle_device: "none" }, "ex30", "EX30"), null);
  assert.equal(resolveVehicleDevice(hass, { vehicle_device: false }, "ex30", "EX30"), null);
  assert.equal(resolveVehicleDevice(hass, { vehicle_device: "deleted" }, "ex30", "EX30"), null, "no silent fallback to another device");
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

test("the evcc title never comes from ha-evcc's main device, whatever the user named it", () => {
  // One vehicle and one loadpoint: the config sensors sit on the main device,
  // only the session totals on the vehicle's own.
  const hass = hassOf({
    main: { name: "evcc [evcc]", name_by_user: "Wallbox", integration: "evcc_intg", ents: [["sensor.evcc_ex30_configvehicle_soc", "50"]] },
    veh:  { name: "evcc - Fahrzeug EX30 [evcc]", integration: "evcc_intg", ents: [["sensor.evcc_cstotal_ex30_charging_sessions_vehicle_energy", "10"]] },
  });
  assert.equal(evccVehicleTitle(hass, "ex30", { soc: "sensor.evcc_ex30_configvehicle_soc", sessions_energy: "sensor.evcc_cstotal_ex30_charging_sessions_vehicle_energy", repeating_plans: [] }), "EX30");
  assert.equal(evccVehicleTitle(hass, "ex30", { soc: "sensor.evcc_ex30_configvehicle_soc", repeating_plans: [] }), null);
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

test("an image entity on the device is the picture role", () => {
  const hass = hassOf({ d: { name: "Car", ents: [["sensor.car_battery", "70", pct], ["sensor.car_range", "250", km()], ["image.car", "2026-01-01T00:00:00", { entity_picture: "/api/image_proxy/image.car?token=x" }]] } });
  assert.equal(classifyVehicleDevice(hass, "d").roles.image, "image.car");
});

test("climate: a climate entity, else a switch, else a start/stop pair of buttons, told by words", () => {
  const btn = (name, tk) => [`button.car_${name}`, "unknown", {}, tk];
  const pair = hassOf({ d: car("car", [btn("klima_an", "climatization_start"), btn("klima_aus", "climatization_stop"), btn("hupen", "honk"), btn("blinken", "flash")]) });
  const got = classifyVehicleDevice(pair, "d");
  assert.deepEqual(got.climate, { start: "button.car_klima_an", stop: "button.car_klima_aus" });
  assert.deepEqual(got.actions, ["button.car_blinken", "button.car_hupen"], "the climate buttons are no generic actions");

  const lone = classifyVehicleDevice(hassOf({ d: car("car", [btn("klima_an", "climatization_start"), btn("hupen", "honk")]) }), "d");
  assert.equal(lone.climate, null, "a start without a stop is no climate control");
  assert.deepEqual(lone.actions, ["button.car_hupen", "button.car_klima_an"]);

  const entity = classifyVehicleDevice(hassOf({ d: car("car", [["climate.car", "off", {}], ["switch.car_preconditioning", "off", {}, "preconditioning"], btn("klima_an", "climatization_start"), btn("klima_aus", "climatization_stop")]) }), "d");
  assert.deepEqual(entity.climate, { entity: "climate.car" }, "a climate entity wins");
  assert.deepEqual(entity.actions, ["button.car_klima_an", "button.car_klima_aus"], "then the buttons stay plain actions");

  const sw = classifyVehicleDevice(hassOf({ d: car("car", [["switch.car_preconditioning", "off", {}, "preconditioning"], ["switch.car_sentry", "off", {}, "sentry_mode"]]) }), "d");
  assert.deepEqual(sw.climate, { entity: "switch.car_preconditioning" }, "a switch only by its words");

  assert.equal(classifyVehicleDevice(hassOf({ d: car("car") }), "d").climate, null);
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
