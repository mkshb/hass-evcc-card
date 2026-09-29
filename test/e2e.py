#!/usr/bin/env python3
"""End-to-end tests: the card inside the development Home Assistant, fed by the evcc demo.

Usage:  python3 test/e2e.py [--headed] [--only NAME]
Logs into HA-Dev with a browser, writes its own dashboard (one view per card mode,
every card with `prefix: evcc_demo_`), renders each mode against the real ha-evcc
entities and drives changes through the whole stack: card, HA service,
ha-evcc, evcc API, and back (mode, solar share, vehicle at a loadpoint, charge
plan). The vehicle mode and its editor are checked against the demo vehicles.
Exit code 1 on failure, 2 when the setup is missing.

This is not the mock suite (test/run.py). It needs the running stack and is run
by hand before a release; nothing here is deterministic enough for CI. Every
card is pinned to the demo prefix, so the production entry in HA-Dev is never
touched.

Setup:
  - an admin user in HA-Dev for the test (E2E_HA_USER / E2E_HA_PASSWORD; the
    dashboard save is an admin call). Either exported, or in test/.e2e.env
    (KEY=VALUE per line, gitignored)
  - E2E_HA_URL   (default http://localhost:8123, the sidecar shares the pod)
  - E2E_EVCC_URL (default http://evcc.evcc-demo.svc.cluster.local:7070)
  - E2E_PREFIX   (default evcc_demo_)
"""
import argparse, json, os, sys, time, urllib.error, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import T, launch, ROOT, MODES   # noqa: E402  (the mock suite's harness and report writer)

OUT       = ROOT / "test" / "out" / "e2e"
DASHBOARD = "evcc-demo-e2e"          # url_path; HA wants a hyphen in it
TITLE     = "EVCC Demo E2E"


def load_env():
    f = ROOT / "test" / ".e2e.env"
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


load_env()
HA_URL   = os.environ.get("E2E_HA_URL", "http://localhost:8123").rstrip("/")
EVCC_URL = os.environ.get("E2E_EVCC_URL", "http://evcc.evcc-demo.svc.cluster.local:7070").rstrip("/")
PREFIX   = os.environ.get("E2E_PREFIX", "evcc_demo_")
USER     = os.environ.get("E2E_HA_USER")
PASSWORD = os.environ.get("E2E_HA_PASSWORD")


# --- evcc demo ------------------------------------------------------------------

def evcc(path, method="GET"):
    req = urllib.request.Request(f"{EVCC_URL}/api/{path}", method=method)
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode())


def evcc_state():
    st = evcc("state")
    return st.get("result", st)


def slugify(s):
    """ha-evcc's entity slug of an evcc title: "blue e-Golf" -> "blue_e_golf"."""
    return "_".join(filter(None, "".join(c if c.isalnum() else " " for c in s.lower()).split()))


def demo_loadpoints():
    """[(1-based api index, title, slug)] of the demo loadpoints. ha-evcc slugifies the title."""
    return [(i + 1, lp["title"], slugify(lp["title"])) for i, lp in enumerate(evcc_state()["loadpoints"])]


def demo_vehicles():
    """{evcc name: (title, slug)} of the demo vehicles; ha-evcc builds the vehicle entities from the slug."""
    return {name: (v["title"], slugify(v["title"])) for name, v in (evcc_state().get("vehicles") or {}).items()}


# Known starting point: what cmd/demo.yaml ships with ("pv" there, which evcc
# 0.316 normalizes to "smart"). The garage is the one the round trip flips, so
# it starts off.
DEMO_MODES = {"Carport": "smart", "Garage": "off", "Heat pump": "smart"}
# and the vehicles it plugs in
DEMO_VEHICLES = {"Carport": "vehicle_1", "Garage": "vehicle_2"}


def reset_demo():
    for idx, title, _ in demo_loadpoints():
        mode = DEMO_MODES.get(title)
        if mode:
            evcc(f"loadpoints/{idx}/mode/{mode}", "POST")
    # evcc's default solar share: the surplus has to cover the minimum power
    for i, lp in enumerate(evcc_state()["loadpoints"], 1):
        if lp.get("solarShare") not in (None, 1):
            evcc(f"loadpoints/{i}/solarshare/1", "POST")
    st = evcc_state()
    for idx, title, _ in demo_loadpoints():
        name = DEMO_VEHICLES.get(title)
        if name and st["loadpoints"][idx - 1].get("vehicleName") != name:
            evcc(f"loadpoints/{idx}/vehicle/{name}", "POST")
    # no charge plans left over from a run that broke off
    for name, v in (st.get("vehicles") or {}).items():
        if v.get("plan"):
            evcc(f"vehicles/{name}/plan/soc", "DELETE")


def wait_for(pred, timeout=20, step=0.5):
    """Poll `pred` until it returns something truthy; that value, or None on timeout."""
    end = time.time() + timeout
    while time.time() < end:
        v = pred()
        if v:
            return v
        time.sleep(step)
    return None


# --- Home Assistant in the browser ----------------------------------------------

def login(page):
    page.goto(f"{HA_URL}/", wait_until="networkidle", timeout=60000)
    page.wait_for_selector("input[name=username]", timeout=30000)
    page.fill("input[name=username]", USER)
    page.fill("input[name=password]", PASSWORD)
    page.keyboard.press("Enter")
    page.wait_for_function("() => !!document.querySelector('home-assistant')?.hass?.states", timeout=60000)


def ws(page, msg):
    """A WebSocket command through the frontend's own authenticated connection."""
    return page.evaluate("(m) => document.querySelector('home-assistant').hass.callWS(m)", msg)


def ha_state(page, entity_id):
    return page.evaluate("(id) => document.querySelector('home-assistant').hass.states[id]?.state ?? null", entity_id)


def dashboard_config():
    """One view per mode. The vehicle mode shows one vehicle per card, so its view
    carries a card per demo vehicle instead of one card for all of them."""
    slugs = sorted(slug for _, slug in demo_vehicles().values())
    def cards(mode):
        if mode == "vehicle" and slugs:
            return [{"type": "custom:evcc-card", "mode": "vehicle", "prefix": PREFIX, "vehicle": slug} for slug in slugs]
        return [{"type": "custom:evcc-card", "mode": mode, "prefix": PREFIX}]
    return {"views": [{"title": mode, "path": mode, "cards": cards(mode)} for mode in MODES]}


def ensure_dashboard(page):
    """The test's own dashboard, rewritten on every run so its content is known."""
    existing = ws(page, {"type": "lovelace/dashboards/list"})
    if not any(d.get("url_path") == DASHBOARD for d in existing):
        ws(page, {"type": "lovelace/dashboards/create", "url_path": DASHBOARD, "title": TITLE,
                  "mode": "storage", "icon": "mdi:test-tube", "show_in_sidebar": True, "require_admin": False})
    ws(page, {"type": "lovelace/config/save", "url_path": DASHBOARD, "config": dashboard_config()})


def open_view(page, mode):
    ERRORS.clear()
    page.goto(f"{HA_URL}/{DASHBOARD}/{mode}", wait_until="networkidle", timeout=60000)
    page.wait_for_selector("evcc-card ha-card", timeout=30000)
    # the loading placeholder is an ha-card too; wait for the real render
    wait_for(lambda: not page.locator("evcc-card .loading").count(), timeout=20)
    page.wait_for_timeout(1500)   # forecast, sessions and plan preview arrive over the WebSocket


def card_shadow_text(page):
    return page.locator("evcc-card").first.evaluate("el => el.shadowRoot?.textContent || ''")


ERRORS = []   # page errors and card-related console errors, cleared by every check


def watch_errors(page):
    """Registered once per page: page errors and the console errors that concern the
    card. The HA frontend logs unrelated noise (blocked websockets on navigation,
    integration warnings), which is left out."""
    # Other custom cards on the instance throw too (a double customElements.define,
    # for one); only what names the card counts.
    page.on("pageerror", lambda e: ERRORS.append(f"pageerror: {e}") if "evcc" in str(e).lower() else None)
    page.on("console", lambda m: ERRORS.append(f"console.{m.type}: {m.text}")
            if m.type == "error" and "evcc" in m.text.lower() else None)


# --- groups ------------------------------------------------------------------------

def smoke(page, t):
    """Every mode renders on the real dashboard, no card errors, demo data visible."""
    t.group("e2e smoke - every mode on the demo dashboard")
    # The card names a loadpoint by its slug in most views and by the ha-evcc
    # title (device name) in the priority view, so either counts.
    lps = demo_loadpoints()
    named = lambda text: [slug for _, title, slug in lps if slug in text.lower() or title.lower() in text.lower()]
    for mode in MODES:
        try:
            open_view(page, mode)
        except Exception as e:      # noqa: BLE001  (a timeout is a failed check, not a crash)
            t.fail(f"{mode}: renders", f"{type(e).__name__}: {str(e)[:160]}")
            continue
        text = card_shadow_text(page)
        page.screenshot(path=str(OUT / f"{mode}.png"), full_page=True)
        detail = f"{len(text)} chars"
        ok = len(text) > 30 and not ERRORS
        if mode in ("loadpoint", "compact"):
            rows  = page.locator("evcc-card .loadpoint").count()
            names = named(text)
            ok = ok and rows == len(lps) and len(names) == len(lps)
            detail += f", rows={rows}, named={names}"
        elif mode in ("plan", "priority"):
            names = named(text)
            ok = ok and len(names) >= 1
            detail += f", named={names}"
        if mode == "debug":
            ok = ok and PREFIX in text
            detail += f", prefix shown={PREFIX in text}"
        t.check(ok, f"{mode}: renders with demo data, no card errors", detail + ("; " + "; ".join(ERRORS)[:200] if ERRORS else ""))


def roundtrip(page, t):
    """A mode change travels card -> HA service -> ha-evcc -> evcc, and evcc -> ha-evcc -> HA -> card."""
    t.group("e2e roundtrip - mode change through the whole stack")
    garage = next(((i, s) for i, title, s in demo_loadpoints() if title == "Garage"), None)
    if not garage:
        t.fail("the demo has a Garage loadpoint", str(demo_loadpoints()))
        return
    idx, slug = garage
    entity = f"select.{PREFIX}{slug}_mode"
    reset_demo()
    open_view(page, "loadpoint")
    btn = lambda value: page.locator(f'evcc-card button.mode-btn[data-entity="{entity}"][data-value="{value}"]')
    # document.querySelector stops at HA's shadow roots; the locator pierces them
    active = lambda: page.locator("evcc-card").first.evaluate(
        "(el, e) => { const b = el.shadowRoot?.querySelector(`button.mode-btn.active[data-entity=\"${e}\"]`); return b ? b.dataset.value : null; }", entity)

    t.check(btn("now").count() == 1, "the Garage mode buttons are rendered", f"{btn('now').count()} button(s) for {entity}")
    start = wait_for(lambda: active() == "off" and "off", timeout=30)
    t.check(start == "off", "starting point: Garage is off in the card", f"active={active()} ha={ha_state(page, entity)}")

    btn("now").click()
    at_evcc = wait_for(lambda: evcc_state()["loadpoints"][idx - 1]["mode"] == "now" and "now", timeout=20)
    t.check(at_evcc == "now", "click on 'now' arrives at evcc (card -> HA -> ha-evcc -> evcc)",
            f"evcc mode={evcc_state()['loadpoints'][idx - 1]['mode']}")
    in_card = wait_for(lambda: active() == "now" and "now", timeout=40)
    t.check(in_card == "now", "and comes back into the card (evcc -> ha-evcc -> HA -> card)",
            f"active={active()} ha={ha_state(page, entity)}")

    evcc(f"loadpoints/{idx}/mode/off", "POST")
    followed = wait_for(lambda: active() == "off" and "off", timeout=40)
    t.check(followed == "off", "a change made in evcc itself reaches the card", f"active={active()} ha={ha_state(page, entity)}")
    t.check(not ERRORS, "no card errors during the round trip", "; ".join(ERRORS)[:200])
    reset_demo()


def solar_share(page, t):
    """The solar share slider (evcc 0.316, ha-evcc 2026.9.5) writes through to evcc and follows evcc back."""
    t.group("e2e solar share - slider through the whole stack")
    garage = next(((i, s) for i, title, s in demo_loadpoints() if title == "Garage"), None)
    if not garage:
        t.fail("the demo has a Garage loadpoint", str(demo_loadpoints()))
        return
    idx, slug = garage
    entity = f"number.{PREFIX}{slug}_solar_share"
    share  = lambda: evcc_state()["loadpoints"][idx - 1].get("solarShare")
    if share() is None:
        t.fail("evcc reports a solar share (0.316+)", f"evcc {evcc_state().get('version')}")
        return
    reset_demo()
    open_view(page, "loadpoint")
    card  = page.locator("evcc-card").first
    input = page.locator(f'evcc-card input[type="range"][data-entity="{entity}"]')
    label = lambda: card.evaluate(
        "(el, e) => el.shadowRoot?.querySelector(`input[data-entity=\"${e}\"]`)?.nextElementSibling?.textContent.trim() ?? null", entity)

    page.locator(f'evcc-card [data-lp-current-toggle="{slug}"]').click()
    t.check(input.count() == 1, "the Garage has the solar share slider", f"{input.count()} slider(s) for {entity}")
    start = wait_for(lambda: label() == "100 %" and "100 %", timeout=30)
    t.check(start == "100 %", "starting point: 100 % in the card", f"label={label()} evcc={share()}")

    input.focus(); page.keyboard.press("Home")
    at_evcc = wait_for(lambda: share() == 0 and "0", timeout=20)
    t.check(at_evcc == "0", "Home on the slider arrives at evcc as 0 (card -> HA -> ha-evcc -> evcc)", f"evcc solarShare={share()}")

    evcc(f"loadpoints/{idx}/solarshare/0.5", "POST")
    followed = wait_for(lambda: label() == "50 %" and "50 %", timeout=40)
    t.check(followed == "50 %", "0.5 set in evcc itself shows as 50 % in the card", f"label={label()} ha={ha_state(page, entity)}")
    t.check(not ERRORS, "no card errors", "; ".join(ERRORS)[:200])
    reset_demo()


# --- vehicle mode ----------------------------------------------------------------------

DURATION = {"d": 86400, "h": 3600, "min": 60, "s": 1}


def vehicle_blocks(page):
    """What the vehicle view shows per vehicle, read from the shadow root of every
    card in it - one card per vehicle."""
    return page.locator("evcc-card").evaluate_all("""els => Object.fromEntries(els.flatMap(el => [...el.shadowRoot.querySelectorAll('.vehicle-block')]).map(b => [b.dataset.vehicle, {
        title:  b.querySelector('.lp-name')?.textContent.trim() ?? null,
        lp:     b.querySelector('.vehicle-lp')?.textContent.trim() ?? null,
        badge:  b.querySelector('.lp-badge')?.textContent.trim() ?? null,
        warn:   b.querySelector('.lp-disabled-warn')?.getAttribute('title') ?? null,
        hint:   b.querySelector('.vehicle-hint')?.textContent.trim() ?? null,
        device: !!b.querySelector('[data-vehicle-details]'),
        values: [...b.querySelectorAll('.soc-label-row [data-more-info]')].map(e => [e.dataset.moreInfo, e.textContent.trim()]),
        totals: Object.fromEntries([...b.querySelectorAll('.vehicle-totals .session-item')].map(e => [e.dataset.moreInfo, e.querySelector('.si-value').textContent.trim()])),
        plan:   b.querySelector('[data-vehicle-fold="plan"] .vehicle-fold-summary')?.textContent.trim() ?? null,
      }]))""")


def vehicle_view(page, t):
    """The vehicle mode against the real ha-evcc entities of the demo: one card per
    evcc vehicle, each with the title of its ha-evcc device, the loadpoint it is
    plugged into, values and session totals as HA reports them, and the hint for the
    configvehicle sensors, which the demo entry (no evcc password) has disabled."""
    t.group("e2e vehicle - the demo vehicles in the vehicle mode")
    reset_demo()
    vehicles = demo_vehicles()
    lps = {title: (idx, slug) for idx, title, slug in demo_loadpoints()}
    st = evcc_state()
    open_view(page, "vehicle")
    blocks = vehicle_blocks(page)
    want = sorted(slug for _, slug in vehicles.values())
    t.check(sorted(blocks) == want, "one card per evcc vehicle, each showing its own", f"{sorted(blocks)} vs {want}")
    titles = {slug: blocks.get(slug, {}).get("title") for _, slug in vehicles.values()}
    t.check(all(titles[slug] == title for title, slug in vehicles.values()),
            "each block carries the evcc title, read off the ha-evcc vehicle device", json.dumps(titles, ensure_ascii=False))

    for lp_title, name in DEMO_VEHICLES.items():
        idx, lp_slug = lps[lp_title]
        lp = st["loadpoints"][idx - 1]
        title, slug = vehicles[name]
        b = blocks.get(slug, {})
        badge = "Lädt" if lp.get("charging") else "Verbunden"
        soc_id = f"sensor.{PREFIX}{lp_slug}_vehicle_soc"
        soc = ha_state(page, soc_id)
        soc_txt = f"{round(float(soc))} %" if soc not in (None, "unknown", "unavailable") else None
        got_soc = next((txt for eid, txt in b.get("values", []) if eid == soc_id), None)
        t.check(b.get("lp") == lp_title and b.get("badge") == badge and got_soc == soc_txt,
                f"{title}: plugged in at {lp_title}, badge and charge level from the loadpoint",
                f"lp={b.get('lp')} badge={b.get('badge')} soc={got_soc} (HA {soc_txt})")
        t.check(b.get("plan") is not None, f"{title}: the folded charge plan line of {lp_title}", str(b.get("plan")))
    plugged = {vehicles[name][1] for name in DEMO_VEHICLES.values()}
    parked = [slug for _, slug in vehicles.values() if slug not in plugged]
    t.check(all(blocks.get(slug, {}).get("plan") is None for slug in parked),
            "a vehicle at no loadpoint has no charge plan line", json.dumps({slug: blocks.get(slug, {}).get("plan") for slug in parked}))

    # The plan set in the vehicle card reaches evcc on this vehicle and is deleted
    # again, the same path as in the plan mode.
    from datetime import datetime, timedelta, timezone
    from zoneinfo import ZoneInfo
    name = DEMO_VEHICLES["Garage"]
    title, slug = vehicles[name]
    plan = lambda: (evcc_state().get("vehicles") or {}).get(name, {}).get("plan")
    page.locator(f'evcc-card .vehicle-block[data-vehicle="{slug}"] [data-vehicle-fold="plan"]').click()
    page.wait_for_timeout(500)
    block = page.locator(f'evcc-card .vehicle-block[data-vehicle="{slug}"] .plan-block[data-lp]')
    garage_slug = next(s for _, t_, s in demo_loadpoints() if t_ == "Garage")
    t.check(block.count() == 1 and block.get_attribute("data-lp") == garage_slug and block.locator("select.plan-vehicle-select").count() == 0,
            f"{title}: unfolded, the plan block of the Garage without a vehicle select", "")
    local = (datetime.now(ZoneInfo("Europe/Berlin")) + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
    block.locator("button.plan-soc-val").click()
    page.locator("evcc-card .slider-edit-input").fill("80")
    page.locator("evcc-card [data-edit-ok]").click()
    block.locator("input.plan-time-input").fill(local.strftime("%Y-%m-%dT%H:%M"))
    page.wait_for_timeout(300)
    block.locator("button.plan-btn.save").click()
    got = wait_for(plan, timeout=20)
    want_time = local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    t.check(got and got.get("soc") == 80 and got.get("time") == want_time,
            f"{title}: a plan set in the vehicle card arrives at evcc on this vehicle", f"evcc plan={got}, want {want_time}")
    delete = block.locator("button.plan-btn.delete")
    if wait_for(lambda: delete.count() == 1, timeout=40):
        delete.click()
        gone = wait_for(lambda: not plan() and "gone", timeout=20)
        t.check(gone == "gone", f"{title}: and the delete button removes it again", f"evcc plan={plan()}")
    else:
        t.fail(f"{title}: the card offers to delete the plan once HA reports it", "")
    reset_demo()
    open_view(page, "vehicle")

    # Session totals as HA reports them, in the unit it reports them in.
    checked = []
    for title, slug in vehicles.values():
        dur_id = f"sensor.{PREFIX}cstotal_{slug}_charging_sessions_vehicle_chargeduration"
        st_dur = page.evaluate("(id) => { const s = document.querySelector('home-assistant').hass.states[id]; return s ? [s.state, s.attributes.unit_of_measurement] : null; }", dur_id)
        if not st_dur or st_dur[0] in ("unknown", "unavailable"):
            continue
        want_h = f"{round(float(st_dur[0]) * DURATION.get(st_dur[1] or 's', 1) / 3600)} h"
        got = blocks.get(slug, {}).get("totals", {}).get(dur_id)
        checked.append(f"{slug}: {got} (HA {st_dur[0]} {st_dur[1]})")
        t.check(got == want_h, f"{title}: total charge duration in hours, whatever unit HA reports", checked[-1])
    if not checked:
        t.fail("the demo has session totals for at least one vehicle", "none with a value")

    # The configvehicle sensors: disabled in the registry means the new hint and,
    # for an administrator, the triangle.
    registry = {e["entity_id"]: e for e in ws(page, {"type": "config/entity_registry/list"})}
    for title, slug in vehicles.values():
        ids = [f"sensor.{PREFIX}{slug}_configvehicle_{k}" for k in ("soc", "range", "odometer", "limitsoc")]
        disabled = [i for i in ids if registry.get(i, {}).get("disabled_by")]
        b = blocks.get(slug, {})
        if b.get("device"):
            t.check(b.get("warn") is None, f"{title}: linked to a device of its own, no triangle", "")
        elif disabled:
            t.check(b.get("warn") and "Fahrzeugwerte ohne Ladepunkt" in b["warn"] and "deaktiviert" in (b.get("hint") or ""),
                    f"{title}: sensors disabled in HA-Dev, triangle and the hint that says so", f"warn={b.get('warn')} hint={(b.get('hint') or '')[:60]}")
        else:
            t.ok(f"{title}: configvehicle sensors enabled or missing, nothing to point at", f"warn={b.get('warn')}")

    warned = [slug for slug, b in blocks.items() if b.get("warn")]
    if warned:
        page.locator(f'evcc-card .vehicle-block[data-vehicle="{warned[0]}"] .lp-disabled-warn').click()
        page.wait_for_timeout(800)
        # The debug view opens in the card whose triangle was clicked, so the rows
        # are collected over every card of the view.
        rows = page.locator("evcc-card").evaluate_all("""els => els.flatMap(el =>
            [...el.shadowRoot.querySelectorAll('#debug-disabled .disabled-row')])
            .filter(r => r.querySelector('.disabled-what')).map(r => r.querySelector('.disabled-id').textContent)""")
        mine = [r for r in rows if f"{PREFIX}{warned[0]}_configvehicle_" in r]
        t.check(len(mine) >= 1 and page.locator("evcc-card .debug-back").count() == 1,
                "the triangle opens the debug view, the vehicle's sensors listed as needed", f"{mine}")
        page.locator("evcc-card .debug-back").click()
        page.wait_for_timeout(500)
        t.check(len(vehicle_blocks(page)) == len(vehicles), "and the way back leads to the vehicles", "")
    t.check(not ERRORS, "no card errors", "; ".join(ERRORS)[:200])


def vehicle_switch(page, t):
    """Which vehicle sits at a loadpoint travels both ways: the card's vehicle select
    in the plan view reaches evcc, and a vehicle evcc assigns moves its block in the
    vehicle view to that loadpoint."""
    t.group("e2e vehicle switch - a vehicle changes loadpoint")
    garage = next(((i, s) for i, title, s in demo_loadpoints() if title == "Garage"), None)
    vehicles = demo_vehicles()
    if not garage or not {"vehicle_2", "vehicle_3", "vehicle_4"} <= set(vehicles):
        t.fail("the demo has a Garage and vehicle_2..4", f"{garage} {sorted(vehicles)}")
        return
    idx, slug = garage
    at_garage = lambda: evcc_state()["loadpoints"][idx - 1].get("vehicleName")
    reset_demo()

    open_view(page, "plan")
    select = page.locator(f'evcc-card .plan-block[data-lp="{slug}"] select.plan-vehicle-select')
    t.check(select.count() == 1, "the Garage plan block has its vehicle select", f"{select.count()}")
    select.select_option("vehicle_4")
    got = wait_for(lambda: at_garage() == "vehicle_4" and "vehicle_4", timeout=20)
    t.check(got == "vehicle_4", "a vehicle picked in the card arrives at evcc (card -> HA -> ha-evcc -> evcc)", f"evcc={at_garage()}")

    evcc(f"loadpoints/{idx}/vehicle/vehicle_3", "POST")
    open_view(page, "vehicle")
    new, old = vehicles["vehicle_3"][1], vehicles["vehicle_2"][1]
    moved = wait_for(lambda: (b := vehicle_blocks(page)) and b.get(new, {}).get("lp") == "Garage" and b, timeout=40)
    t.check(bool(moved), f"a vehicle evcc assigns shows the Garage in its block ({vehicles['vehicle_3'][0]})",
            json.dumps({k: v.get("lp") for k, v in (moved or vehicle_blocks(page)).items()}, ensure_ascii=False))
    b = moved or vehicle_blocks(page)
    t.check(b.get(old, {}).get("lp") is None and b.get(old, {}).get("badge") == "Nicht verbunden",
            f"and {vehicles['vehicle_2'][0]}, no longer there, is not connected", json.dumps(b.get(old, {}), ensure_ascii=False)[:200])
    t.check(not ERRORS, "no card errors", "; ".join(ERRORS)[:200])
    reset_demo()


def charge_plan(page, t):
    """A charge plan set in the card lands in evcc through the evcc_intg service and is
    deleted the same way; the plan write path of ha-evcc is the fragile one."""
    t.group("e2e charge plan - set and delete through the whole stack")
    from datetime import datetime, timedelta, timezone
    from zoneinfo import ZoneInfo
    garage = next(((i, s) for i, title, s in demo_loadpoints() if title == "Garage"), None)
    if not garage:
        t.fail("the demo has a Garage loadpoint", str(demo_loadpoints()))
        return
    idx, slug = garage
    name = DEMO_VEHICLES["Garage"]
    plan = lambda: (evcc_state().get("vehicles") or {}).get(name, {}).get("plan")
    reset_demo()
    open_view(page, "plan")
    block = page.locator(f'evcc-card .plan-block[data-lp="{slug}"]')
    t.check(block.count() == 1 and not plan(), "starting point: the Garage plan block, no plan in evcc", f"plan={plan()}")

    local = (datetime.now(ZoneInfo("Europe/Berlin")) + timedelta(days=1)).replace(hour=7, minute=0, second=0, microsecond=0)
    block.locator("button.plan-soc-val").click()
    page.locator("evcc-card .slider-edit-input").fill("80")
    page.locator("evcc-card [data-edit-ok]").click()
    block.locator("input.plan-time-input").fill(local.strftime("%Y-%m-%dT%H:%M"))
    page.wait_for_timeout(300)
    block.locator("button.plan-btn.save").click()
    got = wait_for(plan, timeout=20)
    want_time = local.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    t.check(got and got.get("soc") == 80 and got.get("time") == want_time,
            "the plan arrives at evcc: 80 % tomorrow 07:00 (card -> evcc_intg.set_vehicle_plan -> evcc)", f"evcc plan={got}, want {want_time}")

    delete = block.locator("button.plan-btn.delete")
    shown = wait_for(lambda: delete.count() == 1, timeout=40)
    t.check(bool(shown), "the card offers to delete it once HA reports the plan", "")
    if shown:
        delete.click()
        gone = wait_for(lambda: not plan() and "gone", timeout=20)
        t.check(gone == "gone", "delete removes it in evcc (evcc_intg.del_vehicle_plan)", f"evcc plan={plan()}")
    t.check(not ERRORS, "no card errors", "; ".join(ERRORS)[:200])
    reset_demo()


def editor(page, t):
    """The visual editor of the vehicle mode with the real hass and HA's own elements.
    It is mounted straight into the HA page: the card edit dialog of the dashboard
    does not open in the headless browser. Checks the vehicle list, the evcc titles
    and HA's media selector for the vehicle pictures."""
    t.group("e2e editor - vehicle mode in the real frontend")
    vehicles = demo_vehicles()
    open_view(page, "vehicle")
    page.evaluate("""async (prefix) => {
        document.getElementById('e2e-editor')?.remove();
        const ed = document.createElement('evcc-card-editor'); ed.id = 'e2e-editor';
        window.__e2eCfg = [];
        ed.addEventListener('config-changed', e => window.__e2eCfg.push(JSON.parse(JSON.stringify(e.detail.config))));
        ed.setConfig({ type: 'custom:evcc-card', mode: 'vehicle', prefix });
        ed.hass = document.querySelector('home-assistant').hass;
        document.body.appendChild(ed);
        await customElements.whenDefined('ha-selector');
        await new Promise(r => setTimeout(r, 1500)); }""", PREFIX)
    ed = page.locator("#e2e-editor")
    form = page.evaluate(f"""() => {{ const f = {FORM};
        return f ? {{ selectors: f.shadowRoot ? f.shadowRoot.querySelectorAll('ha-selector').length : 0,
                     options: f.schema.find(s => s.name === 'vehicle')?.selector.select.options || [] }} : null; }}""")
    t.check(bool(form) and form["selectors"] > 0, "HA's own form draws the fields of the editor", json.dumps(form)[:200])
    options = (form or {}).get("options", [])
    slugs = [o["value"] for o in options if o["value"] != "__unset"]
    t.check(slugs == sorted(s for _, s in vehicles.values()), "the editor offers every demo vehicle to pick from", str(slugs))
    titles = [o["label"] for o in options]
    t.check(all(title in titles for title, _ in vehicles.values()), "named with their evcc titles", str(titles))
    t.check(ed.locator("select[data-vehicle-device]").count() == 0,
            "without a vehicle picked the settings of one stay away", "")

    first = slugs[0] if slugs else None
    if first:
        picked = form_pick(page, "vehicle", first)
        t.check(picked, "the vehicle field is one of HA's selectors inside the form", "")
        page.wait_for_timeout(1200)
        cfg = page.evaluate("window.__e2eCfg.at(-1) ?? null")
        t.check(cfg and cfg.get("vehicle") == first and cfg.get("prefix") == PREFIX,
                "the picked vehicle writes the whole config", json.dumps(cfg))
        t.check(ed.locator("select[data-vehicle-device]").count() == 1,
                "now the device of that vehicle can be picked", "")
        media = ed.locator("[data-vehicle-media] ha-selector ha-selector-media").count()
        t.check(media == 1, "HA's own media selector for the picture", f"{media} ha-selector-media")
        ed.locator("[data-vehicle-map]").click()
        page.wait_for_timeout(1200)
        pickers = ed.locator("[data-vehicle-role-pick] ha-selector ha-selector-entity").count()
        t.check(pickers == 14, "and HA's own entity picker for every role of the mapping", f"{pickers} ha-selector-entity")
        ids = page.evaluate("""() => { const ed = document.getElementById('e2e-editor');
            const p = ed.shadowRoot.querySelector('[data-vehicle-role-pick][data-role="soc"] ha-selector');
            return p ? p.selector.entity.include_entities : null; }""")
        t.check(isinstance(ids, list) and all(i.startswith(("sensor.", "number.")) for i in ids),
                "the picker of a role is handed only entities that fit it", json.dumps((ids or [])[:5]))
    # The loadpoint fields and the advanced section with the slider steps.
    picked = form_pick(page, "mode", "loadpoint")
    page.wait_for_timeout(1200)
    cfg = page.evaluate("window.__e2eCfg.at(-1) ?? null")
    t.check(picked and cfg and cfg.get("mode") == "loadpoint" and cfg.get("prefix") == PREFIX,
            "a mode switch through HA's form writes the whole config", json.dumps(cfg))
    adv = page.evaluate(f"""() => {{ const f = {FORM}; return f && f.shadowRoot ? f.shadowRoot.querySelectorAll('ha-form-expandable').length : -1; }}""")
    t.check(adv == 1, "the loadpoint mode has the folded advanced section", f"{adv} ha-form-expandable")
    page.evaluate("() => document.getElementById('e2e-editor')?.remove()")
    t.check(not ERRORS, "no card errors", "; ".join(ERRORS)[:200])


FORM = "document.getElementById('e2e-editor')?.shadowRoot.querySelector('ha-form')"


def form_pick(page, name, value):
    """A choice in a field of HA's form, made where the select element reports it:
    the selector of that field fires value-changed and the real form passes the
    whole data on. The menu of HA's select itself is left alone, it changes
    between frontend versions."""
    return page.evaluate(f"""([name, value]) => {{ const f = {FORM};
        const sel = [...(f?.shadowRoot?.querySelectorAll('ha-selector') || [])].find(e => (e.schema?.name ?? e.name) === name);
        if (!sel) return false;
        sel.dispatchEvent(new CustomEvent('value-changed', {{ detail: {{ value }}, bubbles: true, composed: true }}));
        return true; }}""", [name, value])


GROUPS = {"smoke": smoke, "roundtrip": roundtrip, "solar_share": solar_share,
          "vehicle": vehicle_view, "vehicle_switch": vehicle_switch, "charge_plan": charge_plan, "editor": editor}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--headed", action="store_true")
    ap.add_argument("--only", action="append", choices=list(GROUPS), help="run only these groups (repeatable)")
    a = ap.parse_args()
    if not USER or not PASSWORD:
        print("E2E_HA_USER / E2E_HA_PASSWORD not set (env or test/.e2e.env); see the docstring.", file=sys.stderr)
        return 2
    try:
        st = evcc_state()
    except (urllib.error.URLError, OSError) as e:
        print(f"evcc demo not reachable at {EVCC_URL}: {e}", file=sys.stderr)
        return 2
    print(f"evcc {st.get('version')} '{st.get('siteTitle')}' at {EVCC_URL}, loadpoints: {[lp['title'] for lp in st['loadpoints']]}")
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    t = T("evcc-card e2e (HA-Dev + evcc demo)", frozen_time=None)
    with sync_playwright() as p:
        browser = launch(p, "chromium", a.headed)
        ctx = browser.new_context(viewport={"width": 520, "height": 1400}, locale="de-DE", timezone_id="Europe/Berlin")
        page = ctx.new_page()
        watch_errors(page)
        t.group("e2e setup")
        try:
            login(page)
            t.ok("logged into HA-Dev", f"{HA_URL} as {USER}")
            ensure_dashboard(page)
            t.ok("dashboard written", f"/{DASHBOARD}, {len(MODES)} views")
            reset_demo()
            t.ok("demo reset", ", ".join(f"{k}={v}" for k, v in DEMO_MODES.items()))
        except Exception as e:      # noqa: BLE001
            t.fail("setup", f"{type(e).__name__}: {str(e)[:300]}")
            page.screenshot(path=str(OUT / "setup-failure.png"))
        else:
            for name, fn in GROUPS.items():
                if a.only and name not in a.only:
                    continue
                fn(page, t)
        browser.close()
    report = t.write_reports(OUT, screenshots=sorted(str(s.relative_to(ROOT)) for s in OUT.glob("*.png")))
    print(f"\n{len(t.results) - len(t.failed)} passed, {len(t.failed)} failed  (report: {report})")
    return 1 if t.failed else 0


if __name__ == "__main__":
    sys.exit(main())
