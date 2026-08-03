import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { axiosClient } from "../api/axiosClient";
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
        <div style={{ border: "2px solid #1d4ed8", borderRadius: 8, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <h3 style={{ margin: 0, color: "#1d4ed8", fontSize: 15 }}>
              All Customers — Net Position
              <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 10, color: "#6b7280" }}>
                {data.from} → {data.to}
              </span>
            </h3>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{data.customers.length} customers</span>
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
