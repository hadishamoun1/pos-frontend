import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { axiosClient } from "../api/axiosClient";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { printHtml } from "./printHelper";
import "./Reports.css";

function sanitizeParams(p) {
  const out = {};
  Object.entries(p).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    if (typeof v === "string" && v.trim() === "") return;
    out[k] = v;
  });
  return out;
}

const fmt = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function AllNetPositions() {
  const navigate = useNavigate();

  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const today = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [from, setFrom] = useState(toYMD(monthAgo));
  const [to, setTo] = useState(toYMD(today));
  const [type, setType] = useState("ALL");

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    setErr("");
    setData(null);
    setDetail(null);
    try {
      const res = await axiosClient.get("/journal-vouchers/reports/net-positions", {
        params: sanitizeParams({ from, to, type }),
      });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (customerId) => {
    if (detail?.customerId === customerId) { setDetail(null); return; }
    setDetailLoading(true);
    try {
      const res = await axiosClient.get(`/journal-vouchers/statements/net/${customerId}`, {
        params: sanitizeParams({ from, to, type }),
      });
      const d = res.data || {};
      setDetail({
        customerId,
        customerName: d.customerName,
        supplierName: d.supplierName,
        openingBalance: Number(d.openingBalance || 0),
        closingBalance: Number(d.closingBalance || 0),
        totalDebit: Number(d?.totals?.totalDebit || 0),
        totalCredit: Number(d?.totals?.totalCredit || 0),
        items: (d.items || []).map((r) => ({
          date: r.date,
          jvNumber: r.jvNumber,
          journalVoucherId: r.journalVoucherId,
          description: r.description ?? "",
          side: r.side,
          debit: Number(r.debit || 0),
          credit: Number(r.credit || 0),
          balanceAfter: Number(r.balanceAfter || 0),
        })),
      });
    } catch (e) {
      setErr(e?.response?.data?.message || e.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const totalClosing = data?.customers?.reduce((s, c) => s + c.closingBalance, 0) ?? 0;
  const contentRef = useRef(null);

  const handlePrint = () => {
    if (!data) return;
    const customers = data.customers || [];
    const totalOpen  = customers.reduce((s, c) => s + c.openingBalance, 0);
    const totalDR    = customers.reduce((s, c) => s + c.totalDebit, 0);
    const totalCR    = customers.reduce((s, c) => s + c.totalCredit, 0);
    const totalClose = customers.reduce((s, c) => s + c.closingBalance, 0);

    const rows = customers.map((c) => `
      <tr>
        <td>${c.customerName}</td>
        <td style="color:#92400e">${c.supplierName ?? "—"}</td>
        <td style="text-align:right">${fmt(c.openingBalance)}</td>
        <td style="text-align:right">${fmt(c.totalDebit)}</td>
        <td style="text-align:right">${fmt(c.totalCredit)}</td>
        <td style="text-align:right;font-weight:700;color:${c.closingBalance > 0 ? "#15803d" : c.closingBalance < 0 ? "#dc2626" : "#000"}">${fmt(c.closingBalance)}</td>
      </tr>`).join("");

    printHtml(`
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body { font-family: Arial, sans-serif; font-size: 15px; color: #111; }
        h2 { font-size: 20px; margin: 0 0 6px; color: #1d4ed8; }
        .sub { font-size: 13px; color: #6b7280; margin: 0 0 14px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 7px 10px; font-size: 14px; }
        th { background: #f3f4f6; text-align: left; font-size: 14px; font-weight: 700; }
        tfoot tr { font-weight: 700; background: #f0f9ff; font-size: 15px; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      </style>
      <h2>All Customers — Net Position</h2>
      <p class="sub">${data.from} → ${data.to} &nbsp;|&nbsp; ${customers.length} customers</p>
      <table>
        <thead>
          <tr>
            <th>Customer</th><th>Linked Supplier</th>
            <th style="text-align:right">Opening Balance</th>
            <th style="text-align:right">Total DR</th>
            <th style="text-align:right">Total CR</th>
            <th style="text-align:right">Net Balance</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total</td>
            <td style="text-align:right">${fmt(totalOpen)}</td>
            <td style="text-align:right">${fmt(totalDR)}</td>
            <td style="text-align:right">${fmt(totalCR)}</td>
            <td style="text-align:right;color:${totalClose >= 0 ? "#15803d" : "#dc2626"}">${fmt(totalClose)}</td>
          </tr>
        </tfoot>
      </table>
    `);
  };

  const handlePDF = async () => {
    if (!contentRef.current) return;
    try {
      const canvas = await html2canvas(contentRef.current, { scale: 2, useCORS: true, backgroundColor: "#fff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgW = pdfW;
      const imgH = (canvas.height * imgW) / canvas.width;

      if (imgH <= pdfH) {
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, imgW, imgH);
      } else {
        const rowH = (pdfH / imgH) * canvas.height;
        let srcY = 0;
        while (srcY < canvas.height) {
          const sliceH = Math.min(rowH, canvas.height - srcY);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = sliceH;
          slice.getContext("2d").drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
          const sliceImgH = (sliceH * imgW) / canvas.width;
          pdf.addImage(slice.toDataURL("image/png"), "PNG", 0, 0, imgW, sliceImgH);
          srcY += sliceH;
          if (srcY < canvas.height) pdf.addPage();
        }
      }
      pdf.save(`net-positions-${data.from}-${data.to}.pdf`);
    } catch (e) {
      console.error("PDF generation failed", e);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      {/* Filters */}
      <div className="tb-filters" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
        <label className="tb-field">
          From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="tb-field">
          To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="tb-field">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {["ALL", "S", "G"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <button className="tb-btn tb-btn-primary" onClick={fetchAll} disabled={loading}>
          {loading ? "Loading…" : "Generate"}
        </button>
      </div>

      {err && <div className="tb-error" style={{ marginBottom: 12 }}>{err}</div>}

      {/* Summary table */}
      {data && (
        <div ref={contentRef} style={{ border: "2px solid #1d4ed8", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: "#1d4ed8", fontSize: 15 }}>
              All Customers — Net Position
              <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 10, color: "#6b7280" }}>
                {data.from} → {data.to}
              </span>
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>{data.customers.length} customers</span>
              <button
                onClick={handlePrint}
                style={{ padding: "7px 18px", fontSize: 14, fontWeight: 600, border: "1px solid #6b7280", borderRadius: 6, background: "#f9fafb", cursor: "pointer", lineHeight: 1 }}
              >
                🖨 Print
              </button>
              <button
                onClick={handlePDF}
                style={{ padding: "7px 18px", fontSize: 14, fontWeight: 600, border: "1px solid #1d4ed8", borderRadius: 6, background: "#1d4ed8", color: "#fff", cursor: "pointer", lineHeight: 1 }}
              >
                ⬇ PDF
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="tb-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Linked Supplier</th>
                  <th style={{ textAlign: "right" }}>Opening Balance</th>
                  <th style={{ textAlign: "right" }}>Total DR</th>
                  <th style={{ textAlign: "right" }}>Total CR</th>
                  <th style={{ textAlign: "right" }}>Net Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.customers.map((c) => {
                  const isSelected = detail?.customerId === c.customerId;
                  return (
                    <tr
                      key={c.customerId}
                      onClick={() => fetchDetail(c.customerId)}
                      style={{
                        background: isSelected ? "#dbeafe" : c.linkedSupplierId ? "#fef9c3" : undefined,
                        cursor: "pointer",
                      }}
                      title="Click to view transactions"
                    >
                      <td style={{ color: "#1d4ed8", textDecoration: "underline" }}>{c.customerName}</td>
                      <td style={{ color: "#92400e", fontSize: 12 }}>{c.supplierName ?? "—"}</td>
                      <td className="num">{fmt(c.openingBalance)}</td>
                      <td className="num">{fmt(c.totalDebit)}</td>
                      <td className="num">{fmt(c.totalCredit)}</td>
                      <td className="num" style={{ fontWeight: 700, color: c.closingBalance > 0 ? "#15803d" : c.closingBalance < 0 ? "#dc2626" : undefined }}>
                        {fmt(c.closingBalance)}
                      </td>
                    </tr>
                  );
                })}
                {!data.customers.length && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "#9ca3af" }}>No data for the selected range</td></tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ fontWeight: 700, background: "#f0f9ff" }}>
                  <td colSpan={2}>Total</td>
                  <td className="num">{fmt(data.customers.reduce((s, c) => s + c.openingBalance, 0))}</td>
                  <td className="num">{fmt(data.customers.reduce((s, c) => s + c.totalDebit, 0))}</td>
                  <td className="num">{fmt(data.customers.reduce((s, c) => s + c.totalCredit, 0))}</td>
                  <td className="num" style={{ fontWeight: 700, color: totalClosing >= 0 ? "#15803d" : "#dc2626" }}>
                    {fmt(totalClosing)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Customer detail */}
          {detailLoading && (
            <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>Loading detail…</div>
          )}
          {detail && !detailLoading && (
            <div style={{ marginTop: 14, borderTop: "2px solid #93c5fd", paddingTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h4 style={{ margin: 0, color: "#1d4ed8", fontSize: 14 }}>
                  {detail.customerName}
                  {detail.supplierName && (
                    <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8, color: "#92400e" }}>
                      (linked: {detail.supplierName})
                    </span>
                  )}
                </h4>
                <button
                  onClick={() => setDetail(null)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#6b7280", fontSize: 18, lineHeight: 1 }}
                >×</button>
              </div>
              <div style={{ display: "flex", gap: 24, fontSize: 13, marginBottom: 10 }}>
                <span><strong>Opening:</strong> {fmt(detail.openingBalance)}</span>
                <span><strong>Total DR:</strong> {fmt(detail.totalDebit)}</span>
                <span><strong>Total CR:</strong> {fmt(detail.totalCredit)}</span>
                <span>
                  <strong>Net Balance:</strong>{" "}
                  <span style={{ fontWeight: 700, color: detail.closingBalance >= 0 ? "#15803d" : "#dc2626" }}>
                    {fmt(detail.closingBalance)}
                  </span>
                </span>
              </div>
              <table className="tb-table">
                <thead>
                  <tr>
                    <th>Date</th><th>JV Number</th><th>Side</th><th>Description</th>
                    <th>DR USD</th><th>CR USD</th><th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((r, i) => (
                    <tr key={i} style={{ background: r.side === "supplier" ? "#fef9c3" : undefined }}>
                      <td>{r.date ?? ""}</td>
                      <td>
                        {r.journalVoucherId ? (
                          <span
                            style={{ color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                            onClick={(e) => { e.stopPropagation(); navigate(`/journal-voucher/${r.journalVoucherId}`); }}
                          >
                            {r.jvNumber ?? ""}
                          </span>
                        ) : (r.jvNumber ?? "")}
                      </td>
                      <td style={{ fontSize: 11, color: r.side === "supplier" ? "#92400e" : "#1e40af" }}>
                        {r.side === "supplier" ? "Supplier" : "Customer"}
                      </td>
                      <td>{r.description}</td>
                      <td className="num">{fmt(r.debit)}</td>
                      <td className="num">{fmt(r.credit)}</td>
                      <td className="num">{fmt(r.balanceAfter)}</td>
                    </tr>
                  ))}
                  {!detail.items.length && (
                    <tr><td colSpan={7} style={{ textAlign: "center", color: "#9ca3af" }}>No transactions in this range</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
