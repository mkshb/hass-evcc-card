// stats_period reaches the card in two vocabularies: the current one the editor
// writes (month | year | total | none) and the legacy one that older dashboards
// still carry (30d | 365d | thisYear | total). Both stats paths are fed from the
// normalised value, so they cannot interpret the same config differently.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStatsPeriod, legacyStatsPeriod, STATS_PERIOD_TO_LEGACY, STATS_PERIOD_LEGACY_VALUES }
  from "../../src/core/constants.js";

test("the current vocabulary passes through unchanged", () => {
  for (const v of ["month", "year", "total", "none"]) {
    assert.equal(normalizeStatsPeriod(v), v);
  }
});

test("legacy values map onto their current equivalent", () => {
  assert.equal(normalizeStatsPeriod("30d"), "month");
  assert.equal(normalizeStatsPeriod("365d"), "year");
  assert.equal(normalizeStatsPeriod("thisYear"), "year");
  assert.equal(normalizeStatsPeriod("total"), "total");
});

test("the fallback belongs to the caller, because the two paths differ", () => {
  assert.equal(normalizeStatsPeriod(undefined, "month"), "month", "the stats mode opens on a month");
  assert.equal(normalizeStatsPeriod(undefined, "total"), "total", "the footer summarises everything");
  assert.equal(normalizeStatsPeriod(undefined), "total", "and total is the documented default");
});

test("anything unknown falls back instead of reaching a stats path", () => {
  for (const bad of ["jahr", "", null, 0, 42, {}, []]) {
    assert.equal(normalizeStatsPeriod(bad, "month"), "month", `input: ${JSON.stringify(bad)}`);
  }
});

test("a value is never mapped onto something outside the current vocabulary", () => {
  const allowed = new Set(["month", "year", "total", "none"]);
  for (const v of ["month", "year", "total", "none", "30d", "365d", "thisYear", "nonsense", undefined]) {
    assert.ok(allowed.has(normalizeStatsPeriod(v)), `${v} -> ${normalizeStatsPeriod(v)}`);
  }
});

test("every normalised value has a legacy counterpart", () => {
  for (const v of ["month", "year", "total", "none"]) {
    assert.ok(STATS_PERIOD_TO_LEGACY[v], `no legacy period for ${v}`);
    assert.ok(STATS_PERIOD_LEGACY_VALUES.includes(STATS_PERIOD_TO_LEGACY[v]),
              `${v} maps to ${STATS_PERIOD_TO_LEGACY[v]}, which the legacy path does not know`);
  }
});

test("none falls back to a real period on the legacy path, it only hides the footer", () => {
  assert.equal(STATS_PERIOD_TO_LEGACY.none, "total");
});

test("the legacy counterpart of year is the calendar year, not the last 365 days", () => {
  assert.equal(STATS_PERIOD_TO_LEGACY.year, "thisYear",
    "365d is a rolling window; the sessions scope 'year' is a calendar year");
});

// legacyStatsPeriod() is what the stats mode and the compact footer both use to
// reach the stat_* entities on an ha-evcc without the sessions command.
test("a configured legacy period reaches the legacy path untouched", () => {
  for (const v of STATS_PERIOD_LEGACY_VALUES) {
    assert.equal(legacyStatsPeriod(v), v, `${v} has to keep its own meaning`);
  }
});

test("the current vocabulary lands on its legacy counterpart", () => {
  assert.equal(legacyStatsPeriod("month"), "30d");
  assert.equal(legacyStatsPeriod("year"), "thisYear");
  assert.equal(legacyStatsPeriod("total"), "total");
  assert.equal(legacyStatsPeriod("none"), "total", "none hides the footer, it is not a period");
});

test("the legacy fallback belongs to the caller too", () => {
  assert.equal(legacyStatsPeriod(undefined, "total"), "total");
  assert.equal(legacyStatsPeriod(undefined, "month"), "30d");
  assert.equal(legacyStatsPeriod("nonsense", "month"), "30d");
});

test("the legacy path never sees a period it does not know", () => {
  const inputs = ["month", "year", "total", "none", "30d", "365d", "thisYear", "nonsense", "", null, 0, {}, undefined];
  for (const v of inputs) {
    assert.ok(STATS_PERIOD_LEGACY_VALUES.includes(legacyStatsPeriod(v)),
              `${JSON.stringify(v)} -> ${legacyStatsPeriod(v)}`);
    assert.ok(STATS_PERIOD_LEGACY_VALUES.includes(legacyStatsPeriod(v, "month")),
              `${JSON.stringify(v)} (fallback month) -> ${legacyStatsPeriod(v, "month")}`);
  }
});
