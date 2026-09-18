#!/usr/bin/env python3
"""README screenshots from the test harness (mock hass, frozen clock, no HA needed).

Usage: python3 test/screenshots.py [--out images] [--only NAME]
Writes <name>-light.png / <name>-dark.png for every entry in SHOTS: the card
element itself (470 px wide) for each mode, plus the slider-input crop.
"""
import argparse, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from run import serve, open_card, in_card, new_page, OUT

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


def union(*boxes):
    x0 = min(b["x"] for b in boxes); y0 = min(b["y"] for b in boxes)
    x1 = max(b["x"] + b["width"] for b in boxes); y1 = max(b["y"] + b["height"] for b in boxes)
    return x0, y0, x1, y1


def shot_mode(browser, port, name, config, dark, out):
    page = new_page(browser, WIDTH + 50, 1600)
    open_card(page, port, dark=dark, width=WIDTH, config=config)
    path = out / f"{name}-{'dark' if dark else 'light'}.png"
    page.locator(in_card("ha-card")).screenshot(path=str(path))
    page.close()
    return path


def shot_slider_input(browser, port, dark, out):
    page = new_page(browser, WIDTH + 50, 1600)
    open_card(page, port, dark=dark, width=WIDTH,
              config={"mode": "loadpoint", "loadpoints": LP, "charge_current_settings": "expanded"})
    page.locator(in_card('input[data-entity="number.evcc_openwb_limit_soc"] + button.slider-val')).click()
    page.locator(in_card(".slider-edit-input")).fill("85")
    page.wait_for_timeout(150)
    card = page.locator(in_card("ha-card")).bounding_box()
    x0, y0, x1, y1 = union(page.locator(in_card(".sliders")).bounding_box(),
                           page.locator(in_card(".current-block")).bounding_box())
    path = out / f"slider-input-{'dark' if dark else 'light'}.png"
    page.screenshot(path=str(path), clip={"x": card["x"], "y": y0 - 10, "width": card["width"], "height": (y1 - y0) + 20})
    page.close()
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--only", help="one entry of SHOTS or 'slider-input'")
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    from playwright.sync_api import sync_playwright
    srv, port = serve()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path="/usr/bin/chromium", headless=True, args=["--no-sandbox", "--lang=de-DE"])
        for dark in (False, True):
            for name, config in SHOTS.items():
                if a.only and a.only != name: continue
                print("wrote", shot_mode(browser, port, name, config, dark, out))
            if not a.only or a.only == "slider-input":
                print("wrote", shot_slider_input(browser, port, dark, out))
        browser.close()
    srv.shutdown()


if __name__ == "__main__":
    main()
