#!/usr/bin/env python3
"""Contract check: every entity the card knows must exist in ha-evcc (evcc_intg).

The card's FEATURES array lists entity suffixes per domain. ha-evcc builds its
entity ids as  <domain>.<prefix>[<loadpoint>_]<snake_case(tag key)>, so a
feature is valid when its (domain, suffix) pair can be produced by one of the
entity description lists in ha-evcc's const.py.

Usage:
  python3 test/check_ha_evcc.py                     # uses ../ha-evcc next to this repo
  python3 test/check_ha_evcc.py --ha-evcc /path     # explicit checkout
  python3 test/check_ha_evcc.py --clone             # shallow-clone marq24/ha-evcc into a temp dir (CI)

Exit code 1 when a feature has no counterpart. A second, informational column
tells whether the entity was seen in test/fixtures/entity_registry.json.
"""
import argparse, json, re, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
UPSTREAM = "https://github.com/marq24/ha-evcc.git"

# Debian snake_case rules copied from ha-evcc's pyevcc_ha/keys.py
CC_P1 = re.compile(r"(.)([A-Z][a-z]+)")
CC_P2 = re.compile(r"([a-z0-9])([A-Z])")
def camel_to_snake(a_key):
    if a_key.lower().endswith("kwh"):
        a_key = a_key[:-3] + "_kwh"
    a_key = CC_P1.sub(r"\1_\2", a_key)
    return CC_P2.sub(r"\1_\2", a_key).lower()

# const.py list name → HA domain
DOMAIN_OF = {"SENSOR": "sensor", "BINARY": "binary_sensor", "NUMBER": "number", "SELECT": "select", "SWITCH": "switch", "BUTTONS": "button", "BUTTON": "button"}


def card_features():
    src = (ROOT / "dist" / "evcc-card.js").read_text(encoding="utf-8")
    block = src[src.index("const FEATURES = ["):]
    block = block[:block.index("\n];")]
    feats = []
    for m in re.finditer(r'\{\s*suffix:\s*"([^"]+)",\s*domain:\s*"([^"]+)",[^}]*?lp:\s*(true|false)', block):
        feats.append({"suffix": m.group(1), "domain": m.group(2), "lp": m.group(3) == "true"})
    return feats


def ha_evcc_tags(path):
    """Tag name → {"json_key": ..., "entity_key": ...} (ApiKey definitions may span lines)."""
    keys_py = (path / "custom_components/evcc_intg/pyevcc_ha/keys.py").read_text(encoding="utf-8")
    tags = {}
    for m in re.finditer(r"^\s+([A-Z0-9_]+)\s*=\s*ApiKey\((.*?)\)\s*$", keys_py, re.M | re.S):
        name, args = m.group(1), m.group(2)
        d = {}
        for field in ("json_key", "entity_key"):
            k = re.search(rf'\b{field}\s*=\s*"([^"]+)"', args)
            if k: d[field] = k.group(1)
        if d: tags[name] = d
    return tags


def _resolve_key(expr, tags):
    """Evaluate the simple `key=` expressions used in const.py: "literal",
    Tag.X.json_key, f"{Tag.X.json_key}_0", f"pv_{idx}_energy" is not used."""
    expr = expr.strip().rstrip(",")
    def sub(m):
        t = tags.get(m.group(1), {})
        return t.get(m.group(2), "")
    expr = re.sub(r"\{?Tag\.([A-Z0-9_]+)\.(json_key|entity_key)\}?", sub, expr)
    expr = re.sub(r'^f?"(.*)"$', r"\1", expr)
    return expr if re.fullmatch(r"[A-Za-z0-9_]+", expr) else None


def ha_evcc_entities(path, tags):
    """(domain, snake key) pairs per scope ('site' or 'loadpoint') from const.py's description lists.

    Entity ids are <domain>.<prefix>[<lp>_]<snake(key)> where key is the description's
    explicit `key=` (site lists) or the tag's json_key, plus `_<idx>` when a single
    json_idx is patched into the key (charge_currents_0, …)."""
    const_py = (path / "custom_components/evcc_intg/const.py").read_text(encoding="utf-8")
    out = {"site": set(), "loadpoint": set()}
    for m in re.finditer(r"^([A-Z_]+_ENTITIES[A-Z_]*)\s*(?::\s*Final\s*)?=\s*\[(.*?)^\]", const_py, re.M | re.S):
        name, body = m.group(1), m.group(2)
        domain = DOMAIN_OF.get(name.split("_")[0])
        if not domain: continue
        scope = "loadpoint" if "PER_LOADPOINT" in name else "site"
        for chunk in re.split(r"\n\s+Ext\w+\(", body):
            tm = re.search(r"tag\s*=\s*Tag\.([A-Z0-9_]+)", chunk)
            if not tm: continue
            tag = tags.get(tm.group(1), {})
            keys = set()
            km = re.search(r"(?<![A-Za-z_])key\s*=\s*(.+)", chunk)
            if km:
                k = _resolve_key(km.group(1), tags)
                if k: keys.add(k)
            if not keys:
                for f in ("entity_key", "json_key"):
                    if f in tag: keys.add(tag[f])
                im = re.search(r"json_idx\s*=\s*\[\s*(\d+)\s*\]", chunk)
                if im: keys = {f"{k}_{im.group(1)}" for k in keys}
            for k in keys:
                out[scope].add((domain, camel_to_snake(k)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ha-evcc", default=str(ROOT.parent / "ha-evcc"))
    ap.add_argument("--clone", action="store_true", help="shallow-clone upstream into a temp dir instead of --ha-evcc")
    a = ap.parse_args()
    if a.clone:
        tmp = tempfile.mkdtemp(prefix="ha-evcc-")
        subprocess.run(["git", "clone", "--depth", "1", "--quiet", UPSTREAM, tmp], check=True)
        path = Path(tmp)
    else:
        path = Path(a.ha_evcc)
    manifest = json.loads((path / "custom_components/evcc_intg/manifest.json").read_text())
    tags = ha_evcc_tags(path)
    ents = ha_evcc_entities(path, tags)
    registry = json.loads((ROOT / "test/fixtures/entity_registry.json").read_text(encoding="utf-8"))
    reg_ids = [e["entity_id"] for e in registry]

    feats = card_features()
    rows, failures = [], []
    for f in feats:
        scope = "loadpoint" if f["lp"] else "site"
        suffix = f["suffix"]
        ok = (f["domain"], suffix) in ents["site"] | ents["loadpoint"]
        # per-device features (pv_0_energy, battery_2_soc, …): ha-evcc derives them from the
        # device lists at runtime, so accept them when the un-indexed key exists (pv_energy, battery_soc)
        if not ok:
            base = re.sub(r"^(pv|battery)_\d+_", r"\1_", suffix)
            ok = base != suffix and (f["domain"], base) in ents["site"]
        pat = re.compile(rf"^{f['domain']}\.evcc_(.+_)?{re.escape(f['suffix'])}$" if f["lp"] else rf"^{f['domain']}\.evcc_{re.escape(f['suffix'])}$")
        seen = any(pat.match(i) for i in reg_ids)
        rows.append((f["domain"], f["suffix"], scope, ok, seen))
        if not ok: failures.append(f)

    print(f"ha-evcc {manifest.get('version')} at {path}: {len(tags)} tags, {len(ents['site'])} site + {len(ents['loadpoint'])} loadpoint entity keys")
    print(f"card FEATURES: {len(feats)} entries\n")
    print(f"{'domain':<14}{'suffix':<36}{'scope':<11}{'in ha-evcc':<12}{'in fixture'}")
    for d, sfx, scope, ok, seen in rows:
        print(f"{d:<14}{sfx:<36}{scope:<11}{'yes' if ok else 'NO':<12}{'yes' if seen else '-'}")
    print()
    if failures:
        print(f"FAILED: {len(failures)} feature(s) have no counterpart in ha-evcc:")
        for f in failures: print(f"  - {f['domain']}.*{f['suffix']} ({'loadpoint' if f['lp'] else 'site'})")
        sys.exit(1)
    print(f"OK: all {len(feats)} features exist in ha-evcc {manifest.get('version')}")


if __name__ == "__main__":
    main()
