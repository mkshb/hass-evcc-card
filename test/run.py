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
import argparse, datetime, http.server, json, os, re, socketserver, subprocess, sys, threading, time, urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "test" / "out"
MODES = ["loadpoint", "compact", "battery", "vehicle", "site", "flow", "grid", "stats", "plan", "repeatplan", "priority", "debug"]
# What a mode needs beyond its name to show anything: the vehicle mode shows one
# vehicle per card and asks which one when it is not told.
MODE_CONFIG = {"vehicle": {"vehicle": "ex30"}}


def mode_config(mode, **extra):
    return {"mode": mode, **MODE_CONFIG.get(mode, {}), **extra}

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


class Server(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True


def serve():
    srv = Server(("127.0.0.1", 0), Quiet)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


def card_version():
    m = re.search(r'EVCC_CARD_VERSION\s*=\s*"([^"]+)"', (ROOT / "dist" / "evcc-card.js").read_text(encoding="utf-8"))
    return m.group(1) if m else "?"


class T:
    """Collects check results and writes report.md / report.json / junit.xml."""
    def __init__(self, suite="evcc-card tests", browser="chromium", frozen_time=FIXED_TIME):
        self.suite, self.browser, self.results, self.started, self.section = suite, browser, [], time.time(), ""
        self.frozen_time = frozen_time   # None for a run on the live clock (test/e2e.py)
        self.durations = {}              # group -> seconds, for the report
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
                "duration_s": round(time.time() - self.started, 1), "group_durations_s": self.durations, "fixed_browser_time": self.frozen_time, "passed": passed, "failed": failed}
        (out / "report.json").write_text(json.dumps({**meta, "results": self.results, "screenshots": [str(s) for s in screenshots]}, indent=1, ensure_ascii=False))
        lines = [f"# {self.suite}", "",
                 f"**{'FAILED' if failed else 'PASSED'}**: {passed} passed, {failed} failed", "",
                 f"- Card version: {meta['card_version']}", f"- Browser: {self.browser}", f"- Run at: {meta['run_at']} ({meta['duration_s']} s)"]
        lines += [f"- Browser clock frozen at: {self.frozen_time} {TIMEZONE}"] if self.frozen_time else ["- Browser clock: live"]
        lines += [""]
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


# Pages are reused: one context per browser, a page taken from the pool by
# new_page() and handed back by done(). A fresh context per test cost a context
# start and a cold load of the bundle every time; within one context the bundle
# comes from the HTTP cache and V8 keeps its compiled code. done() navigates to
# about:blank, so no card, timer or listener of a test outlives it.
_pools = {}


def new_page(browser, width=480, height=900):
    pool = _pools.get(id(browser))
    if pool is None:
        ctx = browser.new_context(viewport={"width": width, "height": height}, timezone_id=TIMEZONE, locale=LOCALE)
        ctx.route("**/favicon.ico", lambda r: r.fulfill(status=204))
        pool = _pools[id(browser)] = {"ctx": ctx, "free": []}
    page = pool["free"].pop() if pool["free"] else pool["ctx"].new_page()
    page._evcc_pool = pool
    page.set_viewport_size({"width": width, "height": height})
    page.clock.set_fixed_time(FIXED_TIME)
    return page


def done(page):
    """Hands a test's page back to the pool: the listeners open_card attached
    removed, the browser storage of the harness emptied (the pages of a pool
    share it, and the card keeps its vehicle pictures there), the document
    replaced by about:blank."""
    for event, fn in getattr(page, "_evcc_listeners", []):
        page.remove_listener(event, fn)
    page._evcc_listeners = []
    try: page.evaluate("localStorage.clear()")
    except Exception: pass
    page.goto("about:blank")
    page._evcc_pool["free"].append(page)


def open_card(page, port, config=None, mode=None, dark=False, width=400, lang="de", ws=True, set=None, disable=None,
              rename=None, attrs=None, tariff=None, second=None, wsname=None, admin=True, drop=None,
              vehicle_device=True, optimizer=False, battery_ext=False, optimize=False):
    q = {"w": width, "lang": lang}
    if optimizer: q["optimizer"] = 1
    if battery_ext: q["battext"] = 1
    if optimize: q["optimize"] = 1
    if not ws: q["ws"] = 0
    if not admin: q["admin"] = 0
    if drop: q["drop"] = ",".join(drop)
    if not vehicle_device: q["vd"] = 0
    if set:     q["set"] = ",".join(f"{k}:{v}" for k, v in set.items())
    if attrs:   q["attrs"] = json.dumps(attrs)
    if disable: q["disable"] = ",".join(disable)
    if rename:  q["rename"] = f"{rename[0]}:{rename[1]}"
    if tariff:  q["tariff"] = tariff
    if second:  q["second"] = json.dumps(second)
    if wsname:  q["wsname"] = wsname
    if config is not None: q["config"] = json.dumps(config)
    else: q["mode"] = mode or "loadpoint"
    if dark: q["dark"] = 1
    errors = []
    listeners = [("pageerror", lambda e: errors.append(f"pageerror: {e}")),
                 ("console",   lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None),
                 ("response",  lambda r: errors.append(f"http {r.status}: {r.url}") if r.status >= 400 else None)]
    for event, fn in listeners:
        page.on(event, fn)
    page._evcc_listeners = getattr(page, "_evcc_listeners", []) + listeners
    page.goto(f"http://127.0.0.1:{port}/test/harness.html?{urllib.parse.urlencode(q)}")
    page.wait_for_function("window.__ready && window.__ready()", timeout=10000)
    settle(page)   # debounced render + capability probe + first WS fetches
    return errors


def settle(page):
    """Wait until the card is idle: no short timer or fetch pending and its DOM
    unchanged for 50 ms (window.__settle in harness.html). Replaces a fixed pause
    after anything that makes the card render."""
    if not page.evaluate("window.__settle()"):
        raise TimeoutError("card did not settle within 8 s")


def svc(page):
    return page.evaluate("window.__hass.serviceCalls")


def in_card(sel):
    return f"evcc-card {sel}"


def render_smoke(browser, port, t):
    t.group("render - all modes, light + dark")
    for mode in MODES:
        for dark in (False, True):
            page = new_page(browser, 480, 900)
            errors = open_card(page, port, config=mode_config(mode), dark=dark)
            has_card = page.locator(in_card("ha-card")).count() > 0
            name = f"render {mode}{' dark' if dark else ''}"
            shot = OUT / f"{mode}{'-dark' if dark else ''}.png"
            page.locator("#host").screenshot(path=str(shot))
            t.check(has_card and not errors, name, "; ".join(errors)[:300])
            if mode == "stats" and not dark:
                bars = page.locator(in_card(".evcc-chart-wrap svg rect")).count()
                t.check(bars > 0, "stats: bar chart rendered from sessions", f"{bars} bars")
                t.check(page.locator(in_card(".stats-chart-loading")).count() == 0, "stats: no loading placeholder left")
            done(page)

    # The stylesheet is parsed once per page and adopted by every card, so a
    # render carries no <style> element and two cards share the same sheet.
    t.group("render - one shared stylesheet")
    page = new_page(browser, 480, 1200)
    errors = open_card(page, port, mode="loadpoint")
    sheets = page.evaluate("""() => {
      const a = window.__card, root = a.shadowRoot;
      const b = document.createElement('evcc-card');
      b.setConfig({ mode: 'site' }); document.getElementById('host').appendChild(b); b.hass = window.__hass;
      return new Promise(res => setTimeout(() => res({
        adopted: root.adoptedStyleSheets.length,
        inline:  root.querySelectorAll('style').length,
        shared:  b.shadowRoot.adoptedStyleSheets[0] === root.adoptedStyleSheets[0],
        rules:   root.adoptedStyleSheets[0]?.cssRules.length ?? 0,
        styled:  getComputedStyle(root.querySelector('.card-content')).paddingLeft,
      }), 600));
    }""")
    t.check(sheets["adopted"] == 1 and sheets["inline"] == 0, "a rendered card adopts one sheet and inlines no <style>", json.dumps(sheets))
    t.check(sheets["shared"] and sheets["rules"] > 100, "a second card shares the same parsed sheet", json.dumps(sheets))
    t.check(sheets["styled"] == "16px" and not errors, "the adopted sheet styles the card", json.dumps(sheets))
    # A re-render keeps the one sheet, it is not adopted twice.
    page.evaluate("() => { const c = window.__card; c._lastRenderKey = null; c._render(); c._render(); }")
    t.check(page.evaluate("window.__card.shadowRoot.adoptedStyleSheets.length") == 1, "re-renders keep a single adopted sheet")
    done(page)



def stats_fallback(browser, port, t):
    """Stats mode on an ha-evcc without evcc_intg/sessions.

    The card then reconstructs the chart from the stat_* template sensors and
    the HA recorder, which the mock serves from `recorder/statistics_during_period`.
    """
    t.group("stats fallback - stat_* entities and the HA recorder")
    page = new_page(browser, 480, 900)
    errors = open_card(page, port, mode="stats", ws=False)
    page.locator("#host").screenshot(path=str(OUT / "stats-fallback.png"))
    t.check(page.locator(in_card("ha-card")).count() > 0 and not errors, "renders without the WebSocket data API", "; ".join(errors)[:300])

    calls = page.evaluate("window.__hass.wsCalls")
    rec = [c for c in calls if c["type"] == "recorder/statistics_during_period"]
    t.check(len(rec) >= 1, "asks the recorder for statistics", f"{len(rec)} call(s)")
    # Probing capabilities is how the card finds out the API is missing; asking for
    # data after that reply would be the bug.
    data_cmds = [c["type"] for c in calls if str(c["type"]).startswith("evcc_intg/") and c["type"] != "evcc_intg/capabilities"]
    t.check(not data_cmds, "no evcc_intg data command is attempted after capabilities fails", str(data_cmds)[:200])
    if rec:
        q = rec[-1]
        t.check(q.get("types") == ["sum"] and q.get("period") in ("day", "month") and "start_time" in q,
                "recorder query asks for sum buckets over a period", json.dumps({k: q.get(k) for k in ("period", "types", "start_time")}))
        t.check("sensor.evcc_stat_total_charged_kwh" in (q.get("statistic_ids") or []),
                "recorder query names the cumulative kWh sensor", json.dumps(q.get("statistic_ids")))

    bars = page.locator(in_card("rect.evcc-bar")).count()
    t.check(bars > 0, "chart is rebuilt from recorder deltas", f"{bars} bars")
    totals = [float(v) for v in page.evaluate("[...window.__card.shadowRoot.querySelectorAll('rect.evcc-bar')].map(r => r.dataset.total)") if v]
    solars = [float(v) for v in page.evaluate("[...window.__card.shadowRoot.querySelectorAll('rect.evcc-bar')].map(r => r.dataset.solar)") if v]
    t.check(bool(totals) and all(v >= 0 for v in totals), "every bar carries a non-negative delta", f"{len(totals)} values, min {min(totals) if totals else '-'}")
    t.check(bool(solars) and any(v > 0 for v in solars), "the solar split survives the fallback", f"{len(solars)} values, max {max(solars) if solars else '-'}")
    t.check(all(sv <= tv + 0.05 for sv, tv in zip(solars, totals)), "no bar claims more solar than total energy",
            str([(s, v) for s, v in zip(solars, totals) if s > v + 0.05][:3]))

    # The period tabs pick a different recorder resolution; "30d" is the only one
    # that asks for day buckets, so without this the daily branch never runs.
    tab = page.locator(in_card('.stats-period-tab[data-period="30d"]'))
    t.check(tab.count() == 1, "legacy period tabs are offered", f"{tab.count()} tab(s) named 30d")
    if tab.count() == 1:
        tab.click()
        page.wait_for_timeout(900)
        daily = [c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "recorder/statistics_during_period" and c.get("period") == "day"]
        t.check(len(daily) >= 1, "30d tab queries day buckets", f"{len(daily)} call(s)")
        n = page.locator(in_card("rect.evcc-bar")).count()
        t.check(n == 30, "30d chart shows one bar per day", f"{n} bars")
    done(page)


def vehicle_mode(browser, port, t):
    """Vehicle mode: one block per vehicle evcc knows, fed from the vehicle's own
    entities and, while it is connected, from the loadpoint it is plugged into."""
    UNPLUGGED = {"binary_sensor.evcc_openwb_connected": "off", "binary_sensor.evcc_openwb_charging": "off"}
    block = lambda slug: in_card(f'.vehicle-block[data-vehicle="{slug}"]')

    def card(**kw):
        page = new_page(browser, 480, 1400)
        kw.setdefault("config", {"mode": "vehicle", "vehicle": "ex30"})
        return page, open_card(page, port, **kw)

    t.group("vehicle - the card's vehicle, value source and loadpoint")
    page, errors = card()
    slugs = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block')].map(b => b.dataset.vehicle)")
    t.check(slugs == ["ex30"] and not errors, "the card shows the one vehicle it is for", f"{slugs}; {'; '.join(errors)[:150]}")
    ex30 = page.locator(block("ex30"))
    t.check(ex30.locator(".lp-name").inner_text().strip().upper() == "EX30" and ex30.locator(".vehicle-lp").inner_text().strip() == "openWB",
            "the connected vehicle carries its evcc title and names its loadpoint", ex30.locator(".lp-header").inner_text())
    info = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .soc-label-row [data-more-info]')].map(e => [e.dataset.moreInfo, e.textContent.trim()])")
    t.check(info == [["sensor.evcc_openwb_vehicle_soc", "56 %"], ["sensor.evcc_openwb_vehicle_range", "198 km"], ["sensor.evcc_openwb_vehicle_odometer", "11445 km"]],
            "connected: charge level, range and odometer are read from the loadpoint", json.dumps(info))
    rfold = ex30.locator('[data-vehicle-fold="rplan"]')
    t.check(ex30.locator(".rplan-row").count() == 0 and rfold.count() == 1 and "0 von 2 aktiv" in rfold.inner_text(),
            "the repeating plans are folded to one line that says how many are on", rfold.inner_text() if rfold.count() else "missing")
    rfold.click(); page.wait_for_timeout(200)
    t.check(ex30.locator(".rplan-row").count() == 2 and rfold.get_attribute("aria-expanded") == "true",
            "unfolded: the repeating plans of that vehicle, unavailable ones stay out", f"{ex30.locator('.rplan-row').count()} rows")
    totals = ex30.locator(".vehicle-totals .si-value").all_inner_texts()
    t.check(totals == ["2425 kWh", "308.32 €", "1459 h"], "the session totals of that vehicle", json.dumps(totals))
    ex30.locator(".rplan-row button.toggle").first.click()
    page.wait_for_timeout(200)
    calls = svc(page)
    t.check(calls and calls[-1] == {"domain": "switch", "service": "turn_on", "data": {"entity_id": "switch.evcc_ex30_repeating_plan_2"}},
            "switching a repeating plan calls switch.turn_on on the plan entity", json.dumps(calls[-1:]))
    done(page)

    # The other vehicle, on a card of its own: evcc cannot reach it, so it has no
    # values, no plans and no totals, and says so instead of showing 0 %.
    page, errors = card(config={"mode": "vehicle", "vehicle": "id7"})
    id7 = page.locator(block("id7"))
    t.check(page.locator(block("ex30")).count() == 0 and id7.count() == 1 and not errors,
            "a second card shows the other vehicle and only that one", "")
    t.check(id7.locator(".lp-badge.ready").count() == 1 and id7.locator(".vehicle-lp").count() == 0
            and id7.locator(".soc-track").count() == 0 and "Keine aktuellen Daten" in id7.inner_text(),
            "a vehicle evcc cannot reach shows no 0 % bar but a hint", id7.inner_text()[:120])
    t.check(id7.locator(".rplan-row").count() == 0 and id7.locator(".vehicle-totals").count() == 0
            and id7.locator(".vehicle-chips, [data-vehicle-details]").count() == 0,
            "no plans, no totals, and without a device of its own no chips either", "")
    done(page)

    # ha-evcc suggests days for the total charge duration; 60.81 d are the same 1459 h.
    DUR = "sensor.evcc_cstotal_ex30_charging_sessions_vehicle_chargeduration"
    page, errors = card(set={DUR: "60.81"}, attrs={DUR: {"unit_of_measurement": "d"}})
    totals = page.locator(block("ex30")).locator(".vehicle-totals .si-value").all_inner_texts()
    t.check(totals[-1:] == ["1459 h"] and not errors, "the total charge duration is read in the unit HA reports it in", json.dumps(totals))
    done(page)

    page, errors = card(set=UNPLUGGED, vehicle_device=False)
    ex30 = page.locator(block("ex30"))
    info = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .soc-label-row [data-more-info]')].map(e => [e.dataset.moreInfo, e.textContent.trim()])")
    t.check(info == [["sensor.evcc_ex30_configvehicle_soc", "52 %"], ["sensor.evcc_ex30_configvehicle_range", "184 km"], ["sensor.evcc_ex30_configvehicle_odometer", "11445 km"]],
            "unplugged: the values come from the vehicle's own sensors", json.dumps(info))
    t.check(ex30.locator(".lp-badge.ready").inner_text().strip() == "Nicht verbunden" and ex30.locator(".vehicle-lp").count() == 0 and not errors,
            "unplugged: badge says so, no loadpoint is named", ex30.locator(".lp-header").inner_text())
    marker = ex30.locator(".soc-limit-marker").get_attribute("style") or ""
    t.check("left:90%" in marker.replace(" ", ""), "the limit marker follows the vehicle's own limit", marker)
    done(page)

    VL = "sensor.evcc_openwb_vehicle_limit_soc"
    vmark = lambda page: page.evaluate("window.__card.shadowRoot.querySelector('.vehicle-block[data-vehicle=ex30] .soc-vehicle-limit-marker')?.style.left ?? null")
    page, errors = card(set={VL: "80"})
    t.check(vmark(page) == "80%" and not errors, "plugged in: the limit set in the vehicle on the bar", str(vmark(page)))
    done(page)
    page, errors = card(set={**UNPLUGGED, VL: "80"})
    t.check(vmark(page) is None, "unplugged: the loadpoint's reading does not apply", str(vmark(page)))
    done(page)

    t.group("vehicle - device of the vehicle's own integration")
    VOLVO, DECOY = "f1c0de00volvoex30fixture000000001", "f1c0de00companionex30fixture00002"
    values = "[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .soc-label-row [data-more-info]')].map(e => [e.dataset.moreInfo, e.textContent.trim()])"
    chips  = "[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .vehicle-chip')].map(e => [e.className.replace('vehicle-chip', '').trim(), e.textContent.trim(), e.dataset.moreInfo || ''])"
    page, errors = card()
    link = page.evaluate("window.__card._vehicleLinkCache && window.__card._vehicleLinkCache.link")
    t.check((link or {}).get("deviceId") == VOLVO and not errors,
            "the device is found on its own: the integration's, not the companion app's of the same name", json.dumps(link and link["deviceId"]))
    info = page.evaluate(values)
    t.check([i[0] for i in info] == ["sensor.evcc_openwb_vehicle_soc", "sensor.evcc_openwb_vehicle_range", "sensor.evcc_openwb_vehicle_odometer"],
            "connected: evcc's loadpoint values still lead", json.dumps(info))
    got = page.evaluate(chips)
    t.check(got == [["ok", "Verriegelt", "lock.volvo_ex30_schloss"], ["warn", "Tankdeckel", "binary_sensor.volvo_ex30_tankdeckel"],
                    ["ok", "Keine Warnungen", ""], ["", "Zuhause", "device_tracker.volvo_ex30_standort"]],
            "chips: lock, the one open lid by name, thirty warning flags as one chip, location", json.dumps(got, ensure_ascii=False))
    details = page.locator(block("ex30")).locator(".vehicle-detail-list")
    t.check(details.count() == 1 and not details.is_visible(), "the remaining entities are folded away", "")
    page.locator(block("ex30")).locator("[data-vehicle-details]").click()
    page.wait_for_timeout(200)
    rows = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .vehicle-detail')].map(e => [e.dataset.moreInfo, e.textContent.replace(/\\s+/g, ' ').trim()])")
    labels = dict(rows)
    t.check(page.locator(block("ex30")).locator(".vehicle-detail-list").is_visible()
            and labels.get("sensor.volvo_ex30_batteriekapazitat") == "Batteriekapazität 69 kWh"
            and labels.get("sensor.volvo_ex30_reichweite_bis_wartung") == "Reichweite bis Wartung 18525 km"
            and not any(i.startswith(("button.", "lock.", "device_tracker.")) or "bremsleuchte" in i for i in labels)
            and "sensor.volvo_ex30_batterie" not in labels,
            "unfolded: capacity and service values by their HA name, nothing shown twice, no unknown flags", json.dumps(rows[:4], ensure_ascii=False))
    done(page)

    page, errors = card(set=UNPLUGGED)
    info = page.evaluate(values)
    t.check(info == [["sensor.volvo_ex30_batterie", "72 %"], ["sensor.volvo_ex30_reichweite_bis_batterie_leer", "257 km"], ["sensor.volvo_ex30_kilometerstand", "11503 km"]],
            "unplugged: the value that changed last wins, here the integration's; range is not the distance to service", json.dumps(info))
    tip = page.locator(block("ex30")).locator(".soc-label-row [data-more-info]").first.get_attribute("title") or ""
    t.check("Aktualisiert" in tip and "Stunde" in tip, "the tooltip tells the age of a value", tip)
    done(page)

    # Plugged in, but evcc cannot reach the vehicle: the loadpoint reports 0 for
    # range and odometer, which must not hide the integration's readings.
    page, errors = card(set={"sensor.evcc_openwb_vehicle_range": "0", "sensor.evcc_openwb_vehicle_odometer": "0"})
    info = dict(page.evaluate(values))
    t.check(info.get("sensor.volvo_ex30_reichweite_bis_batterie_leer") == "257 km" and info.get("sensor.volvo_ex30_kilometerstand") == "11503 km"
            and "sensor.evcc_openwb_vehicle_range" not in info and not errors,
            "plugged in with 0 km from evcc: range and odometer come from the vehicle's integration", json.dumps(info))
    done(page)

    page, errors = card(set=dict(UNPLUGGED, **{"binary_sensor.volvo_ex30_reifen_vorne_links": "on", "lock.volvo_ex30_schloss": "unlocked"}))
    got = page.evaluate(chips)
    t.check(["warn", "Entriegelt", "lock.volvo_ex30_schloss"] in got and ["alert", "Reifen vorne links", "binary_sensor.volvo_ex30_reifen_vorne_links"] in got
            and not any(c[1] == "Keine Warnungen" for c in got),
            "a raised warning and an open lock get a chip of their own", json.dumps(got, ensure_ascii=False))
    done(page)

    for cfg, want, label in (({"vehicle": "ex30", "vehicle_device": False}, None, "vehicle_device: false switches the link off"),
                             ({"vehicle": "ex30", "vehicle_device": "none"}, None, "\"none\" leaves the card without a device"),
                             ({"vehicle": "ex30", "vehicle_device": DECOY}, DECOY, "a configured device overrides the search"),
                             ({"vehicle": "id7", "vehicle_device": VOLVO}, VOLVO, "a vehicle the search finds nothing for takes a configured device")):
        page, errors = card(config=dict({"mode": "vehicle"}, **cfg))
        link = page.evaluate("window.__card._vehicleLinkCache && window.__card._vehicleLinkCache.link")
        t.check((link or {}).get("deviceId", None) == want and not errors, label, json.dumps(link and link["deviceId"]))
        done(page)

    page, errors = card(set=UNPLUGGED)
    page.evaluate("""() => { const h = window.__hass; const id = "sensor.volvo_ex30_batterie";
      h.states = { ...h.states, [id]: { ...h.states[id], state: "80", last_updated: new Date().toISOString() } };
      window.__card.hass = { ...h }; }""")
    page.wait_for_timeout(600)
    soc = page.locator(block("ex30")).locator(".soc-label-row [data-more-info]").first.inner_text().strip()
    t.check(soc == "80 %", "a change of an entity without the evcc prefix reaches the card", soc)
    done(page)

    t.group("vehicle - what the vehicle is doing")
    AWAY = dict(UNPLUGGED, **{"sensor.volvo_ex30_status_des_ladeanschluss": "disconnected"})
    badge = lambda page: page.locator(block("ex30")).locator(".lp-badge").inner_text().strip()
    for st, want, label in (
        ({}, "Lädt", "charging at the loadpoint"),
        ({"binary_sensor.evcc_openwb_charging": "off"}, "Verbunden", "connected at the loadpoint"),
        (AWAY, "Parkt", "parked, told by the integration"),
        (dict(AWAY, **{"binary_sensor.volvo_ex30_motorstatus": "on"}), "Fährt", "driving"),
        (dict(AWAY, **{"sensor.volvo_ex30_ladestatus": "charging", "binary_sensor.volvo_ex30_motorstatus": "on"}), "Lädt",
         "charging away from home, told by the integration alone, beats the engine flag"),
        (UNPLUGGED, "Verbunden", "plugged in somewhere evcc does not see"),
    ):
        page, errors = card(set=st)
        got = badge(page)
        t.check(got == want and not errors, f"badge: {label}", got)
        done(page)
    page, errors = card(set=UNPLUGGED, vehicle_device=False)
    t.check(badge(page) == "Nicht verbunden", "without an integration the card does not claim to know: not connected", badge(page))
    done(page)

    # the remaining charging time, as in the header of the loadpoint (#187)
    page, errors = card()
    rem = page.locator(block("ex30")).locator(".lp-header .lp-remaining")
    t.check(rem.count() == 1 and rem.inner_text().strip() == "6 h 48 min" and rem.get_attribute("data-more-info") == "sensor.evcc_openwb_charge_remaining_duration",
            "charging: the remaining time in the header, opens its sensor", rem.inner_text() if rem.count() else "none")
    done(page)
    page, errors = card(set={"binary_sensor.evcc_openwb_charging": "off"})
    t.check(page.locator(block("ex30")).locator(".lp-remaining").count() == 0, "not charging: no remaining time")
    done(page)

    # the loadpoint's name: evcc's title from ha-evcc's capabilities; a device
    # that is not the loadpoint's own (older ha-evcc put a single loadpoint on
    # the main device) never names it (#187)
    page, errors = card()
    names = page.evaluate("""() => { const c = window.__card, h = window.__hass;
      const ents = { mode: "select.evcc_openwb_mode" };
      h.devices.main = { id: "main", name: "evcc ☀️🚘 Solar Charging [evcc]", name_by_user: null };
      h.entities["select.evcc_openwb_mode"] = { ...h.entities["select.evcc_openwb_mode"], device_id: "main" };
      const caps = c._loadpointTitle("openwb", ents);
      c._lpTitleMap = {};
      const main = c._loadpointTitle("openwb", ents);
      h.devices.main.name_by_user = "My evcc";
      const renamedMain = c._loadpointTitle("openwb", ents);
      h.devices.lp = { id: "lp", name: "evcc - Ladepunkt openWB [evcc]", name_by_user: "Wallbox" };
      h.entities["select.evcc_openwb_mode"].device_id = "lp";
      const renamedLp = c._loadpointTitle("openwb", ents);
      return { caps, main, renamedMain, renamedLp }; }""")
    t.check(names == {"caps": "openWB", "main": "openwb", "renamedMain": "openwb", "renamedLp": "Wallbox"},
            "loadpoint name: evcc title, never the main device, a renamed loadpoint device wins", json.dumps(names, ensure_ascii=False))
    done(page)

    t.group("vehicle - picture of the real car")
    PHOTO = "/test/fixtures/car.png"
    pic = lambda page, slug="ex30": page.evaluate(f"(() => {{ const i = window.__card.shadowRoot.querySelector('.vehicle-block[data-vehicle={slug}] .vehicle-image img'); return i ? {{ src: i.getAttribute('src'), alt: i.alt, loaded: i.complete && i.naturalWidth > 0 }} : null; }})()")
    page, errors = card()
    t.check(pic(page) is None, "without a picture the card draws no vehicle")
    done(page)
    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_image": PHOTO})
    page.wait_for_timeout(200)
    got = pic(page)
    t.check(got == {"src": PHOTO, "alt": "EX30", "loaded": True} and not errors,
            "the configured picture above the values", json.dumps(got))
    done(page)
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30", "vehicle_image": "/test/fixtures/missing.png"})
    page.wait_for_timeout(400); settle(page)
    t.check(pic(page) is None, "a picture that does not load is dropped", json.dumps(pic(page)))
    done(page)

    MEDIA = "media-source://media_source/local/car.png"
    resolves = "window.__hass.wsCalls.filter(c => c.type === 'media_source/resolve_media').length"
    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_image": MEDIA})
    got = pic(page)
    t.check(got and got["src"] == "/test/fixtures/car.png?authSig=mock" and not errors,
            "a picture from the media library is shown through the signed address Home Assistant hands out", json.dumps(got))
    page.evaluate("window.__card._lastRenderKey = null; window.__card._render(); window.__card._render()")
    settle(page)
    t.check(page.evaluate(resolves) == 1, "the address is asked for once, not on every render", str(page.evaluate(resolves)))
    # The next page load starts with what the card kept: the signed address, so
    # the picture is in the first render without asking HA again and the
    # browser can take it from its cache, and the height the picture took, so
    # its place is kept free instead of the card jumping when it arrives.
    page.wait_for_timeout(300)
    kept = page.evaluate("JSON.parse(localStorage.getItem('evcc-card-vehicle-picture') || '{}')")
    entry = kept.get(MEDIA, {})
    t.check(entry.get("url") == "/test/fixtures/car.png?authSig=mock" and entry.get("height", 0) > 0,
            "the card keeps the signed address and the height the picture took", json.dumps(entry))
    first = page.evaluate("""async (media) => {
        const c = document.createElement('evcc-card');
        c.setConfig({ mode: 'vehicle', vehicle: 'ex30', vehicle_image: media });
        c.hass = window.__hass; document.body.appendChild(c);
        for (let i = 0; i < 40 && !c.shadowRoot.querySelector('.vehicle-block'); i++) await new Promise(r => setTimeout(r, 50));
        const box = c.shadowRoot.querySelector('.vehicle-image');
        return { src: box?.querySelector('img')?.getAttribute('src') ?? null, style: box?.getAttribute('style') ?? null,
                 lazy: box?.querySelector('img')?.getAttribute('loading') ?? null,
                 resolves: window.__hass.wsCalls.filter(c => c.type === 'media_source/resolve_media').length }; }""", MEDIA)
    t.check(first["src"] == "/test/fixtures/car.png?authSig=mock" and first["resolves"] == 1,
            "a card created later has the picture in its first render, without asking HA again", json.dumps(first))
    t.check(bool(re.fullmatch(r"min-height: \d+px", first["style"] or "")) and first["lazy"] is None,
            "its place is kept free, and the picture is not lazy loaded", json.dumps(first))
    done(page)
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30", "vehicle_image": "media-source://media_source/local/gone.png"})
    t.check(pic(page) is None and page.evaluate(resolves) == 1, "a media item that cannot be resolved shows nothing and is not asked for on every render", json.dumps(pic(page)))
    # Right after a restart of HA the first request can fail for a picture that
    # is there: a few minutes later it is asked for again.
    page.evaluate("""() => { const c = window.__card, m = c._vehicleMedia['media-source://media_source/local/gone.png'];
        m.failedAt -= 6 * 60 * 1000; c._lastRenderKey = null; c._render(); }""")
    settle(page)
    t.check(page.evaluate(resolves) == 2, "a failed request is asked again after a few minutes, the picture is not dropped for good", str(page.evaluate(resolves)))
    done(page)

    # A configured picture that cannot be shown leaves the place to the one of
    # the vehicle's image entity.
    add_image = """() => { const h = window.__hass, id = 'image.volvo_ex30_bild';
        h.entities = { ...h.entities, [id]: { entity_id: id, platform: 'volvo', device_id: 'f1c0de00volvoex30fixture000000001' } };
        h.states = { ...h.states, [id]: { entity_id: id, state: '2026-09-18T10:00:00+00:00', attributes: { entity_picture: '/test/fixtures/car.png?token=abc' } } };
        window.__card.hass = { ...h }; }"""
    for image, label in (("/test/fixtures/missing.png", "a configured path that does not load"),
                         ("media-source://media_source/local/gone.png", "a media item that cannot be resolved")):
        page = new_page(browser, 480, 1400)
        open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30", "vehicle_image": image})
        page.wait_for_timeout(400); settle(page)
        page.evaluate(add_image); page.wait_for_timeout(400); settle(page)
        got = pic(page)
        t.check(got and got["src"] == "/test/fixtures/car.png?token=abc", f"{label}: the picture of the image entity stands in", json.dumps(got))
        done(page)

    # A picture the vehicle's integration offers as an image entity is used on its own.
    page, errors = card()
    page.evaluate("""() => { const h = window.__hass, id = 'image.volvo_ex30_bild';
        h.entities = { ...h.entities, [id]: { entity_id: id, platform: 'volvo', device_id: 'f1c0de00volvoex30fixture000000001' } };
        h.states = { ...h.states, [id]: { entity_id: id, state: '2026-09-18T10:00:00+00:00', attributes: { entity_picture: '/test/fixtures/car.png?token=abc' } } };
        window.__card.hass = { ...h }; }""")
    settle(page)
    got = pic(page)
    t.check(got and got["src"] == "/test/fixtures/car.png?token=abc", "an image entity on the vehicle's device is the picture when none is configured", json.dumps(got))
    done(page)

    t.group("vehicle - pictures at the charge point and while charging")
    PLAIN, AT_LP, CHARGING = "/test/fixtures/car.png?p=plain", "/test/fixtures/car.png?p=connected", "/test/fixtures/car.png?p=charging"
    ALL = {"mode": "vehicle", "vehicle": "ex30", "vehicle_image": PLAIN, "vehicle_image_connected": AT_LP, "vehicle_image_charging": CHARGING}
    NOT_CHARGING = {"binary_sensor.evcc_openwb_charging": "off"}
    set_states = """(st) => { const h = window.__hass;
        h.states = { ...h.states, ...Object.fromEntries(Object.entries(st).map(([id, v]) => [id, { ...h.states[id], state: v }])) };
        window.__card.hass = { ...h }; }"""
    src = lambda page: (pic(page) or {}).get("src")
    for label, config, st, want in (
            ("charging at the loadpoint: the charging picture", ALL, None, CHARGING),
            ("plugged in, not charging: the picture at the charge point", ALL, NOT_CHARGING, AT_LP),
            ("not plugged in: the vehicle picture", ALL, UNPLUGGED, PLAIN),
            ("charging without a charging picture: the one at the charge point", {**ALL, "vehicle_image_charging": None}, None, AT_LP),
            ("charging with only the plain picture: that one", {**ALL, "vehicle_image_charging": None, "vehicle_image_connected": None}, None, PLAIN),
            ("plugged in with only a charging picture: the vehicle picture", {**ALL, "vehicle_image_connected": None}, NOT_CHARGING, PLAIN),
            ("a charging picture that does not load: the one at the charge point", {**ALL, "vehicle_image_charging": "/test/fixtures/missing.png"}, None, AT_LP)):
        page, errors = card(config={k: v for k, v in config.items() if v is not None}, set=st)
        page.wait_for_timeout(300); settle(page)
        # the picture that does not load is the one 404 the browser reports
        errors = [e for e in errors if "missing.png" not in e and "status of 404" not in e]
        t.check(src(page) == want and not errors, label, f"{src(page)}; {'; '.join(errors)[:150]}")
        done(page)

    # The state changes under a running card: the same element takes the next
    # picture, which was fetched ahead, so nothing jumps or blinks.
    page, errors = card(config=ALL)
    page.wait_for_timeout(300)
    page.evaluate("window.__card.shadowRoot.querySelector('.vehicle-image img').__mark = 1")
    ahead = page.evaluate("[...window.__card._vehicleImagePreloaded]")
    t.check(sorted(ahead) == sorted([AT_LP, PLAIN]), "the pictures of the other states are fetched ahead", json.dumps(ahead))
    page.evaluate(set_states, NOT_CHARGING); settle(page)
    same = page.evaluate("window.__card.shadowRoot.querySelector('.vehicle-image img').__mark === 1")
    t.check(src(page) == AT_LP and same, "charging stops: the picture at the charge point, in the same element", src(page))
    page.evaluate(set_states, UNPLUGGED); settle(page)
    t.check(src(page) == PLAIN, "unplugged: the vehicle picture, whatever the vehicle's integration says", src(page))
    page.evaluate(set_states, {"binary_sensor.evcc_openwb_connected": "on", "binary_sensor.evcc_openwb_charging": "on"}); settle(page)
    t.check(src(page) == CHARGING and not errors, "plugged in and charging again: the charging picture", src(page))
    done(page)

    # Media items: all of them are resolved with the first render, so a change
    # of state needs no request; each picture keeps its own height.
    M_CHARGING, M_AT_LP = "media-source://media_source/local/car.png", "media-source://media_source/local/ex30_off.png"
    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_image_charging": M_CHARGING, "vehicle_image_connected": M_AT_LP})
    page.wait_for_timeout(300); settle(page)
    t.check(src(page) == "/test/fixtures/car.png?authSig=mock" and page.evaluate(resolves) == 2,
            "media items: the charging picture, and the one at the charge point resolved with it", f"{src(page)}, {page.evaluate(resolves)} request(s)")
    page.evaluate(set_states, NOT_CHARGING); settle(page)
    t.check(src(page) == "/test/fixtures/ex30_off.png?authSig=mock" and page.evaluate(resolves) == 2,
            "charging stops: the picture at the charge point at once, without a new request", f"{src(page)}, {page.evaluate(resolves)} request(s)")
    page.wait_for_timeout(300)
    kept = page.evaluate("JSON.parse(localStorage.getItem('evcc-card-vehicle-picture') || '{}')")
    t.check(kept.get(M_CHARGING, {}).get("height", 0) > 0 and kept.get(M_AT_LP, {}).get("height", 0) > 0 and not errors,
            "each picture keeps the height it took", json.dumps({k: v.get("height") for k, v in kept.items()}))
    done(page)

    t.group("vehicle - commands (vehicle_actions)")
    LOCK = "lock.volvo_ex30_schloss"
    ex30 = lambda page: page.locator(block("ex30"))
    lockchip = lambda page: page.evaluate("""() => { const c = window.__card.shadowRoot.querySelector('.vehicle-block[data-vehicle=ex30] .vehicle-chip.ok, .vehicle-block[data-vehicle=ex30] .vehicle-chip.warn');
        return c ? { tag: c.tagName, text: c.textContent.trim(), cmd: c.dataset.vehicleCmd ?? null, disabled: !!c.disabled } : null; }""")
    page, errors = card()
    t.check(lockchip(page)["tag"] == "SPAN" and ex30(page).locator(".vehicle-actions").count() == 0,
            "without vehicle_actions the card only shows: lock chip without a command, no climate or action buttons", json.dumps(lockchip(page)))
    done(page)

    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_actions": True})
    t.check(lockchip(page) == {"tag": "BUTTON", "text": "Verriegelt", "cmd": "unlock", "disabled": False}, "with vehicle_actions the lock chip is the switch", json.dumps(lockchip(page)))
    ex30(page).locator("button.vehicle-chip").click(); page.wait_for_timeout(200)
    confirm = ex30(page).locator(".vehicle-confirm")
    t.check(confirm.count() == 1 and "Entriegeln?" in confirm.inner_text() and not svc(page), "unlocking asks first and sends nothing yet", confirm.inner_text() if confirm.count() else "no question")
    confirm.locator('[data-vehicle-confirm="no"]').click(); page.wait_for_timeout(200)
    t.check(ex30(page).locator(".vehicle-confirm").count() == 0 and not svc(page), "cancel sends nothing")
    ex30(page).locator("button.vehicle-chip").click(); page.wait_for_timeout(200)
    ex30(page).locator('[data-vehicle-confirm="yes"]').click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "lock", "service": "unlock", "data": {"entity_id": LOCK}}], "yes → lock.unlock", json.dumps(svc(page)[-1:]))
    t.check(lockchip(page) == {"tag": "BUTTON", "text": "Wird entriegelt …", "cmd": "unlock", "disabled": True},
            "until HA reports the lock open, the chip says the command runs", json.dumps(lockchip(page), ensure_ascii=False))
    page.evaluate(f"""() => {{ const h = window.__hass; h.states = {{ ...h.states, '{LOCK}': {{ ...h.states['{LOCK}'], state: 'unlocked' }} }}; window.__card.hass = {{ ...h }}; }}""")
    settle(page)
    t.check(lockchip(page) == {"tag": "BUTTON", "text": "Entriegelt", "cmd": "lock", "disabled": False}, "HA reports it open: the chip offers to lock", json.dumps(lockchip(page)))
    ex30(page).locator("button.vehicle-chip").click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "lock", "service": "lock", "data": {"entity_id": LOCK}}] and ex30(page).locator(".vehicle-confirm").count() == 0,
            "locking goes at once, without asking", json.dumps(svc(page)[-1:]))

    climate = ex30(page).locator(".vehicle-climate .vehicle-cmd-btn")
    t.check(climate.all_inner_texts() == ["Starten", "Stoppen"], "a start/stop pair of buttons: two buttons for the climate", json.dumps(climate.all_inner_texts()))
    climate.first.click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "button", "service": "press", "data": {"entity_id": "button.volvo_ex30_klimatisierung_starten"}}]
            and ex30(page).locator(".vehicle-confirm").count() == 0, "starting the climate goes without asking", json.dumps(svc(page)[-1:]))

    acts = ex30(page).locator(".vehicle-actions-list .vehicle-cmd-btn")
    t.check(acts.count() == 3 and not acts.first.is_visible(), "the other buttons are folded away", str(acts.count()))
    ex30(page).locator("[data-vehicle-actions]").click(); page.wait_for_timeout(200)
    names = acts.all_inner_texts()
    t.check(names == ["Blinken", "Hupen", "Hupen & Blinken"] and acts.first.is_visible(), "unfolded: the buttons by their HA names", json.dumps(names, ensure_ascii=False))
    n = len(svc(page))
    acts.nth(1).click(); page.wait_for_timeout(200)
    t.check("Hupen?" in ex30(page).locator(".vehicle-confirm").inner_text() and len(svc(page)) == n, "every other button asks first")
    ex30(page).locator('[data-vehicle-confirm="yes"]').click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "button", "service": "press", "data": {"entity_id": "button.volvo_ex30_hupen"}}], "yes → button.press", json.dumps(svc(page)[-1:]))
    t.check(not errors, "no console errors", "; ".join(errors)[:200])
    done(page)

    # A climate entity on the device: one button that follows its state, and a chip while it runs.
    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_actions": True})
    page.evaluate("""() => { const h = window.__hass, id = 'climate.volvo_ex30_klima';
        h.entities = { ...h.entities, [id]: { entity_id: id, platform: 'volvo', device_id: 'f1c0de00volvoex30fixture000000001' } };
        h.states = { ...h.states, [id]: { entity_id: id, state: 'off', attributes: {}, last_updated: new Date().toISOString() } };
        window.__card.hass = { ...h }; }""")
    settle(page)
    climate = ex30(page).locator(".vehicle-climate .vehicle-cmd-btn")
    t.check(climate.all_inner_texts() == ["Starten"], "a climate entity: one button, off → start", json.dumps(climate.all_inner_texts()))
    climate.first.click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "climate", "service": "turn_on", "data": {"entity_id": "climate.volvo_ex30_klima"}}], "→ climate.turn_on", json.dumps(svc(page)[-1:]))
    page.evaluate("""() => { const h = window.__hass, id = 'climate.volvo_ex30_klima';
        h.states = { ...h.states, [id]: { ...h.states[id], state: 'heat_cool' } }; window.__card.hass = { ...h }; }""")
    settle(page)
    chips = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .vehicle-chip')].map(c => c.textContent.trim())")
    t.check(climate.all_inner_texts() == ["Stoppen"] and "Klimatisierung an" in chips, "running: the button stops it, a chip says it runs", json.dumps([climate.all_inner_texts(), chips], ensure_ascii=False))
    done(page)

    # The sorting by class, unit and words is a guess, and a guess has to be
    # correctable: vehicle_entities names the entity of a role, switches a role
    # off and says which functions the card offers.
    t.group("vehicle - entities by hand (vehicle_entities)")
    SERVICE = "sensor.volvo_ex30_reichweite_bis_wartung"
    CHIPS   = "[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .vehicle-chip')].map(e => [e.className.replace('vehicle-chip', '').trim(), e.textContent.trim(), e.dataset.moreInfo || ''])"
    page, errors = card(set=UNPLUGGED, config={"mode": "vehicle", "vehicle": "ex30", "vehicle_entities": {"range": SERVICE}})
    info = page.evaluate(values)
    t.check(info == [["sensor.volvo_ex30_batterie", "72 %"], [SERVICE, "18525 km"], ["sensor.volvo_ex30_kilometerstand", "11503 km"]]
            and not errors, "a configured entity takes its role, even one the sorting ruled out", json.dumps(info))
    done(page)

    page, errors = card(set=UNPLUGGED, config={"mode": "vehicle", "vehicle": "ex30", "vehicle_entities": {"soc": "none", "location": "none"}})
    info = page.evaluate(values)
    got  = page.evaluate(CHIPS)
    t.check(info == [["sensor.evcc_ex30_configvehicle_soc", "52 %"], ["sensor.volvo_ex30_reichweite_bis_batterie_leer", "257 km"],
                     ["sensor.volvo_ex30_kilometerstand", "11503 km"]]
            and not any(c[2] == "device_tracker.volvo_ex30_standort" for c in got),
            "a role switched off drops its chip and falls back to what evcc knows", json.dumps([info, got], ensure_ascii=False))
    page.locator(block("ex30")).locator("[data-vehicle-details]").click(); page.wait_for_timeout(200)
    rows = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=ex30] .vehicle-detail')].map(e => e.dataset.moreInfo)")
    t.check("sensor.volvo_ex30_batterie" in rows, "the entity the role let go turns up in the details", json.dumps(rows[:4]))
    done(page)

    # A vehicle the search finds no device for: the configuration alone gives it
    # values, and the card takes them like a device's.
    ID7 = "[...window.__card.shadowRoot.querySelectorAll('.vehicle-block[data-vehicle=id7] .soc-label-row [data-more-info]')].map(e => [e.dataset.moreInfo, e.textContent.trim()])"
    page, errors = card(set=UNPLUGGED, config={"mode": "vehicle", "vehicle": "id7", "vehicle_entities": {
        "soc": "sensor.volvo_ex30_batterie", "range": "sensor.volvo_ex30_reichweite_bis_batterie_leer"}})
    info = page.evaluate(ID7)
    t.check(info == [["sensor.volvo_ex30_batterie", "72 %"], ["sensor.volvo_ex30_reichweite_bis_batterie_leer", "257 km"]]
            and page.locator(block("id7")).locator(".vehicle-hint").count() == 0 and not errors,
            "a vehicle without a device shows what the configuration names, and needs no hint", json.dumps(info))
    done(page)

    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_actions": True,
                                "vehicle_entities": {"actions": ["button.volvo_ex30_hupen", "script.gibt_es_nicht"]}})
    ex30(page).locator("[data-vehicle-actions]").click(); page.wait_for_timeout(200)
    acts = ex30(page).locator(".vehicle-actions-list .vehicle-cmd-btn")
    t.check(acts.all_inner_texts() == ["Hupen"], "exactly the configured functions; one whose entity does not exist stays out",
            json.dumps(acts.all_inner_texts()))
    page.evaluate("""() => { const h = window.__hass, id = 'script.ex30_fenster_zu';
        h.entities = { ...h.entities, [id]: { entity_id: id, platform: 'script', device_id: null, name: 'Fenster zu' } };
        h.states = { ...h.states, [id]: { entity_id: id, state: 'off', attributes: {}, last_updated: new Date().toISOString() } };
        window.__card.hass = { ...h }; }""")
    page.evaluate("""() => { const c = window.__card, cfg = { ...c._config,
        vehicle_entities: { actions: ['button.volvo_ex30_hupen', 'script.ex30_fenster_zu'] } };
        c.setConfig(cfg); c.hass = { ...window.__hass }; }""")
    settle(page)
    acts = ex30(page).locator(".vehicle-actions-list .vehicle-cmd-btn")
    if not acts.first.is_visible(): ex30(page).locator("[data-vehicle-actions]").click(); page.wait_for_timeout(200)
    t.check(acts.all_inner_texts() == ["Hupen", "Fenster zu"], "a script is a function like a button, in the configured order",
            json.dumps(acts.all_inner_texts()))
    n = len(svc(page))
    acts.nth(1).click(); page.wait_for_timeout(200)
    ex30(page).locator('[data-vehicle-confirm="yes"]').click(); page.wait_for_timeout(300)
    t.check(svc(page)[n:] == [{"domain": "script", "service": "turn_on", "data": {"entity_id": "script.ex30_fenster_zu"}}],
            "a script is turned on, a button pressed", json.dumps(svc(page)[n:]))
    done(page)

    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_actions": True, "vehicle_entities": {"actions": []}})
    t.check(ex30(page).locator(".vehicle-actions-list").count() == 0 and ex30(page).locator(".vehicle-climate").count() == 1
            and not errors, "an empty list means no functions, the climate is none of them", "")
    done(page)

    # A switch in the lock role is switched, not locked: the service follows the
    # domain of the entity the configuration named.
    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "vehicle_actions": True,
                                "vehicle_entities": {"lock": "switch.volvo_ex30_verriegelung"}})
    page.evaluate("""() => { const h = window.__hass, id = 'switch.volvo_ex30_verriegelung';
        h.entities = { ...h.entities, [id]: { entity_id: id, platform: 'volvo', device_id: 'f1c0de00volvoex30fixture000000001', name: 'Verriegelung' } };
        h.states = { ...h.states, [id]: { entity_id: id, state: 'on', attributes: {}, last_updated: new Date().toISOString() } };
        window.__card.hass = { ...h }; }""")
    settle(page)
    t.check(lockchip(page) == {"tag": "BUTTON", "text": "Verriegelt", "cmd": "unlock", "disabled": False},
            "a switch that is on reads as locked", json.dumps(lockchip(page)))
    n = len(svc(page))
    ex30(page).locator("button.vehicle-chip").click(); page.wait_for_timeout(200)
    ex30(page).locator('[data-vehicle-confirm="yes"]').click(); page.wait_for_timeout(300)
    t.check(svc(page)[n:] == [{"domain": "switch", "service": "turn_off", "data": {"entity_id": "switch.volvo_ex30_verriegelung"}}],
            "unlocking it turns the switch off", json.dumps(svc(page)[n:]))
    done(page)

    t.group("vehicle - charge plan while plugged in")
    entry = json.loads((ROOT / "test/fixtures/entity_registry.json").read_text(encoding="utf-8"))[0]["config_entry_id"]
    page, errors = card()
    fold = page.locator(block("ex30")).locator('[data-vehicle-fold="plan"]')
    plan = page.locator(block("ex30")).locator(".plan-block[data-lp]")
    previews = "window.__hass.wsCalls.filter(c => c.type === 'evcc_intg/plan_preview').length"
    t.check(fold.count() == 1 and plan.count() == 0 and "Kein Plan" in fold.inner_text() and page.evaluate(previews) == 0,
            "the plan is folded to one line (no plan yet), and folded it asks ha-evcc for no preview", fold.inner_text() if fold.count() else "missing")
    fold.click(); page.wait_for_timeout(300)
    t.check(plan.count() == 1 and plan.get_attribute("data-lp") == "openwb" and not errors,
            "unfolded, the vehicle plugged in at openwb gets the plan block of its loadpoint, also without a plan", "")
    page.evaluate("() => { window.__card._lastRenderKey = null; window.__card._render(); }"); page.wait_for_timeout(200)
    t.check(plan.count() == 1 and page.evaluate(previews) >= 1,
            "it stays unfolded through a render and now asks for the preview", f"{page.evaluate(previews)} preview call(s)")
    t.check(plan.locator("input.plan-time-input").count() == 1 and plan.locator("input.plan-soc-range").count() == 1
            and plan.locator("button.plan-btn.save").count() == 1 and plan.locator("button.plan-btn.delete").count() == 0,
            "with time, target and a save button, nothing to delete yet", "")
    t.check(plan.locator("select.plan-vehicle-select").count() == 0,
            "and no vehicle select: the card is about this vehicle and puts no other one on the loadpoint", "")
    soc = int(plan.locator("input.plan-soc-range").input_value())
    plan.locator("input.plan-time-input").fill("2030-01-04T07:00"); plan.locator("input.plan-time-input").dispatch_event("change")
    plan.locator("button.plan-btn.save").click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "evcc_intg", "service": "set_vehicle_plan",
                                "data": {"vehicle": "db:18", "soc": soc, "startdate": "2030-01-04 07:00:00", "config_entry_id": entry}}],
            "save sets the plan of this vehicle (evcc_intg.set_vehicle_plan with its evcc id)", json.dumps(svc(page)[-1:]))
    done(page)

    page, errors = card(set={"sensor.evcc_openwb_effective_plan_time": "2030-01-04T06:00:00+00:00",
                             "sensor.evcc_openwb_effective_plan_soc": "70", "binary_sensor.evcc_openwb_plan_active": "on"})
    fold = page.locator(block("ex30")).locator('[data-vehicle-fold="plan"]')
    t.check(fold.locator(".plan-badge.active").count() == 1 and "70 %" in fold.inner_text() and ":00" in fold.inner_text(),
            "folded, the line says when, how far and that it charges by plan", fold.inner_text())
    fold.click(); page.wait_for_timeout(300)
    plan = page.locator(block("ex30")).locator(".plan-block[data-lp]")
    t.check(plan.locator("input.plan-time-input").count() == 1 and plan.locator("input.plan-time-input").input_value() == "2030-01-04T07:00"
            and "70 %" in plan.locator("button.plan-soc-val").inner_text() and not errors,
            "a running plan fills the fields and says it charges by plan", plan.inner_text()[:120])
    plan.locator("button.plan-btn.delete").click(); page.wait_for_timeout(300)
    t.check(svc(page)[-1:] == [{"domain": "evcc_intg", "service": "del_vehicle_plan", "data": {"vehicle": "db:18", "config_entry_id": entry}}],
            "delete removes the plan of this vehicle (evcc_intg.del_vehicle_plan)", json.dumps(svc(page)[-1:]))
    done(page)

    page, errors = card(attrs={"select.evcc_openwb_vehicle_name": {"vehicle": {"id": "ex30", "name": "EX30", "capacity": 0}}})
    page.locator(block("ex30")).locator('[data-vehicle-fold="plan"]').click(); page.wait_for_timeout(300)
    plan = page.locator(block("ex30")).locator(".plan-block[data-lp]")
    t.check(plan.locator('input.plan-soc-range[data-kind="energy"]').count() == 1 and "kWh" in plan.inner_text(),
            "a vehicle evcc plans in kWh gets the energy target, as in the plan mode", plan.inner_text()[:120] if plan.count() else "missing")
    done(page)

    page, errors = card(set=UNPLUGGED)
    t.check(page.locator(in_card('[data-vehicle-fold="plan"]')).count() == 0 and not errors,
            "unplugged there is no plan block: ha-evcc reports the plan only through the loadpoint", "")
    done(page)

    t.group("vehicle - registries that change while no state does")
    # HA delivers the states before the entity and device registries on page
    # load; the vehicle's device is found in the registries, so a new registry
    # has to reach the card even though no state moved.
    page, errors = card(set=UNPLUGGED)
    chips = lambda: page.locator(block("ex30")).locator(".vehicle-chip").count()
    before = chips()
    page.evaluate("""() => { const h = window.__hass; window.__reg = { entities: h.entities, devices: h.devices };
        window.__card.hass = { ...h, entities: {}, devices: {} }; }""")
    page.wait_for_timeout(700)
    without = chips()
    page.evaluate("() => { window.__card.hass = { ...window.__hass, ...window.__reg }; }")
    page.wait_for_timeout(700)
    t.check(before > 0 and without == 0 and chips() == before and not errors,
            "the device goes with its registry entry and comes back with it, with the same states", f"{before} -> {without} -> {chips()} chips")
    done(page)

    t.group("vehicle - which vehicle, missing data, second instance")
    # A card that does not name its vehicle: with one vehicle it is clear, with
    # several the card asks instead of picking one of them.
    for cfg, want, label in (({"mode": "vehicle", "vehicle": "id7"}, ["id7"], "the configured vehicle"),
                             ({"mode": "vehicle", "vehicle": "EX30"}, ["ex30"], "a name compared without case"),
                             ({"mode": "vehicle", "vehicles": ["id7"]}, ["id7"], "a list of one, the shape the mode started with")):
        page, errors = card(config=cfg)
        slugs = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block')].map(b => b.dataset.vehicle)")
        t.check(slugs == want and not errors, f"vehicle option: {label}", str(slugs))
        done(page)
    page, errors = card(config={"mode": "vehicle"})
    empty = page.locator(in_card(".empty")).inner_text()
    t.check(page.locator(in_card(".vehicle-block")).count() == 0 and "Wähle das Fahrzeug" in empty and "ex30" in empty and "id7" in empty and not errors,
            "with several vehicles and none named the card asks, naming the ones that exist", empty[:150])
    done(page)
    ID7_ALL = [e for e in json.loads((ROOT / "test/fixtures/states.json").read_text(encoding="utf-8")) if "id7" in e]
    page, errors = card(config={"mode": "vehicle"}, drop=ID7_ALL)
    slugs = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block')].map(b => b.dataset.vehicle)")
    t.check(slugs == ["ex30"] and not errors, "with one vehicle in the installation the card needs no name", str(slugs))
    done(page)
    page, errors = card(config={"mode": "vehicle", "vehicle": "tesla"})
    empty = page.locator(in_card(".empty")).inner_text()
    t.check("ex30" in empty and "id7" in empty and "tesla" in empty and "kennt evcc nicht" in empty and "Wähle das Fahrzeug" not in empty,
            "an unknown vehicle is said as such, naming the ones that exist, instead of asking to pick one", empty[:200])
    done(page)
    page, errors = card(config={"mode": "vehicle", "vehicle": "ex30", "title": "Mein Volvo"})
    t.check(page.locator(block("ex30")).locator(".lp-name").inner_text().strip().upper() == "MEIN VOLVO", "title names the vehicle", "")
    done(page)
    CONFIGVEHICLE = [f"sensor.evcc_ex30_configvehicle_{k}" for k in ("soc", "range", "odometer", "limitsoc")]
    page, errors = card(set=UNPLUGGED, vehicle_device=False, drop=CONFIGVEHICLE)
    ex30 = page.locator(block("ex30"))
    hint = ex30.locator(".vehicle-hint").inner_text() if ex30.count() else "missing"
    t.check(ex30.count() == 1 and "erweiterten Fahrzeugdaten" in hint and "Admin-Passwort" in hint and ex30.locator('[data-vehicle-fold="rplan"]').count() == 1
            and ex30.locator(".lp-disabled-warn").count() == 0 and not errors,
            "without the extended vehicle data the block stays, with a hint naming option and password", hint[:200])
    done(page)
    page, errors = card(set=UNPLUGGED, vehicle_device=False, disable=CONFIGVEHICLE)
    hint = page.locator(block("ex30")).locator(".vehicle-hint").inner_text()
    t.check("deaktiviert" in hint and "Admin-Passwort" in hint and not errors,
            "sensors created but disabled: the hint says so, and that enabling needs the password", hint[:200])
    done(page)
    page, errors = card(second={"prefix": "evcc_demo_"})
    slugs = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.vehicle-block')].map(b => b.dataset.vehicle)")
    t.check(slugs == ["ex30"] and not errors, "the card stays on its own installation's vehicle", str(slugs))
    done(page)


def render_attrs():
    """RENDER_ATTRS as the source declares it, so the test cannot drift from it."""
    src = (ROOT / "src/core/constants.js").read_text(encoding="utf-8")
    m = re.search(r"export const RENDER_ATTRS = \[(.*?)\]", src, re.S)
    return sorted(re.findall(r'"([^"]+)"', m.group(1))) if m else []


def stats_period(browser, port, t):
    """`stats_period` has to steer both stats paths the same way.

    The editor writes month/year/total/none, older dashboards carry
    30d/365d/thisYear/total, and the card runs either the sessions path or the
    entity/recorder fallback depending on the ha-evcc version. Every combination
    has to land on the period the user asked for.
    """
    # config value -> (tab with the sessions API, tab on the legacy path)
    CASES = [
        ("month",    "month", "30d"),
        ("year",     "year",  "thisYear"),
        ("total",    "total", "total"),
        ("none",     "month", "total"),    # none only hides the footer
        ("30d",      "month", "30d"),
        ("365d",     "year",  "365d"),     # a rolling window, kept as configured
        ("thisYear", "year",  "thisYear"),
        (None,       "month", "total"),    # unconfigured: newest month / everything
    ]
    active = """(() => { const el = window.__card.shadowRoot.querySelector('.stats-period-tab.active');
                         return el ? (el.dataset.scope ?? el.dataset.period) : null; })()"""

    for ws, label in ((True, "sessions API"), (False, "legacy path")):
        t.group(f"stats_period - {label}")
        for value, want_ws, want_legacy in CASES:
            want = want_ws if ws else want_legacy
            config = {"mode": "stats"}
            if value: config["stats_period"] = value
            page = new_page(browser, 480, 1200)
            errors = open_card(page, port, config=config, ws=ws)
            got = page.evaluate(active)
            t.check(got == want and not errors, f"stats_period: {value or '(unset)'} selects {want}",
                    f"got {got}; {'; '.join(errors)[:120]}")
            done(page)

    # The compact footer under site/grid/flow carries the same period. `none`
    # is about this footer only, it never hides the tabs of the stats mode.
    loc = json.loads((ROOT / f"dist/locales/{LOCALE.split('-')[0]}.json").read_text(encoding="utf-8"))
    # Rounded kWh of the stat_*_charged_kwh entities in the fixtures. Distinct
    # per period, so the number shows which entity the footer actually read.
    LEGACY_KWH  = {"30d": "170", "365d": "2150", "thisYear": "1605", "total": "2527"}
    LEGACY_TKEY = {"30d": "statsPeriod30d", "365d": "statsPeriod365d", "thisYear": "statsPeriodThisYear", "total": "statsPeriodTotal"}
    # config value -> (label key with the sessions API, legacy period without it)
    FOOTER = [
        ("month",    "statsPeriodMonth", "30d"),
        ("year",     "statsPeriodYear",  "thisYear"),
        ("total",    "statsPeriodTotal", "total"),
        ("30d",      "statsPeriodMonth", "30d"),
        ("365d",     "statsPeriodYear",  "365d"),     # a rolling window on the legacy path
        ("thisYear", "statsPeriodYear",  "thisYear"),
        (None,       "statsPeriodTotal", "total"),
        ("none",     None,               None),       # hidden on both paths
    ]

    for ws, label in ((True, "sessions API"), (False, "legacy path")):
        t.group(f"stats_period - compact footer, {label}")
        for value, want_ws_key, want_legacy in FOOTER:
            config = {"mode": "site"}
            if value: config["stats_period"] = value
            page = new_page(browser, 480, 1600)
            errors = open_card(page, port, config=config, ws=ws)
            foot = page.locator(in_card(".stats-footer"))
            name = f"footer with stats_period {value or '(unset)'}"
            if want_legacy is None:
                t.check(foot.count() == 0 and not errors, f"{name}: hidden", f"found {foot.count()}")
            elif ws:
                # the label is uppercased in CSS, so compare case-insensitively
                got = page.locator(in_card(".stats-footer .sf-period")).inner_text().strip()
                want = loc[want_ws_key]
                t.check(got.casefold() == want.casefold() and not errors, f"{name}: sessions footer says {want}", f"got {got}")
            else:
                got_label = page.locator(in_card(".stats-footer .sf-period")).inner_text().strip()
                got_kwh   = page.locator(in_card(".stats-footer .sf-val")).first.inner_text().strip()
                want_label, want_kwh = loc[LEGACY_TKEY[want_legacy]], LEGACY_KWH[want_legacy]
                t.check(got_label.casefold() == want_label.casefold() and got_kwh.startswith(want_kwh) and not errors,
                        f"{name}: reads the {want_legacy} entities", f"got {got_label} / {got_kwh}")
            done(page)


def renderkey(browser, port, t):
    """The render key decides whether a hass update reaches the DOM.

    It is built from the entity states, but the card renders from attributes as
    well: the options of a select, the bounds of a number, vehicle metadata. HA
    hands out a new state object for a pure attribute change, so those have to be
    part of the key or the card keeps showing the previous options and bounds.
    """
    t.group("renderkey - attribute changes reach the DOM")
    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    page.evaluate("""() => {
      const c = window.__card, orig = c._render.bind(c);
      window.__renders = 0;
      c._render = function (...a) { window.__renders++; return orig(...a); };
      // Push a new hass object the way HA does, after mutating the state table.
      window.__push = (mut) => {
        const st = { ...window.__hass.states };
        if (mut) mut(st);
        window.__hass.states = st;
        window.__card.hass = { ...window.__hass, states: st };
      };
    }""")
    # One state change first: straight after mount _lastRenderKey is still null,
    # which would make the next update render no matter what the key says.
    page.evaluate("""() => window.__push(st => {
      const id = 'sensor.evcc_openwb_charge_power';
      st[id] = { ...st[id], state: '4242' };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__card._lastRenderKey !== null"), "a state change primes the render key")

    # HA sets `hass` on every state change in the whole system. A change to a
    # foreign entity must cost the card nothing beyond an identity check per
    # evcc entity: the key is not built and nothing renders.
    page.evaluate("""() => {
      const c = window.__card, origKey = c._buildRenderKey.bind(c);
      window.__keys = 0;
      c._buildRenderKey = function (...a) { window.__keys++; return origKey(...a); };
    }""")
    page.evaluate("window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      st['sensor.foreign_temperature'] = { entity_id: 'sensor.foreign_temperature', state: '21.5', attributes: {} };
    })""")
    page.wait_for_timeout(500)
    # The new entity moves the count, so this one update rebuilds the id list; the next does not.
    page.evaluate("""() => window.__push(st => {
      st['sensor.foreign_temperature'] = { ...st['sensor.foreign_temperature'], state: '22.0' };
    })""")
    page.wait_for_timeout(500)
    keys_foreign = page.evaluate("window.__keys")
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      st['sensor.foreign_temperature'] = { ...st['sensor.foreign_temperature'], state: '22.5' };
    })""")
    page.wait_for_timeout(500)
    t.check(page.evaluate("window.__keys") == 0 and page.evaluate("window.__renders") == 0,
            "a foreign entity change builds no key and renders nothing",
            f"keys={page.evaluate('window.__keys')} renders={page.evaluate('window.__renders')} (first two updates: {keys_foreign} keys)")
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      const id = 'sensor.evcc_openwb_charge_power';
      st[id] = { ...st[id], state: '4343' };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__keys") >= 1 and page.evaluate("window.__renders") == 1,
            "an evcc entity change still builds the key and renders once",
            f"keys={page.evaluate('window.__keys')} renders={page.evaluate('window.__renders')}")
    # The same states table pushed again is no change either.
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("() => { window.__card.hass = { ...window.__hass }; }")
    page.wait_for_timeout(500)
    t.check(page.evaluate("window.__keys") == 0, "the same states table pushed again builds no key", str(page.evaluate("window.__keys")))
    # A language change without any state change has to get through.
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("() => { window.__card.hass = { ...window.__hass, language: 'en' }; }")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__renders") == 1, "a language change alone renders", str(page.evaluate("window.__renders")))
    page.evaluate("() => { window.__card.hass = { ...window.__hass }; }")
    page.wait_for_timeout(900)

    # Only the entities the last render read count. This card shows openwb, so
    # the heating loadpoint moving is nothing to it, while the tariff sensor,
    # read past the discovery for the smart mode, is.
    reads = page.evaluate("[...window.__card._readIds]")
    t.check(0 < len(reads) < len(page.evaluate("window.__card._evccIds")) and "sensor.evcc_tariff_grid" in reads
            and not any("_wp_" in i for i in reads),
            "the render records what it read: openwb and the tariff sensor, not the heating loadpoint",
            f"{len(reads)} of {page.evaluate('window.__card._evccIds.length')} ids")
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      const id = 'sensor.evcc_wp_charge_power';
      st[id] = { ...st[id], state: '777' };
    })""")
    page.wait_for_timeout(600)
    t.check(page.evaluate("window.__keys") == 0 and page.evaluate("window.__renders") == 0,
            "a change on a loadpoint the card does not show renders nothing",
            f"keys={page.evaluate('window.__keys')} renders={page.evaluate('window.__renders')}")
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      const id = 'sensor.evcc_tariff_grid';
      st[id] = { ...st[id], state: '0.0001' };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__renders") == 1, "a change on the tariff sensor, read past the discovery, renders",
            str(page.evaluate("window.__renders")))

    # An entity outside the evcc prefix that a render reads (the vehicle mode
    # reads the vehicle's own integration) is in the read set and has to be in
    # the key as well, or the key stays the same and the update is dropped.
    page.evaluate("""() => { const c = window.__card, orig = c._renderNow.bind(c);
        c._renderNow = function () { void this._hass.states['sensor.foreign_temperature']; return orig(); };
        c._lastRenderKey = null; c._render(); c._lastRenderKey = c._buildRenderKey(c._hass); }""")
    page.wait_for_timeout(100)
    page.evaluate("window.__keys = 0; window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      st['sensor.foreign_temperature'] = { ...st['sensor.foreign_temperature'], state: '23.0' };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__renders") == 1 and "sensor.foreign_temperature=23.0" in page.evaluate("window.__card._lastRenderKey"),
            "a foreign entity the render reads is in the key: its change renders",
            f"renders={page.evaluate('window.__renders')}")

    modes = lambda: page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.mode-btn')].map(x => x.dataset.value)")
    before = modes()
    page.evaluate("window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      const id = 'select.evcc_openwb_mode';
      st[id] = { ...st[id], state: 'pv', attributes: { ...st[id].attributes, options: ['off', 'pv', 'minpv', 'now'] } };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__renders") >= 1, "changed select options trigger a render", str(page.evaluate("window.__renders")))
    t.check(modes() != before and "minpv" in modes(), "the mode buttons follow the new options", f"{before} -> {modes()}")

    slider_max = lambda: page.evaluate("""(() => { const el = window.__card.shadowRoot
        .querySelector("input[data-entity='number.evcc_openwb_limit_soc']"); return el ? el.max : null; })()""")
    t.check(slider_max() == "100", "slider starts at the fixture's bound", str(slider_max()))
    page.evaluate("window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      const id = 'number.evcc_openwb_limit_soc';
      st[id] = { ...st[id], attributes: { ...st[id].attributes, max: 80 } };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__renders") >= 1, "a changed number bound triggers a render", str(page.evaluate("window.__renders")))
    t.check(slider_max() == "80", "the slider follows the new maximum", str(slider_max()))

    # The key is a saving measure: an update that changes nothing must stay cheap.
    page.evaluate("window.__renders = 0")
    for _ in range(4):
        page.evaluate("() => window.__push(null)")
        page.wait_for_timeout(250)
    t.check(page.evaluate("window.__renders") == 0, "an update without changes still renders nothing", str(page.evaluate("window.__renders")))
    t.check(not errors, "no console errors", "; ".join(errors)[:200])
    done(page)

    # Every attribute the card reads while rendering has to be in RENDER_ATTRS,
    # otherwise its changes are invisible again. Proxying the attribute objects
    # catches every access path, including destructuring and direct lookups.
    t.group("renderkey - RENDER_ATTRS is complete")
    declared = render_attrs()
    t.check(bool(declared), "RENDER_ATTRS is readable from the source", str(declared))
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "charge_current_settings": "expanded"})
    read = page.evaluate("""(modes) => {
      const c = window.__card, hass = window.__hass, reads = new Set();
      const states = Object.fromEntries(Object.entries(hass.states).map(([id, s]) => [id, {
        ...s,
        attributes: new Proxy(s.attributes ?? {}, {
          get(target, k) { if (typeof k === 'string') reads.add(k); return target[k]; },
          has(target, k) { if (typeof k === 'string') reads.add(k); return k in target; },
        }),
      }]));
      for (const cfg of modes) {
        c.setConfig({ ...cfg, charge_current_settings: 'expanded' });
        c.hass = { ...hass, states };
        c._lastRenderKey = null;
        c._render();
      }
      return [...reads];
    }""", [mode_config(m) for m in MODES])
    unknown = sorted(set(read) - set(declared))
    t.check(not unknown, "no attribute is read that the render key ignores", f"read {len(read)}, missing from RENDER_ATTRS: {unknown}")
    unused = sorted(set(declared) - set(read))
    t.check(not unused, "RENDER_ATTRS carries no attribute the card never reads", f"never read: {unused}")
    done(page)


def lifecycle(browser, port, t):
    """Detach the same card element and attach it again.

    Lovelace re-mounts a card on a view switch, a re-order or when leaving edit
    mode. Everything `disconnectedCallback` tears down has to be rebuilt in
    `connectedCallback`, otherwise the re-mounted card is only half alive: it
    stops reacting to `evcc-plan-reset`, and it is missing from the registry the
    inline handlers of the site and flow views resolve through.
    """
    t.group("lifecycle - unmount and re-mount")
    page = new_page(browser, 480, 1200)
    errors = open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]})

    def plan_reset_works():
        """Mark the local plan state, fire the event, report whether it was cleared."""
        page.evaluate("""() => {
          window.__card._planState['openwb'] = { soc: 42 };
          window.dispatchEvent(new CustomEvent('evcc-plan-reset', { detail: { lpName: 'openwb' } }));
        }""")
        page.wait_for_timeout(1800)   # the handler waits 1500 ms before it cleans up
        return page.evaluate("window.__card._planState['openwb']?.soc ?? null") != 42

    def remount():
        page.evaluate("""() => {
          const c = window.__card, host = c.parentNode;
          host.removeChild(c);
          window.__whileDetached = { interval: !!c._countdownInterval };
          host.appendChild(c);
        }""")
        page.wait_for_timeout(300)
        return page.evaluate("window.__whileDetached")

    t.check(plan_reset_works(), "mounted: evcc-plan-reset clears the local plan state")

    detached = remount()
    t.check(detached["interval"] is False, "detached: the countdown interval is stopped", json.dumps(detached))

    t.check(plan_reset_works(), "re-mounted: evcc-plan-reset is handled again")
    t.check(page.evaluate("!!window.__card._countdownInterval"), "re-mounted: the countdown interval runs again")

    # capabilities and entry_id survive on purpose: re-probing them on every
    # re-mount would be a backend call for nothing (see the traffic rules).
    t.check(page.evaluate("window.__card._capsLoaded"), "re-mounted: capabilities are still marked as loaded", "kept")
    n_before = len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/capabilities"])
    remount()
    t.check(len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/capabilities"]) == n_before,
            "re-mounting costs no extra backend call", f"{n_before} capabilities call(s) before and after")

    # The WebSocket caches survive a re-mount: a view switch neither refetches
    # the sessions behind the footer nor shows it in its loading state.
    page2 = new_page(browser, 480, 1400)
    open_card(page2, port, mode="site")
    page2.wait_for_timeout(800)
    footer = lambda: page2.evaluate("window.__card.shadowRoot.querySelector('.stats-footer')?.textContent.trim() || ''")
    sessions_calls = lambda: len([c for c in page2.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/sessions"])
    f_before, n_before = footer(), sessions_calls()
    page2.evaluate("""() => { const c = window.__card, host = c.parentNode; host.removeChild(c); host.appendChild(c); }""")
    page2.wait_for_timeout(800)
    t.check(n_before > 0 and sessions_calls() == n_before, "re-mount within the TTL fetches the sessions again: no",
            f"{n_before} sessions call(s) before, {sessions_calls()} after")
    t.check(f_before and footer() == f_before, "the footer keeps its figures over the re-mount", f"{f_before[:40]!r} -> {footer()[:40]!r}")
    done(page2)

    for _ in range(3): remount()
    t.check(page.evaluate("!!window.__card._countdownInterval") and not errors, "repeated re-mounts leave one live card behind",
            "; ".join(errors)[:200])

    # A hass update arms the 300 ms render timer; detaching inside that window
    # must cancel it (a render on a detached element would work against a DOM
    # nobody sees), and the re-mount must pick the update up again.
    # (an entity the plan mode reads: a change to one it does not show is no update to it)
    page.evaluate("""() => {
      const c = window.__card, host = c.parentNode, id = 'sensor.evcc_openwb_effective_plan_soc';
      const st = { ...window.__hass.states, [id]: { ...window.__hass.states[id], state: '5151' } };
      window.__hass.states = st; c.hass = { ...window.__hass, states: st };
      window.__armed = !!c._renderTimer;
      host.removeChild(c);
      window.__afterDetach = { timer: !!c._renderTimer };
    }""")
    page.wait_for_timeout(500)
    t.check(page.evaluate("window.__armed") and page.evaluate("window.__afterDetach.timer") is False,
            "detach cancels a pending render", json.dumps(page.evaluate("window.__afterDetach")))
    t.check("5151" not in (page.evaluate("window.__card._lastRenderKey") or ""), "no render ran on the detached element",
            str(page.evaluate("window.__card._lastRenderKey"))[:80])
    page.evaluate("() => document.getElementById('host').appendChild(window.__card)")
    page.wait_for_timeout(500)
    t.check("5151" in (page.evaluate("window.__card._lastRenderKey") or ""), "re-mount renders the update that was pending at detach")
    t.check(not errors, "no console errors across the re-mounts", "; ".join(errors)[:200])
    done(page)

    # The site and flow views fold their detail table on a click on the flow
    # graphic. That used to be an inline onclick through a global registry, which
    # a strict Content-Security-Policy blocks; now it is a data-action in the
    # delegation, and the markup must carry no inline handler at all.
    shown = lambda: page.evaluate("""(() => { const el = window.__card.shadowRoot.querySelector('.site-table');
                                             return el ? getComputedStyle(el).display !== 'none' : null; })()""")
    for mode, target in (("site", ".flow-wrap-clickable"), ("flow", ".sankey-wrap")):
        page = new_page(browser, 480, 1400)
        errors = open_card(page, port, mode=mode)
        inline = page.evaluate("window.__card.shadowRoot.querySelectorAll('[onclick]').length")
        t.check(inline == 0, f"{mode}: no inline handler in the markup", f"{inline} element(s) with onclick")
        before = shown()
        page.locator(in_card(target)).click(); page.wait_for_timeout(300)
        t.check(before is not None and shown() != before, f"{mode}: the toggle folds the table while mounted", f"{before} -> {shown()}")
        page.evaluate("""() => { const c = window.__card, host = c.parentNode; host.removeChild(c); host.appendChild(c); }""")
        page.wait_for_timeout(300)
        before = shown()
        page.locator(in_card(target)).click(); page.wait_for_timeout(300)
        t.check(shown() != before, f"{mode}: the toggle still works after a re-mount", f"{before} -> {shown()}")
        t.check(not errors, f"{mode}: no console errors around the toggle", "; ".join(errors)[:200])
        done(page)

    # In the flow view a click on a node opens more-info and must not fold the
    # table; the delegation keeps the two apart.
    page = new_page(browser, 480, 1400)
    open_card(page, port, mode="flow")
    page.evaluate("() => { window.__moreInfo = []; window.__card.addEventListener('hass-more-info', e => window.__moreInfo.push(e.detail.entityId)); }")
    before = shown()
    page.locator(in_card(".sankey-wrap [data-more-info]")).first.click(); page.wait_for_timeout(300)
    t.check(shown() == before and len(page.evaluate("window.__moreInfo")) == 1,
            "flow: a click on a node opens more-info and leaves the table alone",
            f"table {before} -> {shown()}, more-info={page.evaluate('window.__moreInfo')}")
    done(page)


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
    # A key that moves nothing (already at the bound) must not write the same value again.
    rng.press("Home"); page.wait_for_timeout(100)
    n_at_min = len(svc(page))
    rng.press("ArrowLeft"); rng.press("ArrowLeft"); page.wait_for_timeout(100)
    t.check(len(svc(page)) == n_at_min, "arrow key at the range bound writes nothing", f"{len(svc(page)) - n_at_min} extra call(s)")
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

    # --- a click outside the CARD closes the panel too ------------------------------------
    # Nothing else ever closes it (no blur, no timeout), and an open panel keeps
    # every hass update deferred, so a tap on the rest of the dashboard has to end it.
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    t.check(page.locator(in_card(".slider-edit")).count() == 1, "panel open before a click outside the card")
    page.mouse.click(5, 5); page.wait_for_timeout(300)
    t.check(page.locator(in_card(".slider-edit")).count() == 0 and page.evaluate("window.__card._sliderEditing") is False,
            "a click outside the card closes the panel")

    # --- a hass update deferred by panel A is not lost when the same tap opens panel B ----
    page.evaluate("""() => {
      const c = window.__card, orig = c._render.bind(c);
      window.__renders = 0;
      c._render = function (...a) { window.__renders++; return orig(...a); };
    }""")
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    page.evaluate("""() => { const id = 'sensor.evcc_openwb_charge_power';
      const st = { ...window.__hass.states, [id]: { ...window.__hass.states[id], state: '4343' } };
      window.__hass.states = st; window.__card.hass = { ...window.__hass, states: st }; }""")
    t.check(page.evaluate("window.__card._pendingRender") is True and page.evaluate("window.__renders") == 0,
            "hass update is deferred while panel A is open")
    page.locator(in_card('input[data-entity="select.evcc_openwb_min_soc"] + button.slider-val')).click(); page.wait_for_timeout(200)
    t.check(page.locator(in_card(".slider-edit")).count() == 1 and page.evaluate("window.__renders") == 0,
            "tapping another value swaps the panel without rendering in between",
            f"panels={page.locator(in_card('.slider-edit')).count()} renders={page.evaluate('window.__renders')}")
    t.check(page.evaluate("window.__card._pendingRender") is True, "the deferred update is still pending behind panel B")
    page.locator(in_card("[data-edit-cancel]")).click(); page.wait_for_timeout(200)
    t.check(page.evaluate("window.__renders") == 1, "closing panel B renders the deferred update", str(page.evaluate("window.__renders")))
    t.check(page.evaluate("window.__card._pendingRender") is False, "and nothing stays pending")
    done(page)

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
    done(page)

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
    # the fixture's 5477 s at 11000 W, in hours and minutes rather than m:ss
    dur = page.locator(in_card(".plan-preview-left .plan-preview-value")).inner_text().strip()
    t.check(dur == "1 h 31 min @ 11 kW", "plan preview duration reads in hours and minutes, no m:ss", dur)
    page.locator("#host").screenshot(path=str(OUT / "plan-preview.png"))
    # evcc computes the preview with the vehicle's current precondition, which
    # the request does not carry. A changed setting reported by HA has to fetch
    # the preview again and redraw the chart, without a page reload.
    n0 = len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"])
    page.evaluate("""() => { const st = { ...window.__hass.states }, id = 'select.evcc_openwb_plan_strategy_precondition';
      st[id] = { ...st[id], state: '3600' }; window.__hass.states = st; window.__card.hass = { ...window.__hass, states: st }; }""")
    page.wait_for_timeout(1500)
    n1 = len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"])
    t.check(n1 == n0 + 1, "a changed precondition fetches the preview again", f"{n0} -> {n1} plan_preview call(s)")
    t.check(page.locator(in_card(".plan-preview svg rect")).count() > 0 and page.locator(in_card(".plan-preview-loading")).count() == 0,
            "and the chart is drawn again from the new answer")
    # The same setting again is no reason to fetch: the key holds the settings, not the render count.
    page.evaluate("() => { window.__card._lastRenderKey = null; window.__card._render(); }"); page.wait_for_timeout(800)
    n2 = len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"])
    t.check(n2 == n1, "a render with unchanged settings fetches nothing", f"{n1} -> {n2}")
    done(page)

    # --- hide_settings + slider_steps ---------------------------------------------------
    t.group("config - hide_settings / slider_steps")
    page = new_page(browser, 480, 1200)
    all_keys = ["limit_soc", "min_soc", "phases", "max_current", "min_current", "battery_boost", "solar_share", "priority", "smart_cost_limit", "smart_feed_in_priority_limit"]
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "hide_settings": all_keys})
    t.check(page.locator(in_card(".current-block")).count() == 0, "all hidden: charge settings block gone")
    t.check(page.locator(in_card(".sliders")).count() == 0, "all hidden: soc sliders gone")
    done(page)
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
    done(page)

    # The key is the ha-evcc feature the entity was discovered under, matched
    # exactly: a short key must not steer every feature ending in it. And a step
    # on a select-backed slider cannot apply, which the card has to say out loud.
    page = new_page(browser, 480, 1200)
    warnings = []
    page.on("console", lambda m: warnings.append(m.text) if m.type == "warning" else None)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"],
                                  "charge_current_settings": "expanded",
                                  "slider_steps": {"soc": 3, "max_current": 2}})
    own = page.evaluate("window.__hass.states['number.evcc_openwb_limit_soc'].attributes.step")
    got = page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"]')).get_attribute("step")
    t.check(got == str(own), "a short key does not reach a longer feature (soc leaves limit_soc alone)",
            f"step {got}, entity says {own}")
    t.check(page.locator(in_card('input[data-entity="select.evcc_openwb_max_current"]')).get_attribute("step") == "1",
            "a select-backed slider keeps walking option indexes")
    t.check(any("slider_steps.max_current" in w for w in warnings),
            "a step on a select-backed slider is reported in the console", "; ".join(warnings)[:200])
    t.check(not any("slider_steps.soc" in w for w in warnings),
            "a key that matches nothing stays quiet", "; ".join(warnings)[:200])
    done(page)

    # --- more-info on the header values (loadpoint and compact share the render) ---
    t.group("interaction - more-info on the loadpoint values")
    hook = "() => { window.__moreInfo = []; window.__card.addEventListener('hass-more-info', e => window.__moreInfo.push(e.detail.entityId)); }"
    expected = {
        ".power-value":                 "sensor.evcc_openwb_charge_power",
        ".power-current":               "sensor.evcc_openwb_charge_currents_0",
        ".vehicle-name":                "select.evcc_openwb_vehicle_name",
        '[data-live-type="soc-pct"]':   "sensor.evcc_openwb_vehicle_soc",
        ".lp-badge":                    "binary_sensor.evcc_openwb_charging",
        ".lp-remaining":                "sensor.evcc_openwb_charge_remaining_duration",
        ".session-item":                "sensor.evcc_openwb_session_energy",
    }
    for mode in ("loadpoint", "compact"):
        page = new_page(browser, 480, 1600)
        errors = open_card(page, port, config={"mode": mode, "loadpoints": ["openwb"]})
        page.evaluate(hook)
        for sel, entity in expected.items():
            el = page.locator(in_card(sel)).first
            if el.count() == 0:
                t.fail(f"{mode}: {sel} is rendered", "not found"); continue
            if mode == "compact" and sel == ".session-item":
                page.locator(in_card('button.compact-tab[data-tab="3"]')).click(); page.wait_for_timeout(100)
            attr = el.get_attribute("data-more-info")
            if attr != entity:
                t.fail(f"{mode}: {sel} carries the entity", f"data-more-info={attr}"); continue
            page.evaluate("() => { window.__moreInfo = []; }")
            el.click(force=True); page.wait_for_timeout(50)
            fired = page.evaluate("window.__moreInfo")
            t.check(fired == [entity], f"{mode}: a click on {sel} opens more-info of {entity}", json.dumps(fired))
        # The slider values keep their own action: no more-info on the tap target of a slider.
        t.check(page.locator(in_card("button.slider-val[data-more-info]")).count() == 0,
                f"{mode}: the slider values open the input panel, not more-info")
        t.check(not errors, f"{mode}: no console errors", "; ".join(errors)[:200])
        done(page)

    # Live updates of the power value and the SoC keep the attribute in place.
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    page.evaluate("() => { const c = window.__card; c._updateLiveValues(); }")
    kept = page.evaluate("""() => ['.power-value', '[data-live-type="soc-pct"]']
        .map(s => window.__card.shadowRoot.querySelector(s)?.dataset.moreInfo)""")
    t.check(all(kept), "a live update leaves the more-info attribute on the value", json.dumps(kept))
    done(page)

    # --- mode buttons mark the pressed one at once ---------------------------------
    t.group("interaction - mode buttons")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    active = lambda: page.evaluate("window.__card.shadowRoot.querySelector('.mode-btn.active')?.dataset.value")
    before = active()
    # Synchronous click and read: no hass update, no render, no round trip in between.
    now = page.evaluate("""() => { const c = window.__card;
      c.shadowRoot.querySelector('button.mode-btn[data-value="now"]').click();
      return c.shadowRoot.querySelector('.mode-btn.active')?.dataset.value; }""")
    t.check(before != "now" and now == "now", "the pressed mode button is active before HA answers", f"{before} -> {now}")
    page.wait_for_timeout(600)
    t.check(active() == "now", "and stays active once the state comes back", active())
    # A failed service call gives the mark back to the previous button.
    # The card holds its own copy of the hass object, so the stub goes there.
    page.evaluate("() => { window.__card._hass.callService = () => Promise.reject(new Error('mock: refused')); }")
    warnings = []
    page.on("console", lambda m: warnings.append(m.text) if m.type == "warning" else None)
    page.evaluate("""() => window.__card.shadowRoot.querySelector('button.mode-btn[data-value="off"]').click()""")
    page.wait_for_timeout(100)
    t.check(active() == "now", "a refused call reverts to the previous mode button", active())
    t.check(any("select_option failed" in w for w in warnings), "and says so in the console", "; ".join(warnings)[:120])
    done(page)

    # Before HA answers, a render for some other value must not take the mark
    # away again: the pressed mode has to be what the template draws until the
    # state moves, on every control with an optimistic mark.
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    page.evaluate("""() => { const c = window.__card;
      c._hass.callService = (d, s, data) => { window.__hass.serviceCalls.push({ domain: d, service: s, data }); return Promise.resolve(); };
      window.__push = (mut) => { const st = { ...window.__hass.states }; mut(st); window.__hass.states = st; c.hass = { ...window.__hass, states: st }; }; }""")
    page.locator(in_card('button.mode-btn[data-value="now"]')).click()
    page.locator(in_card('button.phase-btn[data-value="1"]')).click()
    page.evaluate("""() => window.__push(st => { const id = 'sensor.evcc_openwb_charge_power'; st[id] = { ...st[id], state: '9.9' }; })""")
    page.wait_for_timeout(600)
    r = page.evaluate("""() => { const r = window.__card.shadowRoot; return {
      mode: r.querySelector('.mode-btn.active')?.dataset.value, phase: r.querySelector('.phase-btn.active')?.dataset.value }; }""")
    t.check(r["mode"] == "now" and r["phase"] == "1", "a render before HA answers keeps the pressed mode and phase", json.dumps(r))
    # HA reports something other than the old state: that wins over the mark.
    page.evaluate("""() => window.__push(st => { const id = 'select.evcc_openwb_mode'; st[id] = { ...st[id], state: 'off' }; })""")
    page.wait_for_timeout(600)
    t.check(page.evaluate("window.__card.shadowRoot.querySelector('.mode-btn.active')?.dataset.value") == "off",
            "a state HA reports overrides the optimistic mark")
    done(page)

    # --- a focused input holds every render back ------------------------------------
    t.group("interaction - inputs hold the render")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    # The render is asked for directly, the way a WebSocket result or a plan
    # reset does, so the guard has to sit in _render() itself.
    same_after_render = lambda sel: page.evaluate("""(sel) => { const c = window.__card, before = c.shadowRoot.querySelector(sel);
        c._lastRenderKey = null; c._render();
        return { same: before === c.shadowRoot.querySelector(sel), pending: c._pendingRender }; }""", sel)
    page.locator(in_card("input.plan-time-input")).first.focus()
    r = same_after_render("input.plan-time-input")
    t.check(r["same"] and r["pending"], "a focused time input keeps its element through a render", json.dumps(r))
    page.evaluate("() => window.__card.shadowRoot.querySelector('input.plan-time-input').blur()")
    page.wait_for_timeout(50)
    r2 = page.evaluate("""() => { const c = window.__card; return { pending: c._pendingRender, focused: c._inputFocused }; }""")
    t.check(not r2["pending"] and r2["focused"] is None, "blur runs the deferred render and lifts the guard", json.dumps(r2))
    sel = page.locator(in_card("select.plan-vehicle-select")).first
    if sel.count():
        sel.focus()
        r = same_after_render("select.plan-vehicle-select")
        t.check(r["same"] and r["pending"], "a focused vehicle select keeps its element through a render", json.dumps(r))
        page.evaluate("""() => { const s = window.__card.shadowRoot.querySelector('select.plan-vehicle-select');
            s.dispatchEvent(new Event('change', { bubbles: true })); }""")
        page.wait_for_timeout(700)
        t.check(page.evaluate("!window.__card._pendingRender && !window.__card._inputFocused"),
                "a change lifts the guard and the deferred render runs")
    else:
        t.fail("a focused vehicle select keeps its element through a render", "no vehicle select rendered")
    # A slider drag holds a direct render too, not only the hass setter.
    rng = page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"]'))
    box = rng.bounding_box()
    page.mouse.move(box["x"] + 10, box["y"] + box["height"] / 2); page.mouse.down()
    r = same_after_render('input[data-entity="number.evcc_openwb_limit_soc"]')
    page.mouse.up(); page.wait_for_timeout(100)
    t.check(r["same"] and r["pending"], "a slider drag keeps its element through a direct render", json.dumps(r))
    t.check(page.evaluate("!window.__card._pendingRender && !window.__card._isDragging"), "pointerup runs the deferred render")
    # A re-mount with the guard still set must not stay deferred: detach clears it.
    page.locator(in_card("input.plan-time-input")).first.focus()
    page.evaluate("""() => { const c = window.__card, host = c.parentNode; host.removeChild(c); host.appendChild(c); }""")
    page.wait_for_timeout(500)
    t.check(page.evaluate("!window.__card._inputFocused && !window.__card._pendingRender"), "a re-mount clears the guard")
    done(page)

    # Regression: with a render pending while the dropdown is open, the pick
    # must reach HA as picked. The guard used to run the deferred render right
    # inside the change event, before the view's handler read the value, and
    # the morph had put the old state back by then.
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    page.evaluate("""() => {
      const c = window.__card;
      // HA answers late: the call goes out, the state does not move.
      c._hass.callService = (d, s, data) => { window.__hass.serviceCalls.push({ domain: d, service: s, data }); return Promise.resolve(); };
      c.shadowRoot.querySelector('select.plan-precondition-select').focus();
      const st = { ...window.__hass.states }; const id = 'sensor.evcc_openwb_charge_power';
      st[id] = { ...st[id], state: '1.111' }; window.__hass.states = st; c.hass = { ...window.__hass, states: st };
      window.__hass.serviceCalls.length = 0;
    }""")
    t.check(page.evaluate("window.__card._pendingRender"), "a render is pending while the precondition select is open")
    page.locator(in_card("select.plan-precondition-select")).select_option("1800"); page.wait_for_timeout(300)
    call = page.evaluate("window.__hass.serviceCalls.find(c => c.service === 'select_option')")
    t.check(call and call["data"]["option"] == "1800", "the picked precondition is what goes to HA, not the old state", json.dumps(call))
    t.check(page.evaluate("window.__card.shadowRoot.querySelector('select.plan-precondition-select').value") == "1800",
            "and the select keeps showing the pick until HA reports it back")
    # The same for a typed time: the value the user set is what the plan state takes.
    page.evaluate("""() => { const c = window.__card; c.shadowRoot.querySelector('input.plan-time-input').focus();
      const st = { ...window.__hass.states }; const id = 'sensor.evcc_openwb_charge_power';
      st[id] = { ...st[id], state: '2.222' }; window.__hass.states = st; c.hass = { ...window.__hass, states: st }; }""")
    page.locator(in_card("input.plan-time-input")).fill("2026-09-19T07:30")
    page.evaluate("() => window.__card.shadowRoot.querySelector('input.plan-time-input').dispatchEvent(new Event('change', { bubbles: true }))")
    page.wait_for_timeout(300)
    t.check(page.evaluate("window.__card._planState.openwb?.time") == "2026-09-19T07:30",
            "a typed plan time survives the deferred render", str(page.evaluate("window.__card._planState.openwb?.time")))
    done(page)

    # --- the charging bar outlives the render, so its pulse just goes on --------------
    t.group("interaction - charging pulse")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    r = page.evaluate("""() => { const c = window.__card;
        const before = c.shadowRoot.querySelector('.soc-fill.charging'); const a0 = before?.getAnimations()[0];
        c._lastRenderKey = null; c._render();
        const after = c.shadowRoot.querySelector('.soc-fill.charging');
        return { same: before === after, sameAnim: !!a0 && after.getAnimations()[0] === a0, state: a0?.playState }; }""")
    t.check(r["same"] and r["sameAnim"] and r["state"] == "running",
            "a re-render keeps the charging bar and its running pulse animation", json.dumps(r))
    done(page)


def editor(browser, port, t):
    """The visual editor writes the whole card config on every change.

    Two rules matter for a Lovelace editor and neither is visible in the card:
    a change must emit the complete config (not a patch), and setting a field
    back to its default must drop the key again instead of writing an empty
    string into the dashboard YAML.
    """
    t.group("editor - config emission")
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint"})

    def mount(config):
        page.evaluate("""async (config) => {
          document.querySelectorAll("evcc-card-editor").forEach(e => e.remove());
          const ed = document.createElement("evcc-card-editor");
          window.__cfg = [];
          // JSON round trip: exactly what survives into the stored dashboard config,
          // so a key set to undefined disappears here the way it does in YAML.
          ed.addEventListener("config-changed", e => window.__cfg.push(JSON.parse(JSON.stringify(e.detail.config))));
          ed.setConfig(config);
          ed.hass = window.__hass;
          document.body.appendChild(ed);
          await new Promise(r => setTimeout(r, 900));
        }""", config)

    last  = lambda: page.evaluate("window.__cfg.length ? window.__cfg[window.__cfg.length - 1] : {}")
    count = lambda: page.evaluate("window.__cfg.length")
    fld   = lambda sel: page.locator(f"evcc-card-editor {sel}")
    fm    = lambda name: page.locator(f'evcc-card-editor ha-form [data-name="{name}"]')
    cb    = lambda field, lp: page.locator(f'evcc-card-editor ha-form input[data-name="{field}"][value="{lp}"]')

    mount({"mode": "loadpoint", "hide_settings": ["priority"]})
    boxes = page.evaluate("""() => {
      const b = [...document.querySelector("evcc-card-editor").shadowRoot.querySelectorAll('ha-form input[data-name="hide_settings"]')];
      return { count: b.length, checked: b.filter(x => x.checked).map(x => x.value) };
    }""")
    t.check(boxes["count"] == 10 and boxes["checked"] == ["priority"], "existing config is reflected in the checkboxes", json.dumps(boxes))
    t.check(count() == 0, "mounting alone emits nothing", f"{count()} events")

    # --- free text ---------------------------------------------------------------
    form_before = page.evaluate("window.__form = document.querySelector('evcc-card-editor').shadowRoot.querySelector('ha-form'), !!window.__form")
    fm("title").fill("Garage")
    t.check(last().get("title") == "Garage", "title input writes config.title", json.dumps(last()))
    t.check(last().get("mode") == "loadpoint" and last().get("hide_settings") == ["priority"],
            "the emitted config is complete, not just the changed key", json.dumps(last()))
    before = count()
    fm("title").press_sequentially(" 2")
    t.check(last().get("title") == "Garage 2" and count() == before + 1 and fm("title").input_value() == "Garage 2",
            "typing on keeps the space between the words, the space alone writes nothing", f"{json.dumps(last())}, {count() - before} events")
    t.check(form_before and page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.querySelector('ha-form') === window.__form"),
            "HA's form is the same element after the changes, so focus and an open section survive", "")
    fm("title").fill("   ")
    t.check("title" not in last(), "a blank title drops the key instead of storing an empty string", json.dumps(last()))

    # --- sections ----------------------------------------------------------------
    # Display options and language/size sit in folded panels after the fields
    # that pick what the card is for. The panels are flattened, so their fields
    # write top level keys, and the title counts what is set inside.
    sec = lambda name: fld(f'ha-form details[data-section="section_{name}"]')
    order = page.evaluate("""() => [...document.querySelector("evcc-card-editor").shadowRoot.querySelector("ha-form").children]
      .map(e => e.dataset.section || e.dataset.field)""")
    t.check(order[-2:] == ["section_content", "slider_steps"],
            "the panels follow the top fields: content, then advanced", json.dumps(order))
    t.check(page.evaluate("""() => { const r = document.querySelector("evcc-card-editor").shadowRoot;
      return r.querySelector(".form-look").querySelector('ha-form details[data-section="section_look"]') !== null
        && r.querySelector(".form-look").nextElementSibling === r.querySelector(".form-disabled"); }"""),
            "language and size come last, only the disabled entities follow", "")
    t.check(sec("look").locator('[data-name="language"]').count() == 1 and sec("look").locator('[data-name="size"]').count() == 1
            and sec("content").locator('[data-name="hide_settings"]').count() > 0 and sec("content").locator('[data-name="no_plan"]').count() > 0,
            "language and size, and the display options, sit in their panels", "")
    t.check(fld('ha-form > [data-field="mode"]').count() == 1 and fld('ha-form > [data-field="loadpoint"]').count() == 1,
            "mode and loadpoint stay on top", "")
    t.check(re.search(r"\(1 \w+\)$", sec("content").locator("summary").inner_text()) and not sec("look").locator("summary").inner_text().endswith(")"),
            "a panel title counts the options set in it", f"{sec('content').locator('summary').inner_text()!r} / {sec('look').locator('summary').inner_text()!r}")
    for name in ("content", "look"):
        sec(name).locator("summary").first.click()

    # --- selects -----------------------------------------------------------------
    for sel, value in (("language", "en"), ("size", "large"), ("disabled_loadpoints", "dim"),
                       ("charge_current_settings", "expanded")):
        before = count()
        fm(sel).select_option(value)
        t.check(last().get(sel) == value and count() == before + 1,
                f"{sel} writes config.{sel} in one event", json.dumps({k: last().get(k) for k in (sel,)}))
    for sel in ("language", "size", "disabled_loadpoints"):
        fm(sel).select_option("__unset")
        t.check(sel not in last(), f"{sel} back to its default drops the key", json.dumps(last()))

    # --- checkbox groups ---------------------------------------------------------
    # A loadpoint card that draws all loadpoints still has the lists; the
    # loadpoint list itself belongs to the modes for several.
    t.check(fld('ha-form [data-name="no_pv"]').count() == 0, "no_pv has no field, it stays a YAML option", "")
    for field, a, b in (("no_plan", "openwb", "wp"), ("hide_settings", "min_soc", "phases")):
        cb(field, a).check()
        t.check(last().get(field, [])[-1:] == [a], f"{field}: checking {a} appends it", json.dumps(last().get(field)))
        cb(field, b).check()
        got = last().get(field, [])
        t.check(a in got and b in got, f"{field}: a second box adds to the list", json.dumps(got))
        cb(field, a).uncheck()
        t.check(a not in last().get(field, []) and b in last().get(field, []),
                f"{field}: unchecking removes only that entry", json.dumps(last().get(field)))
    cb("no_plan", "wp").uncheck()
    t.check("no_plan" not in last(), "emptying a checkbox group drops the key", json.dumps(last()))

    # --- one loadpoint per card ----------------------------------------------------
    # The loadpoint and plan modes pick one loadpoint, like the vehicle mode;
    # no_plan / no_pv become switches that write true. A list of several from
    # before is an option of its own and keeps working until something is picked.
    lp = fm("loadpoint")
    opts = lp.locator("option").evaluate_all("os => os.map(o => o.value)")
    t.check(opts[0] == "__unset" and "openwb" in opts and "wp" in opts and fm("loadpoints").count() == 0,
            "the loadpoint mode offers one loadpoint, the first option draws them all", json.dumps(opts))
    t.check(lp.locator('option[value="__unset"]').inner_text() == "\u26a0 Alle Ladepunkte",
            "drawing them all is marked with a warning sign", lp.locator('option[value="__unset"]').inner_text())
    lp.select_option("openwb")
    t.check(last().get("loadpoint") == "openwb" and "loadpoints" not in last(), "a pick writes config.loadpoint", json.dumps(last()))
    t.check(fm("loadpoint").locator('option[value="__unset"]').count() == 0,
            "once one is picked, all of them is no longer offered", json.dumps(fm("loadpoint").locator("option").evaluate_all("os => os.map(o => o.value)")))
    t.check(fm("disabled_loadpoints").count() == 0 and fld('ha-form input[type=checkbox][data-name="no_plan"]').count() == 1,
            "for one loadpoint: no disabled_loadpoints, no_plan is a single switch", "")
    t.check(fld('ha-form [data-name="no_pv"]').count() == 0, "no no_pv switch either", "")
    fm("no_plan").check()
    t.check(last().get("no_plan") is True, "the switch writes no_plan: true", json.dumps(last()))
    fm("no_plan").uncheck()
    t.check("no_plan" not in last(), "and off drops it again", json.dumps(last()))
    mount({"mode": "loadpoint", "loadpoints": ["openwb", "wp"], "no_plan": ["openwb"], "no_pv": ["wp"]})
    t.check(fm("loadpoint").input_value() == "__many" and fm("loadpoint").locator("option:checked").inner_text() == "\u26a0 Mehrere: openwb, wp" and count() == 0,
            "a list of several from before shows as such, unchanged", fm("loadpoint").locator("option:checked").inner_text())
    warn = fld(".form-warn .deprecated")
    t.check(warn.count() == 1 and "Künftige Versionen" in warn.inner_text() and fld(".form > div").first.locator(".deprecated").count() == 1,
            "several loadpoints: a red note on top says they go away", warn.inner_text() if warn.count() else "")
    fm("loadpoint").select_option("wp")
    t.check(last().get("loadpoint") == "wp" and "loadpoints" not in last() and "no_plan" not in last() and last().get("no_pv") is True,
            "picking one turns the lists into its switches", json.dumps(last()))
    t.check(fld(".deprecated").count() == 0, "with one loadpoint the note is gone", "")
    opts = fm("loadpoint").locator("option").evaluate_all("os => os.map(o => o.value)")
    t.check("__many" not in opts and "__unset" not in opts, "and neither the list nor all of them can be picked again", json.dumps(opts))
    mount({"mode": "loadpoint", "loadpoints": "openwb"})
    t.check(fm("loadpoint").input_value() == "openwb" and count() == 0, "the shorthand of one shows as that loadpoint, not rewritten", fm("loadpoint").input_value())
    mount({"mode": "loadpoint", "loadpoint": "openwb"})
    fm("mode").select_option("compact")
    t.check(last().get("loadpoints") == ["openwb"] and "loadpoint" not in last(), "to the compact mode the loadpoint becomes a list of one", json.dumps(last()))
    fm("mode").select_option("plan")
    t.check(last().get("loadpoint") == "openwb" and "loadpoints" not in last(), "and back to one loadpoint per card", json.dumps(last()))
    mount({"mode": "compact"})
    cb("loadpoints", "openwb").check()
    t.check(last().get("loadpoints") == ["openwb"], "the compact mode keeps the list of loadpoints", json.dumps(last()))
    mount({"mode": "loadpoint"})

    # --- mode switch re-renders the form -----------------------------------------
    # --- advanced: slider steps, folded away ---------------------------------------
    t.check(fld('ha-form details[data-section="slider_steps"]').count() == 1
            and fld('ha-form details[data-section="slider_steps"] [data-name^="slider_steps."]').count() == 5,
            "the advanced section holds a step field per number slider", "")
    fld('ha-form details[data-section="slider_steps"] summary').click()
    before = count()
    fm("slider_steps.smart_cost_limit").fill("0")
    t.check(count() == before and fm("slider_steps.smart_cost_limit").input_value() == "0",
            "a 0 on the way to 0.01 writes nothing and stays in the field", f"{count() - before} events, {fm('slider_steps.smart_cost_limit').input_value()!r}")
    fm("slider_steps.smart_cost_limit").fill("0.01")
    t.check(last().get("slider_steps") == {"smart_cost_limit": 0.01}, "a step writes config.slider_steps.<slider>", json.dumps(last()))
    fm("slider_steps.limit_soc").fill("5")
    t.check(last().get("slider_steps") == {"smart_cost_limit": 0.01, "limit_soc": 5}, "a second step adds to the map", json.dumps(last()))
    for key in ("smart_cost_limit", "limit_soc"):
        fm(f"slider_steps.{key}").fill("")
    t.check("slider_steps" not in last(), "emptied, the steps drop the option", json.dumps(last()))
    mount({"mode": "loadpoint", "slider_steps": {"limit_soc": 5, "max_current": 2}})
    t.check(fm("slider_steps.limit_soc").input_value() == "5" and count() == 0, "a configured step shows in its field", fm("slider_steps.limit_soc").input_value())
    fld('ha-form details[data-section="slider_steps"] summary').click()
    fm("slider_steps.min_soc").fill("10")
    t.check(last().get("slider_steps") == {"max_current": 2, "limit_soc": 5, "min_soc": 10},
            "a key without a field in the editor stays in the map", json.dumps(last()))

    # --- mode switch re-renders the form -----------------------------------------
    fm("mode").select_option("site")
    page.wait_for_timeout(400)
    t.check(last().get("mode") == "site", "mode select writes config.mode", json.dumps(last().get("mode")))
    t.check(fm("site_details").count() == 1 and fm("charge_current_settings").count() == 0
            and fld('ha-form details[data-section="slider_steps"]').count() == 0,
            "the form re-renders with the fields of the new mode",
            f"site_details={fm('site_details').count()} charge_current={fm('charge_current_settings').count()}")
    sec("content").locator("summary").first.click()
    fm("site_details").select_option("collapsed")
    t.check(last().get("site_details") == "collapsed", "site_details writes config.site_details", json.dumps(last()))
    fm("stats_period").select_option("month")
    t.check(last().get("stats_period") == "month", "stats_period writes config.stats_period", json.dumps(last()))
    fm("stats_period").select_option("__unset")
    t.check("stats_period" not in last(), "stats_period back to its default drops the key", json.dumps(last()))
    done(page)

    # --- stats_period: what the editor shows must be what the card does ----------
    # Unconfigured, the card follows the default of its mode; the editor says so
    # instead of preselecting an option. A legacy value keeps its own meaning and
    # is offered as such, rather than silently displaying a neighbouring one.
    t.group("editor - stats_period reflects the card")
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "stats"})
    STATS   = "document.querySelector('evcc-card-editor').shadowRoot.querySelector('ha-form [data-name=stats_period]')"
    sel_val = lambda: page.evaluate(f"{STATS}.value")
    opts    = lambda: page.evaluate(f"[...{STATS}.options].map(o => o.value)")
    loc_ed  = json.loads((ROOT / "dist/locales/en.json").read_text(encoding="utf-8"))
    for mode, default_key in (("stats", "statsPeriodMonth"), ("site", "editorStatsPeriodTotal")):
        mount({"mode": mode, "language": "en"})
        want = loc_ed["editorStatsPeriodDefault"].replace("{val}", loc_ed[default_key])
        got  = page.evaluate(f"""() => {{ const s = {STATS};
                                        return {{ value: s.value, label: s.options[s.selectedIndex].textContent.trim() }}; }}""")
        t.check(got["value"] == "__unset" and got["label"] == want,
                f"{mode}: unconfigured shows \"{want}\", not a preselected period", json.dumps(got))
        t.check(count() == 0, f"{mode}: showing the default emits nothing", f"{count()} events")
    for value in ("30d", "365d", "thisYear"):
        mount({"mode": "stats", "language": "en", "stats_period": value})
        t.check(sel_val() == value and value in opts(), f"legacy value {value} stays selected in the editor",
                f"value {sel_val()} in {opts()}")
        t.check(count() == 0, f"legacy value {value} is not rewritten on open", json.dumps(page.evaluate("window.__cfg")))
    mount({"mode": "stats", "language": "en", "stats_period": "month"})
    t.check(opts() == ["__unset", "month", "year", "total", "none"],
            "without a legacy value the list stays on the current vocabulary", json.dumps(opts()))

    fm("mode").select_option("repeatplan")
    page.wait_for_timeout(400)
    t.check(fm("repeating_plan_vehicles").count() == 2,
            "repeatplan offers the vehicles discovered from the registry",
            str(fm("repeating_plan_vehicles").count()))
    cb("repeating_plan_vehicles", "ex30").check()
    t.check(last().get("repeating_plan_vehicles") == ["ex30"], "vehicle filter writes config.repeating_plan_vehicles", json.dumps(last()))

    mount({"mode": "repeatplan", "repeating_plan_vehicles": "EX30"})
    t.check(cb("repeating_plan_vehicles", "ex30").is_checked() and count() == 0,
            "a single name is shown as a list of one, without case and without rewriting it", "")
    cb("repeating_plan_vehicles", "id7").check()
    t.check(last().get("repeating_plan_vehicles") == ["ex30", "id7"], "and a second vehicle makes it a list", json.dumps(last()))

    fm("mode").select_option("vehicle")
    page.wait_for_timeout(400)
    veh = fm("vehicle")
    t.check(veh.count() == 1 and fm("repeating_plan_vehicles").count() == 0
            and veh.locator("option").count() == 3,
            "the vehicle mode asks which vehicle the card is for, one option per discovered vehicle",
            f"{veh.count()} select, {veh.locator('option').count()} options")
    t.check(veh.input_value() == "__unset" and veh.locator("option").first.get_attribute("value") == "__unset",
            "with several vehicles nothing is preselected, the first option asks to pick one",
            veh.locator("option").first.inner_text())
    t.check(fld("select[data-vehicle-device]").count() == 0 and fld("[data-vehicle-map]").count() == 0
            and fld("input[data-vehicle-image]").count() == 0,
            "and the settings of a vehicle stay away until one is chosen", "")
    veh.select_option("id7")
    t.check(last().get("vehicle") == "id7" and last().get("mode") == "vehicle" and "vehicles" not in last(),
            "the choice writes config.vehicle", json.dumps(last()))
    t.check(fld("select[data-vehicle-device]").count() == 1 and fld("input[data-vehicle-image]").count() == 3,
            "now the device, the mapping and the three pictures belong to that vehicle", "")
    mount({"mode": "vehicle", "vehicles": "EX30"})
    t.check(fm("vehicle").input_value().lower() == "ex30" and count() == 0,
            "the list of one the mode started with is shown as that vehicle, without case and without rewriting it",
            fm("vehicle").input_value())
    fm("vehicle").select_option("__unset")
    t.check("vehicle" not in last() and "vehicles" not in last(), "back to automatic drops the old list as well", json.dumps(last()))

    mount({"mode": "vehicle", "vehicle": "ex30", "vehicle_image_charging": "/local/ex30_c.png"})
    # Device and pictures sit in folded panels below the form, closed at first,
    # their titles counting what is set inside.
    panel = lambda key: fld(f'details[data-panel="{key}"]')
    t.check(panel("vehicle_device").count() == 1 and panel("vehicle_images").count() == 1
            and not panel("vehicle_device").evaluate("d => d.open") and not panel("vehicle_images").evaluate("d => d.open"),
            "device and pictures are folded panels, closed at first", "")
    t.check(re.search(r"\(1 \w+\)$", panel("vehicle_images").locator("summary").inner_text())
            and not panel("vehicle_device").locator("summary").inner_text().endswith(")"),
            "a panel title counts the pictures set in it",
            f"{panel('vehicle_images').locator('summary').inner_text()!r} / {panel('vehicle_device').locator('summary').inner_text()!r}")
    for key in ("vehicle_device", "vehicle_images"):
        panel(key).locator("summary").click()
    page.wait_for_timeout(100)
    fld('[data-vehicle-image-clear="vehicle_image_charging"]').click()
    t.check("vehicle_image_charging" not in last() and panel("vehicle_device").evaluate("d => d.open")
            and panel("vehicle_images").evaluate("d => d.open"),
            "an open panel stays open when a change renders the editor again", json.dumps(last()))
    dev = fld("select[data-vehicle-device]")
    auto = dev.locator("option").first.inner_text()
    t.check(dev.count() == 1 and "Volvo EX30" in auto and dev.input_value() == "",
            "one device select, the automatic option names the device it found", auto)
    dev.select_option("f1c0de00companionex30fixture00002")
    t.check(last().get("vehicle_device") == "f1c0de00companionex30fixture00002", "a picked device writes config.vehicle_device", json.dumps(last()))
    dev.select_option("none")
    t.check(last().get("vehicle_device") == "none", "no device writes \"none\"", json.dumps(last()))
    dev.select_option("")
    t.check("vehicle_device" not in last(), "back to automatic drops the key again", json.dumps(last()))
    t.check(fld("ha-selector").count() == 0, "without HA's selector element the text field stands alone", "")
    img = fld('input[data-vehicle-image="vehicle_image"]')
    img.fill("/local/ex30.png"); img.dispatch_event("change")
    t.check(last().get("vehicle_image") == "/local/ex30.png", "a picture path writes config.vehicle_image", json.dumps(last()))
    clear = fld('[data-vehicle-image-clear="vehicle_image"]')
    t.check(clear.is_visible(), "a set picture has a remove button", "")
    clear.click()
    t.check("vehicle_image" not in last() and img.input_value() == "" and not clear.is_visible(),
            "the remove button drops the picture, empties the field and hides itself", json.dumps(last()))
    img.fill("/local/ex30.png"); img.dispatch_event("change")
    t.check(clear.is_visible(), "a path written by hand brings the remove button back", "")
    img.focus(); img.fill("")
    t.check("vehicle_image" not in last() and not clear.is_visible()
            and page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.activeElement?.id") == "vehicle-image",
            "emptying the field removes the picture at once, without leaving it", json.dumps(last()))
    img.fill("javascript:alert(1)"); img.dispatch_event("change")
    t.check("vehicle_image" not in last(), "a path the card would reject is not written, the key goes again", json.dumps(last()))
    # Home Assistant's media selector, stood in for by an element that keeps what it is given.
    page.evaluate("""() => { if (!customElements.get("ha-selector")) customElements.define("ha-selector", class extends HTMLElement {}); }""")
    page.wait_for_timeout(300)
    pick = "document.querySelector('evcc-card-editor').shadowRoot.querySelector('[data-vehicle-media=\"vehicle_image\"] ha-selector')"
    t.check(page.evaluate(f"(() => {{ const p = {pick}; return !!p && JSON.stringify(p.selector) === JSON.stringify({{media: {{accept: ['image/*']}}}}) && !!p.hass && p.value === undefined; }})()"),
            "once it is defined the picture is picked with HA's media selector, narrowed to images", "")
    page.evaluate(f"{pick}.dispatchEvent(new CustomEvent('value-changed', {{ detail: {{ value: {{ media_content_id: 'media-source://media_source/local/ex30.png', media_content_type: 'image/png' }} }} }}))")
    t.check(last().get("vehicle_image") == "media-source://media_source/local/ex30.png", "a picked media item writes config.vehicle_image", json.dumps(last()))
    t.check(page.evaluate(f"{pick}.value && {pick}.value.media_content_id") == "media-source://media_source/local/ex30.png"
            and fld('input[data-vehicle-image="vehicle_image"]').input_value() == "media-source://media_source/local/ex30.png",
            "the pick shows in the selector and in the text field", "")
    page.evaluate(f"{pick}.dispatchEvent(new CustomEvent('value-changed', {{ detail: {{ value: undefined }} }}))")
    t.check("vehicle_image" not in last(), "clearing the selector drops the key again", json.dumps(last()))
    page.evaluate(f"{pick}.dispatchEvent(new CustomEvent('value-changed', {{ detail: {{ value: {{ media_content_id: 'media-source://media_source/local/ex30.png', media_content_type: 'image/png' }} }} }}))")
    fld('[data-vehicle-image-clear="vehicle_image"]').click()
    t.check("vehicle_image" not in last() and page.evaluate(f"{pick}.value") is None,
            "the remove button also empties the media selector", json.dumps(last()))
    for key in ("vehicle_image_connected", "vehicle_image_charging"):
        field = fld(f'input[data-vehicle-image="{key}"]')
        field.fill("/local/ex30_lp.png"); field.dispatch_event("change")
        t.check(last().get(key) == "/local/ex30_lp.png" and "vehicle_image" not in last(), f"its own field writes config.{key}", json.dumps(last()))
        fld(f'[data-vehicle-image-clear="{key}"]').click()
        t.check(key not in last(), f"and its remove button drops {key} again", json.dumps(last()))
    cpick = "document.querySelector('evcc-card-editor').shadowRoot.querySelector('[data-vehicle-media=\"vehicle_image_charging\"] ha-selector')"
    page.evaluate(f"{cpick}.dispatchEvent(new CustomEvent('value-changed', {{ detail: {{ value: {{ media_content_id: 'media-source://media_source/local/ex30.png', media_content_type: 'image/png' }} }} }}))")
    t.check(last().get("vehicle_image_charging") == "media-source://media_source/local/ex30.png" and "vehicle_image" not in last(),
            "the charging picture has its own media selector", json.dumps(last()))
    fld('ha-form details[data-section="section_content"] summary').click()
    fm("vehicle_actions").check()
    t.check(last().get("vehicle_actions") is True, "the checkbox writes vehicle_actions: true", json.dumps(last()))
    fm("vehicle_actions").uncheck()
    t.check("vehicle_actions" not in last(), "unchecked, the key is dropped again", json.dumps(last()))
    done(page)


def contracts(browser, port, t):
    """Every writing control must call the right HA service with the right payload."""
    t.group("contracts - writing actions and their service calls")
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    last = lambda: svc(page)[-1]
    exp  = lambda domain, service, data: {"domain": domain, "service": service, "data": data}
    # the plan services name the ha-evcc instance the card shows (config_entry_id),
    # so a plan never lands on another evcc when two instances are configured
    entry = json.loads((ROOT / "test/fixtures/entity_registry.json").read_text(encoding="utf-8"))[0]["config_entry_id"]

    # releasing a slider writes through the same path as the arrow keys
    def drag_to_end(sel):
        el  = page.locator(in_card(sel))
        box = el.bounding_box()
        el.click(position={"x": box["width"] - 1, "y": box["height"] / 2})
        page.wait_for_timeout(400)

    drag_to_end('input[data-entity="number.evcc_openwb_limit_soc"]')
    t.check(last() == exp("number", "set_value", {"entity_id": "number.evcc_openwb_limit_soc", "value": 100}),
            "slider released at the max → number.set_value 100", json.dumps(last()))
    el = page.locator(in_card('input[data-entity="number.evcc_openwb_solar_share"]'))
    el.click(position={"x": 1, "y": el.bounding_box()["height"] / 2}); page.wait_for_timeout(400)
    t.check(last() == exp("number", "set_value", {"entity_id": "number.evcc_openwb_solar_share", "value": 0}),
            "solar share released at the start → number.set_value 0 (ha-evcc writes 0 to evcc)", json.dumps(last()))
    drag_to_end('input[data-entity="select.evcc_openwb_min_current"]')
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_min_current", "option": "16"}),
            "select slider released at the max → select.select_option 16", json.dumps(last()))

    page.locator(in_card('button.mode-btn[data-value="now"]')).click(); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_mode", "option": "now"}),
            "mode button → select.select_option mode=now", json.dumps(last()))
    page.locator(in_card('button.phase-btn[data-value="3"]')).click(); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_phases_configured", "option": "3"}),
            "phase button → select.select_option phases_configured=3", json.dumps(last()))
    page.locator(in_card('.alwayscharge-row button.ac-btn[data-value="once"]')).click(); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_always_charge", "option": "once"}),
            "always charge button → select.select_option always_charge=once", json.dumps(last()))
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
    page.locator(in_card("select.plan-vehicle-select")).select_option("null"); page.wait_for_timeout(400)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_vehicle_name", "option": "null"}),
            "vehicle select: guest vehicle → select.select_option vehicle_name=null", json.dumps(last()))
    page.locator(in_card("select.plan-vehicle-select")).select_option("db:18"); page.wait_for_timeout(400)

    # plan save: vehicle db:18, soc via panel, time via the datetime-local input
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.locator(in_card("input.plan-time-input")).fill("2026-09-19T07:00"); page.wait_for_timeout(300)
    page.locator(in_card("button.plan-btn.save")).click(); page.wait_for_timeout(400)
    t.check(last() == exp("evcc_intg", "set_vehicle_plan", {"vehicle": "db:18", "soc": 80, "startdate": "2026-09-19 07:00:00", "config_entry_id": entry}),
            "set plan → evcc_intg.set_vehicle_plan {vehicle, soc, startdate}", json.dumps(last()))
    done(page)

    # plan delete needs an active plan → state override
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]}, set={"binary_sensor.evcc_openwb_plan_active": "on"})
    t.check(page.locator(in_card("button.plan-btn.delete")).count() == 1, "delete button shown while a plan is active")
    page.locator(in_card("button.plan-btn.delete")).click(); page.wait_for_timeout(300)
    t.check(last() == exp("evcc_intg", "del_vehicle_plan", {"vehicle": "db:18", "config_entry_id": entry}), "delete plan → evcc_intg.del_vehicle_plan", json.dumps(last()))
    done(page)

    # A guest vehicle (vehicle select on "null") has no plan of its own: evcc plans
    # it on the loadpoint with an energy target in kWh. ha-evcc's set_plan() only
    # takes integers for the loadpoint index and the energy and drops anything
    # else without an error, so the payload has to be exactly this.
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]}, set={"select.evcc_openwb_vehicle_name": "null"})
    rng = page.evaluate("""(() => { const r = window.__card.shadowRoot.querySelector('input.plan-soc-range');
        return r ? [r.dataset.kind, r.min, r.max, r.step].join(' ') : null; })()""")
    t.check(rng == "energy 1 100 1", "guest vehicle: the plan target is in kWh, 1 to 100 in steps of 1", repr(rng))
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("25"); page.locator(in_card("[data-edit-ok]")).click()
    page.locator(in_card("input.plan-time-input")).fill("2026-09-19T07:00"); page.wait_for_timeout(300)
    label = page.locator(in_card("button.plan-soc-val")).inner_text().strip()
    page.wait_for_timeout(800)   # 500 ms preview debounce
    previews = [c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"]
    t.check(bool(previews) and previews[-1]["kind"] == "energy" and str(previews[-1]["value"]) == "25",
            "guest vehicle: the plan preview asks for kind energy with the kWh target", json.dumps(previews[-1:]))
    page.locator(in_card("button.plan-btn.save")).click(); page.wait_for_timeout(400)
    badge = page.locator(in_card(".plan-badge.planned")).count()
    t.check(last() == exp("evcc_intg", "set_loadpoint_plan", {"loadpoint": 1, "energy": 25, "startdate": "2026-09-19 07:00:00", "config_entry_id": entry})
            and label == "25 kWh" and badge == 1,
            "guest vehicle: set plan → evcc_intg.set_loadpoint_plan {loadpoint, energy, startdate}",
            f"{json.dumps(last())} label={label!r} badge={badge}")
    done(page)

    # A vehicle that reports no SoC (evcc feature "Offline") is planned in kWh as
    # well, up to its capacity, and its plan lives on the loadpoint too.
    offline = {"select.evcc_openwb_vehicle_name": {"vehicle": {"capacity": 69, "evccName": "db:18", "id": "ex30", "name": "EX30",
               "originObject": {"capacity": 69, "features": ["Offline"], "title": "EX30"}}}}
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]}, attrs=offline,
              set={"sensor.evcc_openwb_vehicle_soc": "0", "binary_sensor.evcc_openwb_plan_active": "on"})
    rng = page.evaluate("""(() => { const r = window.__card.shadowRoot.querySelector('input.plan-soc-range');
        return r ? [r.dataset.kind, r.max].join(' ') : null; })()""")
    t.check(rng == "energy 69", "vehicle without SoC: the plan target is in kWh up to its capacity", repr(rng))
    page.locator(in_card("input.plan-time-input")).fill("2026-09-19T07:00"); page.wait_for_timeout(300)
    page.locator(in_card("button.plan-btn.save")).click(); page.wait_for_timeout(400)
    t.check(last()["service"] == "set_loadpoint_plan" and last()["data"]["loadpoint"] == 1,
            "vehicle without SoC: set plan → evcc_intg.set_loadpoint_plan", json.dumps(last()))
    page.locator(in_card("button.plan-btn.delete")).click(); page.wait_for_timeout(300)
    t.check(last() == exp("evcc_intg", "del_loadpoint_plan", {"loadpoint": 1, "config_entry_id": entry}),
            "vehicle without SoC: delete plan → evcc_intg.del_loadpoint_plan", json.dumps(last()))
    done(page)

    # ha-evcc's "null" is no vehicle assigned: with a car plugged in that is evcc's
    # guest vehicle, named so in the header and picked in the vehicle select;
    # unplugged it reads "no vehicle" and the header carries no name.
    picked = lambda page: page.evaluate("""(() => { const s = window.__card.shadowRoot.querySelector('select.plan-vehicle-select');
        return s ? s.value + '=' + s.selectedOptions[0].textContent.trim() : null; })()""")
    name = lambda page: page.evaluate("""(() => { const n = window.__card.shadowRoot.querySelector('.vehicle-name');
        return n ? n.textContent.trim() : null; })()""")
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]},
              set={"select.evcc_openwb_vehicle_name": "null", "sensor.evcc_openwb_vehicle_soc": "0"})
    t.check(name(page) == "Gastfahrzeug" and picked(page) == "null=Gastfahrzeug",
            "guest vehicle: header and vehicle select read Gastfahrzeug", f"{name(page)!r} {picked(page)!r}")
    # Without a SoC evcc shows the energy charged and an energy limit (Vehicles/
    # Soc.vue, LimitEnergySelect): no SoC, no SoC markers, no SoC sliders.
    head = page.evaluate("""(() => { const r = window.__card.shadowRoot;
        return { row: r.querySelector('.soc-label-row')?.textContent.replace(/\\s+/g, ' ').trim(),
                 socMarkers: r.querySelectorAll('.soc-min-marker').length,
                 energyBar: r.querySelectorAll('.energy-track').length,
                 sliders: [...r.querySelectorAll('.sliders .slider-row')].map(x => x.querySelector('label').textContent.trim()
                          + '=' + x.querySelector('.slider-val').textContent.trim()) }; })()""")
    t.check("%" not in head["row"] and "Geladen 2.8 kWh" in head["row"] and head["socMarkers"] == 0 and head["energyBar"] == 1
            and head["sliders"] == ["Ladelimit=keins"],
            "guest vehicle: energy charged instead of a SoC, the energy limit instead of the SoC sliders", json.dumps(head))
    page.screenshot(path=str(OUT / "guest-vehicle.png"))
    done(page)
    # a SoC above zero (a charger that reads it) keeps the SoC view, as in evcc
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, set={"select.evcc_openwb_vehicle_name": "null"})
    row = page.evaluate("window.__card.shadowRoot.querySelector('.soc-label-row')?.textContent.replace(/\\s+/g, ' ').trim()")
    t.check("56 %" in (row or "") and page.locator(in_card(".energy-track")).count() == 0,
            "guest vehicle with a SoC from the charger: the SoC view stays", repr(row))
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]},
              set={"select.evcc_openwb_vehicle_name": "null", "binary_sensor.evcc_openwb_connected": "off"})
    t.check(picked(page) == "null=Kein Fahrzeug", "no car plugged in: the vehicle select reads Kein Fahrzeug", repr(picked(page)))
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]},
              set={"select.evcc_openwb_vehicle_name": "null", "binary_sensor.evcc_openwb_connected": "off"})
    t.check(name(page) is None, "no car plugged in: no vehicle name in the header", repr(name(page)))
    done(page)

    # Deleting needs no kWh target, only the 1-based evcc loadpoint index, which the
    # card resolves through the capabilities command (here: the sorted-name fallback).
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]},
              set={"select.evcc_openwb_vehicle_name": "null", "binary_sensor.evcc_openwb_plan_active": "on"})
    page.locator(in_card("button.plan-btn.delete")).click(); page.wait_for_timeout(300)
    t.check(last() == exp("evcc_intg", "del_loadpoint_plan", {"loadpoint": 1, "config_entry_id": entry}),
            "guest vehicle: delete plan → evcc_intg.del_loadpoint_plan with the loadpoint index", json.dumps(last()))
    done(page)

    # battery boost chip is only offered while the boost limit is below 100 %
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, set={"select.evcc_openwb_battery_boost_limit": "80"})
    page.locator(in_card('button.boost-activate-btn[data-entity="switch.evcc_openwb_battery_boost"]')).click(); page.wait_for_timeout(300)
    t.check(last() == exp("switch", "turn_on", {"entity_id": "switch.evcc_openwb_battery_boost"}),
            "battery boost chip (off, limit 80 %) → switch.turn_on", json.dumps(last()))
    done(page)

    # battery mode
    page = new_page(browser, 480, 900)
    open_card(page, port, mode="battery")
    page.locator(in_card('button.batt-discharge-toggle[data-entity="switch.evcc_battery_discharge_control"]')).click(); page.wait_for_timeout(300)
    t.check(last() == exp("switch", "turn_off", {"entity_id": "switch.evcc_battery_discharge_control"}),
            "discharge control (on) → switch.turn_off", json.dumps(last()))
    # the battery block renders its selects in more than one tab panel → take the visible first one
    page.locator(in_card('select.batt-inline-select[data-entity="select.evcc_priority_soc"]')).first.select_option("30"); page.wait_for_timeout(300)
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_priority_soc", "option": "30"}),
            "priority soc → select.select_option 30", json.dumps(last()))
    done(page)

    # the battery limits with the entities proposed to ha-evcc: grid charging is
    # switched on with the tariff of the moment and off through its clear button;
    # grid discharging is allowed and its limit set in one step, and only
    # disallowed again (evcc drops the limit itself)
    tab = lambda key: (page.locator(in_card(f'button.batt-tab[data-batt-tab="{key}"]')).click(), settle(page))
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True)
    tab("charge")
    page.locator(in_card('[data-batt-limit="charge"]')).click(); page.wait_for_timeout(300)
    t.check(last() == exp("number", "set_value", {"entity_id": "number.evcc_battery_grid_charge_limit", "value": 0.2}),
            "grid charging on → number.set_value with the current tariff (0.2021 → 0.2 at step 0.005)", json.dumps(last()))
    tab("discharge")
    n = len(svc(page))
    page.locator(in_card("[data-batt-discharge]")).click(); page.wait_for_timeout(400)
    calls = svc(page)[n:]
    t.check(calls == [exp("switch", "turn_on", {"entity_id": "switch.evcc_battery_grid_discharge"}),
                      exp("number", "set_value", {"entity_id": "number.evcc_battery_grid_discharge_limit", "value": 0.08})],
            "grid discharging on → switch.turn_on, then the feed-in limit at the current feed-in rate", json.dumps(calls))
    done(page)
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True, set={"number.evcc_battery_grid_charge_limit": "0.21",
              "switch.evcc_battery_grid_discharge": "on", "number.evcc_battery_grid_discharge_limit": "0.1"})
    tab("charge")
    page.locator(in_card('[data-batt-limit="charge"]')).click(); page.wait_for_timeout(300)
    t.check(last() == exp("button", "press", {"entity_id": "button.evcc_battery_grid_charge_limit"}),
            "grid charging off → button.press on the clear button", json.dumps(last()))
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_charge_limit"]')).count() == 0,
            "the slider goes at once, before HA reports the cleared limit")
    tab("discharge")
    n = len(svc(page))
    page.locator(in_card("[data-batt-discharge]")).click(); page.wait_for_timeout(400)
    calls = svc(page)[n:]
    t.check(calls == [exp("switch", "turn_off", {"entity_id": "switch.evcc_battery_grid_discharge"})],
            "grid discharging off → only switch.turn_off, evcc drops the limit", json.dumps(calls))
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_discharge_limit"]')).count() == 0,
            "the feed-in limit goes at once")
    done(page)

    # a disabled clear button of a smart cost limit is enabled in the entity registry
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"},
              disable=["button.evcc_openwb_smart_cost_limit"])
    page.locator(in_card(".lp-disabled-warn")).click(); page.wait_for_timeout(300)
    page.locator(in_card('button.disabled-enable[data-enable-entity="button.evcc_openwb_smart_cost_limit"]')).click(); page.wait_for_timeout(300)
    ws_last = page.evaluate("window.__hass.wsCalls.at(-1)")
    t.check(ws_last == {"type": "config/entity_registry/update", "entity_id": "button.evcc_openwb_smart_cost_limit", "disabled_by": None},
            "enable clear button → config/entity_registry/update disabled_by=null", json.dumps(ws_last))
    done(page)


def tariff_modes(browser, port, t):
    """no_pv mode sets and the co2 tariff variant.

    A loadpoint without solar mirrors evcc's Mode.vue: the smart mode stays only
    while a dynamic tariff is available. On the legacy mode set of evcc before
    0.316 the PV modes disappear and 'pv' is relabelled as the smart mode.
    Which tariff sensor decides that depends on whether evcc runs on prices or
    on a co2 signal, which the card reads from the smart cost limit's unit.
    """
    t.group("tariff - no_pv mode sets")
    modes = lambda page: page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.mode-btn')].map(b => b.dataset.value)")
    # The fixture is evcc 0.316 with its real 'smart' mode; the legacy set of
    # older evcc versions is put on the entity per case.
    legacy = {"select.evcc_openwb_mode": {"options": ["off", "pv", "minpv", "now"]}}

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    t.check(modes(page) == ["off", "smart", "now"], "with solar: the mode set as offered", str(modes(page)))
    # the always-charge companion sits under the buttons while the mode is smart ...
    ac = lambda: page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.alwayscharge-row .ac-btn')].map(b => b.dataset.value + (b.classList.contains('active') ? '*' : ''))")
    t.check(ac() == ["off*", "on", "once"], "smart mode: the always-charge row with its three options", str(ac()))
    # ... and goes with the entity ha-evcc marks unavailable in any other mode
    page.evaluate("""() => {
      const st = { ...window.__hass.states };
      st['select.evcc_openwb_mode'] = { ...st['select.evcc_openwb_mode'], state: 'now' };
      st['select.evcc_openwb_always_charge'] = { ...st['select.evcc_openwb_always_charge'], state: 'unavailable' };
      window.__hass.states = st;
      window.__card.hass = { ...window.__hass, states: st };
    }""")
    page.wait_for_timeout(900)
    t.check(ac() == [], "another mode: the always-charge row is gone", str(ac()))
    done(page)

    # a real smart mode + no_pv: Mode.vue keeps Smart while a tariff is available and drops it otherwise
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              set={"select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "smart", "now"], "no_pv with a price tariff: the offered smart mode stays", str(got))
    done(page)
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              set={"sensor.evcc_tariff_grid": "unknown", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "now"], "no_pv without a tariff: the smart mode is dropped", str(got))
    done(page)
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoint": "openwb", "no_pv": True},
              set={"sensor.evcc_tariff_grid": "unknown", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "now"], "no_pv: true on a card for one loadpoint does the same", str(got))
    done(page)

    t.group("tariff - no_pv on the legacy mode set")
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, attrs=legacy, set={"select.evcc_openwb_mode": "pv"})
    t.check(modes(page) == ["off", "pv", "minpv", "now"], "with solar: the full legacy set", str(modes(page)))
    done(page)

    # no_pv + a valid price tariff → [off, smart, now]; 'pv' carries the smart label
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              attrs=legacy, set={"select.evcc_openwb_mode": "pv"})
    got = modes(page)
    t.check(got == ["off", "pv", "now"], "no_pv with a price tariff: minpv is dropped", str(got))
    smart_label = page.evaluate("window.__card._t('modeSmart')")
    label = page.evaluate("window.__card.shadowRoot.querySelector('.mode-btn[data-value=\"pv\"] .mode-label').textContent.trim()")
    t.check(label == smart_label, "no_pv: the pv button is relabelled as the smart mode", f"{label!r} vs {smart_label!r}")
    done(page)

    # no_pv without any tariff → [off, now]
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              attrs=legacy, set={"sensor.evcc_tariff_grid": "unknown", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "now"], "no_pv without a tariff: no smart mode either", str(got))
    done(page)

    t.group("tariff - co2 signal instead of prices")
    # The unit on the smart cost limit is what tells the card to read tariff_co2
    # rather than tariff_grid; with a valid co2 value the smart mode comes back.
    co2_attrs = {"number.evcc_openwb_smart_cost_limit": {"unit_of_measurement": "g/kWh"}, **legacy}
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              attrs=co2_attrs, tariff="co2",
              set={"sensor.evcc_tariff_grid": "unknown", "sensor.evcc_tariff_co2": "310", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "pv", "now"], "co2 tariff: the smart mode is read from tariff_co2, not tariff_grid", str(got))
    done(page)

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              attrs=co2_attrs, tariff="co2",
              set={"sensor.evcc_tariff_grid": "0.202", "sensor.evcc_tariff_co2": "unknown", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "now"], "co2 tariff: a valid price sensor does not stand in for a missing co2 value", str(got))
    done(page)

    # Plan preview: units, label and the forecast it draws behind the plan all switch
    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]}, tariff="co2")
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.wait_for_timeout(1500)
    header = page.locator(in_card(".plan-preview-header")).inner_text()
    t.check("g/kWh" in header and "\u20ac" not in header, "co2 plan preview is priced in g/kWh, not currency", " ".join(header.split())[:160])
    avg = re.search(r"([\d.,]+)\s*g/kWh", header)
    # The fixture's co2 curve runs 180..420 g/kWh; a price average would be well below 10.
    t.check(bool(avg) and 180 <= float(avg.group(1).replace(",", ".")) <= 420,
            "the average is computed from the co2 values, not the price ones", avg.group(0) if avg else header[:80])
    bars = page.locator(in_card(".plan-preview svg rect")).count()
    t.check(bars > 0 and not errors, "co2 plan preview still renders a chart", f"{bars} bars; {'; '.join(errors)[:150]}")
    page.locator("#host").screenshot(path=str(OUT / "plan-preview-co2.png"))
    done(page)

    # Counter-check on the same fixtures: as a price tariff it is currency again.
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]})
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.wait_for_timeout(1500)
    header = page.locator(in_card(".plan-preview-header")).inner_text()
    t.check("\u20ac/kWh" in header and "g/kWh" not in header, "price tariff keeps currency per kWh", " ".join(header.split())[:160])
    done(page)


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
    done(page)


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
    done(page)


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
            page.evaluate(hook); page.evaluate("window.__card._lastRenderKey = null; window.__card._render()")   # renders synchronously
            missing |= set(page.evaluate("[...window.__missingKeys]"))
            done(page)
        t.check(not missing, f"{lang}: no untranslated keys rendered", str(sorted(missing))[:200])


def discovery(browser, port, t):
    """Entity discovery variants: custom prefix, disabled loadpoints, heating loadpoints, disabled entities."""
    t.group("discovery - prefix, disabled and heating loadpoints")
    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, rename=("evcc_", "myevcc_"))
    t.check(page.locator(in_card('button.mode-btn[data-entity="select.myevcc_openwb_mode"]')).count() > 0 and not errors,
            "custom prefix myevcc_ detected from the registry", "; ".join(errors)[:200])
    done(page)

    # A second installation whose prefix extends the first one: "evcc demo" next
    # to "evcc". Every demo entity id starts with evcc_ too, and the production
    # card would read the demo loadpoints as "demo_openwb" and "demo_wp".
    for cfg, want, label in (({"mode": "loadpoint"}, 2, "the production card shows only its own two loadpoints"),
                             ({"mode": "loadpoint", "prefix": "evcc_demo_"}, 2, "the demo card shows the two demo loadpoints")):
        page = new_page(browser, 480, 1800)
        errors = open_card(page, port, config=cfg, second={"prefix": "evcc_demo_"})
        rows = page.locator(in_card(".loadpoint")).count()
        modes = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('button.mode-btn')].map(b => b.dataset.entity)")
        own = cfg.get("prefix", "evcc_")
        clean = all(m.startswith(f"select.{own}") and (own != "evcc_" or not m.startswith("select.evcc_demo_")) for m in modes)
        t.check(rows == want and clean and not errors, f"prefix evcc_ next to evcc_demo_: {label}",
                f"rows={rows} modes={sorted(set(modes))[:4]}; {'; '.join(errors)[:120]}")
        done(page)
    for opt, want_rows, want_badge in (("hide", 1, 0), ("dim", 2, 1), ("show", 2, 0)):
        page = new_page(browser, 480, 1800)
        open_card(page, port, config={"mode": "loadpoint", "disabled_loadpoints": opt}, set={"binary_sensor.evcc_wp_disabled_in_config": "on"})
        rows, badge = page.locator(in_card(".loadpoint")).count(), page.locator(in_card(".lp-badge.disabled")).count()
        t.check(rows == want_rows and badge == want_badge, f"disabled_loadpoints: {opt} → {want_rows} loadpoint(s), {want_badge} disabled badge", f"rows={rows} badge={badge}")
        done(page)
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["wp"]})
    labels = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.slider-row label')].map(l => l.textContent.trim())")
    t.check("Ziel-Temperatur" in labels and page.locator(in_card(".plan-block")).count() == 0,
            "heating loadpoint: temperature label, no charge plan block", str(labels))
    # evcc labels a continuous device Normal / Smart / Boost (chargeModeLabel.ts)
    mode_labels = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.mode-btn')].map(b => b.dataset.value + '=' + b.querySelector('.mode-label').textContent.trim())")
    t.check(mode_labels == ["off=Normal", "smart=Smart", "now=Boost"],
            "heating loadpoint: the modes read Normal / Smart / Boost", str(mode_labels))
    done(page)
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    mode_labels = page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.mode-btn')].map(b => b.dataset.value + '=' + b.querySelector('.mode-label').textContent.trim())")
    t.check(mode_labels == ["off=Aus", "smart=Smart", "now=Schnell"],
            "charge point: the modes keep Off / Smart / Fast", str(mode_labels))
    done(page)

    # The fixture carries the whole plan entity set for the heating loadpoint, but
    # idle: plan_active off, every plan timestamp unknown. A card that simply has no
    # data to show would pass the check above, so run it again with a plan that is
    # running. ha-evcc reports the target as a temperature, the EV plan UI does not
    # apply to it and must stay away, in the loadpoint mode and in the plan mode,
    # where the block is rendered with force=true.
    heating_plan = {"binary_sensor.evcc_wp_plan_active":      "on",
                    "sensor.evcc_wp_effective_plan_soc":      "55",
                    "sensor.evcc_wp_effective_plan_time":     "2026-09-19T07:00:00+00:00",
                    "sensor.evcc_wp_plan_projected_start":    "2026-09-19T03:30:00+00:00",
                    "sensor.evcc_wp_plan_projected_end":      "2026-09-19T07:00:00+00:00"}
    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["wp"]}, set=heating_plan)
    t.check(page.locator(in_card(".plan-block")).count() == 0 and not errors,
            "heating loadpoint with an active plan: still no charge plan block", "; ".join(errors)[:200])
    done(page)

    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "plan", "loadpoints": ["wp"]}, set=heating_plan)
    previews = [c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"]
    t.check(page.locator(in_card(".plan-block")).count() == 0 and page.locator(in_card(".loadpoint")).count() == 0
            and not previews and not errors,
            "plan mode on a heating loadpoint: no block, no plan_preview call",
            f"previews={len(previews)}; " + "; ".join(errors)[:200])
    done(page)

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"},
              disable=["number.evcc_openwb_smart_cost_limit", "number.evcc_openwb_smart_feed_in_priority_limit"])
    t.check(page.locator(in_card(".smart-cost-section")).count() == 0 and page.locator(in_card(".current-block")).count() == 1,
            "disabled limit entities: sections absent, block still rendered")
    done(page)

    # --- two ha-evcc config entries ------------------------------------------------
    # ha-evcc derives the entity prefix from the config entry title, so a second
    # evcc instance brings a second prefix AND a second entry id. Prefix and entry
    # id have to come from the same entry, otherwise the card shows one
    # installation and asks the other one for forecast, sessions and plan previews.
    t.group("discovery - two ha-evcc instances")
    first_entry = json.loads((ROOT / "test/fixtures/entity_registry.json").read_text(encoding="utf-8"))[0]["config_entry_id"]
    SECOND = "SECOND_ENTRY_ID"
    second_first = {"prefix": "evcc2_", "entryId": SECOND, "first": True}
    second_last  = {"prefix": "evcc2_", "entryId": SECOND}

    def detected(config, second):
        page = new_page(browser, 480, 1200)
        errors = open_card(page, port, config=config, second=second)
        out = {
            "prefix": page.evaluate("window.__card._getPrefix()"),
            "entryId": page.evaluate("window.__card._entryId"),
            "wsEntryIds": sorted({c.get("entry_id") for c in page.evaluate("window.__hass.wsCalls")
                                  if str(c["type"]).startswith("evcc_intg/") and c.get("entry_id")}),
            "errors": errors,
        }
        done(page)
        return out

    d = detected({"mode": "loadpoint"}, None)
    t.check(d["prefix"] == "evcc_" and d["entryId"] == first_entry,
            "a single instance is unchanged", json.dumps({k: d[k] for k in ("prefix", "entryId")}))

    d = detected({"mode": "loadpoint"}, second_last)
    t.check(d["prefix"] == "evcc_" and d["entryId"] == first_entry,
            "two instances, no configured prefix: the first registry entry wins", json.dumps({k: d[k] for k in ("prefix", "entryId")}))

    d = detected({"mode": "loadpoint", "prefix": "evcc2_"}, second_last)
    t.check(d["prefix"] == "evcc2_" and d["entryId"] == SECOND,
            "configured prefix picks the entry id of the same instance", json.dumps({k: d[k] for k in ("prefix", "entryId")}))
    t.check(d["wsEntryIds"] == [SECOND],
            "the WebSocket commands address that instance, not the other one", json.dumps(d["wsEntryIds"]))

    d = detected({"mode": "loadpoint", "prefix": "evcc_"}, second_first)
    t.check(d["prefix"] == "evcc_" and d["entryId"] == first_entry,
            "registry order does not decide when a prefix is configured", json.dumps({k: d[k] for k in ("prefix", "entryId")}))
    t.check(d["wsEntryIds"] == [first_entry],
            "and the WebSocket commands follow the configured instance", json.dumps(d["wsEntryIds"]))
    t.check(not d["errors"], "no console errors with two instances present", "; ".join(d["errors"])[:200])

    # The registry is probed once. A prefix set afterwards (editor, YAML reload)
    # must still move the entry id along, or the entities come from one
    # installation and forecast/sessions/plan previews from the other.
    page = new_page(browser, 480, 1200)
    errors = open_card(page, port, config={"mode": "loadpoint"}, second=second_last)
    page.evaluate("() => { window.__hass.wsCalls.length = 0; window.__card.setConfig({ mode: 'loadpoint', prefix: 'evcc2_' }); }")
    page.wait_for_timeout(900)
    after = {
        "prefix": page.evaluate("window.__card._getPrefix()"),
        "entryId": page.evaluate("window.__card._entryId"),
        "wsEntryIds": sorted({c.get("entry_id") for c in page.evaluate("window.__hass.wsCalls")
                              if str(c["type"]).startswith("evcc_intg/") and c.get("entry_id")}),
        "probes": len([c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "config/entity_registry/list"]),
    }
    t.check(after["prefix"] == "evcc2_" and after["entryId"] == SECOND,
            "a prefix configured after the probe re-selects the entry id", json.dumps({k: after[k] for k in ("prefix", "entryId")}))
    t.check(after["wsEntryIds"] == [SECOND], "and the WebSocket commands switch to that entry", json.dumps(after["wsEntryIds"]))
    t.check(after["probes"] == 0, "without a second registry call", str(after["probes"]))
    t.check(not errors, "no console errors across the prefix change", "; ".join(errors)[:200])
    done(page)


def stable_height(browser, port, t):
    """flow, grid and site keep their height while the power moves: a dashboard
    reflows every time a card changes its height. Rows and chips of what the
    installation has stay, without power dimmed; grid and battery change side
    (table) or say the direction (grid mode); the Sankey diagram has a fixed
    height per installation."""
    t.group("stable height - flow, grid, site")
    states = {
        "night":   {"sensor.evcc_pv_power": "0", "sensor.evcc_grid_power": "800", "sensor.evcc_battery_power": "600", "sensor.evcc_home_power": "1400",
                    "sensor.evcc_openwb_charge_power": "0", "sensor.evcc_wp_charge_power": "0"},
        "noon":    {"sensor.evcc_pv_power": "8000", "sensor.evcc_grid_power": "-3000", "sensor.evcc_battery_power": "-2500", "sensor.evcc_home_power": "2500",
                    "sensor.evcc_openwb_charge_power": "0", "sensor.evcc_wp_charge_power": "0"},
        "busy":    {"sensor.evcc_pv_power": "9000", "sensor.evcc_grid_power": "1500", "sensor.evcc_battery_power": "1000", "sensor.evcc_home_power": "800",
                    "sensor.evcc_openwb_charge_power": "11000", "sensor.evcc_wp_charge_power": "2000"},
        "quiet":   {"sensor.evcc_pv_power": "500", "sensor.evcc_grid_power": "0", "sensor.evcc_battery_power": "0", "sensor.evcc_home_power": "500",
                    "sensor.evcc_openwb_charge_power": "0", "sensor.evcc_wp_charge_power": "0"},
    }
    for mode in ("flow", "grid", "site"):
        # grid: grid and battery name the direction, the longer label may wrap
        # their section on a card of about 400 px or less (WebKit's wider
        # glyphs already do at 400 px)
        for width in ((520,) if mode == "grid" else (300, 400)):
            heights = {}
            for name, st in states.items():
                page = new_page(browser, 480, 1400)
                open_card(page, port, mode=mode, set=st, width=width)
                heights[name] = page.evaluate("Math.round(document.querySelector('evcc-card').getBoundingClientRect().height)")
                done(page)
            t.check(len(set(heights.values())) == 1, f"{mode} at {width} px: the same height in every state", json.dumps(heights))

    # the table: idle rows dimmed, grid and battery on the side the power flows
    page = new_page(browser, 480, 1400)
    rows = lambda sec: page.locator(in_card(f".site-section >> nth={sec}")).locator(".site-row").evaluate_all(
        "els => els.map(e => [e.querySelector('.site-row-name').textContent.trim(), e.classList.contains('site-row-idle')])")
    open_card(page, port, mode="site", set=states["noon"])
    out = dict(rows(1))
    t.check(out.get("Einspeisung") is False and any(k.startswith("Batterie laden") for k in out),
            "exporting and charging: grid and battery among the consumers", json.dumps(out))
    t.check(out.get("Ladepunkt") is True and any(k.startswith("openwb") and v for k, v in out.items()),
            "loadpoints without power stay, dimmed", json.dumps(out))
    open_card(page, port, mode="site", set=states["quiet"])
    inn = dict(rows(0))
    t.check(inn.get("Netz") is True and any(k.startswith("Batterie –") and v for k, v in inn.items()),
            "idle grid and battery: in the generation section, dimmed", json.dumps(inn))
    done(page)

    # grid mode: a section of its own for grid and battery
    page = new_page(browser, 480, 1400)
    open_card(page, port, mode="grid", set=states["noon"] | {"sensor.evcc_battery_1_power": "0", "sensor.evcc_battery_1_soc": "0"})
    labels = page.locator(in_card(".s2-section-label")).all_inner_texts()
    t.check([l.upper() for l in labels] == ["ERZEUGUNG", "NETZ & BATTERIE", "VERBRAUCH"], "grid mode: three sections", str(labels))
    stack = page.locator(in_card(".s2-section >> nth=1")).locator(".s2-chip").all_inner_texts()
    t.check(len(stack) == 3 and "Einspeisung" in stack[0] and "entlädt 2.9 kW · 30 %" in stack[1] and "bereit" in stack[2],
            "grid and battery say the direction, each battery too", str(stack))
    t.check(page.locator(in_card(".s2-section >> nth=2")).locator(".s2-chip.s2-idle").count() == 2, "idle loadpoints dimmed")
    open_card(page, port, mode="grid", set=states["night"] | {"sensor.evcc_pv_power": "0"})
    t.check(page.locator(in_card(".s2-pv-badge")).count() == 1, "the solar share badge stays")
    done(page)

    # ha-evcc creates battery_0 to battery_3 up front: an index without values is no battery
    gone = {"sensor.evcc_battery_1_power": "unknown", "sensor.evcc_battery_1_soc": "unknown"}
    page = new_page(browser, 480, 1400)
    open_card(page, port, mode="site", set=states["noon"] | gone)
    names = page.locator(in_card(".site-row-name")).all_inner_texts()
    t.check(not any(n.startswith("Batterie 1") or n.startswith("Batterie 2") for n in names),
            "table: a battery index without values is left out, one battery has no sub-rows", str(names))
    open_card(page, port, mode="grid", set=states["noon"] | gone)
    stack = page.locator(in_card(".s2-section >> nth=1")).locator(".s2-chip").all_inner_texts()
    t.check(len(stack) == 2 and stack[1].startswith("Batterie laden"), "grid mode: one battery chip", str(stack))
    done(page)


def flow_labels(browser, port, t):
    """Flow labels must stay readable when the bands get thin.

    Sankey nodes have a minimum height, so with small values the node centres
    move closer together than the labels are tall and the texts print on top of
    each other. The check is geometric: on each side, no label box may reach
    into the one below it.
    """
    # Everything below a tenth of a kW, on both sides: PV and grid feeding a
    # house, a car, a heating loadpoint (which carries a temperature sub-label)
    # and the home battery (which carries a SoC). pv_power and battery_power
    # have per-device counterparts in the fixture, which the flow block sums up
    # in their place, so those carry the small values as well.
    SMALL = {"sensor.evcc_pv_power": "120", "sensor.evcc_pv_0_power": "50", "sensor.evcc_pv_1_power": "70",
             "sensor.evcc_grid_power": "90", "sensor.evcc_home_power": "70",
             "sensor.evcc_battery_power": "-60", "sensor.evcc_battery_0_power": "-60",
             "sensor.evcc_openwb_charge_power": "0.08", "sensor.evcc_wp_charge_power": "0.03"}
    # Label boxes in SVG user units, per side: producers are the right-aligned
    # texts, consumers the left-aligned ones.
    boxes = """(() => {
      const svg = window.__card.shadowRoot.querySelector('.sankey-wrap svg');
      const by = { end: [], start: [] };
      for (const el of svg.querySelectorAll('text')) {
        const b = el.getBBox();
        (by[el.getAttribute('text-anchor')] ?? []).push({ text: el.textContent.trim(), top: b.y, bottom: b.y + b.height });
      }
      for (const k of Object.keys(by)) by[k].sort((a, b) => a.top - b.top);
      return by; })()"""

    for label, overrides in (("default fixture", None), ("small values", SMALL)):
        t.group(f"flow - label spacing, {label}")
        page = new_page(browser, 480, 1200)
        errors = open_card(page, port, config={"mode": "flow"}, set=overrides)
        got = page.evaluate(boxes)
        for side, name in (("end", "producers"), ("start", "consumers")):
            rows = got[side]
            overlaps = [f'{rows[i]["text"]} / {rows[i + 1]["text"]}'
                        for i in range(len(rows) - 1) if rows[i + 1]["top"] < rows[i]["bottom"]]
            t.check(len(rows) >= 2 and not overlaps and not errors,
                    f"{label}: {name} labels keep their distance",
                    f"{len(rows)} labels, overlapping: {overlaps}; {'; '.join(errors)[:120]}")
        page.locator("#host").screenshot(path=str(OUT / f"flow-{'small' if overrides else 'default'}.png"))
        done(page)


def card_api(browser, port, t):
    """The methods Home Assistant expects on a custom card.

    getCardSize() feeds the masonry layout (one unit is 50 px). Without it HA
    assumes a single row for everything from the compact line to a debug dump.
    The numbers live in CARD_SIZES; the checks pin the contract, not the values:
    never 0, never undefined, larger for a taller mode, and scaling with the
    number of loadpoints where the card repeats a block per loadpoint.
    """
    t.group("cardapi - getCardSize")
    page = new_page(browser, 480, 2400)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})

    # A rendered card reports its own height. Anything else is an estimate that a
    # configuration can invalidate: `site_details: collapsed` and
    # `stats_period: none` together take a site card from 12 units down to 3, and
    # a card that reports 12 while being 3 tall leaves a gap in the sections grid.
    MEASURED = [
        ({"mode": "site"}, "site, everything shown"),
        ({"mode": "site", "site_details": "collapsed", "stats_period": "none"}, "site, table and footer off"),
        ({"mode": "flow", "site_details": "collapsed", "stats_period": "none"}, "flow, table and footer off"),
        ({"mode": "grid", "stats_period": "none", "size": "medium"}, "grid, scaled up"),
        ({"mode": "loadpoint", "loadpoints": ["openwb"], "size": "medium"}, "a scaled loadpoint"),
        ({"mode": "debug"}, "debug"),
    ]
    sizes = {}
    for cfg, label in MEASURED:
        p2 = new_page(browser, 480, 2400)
        open_card(p2, port, config=cfg)
        real = p2.locator(in_card("ha-card")).bounding_box()["height"] / 50
        size = p2.evaluate("window.__card.getCardSize()")
        sizes[label] = size
        t.check(size >= real - 0.01 and size - real < 1.5,
                f"the reported size matches the rendered height: {label}",
                f"gemeldet={size} real={real:.1f}")
        done(p2)

    # While the translations load, the shadow root holds the loading placeholder,
    # an ha-card of about 70 px. A relayout in that moment must get the estimate,
    # not a measurement of the placeholder.
    ph = page.evaluate("""(() => {
      const c = window.__card;
      c._translationsReady = false; c.shadowRoot.innerHTML = ""; c._render();
      const placeholder = c.shadowRoot.querySelector("ha-card .loading") !== null;
      const during = c.getCardSize();
      const estimate = c._estimatedCardSize();
      c._translationsReady = true; c._lastRenderKey = null; c._render();
      return { placeholder, during, estimate, after: c.getCardSize() };
    })()""")
    t.check(ph["placeholder"] and ph["during"] == ph["estimate"] and ph["estimate"] > 2,
            "the loading placeholder is not measured, the estimate answers instead", json.dumps(ph))
    t.check(sizes["site, table and footer off"] * 2 < sizes["site, everything shown"],
            "a collapsed site card reports a fraction of the full one", json.dumps(sizes))

    # The estimate only has to carry the moment before the first render, but it
    # must not be wildly off either, and it must answer without hass.
    est = page.evaluate("""(() => {
      const out = {};
      for (const [name, cfg] of [
        ["site",           { mode: "site" }],
        ["site collapsed", { mode: "site", site_details: "collapsed", stats_period: "none" }],
        ["flow",           { mode: "flow" }],
        ["loadpoint",      { mode: "loadpoint", loadpoints: ["openwb"] }],
        ["two loadpoints", { mode: "loadpoint", loadpoints: ["openwb", "wp"] }],
        ["debug",          { mode: "debug" }],
      ]) {
        const c = document.createElement("evcc-card");
        c.setConfig(cfg);
        out[name] = c.getCardSize();
      }
      return out;
    })()""")
    bad = {m: v for m, v in est.items() if not isinstance(v, (int, float)) or v < 1}
    t.check(not bad, "an unrendered card estimates a usable size for every config",
            f"unbrauchbar: {bad}" if bad else json.dumps(est))
    t.check(est["site collapsed"] < est["site"], "the estimate drops the table and the footer when they are off",
            json.dumps(est))
    t.check(est["two loadpoints"] == 2 * est["loadpoint"], "the estimate scales with the loadpoint count",
            json.dumps(est))
    t.check(not errors, "no console errors while sizing", "; ".join(errors)[:200])

    t.group("cardapi - card picker registration")
    entry = page.evaluate("""(() => (window.customCards || []).find(c => c.type === "evcc-card") || null)()""")
    t.check(entry is not None, "the card registers itself in window.customCards", json.dumps(entry))
    if entry:
        missing = [k for k in ("type", "name", "description", "documentationURL") if not entry.get(k)]
        t.check(not missing, "the picker entry carries name, description and a documentation link",
                f"fehlt: {missing}" if missing else entry.get("documentationURL"))
        t.check(entry.get("preview") is True, "the picker renders a live preview", json.dumps(entry.get("preview")))

    # The preview runs on any instance, including one without ha-evcc at all.
    # It must draw the empty state rather than throw, or the picker breaks.
    stub = new_page(browser, 480, 900)
    stub_errors = open_card(stub, port, config={**page.evaluate("window.__card.constructor.getStubConfig()"),
                                                "prefix": "no_evcc_here_"})
    drawn = stub.locator(in_card("ha-card")).count() > 0
    t.check(drawn and not stub_errors, "the stub config renders without any evcc entity present",
            "; ".join(stub_errors)[:200] or f"ha-card={drawn}")
    done(stub)

    stubs = page.evaluate("""(() => { const C = window.__card.constructor, h = window.__hass;
      return { none: C.getStubConfig(), here: C.getStubConfig(h),
               one: C.getStubConfig({ ...h, entities: Object.fromEntries(Object.entries(h.entities).filter(([id]) => !id.includes("_wp_"))),
                                         states: Object.fromEntries(Object.entries(h.states).filter(([id]) => !id.includes("_wp_"))) }) }; })()""")
    t.check(stubs["none"] == {"mode": "loadpoint"}, "without hass the stub is the plain loadpoint card", json.dumps(stubs["none"]))
    t.check(stubs["here"] == {"mode": "loadpoint", "loadpoint": "openwb"}, "with several loadpoints a new card starts on the first", json.dumps(stubs["here"]))
    t.check(stubs["one"] == {"mode": "loadpoint"}, "with one loadpoint it is left to the card", json.dumps(stubs["one"]))

    t.group("cardapi - getEntitySuggestion")
    sug = page.evaluate("""(() => {
      const fn = (window.customCards || []).find(c => c.type === "evcc-card")?.getEntitySuggestion;
      if (!fn) return { missing: true };
      const hass = window.__hass;
      return {
        loadpoint: fn(hass, "sensor.evcc_openwb_charge_power"),
        site:      fn(hass, "sensor.evcc_grid_power"),
        foreign:   fn(hass, "sensor.some_other_integration_power"),
        unknown:   fn(hass, "sensor.evcc_openwb_not_a_feature"),
        meter:     fn(hass, "switch.evcc_ex30_repeating_plan_2"),
      };
    })()""")
    t.check(not sug.get("missing"), "the picker entry carries getEntitySuggestion")
    if not sug.get("missing"):
        lp = sug["loadpoint"] or []
        ok_lp = (isinstance(lp, list) and len(lp) >= 1
                 and all(s["config"]["type"] == "custom:evcc-card" and s.get("label") for s in lp)
                 and lp[0]["config"]["mode"] == "loadpoint"
                 and lp[0]["config"]["loadpoints"] == ["openwb"])
        t.check(ok_lp, "a loadpoint entity suggests the card with that loadpoint filled in", json.dumps(lp)[:250])
        site = sug["site"] or []
        ok_site = (isinstance(site, list) and len(site) >= 1
                   and {s["config"]["mode"] for s in site} == {"site", "flow"}
                   and all("loadpoints" not in s["config"] for s in site))
        t.check(ok_site, "a site entity suggests the site and flow views", json.dumps(site)[:250])
        t.check(sug["foreign"] is None, "an entity of another integration is not ours", json.dumps(sug["foreign"]))
        t.check(sug["unknown"] is None, "an evcc-looking entity that is no known feature is refused",
                json.dumps(sug["unknown"]))
        # Vehicle entities and named meters have no loadpoint; discovery files
        # them under meters, and they are site data for the picker.
        meter = sug["meter"] or []
        ok_meter = (isinstance(meter, list) and {s["config"]["mode"] for s in meter} == {"site", "flow"}
                    and all("loadpoints" not in s["config"] for s in meter))
        t.check(ok_meter, "a vehicle entity, filed under meters, suggests the site views", json.dumps(meter)[:250])

    # A second installation with its own prefix has to end up in the config.
    second = new_page(browser, 480, 900)
    open_card(second, port, config={"mode": "loadpoint"}, second={"prefix": "evcc2_"})
    pref = second.evaluate("""(() => {
      const fn = (window.customCards || []).find(c => c.type === "evcc-card")?.getEntitySuggestion;
      const hit = fn(window.__hass, "sensor.evcc2_openwb_charge_power");
      return hit ? hit[0].config : null;
    })()""")
    t.check(pref and pref.get("prefix") == "evcc2_", "a second installation carries its prefix into the config",
            json.dumps(pref))
    done(second)

    # ha-evcc slugifies the config entry title into the prefix, so a two-word
    # title gives a prefix with an underscore of its own. Cut from the id alone,
    # "my_evcc_openwb_charge_power" would read as prefix "my_" plus loadpoint
    # "evcc_openwb"; the installed prefixes from hass.entities settle it.
    second = new_page(browser, 480, 900)
    open_card(second, port, config={"mode": "loadpoint"}, second={"prefix": "my_evcc_"})
    multi = second.evaluate("""(() => {
      const fn = (window.customCards || []).find(c => c.type === "evcc-card")?.getEntitySuggestion;
      const lp   = fn(window.__hass, "sensor.my_evcc_openwb_charge_power");
      const site = fn(window.__hass, "sensor.my_evcc_grid_power");
      return { lp: lp ? lp[0].config : null, site: site ? site[0].config : null };
    })()""")
    ok_multi = (multi["lp"] and multi["lp"].get("prefix") == "my_evcc_" and multi["lp"].get("loadpoints") == ["openwb"]
                and multi["site"] and multi["site"].get("prefix") == "my_evcc_" and "loadpoints" not in multi["site"])
    t.check(ok_multi, "a prefix with an underscore of its own is not cut short", json.dumps(multi))
    done(second)

    t.group("cardapi - getGridOptions")
    grid = page.evaluate("""(() => {
      const out = {};
      for (const mode of ["loadpoint","compact","plan","repeatplan","priority","site","flow","grid","stats","battery","debug"]) {
        window.__card.setConfig({ mode, loadpoints: ["openwb"] });
        out[mode] = window.__card.getGridOptions();
      }
      return out;
    })()""")
    # A declared row count fits the card into the 56 px raster of the sections
    # grid. This card's height is not fixed, so too many rows leave an empty area
    # under it and too few let the content run into the card below: no mode may
    # declare rows at all.
    with_rows = {m: g for m, g in grid.items() if {"rows", "min_rows", "max_rows"} & set(g)}
    t.check(not with_rows, "no mode pins itself to a row count", f"mit rows: {with_rows}" if with_rows else "keine")
    bad = {m: g for m, g in grid.items()
           if not (1 <= g.get("min_columns", 1) <= g.get("columns", 12) <= 12)}
    t.check(not bad, "the column limits stay inside the 12 column section",
            f"unbrauchbar: {bad}" if bad else json.dumps(grid["flow"]))
    # The layout editor resizes in steps of three columns; a limit off that
    # raster reads as the next step up for everyone who drags the handle.
    off = {m: g for m, g in grid.items()
           if any(g.get(k, 3) % 3 for k in ("min_columns", "max_columns", "columns") if isinstance(g.get(k, 3), int))}
    t.check(not off, "the column limits sit on the 3 column steps of the layout editor",
            f"daneben: {off}" if off else "alle Vielfache von 3")

    done(page)


def setconfig(browser, port, t):
    """setConfig() rejects a configuration the card cannot render.

    Home Assistant catches the exception and shows its error card with the
    message, which is the only way a typo in the YAML becomes visible: before
    this, an unknown mode fell through to the loadpoint view and an invalid size
    was silently deleted.
    """
    VALID = [
        ({}, "an empty config"),
        ({"mode": "loadpoint", "loadpoints": ["openwb"]}, "a normal config"),
        ({"mode": "site2"}, "the legacy mode name site2"),
        ({"mode": "flow", "size": "large"}, "a known size"),
        ({"stats_period": "month"}, "a current stats_period"),
        ({"stats_period": "365d"}, "a legacy stats_period"),
        ({"disabled_loadpoints": "dim"}, "a known disabled_loadpoints"),
        ({"loadpoints": "openwb"}, "a single loadpoint as a string"),
        ({"mode": "loadpoint", "loadpoint": "openwb", "no_plan": True, "no_pv": True}, "one loadpoint, no_plan and no_pv as switches"),
        ({"no_plan": ["openwb"], "no_pv": "wp"}, "no_plan and no_pv as lists"),
        ({"prefix": "evcc2_", "language": "en"}, "prefix and language"),
        ({"mode": "vehicle", "vehicle": "ex30", "vehicle_actions": True, "vehicle_device": "none"}, "the vehicle mode options"),
        ({"mode": "vehicle", "vehicle_device": False}, "vehicle_device: false"),
        ({"mode": "vehicle", "vehicles": ["ex30"]}, "a list of one, the shape the mode started with"),
        ({"mode": "vehicle", "vehicle_image": "media-source://media_source/local/ex30.png"}, "a picture from the media library"),
        ({"mode": "vehicle", "vehicle_image_connected": "/local/ex30_lp.png", "vehicle_image_charging": "media-source://media_source/local/ex30.png"},
         "pictures at the charge point and while charging"),
        ({"mode": "vehicle", "vehicle_entities": {"soc": "sensor.a", "location": "none", "actions": ["button.b"]}}, "the entity mapping"),
        ({"slider_steps": {"limit_soc": 5, "smart_cost_limit": 0.01}}, "slider steps"),
        ({"slider_steps": {"smart_cost_limit": "0.005"}}, "a slider step written as a string"),
        ({"slider_steps": {"limit_soc": "5 %"}}, "a slider step with its unit, read like the slider reads it"),
        ({"slider_steps": {"min_soc": None}}, "an empty slider step"),
    ]
    INVALID = [
        ({"mode": "quatsch"}, "mode", "an unknown mode"),
        ({"size": "huge"}, "size", "an unknown size"),
        ({"disabled_loadpoints": "maybe"}, "disabled_loadpoints", "an unknown disabled_loadpoints"),
        ({"stats_period": "weekly"}, "stats_period", "an unknown stats_period"),
        ({"prefix": ""}, "prefix", "an empty prefix"),
        ({"prefix": 5}, "prefix", "a numeric prefix"),
        ({"language": ""}, "language", "an empty language"),
        ({"loadpoints": []}, "loadpoints", "an empty loadpoint list"),
        ({"loadpoints": [""]}, "loadpoints", "a blank loadpoint name"),
        ({"loadpoints": 5}, "loadpoints", "a numeric loadpoints"),
        ({"loadpoint": ""}, "loadpoint", "an empty loadpoint"),
        ({"loadpoint": "openwb", "loadpoints": ["wp"]}, "not both", "loadpoint and loadpoints together"),
        ({"no_plan": 5}, "no_plan", "a numeric no_plan"),
        ({"vehicles": []}, "vehicles", "an empty vehicle list"),
        ({"vehicles": ["ex30", "id7"]}, "one vehicle", "several vehicles in one card"),
        ({"vehicle": ""}, "vehicle", "an empty vehicle name"),
        ({"vehicle_actions": "yes"}, "vehicle_actions", "vehicle_actions not a boolean"),
        ({"vehicle_devices": {"ex30": "none"}}, "vehicle_devices", "the map of devices per vehicle the mode started with"),
        ({"vehicle_images": {"ex30": "/local/a.png"}}, "vehicle_images", "the map of pictures per vehicle"),
        ({"vehicle_device": 5}, "vehicle_device", "a numeric device"),
        ({"vehicle_image": "javascript:alert(1)"}, "vehicle_image", "a picture with another scheme"),
        ({"vehicle_image_connected": "javascript:alert(1)"}, "vehicle_image_connected", "a picture at the charge point with another scheme"),
        ({"vehicle_image_charging": 5}, "vehicle_image_charging", "a numeric picture while charging"),
        ({"vehicle_entities": {"ex30": {"soc": "sensor.a"}}}, "vehicle_entities", "the mapping per vehicle the mode started with"),
        ({"vehicle_entities": {"soc": "not an entity"}}, "vehicle_entities", "a role that is no entity id"),
        ({"slider_steps": [5]}, "slider_steps", "slider steps as a list"),
        ({"slider_steps": {"limit_soc": 0}}, "slider_steps", "a slider step of 0"),
        ({"slider_steps": {"limit_soc": "fast"}}, "slider_steps", "a slider step that is no number"),
    ]

    t.group("setconfig - invalid configuration is rejected")
    page = new_page(browser, 480, 900)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    probe = """((cfg) => {
      const c = document.createElement("evcc-card");
      try { c.setConfig(cfg); return { threw: false }; }
      catch (e) { return { threw: true, message: String(e && e.message || e) }; }
    })"""
    for cfg, label in VALID:
        r = page.evaluate(probe, cfg)
        t.check(not r["threw"], f"accepted: {label}", r.get("message", "")[:150])
    for cfg, key, label in INVALID:
        r = page.evaluate(probe, cfg)
        ok = r["threw"] and key in r.get("message", "")
        t.check(ok, f"rejected: {label}", r.get("message", "(kein Fehler)")[:150])

    # The rejected config must not have been applied on the way out.
    kept = page.evaluate("""(() => {
      const before = window.__card._config.mode;
      try { window.__card.setConfig({ mode: "quatsch" }); } catch (e) {}
      return { before, after: window.__card._config.mode };
    })()""")
    t.check(kept["before"] == kept["after"], "a rejected config leaves the card on the previous one", json.dumps(kept))
    t.check(not errors, "no console errors", "; ".join(errors)[:200])
    done(page)


def widths(browser, port, t):
    """Narrow and wide cards: the input panel stays inside the card, no console errors."""
    t.group("widths - responsive layout")
    # 334 px is nine columns of a section, the floor getGridOptions reports as
    # min_columns; below roughly 272 px the card runs over its own edge.
    for w in (334, 650):
        page = new_page(browser, w + 40, 1600)
        errors = open_card(page, port, width=w, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
        page.locator(in_card('input[data-entity="number.evcc_openwb_smart_cost_limit"] + button.slider-val')).click(); page.wait_for_timeout(150)
        card, panel = page.locator(in_card("ha-card")).bounding_box(), page.locator(in_card(".slider-edit")).bounding_box()
        inside = panel["x"] >= card["x"] and panel["x"] + panel["width"] <= card["x"] + card["width"] + 0.5
        scroll = page.evaluate("(() => { const c = window.__card.shadowRoot.querySelector('ha-card'); return c.scrollWidth - c.clientWidth; })()")
        page.locator("#host").screenshot(path=str(OUT / f"width-{w}.png"))
        t.check(inside and scroll <= 0 and not errors, f"{w} px: input panel inside the card, no horizontal overflow", f"overflow={scroll}; {'; '.join(errors)[:150]}")
        done(page)


def editor_vehicle_map(browser, port, t):
    """The entity mapping per vehicle: which entity fills a role and which functions
    the card offers. Two ways into it, because Home Assistant loads its own
    selector element on demand: the plain select stands in until it is there, and
    once it is, every role gets HA's entity picker with its search."""
    SERVICE = "sensor.volvo_ex30_reichweite_bis_wartung"
    ROLES   = 14
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30"})

    def mount(config):
        page.evaluate("""async (config) => {
          document.querySelectorAll("evcc-card-editor").forEach(e => e.remove());
          const ed = document.createElement("evcc-card-editor");
          window.__cfg = [];
          ed.addEventListener("config-changed", e => window.__cfg.push(JSON.parse(JSON.stringify(e.detail.config))));
          ed.setConfig(config);
          ed.hass = window.__hass;
          document.body.appendChild(ed);
          await new Promise(r => setTimeout(r, 900));
        }""", config)

    last  = lambda: page.evaluate("window.__cfg.length ? window.__cfg[window.__cfg.length - 1] : {}")
    count = lambda: page.evaluate("window.__cfg.length")
    fld   = lambda sel: page.locator(f"evcc-card-editor {sel}")
    role  = lambda r: fld(f'select[data-vehicle-role][data-role="{r}"]')
    inEd  = lambda js: page.evaluate("() => { const r = document.querySelector('evcc-card-editor').shadowRoot; return (%s); }" % js)

    # --- without HA's selector element: the select stands in ----------------------
    t.group("editor - vehicle mapping, the select that stands in")
    mount({"mode": "vehicle", "vehicle": "ex30"})
    fld('details[data-panel="vehicle_device"] summary').click()
    t.check(fld("[data-vehicle-map]").count() == 1 and role("soc").count() == 0,
            "the mapping of a vehicle is folded away", "")
    fld("[data-vehicle-map]").click(); page.wait_for_timeout(300)
    t.check(fld("select[data-vehicle-role]").count() == ROLES and count() == 0,
            "unfolded: a field per role, and unfolding writes nothing",
            f"{fld('select[data-vehicle-role]').count()} selects, {count()} events")
    auto = role("odometer").locator("option").first.inner_text()
    t.check("sensor.volvo_ex30_kilometerstand" in auto, "the automatic option names the entity the card found by itself", auto)
    opts = inEd("""[...r.querySelectorAll('select[data-vehicle-role][data-role="soc"] option')].map(o => o.value)""")
    t.check("sensor.volvo_ex30_batterie" in opts and "sensor.volvo_ex30_kilometerstand" not in opts and "lock.volvo_ex30_schloss" not in opts,
            "a role is only offered entities that could fill it", json.dumps(opts[:6]))
    groups = inEd("""[...r.querySelectorAll('select[data-vehicle-role][data-role="soc"] optgroup')].map(g => g.label)""")
    t.check(groups[:1] == ["Volvo EX30"] and len(groups) == 2, "the entities of the vehicle's device come first", json.dumps(groups))

    role("odometer").select_option(SERVICE); page.wait_for_timeout(300)
    t.check(last().get("vehicle_entities") == {"odometer": SERVICE},
            "a picked entity writes config.vehicle_entities", json.dumps(last()))
    role("location").select_option("none"); page.wait_for_timeout(300)
    t.check(last().get("vehicle_entities") == {"odometer": SERVICE, "location": "none"},
            "\"do not show\" writes none for that role", json.dumps(last()))
    t.check("2" in fld("[data-vehicle-map]").inner_text(), "the folded mapping says how much is set",
            fld("[data-vehicle-map]").inner_text())
    role("odometer").select_option(""); page.wait_for_timeout(300)
    t.check(last().get("vehicle_entities") == {"location": "none"}, "back to automatic drops the role", json.dumps(last()))

    off = fld('[data-vehicle-role-none][data-role="location"]')
    t.check(off.get_attribute("aria-pressed") == "true", "the button beside the field shows a role switched off", str(off.get_attribute("aria-pressed")))
    off.click(); page.wait_for_timeout(300)
    t.check("vehicle_entities" not in last(), "pressed again it goes back to automatic, and the last role gone the option goes too", json.dumps(last()))
    fld('[data-vehicle-role-none][data-role="soc"]').click(); page.wait_for_timeout(300)
    t.check(last().get("vehicle_entities") == {"soc": "none"}, "and it switches a role off without the select", json.dumps(last()))
    fld('[data-vehicle-role-none][data-role="soc"]').click(); page.wait_for_timeout(300)

    funcs = lambda: inEd("""[...r.querySelectorAll('[data-vehicle-func-remove]')].map(b => b.dataset.entity)""")
    t.check(funcs() == ["button.volvo_ex30_blinken", "button.volvo_ex30_hupen", "button.volvo_ex30_hupen_blinken"],
            "the functions list shows the buttons of the device, the climate ones left out", json.dumps(funcs()))
    free = inEd("""[...r.querySelectorAll('select[data-vehicle-func-add] option')].map(o => o.value)""")
    t.check("button.volvo_ex30_hupen" not in free and "button.volvo_ex30_klimatisierung_starten" in free,
            "what is already listed is not offered again", json.dumps(free[:5]))
    fld('[data-vehicle-func-remove][data-entity="button.volvo_ex30_hupen"]').click(); page.wait_for_timeout(300)
    t.check(last().get("vehicle_entities") == {"actions": ["button.volvo_ex30_blinken", "button.volvo_ex30_hupen_blinken"]}
            and funcs() == ["button.volvo_ex30_blinken", "button.volvo_ex30_hupen_blinken"],
            "removing one writes the list that stays", json.dumps(last()))
    fld('select[data-vehicle-func-add]').select_option("button.volvo_ex30_hupen"); page.wait_for_timeout(300)
    t.check(last()["vehicle_entities"]["actions"] == ["button.volvo_ex30_blinken", "button.volvo_ex30_hupen_blinken", "button.volvo_ex30_hupen"],
            "an added entity goes to the end of the list", json.dumps(last()))

    # --- with HA's selector element: the entity picker and its search -------------
    # Stood in for by an element that keeps what it is given, as the media picker
    # is; what matters is that the card hands it the right entities.
    t.group("editor - vehicle mapping through HA's entity picker")
    mount({"mode": "vehicle", "vehicle": "ex30"})
    fld('details[data-panel="vehicle_device"] summary').click()
    fld("[data-vehicle-map]").click(); page.wait_for_timeout(300)
    page.evaluate("""() => { if (!customElements.get("ha-selector")) customElements.define("ha-selector", class extends HTMLElement {}); }""")
    page.wait_for_timeout(500)
    pick = lambda r: f"""r.querySelector('[data-vehicle-role-pick][data-role="{r}"] ha-selector')"""
    t.check(fld("[data-vehicle-role-pick] ha-selector").count() == ROLES and role("soc").count() == 0
            and count() == 0, "once it is there every role gets the picker and no select stays",
            f"{fld('[data-vehicle-role-pick] ha-selector').count()} pickers, {role('soc').count()} selects, {count()} events")
    got = inEd("""(p => ({ ids: p.selector.entity.include_entities, label: p.label, helper: p.helper,
                           value: p.value ?? null, disabled: !!p.disabled }))(%s)""" % pick("soc"))
    t.check(got["value"] is None and "sensor.volvo_ex30_batterie" in got["ids"]
            and not any(i.startswith(("lock.", "button.")) for i in got["ids"]),
            "the picker is handed exactly the entities that fit the role, and starts empty", json.dumps(got)[:200])
    t.check(got["label"] == "Ladestand" and "sensor.volvo_ex30_batterie" in got["helper"] and not got["disabled"],
            "it is labelled with the role and says underneath what the card takes by itself", json.dumps(got)[:200])

    page.evaluate("""() => { const r = document.querySelector('evcc-card-editor').shadowRoot;
        r.querySelector('[data-vehicle-role-pick][data-role="odometer"] ha-selector')
         .dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'sensor.volvo_ex30_reichweite_bis_wartung' } })); }""")
    page.wait_for_timeout(400)
    t.check(last().get("vehicle_entities") == {"odometer": SERVICE},
            "an entity picked in the picker writes config.vehicle_entities", json.dumps(last()))
    t.check(inEd("%s.value" % pick("odometer")) == SERVICE, "and shows in the field", str(inEd("%s.value" % pick("odometer"))))
    fld('[data-vehicle-role-none][data-role="odometer"]').click(); page.wait_for_timeout(400)
    t.check(last().get("vehicle_entities") == {"odometer": "none"}
            and inEd("!!%s.disabled" % pick("odometer")) is True,
            "switching the role off empties the field and disables it", json.dumps(last()))
    fld('[data-vehicle-role-none][data-role="odometer"]').click(); page.wait_for_timeout(400)
    t.check("vehicle_entities" not in last(), "and back to automatic drops the option", json.dumps(last()))

    page.evaluate("""() => { const r = document.querySelector('evcc-card-editor').shadowRoot;
        r.querySelector('[data-vehicle-func-pick] ha-selector')
         .dispatchEvent(new CustomEvent('value-changed', { detail: { value: 'button.volvo_ex30_klimatisierung_starten' } })); }""")
    page.wait_for_timeout(400)
    t.check(last()["vehicle_entities"]["actions"] == ["button.volvo_ex30_blinken", "button.volvo_ex30_hupen",
                                                             "button.volvo_ex30_hupen_blinken", "button.volvo_ex30_klimatisierung_starten"],
            "a function added through the picker goes to the end of the list", json.dumps(last()))
    free = inEd("""r.querySelector('[data-vehicle-func-pick] ha-selector').selector.entity.include_entities""")
    t.check(not any(f in free for f in last()["vehicle_entities"]["actions"]),
            "the functions already listed stay out of the picker", json.dumps(free[:5]))

    mount({"mode": "vehicle", "vehicle": "ex30", "vehicle_entities": {"soc": "sensor.volvo_ex30_batterie"}})
    fld('details[data-panel="vehicle_device"] summary').click()
    fld("[data-vehicle-map]").click(); page.wait_for_timeout(400)
    t.check(inEd("%s.value" % pick("soc")) == "sensor.volvo_ex30_batterie" and count() == 0,
            "a configured mapping shows up in its field, unchanged", str(inEd("%s.value" % pick("soc"))))
    done(page)


def editor_instances(browser, port, t):
    """With two ha-evcc entries the editor offers the instance; with one it does not."""
    t.group("editor - instance selection")

    def mount(page, config):
        page.evaluate("""async (config) => {
          document.querySelectorAll("evcc-card-editor").forEach(e => e.remove());
          const ed = document.createElement("evcc-card-editor");
          window.__cfg = [];
          ed.addEventListener("config-changed", e => window.__cfg.push(JSON.parse(JSON.stringify(e.detail.config))));
          ed.setConfig(config);
          ed.hass = window.__hass;
          document.body.appendChild(ed);
          await new Promise(r => setTimeout(r, 900));
        }""", config)
    last = lambda page: page.evaluate("window.__cfg.length ? window.__cfg[window.__cfg.length - 1] : {}")
    opts = lambda page: page.evaluate("""() => { const s = document.querySelector('evcc-card-editor').shadowRoot.querySelector('ha-form [data-name=prefix]');
      return s ? [...s.options].map(o => o.value) : null; }""")

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint"})
    mount(page, {"mode": "loadpoint"})
    t.check(opts(page) is None, "one ha-evcc entry: no instance field", json.dumps(opts(page)))
    done(page)

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint"}, second={"prefix": "evcc_demo_"})
    mount(page, {"mode": "loadpoint", "loadpoints": ["openwb"]})
    t.check(opts(page) == ["evcc_", "evcc_demo_"], "two entries: the instance field lists both prefixes", json.dumps(opts(page)))
    sel = page.locator('evcc-card-editor ha-form [data-name="prefix"]')
    sel.select_option("evcc_demo_"); page.wait_for_timeout(200)
    got = last(page)
    t.check(got.get("prefix") == "evcc_demo_" and "loadpoints" not in got,
            "picking the second instance writes its prefix and clears the loadpoint filter", json.dumps(got))
    t.check(page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.querySelector('ha-form [data-name=prefix]').value") == "evcc_demo_",
            "the field keeps the selection after the re-render")
    page.locator('evcc-card-editor ha-form [data-name="prefix"]').select_option("evcc_"); page.wait_for_timeout(200)
    got = last(page)
    t.check("prefix" not in got, "picking the first instance drops the prefix again (auto-detection)", json.dumps(got))
    mount(page, {"mode": "loadpoint", "prefix": "evcc_demo_"})
    t.check(page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.querySelector('ha-form [data-name=prefix]').value") == "evcc_demo_",
            "a configured prefix is preselected")
    done(page)


def morph(browser, port, t):
    """A render morphs the live DOM instead of replacing it: elements that are
    still rendered keep their identity, and with it focus, hover, a running
    animation, the chart tooltip and their listeners; only what is new is
    inserted and wired, only what is gone is removed."""
    t.group("morph - a render keeps the elements that stay")
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    page.evaluate("""() => {
      window.__push = (mut) => {
        const st = { ...window.__hass.states };
        if (mut) mut(st);
        window.__hass.states = st;
        window.__card.hass = { ...window.__hass, states: st };
      };
    }""")
    ident = lambda: page.evaluate("""() => { const r = window.__card.shadowRoot; window.__ids = window.__ids || new Map();
        const sels = ['ha-card', '.power-value', '.soc-fill', 'button.mode-btn[data-value="now"]', 'input[data-entity="number.evcc_openwb_limit_soc"]', '.lp-badge'];
        return sels.map(s => { const el = r.querySelector(s); const known = window.__ids.get(s); window.__ids.set(s, el); return [s, !!el, known === el]; }); }""")
    ident()
    # A value change: the power text moves, nothing else.
    page.evaluate("""() => window.__push(st => { const id = 'sensor.evcc_openwb_charge_power'; st[id] = { ...st[id], state: '4.2' }; })""")
    page.wait_for_timeout(600)
    same = ident()
    power = page.evaluate("window.__card.shadowRoot.querySelector('.power-value').textContent.trim()")
    t.check(all(found and kept for _, found, kept in same), "a value change keeps every element in place", json.dumps(same))
    t.check(power.startswith("4.2"), "and the changed value is in the old element", power)

    # Focus survives, so does the keyboard position.
    page.locator(in_card('button.mode-btn[data-value="now"]')).focus()
    page.evaluate("""() => window.__push(st => { const id = 'sensor.evcc_openwb_charge_power'; st[id] = { ...st[id], state: '4.3' }; })""")
    page.wait_for_timeout(600)
    focused = page.evaluate("window.__card.shadowRoot.activeElement?.dataset.value")
    t.check(focused == "now", "a focused button keeps the focus through an update", str(focused))

    # Listeners are bound once: three renders, one click, one service call.
    page.evaluate("""() => { for (let i = 0; i < 3; i++) { window.__card._lastRenderKey = null; window.__card._render(); } window.__hass.serviceCalls.length = 0; }""")
    page.locator(in_card('button.mode-btn[data-value="off"]')).click(); page.wait_for_timeout(200)
    calls = page.evaluate("window.__hass.serviceCalls.filter(c => c.domain === 'select').length")
    t.check(calls == 1, "after three renders a click fires its handler once", f"{calls} select_option call(s)")

    # Structure: the remaining time appears and disappears with charging, the
    # badge next to it stays the same element and reads the new state.
    badge_before = page.evaluate("window.__card.shadowRoot.querySelector('.lp-badge')")
    page.evaluate("""() => window.__push(st => {
      const c = 'binary_sensor.evcc_openwb_charging'; st[c] = { ...st[c], state: 'off' };
    })""")
    page.wait_for_timeout(600)
    r = page.evaluate("""() => { const r = window.__card.shadowRoot;
      return { remaining: !!r.querySelector('.lp-remaining'), badge: r.querySelector('.lp-badge')?.className, connected: r.querySelector('.lp-badge')?.dataset.moreInfo }; }""")
    t.check(not r["remaining"] and "connected" in (r["badge"] or "") and r["connected"] == "binary_sensor.evcc_openwb_connected",
            "charging off: the remaining time leaves, the badge switches to connected", json.dumps(r))
    page.evaluate("""() => window.__push(st => {
      const c = 'binary_sensor.evcc_openwb_charging'; st[c] = { ...st[c], state: 'on' };
    })""")
    page.wait_for_timeout(600)
    r = page.evaluate("""() => { const r = window.__card.shadowRoot; const h = r.querySelector('.lp-header');
      return { order: [...h.children].map(e => e.className.split(' ')[0]), badge: r.querySelector('.lp-badge')?.className }; }""")
    t.check(r["order"] == ["lp-name", "lp-remaining", "lp-badge"] and "charging" in r["badge"],
            "charging on: the remaining time is inserted before the badge, in order", json.dumps(r))
    # A newly inserted element gets its listeners: the remaining time opens more-info.
    page.evaluate("() => { window.__moreInfo = []; window.__card.addEventListener('hass-more-info', e => window.__moreInfo.push(e.detail.entityId)); }")
    page.locator(in_card(".lp-remaining")).click(force=True); page.wait_for_timeout(50)
    t.check(page.evaluate("window.__moreInfo") == ["sensor.evcc_openwb_charge_remaining_duration"],
            "an element inserted by the morph is wired like any other", json.dumps(page.evaluate("window.__moreInfo")))

    # The rendered DOM equals what a plain innerHTML assignment would produce.
    diff = page.evaluate("""() => { const c = window.__card, r = c.shadowRoot;
      const live = r.innerHTML;
      const tpl = document.createElement('template');
      const orig = c.shadowRoot; // render the same markup fresh into a detached host
      const host = document.createElement('div'); const sr = host.attachShadow({ mode: 'open' });
      const saved = c.shadowRoot;
      // reuse the card's renderer on a scratch root: swap the root, render, swap back
      Object.defineProperty(c, 'shadowRoot', { value: sr, configurable: true });
      c._lastRenderKey = null; c._renderNow();
      Object.defineProperty(c, 'shadowRoot', { value: saved, configurable: true });
      const norm = s => s.replace(/\\s+/g, ' ').replace(/ data-morph-keep/g, '');
      return norm(sr.innerHTML) === norm(live) ? null : { live: norm(live).slice(0, 200), fresh: norm(sr.innerHTML).slice(0, 200) }; }""")
    t.check(diff is None and not errors, "the morphed DOM equals a fresh render of the same markup", json.dumps(diff)[:300] if diff else "; ".join(errors)[:200])
    done(page)

    # The chart tooltip is written at runtime and marked to be left alone.
    t.group("morph - the chart tooltip survives")
    page = new_page(browser, 480, 1200)
    open_card(page, port, mode="stats")
    page.locator(in_card(".evcc-bar")).first.hover(); page.wait_for_timeout(100)
    shown = page.evaluate("() => { const tt = window.__card.shadowRoot.querySelector('.evcc-chart-tooltip'); return !tt.hidden && tt.textContent.length > 0; }")
    page.evaluate("() => { window.__card._lastRenderKey = null; window.__card._render(); }")
    still = page.evaluate("() => { const tt = window.__card.shadowRoot.querySelector('.evcc-chart-tooltip'); return !tt.hidden && tt.textContent.length > 0; }")
    t.check(shown and still, "an open tooltip stays open through a render", f"before={shown} after={still}")
    done(page)


def keyboard(browser, port, t):
    """Every clickable element is reachable with Tab and fires on Enter or Space;
    without a language from HA the card and the editor fall back to English."""
    t.group("keyboard - focus and activation")
    NON_NATIVE = "[data-more-info], [data-action], [data-lp-current-toggle], [data-lp-smart-cost-open]"
    unreachable = lambda page: page.evaluate("""(sel) => [...window.__card.shadowRoot.querySelectorAll(sel)]
        .filter(el => !el.matches('button, input, select, textarea, a[href]'))
        .filter(el => el.getAttribute('tabindex') !== '0' || el.getAttribute('role') !== 'button')
        .map(el => el.tagName + (el.className.baseVal ?? el.className ? '.' + (el.className.baseVal ?? el.className) : '')).slice(0, 5)""", NON_NATIVE)
    hook = "() => { window.__moreInfo = []; window.__card.addEventListener('hass-more-info', e => window.__moreInfo.push(e.detail.entityId)); }"

    for mode in ("loadpoint", "site", "flow", "battery", "grid"):
        page = new_page(browser, 480, 1600)
        errors = open_card(page, port, mode=mode)
        left = unreachable(page)
        t.check(not left and not errors, f"{mode}: every non-native click target is focusable with the button role", f"unreachable: {left}; {'; '.join(errors)[:100]}")
        done(page)

    # Enter and Space on a focused more-info row fire the event a click would
    # (the site view has them as plain divs; the loadpoint view uses buttons).
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="site")
    page.evaluate(hook)
    row = page.locator(in_card("div[data-more-info]")).first
    row.focus(); page.keyboard.press("Enter"); page.keyboard.press(" ")
    fired = page.evaluate("window.__moreInfo")
    t.check(len(fired) == 2 and all(fired), "site: Enter and Space on a focused row open more-info", json.dumps(fired))
    done(page)

    # The SVG nodes of the flow view are focusable too, and the site toggle folds on Space.
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="flow")
    page.evaluate(hook)
    page.locator(in_card("g[data-more-info]")).first.focus(); page.keyboard.press("Enter")
    t.check(len(page.evaluate("window.__moreInfo")) == 1, "flow: Enter on a focused SVG node opens more-info", json.dumps(page.evaluate("window.__moreInfo")))
    shown = lambda: page.evaluate("(() => { const el = window.__card.shadowRoot.querySelector('.site-table'); return el ? getComputedStyle(el).display !== 'none' : null; })()")
    before = shown()
    page.locator(in_card(".sankey-wrap")).focus(); page.keyboard.press(" "); page.wait_for_timeout(200)
    t.check(before is not None and shown() != before, "flow: Space on the focused graphic folds the table", f"{before} -> {shown()}")
    done(page)

    t.group("keyboard - language fallback")
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="loadpoint")
    label = lambda: page.locator(in_card('button.mode-btn[data-value="off"] .mode-label')).first.inner_text().strip()
    t.check(label() == "Aus", "with hass.language de the card is German", label())
    page.evaluate("() => { const c = window.__card; c.hass = { ...window.__hass, language: undefined, locale: {} }; c._lastRenderKey = null; c._render(); }")
    page.wait_for_timeout(200)
    t.check(label() == "Off", "without a language from HA the card falls back to English", label())
    done(page)

    # The chart labels of the statistics follow the same rule: the year scope
    # prints month names, and without a language from HA they are English.
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="stats")
    months = lambda: page.evaluate("""() => { const c = window.__card; c._statsScope = 'year'; c._lastRenderKey = null; c._render();
        return [...c.shadowRoot.querySelectorAll('.evcc-chart-wrap text')].map(t => t.textContent.trim()); }""")
    de = months()
    t.check("Dez" in de or "Mär" in de, "stats: with hass.language de the month labels are German", json.dumps(de)[:120])
    page.evaluate("() => { const c = window.__card; c.hass = { ...window.__hass, language: undefined, locale: {} }; }")
    page.wait_for_timeout(200)
    en = months()
    t.check(("Dec" in en or "Mar" in en) and "Dez" not in en, "stats: without a language from HA the month labels are English", json.dumps(en)[:120])
    t.check(page.evaluate("window.__card._statsLang()") == "en", "stats: _statsLang() falls back to en")
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="loadpoint")
    ed = page.evaluate("""async () => {
      const ed = document.createElement('evcc-card-editor'); ed.setConfig({ mode: 'loadpoint' });
      ed.hass = { ...window.__hass, language: undefined, locale: {} }; document.body.appendChild(ed);
      await new Promise(r => setTimeout(r, 700));
      return ed.shadowRoot.querySelector('ha-form [data-label-for=mode]')?.textContent.trim();
    }""")
    t.check(ed == "Mode", "without a language from HA the editor falls back to English", str(ed))
    done(page)


def escaping(browser, port, t):
    """Names from HA and from evcc reach the DOM as text, never as markup.

    Loadpoint and vehicle titles, device titles, units and the currency are all
    free text in an evcc/HA configuration, and the card builds its DOM from
    template literals. Every case below puts a payload into one of those and
    asserts that the card renders it verbatim and creates no element from it.
    """
    TEXT = 'Garage <img src=x onerror="window.__xss=1">'
    ATTR = 'Zoe" onmouseover="window.__xss=1'
    # (name, config, open_card kwargs, selector whose text has to carry the payload)
    CASES = [
        ("card title",       {"mode": "loadpoint", "loadpoints": ["openwb"], "title": TEXT}, {}, ".lp-name"),
        ("vehicle title",    {"mode": "loadpoint", "loadpoints": ["openwb"]},
         {"attrs": {"select.evcc_openwb_vehicle_name": {"vehicle": {"name": TEXT}}}}, ".vehicle-name"),
        ("charge power unit", {"mode": "loadpoint", "loadpoints": ["openwb"]},
         {"attrs": {"sensor.evcc_openwb_charge_power": {"unit_of_measurement": TEXT}}}, ".power-value"),
        ("loadpoint title",  {"mode": "site"},
         {"attrs": {"select.evcc_openwb_mode": {"loadpoint_title": TEXT}}}, ".site-table"),
        ("pv device title",  {"mode": "site"},
         {"attrs": {"sensor.evcc_pv_1_power": {"title": TEXT}}}, ".site-block"),
        ("session names",    {"mode": "stats"}, {"wsname": TEXT}, ".stats-legend"),
        ("config dump",      {"mode": "debug", "title": TEXT}, {}, ".debug-yaml"),
        # An attribute payload: the vehicle ids become <option value="…">.
        ("vehicle option id", {"mode": "plan", "loadpoints": ["openwb"]},
         {"attrs": {"select.evcc_openwb_vehicle_name": {"options": ["null", "db:18", ATTR]}}}, ".plan-vehicle-select"),
    ]

    t.group("escaping - untrusted names stay text")
    for name, config, kwargs, sel in CASES:
        payload = ATTR if name == "vehicle option id" else TEXT
        page = new_page(browser, 480, 1800)
        errors = open_card(page, port, config=config, **kwargs)
        injected = page.evaluate("""() => {
            const r = window.__card.shadowRoot;
            return { nodes: r.querySelectorAll('img, script, [onerror], [onmouseover]').length,
                     flag: window.__xss ?? null,
                     text: r.textContent,
                     html: r.innerHTML }; }""")
        where = page.locator(in_card(sel))
        shown = payload in (where.first.inner_text() if where.count() else "") \
                or payload in injected["text"] \
                or (name == "vehicle option id" and payload in page.evaluate(
                    "() => [...window.__card.shadowRoot.querySelectorAll('option')].map(o => o.value).join('|')"))
        t.check(injected["nodes"] == 0 and injected["flag"] is None and shown and not errors,
                f"{name}: rendered as text, no element created",
                f"nodes={injected['nodes']} flag={injected['flag']} shown={shown}; {'; '.join(errors)[:120]}")
        done(page)


def unit(browser, port, t):
    """Pure functions from src/utils, executed in node.

    No browser is involved (the signature is the one every group has). Each file
    runs on its own so a failure names the module it came from; node's junit
    reporter gives one testcase per `test()`, which is fed into the same report
    as the browser checks.
    """
    files = sorted((ROOT / "test" / "unit").glob("*.test.mjs"))
    if not files:
        t.group("unit - pure functions")
        t.fail("unit test files found", f"none in {ROOT / 'test/unit'}")
        return
    for f in files:
        t.group(f"unit - {f.stem.replace('.test', '')}")
        try:
            p = subprocess.run(["node", "--test", "--test-reporter=junit", str(f)],
                               cwd=str(ROOT), capture_output=True, text=True, timeout=120)
        except FileNotFoundError:
            t.fail("node available for the unit tests", "node not found in PATH")
            return
        except subprocess.TimeoutExpired:
            t.fail(f"{f.name} completes", "timed out after 120 s")
            continue
        try:
            cases = list(ET.fromstring(p.stdout).iter("testcase"))
        except ET.ParseError as e:
            t.fail(f"{f.name} reports junit", f"{e}; stdout={p.stdout[:150]} stderr={p.stderr[:150]}")
            continue
        for c in cases:
            failure = c.find("failure")
            detail = "" if failure is None else (failure.get("message") or failure.text or "").strip()
            t.check(failure is None, c.get("name", "?"), " ".join(detail.split())[:300])
        if not cases:
            t.fail(f"{f.name} contains tests", f"no testcase in the report; stderr={p.stderr[:200]}")


def hints(browser, port, t):
    """The chips under the loadpoint header, as in evcc's vehicle status: the
    charge plan (start, running until, late) and the minimum charge, plus the
    PV and phase timers, which show only while there is time to count down.
    The fixture clock stands at 2026-09-18 13:00 Europe/Berlin."""
    chips = lambda page: page.evaluate("""() => [...window.__card.shadowRoot.querySelectorAll('.lp-action-chip')]
        .filter(c => !c.hidden).map(c => c.className.replace('lp-action-chip', '').trim() + ': ' + c.textContent.trim().replace(/\\s+/g, ' '))""")
    plan = lambda page: [c for c in chips(page) if c.startswith("plan")]
    # Changes states on the open card, as HA does with an update.
    update = lambda page, st: page.evaluate("""(set) => { const st = { ...window.__hass.states };
        for (const [id, v] of Object.entries(set)) st[id] = { ...st[id], state: v };
        window.__hass.states = st; window.__card.hass = { ...window.__hass, states: st }; }""", st)
    lp = {"mode": "loadpoint", "loadpoints": ["openwb"]}
    planned = {"sensor.evcc_openwb_plan_projected_start": "2026-09-19T02:00:00+02:00",
               "sensor.evcc_openwb_plan_projected_end":   "2026-09-19T06:30:00+02:00",
               "sensor.evcc_openwb_effective_plan_time":  "2026-09-19T07:00:00+02:00"}
    running = {"binary_sensor.evcc_openwb_plan_active": "on",
               "sensor.evcc_openwb_plan_projected_start": "2026-09-18T12:00:00+02:00",
               "sensor.evcc_openwb_plan_projected_end":   "2026-09-18T16:30:00+02:00",
               "sensor.evcc_openwb_effective_plan_time":  "2026-09-18T17:00:00+02:00"}

    t.group("hints - charge plan")
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, config=lp)
    t.check(plan(page) == [], "no plan: no plan chip", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set=planned)
    got = plan(page)
    t.check(got == ["plan: Ladeplan startet Sa., 02:00"], "a plan for tomorrow: start with the weekday", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**planned, "sensor.evcc_openwb_plan_projected_start": "2026-09-18T15:00:00+02:00"})
    got = plan(page)
    t.check(got == ["plan: Ladeplan startet 15:00"], "a plan starting today: the time alone", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set=running)
    got = plan(page)
    t.check(got == ["plan: Ladeplan aktiv bis 16:30"], "a running plan: until its projected end", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**running, "sensor.evcc_openwb_plan_projected_end": "2026-09-18T18:20:00+02:00"})
    got = plan(page)
    t.check(got == ["plan late: Zielzeit wird 1 h 20 min später erreicht"], "projected end after the target: the late warning", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**planned, "sensor.evcc_openwb_plan_projected_end": "2026-09-19T07:00:30+02:00"})
    got = plan(page)
    t.check(got == ["plan: Ladeplan startet Sa., 02:00"], "half a minute past the target is rounding, no warning", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config={**lp, "no_plan": ["openwb"]}, set=planned)
    t.check(plan(page) == [], "no_plan: no plan chip either", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoint": "openwb", "no_plan": True}, set=planned)
    t.check(plan(page) == [] and page.evaluate("window.__card.shadowRoot.querySelectorAll('.loadpoint').length") == 1,
            "loadpoint: openwb draws that one, no_plan: true hides its plan", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["wp"]},
              set={"binary_sensor.evcc_wp_plan_active": "on", "sensor.evcc_wp_plan_projected_end": "2026-09-18T16:30:00+02:00"})
    t.check(plan(page) == [], "heating loadpoint: no EV plan, no plan chip", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**planned, "sensor.evcc_openwb_plan_projected_start": "2026-09-18T12:00:00+02:00"})
    t.check(plan(page) == [], "a start that has passed without the plan running: no chip", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**planned, "sensor.evcc_openwb_plan_projected_start": "2026-09-18T13:00:03+02:00"})
    t.check(plan(page) == ["plan: Ladeplan startet 13:00"], "a start seconds ahead: the chip", str(chips(page)))
    page.clock.set_fixed_time("2026-09-18T13:00:05+02:00")
    page.wait_for_timeout(1300)   # no render in between, only the countdown tick
    got = plan(page)
    t.check(got == [], "the start passes without a render: the chip leaves", str(got))
    got = [c.split(":")[0] for c in chips(page)]
    t.check(got == ["pv"], "the timer next to it stays, and with it the row", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set=planned, disable=["sensor.evcc_openwb_effective_plan_soc"])
    t.check(plan(page) == [], "a start reported, but no plan block to jump to: no chip", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set=running, lang="en")
    got = plan(page)
    t.check(got == ["plan: Charging plan active until 04:30 PM"], "text and clock follow the card language", str(got))
    done(page)

    t.group("hints - the plan chip jumps to the plan")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set=planned)
    role = page.evaluate("window.__card.shadowRoot.querySelector('.lp-action-chip.plan').getAttribute('role')")
    t.check(role == "button", "the plan chip is a keyboard target", str(role))
    page.locator(in_card(".lp-action-chip.plan")).click()
    page.wait_for_timeout(100)
    lit = lambda: page.evaluate("window.__card.shadowRoot.querySelector('.plan-block[data-lp=\"openwb\"]').getAnimations().length")
    t.check(lit() == 1, "loadpoint mode: a tap highlights the plan block", str(lit()))
    update(page, {"sensor.evcc_openwb_charge_power": "4.2"})
    page.wait_for_timeout(600)
    t.check(lit() == 1, "and the highlight outlasts the next render", str(lit()))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "compact", "loadpoints": ["openwb"]}, set=planned)
    t.check(len(plan(page)) == 1, "compact mode: the plan chip sits above the tabs", str(chips(page)))
    page.locator(in_card(".lp-action-chip.plan")).click()
    page.wait_for_timeout(600)
    tab = page.evaluate("window.__card.shadowRoot.querySelector('button.compact-tab.active')?.dataset.tab")
    visible = page.evaluate("!!window.__card.shadowRoot.querySelector('.plan-block[data-lp=\"openwb\"]')?.offsetParent")
    t.check(tab == "2" and visible, "compact mode: a tap switches to the plan tab", f"tab={tab} visible={visible}")
    done(page)

    t.group("hints - minimum charge")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={"select.evcc_openwb_min_soc": "80"})
    got = [c for c in chips(page) if c.startswith("minsoc")]
    t.check(got == ["minsoc: Mindestladung bis 80 %"], "SoC below the minimum while connected: the minimum charge", str(got))
    role = page.evaluate("window.__card.shadowRoot.querySelector('.lp-action-chip.minsoc').dataset.moreInfo")
    t.check(role == "select.evcc_openwb_min_soc", "and a tap opens the minimum SoC entity", str(role))
    done(page)

    for case, st in (("minimum 0", {"select.evcc_openwb_min_soc": "0"}),
                     ("mode Off", {"select.evcc_openwb_min_soc": "80", "select.evcc_openwb_mode": "off"}),
                     ("SoC above the minimum", {"select.evcc_openwb_min_soc": "40"}),
                     ("not connected", {"select.evcc_openwb_min_soc": "80", "binary_sensor.evcc_openwb_connected": "off", "binary_sensor.evcc_openwb_charging": "off"})):
        page = new_page(browser, 480, 1600)
        open_card(page, port, config=lp, set=st)
        got = [c for c in chips(page) if c.startswith("minsoc")]
        t.check(got == [], f"{case}: no minimum charge chip", str(got))
        done(page)

    t.group("hints - timers only while they count")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={"sensor.evcc_openwb_pv_remaining": "unknown"})
    got = [c for c in chips(page) if c.startswith("pv")]
    t.check(got == [], "pv action without a remaining time: no chip and no dash", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={"sensor.evcc_openwb_pv_remaining": "2026-09-18T13:02:00+02:00"})
    got = [c for c in chips(page) if c.startswith("pv")]
    t.check(got == ["pv: PV-Laden aus in 2:00"], "pv action with a remaining time: the countdown", str(got))
    page.clock.set_fixed_time("2026-09-18T13:02:05+02:00")
    page.wait_for_timeout(1300)   # the countdown ticks once a second
    got = [c for c in chips(page) if c.startswith("pv")]
    t.check(got == [], "a run-out countdown leaves", str(got))
    height = page.evaluate("window.__card.shadowRoot.querySelector('.lp-action-row')?.getBoundingClientRect().height ?? 0")
    t.check(height == 0, "and, as the last chip, takes its row with it", str(height))
    done(page)

    t.group("hints - the chips stay through a render")
    page = new_page(browser, 480, 1600)
    errors += open_card(page, port, config=lp, set={**planned, "select.evcc_openwb_min_soc": "80"})
    page.evaluate("""() => { const r = window.__card.shadowRoot; window.__chips = [...r.querySelectorAll('.lp-action-chip')];
        const st = { ...window.__hass.states }; const id = 'sensor.evcc_openwb_charge_power';
        st[id] = { ...st[id], state: '4.2' }; window.__hass.states = st; window.__card.hass = { ...window.__hass, states: st }; }""")
    page.wait_for_timeout(600)
    kept = page.evaluate("() => { const now = [...window.__card.shadowRoot.querySelectorAll('.lp-action-chip')]; return now.length === window.__chips.length && now.every((c, i) => c === window.__chips[i]); }")
    t.check(kept, "a value change keeps the plan and minimum chips in place", str(kept))
    t.check(not errors, "no console errors", "; ".join(errors)[:300])
    done(page)

    t.group("hints - a chip that leaves takes its role and listener along")
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, config=lp, set={"select.evcc_openwb_min_soc": "80", "sensor.evcc_openwb_pv_action": "inactive",
                                                   "sensor.evcc_openwb_phase_action": "scale1p", "sensor.evcc_openwb_phase_remaining": "90"})
    t.check([c.split(":")[0] for c in chips(page)] == ["minsoc", "phase"], "minimum charge and phase timer", str(chips(page)))
    page.evaluate("window.__phase = window.__card.shadowRoot.querySelector('.lp-action-chip.phase')")
    update(page, {"select.evcc_openwb_min_soc": "0"})
    page.wait_for_timeout(600)
    got = page.evaluate("""() => { const c = window.__card.shadowRoot.querySelector('.lp-action-chip.phase');
        return { same: c === window.__phase, role: c.getAttribute('role'), info: c.dataset.moreInfo ?? null }; }""")
    t.check(got == {"same": True, "role": None, "info": None}, "the phase chip keeps its own element, no button role, no more-info", str(got))
    done(page)

    page = new_page(browser, 480, 1600)
    errors += open_card(page, port, config={"mode": "compact", "loadpoints": ["openwb"]}, set={**planned, "select.evcc_openwb_min_soc": "80"})
    update(page, {"sensor.evcc_openwb_plan_projected_start": "unknown"})
    page.wait_for_timeout(600)
    page.evaluate("window.__opened = []; window.__card.addEventListener('hass-more-info', e => window.__opened.push(e.detail.entityId))")
    page.locator(in_card(".lp-action-chip.minsoc")).click()
    page.wait_for_timeout(300)
    got = page.evaluate("({ tab: window.__card.shadowRoot.querySelector('button.compact-tab.active')?.dataset.tab, opened: window.__opened })")
    t.check(got == {"tab": "0", "opened": ["select.evcc_openwb_min_soc"]}, "the minimum chip after a plan chip: more-info only, no jump to the plan tab", str(got))
    t.check(not errors, "no console errors", "; ".join(errors)[:300])
    done(page)

    t.group("hints - vehicle limit")
    VL = "sensor.evcc_openwb_vehicle_limit_soc"
    limit = lambda page: [c for c in chips(page) if c.startswith("vehiclelimit")]
    marker = lambda page: page.evaluate("""() => { const m = window.__card.shadowRoot.querySelector('.loadpoint .soc-vehicle-limit-marker');
        return m ? { left: m.style.left, active: m.classList.contains('active') } : null; }""")
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, config=lp)
    t.check(limit(page) == [], "vehicle limit equal to the loadpoint limit: no chip", str(chips(page)))
    t.check(marker(page) is None, "and no marker: ha-evcc reports the effective limit when the vehicle has none", str(marker(page)))
    done(page)

    # ha-evcc's stand-in for "no limit in the vehicle" while a plan aims above evcc's limit
    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**planned, VL: "80", "number.evcc_openwb_limit_soc": "80",
                                          "sensor.evcc_openwb_effective_limit_soc": "80", "sensor.evcc_openwb_effective_plan_soc": "90"})
    warn = page.evaluate("window.__card.shadowRoot.querySelector('.plan-block[data-lp=\"openwb\"] .plan-warning')?.textContent.trim() ?? null")
    t.check(limit(page) == [] and warn is None, "no limit in the vehicle, plan above evcc's limit: no vehicle limit warning", f"{chips(page)} {warn}")
    done(page)

    page = new_page(browser, 480, 1600)
    errors += open_card(page, port, config=lp, set={VL: "80"})
    t.check(limit(page) == ["vehiclelimit: Fahrzeuglimit 80 %"], "vehicle limit below the loadpoint limit: the chip", str(chips(page)))
    info = page.evaluate("window.__card.shadowRoot.querySelector('.lp-action-chip.vehiclelimit').dataset.moreInfo")
    t.check(info == VL, "and a tap opens the sensor", str(info))
    t.check(marker(page) == {"left": "80%", "active": True}, "the marker on the SoC bar, strong below it", str(marker(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={VL: "80", "sensor.evcc_openwb_vehicle_soc": "79.5", "binary_sensor.evcc_openwb_charging": "off"})
    t.check(limit(page) == ["vehiclelimit: Fahrzeuglimit 80 % erreicht"], "SoC at the limit without charging: reached", str(chips(page)))
    t.check(marker(page) == {"left": "80%", "active": True}, "79.5 % is still below the marker", str(marker(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={VL: "80", "sensor.evcc_openwb_vehicle_soc": "85"})
    t.check(marker(page) == {"left": "80%", "active": False}, "SoC above the limit: the marker fades", str(marker(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={**planned, VL: "80", "sensor.evcc_openwb_effective_plan_soc": "90"})
    t.check(limit(page) == ["vehiclelimit warn: Fahrzeuglimit 80 % unter dem Ladeziel"], "plan above the vehicle limit: the warning", str(chips(page)))
    got = page.evaluate("""() => { const c = window.__card.shadowRoot.querySelector('.lp-action-chip.vehiclelimit');
        return { jump: c.dataset.lpPlanOpen ?? null, info: c.dataset.moreInfo ?? null,
                 warn: window.__card.shadowRoot.querySelector('.plan-block[data-lp="openwb"] .plan-warning')?.textContent.trim() ?? null }; }""")
    t.check(got == {"jump": "openwb", "info": None, "warn": "Fahrzeuglimit 80 % unter dem Ladeziel"}, "it jumps to the plan, which warns as well", str(got))
    page.locator(in_card(".lp-action-chip.vehiclelimit")).click()
    page.wait_for_timeout(100)
    lit = page.evaluate("window.__card.shadowRoot.querySelector('.plan-block[data-lp=\"openwb\"]').getAnimations().length")
    t.check(lit == 1, "a tap highlights the plan block", str(lit))
    done(page)

    # since evcc 0.317 the status shows the limit whether a vehicle is connected
    # or not, as the marker on the SoC bar always did
    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={VL: "80", "binary_sensor.evcc_openwb_connected": "off", "binary_sensor.evcc_openwb_charging": "off"})
    t.check(limit(page) == ["vehiclelimit: Fahrzeuglimit 80 %"] and marker(page) is not None,
            "not connected: the chip, as the marker", f"{chips(page)} {marker(page)}")
    done(page)

    for case, st in (("limit 0 (none)", {VL: "0"}),
                     ("limit unknown", {VL: "unknown"})):
        page = new_page(browser, 480, 1600)
        open_card(page, port, config=lp, set=st)
        t.check(limit(page) == [], f"{case}: no vehicle limit chip", str(chips(page)))
        done(page)

    page = new_page(browser, 480, 1600)
    errors += open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["wp"]})
    t.check(limit(page) == [], "heating loadpoint without a limit of its own (ha-evcc reports evcc's): no chip", str(chips(page)))
    done(page)

    page = new_page(browser, 480, 1600)
    errors += open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["wp"]},
                        set={"sensor.evcc_wp_vehicle_limit_soc": "55", "sensor.evcc_wp_effective_plan_soc": "58"})
    t.check(limit(page) == ["vehiclelimit: Heizungslimit 55 °C"], "heating loadpoint: the heater limit as a temperature", str(chips(page)))
    warn = page.evaluate("window.__card.shadowRoot.querySelectorAll('.plan-warning').length")
    t.check(warn == 0, "and no plan warning, heating loadpoints have no plan block", str(warn))
    t.check(not errors, "no console errors", "; ".join(errors)[:300])
    done(page)


def disabled_entities(browser, port, t):
    """ha-evcc creates some entities disabled although a control of the card
    depends on them, the clear buttons of the limits above all: without one a
    limit, once set, could not be removed, so the card offers the limit only
    with its button. A missing one shows as a warning triangle in the loadpoint
    header for administrators; the debug view and the editor list the disabled
    entities and enable them in the registry."""
    cfg = {"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"}
    btn   = "button.evcc_openwb_smart_cost_limit"
    fi    = "number.evcc_openwb_smart_feed_in_priority_limit"
    fibtn = "button.evcc_openwb_smart_feed_in_priority_limit"
    limit = {"number.evcc_openwb_smart_cost_limit": "0.25"}   # a set limit, so the chip shows
    view = lambda page: page.evaluate("""() => { const r = window.__card.shadowRoot, s = r.querySelector('[data-lp-smart-cost-section]');
        const d = r.getElementById('debug-disabled');
        return { slider: !!s?.querySelector('input[data-entity="number.evcc_openwb_smart_cost_limit"]'),
                 clear: !!s?.querySelector('button.smart-cost-clear-btn'),
                 chip: !!r.querySelector('.smart-cost-chip'),
                 feedIn: !!r.querySelector('input[data-entity="number.evcc_openwb_smart_feed_in_priority_limit"]'),
                 warn: r.querySelector('.lp-disabled-warn')?.getAttribute('title') ?? null,
                 debug: !!r.querySelector('.debug'), back: !!r.querySelector('.debug-back'),
                 rows: d ? [...d.querySelectorAll('.disabled-row')].map(li => ({
                   id: li.querySelector('.disabled-id').textContent, what: li.querySelector('.disabled-what')?.textContent.trim() ?? null,
                   status: li.querySelector('.disabled-status')?.textContent.trim() ?? null,
                   enable: !!li.querySelector('.disabled-enable') })) : null,
                 all: d?.querySelector('.disabled-enable-all')?.dataset.enableEntities ?? null,
                 intro: d?.querySelector('.disabled-intro')?.textContent.trim() ?? null }; }""")
    updates = lambda page: page.evaluate("window.__hass.wsCalls.filter(c => c.type === 'config/entity_registry/update')")

    t.group("disabled entities - the limit only with its clear button")
    page = new_page(browser, 480, 1800)
    errors = open_card(page, port, config=cfg, set=limit)
    got = view(page)
    t.check(got["slider"] and got["clear"] and got["chip"] and got["warn"] is None, "clear button there: slider, clear button and chip, no triangle", str(got))
    done(page)

    page = new_page(browser, 480, 1800)
    open_card(page, port, config=cfg, set=limit, drop=[btn, fibtn])
    got = view(page)
    t.check(not got["slider"] and not got["chip"] and not got["feedIn"] and got["warn"] is None,
            "no clear button in ha-evcc at all: no limit and nothing to enable", str(got))
    done(page)

    t.group("disabled entities - triangle, debug view and enabling")
    page = new_page(browser, 480, 1800)
    errors += open_card(page, port, config=cfg, set=limit, disable=[btn])
    got = view(page)
    t.check(not got["slider"] and not got["clear"] and not got["chip"], "clear button disabled: no slider, no chip", str(got))
    t.check(got["feedIn"], "the feed-in limit with its own clear button stays", str(got))
    t.check(got["warn"] == "Deaktivierte Entitäten: Preislimit (Button „Limit löschen“)", "a warning triangle in the header names what is missing", str(got["warn"]))
    page.locator(in_card(".lp-disabled-warn")).click(); page.wait_for_timeout(300)
    got = view(page)
    t.check(got["debug"] and got["back"], "the triangle opens the debug view, with a way back", str(got))
    needed = [r for r in got["rows"] or [] if r["what"]]
    t.check(needed == [{"id": btn, "what": "Preislimit (Button „Limit löschen“) openwb", "status": None, "enable": True}],
            "the list names the needed entity with its loadpoint and a switch", json.dumps(got["rows"], ensure_ascii=False))
    page.locator(in_card(f'button.disabled-enable[data-enable-entity="{btn}"]')).click(); page.wait_for_timeout(300)
    t.check(updates(page) == [{"type": "config/entity_registry/update", "entity_id": btn, "disabled_by": None}],
            "enable → config/entity_registry/update disabled_by=null", json.dumps(updates(page)))
    got = view(page)
    row = next((r for r in got["rows"] or [] if r["id"] == btn), None)
    t.check(row and row["status"] == "Aktiviert. Home Assistant lädt ha-evcc in etwa 30 s neu." and not row["enable"],
            "after enabling: the reload HA announced, no second switch", str(row))
    page.locator(in_card(".debug-back")).click(); page.wait_for_timeout(300)
    got = view(page)
    t.check(not got["debug"] and got["warn"] is None, "back on the loadpoint, the triangle is gone while HA reloads", str(got))
    # HA reloads ha-evcc, the button gets its state
    page.evaluate("""(id) => { const st = { ...window.__hass.states, [id]: { entity_id: id, state: "unknown", attributes: {} } };
        window.__hass.states = st; window.__card.hass = { ...window.__hass, states: st }; }""", btn)
    page.wait_for_timeout(600)
    got = view(page)
    t.check(got["slider"] and got["clear"] and got["chip"] and got["warn"] is None, "after the reload: the limit is back", str(got))
    t.check(not errors, "no console errors", "; ".join(errors)[:300])
    done(page)

    # the feed-in limit ships disabled together with its clear button
    page = new_page(browser, 480, 1800)
    open_card(page, port, config=cfg, disable=[fi, fibtn])
    got = view(page)
    t.check(not got["feedIn"] and got["warn"] and "Einspeisepriorität-Limit, Einspeisepriorität-Limit (Button" in got["warn"],
            "slider and clear button of the feed-in limit disabled: both in the triangle", str(got["warn"]))
    page.locator(in_card(".lp-disabled-warn")).click(); page.wait_for_timeout(300)
    got = view(page)
    t.check(got["all"] == f"{fibtn},{fi}", "enable all offers the needed ones", str(got["all"]))
    page.locator(in_card("button.disabled-enable-all")).click(); page.wait_for_timeout(300)
    t.check(sorted(u["entity_id"] for u in updates(page)) == sorted([fi, fibtn]), "enable all → one registry update each", json.dumps(updates(page)))
    done(page)

    # the phase current sensors: named once, no hint under the power row any more
    page = new_page(browser, 480, 1800)
    open_card(page, port, config=cfg, disable=[f"sensor.evcc_openwb_charge_currents_{i}" for i in range(3)])
    got = view(page)
    t.check(got["warn"] == "Deaktivierte Entitäten: Stromwerte je Phase", "phase currents disabled: named once in the triangle", str(got["warn"]))
    t.check(page.locator(in_card(".power-currents-hint")).count() == 0, "and no hint under the power row", "")
    done(page)

    t.group("disabled entities - who sees the triangle")
    page = new_page(browser, 480, 1800)
    open_card(page, port, config=cfg, disable=[btn], admin=False)
    got = view(page)
    t.check(got["warn"] is None, "no administrator: no triangle", str(got))
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={**cfg, "mode": "debug"}, disable=[btn], admin=False)
    got = view(page)
    t.check((got["intro"] or "").endswith("Aktivieren kann sie ein Administrator unter Einstellungen, Entitäten.")
            and not any(r["enable"] for r in got["rows"] or []) and got["all"] is None,
            "no administrator: the debug view names who can enable them, no switches", str(got))
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={**cfg, "hide_disabled_hint": True}, disable=[btn])
    t.check(view(page)["warn"] is None, "hide_disabled_hint: no triangle", "")
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={**cfg, "hide_settings": ["smart_cost_limit"]}, disable=[btn])
    t.check(view(page)["warn"] is None, "a hidden setting needs nothing: no triangle", "")
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "compact", "loadpoints": ["openwb"]}, disable=[btn])
    t.check(view(page)["warn"] is not None, "the compact header carries the triangle too", "")
    done(page)

    t.group("disabled entities - vehicle sensors")
    CONFIGVEHICLE = [f"sensor.evcc_ex30_configvehicle_{k}" for k in ("soc", "range", "odometer", "limitsoc")]
    warn = lambda page, slug: page.evaluate(f"window.__card.shadowRoot.querySelector('.vehicle-block[data-vehicle={slug}] .lp-disabled-warn')?.getAttribute('title') ?? null")
    page = new_page(browser, 480, 1800)
    errors = open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30"}, disable=CONFIGVEHICLE, vehicle_device=False)
    t.check(warn(page, "ex30") == "Deaktivierte Entitäten: Fahrzeugwerte ohne Ladepunkt (Ladestand, Reichweite, Kilometerstand)",
            "disabled vehicle sensors: a triangle in the vehicle header", str(warn(page, "ex30")))
    page.locator(in_card('.vehicle-block[data-vehicle="ex30"] .lp-disabled-warn')).click(); page.wait_for_timeout(300)
    got = view(page)
    needed = sorted(r["id"] for r in got["rows"] or [] if r["what"] == "Fahrzeugwerte ohne Ladepunkt (Ladestand, Reichweite, Kilometerstand) ex30")
    t.check(got["debug"] and needed == sorted(CONFIGVEHICLE) and got["all"] and sorted(got["all"].split(",")) == sorted(CONFIGVEHICLE),
            "the debug view lists them as needed, named with the vehicle, with enable all", json.dumps(got["rows"], ensure_ascii=False)[:300])
    t.check(not errors, "no console errors", "; ".join(errors)[:300])
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30"}, disable=CONFIGVEHICLE)
    t.check(warn(page, "ex30") is None, "a vehicle linked to its own device needs no triangle", str(warn(page, "ex30")))
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30"}, disable=CONFIGVEHICLE, vehicle_device=False, admin=False)
    t.check(warn(page, "ex30") is None, "no administrator: no triangle on the vehicle either", "")
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, disable=CONFIGVEHICLE, vehicle_device=False)
    t.check(view(page)["warn"] is None, "the loadpoint header ignores the vehicle sensors", str(view(page)["warn"]))
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "debug"}, disable=CONFIGVEHICLE, vehicle_device=False)
    rows = view(page)["rows"] or []
    t.check(sorted(r["id"] for r in rows if r["id"] in CONFIGVEHICLE) == sorted(CONFIGVEHICLE) and not any(r["what"] for r in rows if r["id"] in CONFIGVEHICLE),
            "outside a vehicle card the vehicle sensors are listed, but not as needed", json.dumps(rows, ensure_ascii=False)[:300])
    done(page)
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "vehicle", "vehicle": "ex30", "vehicle_entities": {"lock": "lock.volvo_ex30_schloss"}},
              disable=CONFIGVEHICLE, vehicle_device=False)
    t.check(warn(page, "ex30") is not None,
            "one role set by hand is no device: charge level, range and odometer still need the sensors, the triangle stays", str(warn(page, "ex30")))
    done(page)

    t.group("disabled entities - editor")
    page = new_page(browser, 480, 1800)
    open_card(page, port, config=cfg, disable=[btn])
    mount = lambda config: page.evaluate("""async (config) => {
      document.querySelectorAll("evcc-card-editor").forEach(e => e.remove());
      const ed = document.createElement("evcc-card-editor");
      window.__cfg = [];
      ed.addEventListener("config-changed", e => window.__cfg.push(JSON.parse(JSON.stringify(e.detail.config))));
      ed.setConfig(config);
      ed.hass = window.__hass;
      document.body.appendChild(ed);
      await new Promise(r => setTimeout(r, 900));
    }""", config)
    ed     = lambda sel: page.locator(f"evcc-card-editor {sel}")
    listed = lambda: page.evaluate("""() => [...document.querySelector("evcc-card-editor").shadowRoot.querySelectorAll('[data-panel="disabled"] code.disabled-id')]
      .map(c => c.textContent)""")
    # The editor names what this card's triangles point at, and nothing of
    # the registry's other disabled entities: those are the same in every card.
    mount({"mode": "loadpoint"})
    t.check(listed() == [btn] and ed("details.disabled-optional").count() == 0,
            "the editor lists only what this card misses, no optional list", json.dumps(listed()))
    panel = ed('details[data-panel="disabled"]')
    t.check(page.evaluate("""() => { const r = document.querySelector("evcc-card-editor").shadowRoot;
              return r.querySelector(".form").lastElementChild === r.querySelector(".form-disabled"); }""")
            and not panel.evaluate("d => d.open") and panel.locator(":scope > summary .panel-icon svg").count() == 1
            and panel.locator(":scope > summary").inner_text().endswith("(1)"),
            "last, folded, the warning triangle and the count in its title", panel.locator(":scope > summary").inner_text())
    panel.locator(":scope > summary").click()
    ed(f'button.disabled-enable[data-enable-entity="{btn}"]').click(); page.wait_for_timeout(300)
    t.check([u["entity_id"] for u in updates(page)] == [btn], "the editor enables it in the registry", json.dumps(updates(page)))
    t.check("30 s" in (ed(".disabled-status").first.text_content() or ""), "and shows the reload", ed(".disabled-status").first.text_content())
    for config, why in (({"mode": "loadpoint", "hide_settings": ["smart_cost_limit"]}, "its control hidden through hide_settings"),
                        ({"mode": "loadpoint", "loadpoints": ["wp"]}, "a card for another loadpoint"),
                        ({"mode": "battery"}, "the battery mode"),
                        ({"mode": "site"}, "a mode without a triangle")):
        mount(config)
        t.check(btn not in listed(), f"not listed for {why}", json.dumps(listed()))
    mount({"mode": "site"})
    t.check(ed('ha-form [data-name="hide_disabled_hint"]').count() == 0, "a mode without a triangle has no switch for it", "")
    mount({"mode": "loadpoint"})
    t.check(ed('ha-form details[data-section="section_content"] [data-name="hide_disabled_hint"]').count() == 1,
            "the switch for the triangle sits in the content panel", "")
    ed('ha-form details[data-section="section_content"] summary').click()
    ed('ha-form [data-name="hide_disabled_hint"]').check(); page.wait_for_timeout(100)
    cfgs = page.evaluate("window.__cfg")
    t.check(cfgs and cfgs[-1].get("hide_disabled_hint") is True, "the checkbox writes hide_disabled_hint", json.dumps(cfgs[-1:] if cfgs else []))
    ed('ha-form [data-name="hide_disabled_hint"]').uncheck(); page.wait_for_timeout(100)
    cfgs = page.evaluate("window.__cfg")
    t.check("hide_disabled_hint" not in cfgs[-1], "unchecked, the key is dropped again", json.dumps(cfgs[-1]))
    done(page)


def solar_share(browser, port, t):
    """evcc's solar share (0.316, ha-evcc 2026.9.5) in the charge settings: the
    slider with evcc's wording below it, locked while a power threshold is set."""
    t.group("solar share")
    lp  = {"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"}
    sel = 'input[data-entity="number.evcc_openwb_solar_share"]'
    got = lambda page, lpn="openwb": page.evaluate("""(id) => { const i = window.__card.shadowRoot.querySelector(`input[data-entity="${id}"]`);
        if (!i) return null; const sec = i.closest('.solar-share-section');
        return { value: i.value, step: i.step, disabled: i.disabled, edit: i.nextElementSibling.disabled,
                 label: i.nextElementSibling.textContent.trim(), hint: sec.querySelector('.setting-hint').textContent.trim() }; }""",
        f"number.evcc_{lpn}_solar_share")

    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, config=lp)
    g = got(page)
    t.check(g == {"value": "100", "step": "10", "disabled": False, "edit": False, "label": "100 %",
                  "hint": "Laden startet, sobald der Überschuss die minimale Ladeleistung deckt."},
            "100 %: the slider, evcc's text for a full share", str(g))
    order = page.evaluate("""() => [...window.__card.shadowRoot.querySelector('.current-block-body').children]
        .map(c => c.matches('hr') ? '|' : c.classList.contains('solar-share-section') ? 'solar'
                : c.querySelector('[data-boost-entity]') ? 'boost' : 'other')""")
    i = order.index("solar")
    t.check(order[i - 2:i + 3] == ["other", "|", "solar", "|", "boost"], "between the currents and battery boost, as in evcc", str(order))
    el = page.locator(in_card(sel))
    el.click(position={"x": 1, "y": el.bounding_box()["height"] / 2}); page.wait_for_timeout(400)
    g = got(page)
    t.check(g["label"] == "0 %" and g["hint"] == "Laden startet, sobald etwas Überschuss verfügbar ist.",
            "released at 0 %: value and text follow at once, before HA answers", str(g))
    t.check(not errors, "no console errors", "; ".join(errors)[:300])
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={"number.evcc_openwb_solar_share": "30"}, lang="en")
    g = got(page)
    t.check(g["hint"] == "At least 30 % of the minimum charging power must come from solar.", "30 %: the share in the text, card language", str(g))
    done(page)

    for case, st in (("enable threshold", {"number.evcc_openwb_enable_threshold": "-1200"}),
                     ("disable threshold", {"number.evcc_openwb_disable_threshold": "10"})):
        page = new_page(browser, 480, 1600)
        open_card(page, port, config=lp, set=st)
        g = got(page)
        t.check(g and g["disabled"] and g["edit"] and g["hint"].startswith("Leistungsbasierte Ladeschwellen sind konfiguriert"),
                f"{case} set: locked with evcc's hint, no direct input", str(g))
        done(page)

    # ha-evcc creates no solar share for an integrated device (the heat pump);
    # a heating device on a plain charger (a heating rod on a switched socket)
    # gets one, and evcc's heating wording with it.
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={**lp, "loadpoints": ["wp"]})
    t.check(got(page, "wp") is None, "integrated heat pump: ha-evcc has no solar share, no slider")
    done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config=lp, set={"number.evcc_openwb_solar_share": "50"},
              attrs={"sensor.evcc_openwb_effective_plan_soc": {"unit_of_measurement": "°C", "device_class": "temperature"}})
    g = got(page)
    t.check(g and g["hint"] == "Mindestens 50 % der minimalen Heizleistung muss aus Solarstrom stammen.",
            "heating loadpoint: evcc's heating text", str(g))
    done(page)

    for case, cfg, st, dis in (("hide_settings", {**lp, "hide_settings": ["solar_share"]}, None, None),
                               ("no_pv", {**lp, "no_pv": ["openwb"]}, None, None),
                               ("no value from evcc", lp, {"number.evcc_openwb_solar_share": "unavailable"}, None),
                               ("no entity (ha-evcc before 2026.9.5)", lp, None, ["number.evcc_openwb_solar_share"])):
        page = new_page(browser, 480, 1600)
        open_card(page, port, config=cfg, set=st, drop=dis)
        t.check(page.locator(in_card(sel)).count() == 0, f"{case}: no solar share slider")
        done(page)

    page = new_page(browser, 480, 1600)
    open_card(page, port, config={**lp, "hide_settings": ["limit_soc", "min_soc", "phases", "max_current", "min_current", "battery_boost", "priority", "smart_cost_limit", "smart_feed_in_priority_limit"]})
    n = page.evaluate("window.__card.shadowRoot.querySelectorAll('.current-block-body > *').length")
    t.check(n == 1 and page.locator(in_card(sel)).count() == 1, "the only setting left: the block stays, no divider", str(n))
    done(page)


def battery_mode(browser, port, t):
    """The battery mode: SoC history from the HA recorder, what the optimizer adds
    on its own when ha-evcc offers it, and the grid charge/discharge limits."""
    t.group("battery - history, optimizer, grid limits")
    now = datetime.datetime.fromisoformat(FIXED_TIME).timestamp() * 1000
    hist_calls = lambda page: [m for m in page.evaluate("window.__hass.wsCalls") if m["type"] == "history/history_during_period"]
    ms = lambda iso: datetime.datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000

    # without the optimizer: two days back to now, read from the recorder
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, mode="battery")
    calls = hist_calls(page)
    c = calls[-1] if calls else {}
    t.check(not errors, "renders without errors", "; ".join(errors))
    t.check(c.get("entity_ids") == ["sensor.evcc_battery_soc"] and c.get("minimal_response") and c.get("no_attributes"),
            "history of the battery SoC, minimal and without attributes", json.dumps(c))
    t.check(c and ms(c["start_time"]) == now - 48 * 3600e3 and ms(c["end_time"]) == now,
            "window: 48 h back to now", json.dumps(c))
    t.check(page.locator(in_card(".batt-chart-svg path[stroke-dasharray]")).count() == 0, "no forecast line without the optimizer")
    t.check(not any(m["type"] == "evcc_intg/optimizer" for m in page.evaluate("window.__hass.wsCalls")),
            "no optimizer request when ha-evcc does not offer it")
    t.check(page.locator(in_card(".batt-optimizer")).count() == 0, "no optimizer row")
    t.check(page.locator(in_card('button.batt-step[data-batt-step="1"]')).is_disabled(), "cannot page into the future")
    page.locator(in_card('button.batt-step[data-batt-step="-1"]')).click(); settle(page)
    c = hist_calls(page)[-1]
    t.check(ms(c["start_time"]) == now - 72 * 3600e3 and ms(c["end_time"]) == now - 24 * 3600e3,
            "one day back: the window moves by 24 h", json.dumps(c))
    t.check("1" in page.locator(in_card(".batt-step-label")).inner_text(), "stepper says how far back",
            page.locator(in_card(".batt-step-label")).inner_text())
    ds = page.evaluate("""() => document.querySelector('evcc-card')._battDownsample(
        [{t: 0, v: 50}, {t: 60000, v: 0}, {t: 73000, v: 50}, {t: 600000, v: 60}], 300000)""")
    t.check(len(ds) == 3 and abs(ds[0]["v"] - (50 * 60 + 0 * 13 + 50 * 227) / 300) < 0.01 and ds[1]["v"] == 50 and ds[2] == {"t": 600000, "v": 60},
            "history: time-weighted 5 min means, a 13 s drop to 0 % is only a dent, the last state kept", json.dumps(ds))
    dense = page.evaluate("""() => document.querySelector('evcc-card')._battDownsample(
        Array.from({length: 57600}, (_, i) => ({t: i * 3000, v: i % 100})), 300000).length""")
    t.check(dense <= 600, "48 h of states every 3 s become at most one point per 5 min", str(dense))
    t.check(page.locator(in_card(".batt-stat-val")).nth(1).inner_text() == "entlädt 2,9 kW",
            "power in the HA language (2,9) and evcc's sign (positive discharges)", page.locator(in_card(".batt-stat-val")).nth(1).inner_text())
    done(page)

    # hide_soc_chart: no chart and no recorder query, the status and the settings stay
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, config={"mode": "battery", "hide_soc_chart": True}, optimizer=True)
    t.check(not errors, "hide_soc_chart: renders without errors", "; ".join(errors))
    t.check(page.locator(in_card(".batt-chart")).count() == 0 and page.locator(in_card(".batt-stepper")).count() == 0,
            "hide_soc_chart: no chart, no day stepper")
    t.check(not hist_calls(page), "hide_soc_chart: the recorder is not asked")
    t.check(page.locator(in_card(".batt-status")).count() == 1 and page.locator(in_card(".batt-extreme")).count() == 2
            and page.locator(in_card("button.batt-tab")).count() >= 1,
            "hide_soc_chart: status with highest/lowest and the settings tabs stay")
    done(page)

    # with the optimizer: a day back to a day ahead, the forecast dashed, highest/lowest
    page = new_page(browser, 480, 1600)
    errors = open_card(page, port, mode="battery", optimizer=True, set={"sensor.evcc_battery_soc": "83", "sensor.evcc_battery_0_soc": "83"})
    opt = [m for m in page.evaluate("window.__hass.wsCalls") if m["type"] == "evcc_intg/optimizer"]
    t.check(not errors, "optimizer: renders without errors", "; ".join(errors))
    t.check(len(opt) >= 1 and opt[0].get("entry_id"), "optimizer requested for the card's ha-evcc entry", json.dumps(opt[:1]))
    c = hist_calls(page)[-1]
    t.check(ms(c["start_time"]) == now - 24 * 3600e3 and ms(c["end_time"]) == now,
            "with a forecast the history covers the day before now", json.dumps(c))
    t.check(page.locator(in_card(".batt-chart-svg path[stroke-dasharray]")).count() == 1, "forecast drawn as a dashed line")
    first = page.evaluate("document.querySelector('evcc-card')._battForecast().series[0].v")
    t.check(round(first) == 83, "forecast from the home battery only, the vehicle left out (83 %, not the car's 60 %)", str(first))
    ext = page.locator(in_card(".batt-extreme")).all_inner_texts()
    t.check(len(ext) == 2 and "voll" in ext[0] and "Tiefststand" in ext[1], "highest and lowest from batteryForecast", str(ext))
    done(page)

    # the forecast is asked for again after 30 s; an unchanged answer draws
    # nothing, a changed one renders once; a write of the grid charge limit or
    # grid discharging asks again after 3 and 10 s, any other write does not
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", optimizer=True, battery_ext=True)
    page.evaluate("""() => { const c = window.__card, orig = c._render.bind(c);
      window.__renders = 0; c._render = function (...a) { window.__renders++; return orig(...a); }; }""")
    calls = lambda: sum(1 for m in page.evaluate("window.__hass.wsCalls") if m["type"] == "evcc_intg/optimizer")
    age = lambda s: page.evaluate(f"() => {{ const c = window.__card; c._wsCache.optimizer.ts = Date.now() - {s * 1000}; c._battForecast(); }}")
    n = calls(); age(20); page.wait_for_timeout(700)
    t.check(calls() == n, "forecast younger than 30 s: not asked for again")
    age(31); page.wait_for_timeout(700)
    t.check(calls() == n + 1, "forecast older than 30 s: asked for again", f"{n} -> {calls()}")
    t.check(page.evaluate("window.__renders") == 0, "an unchanged answer renders nothing", str(page.evaluate("window.__renders")))
    page.evaluate("""() => { const h = window.__card._hass, orig = h.callWS.bind(h);
      h.callWS = msg => msg.type !== "evcc_intg/optimizer" ? orig(msg)
        : orig(msg).then(d => ({ ...d, batteryForecast: { ...d.batteryForecast, lowest: null } })); }""")
    age(31); page.wait_for_timeout(700)
    t.check(page.evaluate("window.__renders") == 1, "a changed answer renders once", str(page.evaluate("window.__renders")))
    t.check(page.locator(in_card(".batt-extreme")).count() == 1, "and shows the new forecast (no lowest any more)")
    n = calls()
    page.evaluate("window.__card._setNumberValue('number.evcc_residual_power', 100)")
    page.wait_for_timeout(3500)
    t.check(calls() == n, "a write of another setting asks for no forecast", f"{n} -> {calls()}")
    page.evaluate("window.__card._setNumberValue('number.evcc_battery_grid_charge_limit', 0.25)")
    page.wait_for_timeout(1000)
    t.check(calls() == n, "grid charge limit written: not asked for at once (evcc is still computing)")
    page.wait_for_timeout(2500)
    t.check(calls() == n + 1, "asked for again 3 s after the write", f"{n} -> {calls()}")
    page.wait_for_timeout(7000)
    t.check(calls() == n + 2, "and once more after 10 s", f"{n} -> {calls()}")
    n = calls()
    page.evaluate("() => { window.__card._hass.callService = () => Promise.reject(new Error('mock: refused')); }")
    page.evaluate("window.__card._toggleEntity('switch', 'switch.evcc_battery_grid_discharge', false).catch(() => {})")
    page.wait_for_timeout(3500)
    t.check(calls() == n, "a refused write asks for no forecast", f"{n} -> {calls()}")
    done(page)

    # evcc's "optimize" button (proposed to ha-evcc): only with the entity and a
    # running optimizer; a press turns its icon until a new forecast is in, and
    # a write of the grid charge limit presses it
    for opt, optimize, want in ((True, False, 0), (False, True, 0), (True, True, 1)):
        page = new_page(browser, 480, 1600)
        open_card(page, port, mode="battery", optimizer=opt, battery_ext=True, optimize=optimize)
        t.check(page.locator(in_card("button.batt-recompute")).count() == want,
                f"recompute button {'shown' if want else 'hidden'} (optimizer {opt}, button entity {optimize})")
        done(page)
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", optimizer=True, battery_ext=True, optimize=True)
    btn = page.locator(in_card("button.batt-recompute"))
    t.check(btn.get_attribute("aria-label") == "Prognose neu berechnen", "recompute button labelled", str(btn.get_attribute("aria-label")))
    presses = lambda: [c for c in page.evaluate("window.__hass.serviceCalls") if c["domain"] == "button"]
    n = calls()
    btn.click(); page.wait_for_timeout(200)
    t.check(presses() == [{"domain": "button", "service": "press", "data": {"entity_id": "button.evcc_optimize"}}],
            "a click presses button.evcc_optimize", json.dumps(presses()))
    t.check("busy" in (btn.get_attribute("class") or "") and btn.is_disabled(), "the icon turns while evcc computes, the button is locked")
    page.evaluate("""() => { const h = window.__card._hass, orig = h.callWS.bind(h);
      h.callWS = msg => msg.type !== "evcc_intg/optimizer" ? orig(msg)
        : orig(msg).then(d => ({ ...d, batteryForecast: { ...d.batteryForecast, lowest: null } })); }""")
    page.wait_for_timeout(3700)
    t.check(calls() == n + 1, "asked for the forecast 3 s after the press", f"{n} -> {calls()}")
    t.check("busy" not in (btn.get_attribute("class") or "") and not btn.is_disabled(), "a new forecast stops the turning")
    done(page)
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", optimizer=True, battery_ext=True, optimize=True)
    page.evaluate("window.__card._setNumberValue('number.evcc_battery_grid_charge_limit', 0.25)")
    page.wait_for_timeout(300)
    got = [c["data"].get("entity_id") for c in page.evaluate("window.__hass.serviceCalls")]
    t.check(got == ["number.evcc_battery_grid_charge_limit", "button.evcc_optimize"], "grid charge limit written, then optimize pressed", str(got))
    t.check("busy" in (page.locator(in_card("button.batt-recompute")).get_attribute("class") or ""), "and the icon turns")
    done(page)
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", optimizer=True, battery_ext=True, optimize=True)
    page.evaluate("() => { window.__card._hass.callService = () => Promise.reject(new Error('mock: refused')); }")
    page.locator(in_card("button.batt-recompute")).click(); page.wait_for_timeout(300)
    t.check("busy" not in (page.locator(in_card("button.batt-recompute")).get_attribute("class") or ""), "a refused press stops the turning at once")
    done(page)
    for opt, want in ((True, 1), (False, 0)):
        page = new_page(browser, 480, 1600)
        open_card(page, port, mode="battery", optimizer=opt, battery_ext=True, optimize=True, disable=["button.evcc_optimize"])
        t.check(page.locator(in_card(".battery-block .lp-disabled-warn")).count() == want,
                f"disabled optimize button: {'triangle' if opt else 'no triangle'} {'with' if opt else 'without'} a running optimizer")
        done(page)

    # the suggestion shows only when it differs from what the battery does (actionable)
    for actionable in (True, False):
        page = new_page(browser, 480, 1600)
        open_card(page, port, mode="battery", attrs={"sensor.evcc_battery_0_soc": {"suggestion": {"action": "hold", "charge": 0, "discharge": 0, "actionable": actionable}}})
        chip = page.locator(in_card(".batt-suggestion"))
        t.check((chip.count() == 1 and "Entladen verhindern" in chip.inner_text()) if actionable else chip.count() == 0,
                f"suggestion {'shown' if actionable else 'hidden'} with actionable={actionable}")
        done(page)

    # two batteries: one row each, each with its own suggestion
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", set={"sensor.evcc_battery_1_soc": "64", "sensor.evcc_battery_1_power": "-1200"},
              attrs={"sensor.evcc_battery_1_soc": {"suggestion": {"action": "charge", "actionable": True}}})
    t.check(page.locator(in_card(".batt-dev-row")).count() == 2, "a row per battery")
    t.check(page.locator(in_card(".batt-dev-row")).nth(1).locator(".batt-suggestion").count() == 1, "the suggestion sits at its battery")
    done(page)

    # the values open HA's more-info dialog, as at the loadpoint
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True, set={"number.evcc_battery_grid_charge_limit": "0.21", "binary_sensor.evcc_battery_grid_charge_active": "on",
              "sensor.evcc_battery_1_soc": "64", "sensor.evcc_battery_1_power": "-1200"},
              attrs={"sensor.evcc_battery_1_soc": {"suggestion": {"action": "charge", "actionable": True}}})
    page.evaluate("() => { window.__moreInfo = []; window.__card.addEventListener('hass-more-info', e => window.__moreInfo.push(e.detail.entityId)); }")
    tab = lambda key: (page.locator(in_card(f'button.batt-tab[data-batt-tab="{key}"]')).click(), settle(page))
    targets = [(None, ".batt-status-soc", "sensor.evcc_battery_soc"), (None, ".batt-stat >> nth=0", "sensor.evcc_battery_capacity"),
               (None, ".batt-stat >> nth=1", "sensor.evcc_battery_power"), (None, ".batt-chart", "sensor.evcc_battery_soc"),
               (None, ".batt-dev-soc >> nth=1", "sensor.evcc_battery_1_soc"), (None, ".batt-dev-power >> nth=1", "sensor.evcc_battery_1_power"),
               (None, ".batt-suggestion", "sensor.evcc_battery_1_soc"),
               (None, ".batt-text-title >> nth=0", "select.evcc_priority_soc"), (None, ".batt-text-title >> nth=1", "select.evcc_buffer_soc"),
               (None, ".batt-switch-desc", "switch.evcc_battery_discharge_control"),
               ("charge", ".batt-switch-desc", "number.evcc_battery_grid_charge_limit"),
               ("charge", ".batt-chip.active", "binary_sensor.evcc_battery_grid_charge_active"),
               ("discharge", ".batt-switch-desc", "switch.evcc_battery_grid_discharge")]
    for key, sel, eid in targets:
        if key: tab(key)
        page.evaluate("() => { window.__moreInfo = []; }")
        page.locator(in_card(sel)).first.click(); page.wait_for_timeout(100)
        got = page.evaluate("window.__moreInfo")
        t.check(got == [eid], f"more-info: {key or 'usage'} {sel} → {eid}", str(got))
    t.check(page.locator(in_card(".batt-status-soc")).get_attribute("role") == "button"
            and page.locator(in_card(".batt-status-soc")).get_attribute("tabindex") == "0", "more-info targets are keyboard buttons")
    page.evaluate("() => { window.__moreInfo = []; }")
    page.locator(in_card(".batt-status-soc")).focus(); page.keyboard.press("Enter"); page.wait_for_timeout(100)
    t.check(page.evaluate("window.__moreInfo") == ["sensor.evcc_battery_soc"], "Enter opens more-info", str(page.evaluate("window.__moreInfo")))
    done(page)

    # the tab picked last comes back when the card is opened again, per ha-evcc
    # instance; one that is not offered any more, or storage that fails, leaves
    # the view at the first tab
    page = new_page(browser, 480, 1600)
    active = lambda: page.locator(in_card("button.batt-tab.active")).get_attribute("data-batt-tab")
    open_card(page, port, mode="battery", battery_ext=True)
    t.check(active() == "usage", "no tab remembered: usage first")
    page.locator(in_card('button.batt-tab[data-batt-tab="discharge"]')).click(); settle(page)
    stored = page.evaluate("JSON.parse(localStorage.getItem('evcc-card-battery-tab'))")
    t.check(stored == {"evcc_": "discharge"}, "the picked tab is stored per prefix", json.dumps(stored))
    open_card(page, port, mode="battery", battery_ext=True)
    t.check(active() == "discharge", "opened again: the remembered tab", str(active()))
    open_card(page, port, mode="battery")
    t.check(active() == "usage", "remembered tab no longer offered: the first one", str(active()))
    page.evaluate("localStorage.setItem('evcc-card-battery-tab', '{broken')")
    open_card(page, port, mode="battery", battery_ext=True)
    t.check(active() == "usage", "unreadable storage: the first tab", str(active()))
    page.evaluate("() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; }")
    page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).click(); settle(page)
    t.check(active() == "charge", "storage that refuses the write: the tab still switches", str(active()))
    done(page)

    # the settings as tabs, as in evcc: usage first, a tab only for what ha-evcc provides
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery")
    tabs = page.locator(in_card("button.batt-tab")).evaluate_all("els => els.map(e => e.dataset.battTab)")
    t.check(tabs == ["usage", "charge"], "upstream ha-evcc: tabs usage and grid charging, no grid discharging", str(tabs))
    t.check("Wohin geht der Überschuss zuerst?" in page.locator(in_card(".batt-tab-body")).inner_text(), "usage tab first, with evcc's wording")
    t.check("verhindern" in page.locator(in_card(".batt-switch-desc")).inner_text(), "the discharge lock says what it does",
            page.locator(in_card(".batt-switch-desc")).inner_text())
    page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).click(); settle(page)
    t.check(page.locator(in_card("[data-batt-limit]")).count() == 0, "upstream ha-evcc: no grid charging switch")
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_charge_limit"]')).count() == 1, "upstream ha-evcc: the limit slider")
    t.check(page.locator(in_card(".slider-val")).inner_text().strip() == "keine", "a limit that is not set reads 'keine', not 0",
            page.locator(in_card(".slider-val")).inner_text())
    t.check(page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).get_attribute("aria-selected") == "true", "the chosen tab is marked")
    done(page)

    # evcc reads a buffer SoC of 0 as "no buffer" (100 %); ha-evcc then reports unknown
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", set={"select.evcc_buffer_soc": "unknown"})
    body = page.locator(in_card(".batt-tab-body")).inner_text()
    t.check("Batterie als Ladepuffer" in body and "Setze einen Wert unter" in body, "buffer without a value: shown as no buffer, as in evcc", body[:200])
    done(page)

    # with the proposed entities: a switch per function, the limit only while it is on
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True)
    tabs = page.locator(in_card("button.batt-tab")).evaluate_all("els => els.map(e => e.dataset.battTab)")
    t.check(tabs == ["usage", "charge", "discharge"], "with grid discharge entities: three tabs", str(tabs))
    page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).click(); settle(page)
    t.check(page.locator(in_card('[data-batt-limit="charge"]')).get_attribute("aria-checked") == "false", "grid charging off without a limit")
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_charge_limit"]')).count() == 0, "no slider while no limit is set")
    page.locator(in_card('button.batt-tab[data-batt-tab="discharge"]')).click(); settle(page)
    t.check(page.locator(in_card("[data-batt-discharge]")).get_attribute("aria-checked") == "false", "grid discharging off")
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_discharge_limit"]')).count() == 0, "no feed-in limit while discharging into the grid is off")
    fills = lambda: page.locator(in_card(".batt-slots-svg rect")).evaluate_all("els => [...new Set(els.map(e => e.getAttribute('fill')))]")
    t.check("Einspeisetarif" in page.locator(in_card(".batt-slots-legend")).inner_text(),
            "grid discharging off: the feed-in rates of the next 24 h, as grid charging shows the grid rates")
    t.check(fills() == ["var(--secondary-text-color,#888)"], "and nothing highlighted while it is off", str(fills()))
    done(page)
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True, set={"number.evcc_battery_grid_charge_limit": "0.21", "switch.evcc_battery_grid_discharge": "on"})
    page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).click(); settle(page)
    t.check(page.locator(in_card('[data-batt-limit="charge"]')).get_attribute("aria-checked") == "true", "grid charging on with a limit")
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_charge_limit"]')).count() == 1, "slider while a limit is set")
    t.check("24 h" in page.locator(in_card(".batt-active-row")).inner_text(), "active time of the next 24 h", page.locator(in_card(".batt-active-row")).inner_text())
    page.locator(in_card('button.batt-tab[data-batt-tab="discharge"]')).click(); settle(page)
    t.check(page.locator(in_card("[data-batt-discharge]")).count() == 1 and page.locator(in_card("[data-batt-limit]")).count() == 0,
            "grid discharging: one switch, no second one for the limit")
    t.check(page.locator(in_card('input[data-entity="number.evcc_battery_grid_discharge_limit"]')).count() == 1, "feed-in limit while discharging into the grid is allowed")
    t.check(page.locator(in_card(".slider-val")).inner_text().strip() == "keine", "allowed without a limit: the slider reads 'keine'")
    done(page)
    # the slots that meet a limit: green for charging, amber for discharging, as in evcc
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True, set={"number.evcc_battery_grid_charge_limit": "2.0",
              "switch.evcc_battery_grid_discharge": "on", "number.evcc_battery_grid_discharge_limit": "-0.5"})
    fills = lambda: page.locator(in_card(".batt-slots-svg rect")).evaluate_all("els => [...new Set(els.map(e => e.getAttribute('fill')))]")
    page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).click(); settle(page)
    t.check("var(--evcc-green)" in fills() and "var(--evcc-amber)" not in fills(), "grid charging: green slots", str(fills()))
    page.locator(in_card('button.batt-tab[data-batt-tab="discharge"]')).click(); settle(page)
    t.check("var(--evcc-amber)" in fills() and "var(--evcc-green)" not in fills(), "grid discharging: amber slots", str(fills()))
    done(page)

    # entities an older or newer ha-evcc left in the registry: HA keeps them as
    # unavailable and restored, the card offers no control for them
    restored = {"state": "unavailable"}
    gone = ["switch.evcc_battery_grid_discharge", "binary_sensor.evcc_battery_grid_discharge_active",
            "number.evcc_battery_grid_discharge_limit", "button.evcc_battery_grid_discharge_limit", "button.evcc_battery_grid_charge_limit"]
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True, set={e: "unavailable" for e in gone}, attrs={e: {"restored": True} for e in gone})
    tabs = page.locator(in_card("button.batt-tab")).evaluate_all("els => els.map(e => e.dataset.battTab)")
    t.check(tabs == ["usage", "charge"], "orphaned grid discharge entities: no tab for them", str(tabs))
    page.locator(in_card('button.batt-tab[data-batt-tab="charge"]')).click(); settle(page)
    t.check(page.locator(in_card("[data-batt-limit]")).count() == 0, "orphaned clear button: no grid charging switch, the slider instead")
    done(page)

    # a disabled clear button: warning triangle in the battery header, not at the loadpoints
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="battery", battery_ext=True, disable=["button.evcc_battery_grid_charge_limit"])
    t.check(page.locator(in_card(".battery-block .lp-disabled-warn")).count() == 1, "triangle in the battery header for the disabled clear button")
    done(page)
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]}, battery_ext=True, disable=["button.evcc_battery_grid_charge_limit"])
    t.check(page.locator(in_card(".lp-disabled-warn")).count() == 0, "no triangle at a loadpoint for the battery's clear button")
    done(page)


GROUPS = {"unit": unit, "render": render_smoke, "stats_fallback": stats_fallback, "stats_period": stats_period, "renderkey": renderkey, "lifecycle": lifecycle, "interaction": interactions, "editor": editor, "editor_vehicle_map": editor_vehicle_map, "editor_instances": editor_instances, "keyboard": keyboard, "morph": morph, "escaping": escaping, "contracts": contracts,
          "tariff": tariff_modes, "traffic": traffic, "priority": priority_dnd, "locales": locales, "discovery": discovery,
          "flow": flow_labels, "cardapi": card_api, "setconfig": setconfig, "widths": widths, "hints": hints, "disabled": disabled_entities, "solar_share": solar_share, "vehicle": vehicle_mode, "battery": battery_mode, "stable_height": stable_height}


# The groups that take longest go to the workers first, so the run is not left
# waiting for one of them at the end. Measured on the full run; a group missing
# here simply queues after these.
SLOW_FIRST = ["locales", "stats_period", "hints", "render", "interaction", "contracts", "discovery", "disabled", "tariff"]

_worker = {}


def _init_worker(browser_name, headed, out):
    """One browser per worker process, started once and used for every group it runs."""
    global OUT
    OUT = out
    from playwright.sync_api import sync_playwright
    _worker["pw"] = sync_playwright().start()
    _worker["browser"] = launch(_worker["pw"], browser_name, headed)


def _run_group(name, port, browser_name):
    """Runs one group in a worker; returns its printed output, results and duration."""
    import contextlib, io
    t = T(browser=browser_name)
    buf, t0 = io.StringIO(), time.time()
    with contextlib.redirect_stdout(buf):
        try: GROUPS[name](_worker["browser"], port, t)
        except Exception as e:   # a crashed group must not hide the other groups' results
            t.fail(f"{name}: group crashed", f"{type(e).__name__}: {str(e)[:300]}")
    return buf.getvalue(), t.results, time.time() - t0


def main():
    global OUT
    ap = argparse.ArgumentParser(); ap.add_argument("--headed", action="store_true")
    ap.add_argument("--only", action="append", choices=list(GROUPS), help="run only these groups (repeatable)")
    ap.add_argument("--browser", choices=BROWSERS, default=os.environ.get("EVCC_BROWSER", "chromium"),
                    help="engine under test (default: chromium, or $EVCC_BROWSER)")
    ap.add_argument("-j", "--jobs", type=int, default=int(os.environ.get("EVCC_JOBS", 0)) or os.cpu_count() or 1,
                    help="groups run in parallel, one browser each (default: CPU count, or $EVCC_JOBS)")
    a = ap.parse_args()
    if a.browser != "chromium": OUT = OUT / a.browser     # keep the Chromium reports and shots apart
    OUT.mkdir(parents=True, exist_ok=True)
    srv, port = serve()
    t = T(f"evcc-card tests ({a.browser})", browser=a.browser)
    names = [n for n in GROUPS if not a.only or n in a.only]
    jobs  = max(1, min(a.jobs, len(names)))
    if a.headed: jobs = 1   # one visible browser to watch

    # Workers are spawned, not forked: Playwright's driver must not be shared
    # with a child. Each group's output is printed in the usual order once it is
    # complete, whatever order the workers finish in.
    import multiprocessing
    order = sorted(names, key=lambda n: SLOW_FIRST.index(n) if n in SLOW_FIRST else len(SLOW_FIRST))
    with multiprocessing.get_context("spawn").Pool(jobs, _init_worker, (a.browser, a.headed, OUT)) as pool:
        pending = {n: pool.apply_async(_run_group, (n, port, a.browser)) for n in order}
        for name in names:
            output, results, secs = pending[name].get()
            print(output, end="")
            print(f"  ({secs:.1f} s)", file=sys.stderr)
            t.durations[name] = round(secs, 1)
            t.results.extend(results)
    srv.shutdown()
    report = t.write_reports(OUT, sorted(p.name for p in OUT.glob("*.png")))
    print(f"\n{len(t.results) - len(t.failed)} passed, {len(t.failed)} failed in {time.time() - t.started:.0f} s with {jobs} "
          f"worker{'s' if jobs > 1 else ''}  (report: {report}, screenshots in {OUT})")
    sys.exit(1 if t.failed else 0)


if __name__ == "__main__":
    main()
