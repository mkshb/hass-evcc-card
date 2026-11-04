// The value a control wrote stands in for the state until HA answers (A-02):
// the note of a later write must survive the failure of an earlier one, and a
// note ends when HA reports anything else, when its call fails or after a while.
import { test } from "node:test";
import assert from "node:assert/strict";
import { actions } from "../../src/core/actions.js";

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  promise.catch(() => {});        // the card's caller handles it; keep node quiet
  return { promise, resolve, reject };
}
const flush = () => new Promise(r => setImmediate(r));
const ID = "number.evcc_garage_limit_soc";

function card(state = "60") {
  const c = Object.assign({}, actions);
  c.calls = [];
  c._expected = {};
  c._hass = {
    states: { [ID]: { entity_id: ID, state } },
    callService: (domain, service, data) => { const d = deferred(); c.calls.push({ domain, service, data, ...d }); return d.promise; },
  };
  c._battForecastWritten = () => {};
  return c;
}
const shown = c => c._expectedState(ID, c._hass.states[ID]).state;

test("a write shows its value until HA answers", async () => {
  const c = card();
  c._setNumberValue(ID, 70);
  assert.equal(shown(c), "70");
  c.calls[0].resolve();
  await flush();
  assert.equal(shown(c), "70", "a successful call alone does not end the note, HA's state does");
});

test("a failed write falls back to the state", async () => {
  const c = card();
  c._setNumberValue(ID, 70);
  c.calls[0].reject(new Error("refused"));
  await flush();
  assert.equal(shown(c), "60");
  assert.equal(c._expected[ID], undefined);
});

test("the late failure of an earlier write leaves the later one standing", async () => {
  const c = card();
  c._setNumberValue(ID, 70);
  c._setNumberValue(ID, 80);
  c.calls[0].reject(new Error("refused"));
  await flush();
  assert.equal(shown(c), "80");
});

test("the failure of the later write drops its note, the earlier success does not bring it back", async () => {
  const c = card();
  c._setNumberValue(ID, 70);
  c._setNumberValue(ID, 80);
  c.calls[0].resolve();
  c.calls[1].reject(new Error("refused"));
  await flush();
  assert.equal(shown(c), "60");
});

test("HA confirms the value: the real state takes over", () => {
  const c = card();
  c._setNumberValue(ID, 70);
  c._hass.states = { [ID]: { entity_id: ID, state: "70" } };
  assert.equal(shown(c), "70");
  assert.equal(c._expected[ID], undefined);
});

test("HA reports another value: that one is shown", () => {
  const c = card();
  c._setNumberValue(ID, 70);
  c._hass.states = { [ID]: { entity_id: ID, state: "65" } };
  assert.equal(shown(c), "65");
});

test("a note without an answer expires", () => {
  const c = card();
  c._setNumberValue(ID, 70);
  c._expected[ID].ts -= 7000;
  assert.equal(shown(c), "60");
});
