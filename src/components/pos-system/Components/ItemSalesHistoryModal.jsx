// src/pos-system/Components/ItemSalesHistoryModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { axiosClient } from "../../api/axiosClient";
import { useTranslation } from "../../hooks/useTranslation";
import "./ItemSalesHistoryModal.css";

const LIMIT = 100;

const buildDimensionDisplay = (row) => {
  const typeLower = String(row.type || "").toLowerCase();
  if (typeLower === "box") {
    return `${row.length ?? ""}×${row.width ?? ""}-${String(row.sheetsPerBox || 0).padStart(3, "0")}`;
  }
  if (typeLower === "sheet") {
    return `${row.length ?? ""}×${row.width ?? ""}`;
  }
  if (typeLower !== "unit" && typeLower !== "sqm" && row.length && row.width) {
    return `${row.length}×${row.width}`;
  }
  return "—";
};

const buildItemNameDisplay = (row) => {
  const typeLower = String(row.type || "").toLowerCase();
  const hasThickness = typeLower !== "unit" && row.thickness != null && Number(row.thickness) > 0;
  const thicknessLabel = hasThickness ? `${Number(row.thickness)} ملم ` : "";
  return `${thicknessLabel}${row.itemName ?? ""}`.trim();
};

const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
};

// ── Search parsing — mirrors the POS Stock tab search exactly (StockTab.jsx) ──
const normalizeDigits = (s = "") =>
  String(s)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/،/g, ",");

const normalizeArabic = (s = "") =>
  String(s || "")
    .replace(/[ً-ٟ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/\s+/g, " ")
    .trim();

const looksLikeDims = (s) => {
  if (!s) return false;
  const t = normalizeDigits(s).trim();
  if (!t.includes("*")) return false;
  const [L, rest] = t.split("*");
  if (!L || !rest) return false;
  if (!/^\s*\d+(\.\d+)?\s*$/.test(L)) return false;
  const parts = rest.split("-");
  if (!/^\s*\d+(\.\d+)?\s*$/.test(parts[0] || "")) return false;
  if (parts[1] && !/^\s*\d+\s*$/.test(parts[1])) return false;
  return true;
};

const isPlainNumber = (s) => {
  if (!s) return false;
  const t = normalizeDigits(String(s)).trim();
  return /^\d{1,5}(\.\d+)?$/.test(t);
};

// Given the pinned name/dims chips, resolve them into the same {q, length}
// request shape StockTab's fetchSearch sends to /items/v1/real-variant-ledger.
const buildItemFilters = (nameChip, dimsChip) => {
  let q;
  let length;

  if (nameChip) q = normalizeArabic(nameChip);

  const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
  if (raw) {
    if (looksLikeDims(raw)) {
      q = [q, raw].filter(Boolean).join(" ");
    } else if (isPlainNumber(raw)) {
      length = Number(raw);
    }
  }

  return { q, length };
};

const ItemSalesHistoryModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation();

  // Item name / dimension search — Enter-to-pin, same UX as the POS Stock tab.
  const [inputValue, setInputValue] = useState("");
  const [nameChip, setNameChip] = useState("");
  const [dimsChip, setDimsChip] = useState("");

  // Customer / invoice — plain live-typed, debounced.
  const [customerName, setCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [debouncedCustomerName, setDebouncedCustomerName] = useState("");
  const [debouncedInvoiceNumber, setDebouncedInvoiceNumber] = useState("");

  const [page, setPage] = useState(1);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const debounceRef = useRef(null);

  // Fetches ONE explicit page. Takes the filters as arguments (rather than
  // reading them from closure) so callers always send exactly the page they
  // asked for. `append: true` (Load More) adds the results onto the existing
  // list instead of replacing it.
  const fetchPage = async (pageNum, filters, { append = false } = {}) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const { q, length } = buildItemFilters(filters.nameChip, filters.dimsChip);
      const { data } = await axiosClient.get("/items/v1/sales-history", {
        params: {
          q: q || undefined,
          length,
          customerName: (filters.customerName || "").trim() || undefined,
          invoiceNumber: (filters.invoiceNumber || "").trim() || undefined,
          page: pageNum,
          limit: LIMIT,
        },
      });
      const newRows = data?.data || [];
      setRows((prev) => (append ? [...prev, ...newRows] : newRows));
      setTotal(Number(data?.total || 0));
      setPage(pageNum);
    } catch (err) {
      console.error("Error fetching item sales history:", err);
      if (!append) {
        setRows([]);
        setTotal(0);
      }
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  };

  // Debounce the live customer/invoice text inputs only — nameChip/dimsChip
  // change discretely (on Enter), so they never need debouncing.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedCustomerName(customerName.trim());
      setDebouncedInvoiceNumber(invoiceNumber.trim());
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [customerName, invoiceNumber]);

  // Any change to the resolved filters always resets to page 1 and replaces
  // the list. "Load More" is handled imperatively by its own button below, so
  // it never races with this effect.
  useEffect(() => {
    if (!isOpen) return;
    fetchPage(1, {
      nameChip,
      dimsChip,
      customerName: debouncedCustomerName,
      invoiceNumber: debouncedInvoiceNumber,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, nameChip, dimsChip, debouncedCustomerName, debouncedInvoiceNumber]);

  // Same Enter-to-pin parsing as StockTab.jsx's handleEnter: a "*"-shaped
  // token (or dims-with-sheets like 225*321-012) becomes the dims chip; two
  // bare numbers become dims; one bare number is a lone dims chip; anything
  // left over becomes the name chip.
  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    const raw0 = inputValue.trim();
    if (!raw0) return;
    e.preventDefault();

    const raw = normalizeDigits(raw0).trim();
    const parts = raw.split(/\s+/).filter(Boolean);

    const dimsToken = parts.find((p) => p.includes("*") && looksLikeDims(p));
    if (dimsToken) {
      setDimsChip(dimsToken);
      const rest = parts.filter((p) => p !== dimsToken).join(" ").trim();
      // Only touch nameChip if this entry actually included name text —
      // otherwise leave whatever was already pinned alone (e.g. pinning a
      // dimension on its own shouldn't wipe out a previously pinned name).
      if (rest) setNameChip(normalizeArabic(rest));
      setInputValue("");
      return;
    }

    const numIdx = [];
    for (let i = 0; i < parts.length; i++) {
      if (isPlainNumber(parts[i])) numIdx.push(i);
    }

    if (numIdx.length >= 2) {
      const a = parts[numIdx[0]];
      const b = parts[numIdx[1]];
      setDimsChip(`${a}*${b}`);
      const restParts = parts.slice();
      restParts.splice(numIdx[1], 1);
      restParts.splice(numIdx[0], 1);
      const rest = restParts.join(" ").trim();
      if (rest) setNameChip(normalizeArabic(rest));
      setInputValue("");
      return;
    }

    if (numIdx.length === 1) {
      setDimsChip(parts[numIdx[0]]);
      const restParts = parts.slice();
      restParts.splice(numIdx[0], 1);
      const rest = restParts.join(" ").trim();
      if (rest) setNameChip(normalizeArabic(rest));
      setInputValue("");
      return;
    }

    setNameChip(normalizeArabic(raw));
    setInputValue("");
  };

  const clearNameChip = () => setNameChip("");
  const clearDimsChip = () => setDimsChip("");

  if (!isOpen) return null;

  const hasMore = rows.length < total;

  return (
    <div className="ish-modal-overlay">
      <div className="ish-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ish-modal-header">
          <h2>{t("itemSalesHistoryModal.title")}</h2>
          <button className="ish-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ish-modal-filters">
          <input
            type="text"
            className="ish-search-input"
            placeholder={t("itemSalesHistoryModal.searchPlaceholder")}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />
          <input
            type="text"
            className="ish-filter-input"
            placeholder={t("itemSalesHistoryModal.customer")}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
          />
          <input
            type="text"
            className="ish-filter-input"
            placeholder={t("itemSalesHistoryModal.invoiceNumber")}
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />
        </div>

        {(nameChip || dimsChip) && (
          <div className="ish-filter-tags">
            {nameChip && (
              <div className="ish-filter-tag">
                <span>{t("itemSalesHistoryModal.itemName")}: {nameChip}</span>
                <button onClick={clearNameChip}>✕</button>
              </div>
            )}
            {dimsChip && (
              <div className="ish-filter-tag">
                <span>{t("itemSalesHistoryModal.dimension")}: {dimsChip}</span>
                <button onClick={clearDimsChip}>✕</button>
              </div>
            )}
          </div>
        )}

        <div className="ish-modal-body">
          {loading ? (
            <div className="ish-loading">{t("itemSalesHistoryModal.loading")}</div>
          ) : rows.length === 0 ? (
            <div className="ish-empty">{t("itemSalesHistoryModal.noResults")}</div>
          ) : (
            <div className="ish-table-wrap">
              <table className="ish-table">
                <thead>
                  <tr>
                    <th>{t("itemSalesHistoryModal.itemName")}</th>
                    <th>{t("itemSalesHistoryModal.dimension")}</th>
                    <th>{t("itemSalesHistoryModal.type")}</th>
                    <th>{t("itemSalesHistoryModal.quantity")}</th>
                    <th>{t("itemSalesHistoryModal.customer")}</th>
                    <th>{t("itemSalesHistoryModal.invoiceNumber")}</th>
                    <th>{t("itemSalesHistoryModal.price")}</th>
                    <th>{t("itemSalesHistoryModal.vat")}</th>
                    <th>{t("itemSalesHistoryModal.date")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.invoiceItemId}>
                      <td className="ish-item-name" title={buildItemNameDisplay(r)}>
                        {buildItemNameDisplay(r)}
                      </td>
                      <td className="ish-text-center">{buildDimensionDisplay(r)}</td>
                      <td className="ish-text-center ish-col-type">{r.type || "—"}</td>
                      <td className="ish-text-right">{r.quantity}</td>
                      <td className="ish-col-customer">{r.customerName || "—"}</td>
                      <td>{r.invoiceNumber || "—"}</td>
                      <td className="ish-text-right ish-col-price">
                        {Number(r.unitPrice || 0).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="ish-text-center">
                        <span className={`ish-vat-badge ${Number(r.vatPercentage || 0) === 0 ? "ish-vat-zero" : ""}`}>
                          {Number(r.vatPercentage || 0)}%
                        </span>
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
            {t("itemSalesHistoryModal.showingCount", { shown: rows.length, total })}
          </span>
          {hasMore && (
            <button
              className="ish-pagination-btn"
              onClick={() => {
                const next = page + 1;
                fetchPage(
                  next,
                  {
                    nameChip,
                    dimsChip,
                    customerName: debouncedCustomerName,
                    invoiceNumber: debouncedInvoiceNumber,
                  },
                  { append: true }
                );
              }}
              disabled={loadingMore}
            >
              {loadingMore ? t("itemSalesHistoryModal.loadingMore") : t("itemSalesHistoryModal.loadMore")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemSalesHistoryModal;
