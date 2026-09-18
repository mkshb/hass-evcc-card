#!/usr/bin/env python3
"""Compare freshly rendered screenshots with the ones committed in images/.

Usage: python3 test/compare_images.py --new test/out --ref images [--tolerance 2.0]
A pair differs when its dimensions differ or when more than `tolerance` percent
of the pixels deviate by more than 32 in any channel (anti-aliasing noise from a
different Chromium build stays below that). Exit code 1 on any difference.
"""
import argparse, sys
from pathlib import Path
from PIL import Image, ImageChops
sys.path.insert(0, str(Path(__file__).resolve().parent))
from screenshots import SHOTS

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", default="test/out"); ap.add_argument("--ref", default="images")
    ap.add_argument("--tolerance", type=float, default=2.0, help="max percent of differing pixels")
    ap.add_argument("--summary", help="append a markdown table to this file (e.g. $GITHUB_STEP_SUMMARY)")
    a = ap.parse_args()
    new, ref = Path(a.new), Path(a.ref)
    # only the images screenshots.py produces; images/ also holds older hand-made files
    names = [f"{n}-{v}.png" for v in ("light", "dark") for n in list(SHOTS) + ["slider-input"]]
    rows, bad = [], []
    for name in names:
        n, r = new / name, ref / name
        if not n.exists():
            rows.append((name, "missing in new render", True)); bad.append(name); continue
        a_img, b_img = Image.open(n).convert("RGB"), Image.open(r).convert("RGB")
        if a_img.size != b_img.size:
            rows.append((name, f"size {a_img.size} vs {b_img.size}", True)); bad.append(name); continue
        diff = ImageChops.difference(a_img, b_img).point(lambda v: 255 if v > 32 else 0).convert("L")
        total = a_img.size[0] * a_img.size[1]
        changed = (total - diff.histogram()[0]) / total * 100
        over = changed > a.tolerance
        rows.append((name, f"{changed:.2f} % pixels differ", over))
        if over: bad.append(name)
    width = max(len(n) for n in names) if names else 10
    for name, detail, over in rows:
        print(f"{'DIFF' if over else 'ok  '} {name:<{width}}  {detail}")
    if a.summary:
        with open(a.summary, "a", encoding="utf-8") as f:
            f.write(f"\n## Screenshot comparison (tolerance {a.tolerance} %)\n\n| Image | Result | Detail |\n|---|---|---|\n")
            for name, detail, over in rows: f.write(f"| {name} | {'DIFF' if over else 'ok'} | {detail} |\n")
    if bad:
        print(f"\n{len(bad)} image(s) differ from the committed screenshots: {', '.join(bad)}")
        print("Regenerate with: python3 test/screenshots.py --out images"); sys.exit(1)
    print(f"\nall {len(rows)} screenshots match within {a.tolerance} %")

if __name__ == "__main__":
    main()
