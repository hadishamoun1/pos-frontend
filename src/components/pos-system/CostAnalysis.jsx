// src/pages/Reports/CostAnalysis.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import "./Reports.css";
import "./CostAnalysis.css";
import { axiosClient } from "../api/axiosClient"; // ✅ API client

// number formatter
const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// normalize date fields coming from API
const getRowDate = (row) => {
  const raw = row?.dateForEachInvoice || row?.transactionDate || null;
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
};

// 🔹 Event columns (always visible)
const EVENT_COLUMNS = [
  { key: "transactionType", label: "Type" },
  { key: "sqm", label: "SQM" },
  { key: "sqmofr", label: "SQM OFR" },
  { key: "finalcost", label: "Final Cost" },
  { key: "finalcostofr", label: "Final Cost OFR" },
];

// 🔹 Toggleable cost columns (with checkboxes) – same as before
const VARIANT_COLUMNS = [
  { key: "previousQuantity", label: "Prev Qty" },
  { key: "previousQuantityC", label: "Prev Qty C" },
  { key: "previousQuantityVM", label: "Prev Qty VM" },
  { key: "previousQuantityCVM", label: "Prev Qty CVM" },
  { key: "previousAverageCost", label: "Prev Avg Cost" },
  { key: "previousAverageCostC", label: "Prev Avg Cost C" },
  { key: "previousAverageCostVM", label: "Prev Avg Cost VM" },
  { key: "previousAverageCostCVM", label: "Prev Avg Cost CVM" },
  { key: "priceOFR", label: "Price OFR" },
  { key: "finalOFR", label: "Final Cost OFR" },
  { key: "averageCost", label: "Avg Cost" },
  { key: "averageCostC", label: "Avg Cost C" },
  { key: "averageCostVM", label: "Avg Cost VM" },
  { key: "averageCostCVM", label: "Avg Cost CVM" },
];

export default function CostAnalysis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [searchTokens, setSearchTokens] = useState([]); // pinned chips

  const [thicknessFilter, setThicknessFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");

  const [mode, setMode] = useState("variant"); // 'variant' | 'description'
  const isVariantMode = mode === "variant";

  // toggleable variant columns
  const [visibleVariantCols, setVisibleVariantCols] = useState(() =>
    VARIANT_COLUMNS.map((c) => c.key) // default: all ON
  );

  const printAreaRef = useRef(null);
  const printFrameRef = useRef(null);

  // -------- Helper to build URL with q ---------- //
  const buildUrl = () => {
    // ✅ relative endpoints ONLY (no baseUrl)
    const endpoint =
      mode === "variant"
        ? `/purchase-invoices/cost-analysis/history`
        : `/purchase-invoices/cost-analysis/real-description-history`;

    const params = new URLSearchParams();
    if (searchTokens.length > 0) {
      params.append("q", searchTokens.join(" "));
    }

    const qs = params.toString();
    return qs ? `${endpoint}?${qs}` : endpoint;
  };

  // -------- Load data whenever mode or tokens change ---------- //
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const url = buildUrl();

        // ✅ use axiosClient instead of fetch
        const res = await axiosClient.get(url);
        const data = res.data;

        if (!cancelled) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("❌ Cost analysis fetch error:", err);
          setError("Could not load cost data. Please try again.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [mode, searchTokens]);

  // -------- Search input handlers (chips) ---------- //
  const addTokenFromInput = () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    if (!searchTokens.includes(trimmed)) {
      setSearchTokens((prev) => [...prev, trimmed]);
    }
    setSearchInput("");
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTokenFromInput();
    }
  };

  const removeToken = (idx) => {
    setSearchTokens((prev) => prev.filter((_, i) => i !== idx));
  };

  // toggle a single variant column (checkbox)
  const toggleVariantColumn = (key) => {
    setVisibleVariantCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectAllVariantCols = () => {
    setVisibleVariantCols(VARIANT_COLUMNS.map((c) => c.key));
  };
  const clearVariantCols = () => {
    setVisibleVariantCols([]);
  };

  // unique options for filters (only useful in variant mode)
  const thicknessOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.thickness != null) set.add(Number(r.thickness));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [rows]);

  const originOptions = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.origin) set.add(String(r.origin));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // apply filters
  const filteredRows = useMemo(() => {
    if (!isVariantMode) return rows;

    return rows.filter((r) => {
      if (thicknessFilter && Number(r.thickness) !== Number(thicknessFilter)) {
        return false;
      }
      if (originFilter && String(r.origin) !== originFilter) {
        return false;
      }
      return true;
    });
  }, [rows, thicknessFilter, originFilter, isVariantMode]);

  // group rows
  const groupedVariants = useMemo(() => {
    const map = new Map();

    for (const r of filteredRows) {
      if (isVariantMode) {
        const key = r.itemVariantId; // align with API
        if (!key) continue;

        if (!map.has(key)) {
          map.set(key, {
            variantId: key,
            itemVariantId: key,
            itemName: r.itemName,
            thickness: r.thickness,
            length: r.length,
            width: r.width,
            origin: r.origin,
            sortIndex: r.sortIndex,
            categoryName: r.categoryName,
            subCategory: r.subCategory,
            colorName: r.colorName,
            designName: r.designName,
            itemNumber: r.itemNumber,
            history: [],
          });
        }
        map.get(key).history.push(r);
      } else {
        const key = r.realDescriptionId;
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, {
            realDescriptionId: key,
            itemName: r.itemName,
            categoryName: r.categoryName,
            subCategory: r.subCategory,
            colorName: r.colorName,
            designName: r.designName,
            itemNumber: r.itemNumber,
            sortIndex: r.sortIndex,
            thickness: r.thickness ?? null,
            history: [],
          });
        } else {
          const existing = map.get(key);
          if (
            (existing.thickness == null || Number.isNaN(existing.thickness)) &&
            r.thickness != null
          ) {
            existing.thickness = r.thickness;
          }
        }
        map.get(key).history.push(r);
      }
    }

    const arr = Array.from(map.values());

    arr.sort((a, b) => {
      const siA = a.sortIndex ?? 999999;
      const siB = b.sortIndex ?? 999999;
      if (siA !== siB) return siA - siB;

      if (isVariantMode) {
        const tA = Number(a.thickness ?? 0);
        const tB = Number(b.thickness ?? 0);
        if (tA !== tB) return tA - tB;

        const lA = Number(a.length ?? 0);
        const lB = Number(b.length ?? 0);
        if (lA !== lB) return lA - lB;

        const wA = Number(a.width ?? 0);
        const wB = Number(b.width ?? 0);
        if (wA !== wB) return wA - wB;

        return 0;
      } else {
        const catA = (a.categoryName || "").localeCompare(b.categoryName || "");
        if (catA !== 0) return catA;

        const colA = (a.colorName || "").localeCompare(b.colorName || "");
        if (colA !== 0) return colA;

        const desA = (a.designName || "").localeCompare(b.designName || "");
        if (desA !== 0) return desA;

        return 0;
      }
    });

    // sort each variant's history by normalized date
    arr.forEach((v) => {
      v.history.sort((ra, rb) =>
        String(getRowDate(ra)).localeCompare(String(getRowDate(rb)))
      );
    });

    return arr;
  }, [filteredRows, isVariantMode]);

  const totalHistoryRows = filteredRows.length;

  // ---------- PRINT HANDLER (iframe) ---------- //
  const handlePrint = () => {
    const frame = printFrameRef.current;
    if (!frame) return;

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (!doc) return;

    const escapeHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const activeVariantColumns = VARIANT_COLUMNS.filter((col) =>
      visibleVariantCols.includes(col.key)
    );

    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charSet="utf-8" />
  <title>Cost Analysis</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    h2 { font-size: 16px; margin-top: 24px; margin-bottom: 4px; }
    .meta { font-size: 11px; color: #555; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; font-size: 11px; text-align: right; }
    th { background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Cost Analysis - ${isVariantMode ? "Variant View" : "Description View"}</h1>
  <div style="font-size:11px; margin-bottom:10px;">
    Generated on: ${escapeHtml(new Date().toLocaleString())}
  </div>
`;

    groupedVariants.forEach((v) => {
      let title = "";
      if (isVariantMode) {
        const parts = [];
        if (v.itemName) parts.push(v.itemName);
        if (v.thickness != null) parts.push(`${v.thickness} ملم`);
        if (parts.length === 0 && v.variantId != null) {
          parts.push(`Variant #${v.variantId}`);
        }
        title = parts.join(" ");
      } else {
        const parts = [];
        if (v.itemName) parts.push(v.itemName);
        if (v.thickness != null) parts.push(`${v.thickness} ملم`);
        if (v.categoryName) parts.push(v.categoryName);
        if (v.colorName) parts.push(v.colorName);
        if (v.designName) parts.push(v.designName);
        title = parts.join(" - ");
      }

      const baseDims =
        isVariantMode && v.length && v.width
          ? `${Math.floor(Number(v.length))} × ${Math.floor(Number(v.width))}`
          : "";

      const dims =
        baseDims && v.sheetsPerBox
          ? `${baseDims} (${v.sheetsPerBox} sheets/box)`
          : baseDims || "-";

      if (isVariantMode) {
        const metaParts = [];
        if (v.categoryName) {
          metaParts.push(
            `${v.categoryName}${v.subCategory ? ` / ${v.subCategory}` : ""}`
          );
        }
        if (v.origin) {
          metaParts.push(`Origin: ${v.origin}`);
        }
        if (dims !== "-") {
          metaParts.push(`Size: ${dims}`);
        }
        if (metaParts.length > 0) {
          html += `<div class="meta">${escapeHtml(metaParts.join(" | "))}</div>`;
        }
      }

      if (isVariantMode) {
        html += `
<table>
  <thead>
    <tr>
      <th>Date / التاريخ</th>
      ${EVENT_COLUMNS.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("")}
      ${activeVariantColumns
        .map((col) => `<th>${escapeHtml(col.label)}</th>`)
        .join("")}
    </tr>
  </thead>
  <tbody>
`;
        v.history.forEach((h) => {
          html += `
    <tr>
      <td>${escapeHtml(getRowDate(h))}</td>
      ${EVENT_COLUMNS.map((col) =>
        col.key === "transactionType"
          ? `<td>${escapeHtml(h[col.key] ?? "")}</td>`
          : `<td>${fmt2(h[col.key])}</td>`
      ).join("")}
      ${activeVariantColumns
        .map((col) => `<td>${fmt2(h[col.key])}</td>`)
        .join("")}
    </tr>
`;
        });
        html += `
  </tbody>
</table>
`;
      } else {
        html += `
<table>
  <thead>
    <tr>
      <th>Date / التاريخ</th>
      <th>Opening Qty C</th>
      <th>Opening Qty VM</th>
      <th>Prev Qty C</th>
      <th>PO Qty (sqm)</th>
      <th>Avg Cost C</th>
      <th>Last Cost C</th>
      <th>Final Cost OFR</th>
    </tr>
  </thead>
  <tbody>
`;
        v.history.forEach((h) => {
          html += `
    <tr>
      <td>${escapeHtml(getRowDate(h))}</td>
      <td>${fmt2(h.openingQuantityC)}</td>
      <td>${fmt2(h.openingQuantityVM)}</td>
      <td>${fmt2(h.previousQuantityC)}</td>
      <td>${fmt2(h.poQty)}</td>
      <td>${fmt2(h.averageCostC)}</td>
      <td>${fmt2(h.lastCostC)}</td>
      <td>${fmt2(h.finalCostOFR)}</td>
    </tr>
`;
        });
        html += `
  </tbody>
</table>
`;
      }
    });

    html += `
</body>
</html>
`;

    doc.open();
    doc.write(html);
    doc.close();

    if (frame.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    }
  };

  return (
    <div className="cost-analysis-container">
      <div className="cost-analysis-header">
        <div>
          <h2>Cost Analysis / تحليل الكلفة</h2>
          <p className="cost-analysis-subtitle">
            {isVariantMode
              ? "Track the evolution of cost events (Opening, Purchase, Transfer) and average costs for each item variant."
              : "View cost history grouped by Real Description (category / color / design) across all related variants."}
          </p>
        </div>
      </div>

      <div className="cost-analysis-toolbar">
        {/* Search + chips */}
        <div className="cost-analysis-search-group">
          <label className="cost-analysis-label" htmlFor="cost-search">
            Search / بحث
          </label>
          <input
            id="cost-search"
            type="text"
            className="cost-analysis-input"
            placeholder="Type 5ملم ابيض, then 225*321-027 and press Enter to pin…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {searchTokens.length > 0 && (
            <div className="cost-analysis-chip-row">
              {searchTokens.map((tok, idx) => (
                <span key={idx} className="cost-analysis-chip-pill">
                  <span className="cost-analysis-chip-text">{tok}</span>
                  <button
                    type="button"
                    className="cost-analysis-chip-remove"
                    onClick={() => removeToken(idx)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Filters + column toggles */}
        <div className="cost-analysis-filters-and-columns">
          <div className="cost-analysis-filters">
            <div className="cost-analysis-filter">
              <label className="cost-analysis-label" htmlFor="filter-thickness">
                Thickness / السماكة
              </label>
              <select
                id="filter-thickness"
                className="cost-analysis-select"
                value={thicknessFilter}
                onChange={(e) => setThicknessFilter(e.target.value)}
                disabled={!isVariantMode}
              >
                <option value="">All / الكل</option>
                {thicknessOptions.map((t) => (
                  <option key={t} value={t}>
                    {t} ملم
                  </option>
                ))}
              </select>
            </div>

            <div className="cost-analysis-filter">
              <label className="cost-analysis-label" htmlFor="filter-origin">
                Origin / المنشأ
              </label>
              <select
                id="filter-origin"
                className="cost-analysis-select"
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                disabled={!isVariantMode}
              >
                <option value="">All / الكل</option>
                {originOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isVariantMode && (
            <div className="cost-analysis-columns-box">
              <div className="cost-analysis-columns-header">
                <span className="cost-analysis-label">Columns / الأعمدة</span>
                <div className="cost-analysis-columns-actions">
                  <button
                    type="button"
                    className="columns-small-btn"
                    onClick={selectAllVariantCols}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className="columns-small-btn"
                    onClick={clearVariantCols}
                  >
                    None
                  </button>
                </div>
              </div>
              <div className="cost-analysis-columns-grid">
                {VARIANT_COLUMNS.map((col) => (
                  <label key={col.key} className="cost-analysis-column-checkbox">
                    <input
                      type="checkbox"
                      checked={visibleVariantCols.includes(col.key)}
                      onChange={() => toggleVariantColumn(col.key)}
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary row with toggle on the right */}
      <div className="cost-analysis-summary">
        {loading && <span>Loading cost data… / جاري تحميل البيانات…</span>}
        {!loading && error && (
          <span className="cost-analysis-error">{error}</span>
        )}
        {!loading && !error && (
          <>
            <span>
              {isVariantMode ? "Variants shown:" : "Descriptions shown:"}{" "}
              <strong>{groupedVariants.length}</strong>
            </span>
            <span>
              History rows: <strong>{totalHistoryRows}</strong>
            </span>

            <div className="cost-analysis-summary-right">
              <div className="cost-analysis-toggle">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={!isVariantMode}
                    onChange={(e) =>
                      setMode(e.target.checked ? "description" : "variant")
                    }
                  />
                  <span className="slider"></span>
                </label>
                <span className="toggle-label">
                  {isVariantMode ? "Variant View" : "Description View"}
                </span>
              </div>

              <button
                type="button"
                className="cost-analysis-print-btn"
                onClick={handlePrint}
                disabled={groupedVariants.length === 0}
              >
                Print
              </button>
            </div>
          </>
        )}
      </div>

      {!loading && !error && groupedVariants.length === 0 && (
        <div className="cost-analysis-empty">
          <p>No matching data. Try changing filters or search chips.</p>
        </div>
      )}

      {!loading && !error && groupedVariants.length > 0 && (
        <div className="cost-analysis-variants-list" ref={printAreaRef}>
          {groupedVariants.map((v) => {
            let title = "";
            if (isVariantMode) {
              const parts = [];
              if (v.itemName) parts.push(v.itemName);
              if (v.thickness != null) parts.push(`${v.thickness} ملم`);
              if (parts.length === 0 && v.variantId != null) {
                parts.push(`Variant #${v.variantId}`);
              }
              title = parts.join(" ");
            } else {
              const parts = [];
              if (v.itemName) parts.push(v.itemName);
              if (v.thickness != null) parts.push(`${v.thickness} ملم`);
              if (v.categoryName) parts.push(v.categoryName);
              if (v.colorName) parts.push(v.colorName);
              if (v.designName) parts.push(v.designName);
              title = parts.join(" - ");
            }

            const dims =
              isVariantMode && v.length && v.width
                ? `${Math.floor(Number(v.length))} × ${Math.floor(
                    Number(v.width)
                  )} (${v.sheetsPerBox ?? ""} sheets/box)`
                : "-";

            return (
              <div
                key={isVariantMode ? v.variantId : v.realDescriptionId ?? title}
                className="cost-analysis-card"
              >
                <div className="cost-analysis-card-header">
                  <div className="cost-analysis-card-main">
                    <div className="cost-analysis-title-line">
                      <span className="cost-analysis-title">
                        {title || "Unnamed"}
                      </span>
                      {v.itemNumber && (
                        <span className="cost-analysis-chip">
                          Code: {v.itemNumber}
                        </span>
                      )}
                    </div>
                    <div className="cost-analysis-meta-line">
                      {v.categoryName && (
                        <span className="cost-analysis-meta">
                          {v.categoryName}
                          {v.subCategory ? ` / ${v.subCategory}` : ""}
                        </span>
                      )}
                      {isVariantMode && v.origin && (
                        <span className="cost-analysis-pill">
                          Origin: {v.origin}
                        </span>
                      )}
                      {isVariantMode && dims !== "-" && (
                        <span className="cost-analysis-pill">Size: {dims}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="cost-analysis-table-wrapper">
                  <table className="cost-analysis-table">
                    <thead>
                      {isVariantMode ? (
                        <tr>
                          <th>Date / التاريخ</th>
                          {EVENT_COLUMNS.map((col) => (
                            <th key={col.key}>{col.label}</th>
                          ))}
                          {VARIANT_COLUMNS.map(
                            (col) =>
                              visibleVariantCols.includes(col.key) && (
                                <th key={col.key}>{col.label}</th>
                              )
                          )}
                        </tr>
                      ) : (
                        <tr>
                          <th>Date / التاريخ</th>
                          <th>Opening Qty C</th>
                          <th>Opening Qty VM</th>
                          <th>Prev Qty C</th>
                          <th>PO Qty (sqm)</th>
                          <th>Avg Cost C</th>
                          <th>Last Cost C</th>
                          <th>Final Cost OFR</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {v.history.map((h, idx) =>
                        isVariantMode ? (
                          <tr key={idx}>
                            <td>{getRowDate(h)}</td>
                            {EVENT_COLUMNS.map((col) => (
                              <td key={col.key}>
                                {col.key === "transactionType"
                                  ? h[col.key] ?? ""
                                  : fmt2(h[col.key])}
                              </td>
                            ))}
                            {VARIANT_COLUMNS.map(
                              (col) =>
                                visibleVariantCols.includes(col.key) && (
                                  <td key={col.key}>{fmt2(h[col.key])}</td>
                                )
                            )}
                          </tr>
                        ) : (
                          <tr key={idx}>
                            <td>{getRowDate(h)}</td>
                            <td>{fmt2(h.openingQuantityC)}</td>
                            <td>{fmt2(h.openingQuantityVM)}</td>
                            <td>{fmt2(h.previousQuantityC)}</td>
                            <td>{fmt2(h.poQty)}</td>
                            <td>{fmt2(h.averageCostC)}</td>
                            <td>{fmt2(h.lastCostC)}</td>
                            <td>{fmt2(h.finalCostOFR)}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <iframe
        ref={printFrameRef}
        title="cost-analysis-print-frame"
        style={{ display: "none" }}
      />
    </div>
  );
}
