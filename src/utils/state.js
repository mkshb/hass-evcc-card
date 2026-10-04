export function stateVal(hass, entityId) {
  return hass.states[entityId]?.state ?? null;
}

export function attr(hass, entityId, key) {
  return hass.states[entityId]?.attributes?.[key] ?? null;
}

export function unitStr(hass, entityId) {
  return attr(hass, entityId, "unit_of_measurement") ?? "";
}

export function displayUnit(hass, entityId) {
  const rawUnit = unitStr(hass, entityId);
  return rawUnit || (entityId.includes("soc") ? "%" : "");
}

// An entity the integration actually provides right now. HA keeps registry
// entries the integration no longer creates (an older or newer ha-evcc) as an
// unavailable state marked `restored`; a control for one of them would do
// nothing. Checked when rendering, not in the discovery: during HA's start
// every entity is restored for a moment, and the discovery is cached.
export function isLive(hass, entityId) {
  const s = entityId ? hass.states[entityId] : null;
  return !!s && !s.attributes?.restored;
}

export function isOn(hass, entityId) {
  const s = stateVal(hass, entityId);
  return s === "on" || s === "true";
}
