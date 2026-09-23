// Formatting helpers. These are the functions with real edge cases (missing
// values, two timestamp formats, a division that can hit zero) and the ones a
// render test can only observe indirectly.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepDecimals, fmtNum, evccDate, fmtDuration, fmtRemainingDuration,
  fmtCountdownFromISO, fmtCountdownFromTimestamp, socFillGradient, socTrackBg,
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
