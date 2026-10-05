// Minimal stand-in for the Home Assistant `hass` object, fed from JSON fixtures
// captured on a real instance (see test/README.md). Only the surface the card
// actually touches is implemented: states, language, localize, callWS, callService.
//
// WebSocket data API (ha-evcc evcc_intg/*): served from test/fixtures/ws/ when
// `ws` is true (default). Rate timestamps in the forecast and plan-preview
// fixtures are shifted so the series starts at the current hour; otherwise a
// fixture captured yesterday would render as "no data" today.
//
// Fixture variants (all optional):
//   set:     { "binary_sensor.evcc_wp_disabled_in_config": "on", ... }  override states
//   attrs:   { "number.evcc_openwb_smart_cost_limit": { unit_of_measurement: "g/kWh" } }  override attributes
//   disable: ["number.evcc_openwb_smart_cost_limit", ...]  mark registry entries disabled and drop their state
//   rename:  { from: "evcc_", to: "myevcc_" }  rename the entity prefix everywhere (multi-instance setups)
//   tariff:  "price" (default) or "co2" - what the WS data API reports as smartCostType
//   second:  { prefix, entryId, first } - clone the fixture as a second ha-evcc config entry
//   wsName:  "…"  put this string into every name the WS data API reports (session
//            loadpoint/vehicle, currency) - used by the escaping tests
//   admin:   false - the user is no administrator; HA then refuses registry updates
//   drop:    ["button.evcc_openwb_smart_cost_limit", ...]  remove state and registry entry (never created)
//   vehicleDevice: false  leave out the vehicle integration's device (test/fixtures/vehicle_device.json),
//            so the vehicle mode runs on ha-evcc data alone
//   batteryExt: true  the battery entities of ha-evcc 2026.10.1 (grid discharge, clear
//            buttons for the battery limits), enabled; `disable` and `set` apply to
//            them as to every other entity
//   optimize: true  with batteryExt: evcc's "optimize" button, proposed to ha-evcc
//            (button.evcc_optimize)
//   optimizer: true  ha-evcc offers evcc_intg/optimizer and evcc's optimizer reports a
//            battery forecast (generated from now on, like the recorder history)
// A battery SoC by time of day: charges from 9 to 14 h, discharges overnight.
function mockSoc(t) {
  const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
  const v = h < 9 ? 45 - h * 3.5 : h < 14 ? 13.5 + (h - 9) * 17.3 : 100 - (h - 14) * 5.5;
  return Math.max(5, Math.min(100, Math.round(v)));
}

export async function createMockHass({ batteryExt = false, optimizer = false, language = "de", ws = true, set = {}, attrs = {}, disable = [], rename = null, tariff = "price", second = null, wsName = null, admin = true, drop = [], vehicleDevice = true, optimize = false } = {}) {
  const base = new URL("./fixtures/", import.meta.url);
  const json = (p) => fetch(new URL(p, base)).then(r => r.ok ? r.json() : Promise.reject(new Error(`fixture ${p}: ${r.status}`)));

  let [states, registry] = await Promise.all([json("states.json"), json("entity_registry.json")]);
  states = { ...states }; registry = registry.map(e => ({ ...e }));

  // What a vehicle integration adds to Home Assistant next to ha-evcc: a device
  // with its entities, plus the devices ha-evcc creates per vehicle. The states
  // carry their age in minutes instead of a timestamp, so "stale" means the
  // same thing on every run.
  const vd = await json("vehicle_device.json");
  const devices = Object.fromEntries(vd.devices
    .filter(d => vehicleDevice || d.identifiers.some(([domain]) => domain === "evcc_intg"))
    .map(d => [d.id, d]));
  if (vehicleDevice) {
    registry.push(...vd.entities.map(e => ({ ...e })));
    for (const [id, st] of Object.entries(vd.states)) {
      const stamp = new Date(Date.now() - st.age_min * 60000).toISOString();
      states[id] = { entity_id: id, state: st.state, attributes: st.attributes, last_changed: stamp, last_updated: stamp };
    }
  }
  if (batteryExt) {
    const euro = { min: -0.5, max: 2.5, step: 0.005, mode: "box", unit_of_measurement: "€/kWh" };
    const ext = {
      "button.evcc_battery_grid_charge_limit":           ["unknown", { friendly_name: "Hausbatterie: Netzladen Limit entfernen" }],
      "switch.evcc_battery_grid_discharge":              ["off",     { friendly_name: "Hausbatterie: Entladen ins Netz zulassen" }],
      "binary_sensor.evcc_battery_grid_discharge_active": ["off",    { friendly_name: "Hausbatterie: Netzentladen" }],
      "number.evcc_battery_grid_discharge_limit":        ["unknown", { ...euro, friendly_name: "Hausbatterie: Netzentladen € Limit ≥" }],
      "button.evcc_battery_grid_discharge_limit":        ["unknown", { friendly_name: "Hausbatterie: Netzentladen Limit entfernen" }],
    };
    if (optimize) ext["button.evcc_optimize"] = ["unknown", { friendly_name: "Optimizer neu berechnen" }];
    for (const [id, [state, attributes]] of Object.entries(ext)) {
      states[id] = { entity_id: id, state, attributes };
      registry.push({ entity_id: id, platform: "evcc_intg", config_entry_id: "01KW6EDNA9VMFE9QX98AZHH3WC", disabled_by: null,
                      unique_id: `evcc_intg.${id.split(".")[1]}`, original_name: attributes.friendly_name });
    }
  }
  for (const [id, state] of Object.entries(set)) {
    if (states[id]) states[id] = { ...states[id], state: String(state) };
  }
  for (const [id, over] of Object.entries(attrs)) {
    if (states[id]) states[id] = { ...states[id], attributes: { ...states[id].attributes, ...over } };
  }
  for (const id of drop) {
    delete states[id];
    registry = registry.filter(r => r.entity_id !== id);
  }
  for (const id of disable) {
    delete states[id];
    const e = registry.find(r => r.entity_id === id); if (e) e.disabled_by = "user";
  }
  if (rename?.from && rename?.to) {
    const ren = (id) => id.replace(new RegExp(`^([a-z_]+\\.)${rename.from}`), `$1${rename.to}`);
    states = Object.fromEntries(Object.entries(states).map(([id, s]) => [ren(id), { ...s, entity_id: ren(id) }]));
    registry = registry.map(e => ({ ...e, entity_id: ren(e.entity_id) }));
  }
  // A second ha-evcc config entry. ha-evcc derives the entity prefix from the
  // entry title (system_id = slugify(config_entry.title)), so two instances
  // always come with two prefixes AND two config_entry_ids. `first` puts the
  // clone ahead of the original in the registry, which is what decides who wins
  // the automatic detection.
  if (second) {
    const { prefix: p2 = "evcc2_", entryId: e2 = "SECOND_ENTRY_ID", first = false } = second;
    const isEvcc = (id) => /^[a-z_]+\.evcc_/.test(id);
    const clone  = (id) => id.replace(/^([a-z_]+\.)evcc_/, `$1${p2}`);
    const extraStates = {};
    for (const [id, st] of Object.entries(states)) {
      if (!isEvcc(id)) continue;
      const nid = clone(id);
      extraStates[nid] = { ...st, entity_id: nid };
    }
    const extraReg = registry.filter(e => isEvcc(e.entity_id)).map(e => ({
      ...e, entity_id: clone(e.entity_id), config_entry_id: e2,
      unique_id: `evcc_intg.${clone(e.entity_id)}`,
    }));
    states   = first ? { ...extraStates, ...states } : { ...states, ...extraStates };
    registry = first ? [...extraReg, ...registry] : [...registry, ...extraReg];
  }

  // evcc runs either on a price tariff or on a co2 signal, and the card switches
  // units, labels and which forecast it draws behind the plan on smartCostType.
  // The captured fixtures are a price tariff, so the co2 variant is derived:
  // same slot grid, values replaced by a fixed daily emission curve (g/kWh,
  // lowest around midday) so the chart has a readable shape and every run the
  // same one.
  const asCo2 = (obj) => {
    if (!obj || tariff !== "co2") return obj;
    const curve = (iso) => Math.round(300 - 120 * Math.cos(((new Date(iso).getHours() - 13) / 24) * 2 * Math.PI));
    const out = { ...obj, smartCostType: "co2" };
    delete out.currency;
    if (obj.rates) out.rates = obj.rates.map(r => ({ ...r, value: curve(r.start) }));
    if (obj.plan)  out.plan  = obj.plan.map(r => ({ ...r, value: curve(r.start) }));
    return out;
  };

  const fx = ws ? {
    capabilities: await json("ws/capabilities.json").then(c => optimizer ? { ...c, commands: [...c.commands, "optimizer"] } : c),
    sessions:     await json("ws/sessions.json"),
    forecast: {
      grid:    await json("ws/forecast_grid.json"),
      solar:   await json("ws/forecast_solar.json"),
      planner: await json("ws/forecast_planner.json"),
    },
    plan_preview: await json("ws/plan_preview.json"),
  } : null;

  // A feed-in tariff for the grid discharge view, varying over the day (the
  // grid fixture is a flat price): highest in the evening, lowest at noon.
  if (fx) fx.forecast.feedin = { ...fx.forecast.grid, rates: fx.forecast.grid.rates.map(r => {
    const h = new Date(r.start).getHours();
    return { ...r, value: Math.round((0.08 + 0.05 * Math.cos(((h - 19) / 24) * 2 * Math.PI)) * 1000) / 1000 };
  }) };

  // Every name the integration passes through from evcc, replaced in one go.
  if (fx && wsName) {
    fx.sessions = { ...fx.sessions, sessions: fx.sessions.sessions.map(s => ({ ...s, loadpoint: wsName, vehicle: wsName })) };
    for (const k of Object.keys(fx.forecast)) fx.forecast[k] = { ...fx.forecast[k], currency: wsName };
    fx.plan_preview = { ...fx.plan_preview, currency: wsName };
  }

  // Shift every ISO timestamp in `rates`/`plan` (+ planTime) by the same offset so
  // the first slot starts at the top of the current hour. Keeps the fixture's
  // spacing and values, makes the card's "from now" windows non-empty.
  const rebase = (obj) => {
    const slots = obj.rates || obj.plan || [];
    if (!slots.length) return obj;
    const now = new Date(); now.setMinutes(0, 0, 0);
    const offset = now.getTime() - new Date(slots[0].start).getTime();
    const shift = (iso) => iso ? new Date(new Date(iso).getTime() + offset).toISOString() : iso;
    const out = { ...obj };
    if (obj.rates) out.rates = obj.rates.map(r => ({ ...r, start: shift(r.start), end: shift(r.end) }));
    if (obj.plan)  out.plan  = obj.plan.map(r => ({ ...r, start: shift(r.start), end: shift(r.end) }));
    if (obj.planTime) out.planTime = shift(obj.planTime);
    return out;
  };

  const hass = {
    language,
    locale: { language },
    config: { version: "2026.9.2-mock", time_zone: "Europe/Berlin" },
    user: { id: "mock", name: "Mock", is_admin: admin },
    states,
    // The registry as the HA frontend mirrors it into hass.entities: one entry
    // per entity with its platform, disabled entries left out. The card picker
    // reads the ha-evcc prefixes from here, synchronously.
    entities: Object.fromEntries(registry.filter(e => !e.disabled_by).map(e => [e.entity_id, {
      entity_id: e.entity_id, platform: e.platform, name: e.original_name,
      device_id: e.device_id ?? null, entity_category: e.entity_category ?? null, translation_key: e.translation_key ?? null,
    }])),
    devices,
    wsCalls: [],
    serviceCalls: [],
    // HA frontend translation lookup; the card only uses it for optional
    // labels (vehicle titles) and falls back when it returns "".
    localize: () => "",

    callWS(msg) {
      hass.wsCalls.push(msg);
      switch (msg.type) {
        case "config/entity_registry/list":
          return Promise.resolve(registry);
        case "evcc_intg/capabilities":
          return fx ? Promise.resolve(fx.capabilities) : Promise.reject(new Error("mock: WebSocket data API not available"));
        case "evcc_intg/forecast": {
          const f = fx?.forecast[msg.kind];
          // The feed-in tariff is a price in every setup, never CO2.
          return f ? Promise.resolve(msg.kind === "feedin" ? rebase(f) : asCo2(rebase(f))) : Promise.reject(new Error(`mock: no forecast fixture for kind ${msg.kind}`));
        }
        case "evcc_intg/sessions": {
          if (!fx) return Promise.reject(new Error("mock: no sessions"));
          let list = fx.sessions.sessions;
          if (msg.year != null)  list = list.filter(s => new Date(s.created).getFullYear() === msg.year);
          if (msg.month != null) list = list.filter(s => new Date(s.created).getMonth() + 1 === msg.month);
          return Promise.resolve({ sessions: list });
        }
        case "evcc_intg/plan_preview": {
          if (!fx) return Promise.reject(new Error("mock: no plan preview"));
          // Like evcc's static preview: the charging window ends at the requested
          // target time and takes the fixture's duration; its slots are cut from
          // the (re-based) grid forecast, so the card's chart spans from now to
          // the target with the plan highlighted at the end.
          const target  = new Date(msg.timestamp);
          const durMs   = (fx.plan_preview.duration ?? 3600) * 1000;
          const startMs = target.getTime() - durMs;
          const plan = rebase(fx.forecast.grid).rates
            .filter(r => new Date(r.end).getTime() > startMs && new Date(r.start).getTime() < target.getTime())
            .map(r => ({
              start: new Date(Math.max(new Date(r.start).getTime(), startMs)).toISOString(),
              end:   new Date(Math.min(new Date(r.end).getTime(), target.getTime())).toISOString(),
              value: r.value,
            }));
          return Promise.resolve(asCo2({ ...fx.plan_preview, planTime: target.toISOString(), plan }));
        }
        // HA recorder, the source the stats mode falls back to when ha-evcc is
        // too old for evcc_intg/sessions. One bucket per day or month carrying
        // the cumulative meter reading; the card reconstructs deltas from it.
        // Generated over the requested window rather than stored as a fixture,
        // because the card asks for a window that ends "now" - and generated
        // from the bucket index, so two runs produce the same chart.
        // HA recorder history of a sensor, the source of the battery chart.
        // Generated over the requested window from the time of day, so two runs
        // draw the same curve: the battery fills up around noon and runs down
        // over the night. Compressed format as HA answers with minimal_response.
        case "history/history_during_period": {
          const out = {};
          const from = Math.ceil(new Date(msg.start_time).getTime() / 900000) * 900000;
          const to   = new Date(msg.end_time ?? Date.now()).getTime();
          for (const id of msg.entity_ids ?? []) {
            const pts = [];
            for (let t = from; t <= to; t += 900000) pts.push({ s: String(mockSoc(t)), lu: t / 1000 });
            out[id] = pts;
          }
          return Promise.resolve(out);
        }

        // evcc's optimizer, passed through as evcc publishes it (shape as on a
        // real instance): a vehicle ahead of the home battery in the result, SoC
        // in Wh, a short first slot up to the next quarter hour, then 15 min
        // slots over 48 h; plus the highest/lowest evcc derives from it.
        case "evcc_intg/optimizer": {
          if (!fx || !optimizer) return Promise.reject(new Error("mock: no optimizer"));
          const now = Date.now();
          const ts = [now];
          for (let t = Math.ceil((now + 1) / 900000) * 900000; t < now + 48 * 3600000; t += 900000) ts.push(t);
          const capWh = 10000;
          const home = ts.map(t => mockSoc(t) / 100 * capWh);
          const pick = (cmp) => ts.reduce((best, t, j) => cmp(home[j], home[best]) ? j : best, 1);
          const hi = pick((a, b) => a > b), lo = pick((a, b) => a < b);
          const point = (j, edge) => ({ soc: home[j] / capWh * 100, time: new Date(ts[j]).toISOString(), limit: edge });
          return Promise.resolve({
            evopt: {
              updated: new Date(now).toISOString(),
              res: { status: "Optimal", batteries: [
                { state_of_charge: ts.map(() => 41400), charging_power: ts.map(() => 0), discharging_power: ts.map(() => 0) },
                { state_of_charge: home, charging_power: ts.map(() => 0), discharging_power: ts.map(() => 0) },
              ] },
              details: {
                timestamp: ts.map(t => new Date(t).toISOString()),
                batteryDetails: [
                  { type: "vehicle", title: "openWB (EX30)", name: "db:18", capacity: 69 },
                  { type: "battery", title: "Speicher", name: "db:5", capacity: capWh / 1000 },
                ],
              },
            },
            batteryForecast: { highest: point(hi, home[hi] >= capWh), lowest: point(lo, home[lo] <= capWh * 0.05) },
          });
        }

        case "recorder/statistics_during_period": {
          const monthly = msg.period !== "day";
          const now = new Date();
          const cursor = new Date(msg.start_time);
          if (monthly) cursor.setDate(1);
          cursor.setHours(0, 0, 0, 0);
          const starts = [];
          while (cursor <= now && starts.length < 400) {
            starts.push(new Date(cursor));
            if (monthly) cursor.setMonth(cursor.getMonth() + 1);
            else cursor.setDate(cursor.getDate() + 1);
          }
          const out = {};
          for (const id of msg.statistic_ids ?? []) {
            // The solar template sensor tracks a share of the same energy, so it
            // rises more slowly and stays below the total.
            const solar = id.includes("solar");
            const step  = monthly ? 90 : 8;
            let sum = solar ? 400 : 650;   // meter reading before the window opens
            out[id] = starts.map((start, i) => {
              sum += (step + (i % 4) * (monthly ? 15 : 2)) * (solar ? 0.6 : 1);
              const next = starts[i + 1] ?? now;
              return { start: start.toISOString(), end: next.toISOString(), sum: Math.round(sum * 10) / 10 };
            });
          }
          return Promise.resolve(out);
        }

        // Enabling an entity: HA answers with the entry and, for an integration
        // that can unload, the delay after which it reloads it on its own. The
        // entity only gets a state after that reload, which a test plays by
        // setting the state itself.
        case "config/entity_registry/update": {
          if (!admin) return Promise.reject(new Error("Unauthorized"));
          const e = registry.find(r => r.entity_id === msg.entity_id);
          if (!e) return Promise.reject(new Error(`Entity not found: ${msg.entity_id}`));
          if ("disabled_by" in msg) e.disabled_by = msg.disabled_by;
          return Promise.resolve({ entity_entry: e, reload_delay: 30 });
        }

        // The media library: an item resolves to a signed address, here to a
        // file under test/fixtures named like the item; anything else is gone.
        case "media_source/resolve_media": {
          const m = /^media-source:\/\/media_source\/local\/([\w.-]+)$/.exec(msg.media_content_id || "");
          return m && m[1] !== "gone.png"
            ? Promise.resolve({ url: `/test/fixtures/${m[1]}?authSig=mock`, mime_type: "image/png" })
            : Promise.reject(new Error("mock: unknown media item"));
        }

        default:
          return Promise.reject(new Error(`mock: unknown WS command ${msg.type}`));
      }
    },

    // Records the call and mirrors simple writes into the state table, then
    // announces an update so the harness can push a fresh hass object to the
    // card, the way HA does after a service call.
    callService(domain, service, data = {}) {
      hass.serviceCalls.push({ domain, service, data });
      const id = data.entity_id;
      const s  = id && hass.states[id];
      if (s) {
        let next = null;
        if (domain === "number" && service === "set_value")    next = String(data.value);
        if (domain === "select" && service === "select_option") next = String(data.option);
        if (domain === "switch" && service === "turn_on")       next = "on";
        if (domain === "switch" && service === "turn_off")      next = "off";
        if (next != null) {
          hass.states = { ...hass.states, [id]: { ...s, state: next, last_updated: new Date().toISOString() } };
          setTimeout(() => window.dispatchEvent(new CustomEvent("mock-hass-updated")), 30);
        }
      }
      return Promise.resolve();
    },
  };
  return hass;
}
