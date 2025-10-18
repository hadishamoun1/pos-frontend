import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./pricingTable.css";

const pageSize = 5;

// --- BIDI helpers ---
const ARABIC_RE = /[\u0600-\u06FF]/; // Arabic & Persian letters
const ARABIC_INDIC_DIGITS = /[\u0660-\u0669]/g; // ٠١٢٣٤٥٦٧٨٩
const EXT_ARABIC_INDIC_DIGITS = /[\u06F0-\u06F9]/g; // ۰۱۲۳۴۵۶۷۸۹

const arabicIndicToAscii = (str = "") =>
  str
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06F0));

const normalizeSymbols = (str = "") =>
  str
    .replace(/[×xX✕✖︎]/g, "*")  // mult
    .replace(/[–—-−ـ]/g, "-")   // dashes
    .replace(/[﹡＊]/g, "*");   // odd asterisks

const normalizeSpaces = (str = "") => str.replace(/\s+/g, " ").trim();

const normalizeQuery = (str = "") =>
  normalizeSpaces(normalizeSymbols(arabicIndicToAscii(str)));

const getDirForText = (str = "") => (ARABIC_RE.test(str) ? "rtl" : "ltr");

// --- Tag bubbles to inject into the search ---
const TAGS = ["ابيض", "برونز", "اسود", "تريبلكس", "مشرط", "عاكس","محجر","مرايا","جامبو","ديكور"];

const PricingTable = ({
  presetGroups = null,
  onRequestLoadMore,
  customerName,
  onRefreshPreset,
  customerId, // POS-selected customer id (for All / searches)
}) => {
  const [groups, setGroups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDir, setSearchDir] = useState("ltr"); // visual direction of the search input

  // chips (tags) selection state
  const [selectedTags, setSelectedTags] = useState([]);

  // customer search/suggest state (always visible)
  const [customerInput, setCustomerInput] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // 'preset' (use presetGroups) or 'customer' (browse by selected customer)
  const [viewMode, setViewMode] = useState(presetGroups != null ? "preset" : "customer");

  // track if we’re showing server-search results
  const [isServerSearch, setIsServerSearch] = useState(false);

  const baseUrl = process.env.REACT_APP_API_BASE_URL;
  const effectiveCustomerId = useMemo(
    () => customerId ?? selectedCustomerId,
    [customerId, selectedCustomerId]
  );

  // helpers for tags -> query string
  const addTagToQuery = (q, tag) => {
    const parts = normalizeSpaces(q).split(" ").filter(Boolean);
    if (!parts.includes(tag)) parts.push(tag);
    return normalizeSpaces(parts.join(" "));
  };

  const removeTagFromQuery = (q, tag) => {
    const parts = normalizeSpaces(q).split(" ").filter(Boolean);
    const next = parts.filter((p) => p !== tag);
    return normalizeSpaces(next.join(" "));
  };

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const has = prev.includes(tag);
      const nextTags = has ? prev.filter((t) => t !== tag) : [...prev, tag];

      // Reflect in searchTerm
      setSearchTerm((prevQ) => {
        const updated = has ? removeTagFromQuery(prevQ, tag) : addTagToQuery(prevQ, tag);
        setSearchDir(getDirForText(updated));
        return updated;
      });

      return nextTags;
    });
  };

  // When presetGroups change, move into preset mode & load them
  useEffect(() => {
    if (presetGroups != null) {
      setViewMode("preset");
      setGroups(Array.isArray(presetGroups) ? presetGroups : []);
      setSearchTerm("");
      setSelectedTags([]);
      setIsServerSearch(false);
      setSearchDir("ltr");
    }
  }, [presetGroups]);

  useEffect(() => {
    if (viewMode === "preset" && customerName) {
      setCustomerInput(customerName);
    }
  }, [viewMode, customerName]);

  // If in customer mode and a customer is selected, load their browsing data
  useEffect(() => {
    if (viewMode === "customer" && selectedCustomerId && !isServerSearch) {
      loadInitialData(selectedCustomerId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, selectedCustomerId]);

  // --- Customer search / suggestions ---
  const fetchCustomers = async (query) => {
    try {
      const res = await axios.get(`${baseUrl}/customers/v1/search`, {
        params: { query },
      });
      setCustomerSuggestions(res.data || []);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setCustomerSuggestions([]);
    }
  };

  const handleCustomerInputChange = (e) => {
    const query = e.target.value;
    setCustomerInput(query);
    if (query.length > 1) fetchCustomers(query);
    else setCustomerSuggestions([]);
  };

  const handleCustomerSelect = (customer) => {
    setViewMode("customer");
    setSelectedCustomerId(customer.id);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]);
    setIsServerSearch(false);
    setSearchTerm("");
    setSelectedTags([]);
    setSearchDir("ltr");
  };

  const handleKeyDown = (e) => {
    if (customerSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      setHighlightedIndex((prev) =>
        prev < customerSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && highlightedIndex !== -1) {
      handleCustomerSelect(customerSuggestions[highlightedIndex]);
    }
  };

  // --- Data loaders ---
  const loadInitialData = async (custId) => {
    try {
      const res = await axios.get(`${baseUrl}/invoices/v1/browsing/${custId}`);
      setGroups(res.data || []);
    } catch (err) {
      console.error("Error loading pricing data:", err);
    }
  };

  // 🔎 SERVER SEARCH (debounced by 300ms)
  useEffect(() => {
    const qRaw = (searchTerm || "").trim();
    if (!effectiveCustomerId) return;

    const doWork = async () => {
      // If query is empty: exit search mode and show normal data
      if (!qRaw) {
        setIsServerSearch(false);
        if (viewMode === "preset") {
          setGroups(Array.isArray(presetGroups) ? presetGroups : []);
        } else {
          await loadInitialData(effectiveCustomerId);
        }
        return;
      }

      const q = normalizeQuery(qRaw); // normalize digits/symbols

      try {
        const res = await axios.get(
          `${baseUrl}/invoices/v1/browsing/${effectiveCustomerId}/search`,
          { params: { q, limitPerGroup: pageSize } }
        );
        setGroups(res.data || []);
        setIsServerSearch(true);
      } catch (err) {
        console.error("Server search failed:", err);
      }
    };

    const t = setTimeout(doWork, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, effectiveCustomerId, viewMode]);

  const loadMore = async (groupKey, currentPage) => {
    try {
      const nextPage = (currentPage || 1) + 1;

      // preset (by-item-batches)
      if (viewMode === "preset" && !isServerSearch) {
        if (typeof onRequestLoadMore === "function") {
          await onRequestLoadMore(groupKey, currentPage || 1);
        }
        return;
      }

      // server-search mode
      if (isServerSearch && effectiveCustomerId) {
        const q = normalizeQuery(searchTerm || "");
        const res = await axios.get(
          `${baseUrl}/invoices/v1/browsing/${effectiveCustomerId}/search`,
          { params: { q, groupKey, pagePerGroup: nextPage, limitPerGroup: pageSize } }
        );

        setGroups((prev) =>
          prev.map((grp) =>
            grp.groupKey === groupKey
              ? {
                  ...grp,
                  page: nextPage,
                  items: [...grp.items, ...(res.data?.items || [])],
                  total: res.data?.total ?? grp.total,
                  totalPages: res.data?.totalPages ?? grp.totalPages,
                }
              : grp
          )
        );
        return;
      }

      // customer-browsing (non-search)
      if (viewMode === "customer" && selectedCustomerId) {
        const res = await axios.get(
          `${baseUrl}/invoices/v1/browsing/${selectedCustomerId}`,
          { params: { groupKey, page: nextPage, limit: pageSize } }
        );

        setGroups((prev) =>
          prev.map((grp) =>
            grp.groupKey === groupKey
              ? {
                  ...grp,
                  page: nextPage,
                  items: [...grp.items, ...(res.data?.items || [])],
                  total: res.data?.total ?? grp.total,
                }
              : grp
          )
        );
      }
    } catch (err) {
      console.error("Error loading more:", err);
    }
  };

  // --- Clear + Refresh + ALL handlers ---
  const handleClearAll = () => {
    setGroups([]);
    setSearchTerm("");
    setSelectedTags([]);
    setCustomerInput("");
    setCustomerSuggestions([]);
    setSelectedCustomerId(null);
    setHighlightedIndex(-1);
    setIsServerSearch(false);
    setViewMode(presetGroups != null ? "preset" : "customer");
    setSearchDir("ltr");
  };

  const handleRefresh = async () => {
    try {
      if (isServerSearch && effectiveCustomerId) {
        const q = normalizeQuery(searchTerm || "");
        const res = await axios.get(
          `${baseUrl}/invoices/v1/browsing/${effectiveCustomerId}/search`,
          { params: { q, limitPerGroup: pageSize } }
        );
        setGroups(res.data || []);
        return;
      }

      if (viewMode === "preset") {
        if (typeof onRefreshPreset === "function") {
          await onRefreshPreset();
        } else {
          setGroups(Array.isArray(presetGroups) ? presetGroups : []);
          console.warn("[PricingTable] onRefreshPreset not provided; reapplied current presetGroups.");
        }
      } else if (viewMode === "customer" && selectedCustomerId) {
        await loadInitialData(selectedCustomerId);
      }
    } catch (e) {
      console.error("Refresh failed:", e);
    }
  };

  const handleShowAllForCustomer = async () => {
    const id = customerId ?? selectedCustomerId;
    if (!id) {
      console.warn("[PricingTable] No customer id to fetch ALL.");
      return;
    }
    setIsServerSearch(false);
    setSearchTerm("");
    setSelectedTags([]);
    setViewMode("customer");
    setSelectedCustomerId(id);
    if (customerName) setCustomerInput(customerName);
    setSearchDir("ltr");
    await loadInitialData(id);
  };

  // --- render helpers ---
  const toInt = (v) => (v === 0 || v ? parseInt(v, 10) : null);
  const pad3 = (n) => String(n ?? "").padStart(3, "0");
  const LRM = "\u200E";

  const getDimsParts = (item) => {
    if (item.type === "sqm") return null;
    const L = toInt(item.length);
    const W = toInt(item.width);
    if (L == null || W == null) return null;
    const spbNum = toInt(item.sheetsPerBox);
    const base = `${LRM}${W}*${L}`;
    const spb = item.type === "box" ? pad3(spbNum ?? 0) : null;
    return { base, spb };
  };

  const getQuantity = (item) => {
    if (item.type === "box") return item.box ?? 0;
    if (item.type === "sheet") return item.sheet ?? 0;
    if (item.type === "sqm") return item.sqm ?? 0;
    return item.box ?? item.sheet ?? item.sqm ?? 0;
  };

  const rows = (groups || []).flatMap((grp) => {
    const body = (grp.items || []).map((item, idx) => {
      const parts = getDimsParts(item);
      return (
        <tr
          key={`${grp.groupKey}-${idx}`}
          className={idx === 0 ? "price-browsing-latest-item-row" : ""}
        >
          <td>{item.invoiceDate}</td>
          <td>{item.invoiceNumber}</td>
          <td>{item.origin}</td>
          <td style={{ direction: "rtl", textAlign: "center" }}>
            <span className="price-browsing-item-main">
              {`${parseFloat(item.thickness)} ملم ${item.itemName}`}
            </span>
            {parts ? (
              <span className="price-browsing-item-dims">
                <span className="dims-base">{parts.base}</span>
                {parts.spb && <span className="dims-spb">-{parts.spb}</span>}
              </span>
            ) : null}
          </td>
          <td>{item.type}</td>
          <td>{getQuantity(item)}</td>
          <td>{item.unitPrice}</td>
          <td>{item.vat}</td>
          <td>{item.totalAmount}</td>
        </tr>
      );
    });

    if ((grp.items?.length || 0) < (grp.total || 0)) {
      body.push(
        <tr key={`${grp.groupKey}-loadmore`}>
          <td colSpan={9}>
            <button
              className="price-browsing-load-more-btn"
              onClick={() => loadMore(grp.groupKey, grp.page || 1)}
            >
              Load more ({grp.items?.length || 0}/{grp.total || 0})
            </button>
          </td>
        </tr>
      );
    }

    body.push(
      <tr key={`${grp.groupKey}-spacer`} className="price-browsing-group-spacer-row">
        <td colSpan={9}></td>
      </tr>
    );

    return body;
  });

  return (
    <div className="price-browsing-container">
      <div className="price-browsing-content">
        {/* Top bar: compact customer input + buttons */}
        <div className="price-browsing-topbar">
          <div className="price-browsing-customer-search-container compact">
            <input
              type="text"
              value={customerInput}
              onChange={handleCustomerInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search Customer Name"
              className="price-browsing-customer-name-input compact"
            />
            {customerSuggestions.length > 0 && (
              <ul className="price-browsing-suggestions-dropdown">
                {customerSuggestions.map((customer, index) => (
                  <li
                    key={customer.id}
                    className={
                      index === highlightedIndex
                        ? "price-browsing-suggestion--selected"
                        : ""
                    }
                    onClick={() => handleCustomerSelect(customer)}
                  >
                    {customer.customerName}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="price-browsing-topbar-buttons">
            <button
              className="price-browsing-clear-btn"
              title="Clear all"
              onClick={handleClearAll}
            >
              C
            </button>
            <button
              className="price-browsing-refresh-btn"
              title="Refresh"
              onClick={handleRefresh}
            >
              Refresh
            </button>
            <button
              className="price-browsing-all-btn"
              title="Show ALL items for this customer"
              onClick={handleShowAllForCustomer}
            >
              All
            </button>
          </div>
        </div>

        {/* Server-side search for browsing */}
        <div className="price-browsing-search-row">
          <input
            type="text"
            inputMode="search"
            autoComplete="off"
            dir={searchDir}
            className="price-browsing-search-input bidi"
            placeholder="ابحث مثل: 5.5ملم ابيض 225*321-025"
            value={searchTerm}
            onChange={(e) => {
              const v = e.target.value;
              setSearchTerm(v);
              setSearchDir(getDirForText(v));
            }}
            disabled={!effectiveCustomerId && viewMode !== "preset"}
          />
        </div>

        {/* 🔵 Tag chips row (between search bar and table) */}
        <div className="price-browsing-tag-row" dir="rtl">
          {TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`tag-chip ${active ? "active" : ""}`}
                onClick={() => toggleTag(tag)}
                title={active ? "إزالة الوسم من البحث" : "إضافة الوسم للبحث"}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="price-browsing-table-wrapper">
          <table className="price-browsing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Inv#</th>
                <th>Origin</th>
                <th>Item</th>
                <th>Type</th>
                <th>QTY</th>
                <th>Price</th>
                <th>VAT</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PricingTable;
