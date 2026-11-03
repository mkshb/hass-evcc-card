// versionBelow() decides whether the card names the minimum ha-evcc: an older
// version gets the note, anything that does not parse is trusted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { versionBelow } from "../../src/utils/version.js";

test("older versions are below the minimum", () => {
  assert.equal(versionBelow("2026.6.3", "2026.6.4"), true);
  assert.equal(versionBelow("2026.5.9", "2026.6.4"), true);
  assert.equal(versionBelow("2025.12.1", "2026.6.4"), true);
});

test("the minimum and newer versions are not", () => {
  assert.equal(versionBelow("2026.6.4", "2026.6.4"), false);
  assert.equal(versionBelow("2026.6.10", "2026.6.4"), false, "parts compare as numbers, not as text");
  assert.equal(versionBelow("2026.10.1", "2026.6.4"), false);
  assert.equal(versionBelow("2027.1.0", "2026.6.4"), false);
});

test("a suffix after the digits is ignored", () => {
  assert.equal(versionBelow("2026.6.3b1", "2026.6.4"), true);
  assert.equal(versionBelow("2026.6.4b1", "2026.6.4"), false);
});

test("what does not parse counts as new enough", () => {
  for (const v of ["UNKNOWN", "", null, undefined, "dev", "2026"]) {
    assert.equal(versionBelow(v, "2026.6.4"), false, `input: ${JSON.stringify(v)}`);
  }
});
