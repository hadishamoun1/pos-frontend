// src/pages/CashCollectionsPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "./cash-collections.css";

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fmt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "";
  return x.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function safeName(obj, fallback) {
  if (!obj) return fallback;
  return obj.name || obj.customerName || obj.fullName || obj.username || fallback;
}

function currencyCodeFromRow(r) {
  const c = r?.currency;
  const code = c?.currencyCode || c?.code || c?.name || "";
  return String(code || "").toUpperCase();
}

function buildPrintHtml({ groupedRows, filters, printDate }) {
  const esc = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const filterLineParts = [];
  if (filters?.from) filterLineParts.push(`من: ${esc(filters.from)}`);
  if (filters?.to) filterLineParts.push(`إلى: ${esc(filters.to)}`);
  if (filters?.employeeId) filterLineParts.push(`الموظف: ${esc(filters.employeeId)}`);
  if (filters?.method) filterLineParts.push(`الطريقة: ${esc(filters.method)}`);
  if (filters?.q) filterLineParts.push(`بحث: ${esc(filters.q)}`);
  const filterLine = filterLineParts.join("  |  ");

  // ✅ رقم المستند = رقم السطر (1..N) فقط
  const bodyRows = groupedRows
    .map((g, idx) => {
      return `
        <tr>
          <td class="c-doc">${idx + 1}</td>
          <td class="c-details">${esc(g.details || "")}</td>
          <td class="c-rec">${esc(g.employeeName || "")}</td>
          <td class="c-usd">${g.usd ? esc(fmt(g.usd)) : ""}</td>
          <td class="c-ll">${g.ll ? esc(fmt(g.ll)) : ""}</td>
        </tr>
      `;
    })
    .join("");

  const MIN_ROWS = 18;
  const padCount = Math.max(0, MIN_ROWS - groupedRows.length);
  const padRows = Array.from({ length: padCount })
    .map(
      (_, i) => `
      <tr>
        <td class="c-doc">${groupedRows.length + i + 1}</td>
        <td class="c-details"></td>
        <td class="c-rec"></td>
        <td class="c-usd"></td>
        <td class="c-ll"></td>
      </tr>
    `
    )
    .join("");

  return `
<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>حركة الصندوق اليومية</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Tahoma", "Arial", "Noto Naskh Arabic", "Amiri", sans-serif;
      color: #000;
      direction: rtl;
    }

    .sheet { width: 100%; }

    .top {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: end;
      gap: 8px;
      margin-bottom: 8px;
    }

    .top .left, .top .right {
      font-size: 13px;
      white-space: nowrap;
    }

    .top .title {
      text-align: center;
      font-weight: 700;
      font-size: 18px;
    }

    .meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
      margin: 6px 0 10px;
    }
    .meta .filters {
      flex: 1;
      text-align: right;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 12.5px;
    }
    th, td {
      border: 1px solid #000;
      padding: 6px 6px;
      vertical-align: top;
    }
    th { text-align: center; font-weight: 700; }

    .c-doc     { width: 5%; text-align: center; white-space: nowrap; }
    .c-details { width: 55%; white-space: normal; line-height: 1.35; word-break: break-word; }
    .c-rec     { width: 9%; text-align: center; white-space: nowrap; }
    .c-usd     { width: 13%; text-align: center; white-space: nowrap; }
    .c-ll      { width: 13%; text-align: center; white-space: nowrap; }

    tbody tr td { height: 28px; }

    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }

    .footerNote {
      margin-top: 8px;
      font-size: 11px;
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div class="right">رقم: ...............</div>
      <div class="title">حركة الصندوق اليومية</div>
      <div class="left">التاريخ: ${esc(printDate)}</div>
    </div>

    <div class="meta">
      <div class="filters">${filterLine ? esc(filterLine) : ""}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="c-doc">رقم</th>
          <th class="c-details">البيانات</th>
          <th class="c-rec">المستلم</th>
          <th class="c-usd">القبضة $$</th>
          <th class="c-ll">القبضة LL</th>
        </tr>
      </thead>
      <tbody>
        ${bodyRows}
        ${padRows}
      </tbody>
    </table>

    <div class="footerNote">
      تم الطباعة من نظام الـ POS — عدد السجلات: ${groupedRows.length}
    </div>
  </div>

  <script>
    window.onload = function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 150);
    };
  </script>
</body>
</html>
  `;
}

export default function CashCollectionsPage() {
  const [date, setDate] = useState(todayYmd());

  const [customerId, setCustomerId] = useState(null);
  const [customerInput, setCustomerInput] = useState("");
  const [customerPickLabel, setCustomerPickLabel] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [amountUSD, setAmountUSD] = useState("");
  const [amountLL, setAmountLL] = useState("");

  const [method, setMethod] = useState("CASH");
  const [currencies, setCurrencies] = useState([]);

  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const [employees, setEmployees] = useState([]);

  const [filters, setFilters] = useState({
    from: "",
    to: "",
    q: "",
    method: "",
    employeeId: "",
    page: 1,
    limit: 50,
    sortBy: "date",
    sortDir: "DESC",
  });

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [notif, setNotif] = useState({ open: false, type: "info", message: "" });

  const suggestBoxRef = useRef(null);

  const printFrameRef = useRef(null);
  const [printing, setPrinting] = useState(false);

  const pageSum = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  function findCurrencyIdByCode(code) {
    const want = String(code || "").toUpperCase();
    const found = currencies.find((c) => String(c.currencyCode || "").toUpperCase() === want);
    return found ? Number(found.id) : null;
  }

  function findCurrencyIdLL() {
    return findCurrencyIdByCode("LL") ?? findCurrencyIdByCode("LBP") ?? null;
  }

  async function loadCurrencies() {
    try {
      const { data } = await axiosClient.get(`/currency/v1/dropdown/currencycodes`);
      setCurrencies(Array.isArray(data) ? data : []);
    } catch (e) {
      setCurrencies([]);
      const status = e?.response?.status;
      setNotif({
        open: true,
        type: "error",
        message:
          status === 403
            ? "No permission: currency.view (cannot load currencies)"
            : "Failed to load currencies",
      });
    }
  }

  async function loadEmployees() {
    const tries = [
      { url: "/users", params: {} },
      { url: "/user", params: {} },
      { url: "/user/v1/list", params: {} },
      { url: "/users/v1/list", params: {} },
      { url: "/user/v1/dropdown", params: {} },
      { url: "/users/v1/dropdown", params: {} },
    ];

    for (const t of tries) {
      try {
        const { data } = await axiosClient.get(t.url, { params: t.params });
        const list = Array.isArray(data) ? data : data?.rows || data?.data || [];
        if (Array.isArray(list) && list.length) {
          setEmployees(list);
          return;
        }
      } catch (e) {}
    }
    setEmployees([]);
  }

  async function searchCustomers(query) {
    const q = String(query || "").trim();
    if (q.length < 2) {
      setCustomerSuggestions([]);
      return;
    }
    const { data } = await axiosClient.get(`/customers/v1/search`, {
      params: { query: q },
    });
    const list = Array.isArray(data) ? data : data?.rows || [];
    setCustomerSuggestions(list);
  }

  function buildListParams(f) {
    const params = { ...f };
    if (params.method === "") delete params.method;
    if (params.employeeId === "") delete params.employeeId;
    if (!params.q?.trim()) delete params.q;
    if (!params.from) delete params.from;
    if (!params.to) delete params.to;
    return params;
  }

  async function loadList(nextFilters = filters) {
    setLoading(true);
    try {
      const { data } = await axiosClient.get(`/cash-collections`, {
        params: buildListParams(nextFilters),
      });
      setRows(data?.rows || []);
      setTotal(data?.total || 0);
    } catch (e) {
      setNotif({
        open: true,
        type: "error",
        message: e?.response?.data?.message || "Failed to load cash collections",
      });
    } finally {
      setLoading(false);
    }
  }

  async function createCollection() {
    if (!customerId) {
      setNotif({ open: true, type: "error", message: "Please select a customer" });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setNotif({ open: true, type: "error", message: "Date must be YYYY-MM-DD" });
      return;
    }

    const usd = Number(amountUSD);
    const ll = Number(amountLL);

    const hasUsd = Number.isFinite(usd) && usd > 0;
    const hasLl = Number.isFinite(ll) && ll > 0;

    if (!hasUsd && !hasLl) {
      setNotif({ open: true, type: "error", message: "Enter USD and/or LL amount" });
      return;
    }

    const usdId = hasUsd ? findCurrencyIdByCode("USD") : null;
    const llId = hasLl ? findCurrencyIdLL() : null;

    if (hasUsd && !usdId) {
      setNotif({ open: true, type: "error", message: "USD currency not found in currencies table" });
      return;
    }
    if (hasLl && !llId) {
      setNotif({ open: true, type: "error", message: "LL (or LBP) currency not found in currencies table" });
      return;
    }

    const refFinal = reference.trim() ? reference.trim() : `CC-${Date.now()}`;

    setSaving(true);
    try {
      const basePayload = {
        date,
        customerId,
        method,
        reference: refFinal,
        notes: notes.trim() ? notes.trim() : null,
      };

      const requests = [];
      if (hasUsd) {
        requests.push(
          axiosClient.post(`/cash-collections`, {
            ...basePayload,
            amount: usd,
            currencyId: usdId,
          })
        );
      }
      if (hasLl) {
        requests.push(
          axiosClient.post(`/cash-collections`, {
            ...basePayload,
            amount: ll,
            currencyId: llId,
          })
        );
      }

      await Promise.all(requests);

      setNotif({ open: true, type: "success", message: "Saved" });

      setCustomerId(null);
      setCustomerInput("");
      setCustomerPickLabel("");
      setCustomerSuggestions([]);
      setShowSuggestions(false);

      setAmountUSD("");
      setAmountLL("");
      setMethod("CASH");
      setReference("");
      setNotes("");

      const next = { ...filters, page: 1 };
      setFilters(next);
      await loadList(next);
    } catch (e) {
      setNotif({
        open: true,
        type: "error",
        message: e?.response?.data?.message || "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(id) {
    if (!window.confirm("Delete this collection?")) return;
    try {
      await axiosClient.delete(`/cash-collections/${id}`);
      await loadList(filters);
      setNotif({ open: true, type: "success", message: "Deleted" });
    } catch (e) {
      setNotif({
        open: true,
        type: "error",
        message: e?.response?.data?.message || "Failed to delete",
      });
    }
  }

  async function fetchAllForPrint(appliedFilters) {
    const base = { ...appliedFilters, page: 1, limit: 200 };
    const all = [];
    let page = 1;

    while (true) {
      const params = buildListParams({ ...base, page });
      const { data } = await axiosClient.get(`/cash-collections`, { params });
      const batch = data?.rows || [];
      all.push(...batch);

      const totalCount = Number(data?.total || 0);
      if (all.length >= totalCount) break;
      if (batch.length === 0) break;

      page += 1;
      if (page > 2000) break;
    }

    return all;
  }

  function groupRowsForPrint(allRows) {
    const map = new Map();

    for (const r of allRows) {
      const key = [
        r?.date || "",
        r?.customerId || "",
        r?.employeeId || "",
        (r?.reference || "").trim(),
        (r?.notes || "").trim(),
        (r?.method || "").trim(),
      ].join("|");

      const customer = safeName(r?.customer, r?.customerId ?? "");
      const employee = safeName(r?.employee, r?.employeeId ?? "");

      const detailsParts = [];
      detailsParts.push(`${customer}`);
      if (r?.notes) detailsParts.push(`ملاحظات: ${r.notes}`);
      if (r?.method) detailsParts.push(`الطريقة: ${r.method}`);
      const details = detailsParts.join(" — ");

      const amt = Number(r?.amount || 0);
      const code = currencyCodeFromRow(r);

      if (!map.has(key)) {
        map.set(key, {
          key,
          details,
          employeeName: employee,
          usd: 0,
          ll: 0,
        });
      }

      const g = map.get(key);

      if (code === "USD" || code === "$" || code.includes("USD")) g.usd += Number.isFinite(amt) ? amt : 0;
      else if (code === "LL" || code === "LBP" || code.includes("LBP") || code.includes("LL")) g.ll += Number.isFinite(amt) ? amt : 0;
      else g.usd += Number.isFinite(amt) ? amt : 0;
    }

    return Array.from(map.values());
  }

  async function printFiltered() {
    try {
      setPrinting(true);

      const applied = { ...filters };
      const allRows = await fetchAllForPrint(applied);

      const groupedRows = groupRowsForPrint(allRows);

      const html = buildPrintHtml({
        groupedRows,
        filters: applied,
        printDate: todayYmd(),
      });

      const iframe = printFrameRef.current;
      if (!iframe) throw new Error("Print iframe missing");

      iframe.srcdoc = html;

      setTimeout(() => setPrinting(false), 800);
    } catch (e) {
      setPrinting(false);
      setNotif({
        open: true,
        type: "error",
        message: e?.response?.data?.message || e?.message || "Failed to print",
      });
    }
  }

  useEffect(() => {
    function onDocClick(e) {
      if (!suggestBoxRef.current) return;
      if (!suggestBoxRef.current.contains(e.target)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    loadCurrencies();
    loadEmployees();
    loadList(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadList(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.page, filters.limit, filters.sortBy, filters.sortDir]);

  return (
    <div className="cc-page">
      <iframe
        ref={printFrameRef}
        title="print-frame"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "-9999px",
          width: 0,
          height: 0,
          border: 0,
        }}
      />

      <div className="cc-header">
        <div>
          <div className="cc-title">Cash Collections</div>
          <div className="cc-subtitle">Track who collected money from which customer</div>
        </div>
      </div>

      {notif.open && (
        <div
          className={`cc-notif ${notif.type}`}
          onClick={() => setNotif((p) => ({ ...p, open: false }))}
          title="Click to close"
        >
          {notif.message}
        </div>
      )}

      {/* ================== CREATE CARD ================== */}
      <div className="cc-card">
        <div className="cc-card-head">
          <div className="cc-card-title">Add Collection</div>
          <button className="btn primary" disabled={saving} onClick={createCollection}>
            {saving ? "Saving..." : "Save"}
          </button>
        </div>

        <div className="cc-grid">
          <div className="cc-field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="cc-field cc-customer" ref={suggestBoxRef}>
            <label>Customer</label>
            <input
              dir="auto"
              lang="ar"
              value={customerPickLabel || customerInput}
              placeholder="Search customer..."
              onChange={(e) => {
                setCustomerPickLabel("");
                setCustomerId(null);
                setCustomerInput(e.target.value);
                setShowSuggestions(true);
                searchCustomers(e.target.value);
              }}
              onFocus={() => {
                setShowSuggestions(true);
                if (!customerPickLabel) searchCustomers(customerInput);
              }}
            />

            {showSuggestions && !customerPickLabel && customerSuggestions.length > 0 && (
              <div className="cc-suggest">
                {customerSuggestions.slice(0, 12).map((c) => (
                  <div
                    key={c.id}
                    className="cc-suggest-item"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerPickLabel(safeName(c, `#${c.id}`));
                      setCustomerInput("");
                      setCustomerSuggestions([]);
                      setShowSuggestions(false);
                    }}
                  >
                    <div className="name" dir="auto">
                      {safeName(c, `#${c.id}`)}
                    </div>
                    {(c.phone || c.accountNumber) && (
                      <div className="meta">
                        {c.phone ? `📞 ${c.phone}` : ""}
                        {c.phone && c.accountNumber ? " · " : ""}
                        {c.accountNumber ? `#${c.accountNumber}` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="cc-field">
            <label>القبضة $$</label>
            <input
              dir="ltr"
              value={amountUSD}
              onChange={(e) => setAmountUSD(e.target.value)}
              placeholder="0.00"
              inputMode="decimal"
            />
          </div>

          <div className="cc-field">
            <label>القبضة LL</label>
            <input
              dir="ltr"
              value={amountLL}
              onChange={(e) => setAmountLL(e.target.value)}
              placeholder="0"
              inputMode="decimal"
            />
          </div>

          <div className="cc-field">
            <label>Method</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="WHISH">Whish</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="cc-field">
            <label>Reference</label>
            <input
              dir="auto"
              lang="ar"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Optional (same ref for USD+LL)"
            />
          </div>

          <div className="cc-field cc-wide">
            <label>Notes</label>
            <input
              dir="auto"
              lang="ar"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>
      </div>

      {/* ================== FILTERS CARD ================== */}
      <div className="cc-card">
        <div className="cc-card-head">
          <div className="cc-card-title">Filters</div>

          <div className="cc-card-actions">
            <button className="btn" disabled={printing} onClick={printFiltered}>
              {printing ? "Printing..." : "Print"}
            </button>

            <button
              className="btn"
              onClick={() => {
                const next = { ...filters, page: 1 };
                setFilters(next);
                loadList(next);
              }}
            >
              Apply
            </button>

            <button
              className="btn"
              onClick={() => {
                const next = {
                  from: "",
                  to: "",
                  q: "",
                  method: "",
                  employeeId: "",
                  page: 1,
                  limit: 50,
                  sortBy: "date",
                  sortDir: "DESC",
                };
                setFilters(next);
                loadList(next);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className="cc-grid cc-grid-filters">
          <div className="cc-field">
            <label>From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value, page: 1 }))}
            />
          </div>

          <div className="cc-field">
            <label>To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value, page: 1 }))}
            />
          </div>

          <div className="cc-field">
            <label>Search</label>
            <input
              dir="auto"
              lang="ar"
              value={filters.q}
              onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value, page: 1 }))}
              placeholder="customer / reference / notes"
            />
          </div>

          <div className="cc-field">
            <label>Employee</label>
            <select
              value={filters.employeeId}
              onChange={(e) => setFilters((p) => ({ ...p, employeeId: e.target.value, page: 1 }))}
            >
              <option value="">All</option>
              {employees.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {safeName(u, u.username || `#${u.id}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="cc-field">
            <label>Method</label>
            <select
              value={filters.method}
              onChange={(e) => setFilters((p) => ({ ...p, method: e.target.value, page: 1 }))}
            >
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="WHISH">Whish</option>
              <option value="CHEQUE">Cheque</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="cc-field">
            <label>Sort</label>
            <div className="cc-sortRow">
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters((p) => ({ ...p, sortBy: e.target.value, page: 1 }))}
              >
                <option value="date">Date</option>
                <option value="createdAt">Created</option>
                <option value="amount">Amount</option>
              </select>
              <select
                value={filters.sortDir}
                onChange={(e) => setFilters((p) => ({ ...p, sortDir: e.target.value, page: 1 }))}
              >
                <option value="DESC">DESC</option>
                <option value="ASC">ASC</option>
              </select>
            </div>
          </div>

          <div className="cc-field">
            <label>Rows</label>
            <select
              value={filters.limit}
              onChange={(e) => setFilters((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================== LIST CARD ================== */}
      <div className="cc-card">
        <div className="cc-card-head">
          <div className="cc-card-title">
            Results: {total} · Page {filters.page} · Page Sum: {fmt(pageSum)}
          </div>

          <div className="cc-card-actions">
            <button
              className="btn"
              disabled={filters.page <= 1 || loading}
              onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
            >
              Prev
            </button>
            <button
              className="btn"
              disabled={loading || filters.page * filters.limit >= total}
              onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>

        {loading ? (
          <div className="cc-loading">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="cc-empty">No collections found</div>
        ) : (
          <div className="cc-tableWrap">
            <table className="cc-table">
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Date</th>
                  <th>Customer</th>
                  <th style={{ width: 170 }}>Employee</th>
                  <th style={{ width: 130 }} className="num">
                    Amount
                  </th>
                  <th style={{ width: 120 }}>Currency</th>
                  <th style={{ width: 110 }}>Method</th>
                  <th style={{ width: 140 }}>Reference</th>
                  <th>Notes</th>
                  <th style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.date}</td>
                    <td dir="auto">{safeName(r.customer, r.customerId)}</td>
                    <td dir="auto">{safeName(r.employee, r.employeeId)}</td>
                    <td className="num">{fmt(r.amount)}</td>
                    <td>
                      {r.currency
                        ? r.currency.currencyCode || r.currency.code || r.currency.name
                        : r.currencyId || "-"}
                    </td>
                    <td>{r.method}</td>
                    <td dir="auto">{r.reference || "-"}</td>
                    <td className="notes" dir="auto">
                      {r.notes || "-"}
                    </td>
                    <td className="actions">
                      <button className="btn danger" onClick={() => deleteRow(r.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 0 && (
          <div className="cc-foot">
            Showing {Math.min(filters.limit, rows.length)} of {total}
          </div>
        )}
      </div>
    </div>
  );
}
