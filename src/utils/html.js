// The card builds its DOM from template literals, so anything that is free text
// in an evcc or HA configuration has to pass through these before it reaches
// innerHTML: loadpoint, vehicle and device titles, units, the currency, the
// card title and the option lists of the ha-evcc select entities. Entity ids
// are not escaped: HA validates them down to [a-z0-9_] plus one dot.

export function escHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function escAttr(str) {
  return escHtml(str);
}
