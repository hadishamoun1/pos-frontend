// src/pages/settings/VariantRelinker.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/VarientRelinker.css";

const PAGE_SIZE = 30;

const VariantRelinker = () => {
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // ========== Variant search (tokenized) ==========
  const [variantInput, setVariantInput] = useState("");
  const [variantTokens, setVariantTokens] = useState([]);
  const [variantPage, setVariantPage] = useState(1);
  const [variantResults, setVariantResults] = useState([]);
  const [variantTotal, setVariantTotal] = useState(0);
  const [variantLoading, setVariantLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);

  // ========== Which side to edit & mirror ==========
  const [mode, setMode] = useState("name"); // 'name' | 'real'
  const [alsoSetOtherSide, setAlsoSetOtherSide] = useState(true);

  // ========== Workbench tabs ==========
  // 'select' (pick existing), 'create' (create from fields), 'unlink' (set FK to null)
  const [tab, setTab] = useState("select");

  // ========== Description: select/create ==========
  const [descQuery, setDescQuery] = useState("");
  const [descResults, setDescResults] = useState([]);
  const [descLoading, setDescLoading] = useState(false);
  const [selectedDescId, setSelectedDescId] = useState(null);

  // Create-fields + which sides to create
  const [fields, setFields] = useState({
    itemNumber: "",
    categoryName: "",
    subCategory: "",
    colorName: "",
    designName: "",
  });
  const [createSides, setCreateSides] = useState({
    name: true,
    real: true,
  }); // choose to create name only, real only, or both

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

  // ---------- Normalization helpers ----------
  const normalizeDigits = (s) => {
    if (!s) return "";
    const map = {
      "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
      "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
      "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
      "۵": "5", "۶": "6", "۷": "8", "۸": "8", "۹": "9",
    };
    return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  };

  const normalizeToken = (s) => {
    if (!s) return "";
    let t = String(s)
      .replace(/\u00A0/g, " ")
      .replace(/[xX×✕✖︎]/g, "*")   // 225x321 / 225×321 → 225*321
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    t = normalizeDigits(t);
    return t;
  };

  const makeQueryFromTokens = (tokens) =>
    normalizeDigits(tokens.join(" ").replace(/\s+/g, " ").trim());
  // -------------------------------------------

  // Token actions
  const addToken = (raw) => {
    const t = normalizeToken(raw);
    if (!t) return;
    setVariantTokens((prev) => [...prev, t]);
    setVariantInput("");
    setSelectedVariant(null);
  };

  const removeToken = (idx) => {
    setVariantTokens((prev) => prev.filter((_, i) => i !== idx));
    setSelectedVariant(null);
  };

  const clearTokens = () => {
    setVariantTokens([]);
    setVariantInput("");
    setSelectedVariant(null);
  };

  const onVariantKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addToken(variantInput);
      return;
    }
    if (e.key === "Backspace" && !variantInput) {
      if (variantTokens.length > 0) {
        e.preventDefault();
        removeToken(variantTokens.length - 1);
      }
    }
  };

  // Variant search (debounced on tokens)
  const debounceRef = useRef(null);
  const fetchVariants = async (reset = true, pageArg) => {
    const page = reset ? 1 : (pageArg ?? variantPage);
    setVariantLoading(true);
    try {
      const url = new URL(`${baseUrl}/items/variants/search`);
      const q = makeQueryFromTokens(variantTokens);
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));
      url.searchParams.set("limit", String(PAGE_SIZE));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Variant search failed");
      const json = await res.json();
      if (reset) {
        setVariantResults(Array.isArray(json?.data) ? json.data : []);
        setVariantPage(1);
      } else {
        setVariantResults((p) => [...p, ...(Array.isArray(json?.data) ? json.data : [])]);
        setVariantPage(page);
      }
      setVariantTotal(Number(json?.total ?? 0));
    } catch {
      setVariantResults([]);
      setVariantTotal(0);
    } finally {
      setVariantLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchVariants(true), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantTokens, baseUrl]);

  // Description search (only when in "select" tab)
  const fetchDescriptions = async () => {
    setDescLoading(true);
    try {
      const url = new URL(`${baseUrl}/items/descriptions/search`);
      url.searchParams.set("mode", mode === "real" ? "real" : "name");
      url.searchParams.set("q", descQuery || "");
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", "30");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Description search failed");
      const json = await res.json();
      setDescResults(Array.isArray(json?.data) ? json.data : []);
    } catch {
      setDescResults([]);
    } finally {
      setDescLoading(false);
    }
  };
  useEffect(() => {
    if (tab === "select") {
      const t = setTimeout(fetchDescriptions, 200);
      return () => clearTimeout(t);
    }
  }, [descQuery, mode, tab]); // eslint-disable-line

  // Helpers
  const canSubmit = useMemo(() => {
    if (!selectedVariant) return false;

    if (tab === "unlink") {
      // unlink always valid; controlled by mode + alsoSetOtherSide
      return true;
    }

    if (tab === "select") {
      return Number.isFinite(Number(selectedDescId));
    }

    // tab === "create"
    const anyField =
      fields.itemNumber ||
      fields.categoryName ||
      fields.subCategory ||
      fields.colorName ||
      fields.designName;

    // Must pick at least one side to create
    const anySide = createSides.name || createSides.real;

    return Boolean(anyField && anySide);
  }, [selectedVariant, tab, selectedDescId, fields, createSides]);

  const currentDescToText = (d) =>
    d
      ? [d.itemNumber, d.categoryName, d.subCategory, d.colorName, d.designName]
          .filter(Boolean)
          .join(" • ")
      : "—";

  // Submit
  const handleSubmit = async () => {
    if (!canSubmit || !selectedVariant?.variantId) return;
    setSubmitting(true);
    setStatus(null);
    try {
      let body;

      if (tab === "unlink") {
        // set to NULL
        body = { mode, description: null, alsoSetOtherSide };
      } else if (tab === "select") {
        body = { mode, description: { id: Number(selectedDescId) }, alsoSetOtherSide };
      } else {
        // create
        // We pass mode = the main side to change now.
        // If both sides are selected, we let alsoSetOtherSide mirror on the fly.
        // If only one side is selected, alsoSetOtherSide=false to avoid mirrored creation.
        let effMode = mode;
        let effAlso = alsoSetOtherSide;

        // If user picked only one side to create, force effMode to that side and disable mirror
        if (createSides.name && !createSides.real) {
          effMode = "name";
          effAlso = false;
        } else if (!createSides.name && createSides.real) {
          effMode = "real";
          effAlso = false;
        } else {
          // both sides selected
          // use current toggle 'mode' as the primary and keep alsoSetOtherSide as chosen
          effMode = mode;
          effAlso = true; // both was chosen → ensure mirror is applied
        }

        body = { mode: effMode, fields: { ...fields }, alsoSetOtherSide: effAlso };
      }

      const res = await fetch(
        `${baseUrl}/items/variants/${encodeURIComponent(selectedVariant.variantId)}/description`,
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Update failed");
      }
      const json = await res.json();
      setStatus({ ok: true, message: "Variant description updated." });
      setSelectedVariant((prev) =>
        prev
          ? {
              ...prev,
              itemNameDescription: json?.itemNameDescription ?? prev.itemNameDescription,
              realDescription: json?.realDescription ?? prev.realDescription,
            }
          : prev
      );
    } catch (e) {
      setStatus({ ok: false, message: String(e.message || e) });
    } finally {
      setSubmitting(false);
    }
  };

  const hasMore = variantResults.length < variantTotal;

  return (
    <div className="vr-page">
      <div className="vr-header">
        <h1>Variant Relinker</h1>
        <p className="vr-sub">
          Pin tokens like <b>5.5ملم ابيض</b>, then add size <b>225*321</b> and search together.
        </p>
      </div>

      <div className="vr-grid">
        {/* Left: Variant Picker */}
        <section className="vr-panel">
          <div className="vr-panel-title">1) Find a Variant</div>

          {/* Tokenized search bar */}
          <div className="vr-tokenbar">
            <div className="vr-chip-row">
              {variantTokens.map((t, i) => (
                <span key={`tok-${i}`} className="vr-chip">
                  {t}
                  <button
                    className="vr-chip-x"
                    onClick={() => removeToken(i)}
                    aria-label={`remove token ${t}`}
                    title="Remove token"
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                type="text"
                placeholder="Type and press Enter (e.g., 5.5ملم ابيض, then 225*321)"
                value={variantInput}
                onChange={(e) => setVariantInput(e.target.value)}
                onKeyDown={onVariantKeyDown}
                className="ar-rtl vr-token-input"
                aria-label="Variant search"
              />
            </div>

            <div className="vr-tokenbar-actions">
              <button className="vr-btn" onClick={() => addToken(variantInput)}>Add</button>
              <button className="vr-btn vr-btn-ghost" onClick={clearTokens} disabled={variantTokens.length === 0}>
                Clear
              </button>
              <button className="vr-btn vr-btn-dark" onClick={() => fetchVariants(true)}>
                Search
              </button>
            </div>
          </div>

          <div className="vr-list">
            {variantLoading && variantResults.length === 0 ? (
              <div className="vr-empty">Searching…</div>
            ) : variantResults.length === 0 ? (
              <div className="vr-empty">No variants found.</div>
            ) : (
              variantResults.map((v) => (
                <div className="vr-variant-card" key={`v-${v.variantId}`}>
                  <div className="vr-variant-line">
                    <div className="vr-variant-name ar-rtl"><b>{v.itemName}</b></div>
                    <div className="vr-variant-meta">
                      <span className="vr-badge">{v.type}</span>
                      <span className="vr-dot" />
                      <span>Thickness: {v.thickness}</span>
                      {v.type !== "sqm" && (
                        <>
                          <span className="vr-dot" />
                          <span>{v.length} × {v.width} cm</span>
                        </>
                      )}
                      {v.type === "box" && (
                        <>
                          <span className="vr-dot" />
                          <span>Sheets/Box: {v.sheetsPerBox}</span>
                        </>
                      )}
                      <span className="vr-dot" />
                      <span className="ar-rtl">المنشأ: {v.origin || "—"}</span>
                    </div>
                  </div>

                  <div className="vr-desc-split">
                    <div>
                      <div className="vr-desc-label">Item-Name Description</div>
                      <div className="vr-desc-text ar-rtl">{currentDescToText(v.itemNameDescription)}</div>
                    </div>
                    <div>
                      <div className="vr-desc-label">Real Description</div>
                      <div className="vr-desc-text ar-rtl">{currentDescToText(v.realDescription)}</div>
                    </div>
                  </div>

                  <div className="vr-card-actions">
                    <button className="vr-btn vr-btn-dark" onClick={() => setSelectedVariant(v)}>
                      Select
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="vr-footer">
            {hasMore ? (
              <button
                className="vr-btn vr-btn-pill"
                disabled={variantLoading}
                onClick={() => fetchVariants(false, variantPage + 1)}
              >
                {variantLoading ? "Loading…" : "Load More"}
              </button>
            ) : (
              <button className="vr-btn vr-btn-pill" disabled>
                {variantResults.length}/{variantTotal} loaded
              </button>
            )}
          </div>
        </section>

        {/* Right: Workbench */}
        <section className="vr-panel">
          <div className="vr-panel-title">2) Relink Description</div>

          {!selectedVariant ? (
            <div className="vr-empty">Select a variant from the left.</div>
          ) : (
            <>
              <div className="vr-selected">
                <div className="vr-variant-line">
                  <div className="vr-variant-name ar-rtl"><b>{selectedVariant.itemName}</b></div>
                  <div className="vr-variant-meta">
                    <span className="vr-badge">{selectedVariant.type}</span>
                    <span className="vr-dot" />
                    <span>Thickness: {selectedVariant.thickness}</span>
                    {selectedVariant.type !== "sqm" && (
                      <>
                        <span className="vr-dot" />
                        <span>{selectedVariant.length} × {selectedVariant.width} cm</span>
                      </>
                    )}
                    {selectedVariant.type === "box" && (
                      <>
                        <span className="vr-dot" />
                        <span>Sheets/Box: {selectedVariant.sheetsPerBox}</span>
                      </>
                    )}
                    <span className="vr-dot" />
                    <span className="ar-rtl">المنشأ: {selectedVariant.origin || "—"}</span>
                  </div>
                </div>

                <div className="vr-desc-split">
                  <div>
                    <div className="vr-desc-label">Current Item-Name</div>
                    <div className="vr-desc-text ar-rtl">
                      {currentDescToText(selectedVariant.itemNameDescription)}
                    </div>
                  </div>
                  <div>
                    <div className="vr-desc-label">Current Real</div>
                    <div className="vr-desc-text ar-rtl">
                      {currentDescToText(selectedVariant.realDescription)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Side toggle + mirror toggle */}
              <div className="vr-toggle-row">
                <div className="vr-toggle">
                  <label className="toggle-pill" title="Switch editing side">
                    <input
                      type="checkbox"
                      checked={mode === "real"}
                      onChange={(e) => setMode(e.target.checked ? "real" : "name")}
                    />
                    <span className="pill">
                      {mode === "real" ? "Editing: Real Description" : "Editing: Item-Name Description"}
                    </span>
                  </label>
                </div>

                <label className="vr-check">
                  <input
                    type="checkbox"
                    checked={alsoSetOtherSide}
                    onChange={(e) => setAlsoSetOtherSide(e.target.checked)}
                  />
                  <span>Also set the other side</span>
                </label>
              </div>

              {/* Tabs: select / create / unlink */}
              <div className="vr-tabs">
                <button
                  className={`vr-tab ${tab === "select" ? "active" : ""}`}
                  onClick={() => setTab("select")}
                >
                  Select existing
                </button>
                <button
                  className={`vr-tab ${tab === "create" ? "active" : ""}`}
                  onClick={() => setTab("create")}
                >
                  Create new
                </button>
                <button
                  className={`vr-tab ${tab === "unlink" ? "active" : ""}`}
                  onClick={() => setTab("unlink")}
                >
                  Unlink (set to NULL)
                </button>
              </div>

              {/* Select existing */}
              {tab === "select" && (
                <div className="vr-box">
                  <div className="vr-search">
                    <input
                      type="text"
                      placeholder={`Search ${mode === "real" ? "Real" : "Item-Name"} descriptions…`}
                      value={descQuery}
                      onChange={(e) => setDescQuery(e.target.value)}
                      className="ar-rtl"
                    />
                    <button className="vr-btn" onClick={fetchDescriptions}>Search</button>
                  </div>
                  <div className="vr-autolist">
                    {descLoading ? (
                      <div className="vr-empty">Searching…</div>
                    ) : descResults.length === 0 ? (
                      <div className="vr-empty">No descriptions found.</div>
                    ) : (
                      descResults.map((d) => (
                        <label key={`d-${mode}-${d.id}`} className="vr-radio-row">
                          <input
                            type="radio"
                            name="descPick"
                            checked={Number(selectedDescId) === Number(d.id)}
                            onChange={() => setSelectedDescId(d.id)}
                          />
                          <span className="ar-rtl">{currentDescToText(d)}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Create new */}
              {tab === "create" && (
                <div className="vr-box">
                  {/* Which sides to create */}
                  <div className="vr-side-choices">
                    <label className="vr-check">
                      <input
                        type="checkbox"
                        checked={createSides.name}
                        onChange={(e) => setCreateSides((p) => ({ ...p, name: e.target.checked }))}
                      />
                      <span>Create Item-Name</span>
                    </label>
                    <label className="vr-check">
                      <input
                        type="checkbox"
                        checked={createSides.real}
                        onChange={(e) => setCreateSides((p) => ({ ...p, real: e.target.checked }))}
                      />
                      <span>Create Real</span>
                    </label>
                  </div>

                  <div className="vr-form-grid">
                    <label>
                      <span>Item Number</span>
                      <input
                        type="text"
                        className="ltr"
                        value={fields.itemNumber}
                        onChange={(e) => setFields((p) => ({ ...p, itemNumber: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Category</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.categoryName}
                        onChange={(e) => setFields((p) => ({ ...p, categoryName: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Subcategory</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.subCategory}
                        onChange={(e) => setFields((p) => ({ ...p, subCategory: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Color</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.colorName}
                        onChange={(e) => setFields((p) => ({ ...p, colorName: e.target.value }))}
                      />
                    </label>
                    <label>
                      <span>Design</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.designName}
                        onChange={(e) => setFields((p) => ({ ...p, designName: e.target.value }))}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Unlink */}
              {tab === "unlink" && (
                <div className="vr-box">
                  <p className="vr-empty">
                    This will set the selected side’s description to <b>NULL</b>.  
                    Turn on “Also set the other side” above to null both.
                  </p>
                </div>
              )}

              {/* Preview */}
              <div className="vr-preview">
                <div className="vr-preview-title">Preview</div>
                <div className="vr-preview-body">
                  {tab === "unlink" ? (
                    <>
                      <div>
                        <div className="vr-desc-label">Operation</div>
                        <div className="vr-desc-text">
                          Unlink (set to NULL) {mode === "real" ? "Real Description" : "Item-Name Description"}
                        </div>
                      </div>
                      <div>
                        <div className="vr-desc-label">Also set other side?</div>
                        <div className="vr-desc-text">{alsoSetOtherSide ? "Yes (both to NULL)" : "No"}</div>
                      </div>
                    </>
                  ) : tab === "select" ? (
                    <>
                      <div>
                        <div className="vr-desc-label">Will link (this side)</div>
                        <div className="vr-desc-text ar-rtl">
                          {(() => {
                            const picked = descResults.find((d) => Number(d.id) === Number(selectedDescId));
                            return picked ? currentDescToText(picked) : "—";
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="vr-desc-label">Also set other side?</div>
                        <div className="vr-desc-text">{alsoSetOtherSide ? "Yes" : "No"}</div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="vr-desc-label">Will create from fields</div>
                        <div className="vr-desc-text ar-rtl">{currentDescToText(fields)}</div>
                      </div>
                      <div>
                        <div className="vr-desc-label">Sides</div>
                        <div className="vr-desc-text">
                          {createSides.name && createSides.real
                            ? "Both (Item-Name & Real)"
                            : createSides.name
                            ? "Item-Name only"
                            : createSides.real
                            ? "Real only"
                            : "—"}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="vr-actions">
                <button className="vr-btn vr-btn-dark" disabled={!canSubmit || submitting} onClick={handleSubmit}>
                  {submitting ? "Applying…" : "Apply Changes"}
                </button>
                {status && (
                  <span className={`vr-status ${status.ok ? "vr-status-ok" : "vr-status-err"}`}>
                    {status.message}
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default VariantRelinker;
