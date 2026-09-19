#!/usr/bin/env node
// The card version lives in one place: EVCC_CARD_VERSION in src/core/constants.js.
// It is what the console banner and the debug mode report, and it is the value a
// new version starts with. package.json only follows it, so the two can never
// drift apart: `npm run build` syncs it through the prebuild hook, and
// `--check` reports a difference instead of writing (used by CI and the tests).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT      = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONSTANTS = join(ROOT, "src", "core", "constants.js");
const PKG       = join(ROOT, "package.json");

export function cardVersion() {
  const m = /^export const EVCC_CARD_VERSION = "([^"]+)";/m.exec(readFileSync(CONSTANTS, "utf8"));
  if (!m) throw new Error("EVCC_CARD_VERSION not found in src/core/constants.js");
  return m[1];
}

export function packageVersion() {
  return JSON.parse(readFileSync(PKG, "utf8")).version;
}

function main() {
  const check = process.argv.includes("--check");
  const want = cardVersion();
  const have = packageVersion();
  if (want === have) return;

  if (check) {
    console.error(`package.json is at ${have}, src/core/constants.js at ${want}. Run 'npm run build' (or 'node scripts/sync-version.mjs') and commit package.json.`);
    process.exit(1);
  }
  // Rewrite the one line rather than re-serialising, so the file keeps its formatting.
  const raw = readFileSync(PKG, "utf8");
  const next = raw.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${want}"`);
  if (next === raw) throw new Error('no "version" field in package.json');
  writeFileSync(PKG, next);
  console.log(`package.json version ${have} → ${want} (from src/core/constants.js)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
