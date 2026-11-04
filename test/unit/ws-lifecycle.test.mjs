// The WebSocket data cache across a switch of the ha-evcc instance (A-01): an
// answer to a request of an earlier instance lifecycle must not land in the
// cache or touch the request running now, also when the card switches back to
// the instance it started from (A -> B -> A, the same entry id again).
import { test } from "node:test";
import assert from "node:assert/strict";
import { evccApi } from "../../src/core/evcc-api.js";

// A promise the test settles by hand, in the order it wants.
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = () => new Promise(r => setImmediate(r));

// The mixin on a bare object, with a hass whose callWS answers when told to.
function card(entryId = "A") {
  const c = Object.assign({}, evccApi);
  c.calls = [];
  c._hass = { callWS: msg => { const d = deferred(); c.calls.push({ msg, ...d }); return d.promise; } };
  c._entryId = entryId;
  c._caps = { version: "2026.10.7", commands: ["forecast"] };
  c._capsLoaded = true;
  c._capsLoading = null;
  c._wsCache = {};
  c._wsInflight = {};
  c._wsRenderTimer = 1;          // no render timer in node
  c.renders = 0;
  c._render = () => { c.renders++; };
  c._prefetchDebugProbes = () => {};
  return c;
}
const fetchGrid = c => c._wsForecast("grid");
const gridCalls = c => c.calls.filter(x => x.msg.type === "evcc_intg/forecast");
const capsCalls = c => c.calls.filter(x => x.msg.type === "evcc_intg/capabilities");
const answerCaps = (c, i = -1) => capsCalls(c).at(i).resolve({ version: "2026.10.7", commands: ["forecast"], loadpoints: [] });

test("parallel reads of one kind share one request", async () => {
  const c = card();
  fetchGrid(c); fetchGrid(c); fetchGrid(c);
  assert.equal(gridCalls(c).length, 1);
  gridCalls(c)[0].resolve({ rates: [1] });
  await flush();
  assert.deepEqual(fetchGrid(c), { data: { rates: [1] } });
  assert.deepEqual(c._wsInflight, {});
});

test("A -> B: the answer for A stays out of B's cache", async () => {
  const c = card("A");
  fetchGrid(c);
  c._switchEntry("B");
  gridCalls(c)[0].resolve({ rates: ["A"] });
  await flush();
  assert.equal(c._wsCache["forecast:grid"], undefined);
});

test("A -> B -> A: an answer of the first lifecycle of A is dropped, the request of the second stays", async () => {
  const c = card("A");
  fetchGrid(c);                          // R1
  c._switchEntry("B"); c._switchEntry("A");
  answerCaps(c);
  await flush();
  fetchGrid(c);                          // R2
  const [r1, r2] = gridCalls(c);
  r1.resolve({ rates: ["old"] });
  await flush();
  assert.equal(c._wsCache["forecast:grid"], undefined, "R1 is not stored");
  assert.ok(c._wsInflight["forecast:grid"], "R1's finally leaves R2 in flight");
  fetchGrid(c);
  assert.equal(gridCalls(c).length, 2, "and no third request is started");
  r2.resolve({ rates: ["new"] });
  await flush();
  assert.deepEqual(c._wsCache["forecast:grid"].result, { data: { rates: ["new"] } });
  assert.deepEqual(c._wsInflight, {});
});

test("answers in reverse order: the older request cannot overwrite the newer one", async () => {
  const c = card("A");
  fetchGrid(c);
  c._switchEntry("B"); c._switchEntry("A");
  answerCaps(c);
  await flush();
  fetchGrid(c);
  const [r1, r2] = gridCalls(c);
  r2.resolve({ rates: ["new"] });
  await flush();
  r1.resolve({ rates: ["old"] });
  await flush();
  assert.deepEqual(c._wsCache["forecast:grid"].result, { data: { rates: ["new"] } });
});

test("a request that fails after the switch caches no error", async () => {
  const c = card("A");
  const warn = console.warn; console.warn = () => {};
  try {
    fetchGrid(c);
    c._switchEntry("B"); c._switchEntry("A");
    gridCalls(c)[0].reject(new Error("gone"));
    await flush();
    assert.equal(c._wsCache["forecast:grid"], undefined);
  } finally { console.warn = warn; }
});

test("a failure in the current lifecycle is cached as such", async () => {
  const c = card("A");
  const warn = console.warn; console.warn = () => {};
  try {
    fetchGrid(c);
    gridCalls(c)[0].reject(new Error("boom"));
    await flush();
    assert.deepEqual(fetchGrid(c), { error: "boom" });
    assert.deepEqual(c._wsInflight, {});
  } finally { console.warn = warn; }
});

test("capabilities: a probe of an earlier lifecycle neither sets the caps nor ends the running probe", async () => {
  const c = card("A");
  c._switchEntry("B");                   // P1 for B
  c._switchEntry("A");                   // P2 for A
  c._switchEntry("B");                   // P3 for B again
  const [p1, , p3] = capsCalls(c);
  p1.resolve({ version: "old", commands: ["forecast"], loadpoints: [] });
  await flush();
  assert.equal(c._capsLoaded, false, "P1 is not the probe of this lifecycle");
  assert.ok(c._capsLoading, "P3 still counts as running");
  p3.resolve({ version: "2026.10.7", commands: ["forecast"], loadpoints: [{ id: "garage", index: 2 }] });
  await flush();
  assert.equal(c._capsLoaded, true);
  assert.equal(c._caps.version, "2026.10.7");
  assert.equal(c._lpIndex("garage"), 2);
});
