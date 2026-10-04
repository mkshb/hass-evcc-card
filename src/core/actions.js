// How long a written value stands in for the state before HA has to have
// answered: ha-evcc bundles evcc updates for up to two seconds, HA and the
// card's own debounce add a little.
const EXPECT_MS = 6000;

// How long a command to a vehicle counts as running while its state has not
// moved yet: it travels through the maker's cloud to a car that may first have
// to wake up, which takes seconds, sometimes a minute.
const COMMAND_MS = 90000;

// Switches a disabled ha-evcc entity on in the entity registry (admins only,
// HA refuses everyone else). HA answers with `reload_delay` when it reloads the
// integration on its own after that many seconds, or `require_restart`. A plain
// function, since the editor enables entities as well and has no mixins.
export function enableEntity(hass, entityId) {
  return hass.callWS({ type: "config/entity_registry/update", entity_id: entityId, disabled_by: null });
}

// Every write the card sends to Home Assistant. Methods are mixed into EvccCard.prototype.
export const actions = {
  // ── Service calls ───────────────────────────────────────────────────────
  // The card writes only through these methods, so domain, service and payload
  // of every operable control sit in one file instead of next to the listener
  // that happens to trigger them. The `contracts` group of the test suite pins
  // each of them down. They all return what hass returns, callers that report
  // failures await the promise or chain on it.

  _setSelectOption(entityId, option) {
    return this._expect(entityId, String(option),
      this._hass.callService("select", "select_option", { entity_id: entityId, option }));
  },

  _setNumberValue(entityId, value) {
    return this._expect(entityId, String(value),
      this._hass.callService("number", "set_value", { entity_id: entityId, value }));
  },

  // Toggles pass the state they currently show, not the one they want: a
  // control rendered "on" turns off.
  _toggleEntity(domain, entityId, isOn) {
    return this._expect(entityId, isOn ? "off" : "on",
      this._hass.callService(domain, isOn ? "turn_off" : "turn_on", { entity_id: entityId }));
  },

  // ── Optimistic state ────────────────────────────────────────────────────
  // A written value takes up to a few seconds to come back through evcc,
  // ha-evcc and HA, and every render in between would draw the old state,
  // so a pressed mode button or a flipped toggle fell back until HA answered.
  // The value is noted here and the render reads it in place of the state
  // (see the states proxy in _render) until HA reports anything else for
  // the entity, a failed call drops it, and a stale note expires on its own.
  _expect(entityId, value, call) {
    const state = this._hass?.states?.[entityId]?.state;
    if (state != null) this._expected[entityId] = { value, from: state, ts: Date.now() };
    call?.catch?.(() => { delete this._expected[entityId]; });
    return call;
  },

  // The state object a render sees for an entity: the real one, or a copy
  // carrying the expected value while HA still reports what it did before.
  _expectedState(entityId, real) {
    const e = this._expected[entityId];
    if (!e || !real) return real;
    if (real.state !== e.from || Date.now() - e.ts > EXPECT_MS) {
      delete this._expected[entityId];
      return real;
    }
    return { ...real, state: e.value };
  },

  _pressButton(entityId) {
    return this._hass.callService("button", "press", { entity_id: entityId });
  },

  // Grid discharging is allowed and its limit set in one step: evcc accepts the
  // limit only once discharging into the grid is allowed, so it is written
  // after the switch. Switching off needs no second call, evcc drops the limit
  // itself; the limit is marked as gone right away.
  _setGridDischarge(switchId, limitId, on, startValue) {
    if (!on) {
      const call = this._toggleEntity("switch", switchId, true);
      if (limitId) this._expect(limitId, "unknown", call);
      return call;
    }
    return this._toggleEntity("switch", switchId, false)
      .then(() => limitId && startValue != null ? this._setNumberValue(limitId, startValue) : null);
  },

  // Removes a limit through its clear button (ha-evcc sends a DELETE to evcc);
  // the limit reads "unknown" from then on.
  _clearLimit(clearId, limitId) {
    return this._expect(limitId, "unknown", this._pressButton(clearId));
  },

  // ── Vehicle commands ───────────────────────────────────────────────────
  // Commands to the vehicle's own integration (vehicle mode, vehicle_actions).
  // They are not marked with the target state like evcc's controls: the car
  // may refuse or never answer, so the control shows that the command is
  // running (_commandPending) instead of claiming it has been done.

  // A lock entity, or a switch that `vehicle_entities` put into the lock role.
  _setLock(entityId, lock) {
    const domain  = entityId.slice(0, entityId.indexOf("."));
    const service = domain === "lock" ? (lock ? "lock" : "unlock") : (lock ? "turn_on" : "turn_off");
    return this._command(entityId, this._hass.callService(domain, service, { entity_id: entityId }), true);
  },

  // A climate entity or a switch; `on` is the state wanted.
  _setClimate(entityId, on) {
    const domain = entityId.slice(0, entityId.indexOf("."));
    return this._command(entityId, this._hass.callService(domain, on ? "turn_on" : "turn_off", { entity_id: entityId }), true);
  },

  // A function of the vehicle: a button of its integration, or a script or scene
  // a configuration named in `vehicle_entities.actions`. All three are pressed
  // and nothing is read back.
  _pressVehicleButton(entityId) {
    const domain = entityId.slice(0, entityId.indexOf("."));
    const call = domain === "button"
      ? this._pressButton(entityId)
      : this._hass.callService(domain, "turn_on", { entity_id: entityId });
    return this._command(entityId, call, false);
  },

  // Runs while the call is in flight and, with `untilState`, until HA reports
  // a new state for the entity or COMMAND_MS have passed. A refused call ends
  // it at once and says so in the console.
  _command(entityId, call, untilState) {
    const cmd = { from: this._hass?.states?.[entityId]?.state, ts: Date.now(), inFlight: true, untilState };
    this._commands[entityId] = cmd;
    this._render();
    Promise.resolve(call)
      .then(() => { cmd.inFlight = false; },
            (e) => { if (this._commands[entityId] === cmd) delete this._commands[entityId];
                     console.warn(`[evcc-card] ${entityId}: command failed:`, e?.message || e); })
      .finally(() => {
        this._render();
        if (untilState) setTimeout(() => this._render(), COMMAND_MS + 100);
      });
    return call;
  },

  _commandPending(entityId) {
    const cmd = this._commands[entityId];
    if (!cmd) return false;
    if (cmd.inFlight) return true;
    const state = this._hass?.states?.[entityId]?.state;
    if (!cmd.untilState || state !== cmd.from || Date.now() - cmd.ts > COMMAND_MS) {
      delete this._commands[entityId];
      return false;
    }
    return true;
  },

  _enableEntity(entityId) {
    return enableEntity(this._hass, entityId);
  },

  // ── ha-evcc plan services ───────────────────────────────────────────────
  // A vehicle known to evcc carries its plan itself and is planned in percent.
  // A loadpoint is planned in kWh and is addressed by its 1-based evcc index,
  // never by its name. ha-evcc registers these services without a schema and
  // drops a call whose `loadpoint`/`energy` is not an integer inside set_plan(),
  // without an error and with an empty response, so a caller that cannot supply
  // both must not call at all instead of reporting a plan that evcc never got.
  // The services serve every ha-evcc instance; `config_entry_id` names the one
  // this card shows. Without it ha-evcc picks the instance set up last, so with
  // two instances a plan could land on the wrong evcc. A version that does not
  // know the field ignores it (no schema).

  _planService(service, data) {
    const payload = this._entryId ? { ...data, config_entry_id: this._entryId } : data;
    return this._hass.callService("evcc_intg", service, payload);
  },

  _setVehiclePlan(vehicle, soc, startdate) {
    return this._planService("set_vehicle_plan", { vehicle, soc, startdate });
  },

  _setLoadpointPlan(loadpointIndex, energy, startdate) {
    return this._planService("set_loadpoint_plan", {
      loadpoint: Math.round(loadpointIndex),
      energy:    Math.round(energy),
      startdate,
    });
  },

  _deleteVehiclePlan(vehicle) {
    return this._planService("del_vehicle_plan", { vehicle });
  },

  _deleteLoadpointPlan(loadpointIndex) {
    return this._planService("del_loadpoint_plan", {
      loadpoint: Math.round(loadpointIndex),
    });
  },
};
