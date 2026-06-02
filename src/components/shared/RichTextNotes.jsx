import React, { useRef, useState, useCallback } from "react";

/* ── Colour palettes ─────────────────────────────────────────────── */
const TEXT_COLORS = [
  { val: "#1e293b", label: "Black" },
  { val: "#dc2626", label: "Red" },
  { val: "#ea580c", label: "Orange" },
  { val: "#ca8a04", label: "Amber" },
  { val: "#16a34a", label: "Green" },
  { val: "#0891b2", label: "Cyan" },
  { val: "#2563eb", label: "Blue" },
  { val: "#7c3aed", label: "Purple" },
  { val: "#db2777", label: "Pink" },
  { val: "#6b7280", label: "Gray" },
];

const HIGHLIGHT_COLORS = [
  { val: "transparent", label: "None" },
  { val: "#fef08a", label: "Yellow" },
  { val: "#bbf7d0", label: "Green" },
  { val: "#bfdbfe", label: "Blue" },
  { val: "#fecaca", label: "Red" },
  { val: "#fed7aa", label: "Orange" },
  { val: "#e9d5ff", label: "Purple" },
  { val: "#fbcfe8", label: "Pink" },
];

/* font-size: execCommand uses 1-7 → map to readable labels */
const FONT_SIZES = [
  { val: "1", label: "Small" },
  { val: "2", label: "Normal" },
  { val: "3", label: "Medium" },
  { val: "4", label: "Large" },
  { val: "5", label: "X-Large" },
  { val: "6", label: "XX-Large" },
  { val: "7", label: "Huge" },
];

/* ── Inline styles ───────────────────────────────────────────────── */
const CSS = `
.rte-panel {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 24px rgba(0,0,0,0.09);
  overflow: hidden;
  font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  margin-top: 10px;
}

/* ── Toolbar ── */
.rte-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  padding: 7px 10px;
  background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
  border-bottom: 1px solid #e2e8f0;
  user-select: none;
}

.rte-tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 5px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  line-height: 1;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  flex-shrink: 0;
}
.rte-tb-btn:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #1e293b;
}
.rte-tb-btn.rte-on {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.rte-sep {
  width: 1px;
  height: 20px;
  background: #e2e8f0;
  margin: 0 4px;
  flex-shrink: 0;
}

.rte-select {
  height: 28px;
  padding: 0 5px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: #fff;
  font-size: 12px;
  color: #475569;
  cursor: pointer;
  flex-shrink: 0;
}
.rte-select:focus { outline: none; border-color: #3b82f6; }

/* Label chips above swatches */
.rte-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.6px;
  color: #94a3b8;
  text-transform: uppercase;
  flex-shrink: 0;
  margin-right: 1px;
}

/* Colour swatches */
.rte-swatches {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}
.rte-swatch {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid transparent;
  transition: transform 0.12s, border-color 0.15s;
  flex-shrink: 0;
}
.rte-swatch:hover { transform: scale(1.35); border-color: #64748b; }
.rte-swatch-none {
  background: #fff !important;
  border-color: #e2e8f0 !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 17 17'%3E%3Cline x1='2' y1='15' x2='15' y2='2' stroke='%23dc2626' stroke-width='2.5'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

/* ── Editor area ── */
.rte-body {
  position: relative;
  flex: 1;
}
.rte-editor {
  min-height: 140px;
  max-height: 260px;
  overflow-y: auto;
  padding: 13px 15px;
  font-size: 14px;
  line-height: 1.75;
  color: #1e293b;
  outline: none;
  caret-color: #2563eb;
  word-break: break-word;
}
.rte-editor:focus { background: #fafcff; }
.rte-placeholder {
  position: absolute;
  top: 13px;
  left: 15px;
  color: #94a3b8;
  font-size: 14px;
  pointer-events: none;
  user-select: none;
  line-height: 1.75;
}

/* ── Footer ── */
.rte-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  gap: 8px;
}
.rte-footer-hint {
  font-size: 11px;
  color: #94a3b8;
}
.rte-footer-actions {
  display: flex;
  gap: 6px;
}
.rte-act-btn {
  padding: 4px 13px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.13s;
  letter-spacing: 0.2px;
}
.rte-act-btn.danger { background: #fee2e2; color: #dc2626; }
.rte-act-btn.danger:hover { background: #fca5a5; }
.rte-act-btn.accent { background: #e0e7ff; color: #4338ca; }
.rte-act-btn.accent:hover { background: #c7d2fe; }
`;

/* ── Toolbar button ── */
function Btn({ title, active, onMouseDown, children, style }) {
  return (
    <button
      className={`rte-tb-btn${active ? " rte-on" : ""}`}
      title={title}
      onMouseDown={onMouseDown}
      style={style}
    >
      {children}
    </button>
  );
}

/* ── Main component ── */
export default function RichTextNotes({
  placeholder = "Type your notes here…",
}) {
  const editorRef = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [fmt, setFmt] = useState({});
  const [copied, setCopied] = useState(false);

  /* Re-read active format states after any action */
  const refreshFmt = useCallback(() => {
    setFmt({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike: document.queryCommandState("strikeThrough"),
      jLeft: document.queryCommandState("justifyLeft"),
      jCenter: document.queryCommandState("justifyCenter"),
      jRight: document.queryCommandState("justifyRight"),
      ol: document.queryCommandState("insertOrderedList"),
      ul: document.queryCommandState("insertUnorderedList"),
    });
  }, []);

  /* Execute a rich-text command */
  const exec = useCallback(
    (cmd, val = null) => {
      editorRef.current?.focus();
      document.execCommand(cmd, false, val);
      refreshFmt();
    },
    [refreshFmt]
  );

  /* Mouse-down handler so button click doesn't steal focus */
  const press = (cmd, val = null) => (e) => {
    e.preventDefault();
    exec(cmd, val);
  };

  /* Track empty state for placeholder */
  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
    setIsEmpty(el.textContent.trim() === "" && !el.querySelector("img"));
    refreshFmt();
  };

  /* Clear all content */
  const handleClear = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
      setIsEmpty(true);
      setFmt({});
    }
  };

  /* Copy plain text to clipboard */
  const handleCopy = async () => {
    const text = editorRef.current?.innerText || "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="rte-panel">

        {/* ══ TOOLBAR ══════════════════════════════════════════════ */}
        <div className="rte-toolbar">

          {/* — Inline format — */}
          <Btn title="Bold (Ctrl+B)" active={fmt.bold} onMouseDown={press("bold")}>
            <b>B</b>
          </Btn>
          <Btn title="Italic (Ctrl+I)" active={fmt.italic} onMouseDown={press("italic")}>
            <i>I</i>
          </Btn>
          <Btn title="Underline (Ctrl+U)" active={fmt.underline} onMouseDown={press("underline")}>
            <u>U</u>
          </Btn>
          <Btn title="Strikethrough" active={fmt.strike} onMouseDown={press("strikeThrough")}>
            <s>S</s>
          </Btn>

          <div className="rte-sep" />

          {/* — Font size — */}
          <select
            className="rte-select"
            defaultValue="3"
            style={{ width: 88 }}
            title="Font size"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => exec("fontSize", e.target.value)}
          >
            {FONT_SIZES.map(({ val, label }) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </select>

          <div className="rte-sep" />

          {/* — Text colours — */}
          <span className="rte-label">A</span>
          <div className="rte-swatches">
            {TEXT_COLORS.map(({ val, label }) => (
              <span
                key={val}
                className="rte-swatch"
                style={{
                  background: val,
                  borderColor: val === "#ffffff" ? "#cbd5e1" : "transparent",
                }}
                title={`Text colour: ${label}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec("foreColor", val);
                }}
              />
            ))}
          </div>

          <div className="rte-sep" />

          {/* — Highlight colours — */}
          <span className="rte-label">HL</span>
          <div className="rte-swatches">
            {HIGHLIGHT_COLORS.map(({ val, label }) => (
              <span
                key={val}
                className={`rte-swatch${val === "transparent" ? " rte-swatch-none" : ""}`}
                style={{ background: val === "transparent" ? undefined : val }}
                title={`Highlight: ${label}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  exec("hiliteColor", val === "transparent" ? "transparent" : val);
                }}
              />
            ))}
          </div>

          <div className="rte-sep" />

          {/* — Alignment — */}
          <Btn title="Align left" active={fmt.jLeft} onMouseDown={press("justifyLeft")}>
            ≡
          </Btn>
          <Btn title="Align centre" active={fmt.jCenter} onMouseDown={press("justifyCenter")}>
            ☰
          </Btn>
          <Btn title="Align right" active={fmt.jRight} onMouseDown={press("justifyRight")}>
            ≡
          </Btn>

          <div className="rte-sep" />

          {/* — Lists — */}
          <Btn title="Bullet list" active={fmt.ul} onMouseDown={press("insertUnorderedList")}
            style={{ fontSize: 11 }}>
            • ―
          </Btn>
          <Btn title="Numbered list" active={fmt.ol} onMouseDown={press("insertOrderedList")}
            style={{ fontSize: 11 }}>
            1. ―
          </Btn>

          <div className="rte-sep" />

          {/* — Clear formatting — */}
          <Btn title="Clear formatting" onMouseDown={press("removeFormat")} style={{ fontSize: 11 }}>
            T✕
          </Btn>
        </div>

        {/* ══ EDITOR ═══════════════════════════════════════════════ */}
        <div className="rte-body">
          {isEmpty && (
            <div className="rte-placeholder">{placeholder}</div>
          )}
          <div
            ref={editorRef}
            className="rte-editor"
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onInput={handleInput}
            onKeyUp={refreshFmt}
            onMouseUp={refreshFmt}
          />
        </div>

        {/* ══ FOOTER ═══════════════════════════════════════════════ */}
        <div className="rte-footer">
          <span className="rte-footer-hint">Notes are saved for this session only</span>
          <div className="rte-footer-actions">
            <button className="rte-act-btn danger" onClick={handleClear}>
              Clear
            </button>
            <button className="rte-act-btn accent" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "Copy Text"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
