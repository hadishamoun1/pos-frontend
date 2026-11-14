// src/components/purchases-invoice/ItemPurchaseHistoryModal.jsx
// Purchase-side twin of the POS "Item Sales History" (ItemSalesHistoryModal):
// same search, same layout — every purchase line for the searched item.
import React, { useEffect, useRef, useState } from "react";
import { axiosClient } from "../api/axiosClient";
import "../pos-system/Components/ItemSalesHistoryModal.css";
import {
  buildDimensionDisplay,
  buildItemNameDisplay,
  buildItemFilters,
  formatDate,
  parseSearchEntry,
} from "../pos-system/Components/itemHistorySearch";

const LIMIT = 100;

const STATUS_OPTIONS = [
  { value: "active", label: "Orders & invoices (no Proforma)" },
  { value: "Recieved", label: "Recieved" },
  { value: "Shipped", label: "Shipped" },
  { value: "Ordered", label: "Ordered" },
  { value: "Proforma", label: "Proforma" },
  { value: "all", label: "All statuses" },
];

const STATUS_COLORS = {
  Proforma: { background: "#e0e7ff", color: "#3730a3" },
  Ordered: { background: "#fee2e2", color: "#b91c1c" },
  Shipped: { background: "#fef3c7", color: "#92400e" },
  Recieved: { background: "#dcfce7", color: "#166534" },
};

const money = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ItemPurchaseHistoryModal = ({ isOpen, onClose }) => {
  // Item name / dimension search — Enter-to-pin, same UX as the POS Stock tab.
  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

  // Supplier / invoice — plain live-typed, debounced.
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [debouncedSupplierName, setDebouncedSupplierName] = useState("");
  const [debouncedInvoiceNumber, setDebouncedInvoiceNumber] = useState("");
  const [status, setStatus] = useState("active");

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceRef = useRef(null);

  // Fetches ONE explicit page with the filters passed in; `append: true`
  // (Load More) adds onto the existing list instead of replacing it.
  const fetchPage = async (pageNum, filters, { append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const { q, length } = buildItemFilters(filters.nameChip, filters.dimsChip);
      const { data } = await axiosClient.get("/purchase-invoices/item-history", {
        params: {
          q: q || undefined,
          length,
          supplierName: (filters.supplierName || "").trim() || undefined,
          invoiceNumber: (filters.invoiceNumber || "").trim() || undefined,
          status: filters.status,
          page: pageNum,
          limit: LIMIT,
        },
      });
      const newRows = data?.data || [];
      setRows((prev) => (append ? [...prev, ...newRows] : newRows));
      setTotal(Number(data?.total || 0));
      setPage(pageNum);
    } catch (err) {
      console.error("Error fetching item purchase history:", err);
      if (!append) {
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSupplierName(supplierName.trim());
      setDebouncedInvoiceNumber(invoiceNumber.trim());
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [supplierName, invoiceNumber]);

  const currentFilters = {
    nameChip,
    dimsChip,
    supplierName: debouncedSupplierName,
    invoiceNumber: debouncedInvoiceNumber,
    status,
  };

  // Any filter change resets to page 1 and replaces the list.
  useEffect(() => {
    if (!isOpen) return;
    fetchPage(1, currentFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nameChip, dimsChip, debouncedSupplierName, debouncedInvoiceNumber, status]);

  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (!inputValue.trim()) return;
    e.preventDefault();
    const { dims, name } = parseSearchEntry(inputValue);
    if (dims) setDimsChip(dims);
    if (name) setNameChip(name);
    setInputValue("");
  };

  if (!isOpen) return null;

  const hasMore = rows.length < total;

  return (
    <div className="ish-modal-overlay">
      <div className="ish-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ish-modal-header">
          <h2>Item Purchase History</h2>
          <button className="ish-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ish-modal-filters">
          <input
            type="text"
            className="ish-search-input"
            placeholder="Type item name / thickness (e.g. 8 ملم) / dimension (e.g. 225*321), then press Enter"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
          <input
            type="text"
            className="ish-filter-input"
            placeholder="Supplier"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
          />
          <input
            type="text"
            className="ish-filter-input"
            placeholder="Invoice # / Order # / Supplier inv #"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
          <select
            className="ish-filter-input"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            title="Proformas are hidden by default — their lines show up again on the orders made from them"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {(nameChip || dimsChip) && (
          <div className="ish-filter-tags">
            {nameChip && (
              <div className="ish-filter-tag">
                <span>Item: {nameChip}</span>
                <button onClick={() => setNameChip("")}>✕</button>
              </div>
            )}
            {dimsChip && (
              <div className="ish-filter-tag">
                <span>Dimension: {dimsChip}</span>
                <button onClick={() => setDimsChip("")}>✕</button>
              </div>
            )}
          </div>
        )}

        <div className="ish-modal-body">
          {loading ? (
            <div className="ish-loading">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="ish-empty">No purchases found. Try a different search.</div>
          ) : (
            <div className="ish-table-wrap">
              <table className="ish-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Dimension</th>
                    <th>Type</th>
                    <th>Qty</th>
                    <th>SQM</th>
                    <th>Supplier</th>
                    <th>Invoice #</th>
                    <th>Status</th>
                    <th>Price</th>
                    <th>Final Cost</th>
                    <th>PO Date</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.purchaseItemId}>
                      <td className="ish-item-name" title={buildItemNameDisplay(r)}>
                        {buildItemNameDisplay(r)}
                      </td>
                      <td className="ish-text-center">{buildDimensionDisplay(r)}</td>
                      <td className="ish-text-center ish-col-type">{r.type || "—"}</td>
                      <td className="ish-text-right">{r.quantity}</td>
                      <td className="ish-text-right">{r.sqm != null ? money(r.sqm) : "—"}</td>
                      <td className="ish-col-customer">{r.supplierName || "—"}</td>
                      <td title={r.supplierInvoiceNumber ? `Supplier invoice #: ${r.supplierInvoiceNumber}` : undefined}>
                        {r.documentNumber || "—"}
                        {r.invoiceType ? <span style={{ color: "#64748b", fontSize: 12 }}> · {r.invoiceType}</span> : null}
                      </td>
                      <td className="ish-text-center">
                        <span
                          style={{
                            ...(STATUS_COLORS[r.status] || { background: "#f1f5f9", color: "#334155" }),
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {r.status || "—"}
                        </span>
                      </td>
                      <td className="ish-text-right ish-col-price">{money(r.unitPrice)}</td>
                      <td
                        className="ish-text-right"
                        title={r.finalOFR != null ? `Final cost OFR: ${money(r.finalOFR)}` : undefined}
                      >
                        {money(r.finalCost)}
                      </td>
                      <td className="ish-text-center ish-col-date">{formatDate(r.invoiceDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ish-modal-footer">
          <span className="ish-pagination-info">
            Showing {rows.length} of {total} results
          </span>
          {hasMore && (
            <button
              className="ish-pagination-btn"
              onClick={() => fetchPage(page + 1, currentFilters, { append: true })}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading more..." : "Load More"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemPurchaseHistoryModal;
