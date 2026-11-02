import React, { useCallback, useEffect, useMemo, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./InvoiceTypeConverter.css";
import "./ReceivableDuplicateAudit.css";

const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) => (d ? String(d).slice(0, 10) : "—");

const fmtStamp = (d) =>
  d ? new Date(d).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";

// Keep the scan when the user leaves the page to fix a receipt and comes back.
const SESSION_KEY = "receivableDuplicateAudit_state";
const saved = (() => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
})();

const startOfYear = () => `${new Date().getFullYear()}-01-01`;
const PAGE_SIZE = 25;

const hasCash = (r) => Array.isArray(r.cashCollections) && r.cashCollections.length > 0;

const matchesSearch = (q, ...values) =>
  !q || values.some((v) => String(v ?? "").toLowerCase().includes(q));

const receiptSearchValues = (r) => [r.jvNumber, r.invoiceNumber, r.comments, fmt(r.usdAmount)];

const amountLabel = (g) =>
  g.minAmountUsd === g.maxAmountUsd ? fmt(g.minAmountUsd) : `${fmt(g.minAmountUsd)} – ${fmt(g.maxAmountUsd)}`;

const dateSpan = (receipts) => {
  const dates = receipts.map((r) => fmtDate(r.date)).sort();
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`;
};

// Receipts of one group/invoice. Receipts without a cash collection are the
// suspects and get the strong red treatment; backed ones are muted.
const ReceiptTable = ({ receipts }) => (
  <div className="rda-table-wrap">
    <table className="rda-table">
      <thead>
        <tr>
          <th></th>
          <th>Receipt #</th>
          <th>Date</th>
          <th>Entered At</th>
          <th>Type / Payment</th>
          <th className="num">Amount</th>
          <th className="num">USD</th>
          <th>Invoice</th>
          <th>Cash Collection</th>
          <th>Comments</th>
        </tr>
      </thead>
      <tbody>
        {receipts.map((r) => {
          const scanned = r.cashCollections !== undefined;
          const backed = hasCash(r);
          const suspect = scanned && !backed;
          return (
            <tr key={r.id} className={suspect ? "rda-row-suspect" : "rda-row-ok"}>
              <td>
                {suspect ? (
                  <span className="rda-tag rda-tag-bad">Suspect</span>
                ) : scanned ? (
                  <span className="rda-tag rda-tag-ok">OK</span>
                ) : null}
              </td>
              <td className="rda-strong">{r.jvNumber || `#${r.id}`}</td>
              <td>{fmtDate(r.date)}</td>
              <td className="rda-dim">{fmtStamp(r.createdAt)}</td>
              <td>
                {r.type} · {r.pmtType || "—"}
              </td>
              <td className="num">
                {fmt(r.cashNumber)} {r.currency}
              </td>
              <td className="num rda-strong">{fmt(r.usdAmount)}</td>
              <td>{r.invoiceNumber || "—"}</td>
              <td>
                {!scanned ? (
                  <span className="rda-dim">outside range</span>
                ) : backed ? (
                  r.cashCollections.map((c) => (
                    <div key={c.id} className="rda-cash">
                      ✓ {fmt(c.amount)} {c.currency} · {c.method}
                      {c.employeeName ? ` · ${c.employeeName}` : ""}
                      {c.driverName ? ` · ${c.driverName}` : ""}
                      {c.how === "link" ? " · linked" : ""}
                    </div>
                  ))
                ) : (
                  <span className="rda-missing">✕ No cash collection</span>
                )}
              </td>
              <td className="rda-dim rda-comments" title={r.comments || ""}>
                {r.comments || ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const StatCard = ({ label, value, sub, tone, active, onClick }) => (
  <button type="button" className={`rda-stat rda-stat-${tone} ${active ? "active" : ""}`} onClick={onClick}>
    <span className="rda-stat-label">{label}</span>
    <span className="rda-stat-value">{value}</span>
    {sub && <span className="rda-stat-sub">{sub}</span>}
  </button>
);

export default function ReceivableDuplicateAudit() {
  const [from, setFrom] = useState(saved?.from ?? startOfYear());
  const [to, setTo] = useState(saved?.to ?? "");
  const [windowDays, setWindowDays] = useState(saved?.windowDays ?? "7");
  const [tolerance, setTolerance] = useState(saved?.tolerance ?? "1");
  const [data, setData] = useState(saved?.data ?? null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // View controls
  const [tab, setTab] = useState(saved?.tab ?? "duplicates"); // duplicates | overpaid
  const [show, setShow] = useState(saved?.show ?? "suspect"); // suspect | sameInvoice | all
  const [sortBy, setSortBy] = useState(saved?.sortBy ?? "missing"); // missing | amount | newest | customer
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ from, to, windowDays, tolerance, data, tab, show, sortBy })
      );
    } catch {}
  }, [from, to, windowDays, tolerance, data, tab, show, sortBy]);

  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [tab, show, sortBy, search, data]);

  const handleScan = useCallback(async () => {
    setErr("");
    setData(null);
    setExpanded(new Set());
    setLoading(true);
    try {
      const params = { windowDays, tolerance };
      if (from) params.from = from;
      if (to) params.to = to;
      const res = await axiosClient.get("/recievables/duplicate-audit", { params });
      setData(res.data);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to scan.");
    } finally {
      setLoading(false);
    }
  }, [from, to, windowDays, tolerance]);

  const allGroups = useMemo(
    () =>
      (data?.duplicates ?? []).map((g) => ({
        ...g,
        key: `d-${g.receipts.map((r) => r.id).join("-")}`,
        suspectUsd: g.receipts.filter((r) => !hasCash(r)).reduce((s, r) => s + r.usdAmount, 0),
        lastDate: g.receipts.reduce((m, r) => (fmtDate(r.date) > m ? fmtDate(r.date) : m), ""),
      })),
    [data]
  );
  const suspectGroups = useMemo(() => allGroups.filter((g) => g.withoutCashCount > 0), [allGroups]);
  const overpaidAll = useMemo(
    () => (data?.overpaid ?? []).map((inv) => ({ ...inv, key: `o-${inv.invoiceId}` })),
    [data]
  );

  const q = search.trim().toLowerCase();

  const groups = useMemo(() => {
    let list =
      show === "all" ? allGroups : show === "sameInvoice" ? allGroups.filter((g) => g.sameInvoice) : suspectGroups;
    list = list.filter(
      (g) =>
        matchesSearch(q, g.customerName) || g.receipts.some((r) => matchesSearch(q, ...receiptSearchValues(r)))
    );
    const sorters = {
      missing: (a, b) => b.withoutCashCount - a.withoutCashCount || b.suspectUsd - a.suspectUsd,
      amount: (a, b) => b.maxAmountUsd - a.maxAmountUsd,
      newest: (a, b) => b.lastDate.localeCompare(a.lastDate),
      customer: (a, b) => String(a.customerName || "").localeCompare(String(b.customerName || "")),
    };
    return list.slice().sort(sorters[sortBy] || sorters.missing);
  }, [allGroups, suspectGroups, show, q, sortBy]);

  const overpaid = useMemo(
    () =>
      overpaidAll.filter(
        (inv) =>
          matchesSearch(q, inv.customerName, inv.invoiceNumber) ||
          inv.receipts.some((r) => matchesSearch(q, ...receiptSearchValues(r)))
      ),
    [overpaidAll, q]
  );

  const visible = tab === "duplicates" ? groups : overpaid;
  const shown = visible.slice(0, limit);

  const suspectReceipts = suspectGroups.reduce((n, g) => n + g.withoutCashCount, 0);
  const suspectUsd = suspectGroups.reduce((s, g) => s + g.suspectUsd, 0);

  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const expandAll = () => setExpanded(new Set(shown.map((x) => x.key)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="itc-page rda-page">
      <div className="itc-header">
        <h1 className="itc-title">Receivable Duplicate Audit</h1>
        <p className="itc-subtitle">
          Finds receipts entered twice. Each receipt is checked against the Cash Collection page (same customer,
          date and amount) — a receipt with no cash collection behind it is the likely duplicate.
        </p>
      </div>

      <section className="itc-section">
        <div className="rda-scan">
          <label>
            From
            <input type="date" className="itc-input" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" className="itc-input" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label>
            Within (days)
            <input
              type="number"
              min="0"
              className="itc-input rda-small"
              value={windowDays}
              onChange={(e) => setWindowDays(e.target.value)}
            />
          </label>
          <label>
            Tolerance ($)
            <input
              type="number"
              min="0"
              step="0.5"
              className="itc-input rda-small"
              value={tolerance}
              onChange={(e) => setTolerance(e.target.value)}
            />
          </label>
          <button type="button" className="itc-btn itc-btn-primary" onClick={handleScan} disabled={loading}>
            {loading ? "Scanning…" : "Scan"}
          </button>
        </div>
        {err && <div className="itc-error">{err}</div>}
        {data && (
          <div className="rda-scanned">
            Scanned {data.scannedReceipts} receipts and {data.scannedCollections} cash collections.
          </div>
        )}
      </section>

      {data && (
        <>
          <div className="rda-stats">
            <StatCard
              label="Suspect receipts"
              value={suspectReceipts}
              sub={`${fmt(suspectUsd)} USD with no cash collection`}
              tone={suspectReceipts ? "bad" : "ok"}
              active={tab === "duplicates" && show === "suspect"}
              onClick={() => {
                setTab("duplicates");
                setShow("suspect");
              }}
            />
            <StatCard
              label="Groups to review"
              value={suspectGroups.length}
              sub={`${allGroups.length - suspectGroups.length} more fully backed`}
              tone={suspectGroups.length ? "warn" : "ok"}
              active={tab === "duplicates" && show === "all"}
              onClick={() => {
                setTab("duplicates");
                setShow("all");
              }}
            />
            <StatCard
              label="Same invoice twice"
              value={allGroups.filter((g) => g.sameInvoice).length}
              sub="groups on one invoice"
              tone={allGroups.some((g) => g.sameInvoice) ? "warn" : "ok"}
              active={tab === "duplicates" && show === "sameInvoice"}
              onClick={() => {
                setTab("duplicates");
                setShow("sameInvoice");
              }}
            />
            <StatCard
              label="Overpaid invoices"
              value={overpaidAll.length}
              sub="received more than total"
              tone={overpaidAll.length ? "warn" : "ok"}
              active={tab === "overpaid"}
              onClick={() => setTab("overpaid")}
            />
          </div>

          <div className="rda-toolbar">
            <div className="rda-tabs">
              <button
                type="button"
                className={tab === "duplicates" ? "active" : ""}
                onClick={() => setTab("duplicates")}
              >
                Possible duplicates <span className="rda-count">{groups.length}</span>
              </button>
              <button type="button" className={tab === "overpaid" ? "active" : ""} onClick={() => setTab("overpaid")}>
                Overpaid invoices <span className="rda-count">{overpaid.length}</span>
              </button>
            </div>

            <input
              type="search"
              className="itc-input rda-search"
              placeholder="Search customer, receipt #, invoice, amount…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {tab === "duplicates" && (
              <>
                <select className="itc-input" value={show} onChange={(e) => setShow(e.target.value)}>
                  <option value="suspect">Missing a cash collection</option>
                  <option value="sameInvoice">Same invoice</option>
                  <option value="all">All groups</option>
                </select>
                <select className="itc-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="missing">Most suspect first</option>
                  <option value="amount">Largest amount</option>
                  <option value="newest">Newest first</option>
                  <option value="customer">Customer A–Z</option>
                </select>
              </>
            )}

            <div className="rda-expand">
              <button type="button" onClick={expandAll}>
                Expand all
              </button>
              <button type="button" onClick={collapseAll}>
                Collapse all
              </button>
            </div>
          </div>

          <div className="rda-list">
            {visible.length === 0 && (
              <div className="rda-empty">
                {q ? "Nothing matches your search." : "Nothing to review here."}
              </div>
            )}

            {tab === "duplicates" &&
              shown.map((g) => {
                const open = expanded.has(g.key);
                return (
                  <div key={g.key} className={`rda-item ${g.withoutCashCount ? "rda-item-bad" : "rda-item-ok"}`}>
                    <button type="button" className="rda-item-head" onClick={() => toggle(g.key)}>
                      <span className="rda-chevron">{open ? "▾" : "▸"}</span>
                      <span className="rda-customer">{g.customerName || "—"}</span>
                      <span className="rda-amount">{amountLabel(g)} USD</span>
                      <span className="rda-meta">
                        {g.receipts.length} receipts · {dateSpan(g.receipts)}
                      </span>
                      <span className="rda-badges">
                        {g.sameInvoice && <span className="rda-tag rda-tag-warn">Same invoice</span>}
                        {g.withoutCashCount ? (
                          <span className="rda-tag rda-tag-bad">
                            {g.withoutCashCount} without cash · {fmt(g.suspectUsd)} USD
                          </span>
                        ) : (
                          <span className="rda-tag rda-tag-ok">All backed</span>
                        )}
                      </span>
                    </button>
                    {open && <ReceiptTable receipts={g.receipts} />}
                  </div>
                );
              })}

            {tab === "overpaid" &&
              shown.map((inv) => {
                const open = expanded.has(inv.key);
                return (
                  <div key={inv.key} className="rda-item rda-item-bad">
                    <button type="button" className="rda-item-head" onClick={() => toggle(inv.key)}>
                      <span className="rda-chevron">{open ? "▾" : "▸"}</span>
                      <span className="rda-customer">
                        {inv.invoiceNumber} · {inv.customerName || "—"}
                      </span>
                      <span className="rda-amount">
                        {fmt(inv.receivedUsd)} / {fmt(inv.invoiceTotalUsd)}
                      </span>
                      <span className="rda-meta">
                        {inv.invoiceType} · {fmtDate(inv.invoiceDate)} · {inv.receipts.length} receipts
                      </span>
                      <span className="rda-badges">
                        <span className="rda-tag rda-tag-bad">Over by {fmt(inv.overByUsd)}</span>
                      </span>
                    </button>
                    {open && <ReceiptTable receipts={inv.receipts} />}
                  </div>
                );
              })}
          </div>

          {visible.length > shown.length && (
            <div className="rda-more">
              <button type="button" className="itc-btn" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Show more ({visible.length - shown.length} left)
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
