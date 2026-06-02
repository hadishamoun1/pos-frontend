/**
 * AnnotationLayer — injects annotation text directly into the iframe document.
 * No overlay div; listens on body so annotation nodes receive hover/drag events
 * correctly. Coordinates are computed relative to body.getBoundingClientRect()
 * so placement is accurate regardless of scroll, zoom, or body margins.
 */
import { useEffect } from "react";

/* ── Palettes ────────────────────────────────────────────────── */
const TEXT_COLORS = [
  ["#1e293b","Black"], ["#dc2626","Red"],    ["#ea580c","Orange"],
  ["#ca8a04","Amber"], ["#16a34a","Green"],  ["#0891b2","Cyan"],
  ["#2563eb","Blue"],  ["#7c3aed","Purple"], ["#db2777","Pink"],
  ["#ffffff","White"],
];

const HL_COLORS = [
  [null,"None"],       ["#fef08a","Yellow"], ["#bbf7d0","Green"],
  ["#bfdbfe","Blue"],  ["#fecaca","Red"],    ["#e9d5ff","Purple"],
  ["#fbcfe8","Pink"],
];

const SIZES = [
  ["1","XS"],["2","S"],["3","M"],["4","L"],["5","XL"],["6","XXL"],["7","H"],
];

/* ── CSS injected once into the iframe <head> ────────────────── */
const ANNOT_CSS = `
/* Crosshair on the whole document in annotate mode */
body.annot-active { cursor: crosshair !important; }

/* ── Annotation node — transparent, sits on the paper ── */
.annot-node {
  position: absolute;
  z-index: 9990;
  background: transparent;
  border: none;
  box-shadow: none;
  outline: none;
  display: inline-flex;
  flex-direction: column;
  min-width: 40px;
  min-height: 18px;
  overflow: visible;
  pointer-events: none;
  font-family: inherit;
}
body.annot-active .annot-node {
  pointer-events: all;
  cursor: default !important;
}
body.annot-active .annot-node:hover > .annot-editor,
body.annot-active .annot-node:focus-within > .annot-editor {
  outline: 1.5px dashed rgba(59,130,246,0.45);
  border-radius: 2px;
}

/* ── Handle bar — always visible inside the node in annotate mode ── */
.annot-handle {
  display: none;
  align-items: center;
  gap: 4px;
  padding: 2px 5px;
  background: rgba(15,23,42,0.75);
  border-radius: 4px 4px 0 0;
  cursor: move !important;
  user-select: none;
  flex-shrink: 0;
  backdrop-filter: blur(4px);
}
body.annot-active .annot-node .annot-handle { display: flex; }

.annot-grip {
  flex: 1;
  font-size: 12px;
  letter-spacing: 2px;
  color: rgba(255,255,255,0.55);
  line-height: 1;
  pointer-events: none;
}

/* × Delete button — inside the handle bar */
.annot-del {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: transparent;
  color: rgba(255,255,255,0.6);
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer !important;
  flex-shrink: 0;
  transition: color 0.1s, background 0.1s;
}
.annot-del:hover { color: #fff; background: #dc2626; }

/* ── Floating toolbar — above the text, only while editor is focused ── */
.annot-toolbar {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  display: none;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  padding: 5px 8px;
  background: #1e293b;
  border-radius: 7px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2);
  z-index: 9999;
  white-space: nowrap;
  pointer-events: all;
  cursor: default !important;
}
.annot-toolbar::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 14px;
  border: 5px solid transparent;
  border-top-color: #1e293b;
}
.annot-node:focus-within .annot-toolbar { display: flex; }

.a-btn {
  display:inline-flex; align-items:center; justify-content:center;
  min-width:22px; height:22px; padding:0 3px;
  border:1px solid transparent; border-radius:4px;
  background:transparent; cursor:pointer !important;
  font-size:11px; font-weight:700; color:#94a3b8; line-height:1;
  transition: all 0.1s; flex-shrink:0;
}
.a-btn:hover { background:rgba(255,255,255,0.1); color:#fff; }
.a-btn.on    { background:#3b82f6; border-color:#60a5fa; color:#fff; }
.a-sep { width:1px; height:14px; background:rgba(255,255,255,0.12); margin:0 2px; flex-shrink:0; }
.a-sel {
  height:22px; padding:0 3px;
  border:1px solid rgba(255,255,255,0.12); border-radius:4px;
  background:#0f172a; font-size:10px; color:#94a3b8;
  cursor:pointer !important; flex-shrink:0;
}
.a-sel:focus { outline:none; border-color:#3b82f6; }
.a-swatches { display:flex; align-items:center; gap:2px; flex-shrink:0; }
.a-sw {
  width:12px; height:12px; border-radius:50%; cursor:pointer !important;
  border:1.5px solid rgba(255,255,255,0.2);
  transition: transform 0.1s, border-color 0.1s; flex-shrink:0;
}
.a-sw:hover { transform:scale(1.5); border-color:#fff; }
.a-sw-none {
  background:#fff !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cline x1='1' y1='11' x2='11' y2='1' stroke='%23dc2626' stroke-width='2'/%3E%3C/svg%3E") !important;
  background-size:contain !important; background-repeat:no-repeat !important;
  background-position:center !important;
}
.a-lbl { font-size:8px; font-weight:700; color:rgba(255,255,255,0.3); text-transform:uppercase; flex-shrink:0; }

/* ── The actual text — no background, sits on the paper ── */
.annot-editor {
  background: transparent;
  border: none;
  padding: 1px 3px;
  min-width: 40px;
  min-height: 18px;
  font-size: 14px;
  line-height: 1.6;
  color: #1e293b;
  outline: none;
  word-break: break-word;
  caret-color: #2563eb;
  font-family: inherit;
  cursor: text !important;
}
.annot-editor:empty::before {
  content: attr(data-ph);
  color: rgba(100,116,139,0.5);
  pointer-events: none;
}

/* ── Hint toast ── */
#annot-hint {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15,23,42,0.85);
  color: #e2e8f0;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 18px;
  border-radius: 20px;
  pointer-events: none;
  z-index: 9998;
  white-space: nowrap;
  font-family: system-ui,-apple-system,sans-serif;
  backdrop-filter: blur(4px);
}
`;

/* ── Module-level map: doc → click handler (for clean removal) ── */
const _handlers = new WeakMap();

/* ── DOM helpers ─────────────────────────────────────────────── */
function mk(doc, tag, cls) {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function refreshBtns(toolbar, doc) {
  toolbar.querySelectorAll(".a-btn[data-cmd]").forEach((btn) => {
    try { btn.classList.toggle("on", doc.queryCommandState(btn.dataset.cmd)); } catch {}
  });
}

function buildToolbar(doc) {
  const bar = mk(doc, "div", "annot-toolbar");

  const addBtn = (cmd, html, title) => {
    const b = mk(doc, "button", "a-btn");
    b.innerHTML = html; b.title = title; b.dataset.cmd = cmd;
    b.addEventListener("mousedown", (e) => {
      e.preventDefault();
      doc.execCommand(cmd, false, null);
      refreshBtns(bar, doc);
    });
    bar.appendChild(b);
  };
  const sep = () => bar.appendChild(mk(doc, "span", "a-sep"));

  addBtn("bold",          "<b>B</b>",  "Bold");
  addBtn("italic",        "<i>I</i>",  "Italic");
  addBtn("underline",     "<u>U</u>",  "Underline");
  addBtn("strikeThrough", "<s>S</s>",  "Strikethrough");
  sep();

  const sel = mk(doc, "select", "a-sel");
  sel.style.width = "42px"; sel.title = "Font size";
  SIZES.forEach(([v, l]) => {
    const o = doc.createElement("option");
    o.value = v; o.textContent = l; if (v === "7") o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("mousedown", (e) => e.stopPropagation());
  sel.addEventListener("change",    (e) => doc.execCommand("fontSize", false, e.target.value));
  bar.appendChild(sel);
  sep();

  const tl = mk(doc, "span", "a-lbl"); tl.textContent = "A"; bar.appendChild(tl);
  const tr = mk(doc, "span", "a-swatches");
  TEXT_COLORS.forEach(([val, label]) => {
    const sw = mk(doc, "span", "a-sw");
    sw.style.background = val;
    if (val === "#ffffff") sw.style.borderColor = "#94a3b8";
    sw.title = label;
    sw.addEventListener("mousedown", (e) => { e.preventDefault(); doc.execCommand("foreColor", false, val); });
    tr.appendChild(sw);
  });
  bar.appendChild(tr);
  sep();

  const hl = mk(doc, "span", "a-lbl"); hl.textContent = "HL"; bar.appendChild(hl);
  const hr = mk(doc, "span", "a-swatches");
  HL_COLORS.forEach(([val, label]) => {
    const sw = mk(doc, "span", val === null ? "a-sw a-sw-none" : "a-sw");
    if (val) sw.style.background = val;
    sw.title = label;
    sw.addEventListener("mousedown", (e) => { e.preventDefault(); doc.execCommand("hiliteColor", false, val || "transparent"); });
    hr.appendChild(sw);
  });
  bar.appendChild(hr);
  sep();

  addBtn("insertUnorderedList", "• —", "Bullet list");
  bar.querySelector("[data-cmd='insertUnorderedList']").style.fontSize = "10px";
  addBtn("insertOrderedList",   "1.—", "Numbered");
  bar.querySelector("[data-cmd='insertOrderedList']").style.fontSize = "10px";
  sep();

  const clr = mk(doc, "button", "a-btn");
  clr.textContent = "T✕"; clr.title = "Clear formatting"; clr.style.fontSize = "10px";
  clr.addEventListener("mousedown", (e) => { e.preventDefault(); doc.execCommand("removeFormat", false, null); });
  bar.appendChild(clr);

  return bar;
}

/* ── Create one annotation node ─────────────────────────────── */
function createNode(doc, x, y) {
  const node = mk(doc, "div", "annot-node");
  node.style.left = x + "px";
  node.style.top  = y + "px";

  /* ── Handle bar (drag grip + × delete) — always visible in annotate mode ── */
  const handle = mk(doc, "div", "annot-handle");

  const grip = mk(doc, "span", "annot-grip");
  grip.textContent = "⠿ ⠿ ⠿";
  grip.title = "Drag to move";
  handle.appendChild(grip);

  const del = mk(doc, "button", "annot-del");
  del.textContent = "×";
  del.title = "Delete annotation";
  del.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); });
  del.addEventListener("click",     (e) => { e.stopPropagation(); node.remove(); });
  handle.appendChild(del);

  node.appendChild(handle);

  /* ── Floating toolbar (above, on focus) ── */
  const toolbar = buildToolbar(doc);
  node.appendChild(toolbar);

  /* ── Text editor — transparent, sits on paper ── */
  const editor = mk(doc, "div", "annot-editor");
  editor.contentEditable = "true";
  editor.dataset.ph = "Type here…";
  editor.addEventListener("keyup",   () => refreshBtns(toolbar, doc));
  editor.addEventListener("mouseup", () => refreshBtns(toolbar, doc));
  editor.addEventListener("focus",   () => refreshBtns(toolbar, doc));
  editor.addEventListener("mousedown", (e) => e.stopPropagation());
  node.appendChild(editor);

  /* ── Drag — initiated from the handle bar ── */
  handle.addEventListener("mousedown", (e) => {
    if (del.contains(e.target)) return; // let delete do its thing
    e.preventDefault();
    e.stopPropagation();

    const startCX = e.clientX, startCY = e.clientY;
    const origLeft = parseFloat(node.style.left) || 0;
    const origTop  = parseFloat(node.style.top)  || 0;
    let moved = false;

    const onMove = (me) => {
      moved = true;
      node.style.left = (origLeft + me.clientX - startCX) + "px";
      node.style.top  = (origTop  + me.clientY - startCY) + "px";
    };
    const onUp = () => {
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("mouseup",   onUp);
      if (moved) {
        doc._annotJustDragged = true;
        setTimeout(() => { doc._annotJustDragged = false; }, 50);
      }
    };
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup",   onUp);
  });

  /* Prevent all node interactions from bubbling to body (no new node spawned) */
  node.addEventListener("mousedown", (e) => e.stopPropagation());
  node.addEventListener("click",     (e) => e.stopPropagation());

  doc.body.appendChild(node);
  requestAnimationFrame(() => {
    editor.focus();
    doc.execCommand("fontSize", false, "7");
  });
}

/* ── Activate / deactivate ───────────────────────────────────── */
function ensureStyle(doc) {
  if (doc.getElementById("__annot_css__")) return;
  const s = doc.createElement("style");
  s.id = "__annot_css__";
  s.textContent = ANNOT_CSS;
  doc.head.appendChild(s);
  /* Body must be the positioning context for absolute annotation nodes */
  const cs = doc.defaultView?.getComputedStyle(doc.body);
  if (!cs || cs.position === "static") {
    doc.body.style.position = "relative";
  }
}

function activate(doc) {
  ensureStyle(doc);
  doc.body.classList.add("annot-active");

  /* Hint */
  if (!doc.getElementById("annot-hint")) {
    const h = doc.createElement("div");
    h.id = "annot-hint";
    h.textContent = "Click anywhere on the document to add a note";
    doc.body.appendChild(h);
  }

  /* Listen for clicks on the body itself — nodes stop their own click propagation */
  if (!_handlers.has(doc)) {
    const handler = (e) => {
      if (doc._annotJustDragged) return;
      /* Coordinates relative to body's top-left (correct for position:absolute children) */
      const rect = doc.body.getBoundingClientRect();
      createNode(doc, e.clientX - rect.left, e.clientY - rect.top);
    };
    doc.body.addEventListener("click", handler);
    _handlers.set(doc, handler);
  }
}

function deactivate(doc) {
  doc.body.classList.remove("annot-active");
  doc.getElementById("annot-hint")?.remove();

  const handler = _handlers.get(doc);
  if (handler) {
    doc.body.removeEventListener("click", handler);
    _handlers.delete(doc);
  }
}

/* ── Public utility: remove all annotation nodes ─────────────── */
export function clearAnnotations(iframeRef) {
  const doc =
    iframeRef?.current?.contentDocument ||
    iframeRef?.current?.contentWindow?.document;
  if (!doc) return;
  doc.querySelectorAll(".annot-node").forEach((n) => n.remove());
}

/* ── React component (renders nothing itself) ────────────────── */
export default function AnnotationLayer({ iframeRef, active }) {
  useEffect(() => {
    const iframe = iframeRef?.current;
    if (!iframe) return;

    function apply() {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc?.body) return;
      active ? activate(doc) : deactivate(doc);
    }

    apply();
    iframe.addEventListener("load", apply);
    return () => {
      iframe.removeEventListener("load", apply);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body) deactivate(doc);
    };
  }, [active, iframeRef]);

  return null;
}
