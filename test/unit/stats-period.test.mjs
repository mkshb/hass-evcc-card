// stats_period: month | year | total | none, as the editor writes it. Older
// dashboards may still carry 30d | 365d | thisYear; they are accepted and land
// on the month or the year.
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeStatsPeriod } from "../../src/core/constants.js";

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

test("the fallback belongs to the caller, because the defaults differ", () => {
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
