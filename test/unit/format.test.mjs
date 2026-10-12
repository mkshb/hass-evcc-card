// Formatting helpers. These are the functions with real edge cases (missing
// values, two timestamp formats, a division that can hit zero) and the ones a
// render test can only observe indirectly.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepDecimals, fmtNum, evccDate, fmtDuration, fmtClock, fmtRemainingDuration, durationSeconds,
  fmtCountdownFromISO, fmtCountdownFromTimestamp, socFillGradient, socTrackBg,
  fmtPrice, priceCurrency, priceScale,
} from "../../src/utils/format.js";

const hassWith = (state, unit) => ({
  states: { "sensor.x": { state: String(state), attributes: unit ? { unit_of_measurement: unit } : {} } },
});

// --- stepDecimals ------------------------------------------------------------

test("stepDecimals counts the decimals a slider step implies", () => {
  assert.equal(stepDecimals(1), 0);
  assert.equal(stepDecimals(5), 0);
  assert.equal(stepDecimals(0.5), 1);
  assert.equal(stepDecimals(0.05), 2);
  assert.equal(stepDecimals(0.005), 3, "the price limit step");
  assert.equal(stepDecimals("0.25"), 2, "steps also arrive as strings from the config");
});

test("stepDecimals handles the exponential form JS switches to below 1e-6", () => {
  assert.equal(String(0.0000001), "1e-7", "precondition: JS formats it exponentially");
  assert.equal(stepDecimals(0.0000001), 7);
  assert.equal(stepDecimals(0.000001), 6, "still plain decimal notation");
});

// --- fmtNum ------------------------------------------------------------------

test("fmtNum rounds and drops trailing zeros", () => {
  assert.equal(fmtNum(0.25, 3), "0.25");
  assert.equal(fmtNum(90, 0), "90");
  assert.equal(fmtNum(12.3456, 2), "12.35");
  assert.equal(fmtNum(2.5, 0), "3", "toFixed rounds half away from zero");
});

test("fmtNum absorbs float noise", () => {
  assert.equal(fmtNum(0.1 + 0.2, 2), "0.3");
});

test("fmtNum never prints a negative zero", () => {
  assert.equal(fmtNum(-0.004, 2), "0");
});

test("fmtNum returns an empty string for anything unparseable", () => {
  assert.equal(fmtNum("abc", 2), "");
  assert.equal(fmtNum(undefined, 2), "");
  assert.equal(fmtNum(NaN, 2), "");
});

// --- evccDate ----------------------------------------------------------------

const EPOCH_S  = 1789729200;          // 2026-09-18T11:00:00Z
const EPOCH_MS = EPOCH_S * 1000;

test("evccDate accepts unix seconds and milliseconds", () => {
  assert.equal(evccDate(EPOCH_S).getTime(), EPOCH_MS, "seconds are scaled up");
  assert.equal(evccDate(EPOCH_MS).getTime(), EPOCH_MS, "milliseconds are kept");
});

test("evccDate accepts a numeric string, the form a JSON fixture may carry", () => {
  assert.equal(evccDate(String(EPOCH_S)).getTime(), EPOCH_MS);
});

test("evccDate parses RFC3339 with an offset and trims surrounding space", () => {
  assert.equal(evccDate("2026-09-18T13:00:00+02:00").getTime(), EPOCH_MS);
  assert.equal(evccDate("  2026-09-18T11:00:00Z  ").getTime(), EPOCH_MS);
});

test("evccDate returns null instead of an Invalid Date", () => {
  for (const bad of [null, undefined, "", "not a date", true, {}, NaN]) {
    assert.equal(evccDate(bad), null, `input: ${String(bad)}`);
  }
});

// --- fmtClock ----------------------------------------------------------------

test("fmtClock reads the time alone today and adds the weekday on another day", () => {
  const today = new Date(); today.setHours(12, 34, 0, 0);
  const other = new Date(today); other.setDate(other.getDate() + 1);
  assert.equal(fmtClock(today.toISOString(), "de"), "12:34");
  const weekday = other.toLocaleString("de", { weekday: "short" });
  assert.ok(fmtClock(other.toISOString(), "de").startsWith(weekday), fmtClock(other.toISOString(), "de"));
  assert.ok(fmtClock(other.toISOString(), "de").endsWith("12:34"));
});

test("fmtClock names the date from six days on, where a weekday would mislead", () => {
  const d = new Date(); d.setHours(7, 0, 0, 0);
  const in5 = new Date(d); in5.setDate(d.getDate() + 5);
  const in8 = new Date(d); in8.setDate(d.getDate() + 8);
  assert.ok(fmtClock(in5.toISOString(), "de").startsWith(in5.toLocaleString("de", { weekday: "short" })), fmtClock(in5.toISOString(), "de"));
  const date = in8.toLocaleString("de", { day: "2-digit", month: "2-digit" });
  assert.ok(fmtClock(in8.toISOString(), "de").startsWith(date), fmtClock(in8.toISOString(), "de"));
  assert.ok(fmtClock(in8.toISOString(), "de").endsWith("07:00"));
});

test("fmtClock is empty for anything that is not a date", () => {
  for (const v of [null, "", "unknown", "unavailable", "not a date"]) assert.equal(fmtClock(v, "de"), "", String(v));
});

// --- fmtDuration -------------------------------------------------------------

test("fmtDuration names the largest units and drops the seconds above a minute", () => {
  assert.equal(fmtDuration(0), "0 s");
  assert.equal(fmtDuration(59), "59 s");
  assert.equal(fmtDuration(41 * 60), "41 min");
  assert.equal(fmtDuration(41 * 60 + 29), "41 min", "seconds round to the minute");
  assert.equal(fmtDuration(60 * 60), "1 h", "a zero part is left out");
  assert.equal(fmtDuration(21 * 3600 + 60), "21 h 1 min");
  assert.equal(fmtDuration(75684), "21 h 1 min", "the demo preview: 1261:24 min");
  assert.equal(fmtDuration(26 * 3600), "1 d 2 h");
  assert.equal(fmtDuration(2 * 86400 + 3 * 3600 + 40 * 60), "2 d 3 h", "minutes go above a day");
  assert.equal(fmtDuration(7 * 86400), "7 d");
});

test("fmtDuration stays empty for what is not a duration", () => {
  for (const bad of [-1, NaN, null, undefined, "abc", Infinity]) {
    assert.equal(fmtDuration(bad), "", String(bad));
  }
});

// --- durations ---------------------------------------------------------------

test("durationSeconds reads every unit HA shows a duration in", () => {
  assert.equal(durationSeconds(3.5, "d"), 302400, "days, the suggested unit of ha-evcc's session totals");
  assert.equal(durationSeconds(2, "h"), 7200);
  assert.equal(durationSeconds(3, "min"), 180);
  assert.equal(durationSeconds(42, "s"), 42);
  assert.equal(durationSeconds(1500, "ms"), 1.5);
  assert.equal(durationSeconds(42, null), 42, "no unit means seconds");
});

// --- fmtRemainingDuration ----------------------------------------------------

test("fmtRemainingDuration converts by the entity's unit", () => {
  assert.equal(fmtRemainingDuration(hassWith(90, "min"), "sensor.x"), "1 h 30 min");
  assert.equal(fmtRemainingDuration(hassWith(45, "min"), "sensor.x"), "45 min");
  assert.equal(fmtRemainingDuration(hassWith(1.5, "h"), "sensor.x"), "1 h 30 min");
  assert.equal(fmtRemainingDuration(hassWith(3600, "s"), "sensor.x"), "1 h");
  assert.equal(fmtRemainingDuration(hassWith(600, null), "sensor.x"), "10 min", "no unit means seconds");
});

test("fmtRemainingDuration stays empty for nothing worth showing", () => {
  assert.equal(fmtRemainingDuration(hassWith(0, "min"), "sensor.x"), "", "zero");
  assert.equal(fmtRemainingDuration(hassWith(-5, "min"), "sensor.x"), "", "negative");
  assert.equal(fmtRemainingDuration(hassWith(20, "s"), "sensor.x"), "", "rounds down to zero minutes");
  assert.equal(fmtRemainingDuration(hassWith("unavailable", "min"), "sensor.x"), "");
  assert.equal(fmtRemainingDuration(hassWith(90, "min"), null), "", "no entity");
  assert.equal(fmtRemainingDuration(null, "sensor.x"), "", "no hass");
});

// --- countdowns --------------------------------------------------------------

const inMs = (ms) => new Date(Date.now() + ms).toISOString();

test("fmtCountdownFromISO prints m:ss above a minute and plain seconds below", () => {
  assert.equal(fmtCountdownFromISO(inMs(90_300)), "1:30");
  assert.equal(fmtCountdownFromISO(inMs(65_300)), "1:05", "seconds are zero padded");
  assert.equal(fmtCountdownFromISO(inMs(60_300)), "1:00");
  assert.equal(fmtCountdownFromISO(inMs(30_300)), "30s");
});

test("fmtCountdownFromISO is empty once the target has passed", () => {
  assert.equal(fmtCountdownFromISO(inMs(-5_000)), "");
});

test("fmtCountdownFromISO swallows the unavailable states HA hands out", () => {
  for (const bad of ["", null, undefined, "unknown", "unavailable", "not a date"]) {
    assert.equal(fmtCountdownFromISO(bad), "", `input: ${String(bad)}`);
  }
});

test("fmtCountdownFromTimestamp reads the entity and formats the same way", () => {
  const hass = { states: { "sensor.x": { state: inMs(90_300), attributes: {} } } };
  assert.equal(fmtCountdownFromTimestamp(hass, "sensor.x"), "1:30");
  assert.equal(fmtCountdownFromTimestamp(hass, "sensor.missing"), "");
  assert.equal(fmtCountdownFromTimestamp(null, "sensor.x"), "");
});

// --- soc gradients -----------------------------------------------------------

test("socFillGradient is a plain colour when neither limit is set", () => {
  assert.equal(socFillGradient(50, 0, 100), "var(--evcc-blue)");
});

test("socFillGradient marks the min soc share in amber", () => {
  assert.equal(
    socFillGradient(50, 20, 100),
    "linear-gradient(to right, var(--evcc-amber) 0%, var(--evcc-amber) 40.0%, var(--evcc-blue) 40.0%, var(--evcc-blue) 100%)",
  );
});

test("socFillGradient marks everything past the limit in green", () => {
  assert.equal(
    socFillGradient(80, 0, 60),
    "linear-gradient(to right, var(--evcc-blue) 0%, var(--evcc-blue) 75.0%, var(--evcc-green) 75.0%, var(--evcc-green) 100%)",
  );
});

test("socFillGradient shows no green while the soc is still below the limit", () => {
  assert.equal(
    socFillGradient(30, 0, 60),
    "linear-gradient(to right, var(--evcc-blue) 0%, var(--evcc-blue) 100%)",
  );
});

test("socFillGradient survives soc 0 without dividing by zero", () => {
  const css = socFillGradient(0, 20, 80);
  assert.equal(
    css,
    "linear-gradient(to right, var(--evcc-amber) 0%, var(--evcc-amber) 100.0%, var(--evcc-blue) 100%)",
  );
  assert.ok(!/NaN|Infinity/.test(css), "no NaN or Infinity reaches the stylesheet");
});

test("socTrackBg is the bare divider colour without limits", () => {
  assert.equal(socTrackBg(0, 100), "var(--divider-color, #e5e7eb)");
  assert.equal(socTrackBg(null, null), "var(--divider-color, #e5e7eb)", "missing values behave like none");
});

test("socTrackBg tints the min and limit zones", () => {
  assert.equal(
    socTrackBg(20, 80),
    "linear-gradient(to right, rgba(245,158,11,.13) 0%, rgba(245,158,11,.13) 20%, "
    + "var(--divider-color, #e5e7eb) 20%, var(--divider-color, #e5e7eb) 80%, "
    + "rgba(34,197,94,.13) 80%, rgba(34,197,94,.13) 100%)",
  );
});

test("socTrackBg clamps values outside 0..100", () => {
  assert.equal(socTrackBg(-10, 150), "var(--divider-color, #e5e7eb)");
});

// --- prices ------------------------------------------------------------------

test("fmtPrice shows a price per kWh in the currency's subunit, as evcc does", () => {
  assert.equal(fmtPrice(0.213, "€", "de"), "21,3 ct/kWh");
  assert.equal(fmtPrice(0.213, "EUR", "en"), "21.3 ct/kWh", "evcc's code works as well as ha-evcc's symbol");
  assert.equal(fmtPrice(0.2, "€", "de"), "20,0 ct/kWh", "always one decimal");
  assert.equal(fmtPrice(0.1, "GBP", "en"), "10.0 p/kWh");
  assert.equal(fmtPrice(0.25, "CHF", "de"), "25,0 Rp./kWh");
  assert.equal(fmtPrice(0.25, "CHF", "en"), "25.0 ct./kWh");
  assert.equal(fmtPrice(-0.012, "€", "de"), "-1,2 ct/kWh", "negative prices keep their sign");
});

test("fmtPrice keeps a currency without subunit, with up to three decimals", () => {
  assert.equal(fmtPrice(1.2345, "JPY", "en"), "1.235 JPY/kWh");
  assert.equal(fmtPrice(2, "JPY", "en"), "2.0 JPY/kWh");
});

test("fmtPrice options and invalid values", () => {
  assert.equal(fmtPrice(0.2125, "€", "de", { decimals: 2 }), "21,25 ct/kWh", "a finer slider step");
  assert.equal(fmtPrice(0.213, "€", "de", { unit: false }), "21,3");
  assert.equal(fmtPrice(0.213, "€", "de", { unit: "short" }), "21,3 ct", "for a label that says per kWh");
  assert.equal(fmtPrice(1.5, "JPY", "en", { unit: "short" }), "1.5 JPY");
  for (const v of [null, undefined, "", "unknown", NaN]) assert.equal(fmtPrice(v, "€", "de"), "", String(v));
});

test("priceCurrency reads the currency of a unit per kWh, nothing else", () => {
  assert.equal(priceCurrency("€/kWh"), "€");
  assert.equal(priceCurrency("CHF / kWh"), "CHF");
  assert.equal(priceCurrency("g/kWh"), null, "a CO₂ intensity is no price");
  assert.equal(priceCurrency("kWh"), null);
  assert.equal(priceCurrency("%"), null);
  assert.equal(priceCurrency(undefined), null);
});

test("priceScale gives factor, unit and decimals", () => {
  assert.deepEqual(priceScale("€", "de"), { factor: 100, unit: "ct/kWh", decimals: 1 });
  assert.deepEqual(priceScale("JPY", "en"), { factor: 1, unit: "JPY/kWh", decimals: 3 });
});

test("without a currency nothing is scaled and no unit is claimed", () => {
  assert.equal(priceCurrency("/kWh"), null, "a unit per kWh without a currency is no price");
  assert.deepEqual(priceScale("", "en"), { factor: 1, unit: "", decimals: 2 });
  assert.deepEqual(priceScale(null, "en"), { factor: 1, unit: "", decimals: 2 });
  assert.equal(fmtPrice(0.2, "", "en"), "0.2", "the value as it is, without a trailing space");
  assert.equal(fmtPrice(0.2, "", "en", { unit: "short" }), "0.2");
});
