#!/usr/bin/env python3
"""Headless render + interaction tests for evcc-card against the mock hass.

Usage:  python3 test/run.py [--headed] [--only NAME]
Serves the repo root over HTTP, opens test/harness.html in Chromium, renders
every card mode (light + dark, screenshots in test/out/) and runs interaction
scenarios that assert on the recorded service calls. Exit code 1 on failure.
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
FIXED_TIME = "2026-09-18T13:00:00"
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
    def __init__(self, suite="evcc-card tests"):
        self.suite, self.results, self.started, self.section = suite, [], time.time(), ""
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
        meta = {"suite": self.suite, "card_version": card_version(), "run_at": datetime.datetime.now().isoformat(timespec="seconds"),
                "duration_s": round(time.time() - self.started, 1), "fixed_browser_time": FIXED_TIME, "passed": passed, "failed": failed}
        (out / "report.json").write_text(json.dumps({**meta, "results": self.results, "screenshots": [str(s) for s in screenshots]}, indent=1, ensure_ascii=False))
        lines = [f"# {self.suite}", "",
                 f"**{'FAILED' if failed else 'PASSED'}**: {passed} passed, {failed} failed", "",
                 f"- Card version: {meta['card_version']}", f"- Run at: {meta['run_at']} ({meta['duration_s']} s)",
                 f"- Browser clock frozen at: {FIXED_TIME} {TIMEZONE}", ""]
        if failed:
            lines += ["## Failures", ""] + [f"- **{r['section']}** / {r['name']}" + (f": {r['detail']}" if r['detail'] else "") for r in self.failed] + [""]
        lines += ["## All checks", "", "| Result | Section | Check | Detail |", "|---|---|---|---|"]
        lines += [f"| {'PASS' if r['ok'] else 'FAIL'} | {r['section']} | {r['name']} | {r['detail'].replace('|', '\\|')} |" for r in self.results]
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


def open_card(page, port, config=None, mode=None, dark=False, width=400, lang="de", ws=True):
    q = {"w": width, "lang": lang}
    if not ws: q["ws"] = 0
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


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--headed", action="store_true"); ap.add_argument("--only", choices=["render", "interaction"])
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    srv, port = serve()
    t = T()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=not a.headed, args=["--no-sandbox", "--lang=de-DE"])
        if a.only in (None, "render"):      render_smoke(browser, port, t)
        if a.only in (None, "interaction"): interactions(browser, port, t)
        browser.close()
    srv.shutdown()
    report = t.write_reports(OUT, sorted(p.name for p in OUT.glob("*.png")))
    print(f"\n{len(t.results) - len(t.failed)} passed, {len(t.failed)} failed  (report: {report}, screenshots in {OUT})")
    sys.exit(1 if t.failed else 0)


if __name__ == "__main__":
    main()
