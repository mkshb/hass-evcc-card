// Brings a live DOM tree in line with freshly rendered markup without
// replacing the nodes that are still there. The card renders one HTML string
// per update; assigning it to innerHTML threw every element away, so a hovered
// button lost its highlight, a focused element its focus, the charging bar its
// pulse phase and the chart its tooltip with every evcc update, about every
// two seconds. Here the string is parsed into a template and walked next to
// the live tree: attributes and text that differ are updated in place, nodes
// that have no counterpart are inserted, nodes that are no longer rendered are
// removed. A node that stays keeps its identity, its listeners and its state.
//
// Two nodes are counterparts when their tag and their key match. The key is
// `data-key` when set, otherwise the first class name, so a row that appears
// (the remaining time in the loadpoint header, an action chip) is inserted
// before its siblings instead of being morphed out of the badge that stood at
// that index. An element with `data-morph-keep` is left alone once it exists,
// for things the card writes into the DOM at runtime, such as the chart
// tooltip.

const KEY_ATTRS = ["data-key"];

// Attributes the card sets after a render rather than in the markup (the
// button role and the tab stop that listeners.js gives every click target).
// They are not in the template, so a plain sync would strip them again with
// every update, and a focused element loses its focus with its tabindex.
const RUNTIME_ATTRS = new Set(["role", "tabindex"]);

function keyOf(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return String(node.nodeType);
  for (const a of KEY_ATTRS) {
    const v = node.getAttribute(a);
    if (v != null) return `${node.localName}#${v}`;
  }
  const cls = node.getAttribute("class");
  const first = cls ? cls.trim().split(/\s+/)[0] : "";
  return `${node.localName}.${first}`;
}

function compatible(a, b) {
  return a.nodeType === b.nodeType && keyOf(a) === keyOf(b);
}

// Attributes, plus the properties a form control keeps apart from them. The
// `value` of an input or select and the `checked` of a checkbox follow the
// markup only when the markup moved since the last render: the state behind
// the control changed, so the control shows it. When the markup still says
// what it said last time, the control is left alone, because then whatever
// differs is the user's doing, a choice made a moment ago that HA has not
// reported back yet (up to a few seconds), and the render in between must not
// flip it back to the old state.
function syncAttributes(live, next) {
  for (const { name } of [...live.attributes]) {
    if (!next.hasAttribute(name) && !RUNTIME_ATTRS.has(name)) live.removeAttribute(name);
  }
  for (const { name, value } of [...next.attributes]) {
    if (live.getAttribute(name) !== value) live.setAttribute(name, value);
  }
  const tag = live.localName;
  if (tag === "input") {
    const type = live.type;
    if (type === "checkbox" || type === "radio") {
      const on = next.hasAttribute("checked");
      if (rendered(live, on)) live.checked = on;
    } else if (type !== "file") {
      const v = next.getAttribute("value") ?? "";
      if (rendered(live, v)) live.value = v;
    }
  } else if (tag === "select") {
    // Options are morphed below; the selection follows the `selected`
    // attribute of the new markup once they are in place.
    live.__evccSyncSelect = true;
  } else if (tag === "textarea") {
    const v = next.textContent;
    if (rendered(live, v)) live.value = v;
  }
}

// True when `value` differs from what the previous render put on the control,
// and remembers it. The first render after an insert counts as moved.
function rendered(live, value) {
  const moved = live.__evccRendered !== value;
  live.__evccRendered = value;
  return moved;
}

function morphNode(live, next) {
  if (live.nodeType === Node.TEXT_NODE || live.nodeType === Node.COMMENT_NODE) {
    if (live.data !== next.data) live.data = next.data;
    return;
  }
  if (live.hasAttribute("data-morph-keep")) return;
  syncAttributes(live, next);
  morphChildren(live, next);
  if (live.__evccSyncSelect) {
    delete live.__evccSyncSelect;
    const wanted = [...next.options].find(o => o.hasAttribute("selected"))?.value;
    if (wanted != null && rendered(live, wanted) && live.value !== wanted) live.value = wanted;
  }
}

export function morphChildren(liveParent, nextParent) {
  const nextKids = [...nextParent.childNodes];
  let cursor = liveParent.firstChild;
  for (const nextKid of nextKids) {
    // The node at the cursor is the counterpart when it fits; otherwise one
    // further down the live list may be (a sibling before it disappeared), and
    // it is pulled forward; otherwise the new node is inserted here.
    let match = null;
    if (cursor && compatible(cursor, nextKid)) {
      match = cursor;
    } else {
      for (let n = cursor?.nextSibling; n; n = n.nextSibling) {
        if (compatible(n, nextKid)) { match = n; break; }
      }
      if (match) liveParent.insertBefore(match, cursor);
    }
    if (match) {
      morphNode(match, nextKid);
      cursor = match.nextSibling;
    } else {
      liveParent.insertBefore(liveParent.ownerDocument.importNode(nextKid, true), cursor);
    }
  }
  // Whatever is left past the last counterpart is no longer rendered.
  while (cursor) {
    const gone = cursor;
    cursor = cursor.nextSibling;
    liveParent.removeChild(gone);
  }
}

// Renders `html` into `root` by morphing.
export function morphInto(root, html) {
  const tpl = root.ownerDocument.createElement("template");
  tpl.innerHTML = html;
  morphChildren(root, tpl.content);
}
