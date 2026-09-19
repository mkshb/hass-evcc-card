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

export function isOn(hass, entityId) {
  const s = stateVal(hass, entityId);
  return s === "on" || s === "true";
}
