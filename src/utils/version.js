// True when the ha-evcc version `v` ("2026.6.3") is older than `min`. Parts are
// compared as numbers, a suffix after the digits ("1b1") is ignored. Anything
// that does not parse ("UNKNOWN", a dev build without a version) counts as new
// enough: the card then trusts the commands ha-evcc announces.
export function versionBelow(v, min) {
  const parse = s => {
    const parts = String(s ?? "").split(".").map(p => parseInt(p, 10));
    return parts.length >= 2 && parts.every(Number.isFinite) ? parts : null;
  };
  const a = parse(v), b = parse(min);
  if (!a || !b) return false;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0, y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
