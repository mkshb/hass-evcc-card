// What Home Assistant knows about a vehicle beyond ha-evcc: the device of the
// vehicle's own integration and the entities on it. Nothing in here is specific
// to one brand. A device is recognised by what it carries (a traction battery
// level and a distance), its entities are sorted by domain, device class and
// unit, and only where those leave a choice (three distances on one device) by
// words in the translation key and the entity id, which stay the same in every
// UI language. Everything is read from hass.devices and hass.entities, the
// registries the frontend already holds, so linking a vehicle costs no call.

const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// A name as a pattern that only matches whole words, separators between its
// letters optional: "id7" finds "ID.7 Pro", "blue_e_golf" finds "blue e-Golf",
// "auto" does not find "Automower".
const wordPattern = w => new RegExp(`(?<![a-z0-9])${[...w].join("[^a-z0-9]*")}(?![a-z0-9])`, "i");

const domainOf = entityId => entityId.slice(0, entityId.indexOf("."));

// Words that tell entities of the same kind apart.
const HINTS = {
  range:      /range|reichweite|distance_to_empty|autonom|remaining_distance/,
  notRange:   /service|wartung|maintenance|inspection|trip|oil/,
  odometer:   /odometer|kilometerstand|mileage|milage/,
  trip:       /trip|fahrtstrecke|journey/,
  auxBattery: /12v|12_v|aux|starter|low_voltage/,
  target:     /target|soll|charge_limit|limit/,
  capacity:   /capacity|kapazit/,
  climate:    /climat|climate|precondition|preheat|pre_heat|hvac|air_condition|aircon|klima/,
  start:      /start|activate|_on$|begin/,
  stop:       /stop|deactivate|_off$|cancel|end$/,
};

// The roles the card fills from the vehicle's own integration, and what an
// entity has to look like to be offered for one in the editor. The sorting
// below finds them on its own; `vehicle_entities` names one by hand where the
// sorting has no chance, because an integration words its entities differently
// or keeps them on another device. `climate` marks the three roles that make up
// the preconditioning, which is not a plain role but an entity or a pair of
// commands.
const isCommand = e => ["button", "script", "scene"].includes(e.domain);
export const VEHICLE_ROLES = [
  { key: "soc",           fits: e => e.domain === "sensor" && e.unit === "%" },
  { key: "range",         fits: e => isDistance(e) },
  { key: "odometer",      fits: e => isDistance(e) },
  { key: "capacity",      fits: e => e.domain === "sensor" && (e.unit === "kWh" || e.deviceClass === "energy_storage") },
  { key: "target_soc",    fits: e => ["sensor", "number"].includes(e.domain) && e.unit === "%" },
  { key: "lock",          fits: e => ["lock", "switch"].includes(e.domain) },
  { key: "location",      fits: e => ["device_tracker", "sensor"].includes(e.domain) },
  { key: "image",         fits: e => ["image", "camera"].includes(e.domain) },
  { key: "driving",       fits: e => ["binary_sensor", "sensor"].includes(e.domain) },
  { key: "charging",      fits: e => ["binary_sensor", "sensor"].includes(e.domain) },
  { key: "plugged",       fits: e => ["binary_sensor", "sensor"].includes(e.domain) },
  { key: "climate",       fits: e => ["climate", "switch"].includes(e.domain), climate: "entity" },
  { key: "climate_start", fits: isCommand, climate: "start" },
  { key: "climate_stop",  fits: isCommand, climate: "stop" },
];

// What can be a function of the vehicle: something that is pressed and does not
// have to be read back. A switch that stays on is the preconditioning, not a
// function.
export const VEHICLE_ACTION_DOMAINS = ["button", "script", "scene"];

// The `vehicle_entities` of the card, or null. One card shows one vehicle, so the
// option names its roles directly. Reading it happens here only, so the card,
// the editor and the validation agree on the shape.
export function vehicleOverride(config) {
  const opt = config?.vehicle_entities;
  return opt && typeof opt === "object" && !Array.isArray(opt) ? opt : null;
}

// The entities of a device, enabled and visible, each with what the sorting
// below looks at.
function deviceEntities(hass, deviceId) {
  const out = [];
  for (const ent of Object.values(hass.entities || {})) {
    if (ent.device_id !== deviceId || ent.hidden) continue;
    const st = hass.states?.[ent.entity_id];
    if (!st) continue;
    const a = st.attributes || {};
    out.push({
      entityId:    ent.entity_id,
      domain:      domainOf(ent.entity_id),
      deviceClass: a.device_class ?? null,
      unit:        a.unit_of_measurement ?? null,
      stateClass:  a.state_class ?? null,
      sourceType:  a.source_type ?? null,
      options:     Array.isArray(a.options) ? a.options : [],
      hint:        `${ent.translation_key ?? ""} ${ent.entity_id.slice(ent.entity_id.indexOf(".") + 1)}`.toLowerCase(),
      state:       st.state,
    });
  }
  return out;
}

const isDistance = e => e.domain === "sensor" && (e.deviceClass === "distance" || e.unit === "km" || e.unit === "mi");
const isLevel    = e => e.domain === "sensor" && e.unit === "%" && e.deviceClass === "battery" && !HINTS.auxBattery.test(e.hint);

// Sort the entities of a vehicle device into what the card shows:
//   roles     one entity each: soc, range, odometer, capacity, target_soc, lock, location, image,
//             and what the vehicle is doing: driving, charging, plugged
//   openings  doors, windows, lids
//   problems  warning flags
//   climate   how to precondition: { entity } for a climate entity or a switch
//             to toggle, { start, stop } for a pair of commands, or null
//   actions   the other buttons (flash, honk, refresh, ...), in the order the
//             config gives them, else by entity id
//   details   every other sensor and binary sensor
// `override` is the `vehicle_entities` entry of the vehicle and has the last
// word: it is applied before the rest is sorted, so an entity the config takes
// out of a role lands in the details and one it puts into a role leaves them.
// Without a device the sorting has nothing to look at and the override alone
// makes up the roles: a vehicle whose values come from single entities needs no
// device at all.
export function classifyVehicleDevice(hass, deviceId, override = null) {
  const ents  = deviceId ? deviceEntities(hass, deviceId) : [];
  const roles = {};
  const take  = (role, found) => { if (found && !roles[role]) roles[role] = found.entityId; };

  take("soc", ents.find(isLevel));

  const distances = ents.filter(isDistance);
  take("odometer", distances.find(e => HINTS.odometer.test(e.hint))
    // No telling name: the counter that only ever rises and is no trip meter,
    // the highest one if there are several.
    ?? distances.filter(e => e.stateClass === "total_increasing" && !HINTS.trip.test(e.hint))
         .sort((a, b) => (parseFloat(b.state) || 0) - (parseFloat(a.state) || 0))[0]);
  const ranges = distances.filter(e => e.entityId !== roles.odometer && e.stateClass !== "total_increasing" && !HINTS.notRange.test(e.hint));
  take("range", ranges.find(e => HINTS.range.test(e.hint)) ?? (ranges.length === 1 ? ranges[0] : null));

  take("capacity", ents.find(e => e.domain === "sensor" && (e.deviceClass === "energy_storage" || (e.unit === "kWh" && HINTS.capacity.test(e.hint)))));
  take("target_soc", ents.find(e => e.domain === "sensor" && e.unit === "%" && e.entityId !== roles.soc && HINTS.target.test(e.hint)));
  take("image", ents.find(e => e.domain === "image"));
  take("lock", ents.find(e => e.domain === "lock"));
  take("location", ents.find(e => e.domain === "device_tracker" && e.sourceType === "gps") ?? ents.find(e => e.domain === "device_tracker"));

  // What the vehicle is doing. A binary sensor says it through its device class,
  // a status sensor through the options it can take, which are keys and not
  // translated: one that can be "charging" is the charge status, one that can
  // be "connected" and "disconnected" is the plug.
  const binary = cls => ents.find(e => e.domain === "binary_sensor" && cls.includes(e.deviceClass));
  const status = (...opts) => ents.find(e => e.domain === "sensor" && opts.every(o => e.options.includes(o)));
  take("driving",  binary(["running", "moving"]));
  take("charging", binary(["battery_charging"]) ?? status("charging"));
  take("plugged",  binary(["plug"]) ?? status("connected", "disconnected"));

  // Preconditioning. A climate entity says it by its domain; a switch or a
  // pair of buttons only by words, as buttons carry no device class. A lone
  // start button without its stop counterpart stays an ordinary action.
  const climateButtons = ents.filter(e => e.domain === "button" && HINTS.climate.test(e.hint));
  const start = climateButtons.find(e => HINTS.start.test(e.hint) && !HINTS.stop.test(e.hint));
  const stop  = climateButtons.find(e => HINTS.stop.test(e.hint));
  const climateEntity = ents.find(e => e.domain === "climate")
    ?? ents.find(e => e.domain === "switch" && HINTS.climate.test(e.hint));
  let climate = climateEntity ? { entity: climateEntity.entityId }
              : start && stop ? { start: start.entityId, stop: stop.entityId } : null;

  // What the config says, role by role: an entity id takes the role, "none"
  // switches it off, and a role the config does not mention keeps what the
  // sorting found. The three climate roles are collected first and decide
  // together, because an entity to toggle and a pair of commands are two ways
  // to say the same thing and the entity is the shorter one.
  if (override) {
    const climateOv = {};
    for (const { key, climate: slot } of VEHICLE_ROLES) {
      if (!(key in override)) continue;
      const raw = override[key];
      const id  = typeof raw === "string" && raw.trim() && raw.trim() !== "none" ? raw.trim() : null;
      if (slot) climateOv[slot] = id;
      else if (id) roles[key] = id;
      else delete roles[key];
    }
    if (Object.keys(climateOv).length) {
      const entity  = "entity" in climateOv ? climateOv.entity : (climate?.entity ?? null);
      const startId = "start"  in climateOv ? climateOv.start  : (climate?.start  ?? null);
      const stopId  = "stop"   in climateOv ? climateOv.stop   : (climate?.stop   ?? null);
      climate = entity ? { entity } : (startId && stopId ? { start: startId, stop: stopId } : null);
    }
  }

  const climateIds = new Set(climate ? Object.values(climate) : []);
  // The functions: the buttons of the device, or exactly what the config lists,
  // in its order. An empty list means the vehicle is to show none.
  let actions = ents.filter(e => e.domain === "button" && !climateIds.has(e.entityId)).map(e => e.entityId).sort();
  if (override && "actions" in override) {
    const raw  = override.actions;
    const list = Array.isArray(raw) ? raw : (raw === "none" || raw === false ? [] : null);
    if (list) actions = list.filter(id => typeof id === "string" && id.trim()).map(id => id.trim());
  }

  // The status entities stay in the details: the picture sums them up, it does
  // not replace "charge status: done".
  const STATUS   = ["driving", "charging", "plugged"];
  const used     = new Set([
    ...Object.entries(roles).filter(([role]) => !STATUS.includes(role)).map(([, id]) => id),
    ...climateIds, ...actions,
  ]);
  const openings = ents.filter(e => e.domain === "binary_sensor" && ["door", "window", "opening", "garage_door"].includes(e.deviceClass) && !used.has(e.entityId));
  const problems = ents.filter(e => e.domain === "binary_sensor" && e.deviceClass === "problem" && !used.has(e.entityId));
  const grouped  = new Set([...openings, ...problems].map(e => e.entityId));
  const details  = ents.filter(e => (e.domain === "sensor" || e.domain === "binary_sensor") && !used.has(e.entityId) && !grouped.has(e.entityId));

  const ids = list => list.map(e => e.entityId).sort();
  return { roles, climate, openings: ids(openings), problems: ids(problems), actions, details: ids(details) };
}

// Whether a classification says anything at all. A vehicle without a device and
// without a single configured entity has nothing of its own to show.
export function hasVehicleDeviceData(dev) {
  return !!dev && (Object.keys(dev.roles).length > 0 || !!dev.climate
    || dev.actions.length > 0 || dev.openings.length > 0 || dev.problems.length > 0 || dev.details.length > 0);
}

// The device that belongs to an evcc vehicle. It has to be a vehicle, which the
// card reads off what it carries, a battery level in percent and a distance,
// and its name or model has to contain the vehicle's evcc title or the slug
// ha-evcc made of it, as whole words. Both conditions together keep short
// names honest: "id7" is part of many device names, but hardly of another
// car's. The companion app of a car registers a device of the same name with
// a tracker and nothing else, and drops out on the first condition. Several
// matches: the one with the most entities, the integration rather than a
// helper built on top of it.
export function findVehicleDevice(hass, slug, title = null) {
  const wanted = [...new Set([norm(slug), norm(title)])].filter(w => w.length >= 2).map(wordPattern);
  if (!wanted.length) return null;

  const count = {};
  for (const ent of Object.values(hass.entities || {})) {
    if (ent.device_id) count[ent.device_id] = (count[ent.device_id] || 0) + 1;
  }

  let best = null;
  for (const dev of Object.values(hass.devices || {})) {
    if ((dev.identifiers || []).some(([domain]) => domain === "evcc_intg")) continue;
    const names = [dev.name_by_user, dev.name, dev.model].filter(Boolean);
    if (!names.some(n => wanted.some(w => w.test(n)))) continue;
    const ents = deviceEntities(hass, dev.id);
    if (!ents.some(isLevel) || !ents.some(isDistance)) continue;
    if (!best || (count[dev.id] || 0) > (count[best] || 0)) best = dev.id;
  }
  return best;
}

// Every device the editor can offer for a vehicle, the ones that look like a
// vehicle first. The rest stays selectable: an integration that reports no
// distance at all is still a vehicle if its owner says so.
export function listVehicleDevices(hass) {
  // One pass over the registry instead of one per device: an installation has
  // hundreds of devices and thousands of entities.
  const byDevice = {};
  for (const ent of Object.values(hass.entities || {})) {
    if (!ent.device_id || ent.hidden || !hass.states?.[ent.entity_id]) continue;
    const a = hass.states[ent.entity_id].attributes || {};
    (byDevice[ent.device_id] ??= []).push({
      domain: domainOf(ent.entity_id), deviceClass: a.device_class ?? null, unit: a.unit_of_measurement ?? null,
      hint: `${ent.translation_key ?? ""} ${ent.entity_id}`.toLowerCase(),
    });
  }
  return Object.values(hass.devices || {})
    .filter(dev => byDevice[dev.id] && !(dev.identifiers || []).some(([domain]) => domain === "evcc_intg"))
    .map(dev => ({ id: dev.id, name: dev.name_by_user || dev.name || dev.id,
                   vehicleLike: byDevice[dev.id].some(isLevel) && byDevice[dev.id].some(isDistance) }))
    .sort((a, b) => (b.vehicleLike - a.vehicleLike) || a.name.localeCompare(b.name));
}

// What a linked vehicle is doing, as far as its own integration tells:
// "charging", "driving", "connected" or "parked". A vehicle that charges is not
// driving, whatever the engine flag says, and a plugged one that does not charge
// is connected. Unknown states count as "no".
export function vehicleDeviceState(hass, roles = {}) {
  const is = (role, ...values) => values.includes(hass.states?.[roles[role]]?.state);
  if (is("charging", "on", "charging")) return "charging";
  if (is("driving", "on"))              return "driving";
  if (is("plugged", "on", "connected")) return "connected";
  return "parked";
}

// `vehicle_device` decides: a device id overrides the search, "none" (or false)
// leaves the card without one, and without the option the search answers.
// Returns the device id or null.
export function resolveVehicleDevice(hass, config, slug, title = null) {
  const chosen = config?.vehicle_device;
  if (chosen === "none" || chosen === false) return null;
  if (typeof chosen === "string" && chosen) return hass.devices?.[chosen] ? chosen : null;
  return findVehicleDevice(hass, slug, title);
}

// The title evcc gave a vehicle, from the device ha-evcc creates for it
// ("evcc - Fahrzeug EX30 [evcc]"). The words around it follow the language of
// the integration, so the title is located by the slug instead, underscores
// standing for whatever slugify replaced: "blue_e_golf" finds "blue e-Golf".
// Only a device whose name holds the slug is the vehicle's: with one vehicle
// and one loadpoint ha-evcc puts the vehicle's config sensors on its main
// device, whose name the user may have changed to "Wallbox".
export function evccVehicleTitle(hass, slug, vehicle) {
  const ids = [...Object.values(vehicle || {}).filter(v => typeof v === "string"), ...(vehicle?.repeating_plans || [])];
  const pattern = new RegExp(slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[^a-z0-9]+"), "i");
  const seen = new Set();
  for (const entityId of ids) {
    const dev = hass.devices?.[hass.entities?.[entityId]?.device_id];
    if (!dev || seen.has(dev.id)) continue;
    seen.add(dev.id);
    const m = String(dev.name ?? "").match(pattern);
    if (m) return dev.name_by_user || m[0];
  }
  return null;
}

// Every entity the editor can offer for a role or for a function: the ones on
// the vehicle's own device first, then everything else that would fit. The
// filter is what keeps the lists short enough for a plain select - a charge
// level is looked for among the percentages, not among thousands of entities.
// A configuration is free to name something outside these lists, the card only
// ever reads the state.
function vehicleEntityCandidates(hass, fits, deviceId) {
  const device = [];
  const other  = [];
  for (const entityId of Object.keys(hass?.states || {})) {
    const reg = hass.entities?.[entityId];
    if (reg?.hidden) continue;
    const a = hass.states[entityId].attributes || {};
    const e = {
      entityId,
      domain:      domainOf(entityId),
      deviceClass: a.device_class ?? null,
      unit:        a.unit_of_measurement ?? null,
    };
    if (!fits(e)) continue;
    const name = reg?.name || a.friendly_name || entityId;
    (deviceId && reg?.device_id === deviceId ? device : other).push({ entityId, name });
  }
  const byName = (a, b) => a.name.localeCompare(b.name) || a.entityId.localeCompare(b.entityId);
  return { device: device.sort(byName), other: other.sort(byName) };
}

export function vehicleRoleCandidates(hass, roleKey, deviceId = null) {
  const role = VEHICLE_ROLES.find(r => r.key === roleKey);
  return vehicleEntityCandidates(hass, role ? role.fits : () => false, deviceId);
}

export function vehicleActionCandidates(hass, deviceId = null) {
  return vehicleEntityCandidates(hass, e => VEHICLE_ACTION_DOMAINS.includes(e.domain), deviceId);
}
