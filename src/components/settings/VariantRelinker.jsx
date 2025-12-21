// src/pages/settings/VariantRelinker.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import "./styles/VarientRelinker.css";
import { axiosClient } from "../api/axiosClient"; // ✅ use axiosClient (baseURL is /api)

const PAGE_SIZE = 30;

const VariantRelinker = () => {
  // ---------- Normalization helpers ----------
  const normalizeDigits = (s) => {
    if (!s) return "";
    const map = {
      "٠": "0",
      "١": "1",
      "٢": "2",
      "٣": "3",
      "٤": "4",
      "٥": "5",
      "٦": "6",
      "٧": "7",
      "٨": "8",
      "٩": "9",
      "۰": "0",
      "۱": "1",
      "۲": "2",
      "۳": "3",
      "۴": "4",
      "۵": "5",
      "۶": "6",
      "۷": "7",
      "۸": "8",
      "۹": "9",
    };
    return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  };

  const normalizeToken = (s) => {
    if (!s) return "";
    let t = String(s)
      .replace(/\u00A0/g, " ")
      .replace(/[xX×✕✖︎]/g, "*") // 225x321 / 225×321 -> 225*321
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
    t = normalizeDigits(t);
    return t;
  };

  const makeQueryFromTokens = (tokens) =>
    normalizeDigits(tokens.join(" ").replace(/\s+/g, " ").trim());
  // -------------------------------------------

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
  const [tab, setTab] = useState("select"); // 'select' | 'create' | 'unlink'

  // ========== Description: select/create ==========
  const [descQuery, setDescQuery] = useState("");
  const [descResults, setDescResults] = useState([]);
  const [descLoading, setDescLoading] = useState(false);
  const [selectedDescId, setSelectedDescId] = useState(null);

  const [fields, setFields] = useState({
    itemNumber: "",
    categoryName: "",
    subCategory: "",
    colorName: "",
    designName: "",
  });

  const [createSides, setCreateSides] = useState({ name: true, real: true });

  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);

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

  // ✅ Helper to read paginated responses with different shapes
  const toArray = (x) => (Array.isArray(x) ? x : []);
  const pickData = (json) =>
    toArray(json?.data) || toArray(json?.items) || toArray(json?.results) || [];
  const pickTotal = (json, fallbackLen) => {
    const n =
      json?.total ??
      json?.totalRows ??
      json?.totalCount ??
      json?.count ??
      json?.recordsTotal ??
      null;
    const num = Number(n);
    return Number.isFinite(num) ? num : fallbackLen ?? 0;
  };

  // ✅ Variant search (axiosClient)
  const fetchVariants = useCallback(
    async (reset = true, pageArg) => {
      const page = reset ? 1 : pageArg ?? variantPage;
      const q = makeQueryFromTokens(variantTokens);

      setVariantLoading(true);
      try {
        const res = await axiosClient.get(`/items/variants/search`, {
          params: { q, page, limit: PAGE_SIZE },
        });

        const json = res.data;
        const data = pickData(json);
        const total = pickTotal(json, data.length);

        if (reset) {
          setVariantResults(data);
          setVariantPage(1);
        } else {
          setVariantResults((p) => [...p, ...data]);
          setVariantPage(page);
        }
        setVariantTotal(total);
      } catch (e) {
        setVariantResults([]);
        setVariantTotal(0);
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Failed to fetch variants";
        setStatus({ ok: false, message: String(msg) });
      } finally {
        setVariantLoading(false);
      }
    },
    [variantTokens, variantPage]
  );

  // Debounce token changes -> search
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchVariants(true), 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [variantTokens, fetchVariants]);

  // ✅ Description search (axiosClient)
  const fetchDescriptions = useCallback(async () => {
    setDescLoading(true);
    try {
      const res = await axiosClient.get(`/items/descriptions/search`, {
        params: {
          mode: mode === "real" ? "real" : "name",
          q: descQuery || "",
          page: 1,
          limit: 30,
        },
      });

      const json = res.data;
      setDescResults(pickData(json));
    } catch (e) {
      setDescResults([]);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to fetch descriptions";
      setStatus({ ok: false, message: String(msg) });
    } finally {
      setDescLoading(false);
    }
  }, [mode, descQuery]);

  useEffect(() => {
    if (tab !== "select") return;
    const t = setTimeout(fetchDescriptions, 200);
    return () => clearTimeout(t);
  }, [tab, fetchDescriptions]);

  const canSubmit = useMemo(() => {
    if (!selectedVariant) return false;
    if (tab === "unlink") return true;
    if (tab === "select") return Number.isFinite(Number(selectedDescId));

    const anyField =
      fields.itemNumber ||
      fields.categoryName ||
      fields.subCategory ||
      fields.colorName ||
      fields.designName;

    const anySide = createSides.name || createSides.real;

    return Boolean(anyField && anySide);
  }, [selectedVariant, tab, selectedDescId, fields, createSides]);

  const currentDescToText = (d) =>
    d
      ? [d.itemNumber, d.categoryName, d.subCategory, d.colorName, d.designName]
          .filter(Boolean)
          .join(" • ")
      : "—";

  const handleSubmit = async () => {
    if (!canSubmit || !selectedVariant?.variantId) return;

    setSubmitting(true);
    setStatus(null);

    try {
      let body;

      if (tab === "unlink") {
        body = { mode, description: null, alsoSetOtherSide };
      } else if (tab === "select") {
        body = {
          mode,
          description: { id: Number(selectedDescId) },
          alsoSetOtherSide,
        };
      } else {
        let effMode = mode;
        let effAlso = alsoSetOtherSide;

        if (createSides.name && !createSides.real) {
          effMode = "name";
          effAlso = false;
        } else if (!createSides.name && createSides.real) {
          effMode = "real";
          effAlso = false;
        } else {
          effMode = mode;
          effAlso = true;
        }

        body = { mode: effMode, fields: { ...fields }, alsoSetOtherSide: effAlso };
      }

      const id = encodeURIComponent(selectedVariant.variantId);
      const res = await axiosClient.put(`/items/variants/${id}/description`, body);

      const json = res.data;

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
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to update variant description";
      setStatus({ ok: false, message: String(msg) });
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
          Pin tokens like <b>5.5ملم ابيض</b>, then add size <b>225*321</b> and
          search together.
        </p>
      </div>

      <div className="vr-grid">
        {/* Left: Variant Picker */}
        <section className="vr-panel">
          <div className="vr-panel-title">1) Find a Variant</div>

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
              <button className="vr-btn" onClick={() => addToken(variantInput)}>
                Add
              </button>
              <button
                className="vr-btn vr-btn-ghost"
                onClick={clearTokens}
                disabled={variantTokens.length === 0}
              >
                Clear
              </button>
              <button
                className="vr-btn vr-btn-dark"
                onClick={() => fetchVariants(true)}
              >
                Search
              </button>
            </div>
          </div>

          {status?.ok === false && (
            <div className="vr-status vr-status-err" style={{ marginTop: 10 }}>
              {status.message}
            </div>
          )}

          <div className="vr-list">
            {variantLoading && variantResults.length === 0 ? (
              <div className="vr-empty">Searching…</div>
            ) : variantResults.length === 0 ? (
              <div className="vr-empty">No variants found.</div>
            ) : (
              variantResults.map((v) => (
                <div className="vr-variant-card" key={`v-${v.variantId}`}>
                  <div className="vr-variant-line">
                    <div className="vr-variant-name ar-rtl">
                      <b>{v.itemName}</b>
                    </div>
                    <div className="vr-variant-meta">
                      <span className="vr-badge">{v.type}</span>
                      <span className="vr-dot" />
                      <span>Thickness: {v.thickness}</span>
                      {v.type !== "sqm" && (
                        <>
                          <span className="vr-dot" />
                          <span>
                            {v.length} × {v.width} cm
                          </span>
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
                      <div className="vr-desc-text ar-rtl">
                        {currentDescToText(v.itemNameDescription)}
                      </div>
                    </div>
                    <div>
                      <div className="vr-desc-label">Real Description</div>
                      <div className="vr-desc-text ar-rtl">
                        {currentDescToText(v.realDescription)}
                      </div>
                    </div>
                  </div>

                  <div className="vr-card-actions">
                    <button
                      className="vr-btn vr-btn-dark"
                      onClick={() => setSelectedVariant(v)}
                    >
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
                  <div className="vr-variant-name ar-rtl">
                    <b>{selectedVariant.itemName}</b>
                  </div>
                  <div className="vr-variant-meta">
                    <span className="vr-badge">{selectedVariant.type}</span>
                    <span className="vr-dot" />
                    <span>Thickness: {selectedVariant.thickness}</span>
                    {selectedVariant.type !== "sqm" && (
                      <>
                        <span className="vr-dot" />
                        <span>
                          {selectedVariant.length} × {selectedVariant.width} cm
                        </span>
                      </>
                    )}
                    {selectedVariant.type === "box" && (
                      <>
                        <span className="vr-dot" />
                        <span>Sheets/Box: {selectedVariant.sheetsPerBox}</span>
                      </>
                    )}
                    <span className="vr-dot" />
                    <span className="ar-rtl">
                      المنشأ: {selectedVariant.origin || "—"}
                    </span>
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

              <div className="vr-toggle-row">
                <div className="vr-toggle">
                  <label className="toggle-pill" title="Switch editing side">
                    <input
                      type="checkbox"
                      checked={mode === "real"}
                      onChange={(e) =>
                        setMode(e.target.checked ? "real" : "name")
                      }
                    />
                    <span className="pill">
                      {mode === "real"
                        ? "Editing: Real Description"
                        : "Editing: Item-Name Description"}
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

              {tab === "select" && (
                <div className="vr-box">
                  <div className="vr-search">
                    <input
                      type="text"
                      placeholder={`Search ${
                        mode === "real" ? "Real" : "Item-Name"
                      } descriptions…`}
                      value={descQuery}
                      onChange={(e) => setDescQuery(e.target.value)}
                      className="ar-rtl"
                    />
                    <button className="vr-btn" onClick={fetchDescriptions}>
                      Search
                    </button>
                  </div>
                  <div className="vr-autolist">
                    {descLoading ? (
                      <div className="vr-empty">Searching…</div>
                    ) : descResults.length === 0 ? (
                      <div className="vr-empty">No descriptions found.</div>
                    ) : (
                      descResults.map((d) => (
                        <label
                          key={`d-${mode}-${d.id}`}
                          className="vr-radio-row"
                        >
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

              {tab === "create" && (
                <div className="vr-box">
                  <div className="vr-side-choices">
                    <label className="vr-check">
                      <input
                        type="checkbox"
                        checked={createSides.name}
                        onChange={(e) =>
                          setCreateSides((p) => ({
                            ...p,
                            name: e.target.checked,
                          }))
                        }
                      />
                      <span>Create Item-Name</span>
                    </label>
                    <label className="vr-check">
                      <input
                        type="checkbox"
                        checked={createSides.real}
                        onChange={(e) =>
                          setCreateSides((p) => ({
                            ...p,
                            real: e.target.checked,
                          }))
                        }
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
                        onChange={(e) =>
                          setFields((p) => ({
                            ...p,
                            itemNumber: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Category</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.categoryName}
                        onChange={(e) =>
                          setFields((p) => ({
                            ...p,
                            categoryName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Subcategory</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.subCategory}
                        onChange={(e) =>
                          setFields((p) => ({
                            ...p,
                            subCategory: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Color</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.colorName}
                        onChange={(e) =>
                          setFields((p) => ({
                            ...p,
                            colorName: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Design</span>
                      <input
                        type="text"
                        className="ar-rtl"
                        value={fields.designName}
                        onChange={(e) =>
                          setFields((p) => ({
                            ...p,
                            designName: e.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              )}

              {tab === "unlink" && (
                <div className="vr-box">
                  <p className="vr-empty">
                    This will set the selected side’s description to <b>NULL</b>.
                    Turn on “Also set the other side” above to null both.
                  </p>
                </div>
              )}

              <div className="vr-actions">
                <button
                  className="vr-btn vr-btn-dark"
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? "Applying…" : "Apply Changes"}
                </button>
                {status && (
                  <span
                    className={`vr-status ${
                      status.ok ? "vr-status-ok" : "vr-status-err"
                    }`}
                  >
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
