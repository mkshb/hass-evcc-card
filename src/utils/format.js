import { stateVal, unitStr } from "./state.js";

// Decimal places implied by a slider step (0.005 → 3, 1 → 0).
export function stepDecimals(step) {
  const s = String(step);
  if (s.includes("e-")) return parseInt(s.split("e-")[1], 10) || 0;
  return (s.split(".")[1] || "").length;
}

// Round to `decimals` places and drop trailing zeros ("0.250" → "0.25").
export function fmtNum(v, decimals) {
  const n = Number(v);
  if (isNaN(n)) return "";
  return String(Number(n.toFixed(decimals)));
}

// Parse an evcc-sourced timestamp that may be an RFC3339 string OR a unix
// timestamp (seconds or ms). Mirrors ha-evcc 2026.7.0 dual-format handling
// (marq24/ha-evcc, commit b2f0957). Returns a Date, or null if unparseable.
// Used only for RAW evcc values (WS forecast/plan rates, session created/
// finished); HA-recorder buckets and device_class:timestamp sensor states are
// always ISO and keep using new Date() directly.
export function evccDate(v) {
  if (v == null) return null;
  if (typeof v === "number") {
    const ms = v < 1e12 ? v * 1000 : v; // unix seconds vs milliseconds
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (/^\d+$/.test(t)) return evccDate(Number(t)); // numeric string
    const d = new Date(t);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// A duration in seconds as the card shows it everywhere: "41 min", "21 h 1 min",
// "2 d 3 h". Seconds only below a minute, a zero part is left out ("1 h").
// Empty for a value that is not a non-negative number.
export function fmtDuration(seconds) {
  const sec = seconds == null || seconds === "" ? NaN : Number(seconds);
  if (!Number.isFinite(sec) || sec < 0) return "";
  if (sec < 60) return `${Math.round(sec)} s`;
  const totalMin = Math.round(sec / 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return h > 0 ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

// A point in time as a short clock reading: "02:00" today, "Sa., 07:00" on
// another day. Empty for anything that is not a date.
export function fmtClock(iso, lang = "en") {
  if (!iso || iso === "unknown" || iso === "unavailable") return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  try {
    return d.toLocaleString(lang, today
      ? { hour: "2-digit", minute: "2-digit" }
      : { weekday: "short", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

export function fmtRemainingDuration(hass, entityId) {
  if (!entityId || !hass) return "";
  const raw = parseFloat(stateVal(hass, entityId));
  if (isNaN(raw) || raw <= 0) return "";
  const unit = (unitStr(hass, entityId) || "").toLowerCase();
  const seconds = unit.startsWith("min") ? raw * 60
                : unit.startsWith("h")   ? raw * 3600
                                         : raw;
  if (Math.round(seconds / 60) <= 0) return "";
  return fmtDuration(seconds);
}

export function fmtCountdownFromISO(iso) {
  if (!iso || iso === "unknown" || iso === "unavailable") return "";
  const target = Date.parse(iso);
  if (isNaN(target)) return "";
  const sec = Math.max(0, Math.round((target - Date.now()) / 1000));
  if (sec <= 0) return "";
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export function fmtCountdownFromTimestamp(hass, entityId) {
  if (!entityId || !hass) return "";
  return fmtCountdownFromISO(stateVal(hass, entityId));
}

export function socFillGradient(soc, minSoc, limitSoc) {
  const s   = Math.max(0.01, soc);
  const min = Math.max(0, minSoc  || 0);
  const lim = Math.min(100, limitSoc || 100);
  const amber = "var(--evcc-amber)", blue = "var(--evcc-blue)", green = "var(--evcc-green)";
  if (min <= 0 && lim >= 100) return blue;
  const stops = [];
  if (min > 0) {
    const minRel = Math.min((min / s) * 100, 100).toFixed(1);
    stops.push(`${amber} 0%`, `${amber} ${minRel}%`);
    if (s > min) stops.push(`${blue} ${minRel}%`);
  } else {
    stops.push(`${blue} 0%`);
  }
  if (lim < 100 && s > lim) {
    const limRel = Math.min((lim / s) * 100, 100).toFixed(1);
    stops.push(`${blue} ${limRel}%`, `${green} ${limRel}%`, `${green} 100%`);
  } else {
    stops.push(`${blue} 100%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function socTrackBg(minSoc, limitSoc) {
  const min = Math.max(0, minSoc  || 0);
  const lim = Math.min(100, limitSoc || 100);
  const base = "var(--divider-color, #e5e7eb)";
  if (min <= 0 && lim >= 100) return base;
  const stops = [];
  if (min > 0) stops.push(`rgba(245,158,11,.13) 0%`, `rgba(245,158,11,.13) ${min}%`, `${base} ${min}%`);
  else         stops.push(`${base} 0%`);
  if (lim < 100) stops.push(`${base} ${lim}%`, `rgba(34,197,94,.13) ${lim}%`, `rgba(34,197,94,.13) 100%`);
  else           stops.push(`${base} 100%`);
  return `linear-gradient(to right, ${stops.join(", ")})`;
}
