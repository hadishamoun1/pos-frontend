import React, { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { axiosClient } from "../api/axiosClient";
import "./TopCustomersReport.css";

const fmt = (n) =>
  Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_LABELS = { BOTH: "S & RVR", S: "S only", RVR: "RVR only" };

export default function TopCustomersReport() {
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");
  const [topN, setTopN]           = useState("");
  const [invoiceType, setInvoiceType] = useState("BOTH");
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState("");
  const [fetched, setFetched]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const params = { invoiceType };
      if (from) params.from = from;
      if (to)   params.to   = to;
      if (topN && Number(topN) > 0) params.limit = topN;
      const { data } = await axiosClient.get("/reports/top-customers", { params });
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setTotal(list.reduce((s, r) => s + Number(r.grandTotal || 0), 0));
      setFetched(true);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [from, to, topN, invoiceType]);

  const today = new Date().toLocaleDateString("en-GB");
  const typeLabel = TYPE_LABELS[invoiceType] || invoiceType;

  const exportExcel = useCallback(() => {
    const sheetData = [
      ["#", "Customer Name", "Financial Account", "Grand Total"],
      ...rows.map((r, i) => [i + 1, r.customerName, r.financialNumber, Number(r.grandTotal)]),
      ["", "", "Total", Number(total)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    // Column widths
    ws["!cols"] = [{ wch: 5 }, { wch: 40 }, { wch: 22 }, { wch: 18 }];

    // Number format for Grand Total column (D) and Total row
    const numFmt = "#,##0.00";
    for (let i = 1; i < sheetData.length; i++) {
      const cell = ws[XLSX.utils.encode_cell({ r: i, c: 3 })];
      if (cell) { cell.t = "n"; cell.z = numFmt; }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Top Customers");

    const period = from || to ? `_${from || ""}__${to || ""}` : "";
    const filename = `top_customers${topN ? `_top${topN}` : ""}_${invoiceType}${period}.xlsx`;
    XLSX.writeFile(wb, filename);
  }, [rows, total, from, to, topN, invoiceType]);

  return (
    <div className="tcr-wrap">
      {/* ── Controls (hidden on print) ── */}
      <div className="tcr-controls no-print">
        <h2 className="tcr-title">Top Customers Report</h2>
        <p className="tcr-subtitle">Ranked by grand total — filter by invoice type and date range</p>

        <div className="tcr-filters">
          <label>
            Invoice Type
            <select value={invoiceType} onChange={(e) => setInvoiceType(e.target.value)}>
              <option value="BOTH">S &amp; RVR (both)</option>
              <option value="S">S only</option>
              <option value="RVR">RVR only</option>
            </select>
          </label>
          <label>
            Top N customers
            <input
              type="number"
              min="1"
              placeholder="All"
              value={topN}
              onChange={(e) => setTopN(e.target.value)}
              style={{ width: 90 }}
            />
          </label>
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="tcr-btn tcr-btn-load" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Load Report"}
          </button>
          {fetched && rows.length > 0 && (
            <>
              <button className="tcr-btn tcr-btn-print" onClick={() => window.print()}>
                Print
              </button>
              <button className="tcr-btn tcr-btn-excel" onClick={exportExcel}>
                Export to Excel
              </button>
            </>
          )}
        </div>

        {err && <div className="tcr-error">{err}</div>}
      </div>

      {/* ── Print header (visible only on print) ── */}
      <div className="tcr-print-header print-only">
        <div className="tcr-print-title">
          Top {topN ? topN : ""} Customers Report
        </div>
        <div className="tcr-print-meta">
          Invoice Types: {typeLabel}
          {from || to ? `   |   Period: ${from || "—"} → ${to || "—"}` : "   |   All dates"}
          {"   |   Generated: " + today}
        </div>
      </div>

      {/* ── Table ── */}
      {fetched && (
        <div className="tcr-table-wrap">
          {rows.length === 0 ? (
            <div className="tcr-empty no-print">No data found.</div>
          ) : (
            <table className="tcr-table">
              <thead>
                <tr>
                  <th className="tcr-col-num">#</th>
                  <th className="tcr-col-name">Customer Name</th>
                  <th className="tcr-col-fin">Financial Account</th>
                  <th className="tcr-col-total">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={i % 2 === 1 ? "tcr-row-alt" : ""}>
                    <td className="tcr-col-num">{i + 1}</td>
                    <td className="tcr-col-name">{r.customerName}</td>
                    <td className="tcr-col-fin">{r.financialNumber}</td>
                    <td className="tcr-col-total">{fmt(r.grandTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="tcr-totals-row">
                  <td colSpan={3} className="tcr-totals-label">Total</td>
                  <td className="tcr-col-total">{fmt(total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
