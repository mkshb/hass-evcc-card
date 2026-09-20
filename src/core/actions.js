// Every write the card sends to Home Assistant. Methods are mixed into EvccCard.prototype.
export const actions = {
  // ── Service calls ───────────────────────────────────────────────────────
  // The card writes only through these methods, so domain, service and payload
  // of every operable control sit in one file instead of next to the listener
  // that happens to trigger them. The `contracts` group of the test suite pins
  // each of them down. They all return what hass returns, callers that report
  // failures await the promise or chain on it.

  _setSelectOption(entityId, option) {
    return this._hass.callService("select", "select_option", { entity_id: entityId, option });
  },

  _setNumberValue(entityId, value) {
    return this._hass.callService("number", "set_value", { entity_id: entityId, value });
  },

  // Toggles pass the state they currently show, not the one they want: a
  // control rendered "on" turns off.
  _toggleEntity(domain, entityId, isOn) {
    return this._hass.callService(domain, isOn ? "turn_off" : "turn_on", { entity_id: entityId });
  },

  _pressButton(entityId) {
    return this._hass.callService("button", "press", { entity_id: entityId });
  },

  // ── ha-evcc plan services ───────────────────────────────────────────────
  // A vehicle known to evcc carries its plan itself, everything else (guest
  // vehicle, vehicle without SoC) is planned on the loadpoint.

  _setVehiclePlan(vehicle, soc, startdate) {
    return this._hass.callService("evcc_intg", "set_vehicle_plan", { vehicle, soc, startdate });
  },

  _setLoadpointPlan(loadpoint, soc, startdate) {
    return this._hass.callService("evcc_intg", "set_loadpoint_plan", { loadpoint, soc, startdate });
  },

  _deleteVehiclePlan(vehicle) {
    return this._hass.callService("evcc_intg", "del_vehicle_plan", { vehicle });
  },

  // ha-evcc has no del_loadpoint_plan, an empty plan is the delete.
  _clearLoadpointPlan(loadpoint) {
    return this._setLoadpointPlan(loadpoint, 0, "");
  },
};
