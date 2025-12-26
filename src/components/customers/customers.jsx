import React, { useEffect, useMemo, useState } from "react";
import "./customers.css";
import { axiosClient } from "../api/axiosClient";

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

    firstName: formData.firstName?.trim() || undefined,
    middleName: formData.middleName?.trim() || undefined,
    lastName: formData.lastName?.trim() || undefined,
    paymentTerms: formData.paymentTerms?.trim() || undefined,
    area: formData.area?.trim() || undefined,
    companyType: formData.companyType?.trim() || undefined,

    phoneNumber: formData.phoneNumber?.trim() || undefined,
    financialNumber: formData.financialAccount?.trim() || undefined,
    invoiceType: formData.invoiceType || undefined,
    vat: formData.vat !== "" ? formData.vat : undefined,

    currencyId: formData.currency !== "" ? Number(formData.currency) : undefined,

    address: formData.address?.trim() || undefined,
    location: formData.location?.trim() || undefined,
  };

  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  return payload;
}

export default function CreatePreviewCustomers() {
  const [customers, setCustomers] = useState([]);
  const [currencyCodes, setCurrencyCodes] = useState([]);
  const [formData, setFormData] = useState({ ...emptyForm });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); // success | error
  const [modalMessage, setModalMessage] = useState("");

  // ✅ edit state
  const [editingId, setEditingId] = useState(null);
  const isEditing = editingId !== null;

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
      openModal("error", "Failed to load customers");
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

      // currency may come as currencyId or nested currency.id
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
        openModal("error", "Customer Name is required.");
        return;
      }

      if (!isEditing) {
        if (!payload.currencyId) {
          openModal("error", "Currency is required.");
          return;
        }

        const res = await axiosClient.post("/customers", payload);
        setCustomers((prev) => [res.data, ...prev]);
        setFormData({ ...emptyForm });
        openModal("success", "Customer Added Successfully");
      } else {
        const res = await axiosClient.patch(`/customers/${editingId}`, payload);

        setCustomers((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...res.data } : c))
        );

        setEditingId(null);
        setFormData({ ...emptyForm });
        openModal("success", "Customer Updated Successfully");
      }
    } catch (e) {
      console.error("Error saving customer:", e);
      openModal("error", isEditing ? "Failed to Update Customer" : "Failed to Add Customer");
    }
  };

  const rowClass = useMemo(() => {
    return (id) => (isEditing && id === editingId ? "customer-preview-is-editing" : "");
  }, [isEditing, editingId]);

  return (
    <div className="customer-preview-container">
      <div className="customer-preview-header">
        <h2 className="customer-preview-heading">Create and Preview Customers</h2>
      </div>

      <div className="customer-preview-card customer-preview-form">
        <div className="customer-preview-card-title">
          {isEditing ? `Edit Customer #${editingId}` : "Create Customer"}
        </div>

        <table className="customer-preview-form-table">
          <tbody>
            <tr>
              <td>
                <label>Customer Name</label>
                <input
                  type="text"
                  name="customerName"
                  value={formData.customerName}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Phone Number</label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Financial Account</label>
                <input
                  type="text"
                  name="financialAccount"
                  value={formData.financialAccount}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Invoice Type</label>
                <select
                  name="invoiceType"
                  value={formData.invoiceType}
                  onChange={handleInputChange}
                >
                  <option value="">Select Type</option>
                  <option value="S">S</option>
                  <option value="G">G</option>
                  <option value="Both">Both</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>
                <label>First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={formData.middleName}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Payment Terms</label>
                <input
                  type="text"
                  name="paymentTerms"
                  value={formData.paymentTerms}
                  onChange={handleInputChange}
                  placeholder="e.g. Net 30"
                />
              </td>
            </tr>

            <tr>
              <td>
                <label>VAT</label>
                <select name="vat" value={formData.vat} onChange={handleInputChange}>
                  <option value="">Select VAT</option>
                  <option value="0">0%</option>
                  <option value="6">6%</option>
                  <option value="11">11%</option>
                </select>
              </td>
              <td>
                <label>Currency</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  <option value="">Select Currency</option>
                  {currencyCodes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.currencyCode}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <label>Area</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleInputChange}
                  placeholder="e.g. Beirut"
                />
              </td>
              <td>
                <label>Company Type</label>
                <input
                  type="text"
                  name="companyType"
                  value={formData.companyType}
                  onChange={handleInputChange}
                  placeholder="e.g. Contractor / Retail"
                />
              </td>
            </tr>

            <tr>
              <td>
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                />
              </td>
              <td colSpan="2" />
            </tr>

            <tr>
              <td colSpan="4">
                <div className="customer-preview-form-actions">
                  <button className="customer-preview-add-btn" onClick={saveCustomer}>
                    {isEditing ? "Update Customer" : "Add Customer"}
                  </button>

                  {isEditing && (
                    <button className="customer-preview-cancel-edit-btn" onClick={cancelEdit}>
                      Cancel Edit
                    </button>
                  )}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="customer-preview-card">
        <div className="customer-preview-card-title">Customer Preview</div>

        <div className="customer-preview-table-scroll">
          <table className="customer-preview-table">
            <thead>
              <tr>
                <th>Actions</th>
                <th>Customer Account #</th>
                <th>Customer Name</th>
                <th>First</th>
                <th>Middle</th>
                <th>Last</th>
                <th>Payment Terms</th>
                <th>Area</th>
                <th>Company Type</th>
                <th>Phone</th>
                <th>Financial #</th>
                <th>Invoice Type</th>
                <th>VAT</th>
                <th>Currency</th>
                <th>Address</th>
                <th>Location</th>
              </tr>
            </thead>

            <tbody>
              {customers.map((c) => (
                <tr
                  key={c.id}
                  className={rowClass(c.id)}
                  onDoubleClick={() => startEditCustomer(c)}
                  title="Double click to edit"
                >
                  <td>
                    <button
                      className="customer-preview-btn-mini"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditCustomer(c);
                      }}
                    >
                      Edit
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

              {customers.length === 0 && (
                <tr>
                  <td colSpan="16" className="customer-preview-empty-row">
                    No customers loaded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <button className="customer-preview-load-more-btn" onClick={nextPage}>
            Load More
          </button>
        )}
        {loading && <p className="customer-preview-hint">Loading...</p>}
        {!hasMore && <p className="customer-preview-hint">No more customers to load</p>}
      </div>

      {modalOpen && (
        <div className="customer-preview-modal-overlay">
          <div
            className={`customer-preview-modal-content ${
              modalType === "success" ? "customer-preview-success-modal" : "customer-preview-error-modal"
            }`}
          >
            <h2
              className={
                modalType === "success"
                  ? "customer-preview-modal-success-text"
                  : "customer-preview-modal-error-text"
              }
            >
              {modalMessage}
            </h2>

            <div className="customer-preview-modal-icon">
              {modalType === "success" ? "✔" : "✖"}
            </div>

            <button className="customer-preview-modal-button" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
