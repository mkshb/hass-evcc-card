// The card builds its DOM from template literals, so every value that comes
// from HA (vehicle titles, loadpoint names) has to pass through these.
import { test } from "node:test";
import assert from "node:assert/strict";
import { escHtml, escAttr } from "../../src/utils/html.js";

test("escHtml neutralises the five characters that break out of markup", () => {
  assert.equal(escHtml("<script>"), "&lt;script&gt;");
  assert.equal(escHtml('a "quoted" value'), "a &quot;quoted&quot; value");
  assert.equal(escHtml("it's"), "it&#39;s");
  assert.equal(escHtml("a & b"), "a &amp; b");
});

test("escHtml escapes an entity's ampersand, so escaping twice is visible and not silent", () => {
  assert.equal(escHtml("&lt;"), "&amp;lt;");
});

test("escHtml closes a quoted attribute injection", () => {
  assert.equal(
    escHtml('" onerror="alert(1)'),
    "&quot; onerror=&quot;alert(1)",
  );
});

test("escHtml stringifies non-strings instead of throwing", () => {
  assert.equal(escHtml(42), "42");
  assert.equal(escHtml(null), "null");
  assert.equal(escHtml(undefined), "undefined");
});

test("escHtml leaves harmless text untouched", () => {
  assert.equal(escHtml("Wallbox Garage 3"), "Wallbox Garage 3");
  assert.equal(escHtml(""), "");
});

test("escAttr is the same escaping as escHtml", () => {
  for (const s of ['<a href="x">', "a & b", "it's", "plain"]) {
    assert.equal(escAttr(s), escHtml(s));
  }
});
