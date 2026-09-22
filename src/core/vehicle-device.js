// What Home Assistant knows about a vehicle beyond ha-evcc: the device of the
// vehicle's own integration and the entities on it. Nothing in here is specific
// to one brand. A device is recognised by what it carries (a traction battery
// level and a distance), its entities are sorted by domain, device class and
// unit, and only where those leave a choice (three distances on one device) by
// words in the translation key and the entity id, which stay the same in every
// UI language. Everything is read from hass.devices and hass.entities, the
// registries the frontend already holds, so linking a vehicle costs no call.

const norm = s => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

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
};

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
//   actions   buttons
//   details   every other sensor and binary sensor
export function classifyVehicleDevice(hass, deviceId) {
  const ents  = deviceEntities(hass, deviceId);
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

  // The status entities stay in the details: the picture sums them up, it does
  // not replace "charge status: done".
  const STATUS   = ["driving", "charging", "plugged"];
  const used     = new Set(Object.entries(roles).filter(([role]) => !STATUS.includes(role)).map(([, id]) => id));
  const openings = ents.filter(e => e.domain === "binary_sensor" && ["door", "window", "opening", "garage_door"].includes(e.deviceClass));
  const problems = ents.filter(e => e.domain === "binary_sensor" && e.deviceClass === "problem");
  const actions  = ents.filter(e => e.domain === "button");
  const grouped  = new Set([...openings, ...problems].map(e => e.entityId));
  const details  = ents.filter(e => (e.domain === "sensor" || e.domain === "binary_sensor") && !used.has(e.entityId) && !grouped.has(e.entityId));

  const ids = list => list.map(e => e.entityId).sort();
  return { roles, openings: ids(openings), problems: ids(problems), actions: ids(actions), details: ids(details) };
}

// The device that belongs to an evcc vehicle. It has to be a vehicle, which the
// card reads off what it carries, a battery level in percent and a distance,
// and its name or model has to contain the vehicle's evcc title or the slug
// ha-evcc made of it. Both conditions together keep short names honest: "id7"
// is part of many device names, but hardly of another car's. The companion app
// of a car registers a device of the same name with a tracker and nothing else,
// and drops out on the first condition. Several matches: the one with the most
// entities, the integration rather than a helper built on top of it.
export function findVehicleDevice(hass, slug, title = null) {
  const wanted = [...new Set([norm(slug), norm(title)])].filter(w => w.length >= 2);
  if (!wanted.length) return null;

  const count = {};
  for (const ent of Object.values(hass.entities || {})) {
    if (ent.device_id) count[ent.device_id] = (count[ent.device_id] || 0) + 1;
  }

  let best = null;
  for (const dev of Object.values(hass.devices || {})) {
    if ((dev.identifiers || []).some(([domain]) => domain === "evcc_intg")) continue;
    const names = [dev.name_by_user, dev.name, dev.model].map(norm).filter(Boolean);
    if (!names.some(n => wanted.some(w => n.includes(w)))) continue;
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

// `vehicle_devices` decides per vehicle: a device id overrides the search,
// "none" switches the link off for that vehicle, and `vehicle_devices: false`
// switches it off for the card. Returns the device id or null.
export function resolveVehicleDevice(hass, config, slug, title = null) {
  const opt = config?.vehicle_devices;
  if (opt === false) return null;
  const chosen = opt && typeof opt === "object" ? opt[slug] : undefined;
  if (chosen === "none" || chosen === false) return null;
  if (typeof chosen === "string" && chosen) return hass.devices?.[chosen] ? chosen : null;
  return findVehicleDevice(hass, slug, title);
}

// The title evcc gave a vehicle, from the device ha-evcc creates for it
// ("evcc - Fahrzeug EX30 [evcc]"). The words around it follow the language of
// the integration, so the title is located by the slug instead, underscores
// standing for whatever slugify replaced: "blue_e_golf" finds "blue e-Golf".
export function evccVehicleTitle(hass, slug, vehicle) {
  const probe = vehicle && Object.values(vehicle).find(v => typeof v === "string");
  const ids   = [probe, ...(vehicle?.repeating_plans || [])].filter(Boolean);
  for (const entityId of ids) {
    const dev = hass.devices?.[hass.entities?.[entityId]?.device_id];
    if (!dev) continue;
    if (dev.name_by_user) return dev.name_by_user;
    const pattern = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/_/g, "[^a-z0-9]+");
    const m = String(dev.name ?? "").match(new RegExp(pattern, "i"));
    if (m) return m[0];
  }
  return null;
}
