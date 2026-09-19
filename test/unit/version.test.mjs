// One version, one place: src/core/constants.js carries it, package.json follows
// (scripts/sync-version.mjs, run by the prebuild hook). This catches a committed
// package.json that was never synced.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cardVersion, packageVersion } from "../../scripts/sync-version.mjs";
import { EVCC_CARD_VERSION } from "../../src/core/constants.js";

test("the version the card reports is the one the sources declare", () => {
  assert.equal(cardVersion(), EVCC_CARD_VERSION);
});

test("package.json follows src/core/constants.js", () => {
  assert.equal(packageVersion(), EVCC_CARD_VERSION,
    "run 'npm run build' (or npm run version:sync) and commit package.json");
});

test("the version is a plain semver, which is what HACS reads from the release tag", () => {
  assert.match(EVCC_CARD_VERSION, /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
});
