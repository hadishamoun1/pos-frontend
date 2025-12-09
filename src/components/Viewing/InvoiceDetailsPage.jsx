import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useSearchParams } from "react-router-dom";
import "./InvoiceDetailsPage.css";

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDate(value) {
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    if (!d || isNaN(new Date(d).getTime())) return "-";
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(d));
  } catch {
    return "-";
  }
}

function fmtMoney(value, currencyCode) {
  const n = safeNum(value, 0);
  try {
    if (currencyCode) {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(n);
    }
  } catch {}
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtNum(value, digits = 2) {
  const n = safeNum(value, 0);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

function typeLabel(t) {
  if (t === "S") return "Sales";
  if (t === "G") return "Glass";
  if (t === "RVR") return "Re-Variance";
  if (t === "RTN") return "Return";
  return t || "-";
}

function typeClass(t) {
  if (t === "S") return "badge badge--blue";
  if (t === "G") return "badge badge--gray";
  if (t === "RTN") return "badge badge--red";
  return "badge badge--outline";
}

function isHtmlResponse(res) {
  const ct = String(res?.headers?.["content-type"] || "");
  return ct.includes("text/html");
}

function SkeletonRow() {
  return (
    <div className="listRow skRow">
      <div className="sk sk--h14" style={{ width: 90 }} />
      <div className="sk sk--h14" style={{ width: 120 }} />
      <div className="sk sk--h14" style={{ width: 160 }} />
      <div className="sk sk--h14" style={{ width: 90 }} />
    </div>
  );
}

function ItemsSkeletonRow({ showCosts }) {
  return (
    <tr className="row">
      <td className="cell">
        <div className="sk sk--h14" style={{ width: 220 }} />
        <div className="sk sk--h12 mt8" style={{ width: 110 }} />
      </td>
      <td className="cell">
        <div className="sk sk--h14" style={{ width: 180 }} />
        <div className="sk sk--h12 mt8" style={{ width: 200 }} />
      </td>
      <td className="cell cell--right">
        <div className="sk sk--h14" style={{ width: 50, marginLeft: "auto" }} />
      </td>
      <td className="cell cell--right">
        <div className="sk sk--h14" style={{ width: 70, marginLeft: "auto" }} />
      </td>
      <td className="cell cell--right">
        <div className="sk sk--h14" style={{ width: 90, marginLeft: "auto" }} />
      </td>
      <td className="cell cell--right">
        <div className="sk sk--h14" style={{ width: 110, marginLeft: "auto" }} />
      </td>
      {showCosts && (
        <>
          <td className="cell cell--right">
            <div className="sk sk--h14" style={{ width: 90, marginLeft: "auto" }} />
          </td>
          <td className="cell cell--right">
            <div className="sk sk--h14" style={{ width: 90, marginLeft: "auto" }} />
          </td>
          <td className="cell cell--right">
            <div className="sk sk--h14" style={{ width: 90, marginLeft: "auto" }} />
          </td>
          <td className="cell cell--right">
            <div className="sk sk--h14" style={{ width: 90, marginLeft: "auto" }} />
          </td>
        </>
      )}
    </tr>
  );
}

export default function InvoiceDetailsPage() {
  const [sp, setSp] = useSearchParams();
  const selectedIdFromUrl = Number(sp.get("id") || 0);

  // ✅ FIX: if REACT_APP_API_BASE_URL is empty, default to backend 3001
  const apiBase = useMemo(() => {
    const raw = (process.env.REACT_APP_API_BASE_URL || "").trim();
    const normalized = raw.replace(/\/+$/, "");
    return normalized || "http://localhost:3001";
  }, []);

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  // list controls
  const [qInv, setQInv] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // detail controls
  const [itemQ, setItemQ] = useState("");
  const [sortKey, setSortKey] = useState("name");
  const [showCosts, setShowCosts] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);

    const urlsToTry = [
      `${apiBase}/invoices/details`,
      `${apiBase}/api/invoices/details`,
    ];

    try {
      let lastError = null;

      for (const url of urlsToTry) {
        try {
          const res = await axios.get(url, {
            headers: { Accept: "application/json" },
          });

          if (isHtmlResponse(res)) {
            throw new Error(
              `Got HTML from ${url}. You are hitting the React server, not NestJS. Make sure backend runs on :3001 and apiBase is correct.`
            );
          }

          const list = Array.isArray(res.data) ? res.data : res.data?.data;
          setInvoices(Array.isArray(list) ? list : []);
          setErr(null);
          return;
        } catch (e) {
          lastError = e;
        }
      }

      const msg =
        lastError?.response?.data?.message ||
        lastError?.message ||
        "Failed to load invoices";
      setErr(String(msg));
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const filteredInvoices = useMemo(() => {
    const query = qInv.trim().toLowerCase();
    let list = invoices.slice();

    if (typeFilter !== "ALL") {
      list = list.filter((x) => String(x.invoiceType) === typeFilter);
    }

    if (query) {
      list = list.filter((x) => {
        const invNb = String(x.invoiceNumber || "").toLowerCase();
        const cust = String(x.customer?.name || "").toLowerCase();
        const br = String(x.branch?.name || "").toLowerCase();
        const id = String(x.id || "");
        return invNb.includes(query) || cust.includes(query) || br.includes(query) || id.includes(query);
      });
    }

    list.sort((a, b) => {
      const ad = new Date(a.date).getTime();
      const bd = new Date(b.date).getTime();
      if (bd !== ad) return bd - ad;
      return safeNum(b.id) - safeNum(a.id);
    });

    return list;
  }, [invoices, qInv, typeFilter]);

  const selectedInvoice = useMemo(() => {
    if (!filteredInvoices.length) return null;
    const found = selectedIdFromUrl
      ? filteredInvoices.find((x) => Number(x.id) === selectedIdFromUrl)
      : null;
    return found || filteredInvoices[0];
  }, [filteredInvoices, selectedIdFromUrl]);

  // keep URL synced
  useEffect(() => {
    if (!selectedInvoice) return;
    const current = Number(sp.get("id") || 0);
    if (current !== Number(selectedInvoice.id)) {
      setSp((prev) => {
        const next = new URLSearchParams(prev);
        next.set("id", String(selectedInvoice.id));
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedInvoice]);

  const currencyCode = selectedInvoice?.currency?.code ?? null;

  const stats = useMemo(() => {
    const items = selectedInvoice?.items || [];
    const totalSqm = items.reduce((s, it) => s + safeNum(it.sqm, 0), 0);
    const totalQty = items.reduce((s, it) => s + safeNum(it.quantity, 0), 0);

    const hasAnyAvg = items.some((it) => it.averageCost != null);
    const grossProfit = items.reduce((s, it) => {
      if (it.averageCost == null) return s;
      return s + (safeNum(it.unitPrice) - safeNum(it.averageCost)) * safeNum(it.sqm);
    }, 0);

    return { totalSqm, totalQty, grossProfit, hasAnyAvg };
  }, [selectedInvoice]);

  const itemRows = useMemo(() => {
    const items = (selectedInvoice?.items || []).slice();
    const query = itemQ.trim().toLowerCase();

    const filtered = !query
      ? items
      : items.filter((it) => {
          const name = String(it.itemName || "").toLowerCase();
          const dims = `${it.length ?? ""} ${it.width ?? ""} ${it.sheetsPerBox ?? ""}`.toLowerCase();
          return (
            name.includes(query) ||
            dims.includes(query) ||
            String(it.itemVariantId || "").includes(query)
          );
        });

    filtered.sort((a, b) => {
      const an = String(a.itemName || "").toLowerCase();
      const bn = String(b.itemName || "").toLowerCase();

      switch (sortKey) {
        case "name":
          return an.localeCompare(bn);
        case "sqm_desc":
          return safeNum(b.sqm) - safeNum(a.sqm);
        case "sqm_asc":
          return safeNum(a.sqm) - safeNum(b.sqm);
        case "unit_desc":
          return safeNum(b.unitPrice) - safeNum(a.unitPrice);
        case "unit_asc":
          return safeNum(a.unitPrice) - safeNum(b.unitPrice);
        case "total_desc":
          return safeNum(b.totalAmount) - safeNum(a.totalAmount);
        case "total_asc":
          return safeNum(a.totalAmount) - safeNum(b.totalAmount);
        default:
          return 0;
      }
    });

    return filtered;
  }, [selectedInvoice, itemQ, sortKey]);

  const onSelectInvoice = (inv) => {
    setSp((prev) => {
      const next = new URLSearchParams(prev);
      next.set("id", String(inv.id));
      return next;
    });
  };

  return (
    <div className="page">
      {/* Header */}
      <div className="topbar">
        <div className="topbar-left">
          <div className="titleblock">
            <div className="titleRow">
              <h1 className="title">Invoice Viewer</h1>
              <span className="pill">API: {apiBase}</span>
            </div>
            <div className="subtitle">Browse invoices on the left, view details on the right.</div>
          </div>
        </div>

        <div className="topbar-right">
          <button className="btn btn--ghost" onClick={loadAll} disabled={loading}>
            ⟳ Refresh
          </button>
          <button
            className={`btn ${showCosts ? "btn--primary" : "btn--ghost"}`}
            onClick={() => setShowCosts((v) => !v)}
            disabled={loading || !selectedInvoice}
          >
            Costs: {showCosts ? "ON" : "OFF"}
          </button>
          <button className="btn btn--ghost" onClick={() => window.print()} disabled={loading || !selectedInvoice || !!err}>
            🖨 Print
          </button>
        </div>
      </div>

      {err && !loading && (
        <div className="card card--error">
          <div className="cardHeader">
            <div className="cardTitle">Couldn’t load invoices</div>
          </div>
          <div className="cardBody">
            <div className="errorText">{err}</div>
            <button className="btn btn--primary" onClick={loadAll}>
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="split">
        {/* LEFT: list */}
        <div className="panel">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Invoices</div>
              <div className="panelHint">{loading ? "Loading…" : `${filteredInvoices.length} invoice(s)`}</div>
            </div>

            <div className="panelControls">
              <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} disabled={loading}>
                <option value="ALL">All Types</option>
                <option value="S">Sales</option>
                <option value="G">Glass</option>
                <option value="RVR">Re-Variance</option>
                <option value="RTN">Return</option>
              </select>

              <div className="searchBox">
                <span className="searchIcon">🔎</span>
                <input
                  className="input"
                  value={qInv}
                  onChange={(e) => setQInv(e.target.value)}
                  placeholder="Search number / customer / branch…"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <div className="list">
            {loading && Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)}

            {!loading && filteredInvoices.length === 0 && (
              <div className="emptyBox">
                <div className="emptyTitle">No invoices found</div>
                <div className="emptyText">Try changing search or filters.</div>
              </div>
            )}

            {!loading &&
              filteredInvoices.map((inv) => {
                const active = Number(inv.id) === Number(selectedInvoice?.id);
                const code = inv?.currency?.code ?? null;

                return (
                  <button key={inv.id} className={`listRow ${active ? "listRow--active" : ""}`} onClick={() => onSelectInvoice(inv)} type="button">
                    <div className="listRowLeft">
                      <div className="listTitle">
                        <span className="listInvNb">{inv.invoiceNumber ?? `#${inv.id}`}</span>
                        <span className={typeClass(inv.invoiceType)}>{typeLabel(inv.invoiceType)}</span>
                      </div>
                      <div className="listSub">
                        <span>{fmtDate(inv.date)}</span>
                        <span className="dot">•</span>
                        <span>{inv.customer?.name ?? "—"}</span>
                      </div>
                    </div>

                    <div className="listRowRight">
                      <div className="listAmt">{fmtMoney(inv?.totals?.grandTotal ?? 0, code)}</div>
                      <div className="listSmall">{inv.branch?.name ?? "—"}</div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        {/* RIGHT: details */}
        <div className="panel panel--details">
          <div className="panelHeader">
            <div>
              <div className="panelTitle">Details</div>
              <div className="panelHint">
                {selectedInvoice ? (
                  <>
                    Invoice <strong>{selectedInvoice.invoiceNumber ?? `#${selectedInvoice.id}`}</strong> · {fmtDate(selectedInvoice.date)} ·{" "}
                    <span className={typeClass(selectedInvoice.invoiceType)}>{typeLabel(selectedInvoice.invoiceType)}</span>
                  </>
                ) : (
                  "Select an invoice"
                )}
              </div>
            </div>
          </div>

          {!selectedInvoice && !loading && (
            <div className="emptyBox">
              <div className="emptyTitle">Nothing selected</div>
              <div className="emptyText">Choose an invoice from the left list.</div>
            </div>
          )}

          {!!selectedInvoice && (
            <>
              {/* Summary */}
              <div className="cardsGrid">
                <div className="card">
                  <div className="cardHeader">
                    <div className="cardHint">Grand Total</div>
                  </div>
                  <div className="cardBody">
                    <div className="bigValue">{fmtMoney(selectedInvoice?.totals?.grandTotal ?? 0, currencyCode)}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="cardHeader">
                    <div className="cardHint">Without VAT</div>
                  </div>
                  <div className="cardBody">
                    <div className="bigValue">{fmtMoney(selectedInvoice?.totals?.totalWithoutVAT ?? 0, currencyCode)}</div>
                  </div>
                </div>

                <div className="card">
                  <div className="cardHeader">
                    <div className="cardHint">VAT</div>
                  </div>
                  <div className="cardBody">
                    <div className="bigValue">{fmtMoney(selectedInvoice?.totals?.totalVAT ?? 0, currencyCode)}</div>
                    <div className="subHint">{fmtNum(selectedInvoice?.totals?.vatPercentage ?? 0, 2)}%</div>
                  </div>
                </div>

                <div className="card">
                  <div className="cardHeader">
                    <div className="cardHint">Totals</div>
                  </div>
                  <div className="cardBody">
                    <div className="kv">
                      <span className="k">Customer</span>
                      <span className="v">{selectedInvoice?.customer?.name ?? "—"}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Branch</span>
                      <span className="v">{selectedInvoice?.branch?.name ?? "—"}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Items</span>
                      <span className="v">{selectedInvoice?.items?.length ?? 0}</span>
                    </div>
                    <div className="kv">
                      <span className="k">Qty</span>
                      <span className="v">{fmtNum(stats.totalQty, 0)}</span>
                    </div>
                    <div className="kv">
                      <span className="k">SQM</span>
                      <span className="v">{fmtNum(stats.totalSqm, 2)}</span>
                    </div>
                    {stats.hasAnyAvg && (
                      <div className="kv">
                        <span className="k">Gross Profit*</span>
                        <span className="v">{fmtMoney(stats.grossProfit, currencyCode)}</span>
                      </div>
                    )}
                  </div>
                  {stats.hasAnyAvg && <div className="cardFooter">*Estimated using Average Cost (where available).</div>}
                </div>
              </div>

              {/* Items */}
              <div className="card card--pad">
                <div className="cardHeader cardHeader--row">
                  <div>
                    <div className="cardTitle">Items</div>
                    <div className="cardHint">Search and sort within this invoice.</div>
                  </div>

                  <div className="controls">
                    <div className="searchBox">
                      <span className="searchIcon">🔎</span>
                      <input
                        className="input"
                        value={itemQ}
                        onChange={(e) => setItemQ(e.target.value)}
                        placeholder="Search item name, variant id, dimensions…"
                      />
                    </div>

                    <select className="select" value={sortKey} onChange={(e) => setSortKey(e.target.value)}>
                      <option value="name">Sort: Name</option>
                      <option value="sqm_desc">Sort: SQM (high → low)</option>
                      <option value="sqm_asc">Sort: SQM (low → high)</option>
                      <option value="unit_desc">Sort: Unit Price (high → low)</option>
                      <option value="unit_asc">Sort: Unit Price (low → high)</option>
                      <option value="total_desc">Sort: Total (high → low)</option>
                      <option value="total_asc">Sort: Total (low → high)</option>
                    </select>
                  </div>
                </div>

                <div className="cardBody">
                  <div className="tableWrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Specs</th>
                          <th className="thRight">Qty</th>
                          <th className="thRight">SQM</th>
                          <th className="thRight">Unit</th>
                          <th className="thRight">Total</th>
                          {showCosts && (
                            <>
                              <th className="thRight">Avg Cost</th>
                              <th className="thRight">Avg C</th>
                              <th className="thRight">Avg VM</th>
                              <th className="thRight">Avg CVM</th>
                            </>
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {loading &&
                          Array.from({ length: 8 }).map((_, i) => <ItemsSkeletonRow key={i} showCosts={showCosts} />)}

                        {!loading && itemRows.length === 0 && (
                          <tr>
                            <td colSpan={showCosts ? 10 : 6} className="emptyCell">
                              <div className="emptyTitle">No items found</div>
                              <div className="emptyText">Try a different search.</div>
                            </td>
                          </tr>
                        )}

                        {!loading &&
                          itemRows.map((it) => {
                            const dims =
                              it.length != null && it.width != null ? `${fmtNum(it.length, 0)}×${fmtNum(it.width, 0)}` : "—";

                            const spb =
                              it.sheetsPerBox != null && Number(it.sheetsPerBox) > 0 ? `${it.sheetsPerBox} sheets/box` : null;

                            return (
                              <tr key={it.id} className="row">
                                <td className="cell">
                                  <div className="itemName">{it.itemName ?? "—"}</div>
                                  <div className="itemSub">Variant #{it.itemVariantId}</div>
                                </td>

                                <td className="cell">
                                  <div className="specLine">
                                    Thickness: <span className="specStrong">{it.thickness != null ? `${fmtNum(it.thickness, 0)}mm` : "—"}</span>
                                  </div>
                                  <div className="specSub">
                                    Dims: {dims}
                                    {spb ? ` • ${spb}` : ""}
                                  </div>
                                </td>

                                <td className="cell cell--right">{fmtNum(it.quantity ?? 0, 0)}</td>
                                <td className="cell cell--right">{fmtNum(it.sqm ?? 0, 2)}</td>
                                <td className="cell cell--right">{fmtMoney(it.unitPrice ?? 0, currencyCode)}</td>
                                <td className="cell cell--right cell--strong">{fmtMoney(it.totalAmount ?? 0, currencyCode)}</td>

                                {showCosts && (
                                  <>
                                    <td className="cell cell--right">{it.averageCost == null ? "—" : fmtMoney(it.averageCost, currencyCode)}</td>
                                    <td className="cell cell--right">{it.averageCostC == null ? "—" : fmtMoney(it.averageCostC, currencyCode)}</td>
                                    <td className="cell cell--right">{it.averageCostVM == null ? "—" : fmtMoney(it.averageCostVM, currencyCode)}</td>
                                    <td className="cell cell--right">{it.averageCostCVM == null ? "—" : fmtMoney(it.averageCostCVM, currencyCode)}</td>
                                  </>
                                )}
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div className="footnote">Tip: Use “Costs” toggle for a cleaner view.</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
