// src/pos-system/Components/ItemSalesHistoryModal.jsx
import React, { useEffect, useRef, useState } from "react";
import { axiosClient } from "../../api/axiosClient";
import { useTranslation } from "../../hooks/useTranslation";
import "./ItemSalesHistoryModal.css";
import {
  buildDimensionDisplay,
  buildItemNameDisplay,
  buildItemFilters,
  formatDate,
  parseSearchEntry,
} from "./itemHistorySearch";

const LIMIT = 100;

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

  // Enter-to-pin, same parsing as the POS Stock tab (see itemHistorySearch.js).
  const handleSearchKeyDown = (e) => {
    if (e.key !== "Enter") return;
    if (!inputValue.trim()) return;
    e.preventDefault();
    const { dims, name } = parseSearchEntry(inputValue);
    if (dims) setDimsChip(dims);
    if (name) setNameChip(name);
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
