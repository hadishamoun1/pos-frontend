// src/pages/Reports/CostAnalysis.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./Reports.css";
import "./CostAnalysis.css";

const rawBase = process.env.REACT_APP_API_BASE_URL || "";
const baseUrl = rawBase.replace(/\/+$/, "");

// small number formatter
const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

export default function CostAnalysis() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [thicknessFilter, setThicknessFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${baseUrl}/purchase-invoices/cost-analysis/history`
        );
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
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
  }, []);

  // unique options for filters
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

  // apply search + filters
  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (thicknessFilter && Number(r.thickness) !== Number(thicknessFilter)) {
        return false;
      }
      if (originFilter && String(r.origin) !== originFilter) {
        return false;
      }
      if (!s) return true;

      const haystack = [
        r.itemName,
        r.thickness != null ? `${r.thickness} ملم` : "",
        r.length,
        r.width,
        r.origin,
        r.categoryName,
        r.subCategory,
        r.colorName,
        r.designName,
        r.itemNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(s);
    });
  }, [rows, search, thicknessFilter, originFilter]);

  // group by variant (each item variant alone)
  const groupedVariants = useMemo(() => {
    const map = new Map();
    for (const r of filteredRows) {
      const key = r.variantId;
      if (!map.has(key)) {
        map.set(key, {
          variantId: r.variantId,
          itemName: r.itemName,
          thickness: r.thickness,
          length: r.length,
          width: r.width,
          origin: r.origin,
          realDescriptionId: r.realDescriptionId,
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
    }

    const arr = Array.from(map.values());

    // sort variants by sortIndex, then thickness, length, width
    arr.sort((a, b) => {
      const siA = a.sortIndex ?? 999999;
      const siB = b.sortIndex ?? 999999;
      if (siA !== siB) return siA - siB;

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
    });

    // sort each history by date ASC (older first)
    arr.forEach((v) => {
      v.history.sort((ra, rb) =>
        String(ra.invoiceDate).localeCompare(String(rb.invoiceDate))
      );
    });

    return arr;
  }, [filteredRows]);

  const totalHistoryRows = filteredRows.length;

  return (
    <div className="cost-analysis-container">
      <div className="cost-analysis-header">
        <div>
          <h2>Cost Analysis / تحليل الكلفة</h2>
          <p className="cost-analysis-subtitle">
            Track the evolution of average cost for each item variant over time
            (C / VM / C-VM) based on your purchase invoices.
          </p>
        </div>
      </div>

      <div className="cost-analysis-toolbar">
        <div className="cost-analysis-search-group">
          <label className="cost-analysis-label" htmlFor="cost-search">
            Search / بحث
          </label>
          <input
            id="cost-search"
            type="text"
            className="cost-analysis-input"
            placeholder="Type item, thickness, origin, or item number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

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
      </div>

      <div className="cost-analysis-summary">
        {loading && <span>Loading cost data… / جاري تحميل البيانات…</span>}
        {!loading && error && (
          <span className="cost-analysis-error">{error}</span>
        )}
        {!loading && !error && (
          <>
            <span>
              Variants shown: <strong>{groupedVariants.length}</strong>
            </span>
            <span>
              History rows: <strong>{totalHistoryRows}</strong>
            </span>
          </>
        )}
      </div>

      {!loading && !error && groupedVariants.length === 0 && (
        <div className="cost-analysis-empty">
          <p>No matching data. Try changing filters or search text.</p>
        </div>
      )}

      {!loading && !error && groupedVariants.length > 0 && (
        <div className="cost-analysis-variants-list">
          {groupedVariants.map((v) => {
            const dims =
              v.length && v.width
                ? `${Math.floor(Number(v.length))} × ${Math.floor(
                    Number(v.width)
                  )}`
                : "-";

            // Header: ONLY item name + thickness
            const titleParts = [];
            if (v.itemName) titleParts.push(v.itemName);
            if (v.thickness != null) titleParts.push(`${v.thickness} ملم`);
            const title = titleParts.join(" ");

            return (
              <div key={v.variantId} className="cost-analysis-card">
                <div className="cost-analysis-card-header">
                  <div className="cost-analysis-card-main">
                    <div className="cost-analysis-title-line">
                      <span className="cost-analysis-title">
                        {title || "Unnamed variant"}
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
                      {v.origin && (
                        <span className="cost-analysis-pill">
                          Origin: {v.origin}
                        </span>
                      )}
                      {dims !== "-" && (
                        <span className="cost-analysis-pill">
                          Size: {dims}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="cost-analysis-table-wrapper">
                  <table className="cost-analysis-table">
                    <thead>
                      <tr>
                        <th>Date / التاريخ</th>
                        <th>Prev Qty</th>
                        <th>Prev Qty C</th>
                        <th>Prev Qty VM</th>
                        <th>Prev Qty CVM</th>
                        <th>Final Cost</th>
                        <th>Final Cost OFR</th>
                        <th>Avg Cost</th>
                        <th>Avg Cost VM</th>
                        <th>Avg Cost C</th>
                        <th>Avg Cost CVM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {v.history.map((h, idx) => (
                        <tr key={idx}>
                          <td>{h.invoiceDate}</td>
                          <td>{fmt2(h.previousQuantity)}</td>
                          <td>{fmt2(h.previousQuantityC)}</td>
                          <td>{fmt2(h.previousQuantityVM)}</td>
                          <td>{fmt2(h.previousQuantityCVM)}</td>
                          <td>{fmt2(h.finalCost)}</td>
                          <td>{fmt2(h.finalOFR)}</td>
                          <td>{fmt2(h.averageCost)}</td>
                          <td>{fmt2(h.averageCostVM)}</td>
                          <td>{fmt2(h.averageCostC)}</td>
                          <td>{fmt2(h.averageCostCVM)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
