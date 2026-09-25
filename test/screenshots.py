#!/usr/bin/env python3
"""README screenshots from the test harness (mock hass, frozen clock, no HA needed).

Screenshots are taken with animations disabled: CSS animations run on real time
(the frozen clock only covers Date), so the SoC bar's charging pulse would be
captured at a random opacity. Playwright rewinds infinite animations to their
first frame and fast-forwards finite ones, which makes the images reproducible.

Usage: python3 test/screenshots.py [--out images] [--only NAME]
Writes <name>-light.png / <name>-dark.png for every entry in SHOTS: the card
element itself (470 px wide) for each mode, plus the slider-input crop.
"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import serve, open_card, in_card, new_page, done, OUT, T, launch

WIDTH = 470
LP = ["openwb"]   # the EV loadpoint; "wp" is a heating loadpoint and would double the height

# name -> card config. One entry per README image pair.
SHOTS = {
    "loadpoint":  {"mode": "loadpoint",  "loadpoints": LP},
    "compact":    {"mode": "compact",    "loadpoints": LP},
    "plan":       {"mode": "plan",       "loadpoints": LP},
    "site":       {"mode": "site"},
    "flow":       {"mode": "flow"},
    "grid":       {"mode": "grid"},
    "stats":      {"mode": "stats"},
    "battery":    {"mode": "battery"},
    "priority":   {"mode": "priority"},
    "repeatplan": {"mode": "repeatplan"},
}

# name -> states set on top of the fixture. The loadpoint views get a charge
# plan for tomorrow morning, so the plan chip under the header is in the image.
PLAN = {"sensor.evcc_openwb_plan_projected_start": "2026-09-19T02:00:00+02:00",
        "sensor.evcc_openwb_plan_projected_end":   "2026-09-19T06:30:00+02:00",
        "sensor.evcc_openwb_effective_plan_time":  "2026-09-19T07:00:00+02:00",
        "sensor.evcc_openwb_effective_plan_soc":   "80"}
STATES = {"loadpoint": PLAN, "compact": PLAN}


def union(*boxes):
    x0 = min(b["x"] for b in boxes); y0 = min(b["y"] for b in boxes)
    x1 = max(b["x"] + b["width"] for b in boxes); y1 = max(b["y"] + b["height"] for b in boxes)
    return x0, y0, x1, y1


def shot_mode(browser, port, name, config, dark, out):
    page = new_page(browser, WIDTH + 50, 1600)
    errors = open_card(page, port, dark=dark, width=WIDTH, config=config, set=STATES.get(name))
    path = out / f"{name}-{'dark' if dark else 'light'}.png"
    page.locator(in_card("ha-card")).screenshot(path=str(path), animations="disabled")
    done(page)
    return path, errors


def shot_slider_input(browser, port, dark, out):
    page = new_page(browser, WIDTH + 50, 1600)
    errors = open_card(page, port, dark=dark, width=WIDTH,
                       config={"mode": "loadpoint", "loadpoints": LP, "charge_current_settings": "expanded"})
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    page.locator(in_card(".slider-edit-input")).fill("85")
    page.wait_for_timeout(150)
    card = page.locator(in_card("ha-card")).bounding_box()
    x0, y0, x1, y1 = union(page.locator(in_card(".sliders")).bounding_box(),
                           page.locator(in_card(".current-block")).bounding_box())
    path = out / f"slider-input-{'dark' if dark else 'light'}.png"
    page.screenshot(path=str(path), animations="disabled",
                    clip={"x": card["x"], "y": y0 - 10, "width": card["width"], "height": (y1 - y0) + 20})
    done(page)
    return path, errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--only", help="one entry of SHOTS or 'slider-input'")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    t = T("evcc-card screenshots"); shots = []
    srv, port = serve()
    with sync_playwright() as p:
        browser = launch(p)   # always Chromium: images/ are Chromium renders
        for dark in (False, True):
            t.group("dark" if dark else "light")
            jobs = [(name, lambda n=name, c=config: shot_mode(browser, port, n, c, dark, out))
                    for name, config in SHOTS.items() if not a.only or a.only == name]
            if not a.only or a.only == "slider-input":
                jobs.append(("slider-input", lambda: shot_slider_input(browser, port, dark, out)))
            for name, job in jobs:
                path, errors = job()
                shots.append(str(path))
                # A screenshot of a page with console errors is not a valid README image.
                t.check(not errors, f"{name}: rendered without console errors → {path.name}", "; ".join(errors)[:300])
        browser.close()
    srv.shutdown()
    report = t.write_reports(OUT, shots)
    print(f"\n{len(t.results) - len(t.failed)} ok, {len(t.failed)} with errors  (report: {report})")
    sys.exit(1 if t.failed else 0)


if __name__ == "__main__":
    main()
