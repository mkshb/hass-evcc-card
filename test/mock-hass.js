// Minimal stand-in for the Home Assistant `hass` object, fed from JSON fixtures
// captured on a real instance (see test/README.md). Only the surface the card
// actually touches is implemented: states, language, localize, callWS, callService.
//
// WebSocket data API (ha-evcc evcc_intg/*): served from test/fixtures/ws/ when
// `ws` is true (default). Rate timestamps in the forecast and plan-preview
// fixtures are shifted so the series starts at the current hour; otherwise a
// fixture captured yesterday would render as "no data" today.
export async function createMockHass({ language = "de", ws = true } = {}) {
  const base = new URL("./fixtures/", import.meta.url);
  const json = (p) => fetch(new URL(p, base)).then(r => r.ok ? r.json() : Promise.reject(new Error(`fixture ${p}: ${r.status}`)));

  const [states, registry] = await Promise.all([json("states.json"), json("entity_registry.json")]);
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
          return f ? Promise.resolve(rebase(f)) : Promise.reject(new Error(`mock: no forecast fixture for kind ${msg.kind}`));
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
          return Promise.resolve({ ...fx.plan_preview, planTime: target.toISOString(), plan });
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
