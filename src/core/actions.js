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
  // A vehicle known to evcc carries its plan itself and is planned in percent.
  // A loadpoint is planned in kWh and is addressed by its 1-based evcc index,
  // never by its name. ha-evcc registers these services without a schema and
  // drops a call whose `loadpoint`/`energy` is not an integer inside set_plan(),
  // without an error and with an empty response, so a caller that cannot supply
  // both must not call at all instead of reporting a plan that evcc never got.

  _setVehiclePlan(vehicle, soc, startdate) {
    return this._hass.callService("evcc_intg", "set_vehicle_plan", { vehicle, soc, startdate });
  },

  _setLoadpointPlan(loadpointIndex, energy, startdate) {
    return this._hass.callService("evcc_intg", "set_loadpoint_plan", {
      loadpoint: Math.round(loadpointIndex),
      energy:    Math.round(energy),
      startdate,
    });
  },

  _deleteVehiclePlan(vehicle) {
    return this._hass.callService("evcc_intg", "del_vehicle_plan", { vehicle });
  },

  _deleteLoadpointPlan(loadpointIndex) {
    return this._hass.callService("evcc_intg", "del_loadpoint_plan", {
      loadpoint: Math.round(loadpointIndex),
    });
  },
};
