#!/usr/bin/env python3
"""End-to-end tests: the card inside the development Home Assistant, fed by the evcc demo.

Usage:  python3 test/e2e.py [--headed] [--only NAME]
Logs into HA-Dev with a browser, writes its own dashboard (one view per card mode,
every card with `prefix: evcc_demo_`), renders each mode against the real ha-evcc
entities and drives a mode change through the whole stack: card, HA service,
ha-evcc, evcc API, and back. Exit code 1 on failure, 2 when the setup is missing.

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


def demo_loadpoints():
    """[(1-based api index, title, slug)] of the demo loadpoints. ha-evcc slugifies the title."""
    slug = lambda s: "".join(c if c.isalnum() else "_" for c in s.lower()).strip("_")
    return [(i + 1, lp["title"], slug(lp["title"])) for i, lp in enumerate(evcc_state()["loadpoints"])]


# Known starting point: what cmd/demo.yaml ships with. The garage is the one the
# round trip flips, so it starts off.
DEMO_MODES = {"Carport": "pv", "Garage": "off", "Heat pump": "pv"}


def reset_demo():
    for idx, title, _ in demo_loadpoints():
        mode = DEMO_MODES.get(title)
        if mode:
            evcc(f"loadpoints/{idx}/mode/{mode}", "POST")


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
    return {"views": [
        {"title": mode, "path": mode, "cards": [{"type": "custom:evcc-card", "mode": mode, "prefix": PREFIX}]}
        for mode in MODES
    ]}


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


GROUPS = {"smoke": smoke, "roundtrip": roundtrip}


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
