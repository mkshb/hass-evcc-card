#!/usr/bin/env python3
"""Headless render + interaction tests for evcc-card against the mock hass.

Usage:  python3 test/run.py [--headed] [--only NAME] [--browser chromium|webkit]
Serves the repo root over HTTP, opens test/harness.html in the browser, renders
every card mode (light + dark, screenshots in test/out/) and runs interaction
scenarios that assert on the recorded service calls. Exit code 1 on failure.

Browsers: chromium (default; Android WebView and desktop Chrome/Edge) and webkit
(Playwright's WebKit build: the engine of Safari and of the WKWebView the iOS
companion app renders the frontend in). The WebKit run is functional only, its
screenshots go to test/out/webkit/ and are not compared with images/ (text
rendering differs between engines).
"""
import argparse, datetime, http.server, json, os, re, socketserver, sys, threading, time, urllib.parse
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "test" / "out"
MODES = ["loadpoint", "compact", "battery", "site", "flow", "grid", "stats", "plan", "repeatplan", "priority", "debug"]

# The browser clock is frozen at the capture time of the fixtures so every run
# renders the same pixels (hour labels, plan times, "current month"). Timezone
# and locale match the instance the fixtures came from.
# Browser: EVCC_CHROMIUM=<path> overrides, EVCC_CHROMIUM=bundled forces Playwright's own
# Chromium (`playwright install chromium`, what CI uses); otherwise the system Chromium
# (Debian) when present, else the bundled one.
_chromium = os.environ.get("EVCC_CHROMIUM") or ("/usr/bin/chromium" if os.path.exists("/usr/bin/chromium") else None)
BROWSER = {} if _chromium in (None, "bundled") else {"executable_path": _chromium}
BROWSERS = ("chromium", "webkit")


def launch(p, name="chromium", headed=False):
    """Launch the engine under test. The Chromium flags are Chromium-only (WebKit
    rejects unknown arguments); locale and timezone come from the context anyway."""
    if name == "webkit":
        return p.webkit.launch(headless=not headed)
    return p.chromium.launch(**BROWSER, headless=not headed, args=["--no-sandbox", "--lang=de-DE"])

# With an explicit offset: a naive time would be read in the host's timezone,
# i.e. 13:00 UTC on a CI runner instead of 13:00 Berlin.
FIXED_TIME = "2026-09-18T13:00:00+02:00"
TIMEZONE   = "Europe/Berlin"
LOCALE     = "de-DE"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory=str(ROOT), **kw)
    def log_message(self, *a): pass


def serve():
    srv = socketserver.TCPServer(("127.0.0.1", 0), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def card_version():
    m = re.search(r'EVCC_CARD_VERSION\s*=\s*"([^"]+)"', (ROOT / "dist" / "evcc-card.js").read_text(encoding="utf-8"))
    return m.group(1) if m else "?"


class T:
    """Collects check results and writes report.md / report.json / junit.xml."""
    def __init__(self, suite="evcc-card tests", browser="chromium"):
        self.suite, self.browser, self.results, self.started, self.section = suite, browser, [], time.time(), ""
    def group(self, title):        self.section = title; print(f"\n[{title}]")
    def ok(self, name, detail=""):   self._add(True, name, detail);  print(f"  PASS {name}" + (f"  ({detail})" if detail else ""))
    def fail(self, name, detail=""): self._add(False, name, detail); print(f"  FAIL {name}  {detail}")
    def check(self, cond, name, detail=""): (self.ok if cond else self.fail)(name, detail)
    def _add(self, ok, name, detail): self.results.append({"ok": ok, "section": self.section, "name": name, "detail": str(detail)[:500]})
    @property
    def failed(self): return [r for r in self.results if not r["ok"]]

    def write_reports(self, out, screenshots=()):
        out = Path(out); out.mkdir(parents=True, exist_ok=True)
        passed, failed = len(self.results) - len(self.failed), len(self.failed)
        meta = {"suite": self.suite, "browser": self.browser, "card_version": card_version(), "run_at": datetime.datetime.now().isoformat(timespec="seconds"),
                "duration_s": round(time.time() - self.started, 1), "fixed_browser_time": FIXED_TIME, "passed": passed, "failed": failed}
        (out / "report.json").write_text(json.dumps({**meta, "results": self.results, "screenshots": [str(s) for s in screenshots]}, indent=1, ensure_ascii=False))
        lines = [f"# {self.suite}", "",
                 f"**{'FAILED' if failed else 'PASSED'}**: {passed} passed, {failed} failed", "",
                 f"- Card version: {meta['card_version']}", f"- Browser: {self.browser}", f"- Run at: {meta['run_at']} ({meta['duration_s']} s)",
                 f"- Browser clock frozen at: {FIXED_TIME} {TIMEZONE}", ""]
        if failed:
            lines += ["## Failures", ""] + [f"- **{r['section']}** / {r['name']}" + (f": {r['detail']}" if r['detail'] else "") for r in self.failed] + [""]
        lines += ["## All checks", "", "| Result | Section | Check | Detail |", "|---|---|---|---|"]
        # (no backslashes inside f-string expressions: Debian's Python 3.11 rejects them)
        cell = lambda v: str(v).replace("|", "&#124;")
        lines += [f"| {'PASS' if r['ok'] else 'FAIL'} | {cell(r['section'])} | {cell(r['name'])} | {cell(r['detail'])} |" for r in self.results]
        if screenshots:
            lines += ["", "## Screenshots", ""] + [f"- {s}" for s in screenshots]
        (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
        cases = "".join(
            f'  <testcase classname="{xml_escape(r["section"] or self.suite)}" name="{xml_escape(r["name"])}">'
            + (f'<failure message="{xml_escape(r["detail"])}"/>' if not r["ok"] else "") + "</testcase>\n" for r in self.results)
        (out / "junit.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="{xml_escape(self.suite)}" tests="{len(self.results)}" failures="{failed}" time="{meta["duration_s"]}">\n{cases}</testsuite>\n', encoding="utf-8")
        return out / "report.md"


def new_page(browser, width=480, height=900):
    ctx = browser.new_context(viewport={"width": width, "height": height}, timezone_id=TIMEZONE, locale=LOCALE)
    page = ctx.new_page()
    page.clock.set_fixed_time(FIXED_TIME)
    return page


def open_card(page, port, config=None, mode=None, dark=False, width=400, lang="de", ws=True, set=None, disable=None, rename=None):
    q = {"w": width, "lang": lang}
    if not ws: q["ws"] = 0
    if set:     q["set"] = ",".join(f"{k}:{v}" for k, v in set.items())
    if disable: q["disable"] = ",".join(disable)
    if rename:  q["rename"] = f"{rename[0]}:{rename[1]}"
    if config is not None: q["config"] = json.dumps(config)
    else: q["mode"] = mode or "loadpoint"
    if dark: q["dark"] = 1
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.on("response", lambda r: errors.append(f"http {r.status}: {r.url}") if r.status >= 400 else None)
    page.route("**/favicon.ico", lambda r: r.fulfill(status=204))
    page.goto(f"http://127.0.0.1:{port}/test/harness.html?{urllib.parse.urlencode(q)}")
    page.wait_for_function("window.__ready && window.__ready()", timeout=10000)
    page.wait_for_timeout(900)   # debounced render + capability probe + first WS fetches
    return errors


def svc(page):
    return page.evaluate("window.__hass.serviceCalls")


def in_card(sel):
    return f"evcc-card {sel}"


def render_smoke(browser, port, t):
    t.group("render - all modes, light + dark")
    for mode in MODES:
        for dark in (False, True):
            page = new_page(browser, 480, 900)
            errors = open_card(page, port, mode=mode, dark=dark)
            has_card = page.locator(in_card("ha-card")).count() > 0
            name = f"render {mode}{' dark' if dark else ''}"
            shot = OUT / f"{mode}{'-dark' if dark else ''}.png"
            page.locator("#host").screenshot(path=str(shot))
            t.check(has_card and not errors, name, "; ".join(errors)[:300])
            if mode == "stats" and not dark:
                bars = page.locator(in_card(".evcc-chart-wrap svg rect")).count()
                t.check(bars > 0, "stats: bar chart rendered from sessions", f"{bars} bars")
                t.check(page.locator(in_card(".stats-chart-loading")).count() == 0, "stats: no loading placeholder left")
            page.close()

    # Entity/recorder fallback (no ha-evcc WebSocket API): must still render, no chart data
    page = new_page(browser, 480, 900)
    errors = open_card(page, port, mode="stats", ws=False)
    page.locator("#host").screenshot(path=str(OUT / "stats-fallback.png"))
    t.check(page.locator(in_card("ha-card")).count() > 0 and not errors, "render stats without WS API (fallback)", "; ".join(errors)[:300])
    page.close()


def interactions(browser, port, t):
    t.group("interaction - direct input panel")
    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    t.check(not errors, "loadpoint openwb renders without errors", "; ".join(errors)[:300])

    # --- number slider (limit_soc: 20..100 step 5, state 90) -------------------------
    val = page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val'))
    t.check(val.count() == 1, "limit_soc value is a tap target")
    val.click()
    panel = page.locator(in_card(".slider-edit"))
    t.check(panel.count() == 1, "panel opens on tap")
    field = panel.locator(".slider-edit-input")
    t.check(field.input_value() == "90", "field shows current value", field.input_value())
    panel.locator("[data-edit-inc]").click()
    t.check(field.input_value() == "95", "+ walks one step", field.input_value())
    panel.locator("[data-edit-inc]").click(); panel.locator("[data-edit-inc]").click()
    t.check(field.input_value() == "100", "+ clamps at max", field.input_value())
    field.fill("87"); panel.locator("[data-edit-ok]").click()
    calls = svc(page)
    t.check(calls and calls[-1]["domain"] == "number" and calls[-1]["data"]["value"] == 85,
            "typed 87 snaps to 85 and writes number.set_value", json.dumps(calls[-1:]))
    page.wait_for_timeout(600)
    t.check(page.locator(in_card(".slider-edit")).count() == 0, "panel closes after apply")
    t.check(page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).inner_text().strip().startswith("85"),
            "value reflects the new state after re-render")

    # --- comma input + cancel via Escape ----------------------------------------
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    field = page.locator(in_card(".slider-edit-input")); field.fill("92,4"); field.press("Enter")
    t.check(svc(page)[-1]["data"]["value"] == 90, "comma decimal parsed, snapped to grid", json.dumps(svc(page)[-1]))
    page.wait_for_timeout(400)
    n_before = len(svc(page))
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    page.locator(in_card(".slider-edit-input")).press("Escape")
    t.check(page.locator(in_card(".slider-edit")).count() == 0 and len(svc(page)) == n_before, "Escape discards without a write")

    # --- select-backed slider (min_current: options incl. 0.125…, state 6) ---------
    page.locator(in_card('input[data-entity="select.evcc_openwb_min_current"] + button.slider-val')).click()
    panel = page.locator(in_card(".slider-edit")); field = panel.locator(".slider-edit-input")
    t.check(field.input_value() == "6", "select slider shows option value", field.input_value())
    panel.locator("[data-edit-dec]").click()
    t.check(field.input_value() == "5", "− walks to previous option", field.input_value())
    for _ in range(7): panel.locator("[data-edit-dec]").click()   # 5,4,3,2,1,0.5,0.25,0.125
    t.check(field.input_value() == "0.125", "− walks down through fractional options to the first", field.input_value())
    panel.locator("[data-edit-dec]").click()
    t.check(field.input_value() == "0.125", "− clamps at first option", field.input_value())
    panel.locator("[data-edit-ok]").click()
    c = svc(page)[-1]
    t.check(c["domain"] == "select" and c["data"]["option"] == "0.125", "writes select.select_option with option string", json.dumps(c))
    page.wait_for_timeout(500)

    # --- battery boost (select options 0..100 step 5, state 100 → label 'Aus') --------
    boost = page.locator(in_card("button.boost-val"))
    t.check(boost.count() == 1 and boost.inner_text().strip() == "Aus", "boost shows 'Aus' at 100", boost.inner_text())
    boost.click(); panel = page.locator(in_card(".slider-edit"))
    panel.locator("[data-edit-dec]").click(); panel.locator("[data-edit-dec]").click()
    t.check(panel.locator(".slider-edit-input").input_value() == "90", "boost − steps by 5", panel.locator(".slider-edit-input").input_value())
    panel.locator("[data-edit-ok]").click()
    c = svc(page)[-1]
    t.check(c["domain"] == "select" and c["data"]["entity_id"].endswith("battery_boost_limit") and c["data"]["option"] == "90",
            "boost apply writes nearest option", json.dumps(c))
    page.wait_for_timeout(500)
    t.check(page.locator(in_card("button.boost-val")).inner_text().strip() == "90 %", "boost label shows 90 %", page.locator(in_card("button.boost-val")).inner_text())

    # --- plan target (local state, no service call) --------------------------------
    n_before = len(svc(page))
    plan_val = page.locator(in_card("button.plan-soc-val"))
    t.check(plan_val.count() == 1, "plan target is a tap target")
    plan_val.click(); panel = page.locator(in_card(".slider-edit"))
    panel.locator(".slider-edit-input").fill("77"); panel.locator("[data-edit-ok]").click()
    soc = page.evaluate("window.__card._planState['openwb']?.soc")
    t.check(soc == 75 and len(svc(page)) == n_before, "plan target snaps to 75, stored locally, no service call", f"soc={soc}")
    t.check(page.locator(in_card("button.plan-soc-val")).inner_text().strip() == "75 %", "plan label updated")

    # --- keyboard on the range writes ---------------------------------------------
    n_before = len(svc(page))
    rng = page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"]'))
    rng.focus(); rng.press("ArrowRight")
    t.check(len(svc(page)) == n_before + 1 and svc(page)[-1]["domain"] == "number", "arrow key on slider writes to HA", json.dumps(svc(page)[-1]))
    page.wait_for_timeout(500)

    # --- outside click closes the panel and the click still lands (gear toggle) ------
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    t.check(page.locator(in_card(".slider-edit")).count() == 1, "panel open before outside click")
    gear = page.locator(in_card("button.current-toggle-btn"))
    expanded_before = page.locator(in_card(".current-block-body")).get_attribute("hidden") is None
    gear.click(); page.wait_for_timeout(300)
    expanded_after = page.locator(in_card(".current-block-body")).get_attribute("hidden") is None
    t.check(page.locator(in_card(".slider-edit")).count() == 0, "outside click closes panel")
    t.check(expanded_before != expanded_after, "gear click still toggles the block", f"{expanded_before}->{expanded_after}")
    editing = page.evaluate("window.__card._sliderEditing")
    t.check(editing is False, "editing flag cleared after outside close", str(editing))
    page.close()

    # --- compact: tab switch closes the panel ------------------------------------------
    t.group("interaction - compact tab switch")
    page = new_page(browser, 480, 1200)
    open_card(page, port, config={"mode": "compact", "loadpoints": ["openwb"]})
    page.locator(in_card("button.compact-tab")).nth(1).click(); page.wait_for_timeout(200)
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    t.check(page.locator(in_card(".slider-edit")).count() == 1, "panel opens in settings tab")
    page.locator(in_card("button.compact-tab")).nth(0).click(); page.wait_for_timeout(300)
    t.check(page.locator(in_card(".slider-edit")).count() == 0, "tab switch closes panel")
    t.check(page.locator(in_card("button.compact-tab.active")).get_attribute("data-tab") == "0", "tab switch still happened")
    t.check(page.evaluate("window.__card._sliderEditing") is False, "editing flag cleared")
    page.close()

    # --- plan preview via WebSocket fixture ------------------------------------------------
    t.group("interaction - plan preview")
    page = new_page(browser, 480, 1200)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]})
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.wait_for_timeout(1500)   # 500 ms debounce + fetch + render
    calls = [c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"]
    # ha-evcc declares value as vol.Coerce(str), so the card sends it as a string.
    t.check(len(calls) >= 1 and calls[-1]["kind"] == "soc" and str(calls[-1]["value"]) == "80"
            and calls[-1]["loadpoint"] == 1 and "timestamp" in calls[-1],
            "plan target change requests plan_preview {loadpoint, kind, value, timestamp}", json.dumps(calls[-1:]))
    bars = page.locator(in_card(".plan-preview svg rect")).count()
    t.check(bars > 0 and page.locator(in_card(".plan-preview-value")).count() >= 2, "plan preview chart + duration/cost rendered", f"{bars} bars")
    page.locator("#host").screenshot(path=str(OUT / "plan-preview.png"))
    page.close()

    # --- hide_settings + slider_steps ---------------------------------------------------
    t.group("config - hide_settings / slider_steps")
    page = new_page(browser, 480, 1200)
    all_keys = ["limit_soc", "min_soc", "phases", "max_current", "min_current", "battery_boost", "priority", "smart_cost_limit", "smart_feed_in_priority_limit"]
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "hide_settings": all_keys})
    t.check(page.locator(in_card(".current-block")).count() == 0, "all hidden: charge settings block gone")
    t.check(page.locator(in_card(".sliders")).count() == 0, "all hidden: soc sliders gone")
    page.close()
    page = new_page(browser, 480, 1200)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "hide_settings": ["priority", "phases"],
                                  "charge_current_settings": "expanded", "slider_steps": {"limit_soc": 10}})
    t.check(page.locator(in_card('input[data-entity="number.evcc_openwb_priority"]')).count() == 0, "priority hidden")
    t.check(page.locator(in_card(".phase-btn-group")).count() == 0, "phases hidden")
    t.check(page.locator(in_card('input[data-entity="select.evcc_openwb_max_current"]')).count() == 1, "max_current still shown")
    t.check(page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"]')).get_attribute("step") == "10", "slider_steps overrides range step")
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    panel = page.locator(in_card(".slider-edit")); v0 = panel.locator(".slider-edit-input").input_value()
    panel.locator("[data-edit-dec]").click(); v1 = panel.locator(".slider-edit-input").input_value()
    t.check(float(v0) - float(v1) == 10, "− uses the overridden step", f"{v0}->{v1}")
    page.locator("#host").screenshot(path=str(OUT / "panel-open.png"))
    page.close()

    # --- editor renders the hide checkboxes ------------------------------------------
    t.group("editor - hide_settings checkboxes")
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint"})
    n = page.evaluate("""async () => {
      const ed = document.createElement("evcc-card-editor");
      ed.setConfig({ mode: "loadpoint", hide_settings: ["priority"] });
      ed.hass = window.__hass; document.body.appendChild(ed);
      await new Promise(r => setTimeout(r, 800));
      const boxes = [...ed.shadowRoot.querySelectorAll('input[data-field="hide_settings"]')];
      return { count: boxes.length, checked: boxes.filter(b => b.checked).map(b => b.dataset.lp) };
    }""")
    t.check(n["count"] == 9 and n["checked"] == ["priority"], "editor shows 9 hide checkboxes with config applied", json.dumps(n))
    page.close()


def contracts(browser, port, t):
    """Every writing control must call the right HA service with the right payload."""
    t.group("contracts - writing actions and their service calls")
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    last = lambda: svc(page)[-1]
    exp  = lambda domain, service, data: {"domain": domain, "service": service, "data": data}

    page.locator(in_card('button.mode-btn[data-value="now"]')).click(); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_mode", "option": "now"}),
            "mode button → select.select_option mode=now", json.dumps(last()))
    page.locator(in_card('button.phase-btn[data-value="3"]')).click(); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_phases_configured", "option": "3"}),
            "phase button → select.select_option phases_configured=3", json.dumps(last()))
    page.locator(in_card('button.smart-cost-clear-btn[data-entity="button.evcc_openwb_smart_cost_limit"]')).click()
    t.check(last() == exp("button", "press", {"entity_id": "button.evcc_openwb_smart_cost_limit"}),
            "clear limit → button.press smart_cost_limit", json.dumps(last()))
    page.locator(in_card('button.smart-cost-clear-btn[data-entity="button.evcc_openwb_smart_feed_in_priority_limit"]')).click()
    t.check(last() == exp("button", "press", {"entity_id": "button.evcc_openwb_smart_feed_in_priority_limit"}),
            "clear feed-in limit → button.press", json.dumps(last()))
    page.locator(in_card('button.toggle[data-entity="switch.evcc_openwb_plan_strategy_continuous"]')).click(); page.wait_for_timeout(400)
    t.check(last() == exp("switch", "turn_on", {"entity_id": "switch.evcc_openwb_plan_strategy_continuous"}),
            "continuous charging (off) → switch.turn_on", json.dumps(last()))
    page.locator(in_card("select.plan-precondition-select")).select_option("1800"); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_plan_strategy_precondition", "option": "1800"}),
            "preconditioning → select.select_option 1800", json.dumps(last()))
    page.locator(in_card("select.plan-vehicle-select")).select_option("db:38"); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_vehicle_name", "option": "db:38"}),
            "vehicle select → select.select_option vehicle_name=db:38", json.dumps(last()))
    page.locator(in_card("select.plan-vehicle-select")).select_option("db:18"); page.wait_for_timeout(400)

    # plan save: vehicle db:18, soc via panel, time via the datetime-local input
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.locator(in_card("input.plan-time-input")).fill("2026-09-19T07:00"); page.wait_for_timeout(300)
    page.locator(in_card("button.plan-btn.save")).click(); page.wait_for_timeout(400)
    t.check(last() == exp("evcc_intg", "set_vehicle_plan", {"vehicle": "db:18", "soc": 80, "startdate": "2026-09-19 07:00:00"}),
            "set plan → evcc_intg.set_vehicle_plan {vehicle, soc, startdate}", json.dumps(last()))
    page.close()

    # plan delete needs an active plan → state override
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]}, set={"binary_sensor.evcc_openwb_plan_active": "on"})
    t.check(page.locator(in_card("button.plan-btn.delete")).count() == 1, "delete button shown while a plan is active")
    page.locator(in_card("button.plan-btn.delete")).click(); page.wait_for_timeout(300)
    t.check(last() == exp("evcc_intg", "del_vehicle_plan", {"vehicle": "db:18"}), "delete plan → evcc_intg.del_vehicle_plan", json.dumps(last()))
    page.close()

    # battery boost chip is only offered while the boost limit is below 100 %
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, set={"select.evcc_openwb_battery_boost_limit": "80"})
    page.locator(in_card('button.boost-activate-btn[data-entity="switch.evcc_openwb_battery_boost"]')).click(); page.wait_for_timeout(300)
    t.check(last() == exp("switch", "turn_on", {"entity_id": "switch.evcc_openwb_battery_boost"}),
            "battery boost chip (off, limit 80 %) → switch.turn_on", json.dumps(last()))
    page.close()

    # battery mode
    page = new_page(browser, 480, 900)
    open_card(page, port, mode="battery")
    page.locator(in_card("button.batt-discharge-toggle")).click(); page.wait_for_timeout(300)
    t.check(last() == exp("switch", "turn_off", {"entity_id": "switch.evcc_battery_discharge_control"}),
            "discharge control (on) → switch.turn_off", json.dumps(last()))
    # the battery block renders its selects in more than one tab panel → take the visible first one
    page.locator(in_card('select.batt-inline-select[data-entity="select.evcc_priority_soc"]')).first.select_option("30"); page.wait_for_timeout(300)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_priority_soc", "option": "30"}),
            "priority soc → select.select_option 30", json.dumps(last()))
    page.close()


def traffic(browser, port, t):
    """Plan preview traffic rules promised to ha-evcc: idle = zero calls, a drag = one call."""
    t.group("traffic - plan preview backend calls")
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]})
    count = lambda typ: len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == typ])
    fc0, s0 = count("evcc_intg/forecast"), count("evcc_intg/sessions")
    p0 = count("evcc_intg/plan_preview")
    t.check(p0 == 1, "first render primes exactly one plan_preview for the default target", str(p0))
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.wait_for_timeout(1500)
    t.check(count("evcc_intg/plan_preview") == p0 + 1, "one target change → exactly one plan_preview call", str(count("evcc_intg/plan_preview")))
    # idle: 8 hass updates over ~3.5 s must not trigger any backend call
    for _ in range(8):
        page.evaluate("window.__card.hass = { ...window.__hass, states: { ...window.__hass.states } }"); page.wait_for_timeout(420)
    t.check(count("evcc_intg/plan_preview") == p0 + 1, "idle with hass updates → no further plan_preview calls", str(count("evcc_intg/plan_preview")))
    t.check(count("evcc_intg/forecast") == fc0 and count("evcc_intg/sessions") == s0, "idle → no further forecast/sessions calls",
            f"forecast {fc0}->{count('evcc_intg/forecast')}, sessions {s0}->{count('evcc_intg/sessions')}")
    # same value again (re-apply 80) must hit the cache, not the backend
    page.locator(in_card("button.plan-soc-val")).click(); page.locator(in_card("[data-edit-ok]")).click(); page.wait_for_timeout(1200)
    t.check(count("evcc_intg/plan_preview") == p0 + 1, "re-applying the same target → served from cache", str(count("evcc_intg/plan_preview")))
    # drag the plan slider through several values → one call on release
    rng = page.locator(in_card("input.plan-soc-range")); box = rng.bounding_box()
    y = box["y"] + box["height"] / 2
    page.mouse.move(box["x"] + box["width"] * 0.75, y); page.mouse.down()
    for i in range(1, 9): page.mouse.move(box["x"] + box["width"] * (0.75 - i * 0.06), y); page.wait_for_timeout(60)
    page.mouse.up(); page.wait_for_timeout(1500)
    t.check(count("evcc_intg/plan_preview") == p0 + 2, "slider drag over 8 positions → exactly one more plan_preview call", str(count("evcc_intg/plan_preview")))
    page.close()


def priority_dnd(browser, port, t):
    """Regression for #170: drag & drop reorder in priority mode, then apply."""
    t.group("priority - drag and drop (#170)")
    page = new_page(browser, 480, 700)
    errors = open_card(page, port, mode="priority")
    order = lambda: page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.priority-row')].map(r => r.dataset.lp)")
    t.check(order() == ["openwb", "wp"], "initial order by priority", str(order()))
    handle = page.locator(in_card('.priority-row[data-lp="wp"] .priority-handle')); hb = handle.bounding_box()
    target = page.locator(in_card('.priority-row[data-lp="openwb"]')).bounding_box()
    x, y0 = hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2
    y1 = target["y"] + 4
    page.mouse.move(x, y0); page.mouse.down()
    jitter = []
    for i in range(1, 11):
        page.mouse.move(x, y0 + (y1 - y0) * i / 10); page.wait_for_timeout(30)
        jitter.append(page.evaluate("(() => { const r = window.__card.shadowRoot.querySelector('.priority-row.priority-dragging'); return r ? r.getBoundingClientRect().top : null; })()"))
    steps = [b - a for a, b in zip(jitter, jitter[1:]) if a is not None and b is not None]
    t.check(all(d <= 0.5 for d in steps), "dragged row moves monotonically with the pointer (no jitter)", f"top deltas: {[round(d, 1) for d in steps]}")
    t.check(page.locator(in_card(".priority-placeholder")).count() == 1, "placeholder present during drag")
    page.mouse.up(); page.wait_for_timeout(400)
    t.check(order() == ["wp", "openwb"], "row dropped at the top → new order", str(order()))
    t.check(page.locator(in_card(".priority-target.changed")).count() == 2, "both targets marked as changed")
    page.locator(in_card("[data-priority-apply]")).click(); page.wait_for_timeout(400)
    calls = {c["data"]["entity_id"]: c["data"]["value"] for c in svc(page) if c["domain"] == "number"}
    t.check(calls == {"number.evcc_wp_priority": 1, "number.evcc_openwb_priority": 0}, "apply → number.set_value wp=1, openwb=0", json.dumps(calls))
    t.check(not errors, "no console errors during drag", "; ".join(errors)[:200])
    page.close()


LANGS = ["de", "en", "es", "fr", "hr", "nl", "pl", "pt"]

def locales(browser, port, t):
    """Locale files are complete and no raw translation key reaches the DOM."""
    t.group("locales - key parity and untranslated keys")
    ref = json.loads((ROOT / "dist/locales/en.json").read_text(encoding="utf-8"))
    for lang in LANGS:
        d = json.loads((ROOT / f"dist/locales/{lang}.json").read_text(encoding="utf-8"))
        missing, extra = sorted(set(ref) - set(d)), sorted(set(d) - set(ref))
        t.check(not missing and not extra, f"{lang}.json has the same keys as en.json", f"missing {missing[:5]} extra {extra[:5]}")
    index = json.loads((ROOT / "dist/locales/index.json").read_text(encoding="utf-8"))
    t.check(sorted(index) == sorted(LANGS), "locales/index.json lists every language", str(index))
    hook = """() => { const proto = customElements.get('evcc-card').prototype; if (proto.__wrapped) return;
        const orig = proto._t; proto.__wrapped = true; window.__missingKeys = new Set();
        proto._t = function(k, ...a) { const v = orig.call(this, k, ...a); if (v === k) window.__missingKeys.add(k); return v; }; }"""
    for lang in LANGS:
        missing = set()
        for cfg in ({"mode": "loadpoint", "charge_current_settings": "expanded"}, {"mode": "stats"}, {"mode": "battery"}, {"mode": "site"}):
            page = new_page(browser, 480, 1800)
            open_card(page, port, config=cfg, lang=lang)
            page.evaluate(hook); page.evaluate("window.__card._lastRenderKey = null; window.__card._render()"); page.wait_for_timeout(300)
            missing |= set(page.evaluate("[...window.__missingKeys]"))
            page.close()
        t.check(not missing, f"{lang}: no untranslated keys rendered", str(sorted(missing))[:200])


def discovery(browser, port, t):
    """Entity discovery variants: custom prefix, disabled loadpoints, heating loadpoints, disabled entities."""
    t.group("discovery - prefix, disabled and heating loadpoints")
    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, rename=("evcc_", "myevcc_"))
    t.check(page.locator(in_card('button.mode-btn[data-entity="select.myevcc_openwb_mode"]')).count() > 0 and not errors,
            "custom prefix myevcc_ detected from the registry", "; ".join(errors)[:200])
    page.close()
    for opt, want_rows, want_badge in (("hide", 1, 0), ("dim", 2, 1), ("show", 2, 0)):
        page = new_page(browser, 480, 1800)
        open_card(page, port, config={"mode": "loadpoint", "disabled_loadpoints": opt}, set={"binary_sensor.evcc_wp_disabled_in_config": "on"})
        rows, badge = page.locator(in_card(".loadpoint")).count(), page.locator(in_card(".lp-badge.disabled")).count()
        t.check(rows == want_rows and badge == want_badge, f"disabled_loadpoints: {opt} → {want_rows} loadpoint(s), {want_badge} disabled badge", f"rows={rows} badge={badge}")
        page.close()
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["wp"]})
    labels = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.slider-row label')].map(l => l.textContent.trim())")
    t.check("Ziel-Temperatur" in labels and page.locator(in_card(".plan-block")).count() == 0,
            "heating loadpoint: temperature label, no charge plan block", str(labels))
    page.close()
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"},
              disable=["number.evcc_openwb_smart_cost_limit", "number.evcc_openwb_smart_feed_in_priority_limit"])
    t.check(page.locator(in_card(".smart-cost-section")).count() == 0 and page.locator(in_card(".current-block")).count() == 1,
            "disabled limit entities: sections absent, block still rendered")
    page.close()


def widths(browser, port, t):
    """Narrow and wide cards: the input panel stays inside the card, no console errors."""
    t.group("widths - responsive layout")
    for w in (300, 650):
        page = new_page(browser, w + 40, 1600)
        errors = open_card(page, port, width=w, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
        page.locator(in_card('input[data-entity="number.evcc_openwb_smart_cost_limit"] + button.slider-val')).click(); page.wait_for_timeout(150)
        card, panel = page.locator(in_card("ha-card")).bounding_box(), page.locator(in_card(".slider-edit")).bounding_box()
        inside = panel["x"] >= card["x"] and panel["x"] + panel["width"] <= card["x"] + card["width"] + 0.5
        scroll = page.evaluate("(() => { const c = window.__card.shadowRoot.querySelector('ha-card'); return c.scrollWidth - c.clientWidth; })()")
        page.locator("#host").screenshot(path=str(OUT / f"width-{w}.png"))
        t.check(inside and scroll <= 0 and not errors, f"{w} px: input panel inside the card, no horizontal overflow", f"overflow={scroll}; {'; '.join(errors)[:150]}")
        page.close()


GROUPS = {"render": render_smoke, "interaction": interactions, "contracts": contracts, "traffic": traffic,
          "priority": priority_dnd, "locales": locales, "discovery": discovery, "widths": widths}


def main():
    global OUT
    ap = argparse.ArgumentParser(); ap.add_argument("--headed", action="store_true")
    ap.add_argument("--only", action="append", choices=list(GROUPS), help="run only these groups (repeatable)")
    ap.add_argument("--browser", choices=BROWSERS, default=os.environ.get("EVCC_BROWSER", "chromium"),
                    help="engine under test (default: chromium, or $EVCC_BROWSER)")
    a = ap.parse_args()
    if a.browser != "chromium": OUT = OUT / a.browser     # keep the Chromium reports and shots apart
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    srv, port = serve()
    t = T(f"evcc-card tests ({a.browser})", browser=a.browser)
    with sync_playwright() as p:
        browser = launch(p, a.browser, a.headed)
        for name, fn in GROUPS.items():
            if not a.only or name in a.only:
                try: fn(browser, port, t)
                except Exception as e:   # a crashed group must not hide the other groups' results
                    t.fail(f"{name}: group crashed", f"{type(e).__name__}: {str(e)[:300]}")
        browser.close()
    srv.shutdown()
    report = t.write_reports(OUT, sorted(p.name for p in OUT.glob("*.png")))
    print(f"\n{len(t.results) - len(t.failed)} passed, {len(t.failed)} failed  (report: {report}, screenshots in {OUT})")
    sys.exit(1 if t.failed else 0)


if __name__ == "__main__":
    main()
