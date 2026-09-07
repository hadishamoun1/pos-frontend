import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./customers.css";
import { axiosClient } from "../api/axiosClient";
import { useTranslation } from "../hooks/useTranslation";

const PAGE_SIZE = 50;

const emptyForm = {
  customerName: "",
  phoneNumber: "",
  financialAccount: "",
  invoiceType: "",
  vat: "",
  currency: "",
  address: "",
  location: "",
  firstName: "",
  middleName: "",
  lastName: "",
  paymentTerms: "",
  area: "",
  companyType: "",
};

function toStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function buildPayload(formData) {
  const payload = {
    customerName: formData.customerName?.trim(),
    // ✅ send "" (not undefined) for these free-text fields — the backend
    // only applies a field when it's present and non-null, so `undefined`
    // (which gets stripped below) meant clearing a field back to blank and
    // saving silently kept the old value instead of clearing it.
    firstName: formData.firstName?.trim() ?? "",
    middleName: formData.middleName?.trim() ?? "",
    lastName: formData.lastName?.trim() ?? "",
    paymentTerms: formData.paymentTerms?.trim() ?? "",
    area: formData.area?.trim() ?? "",
    companyType: formData.companyType?.trim() ?? "",
    phoneNumber: formData.phoneNumber?.trim() ?? "",
    financialNumber: formData.financialAccount?.trim() ?? "",
    address: formData.address?.trim() ?? "",
    location: formData.location?.trim() ?? "",
    // These stay "only send when actually set" — an empty string isn't a
    // meaningful "clear" for a dropdown/number the way it is for free text.
    invoiceType: formData.invoiceType || undefined,
    vat: formData.vat !== "" ? formData.vat : undefined,
    currencyId: formData.currency !== "" ? Number(formData.currency) : undefined,
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

export default function CreatePreviewCustomers() {
  const { t } = useTranslation();

  const [customers, setCustomers] = useState([]);
  const [currencyCodes, setCurrencyCodes] = useState([]);
  const [formData, setFormData] = useState({ ...emptyForm });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const [editingId, setEditingId] = useState(null);
  const isEditing = editingId !== null;

  // ── Search state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axiosClient.get("/currency/v1/dropdown/currencycodes");
        setCurrencyCodes(res.data || []);
      } catch (e) {
        console.error("Error fetching currency codes:", e);
      }
    })();
  }, []);

  const openModal = (type, msg) => {
    setModalType(type);
    setModalMessage(msg);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const fetchCustomers = async (currentPage) => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await axiosClient.get(
        `/customers/v1/paginated?page=${currentPage}&limit=${PAGE_SIZE}`
      );
      const list = Array.isArray(res?.data?.customers) ? res.data.customers : [];
      setCustomers((prev) => {
        const newOnes = list.filter((n) => !prev.some((p) => p.id === n.id));
        return [...prev, ...newOnes];
      });
      setHasMore(list.length > 0);
    } catch (e) {
      console.error("Error fetching customers:", e);
      openModal("error", t("customersPage.messages.failedLoadCustomers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextPage = () => {
    setPage((p) => {
      const np = p + 1;
      fetchCustomers(np);
      return np;
    });
  };

  // ── Search handler with debounce ──────────────────────────────────────────
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      setIsSearchActive(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      setIsSearchActive(true);
      try {
        const res = await axiosClient.get(
          `/customers/v1/search?query=${encodeURIComponent(value.trim())}`
        );
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error("Search error:", e);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchActive(false);
  };

  // ── The displayed rows: search results or full list ───────────────────────
  const displayedCustomers = isSearchActive ? searchResults : customers;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const startEditCustomer = (customer) => {
    if (!customer?.id) return;
    setEditingId(customer.id);
    setFormData({
      customerName: toStr(customer.customerName),
      phoneNumber: toStr(customer.phoneNumber),
      financialAccount: toStr(customer.financialNumber),
      invoiceType: toStr(customer.invoiceType),
      vat: customer.vat === null || customer.vat === undefined ? "" : toStr(customer.vat),
      currency: toStr(customer.currencyId ?? customer.currency?.id ?? ""),
      address: toStr(customer.address),
      location: toStr(customer.location),
      firstName: toStr(customer.firstName),
      middleName: toStr(customer.middleName),
      lastName: toStr(customer.lastName),
      paymentTerms: toStr(customer.paymentTerms),
      area: toStr(customer.area),
      companyType: toStr(customer.companyType),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
  };

  const saveCustomer = async () => {
    try {
      const payload = buildPayload(formData);

      if (!payload.customerName) {
        openModal("error", t("customersPage.messages.customerNameRequired"));
        return;
      }

      if (!isEditing) {
        if (!payload.currencyId) {
          openModal("error", t("customersPage.messages.currencyRequired"));
          return;
        }
        const res = await axiosClient.post("/customers", payload);
        setCustomers((prev) => [res.data, ...prev]);
        setFormData({ ...emptyForm });
        openModal("success", t("customersPage.messages.customerAdded"));
      } else {
        const res = await axiosClient.patch(`/customers/${editingId}`, payload);
        setCustomers((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...res.data } : c))
        );
        setEditingId(null);
        setFormData({ ...emptyForm });
        openModal("success", t("customersPage.messages.customerUpdated"));
      }
    } catch (e) {
      console.error("Error saving customer:", e);
      openModal(
        "error",
        isEditing
          ? t("customersPage.messages.failedUpdateCustomer")
          : t("customersPage.messages.failedAddCustomer")
      );
    }
  };

  const rowClass = useMemo(() => {
    return (id) => (isEditing && id === editingId ? "customer-preview-is-editing" : "");
  }, [isEditing, editingId]);

  return (
    <div className="customer-preview-container">
      <div className="customer-preview-header">
        <h2 className="customer-preview-heading">{t("customersPage.title")}</h2>
      </div>

      {/* ── Create / Edit Form ─────────────────────────────────────────────── */}
      <div className="customer-preview-card customer-preview-form">
        <div className="customer-preview-card-title">
          {isEditing
            ? t("customersPage.editTitleWithId", { id: editingId })
            : t("customersPage.createTitle")}
        </div>

        <table className="customer-preview-form-table">
          <tbody>
            <tr>
              <td>
                <label>{t("customersPage.form.customerName")}</label>
                <input type="text" name="customerName" value={formData.customerName} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.phoneNumber")}</label>
                <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.financialAccount")}</label>
                <input type="text" name="financialAccount" value={formData.financialAccount} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.invoiceType")}</label>
                <select name="invoiceType" value={formData.invoiceType} onChange={handleInputChange}>
                  <option value="">{t("customersPage.form.selectType")}</option>
                  <option value="S">S</option>
                  <option value="G">G</option>
                  <option value="Both">{t("customersPage.form.both")}</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>
                <label>{t("customersPage.form.firstName")}</label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.middleName")}</label>
                <input type="text" name="middleName" value={formData.middleName} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.lastName")}</label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.paymentTerms")}</label>
                <input type="text" name="paymentTerms" value={formData.paymentTerms} onChange={handleInputChange} placeholder={t("customersPage.form.paymentTermsPlaceholder")} />
              </td>
            </tr>

            <tr>
              <td>
                <label>{t("customersPage.form.vat")}</label>
                <select name="vat" value={formData.vat} onChange={handleInputChange}>
                  <option value="">{t("customersPage.form.selectVat")}</option>
                  <option value="0">0%</option>
                  <option value="6">6%</option>
                  <option value="11">11%</option>
                </select>
              </td>
              <td>
                <label>{t("customersPage.form.currency")}</label>
                <select name="currency" value={formData.currency} onChange={handleInputChange}>
                  <option value="">{t("customersPage.form.selectCurrency")}</option>
                  {currencyCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.currencyCode}</option>
                  ))}
                </select>
              </td>
              <td>
                <label>{t("customersPage.form.area")}</label>
                <input type="text" name="area" value={formData.area} onChange={handleInputChange} placeholder={t("customersPage.form.areaPlaceholder")} />
              </td>
              <td>
                <label>{t("customersPage.form.companyType")}</label>
                <input type="text" name="companyType" value={formData.companyType} onChange={handleInputChange} placeholder={t("customersPage.form.companyTypePlaceholder")} />
              </td>
            </tr>

            <tr>
              <td>
                <label>{t("customersPage.form.address")}</label>
                <input type="text" name="address" value={formData.address} onChange={handleInputChange} />
              </td>
              <td>
                <label>{t("customersPage.form.location")}</label>
                <input type="text" name="location" value={formData.location} onChange={handleInputChange} />
              </td>
              <td colSpan="2" />
            </tr>

            <tr>
              <td colSpan="4">
                <div className="customer-preview-form-actions">
                  <button className="customer-preview-add-btn" onClick={saveCustomer}>
                    {isEditing
                      ? t("customersPage.buttons.updateCustomer")
                      : t("customersPage.buttons.addCustomer")}
                  </button>
                  {isEditing && (
                    <button className="customer-preview-cancel-edit-btn" onClick={cancelEdit}>
                      {t("customersPage.buttons.cancelEdit")}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Customer Preview ───────────────────────────────────────────────── */}
      <div className="customer-preview-card">

        {/* Search bar — sits above the preview title */}
        <div className="customer-preview-search-bar">
          <div className="customer-preview-search-input-wrap">
            <svg className="customer-preview-search-icon" viewBox="0 0 20 20" fill="none">
              <circle cx="8.5" cy="8.5" r="5.5" stroke="#9ca3af" strokeWidth="1.6"/>
              <path d="M13 13l3.5 3.5" stroke="#9ca3af" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
            <input
              type="text"
              className="customer-preview-search-input"
              placeholder="Search by customer name or first name..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <button className="customer-preview-search-clear" onClick={clearSearch} title="Clear search">
                ×
              </button>
            )}
          </div>

          {isSearchActive && (
            <span className="customer-preview-search-status">
              {searchLoading
                ? "Searching..."
                : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} found`}
            </span>
          )}
        </div>

        <div className="customer-preview-card-title">
          {t("customersPage.previewTitle")}
          {isSearchActive && !searchLoading && (
            <span className="customer-preview-search-badge">
              Filtered · {searchResults.length}
            </span>
          )}
        </div>

        <div className="customer-preview-table-scroll">
          <table className="customer-preview-table">
            <thead>
              <tr>
                <th>{t("customersPage.table.actions")}</th>
                <th>{t("customersPage.table.customerAccount")}</th>
                <th>{t("customersPage.table.customerName")}</th>
                <th>{t("customersPage.table.first")}</th>
                <th>{t("customersPage.table.middle")}</th>
                <th>{t("customersPage.table.last")}</th>
                <th>{t("customersPage.table.paymentTerms")}</th>
                <th>{t("customersPage.table.area")}</th>
                <th>{t("customersPage.table.companyType")}</th>
                <th>{t("customersPage.table.phone")}</th>
                <th>{t("customersPage.table.financial")}</th>
                <th>{t("customersPage.table.invoiceType")}</th>
                <th>{t("customersPage.table.vat")}</th>
                <th>{t("customersPage.table.currency")}</th>
                <th>{t("customersPage.table.address")}</th>
                <th>{t("customersPage.table.location")}</th>
              </tr>
            </thead>
            <tbody>
              {displayedCustomers.map((c) => (
                <tr
                  key={c.id}
                  className={rowClass(c.id)}
                  onDoubleClick={() => startEditCustomer(c)}
                  title={t("customersPage.table.doubleClickToEdit")}
                >
                  <td>
                    <button
                      className="customer-preview-btn-mini"
                      type="button"
                      onClick={(e) => { e.stopPropagation(); startEditCustomer(c); }}
                    >
                      {t("customersPage.buttons.edit")}
                    </button>
                  </td>
                  <td className="customer-preview-mono">{c.customerAccountNumber}</td>
                  <td>{c.customerName}</td>
                  <td>{c.firstName}</td>
                  <td>{c.middleName}</td>
                  <td>{c.lastName}</td>
                  <td>{c.paymentTerms}</td>
                  <td>{c.area}</td>
                  <td>{c.companyType}</td>
                  <td className="customer-preview-mono">{c.phoneNumber}</td>
                  <td className="customer-preview-mono">{c.financialNumber}</td>
                  <td className="customer-preview-mono">{c.invoiceType}</td>
                  <td className="customer-preview-mono">{c.vat ? `${c.vat}%` : ""}</td>
                  <td className="customer-preview-mono">{c.currencyCode}</td>
                  <td className="customer-preview-truncate">{c.address}</td>
                  <td className="customer-preview-truncate">{c.location}</td>
                </tr>
              ))}

              {displayedCustomers.length === 0 && (
                <tr>
                  <td colSpan="16" className="customer-preview-empty-row">
                    {isSearchActive
                      ? "No customers match your search."
                      : t("customersPage.table.noCustomersLoaded")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Load more only shown when not in search mode */}
        {!isSearchActive && hasMore && !loading && (
          <button className="customer-preview-load-more-btn" onClick={nextPage}>
            {t("customersPage.buttons.loadMore")}
          </button>
        )}
        {!isSearchActive && loading && (
          <p className="customer-preview-hint">{t("common.loading")}</p>
        )}
        {!isSearchActive && !hasMore && (
          <p className="customer-preview-hint">{t("customersPage.messages.noMoreCustomers")}</p>
        )}
      </div>

      {modalOpen && (
        <div className="customer-preview-modal-overlay">
          <div className={`customer-preview-modal-content ${
            modalType === "success" ? "customer-preview-success-modal" : "customer-preview-error-modal"
          }`}>
            <h2 className={
              modalType === "success" ? "customer-preview-modal-success-text" : "customer-preview-modal-error-text"
            }>
              {modalMessage}
            </h2>
            <div className="customer-preview-modal-icon">{modalType === "success" ? "✔" : "✖"}</div>
            <button className="customer-preview-modal-button" onClick={closeModal}>
              {t("common.ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}