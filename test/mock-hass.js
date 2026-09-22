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
//   vehicleDevice: false  leave out the vehicle integration's device (test/fixtures/vehicle_device.json),
//            so the vehicle mode runs on ha-evcc data alone
//   wsName:  "…"  put this string into every name the WS data API reports (session
//            loadpoint/vehicle, currency) - used by the escaping tests
export async function createMockHass({ language = "de", ws = true, set = {}, attrs = {}, disable = [], rename = null, tariff = "price", second = null, wsName = null, vehicleDevice = true } = {}) {
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
  for (const [id, state] of Object.entries(set)) {
    if (states[id]) states[id] = { ...states[id], state: String(state) };
  }
  for (const [id, over] of Object.entries(attrs)) {
    if (states[id]) states[id] = { ...states[id], attributes: { ...states[id].attributes, ...over } };
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
    capabilities: await json("ws/capabilities.json"),
    sessions:     await json("ws/sessions.json"),
    forecast: {
      grid:    await json("ws/forecast_grid.json"),
      solar:   await json("ws/forecast_solar.json"),
      planner: await json("ws/forecast_planner.json"),
    },
    plan_preview: await json("ws/plan_preview.json"),
  } : null;

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
          return f ? Promise.resolve(asCo2(rebase(f))) : Promise.reject(new Error(`mock: no forecast fixture for kind ${msg.kind}`));
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
