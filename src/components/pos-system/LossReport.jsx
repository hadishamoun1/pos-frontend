// Loss Report — SQM trash (SQM page), cuts loss, breakage and defects,
// valued at OFR cost on the day it happened (see backend reports/loss-report.ts).
import React, { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import { axiosClient } from "../api/axiosClient";
import "./TopCustomersReport.css";

const fmt = (n, d = 2) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

const CATEGORIES = [
  { value: "all", label: "All losses" },
  { value: "sqmTrash", label: "SQM trash" },
  { value: "cutsLoss", label: "Cuts loss" },
  { value: "breakage", label: "Breakage" },
  { value: "defects", label: "Defects" },
];

const itemLabel = (it) => {
  if (!it) return "—";
  const type = String(it.type || "").toLowerCase();
  const thk = type !== "unit" && it.thickness ? `${Number(it.thickness)}ملم ` : "";
  const dims =
    type === "box"
      ? ` ${it.length}×${it.width}-${String(it.sheetsPerBox || 0).padStart(3, "0")}`
      : type !== "unit" && type !== "sqm" && it.length && it.width
      ? ` ${it.length}×${it.width}`
      : "";
  return `${thk}${it.itemName || ""}${dims} (${it.type || "?"})`;
};

const typeLabel = (r) =>
  r.isRestore
    ? "SQM trash restored"
    : r.category === "breakage"
    ? r.fromInventoryCheck
      ? "Breakage (inventory check)"
      : "Breakage (transfer)"
    : r.categoryLabel;

const yearStart = () => `${new Date().getFullYear()}-01-01`;
const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function LossReport() {
  const [from, setFrom] = useState(yearStart);
  const [to, setTo] = useState(todayYmd);
  const [category, setCategory] = useState("all");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const { data } = await axiosClient.get("/reports/loss", { params: { from, to, category } });
      setData(data);
    } catch (e) {
      setErr(e?.response?.data?.message || e?.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [from, to, category]);

  const rows = data?.rows || [];

  const exportExcel = useCallback(() => {
    const sheet = [
      ["Date", "Type", "Item", "Came from", "Transfer #", "Qty", "Unit", "Cost / unit (OFR)", "Total", "Notes"],
      ...rows.map((r) => [
        r.date,
        typeLabel(r),
        itemLabel(r.item),
        r.source ? itemLabel(r.source) : "",
        r.source?.transferNumber || r.transferNumber || "",
        r.amount,
        r.unit,
        r.costPerUnit,
        r.total,
        [
          r.sourceEstimated ? "source estimated" : "",
          r.valuedAsBox ? "valued at box cost" : "",
          r.costBasis === "stored" ? "no purchase/count before date — stored cost" : "",
        ].filter(Boolean).join("; "),
      ]),
      [],
      ...(data?.totals || []).map((t) => ["", t.label, "", "", "", t.sqm || t.pcs, t.pcs && !t.sqm ? "pcs" : "sqm", "", t.total, ""]),
      ["", "Grand total", "", "", "", "", "", "", data?.grandTotal || 0, ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheet);
    ws["!cols"] = [{ wch: 12 }, { wch: 26 }, { wch: 34 }, { wch: 34 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 16 }, { wch: 14 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Loss Report");
    XLSX.writeFile(wb, `loss_report_${category}_${from}__${to}.xlsx`);
  }, [rows, data, category, from, to]);

  return (
    <div className="tcr-wrap">
      <div className="tcr-controls no-print">
        <h2 className="tcr-title">Loss Report / تقرير الهالك</h2>
        <p className="tcr-subtitle">
          SQM trash, cuts loss, breakage and defects — valued at the OFR cost of the last purchase or count on or
          before each date. SQM trash is valued at the box/sheet it was cut from; sheets at their box's cost.
        </p>

        <div className="tcr-filters">
          <label>
            Type
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="tcr-btn tcr-btn-load" onClick={load} disabled={loading || !from || !to}>
            {loading ? "Loading…" : "Load Report"}
          </button>
          {rows.length > 0 && (
            <>
              <button className="tcr-btn tcr-btn-print" onClick={() => window.print()}>Print</button>
              <button className="tcr-btn tcr-btn-excel" onClick={exportExcel}>Export to Excel</button>
            </>
          )}
        </div>

        {err && <div className="tcr-error">{err}</div>}
      </div>

      <div className="tcr-print-header print-only">
        <div className="tcr-print-title">Loss Report — {CATEGORIES.find((c) => c.value === category)?.label}</div>
        <div className="tcr-print-meta">
          Period: {from} → {to}   |   Generated: {new Date().toLocaleDateString("en-GB")}
        </div>
      </div>

      {data && (
        <div className="tcr-table-wrap">
          {rows.length === 0 ? (
            <div className="tcr-empty no-print">No losses found in this period.</div>
          ) : (
            <table className="tcr-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Came from</th>
                  <th className="tcr-col-total">Qty</th>
                  <th className="tcr-col-total">Cost / unit</th>
                  <th className="tcr-col-total">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.txId} className={i % 2 === 1 ? "tcr-row-alt" : ""}>
                    <td style={{ whiteSpace: "nowrap" }}>{r.date}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {typeLabel(r)}
                      {r.transferNumber && !r.source ? (
                        <div style={{ color: "#64748b", fontSize: 12 }}>{r.transferNumber}</div>
                      ) : null}
                    </td>
                    <td>{itemLabel(r.item)}</td>
                    <td>
                      {r.source ? (
                        <>
                          {itemLabel(r.source)}
                          <div style={{ color: "#64748b", fontSize: 12 }}>
                            {r.source.transferNumber || ""}
                            {r.sourceEstimated && (
                              <span
                                style={{ marginLeft: 6, color: "#b45309", fontWeight: 600 }}
                                title="This SQM pile was fed by several transfers; the most likely source is shown"
                              >
                                · estimated
                              </span>
                            )}
                          </div>
                        </>
                      ) : r.category === "sqmTrash" ? (
                        <span style={{ color: "#b91c1c" }}>source unknown</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="tcr-col-total" style={{ color: r.amount < 0 ? "#15803d" : undefined }}>
                      {fmt(r.amount)} {r.unit}
                    </td>
                    <td
                      className="tcr-col-total"
                      title={
                        r.costBasis === "stored"
                          ? "No purchase or count before this date — the item's stored average was used"
                          : r.valuedAsBox
                          ? "Valued at the box's cost"
                          : "Last purchase or count on or before this date"
                      }
                    >
                      {fmt(r.costPerUnit)}
                      {r.costBasis === "stored" && <span style={{ color: "#b45309" }}> *</span>}
                    </td>
                    <td className="tcr-col-total">{fmt(r.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {(data.totals || []).map((t) => (
                  <tr key={t.category}>
                    <td colSpan={4} className="tcr-totals-label">
                      {t.label} ({t.count})
                    </td>
                    <td className="tcr-col-total">
                      {t.sqm ? `${fmt(t.sqm)} sqm` : ""}
                      {t.sqm && t.pcs ? " · " : ""}
                      {t.pcs ? `${fmt(t.pcs)} pcs` : ""}
                    </td>
                    <td />
                    <td className="tcr-col-total">{fmt(t.total)}</td>
                  </tr>
                ))}
                <tr className="tcr-totals-row">
                  <td colSpan={6} className="tcr-totals-label">Grand total</td>
                  <td className="tcr-col-total">{fmt(data.grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
          {rows.some((r) => r.costBasis === "stored") && (
            <div className="no-print" style={{ marginTop: 8, fontSize: 12, color: "#b45309" }}>
              * No purchase or count before that date — the item's stored average cost was used.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
