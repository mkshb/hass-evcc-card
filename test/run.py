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
    def __init__(self, suite="evcc-card tests", browser="chromium", frozen_time=FIXED_TIME):
        self.suite, self.browser, self.results, self.started, self.section = suite, browser, [], time.time(), ""
        self.frozen_time = frozen_time   # None for a run on the live clock (test/e2e.py)
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
                "duration_s": round(time.time() - self.started, 1), "fixed_browser_time": self.frozen_time, "passed": passed, "failed": failed}
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


def new_page(browser, width=480, height=900):
    ctx = browser.new_context(viewport={"width": width, "height": height}, timezone_id=TIMEZONE, locale=LOCALE)
    page = ctx.new_page()
    page.clock.set_fixed_time(FIXED_TIME)
    return page


def open_card(page, port, config=None, mode=None, dark=False, width=400, lang="de", ws=True, set=None, disable=None,
              rename=None, attrs=None, tariff=None, second=None, wsname=None):
    q = {"w": width, "lang": lang}
    if not ws: q["ws"] = 0
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
    page.close()



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
    page.close()


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
            page.close()

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
            page.close()


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

    modes = lambda: page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.mode-btn')].map(x => x.dataset.value)")
    before = modes()
    page.evaluate("window.__renders = 0")
    page.evaluate("""() => window.__push(st => {
      const id = 'select.evcc_openwb_mode';
      st[id] = { ...st[id], attributes: { ...st[id].attributes, options: ['off', 'smart', 'now'] } };
    })""")
    page.wait_for_timeout(900)
    t.check(page.evaluate("window.__renders") >= 1, "changed select options trigger a render", str(page.evaluate("window.__renders")))
    t.check(modes() != before and "smart" in modes(), "the mode buttons follow the new options", f"{before} -> {modes()}")

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
    page.close()

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
      for (const mode of modes) {
        c.setConfig({ mode, charge_current_settings: 'expanded' });
        c.hass = { ...hass, states };
        c._lastRenderKey = null;
        c._render();
      }
      return [...reads];
    }""", MODES)
    unknown = sorted(set(read) - set(declared))
    t.check(not unknown, "no attribute is read that the render key ignores", f"read {len(read)}, missing from RENDER_ATTRS: {unknown}")
    unused = sorted(set(declared) - set(read))
    t.check(not unused, "RENDER_ATTRS carries no attribute the card never reads", f"never read: {unused}")
    page.close()


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
    page2.close()

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
    page.close()

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
        page.close()

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
    page.close()

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
        page.close()

    # Live updates of the power value and the SoC keep the attribute in place.
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    page.evaluate("() => { const c = window.__card; c._updateLiveValues(); }")
    kept = page.evaluate("""() => ['.power-value', '[data-live-type="soc-pct"]']
        .map(s => window.__card.shadowRoot.querySelector(s)?.dataset.moreInfo)""")
    t.check(all(kept), "a live update leaves the more-info attribute on the value", json.dumps(kept))
    page.close()

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
    page.close()

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
    page.close()

    # --- the charging pulse keeps its phase across renders --------------------------
    t.group("interaction - charging pulse")
    page = new_page(browser, 480, 1600)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    phase = lambda: page.evaluate("""() => { const c = window.__card; c._lastRenderKey = null; c._render();
        const el = c.shadowRoot.querySelector('.soc-fill.charging'); const a = el?.getAnimations()[0];
        // the phase is the negative delay: where in the 1.4 s cycle the fresh element starts
        return a ? { t: ((a.currentTime - a.effect.getTiming().delay) % 1400 + 1400) % 1400, wall: Date.now() % 1400 } : null; }""")
    # The harness clock is fixed, so the 700 ms pass on the clock, not in real time.
    a = phase()
    page.clock.set_fixed_time("2026-09-18T13:00:00.700+02:00"); b = phase()
    page.clock.set_fixed_time(FIXED_TIME)
    close = lambda r: r and abs(((r["t"] - r["wall"]) + 700) % 1400 - 700) < 120
    t.check(close(a) and close(b), "a re-rendered charging bar continues the pulse at the wall-clock phase", json.dumps([a, b]))
    t.check(a and b and abs(((b["t"] - a["t"]) + 700) % 1400 - 700) > 400,
            "two renders 700 ms apart sit at different phases", json.dumps([a, b]))
    page.close()


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
    cb    = lambda field, lp: page.locator(f'evcc-card-editor input[data-field="{field}"][data-lp="{lp}"]')

    mount({"mode": "loadpoint", "hide_settings": ["priority"]})
    boxes = page.evaluate("""() => {
      const b = [...document.querySelector("evcc-card-editor").shadowRoot.querySelectorAll('input[data-field="hide_settings"]')];
      return { count: b.length, checked: b.filter(x => x.checked).map(x => x.dataset.lp) };
    }""")
    t.check(boxes["count"] == 9 and boxes["checked"] == ["priority"], "existing config is reflected in the checkboxes", json.dumps(boxes))
    t.check(count() == 0, "mounting alone emits nothing", f"{count()} events")

    # --- free text ---------------------------------------------------------------
    fld("#title").fill("Garage")
    t.check(last().get("title") == "Garage", "title input writes config.title", json.dumps(last()))
    t.check(last().get("mode") == "loadpoint" and last().get("hide_settings") == ["priority"],
            "the emitted config is complete, not just the changed key", json.dumps(last()))
    fld("#title").fill("   ")
    t.check("title" not in last(), "a blank title drops the key instead of storing an empty string", json.dumps(last()))

    # --- selects -----------------------------------------------------------------
    for sel, value in (("language", "en"), ("size", "large"), ("disabled_loadpoints", "dim"),
                       ("charge_current_settings", "expanded")):
        before = count()
        fld(f"#{sel}").select_option(value)
        t.check(last().get(sel) == value and count() == before + 1,
                f"{sel} writes config.{sel} in one event", json.dumps({k: last().get(k) for k in (sel,)}))
    for sel in ("language", "size", "disabled_loadpoints"):
        fld(f"#{sel}").select_option("")
        t.check(sel not in last(), f"{sel} back to its default drops the key", json.dumps(last()))

    # --- checkbox groups ---------------------------------------------------------
    for field, a, b in (("loadpoints", "openwb", "wp"), ("no_plan", "openwb", "wp"), ("no_pv", "openwb", "wp"),
                        ("hide_settings", "min_soc", "phases")):
        cb(field, a).check()
        t.check(last().get(field, [])[-1:] == [a], f"{field}: checking {a} appends it", json.dumps(last().get(field)))
        cb(field, b).check()
        got = last().get(field, [])
        t.check(a in got and b in got, f"{field}: a second box adds to the list", json.dumps(got))
        cb(field, a).uncheck()
        t.check(a not in last().get(field, []) and b in last().get(field, []),
                f"{field}: unchecking removes only that entry", json.dumps(last().get(field)))
    cb("no_pv", "wp").uncheck()
    t.check("no_pv" not in last(), "emptying a checkbox group drops the key", json.dumps(last()))

    # --- mode switch re-renders the form -----------------------------------------
    fld("#mode").select_option("site")
    page.wait_for_timeout(400)
    t.check(last().get("mode") == "site", "mode select writes config.mode", json.dumps(last().get("mode")))
    t.check(fld("#site_details").count() == 1 and fld("#charge_current_settings").count() == 0,
            "the form re-renders with the fields of the new mode",
            f"site_details={fld('#site_details').count()} charge_current={fld('#charge_current_settings').count()}")
    fld("#site_details").select_option("collapsed")
    t.check(last().get("site_details") == "collapsed", "site_details writes config.site_details", json.dumps(last()))
    fld("#stats_period").select_option("month")
    t.check(last().get("stats_period") == "month", "stats_period writes config.stats_period", json.dumps(last()))
    fld("#stats_period").select_option("")
    t.check("stats_period" not in last(), "stats_period back to its default drops the key", json.dumps(last()))
    page.close()

    # --- stats_period: what the editor shows must be what the card does ----------
    # Unconfigured, the card follows the default of its mode; the editor says so
    # instead of preselecting an option. A legacy value keeps its own meaning and
    # is offered as such, rather than silently displaying a neighbouring one.
    t.group("editor - stats_period reflects the card")
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "stats"})
    sel_val = lambda: page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.getElementById('stats_period').value")
    opts    = lambda: page.evaluate("[...document.querySelector('evcc-card-editor').shadowRoot.getElementById('stats_period').options].map(o => o.value)")
    loc_ed  = json.loads((ROOT / "dist/locales/en.json").read_text(encoding="utf-8"))
    for mode, default_key in (("stats", "statsPeriodMonth"), ("site", "editorStatsPeriodTotal")):
        mount({"mode": mode, "language": "en"})
        want = loc_ed["editorStatsPeriodDefault"].replace("{val}", loc_ed[default_key])
        got  = page.evaluate("""() => { const s = document.querySelector('evcc-card-editor').shadowRoot.getElementById('stats_period');
                                        return { value: s.value, label: s.options[s.selectedIndex].textContent.trim() }; }""")
        t.check(got["value"] == "" and got["label"] == want,
                f"{mode}: unconfigured shows \"{want}\", not a preselected period", json.dumps(got))
        t.check(count() == 0, f"{mode}: showing the default emits nothing", f"{count()} events")
    for value in ("30d", "365d", "thisYear"):
        mount({"mode": "stats", "language": "en", "stats_period": value})
        t.check(sel_val() == value and value in opts(), f"legacy value {value} stays selected in the editor",
                f"value {sel_val()} in {opts()}")
        t.check(count() == 0, f"legacy value {value} is not rewritten on open", json.dumps(page.evaluate("window.__cfg")))
    mount({"mode": "stats", "language": "en", "stats_period": "month"})
    t.check(opts() == ["", "month", "year", "total", "none"],
            "without a legacy value the list stays on the current vocabulary", json.dumps(opts()))

    fld("#mode").select_option("repeatplan")
    page.wait_for_timeout(400)
    t.check(fld('input[data-field="repeating_plan_vehicles"]').count() == 2,
            "repeatplan offers the vehicles discovered from the registry",
            str(fld('input[data-field="repeating_plan_vehicles"]').count()))
    cb("repeating_plan_vehicles", "ex30").check()
    t.check(last().get("repeating_plan_vehicles") == ["ex30"], "vehicle filter writes config.repeating_plan_vehicles", json.dumps(last()))
    page.close()


def contracts(browser, port, t):
    """Every writing control must call the right HA service with the right payload."""
    t.group("contracts - writing actions and their service calls")
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"})
    last = lambda: svc(page)[-1]
    exp  = lambda domain, service, data: {"domain": domain, "service": service, "data": data}

    # releasing a slider writes through the same path as the arrow keys
    def drag_to_end(sel):
        el  = page.locator(in_card(sel))
        box = el.bounding_box()
        el.click(position={"x": box["width"] - 1, "y": box["height"] / 2})
        page.wait_for_timeout(400)

    drag_to_end('input[data-entity="number.evcc_openwb_limit_soc"]')
    t.check(last() == exp("number", "set_value", {"entity_id": "number.evcc_openwb_limit_soc", "value": 100}),
            "slider released at the max → number.set_value 100", json.dumps(last()))
    drag_to_end('input[data-entity="select.evcc_openwb_min_current"]')
    t.check(last() == exp("select", "select_option", {"entity_id": "select.evcc_openwb_min_current", "option": "16"}),
            "select slider released at the max → select.select_option 16", json.dumps(last()))

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

    # A guest vehicle (vehicle select on "null") has no plan of its own, and a
    # loadpoint plan is an energy target in kWh, which this block does not collect.
    # ha-evcc takes such a call and does nothing with it (set_plan() drops a
    # loadpoint or energy that is not an integer, without an error), so the card
    # must refuse it rather than report a plan that evcc never received.
    page = new_page(browser, 480, 1800)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]}, set={"select.evcc_openwb_vehicle_name": "null"})
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.locator(in_card("input.plan-time-input")).fill("2026-09-19T07:00"); page.wait_for_timeout(300)
    before = len(svc(page))
    page.locator(in_card("button.plan-btn.save")).click(); page.wait_for_timeout(400)
    err   = page.locator(in_card(".plan-error")).inner_text() if page.locator(in_card(".plan-error")).count() else ""
    badge = page.locator(in_card(".plan-badge.planned")).count()
    t.check(len(svc(page)) == before and "SoC" in err and badge == 0,
            "guest vehicle: set plan → no service call, error instead of a plan badge",
            f"calls+{len(svc(page)) - before} err={err!r} badge={badge}")
    page.close()

    # Deleting needs no kWh target, only the 1-based evcc loadpoint index, which the
    # card resolves through the capabilities command (here: the sorted-name fallback).
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]},
              set={"select.evcc_openwb_vehicle_name": "null", "binary_sensor.evcc_openwb_plan_active": "on"})
    page.locator(in_card("button.plan-btn.delete")).click(); page.wait_for_timeout(300)
    t.check(last() == exp("evcc_intg", "del_loadpoint_plan", {"loadpoint": 1}),
            "guest vehicle: delete plan → evcc_intg.del_loadpoint_plan with the loadpoint index", json.dumps(last()))
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


def tariff_modes(browser, port, t):
    """no_pv mode sets and the co2 tariff variant.

    A loadpoint without solar mirrors evcc's Mode.vue: the PV modes disappear,
    and if a dynamic tariff is available 'pv' is relabelled as the smart mode.
    Which tariff sensor decides that depends on whether evcc runs on prices or
    on a co2 signal, which the card reads from the smart cost limit's unit.
    """
    t.group("tariff - no_pv mode sets")
    modes = lambda page: page.evaluate("[...window.__card.shadowRoot.querySelectorAll('.mode-btn')].map(b => b.dataset.value)")

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"]})
    t.check(modes(page) == ["off", "pv", "minpv", "now"], "with solar: the full mode set", str(modes(page)))
    page.close()

    # no_pv + a valid price tariff → [off, smart, now]; 'pv' carries the smart label
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]})
    got = modes(page)
    t.check(got == ["off", "pv", "now"], "no_pv with a price tariff: minpv is dropped", str(got))
    smart_label = page.evaluate("window.__card._t('modeSmart')")
    label = page.evaluate("window.__card.shadowRoot.querySelector('.mode-btn[data-value=\"pv\"] .mode-label').textContent.trim()")
    t.check(label == smart_label, "no_pv: the pv button is relabelled as the smart mode", f"{label!r} vs {smart_label!r}")
    page.close()

    # no_pv without any tariff → [off, now]
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              set={"sensor.evcc_tariff_grid": "unknown", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "now"], "no_pv without a tariff: no smart mode either", str(got))
    page.close()

    t.group("tariff - co2 signal instead of prices")
    # The unit on the smart cost limit is what tells the card to read tariff_co2
    # rather than tariff_grid; with a valid co2 value the smart mode comes back.
    co2_attrs = {"number.evcc_openwb_smart_cost_limit": {"unit_of_measurement": "g/kWh"}}
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              attrs=co2_attrs, tariff="co2",
              set={"sensor.evcc_tariff_grid": "unknown", "sensor.evcc_tariff_co2": "310", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "pv", "now"], "co2 tariff: the smart mode is read from tariff_co2, not tariff_grid", str(got))
    page.close()

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "no_pv": ["openwb"]},
              attrs=co2_attrs, tariff="co2",
              set={"sensor.evcc_tariff_grid": "0.202", "sensor.evcc_tariff_co2": "unknown", "select.evcc_openwb_mode": "off"})
    got = modes(page)
    t.check(got == ["off", "now"], "co2 tariff: a valid price sensor does not stand in for a missing co2 value", str(got))
    page.close()

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
    page.close()

    # Counter-check on the same fixtures: as a price tariff it is currency again.
    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "plan", "loadpoints": ["openwb"]})
    page.locator(in_card("button.plan-soc-val")).click()
    page.locator(in_card(".slider-edit-input")).fill("80"); page.locator(in_card("[data-edit-ok]")).click()
    page.wait_for_timeout(1500)
    header = page.locator(in_card(".plan-preview-header")).inner_text()
    t.check("\u20ac/kWh" in header and "g/kWh" not in header, "price tariff keeps currency per kWh", " ".join(header.split())[:160])
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
    page.close()

    page = new_page(browser, 480, 1400)
    errors = open_card(page, port, config={"mode": "plan", "loadpoints": ["wp"]}, set=heating_plan)
    previews = [c for c in page.evaluate("window.__hass.wsCalls") if c["type"] == "evcc_intg/plan_preview"]
    t.check(page.locator(in_card(".plan-block")).count() == 0 and page.locator(in_card(".loadpoint")).count() == 0
            and not previews and not errors,
            "plan mode on a heating loadpoint: no block, no plan_preview call",
            f"previews={len(previews)}; " + "; ".join(errors)[:200])
    page.close()

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint", "loadpoints": ["openwb"], "charge_current_settings": "expanded"},
              disable=["number.evcc_openwb_smart_cost_limit", "number.evcc_openwb_smart_feed_in_priority_limit"])
    t.check(page.locator(in_card(".smart-cost-section")).count() == 0 and page.locator(in_card(".current-block")).count() == 1,
            "disabled limit entities: sections absent, block still rendered")
    page.close()

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
        page.close()
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
    page.close()


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
        page.close()


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
        p2.close()

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
    stub.close()

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
    second.close()

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
    second.close()

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

    page.close()


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
        ({"prefix": "evcc2_", "language": "en"}, "prefix and language"),
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
    page.close()


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
        page.close()


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
    opts = lambda page: page.evaluate("""() => { const s = document.querySelector('evcc-card-editor').shadowRoot.getElementById('prefix');
      return s ? [...s.options].map(o => o.value) : null; }""")

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint"})
    mount(page, {"mode": "loadpoint"})
    t.check(opts(page) is None, "one ha-evcc entry: no instance field", json.dumps(opts(page)))
    page.close()

    page = new_page(browser, 480, 1400)
    open_card(page, port, config={"mode": "loadpoint"}, second={"prefix": "evcc_demo_"})
    mount(page, {"mode": "loadpoint", "loadpoints": ["openwb"]})
    t.check(opts(page) == ["evcc_", "evcc_demo_"], "two entries: the instance field lists both prefixes", json.dumps(opts(page)))
    sel = page.locator("evcc-card-editor #prefix")
    sel.select_option("evcc_demo_"); page.wait_for_timeout(200)
    got = last(page)
    t.check(got.get("prefix") == "evcc_demo_" and "loadpoints" not in got,
            "picking the second instance writes its prefix and clears the loadpoint filter", json.dumps(got))
    t.check(page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.getElementById('prefix').value") == "evcc_demo_",
            "the field keeps the selection after the re-render")
    page.locator("evcc-card-editor #prefix").select_option("evcc_"); page.wait_for_timeout(200)
    got = last(page)
    t.check("prefix" not in got, "picking the first instance drops the prefix again (auto-detection)", json.dumps(got))
    mount(page, {"mode": "loadpoint", "prefix": "evcc_demo_"})
    t.check(page.evaluate("document.querySelector('evcc-card-editor').shadowRoot.getElementById('prefix').value") == "evcc_demo_",
            "a configured prefix is preselected")
    page.close()


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
        page.close()

    # Enter and Space on a focused more-info row fire the event a click would
    # (the site view has them as plain divs; the loadpoint view uses buttons).
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="site")
    page.evaluate(hook)
    row = page.locator(in_card("div[data-more-info]")).first
    row.focus(); page.keyboard.press("Enter"); page.keyboard.press(" ")
    fired = page.evaluate("window.__moreInfo")
    t.check(len(fired) == 2 and all(fired), "site: Enter and Space on a focused row open more-info", json.dumps(fired))
    page.close()

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
    page.close()

    t.group("keyboard - language fallback")
    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="loadpoint")
    label = lambda: page.locator(in_card('button.mode-btn[data-value="off"] .mode-label')).first.inner_text().strip()
    t.check(label() == "Aus", "with hass.language de the card is German", label())
    page.evaluate("() => { const c = window.__card; c.hass = { ...window.__hass, language: undefined, locale: {} }; c._lastRenderKey = null; c._render(); }")
    page.wait_for_timeout(200)
    t.check(label() == "Off", "without a language from HA the card falls back to English", label())
    page.close()

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
    page.close()

    page = new_page(browser, 480, 1600)
    open_card(page, port, mode="loadpoint")
    ed = page.evaluate("""async () => {
      const ed = document.createElement('evcc-card-editor'); ed.setConfig({ mode: 'loadpoint' });
      ed.hass = { ...window.__hass, language: undefined, locale: {} }; document.body.appendChild(ed);
      await new Promise(r => setTimeout(r, 700));
      return ed.shadowRoot.querySelector('label[for=mode]')?.textContent.trim();
    }""")
    t.check(ed == "Mode", "without a language from HA the editor falls back to English", str(ed))
    page.close()


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
        page.close()


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


GROUPS = {"unit": unit, "render": render_smoke, "stats_fallback": stats_fallback, "stats_period": stats_period, "renderkey": renderkey, "lifecycle": lifecycle, "interaction": interactions, "editor": editor, "editor_instances": editor_instances, "keyboard": keyboard, "escaping": escaping, "contracts": contracts,
          "tariff": tariff_modes, "traffic": traffic, "priority": priority_dnd, "locales": locales, "discovery": discovery,
          "flow": flow_labels, "cardapi": card_api, "setconfig": setconfig, "widths": widths}


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
