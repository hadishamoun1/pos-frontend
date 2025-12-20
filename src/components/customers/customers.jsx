import React, { useState, useEffect } from "react";
import "./customers.css";
import { axiosClient } from "../api/axiosClient";

const CreatePreviewCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [currencyCodes, setCurrencyCodes] = useState([]);
  const [formData, setFormData] = useState({
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
  });

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");

  useEffect(() => {
    const fetchCurrencyCodes = async () => {
      try {
        const res = await axiosClient.get("/currency/v1/dropdown/currencycodes");
        setCurrencyCodes(res.data);
      } catch (error) {
        console.error("Error fetching currency codes:", error);
      }
    };
    fetchCurrencyCodes();
  }, []);

  const fetchCustomers = async (currentPage) => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const res = await axiosClient.get(
        `/customers/v1/paginated?page=${currentPage}&limit=50`
      );

      setCustomers((prevCustomers) => {
        const newCustomers = res.data.customers.filter(
          (newCustomer) =>
            !prevCustomers.some(
              (existingCustomer) => existingCustomer.id === newCustomer.id
            )
        );
        return [...prevCustomers, ...newCustomers];
      });

      setHasMore(res.data.customers.length > 0);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const nextPage = () => {
    setPage((prevPage) => {
      const newPage = prevPage + 1;
      fetchCustomers(newPage);
      return newPage;
    });
  };

  useEffect(() => {
    fetchCustomers(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleAddCustomer = async () => {
    try {
      const newCustomer = {
        customerName: formData.customerName,

        firstName: formData.firstName || undefined,
        middleName: formData.middleName || undefined,
        lastName: formData.lastName || undefined,
        paymentTerms: formData.paymentTerms || undefined,
        area: formData.area || undefined,
        companyType: formData.companyType || undefined,

        phoneNumber: formData.phoneNumber || undefined,
        financialNumber: formData.financialAccount || undefined,
        invoiceType: formData.invoiceType || undefined,
        vat: formData.vat || undefined,
        currencyId: formData.currency,
        address: formData.address || undefined,

        // keep only if your backend accepts it
        location: formData.location || undefined,
      };

      const res = await axiosClient.post("/customers", newCustomer);

      setCustomers((prevCustomers) => [...prevCustomers, res.data]);

      setFormData({
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
      });

      setModalType("success");
      setModalContent(true);
    } catch (error) {
      console.error("Error adding customer:", error);
      setModalType("error");
      setModalContent(true);
    }
  };

  const closeModal = () => setModalContent(false);

  return (
    <div className="customers-container">
      <div className="customers-header">
        <h2 className="customers-heading">Create and Preview Customers</h2>
      </div>

      <div className="customers-card customers-form">
        <div className="card-title">Create Customer</div>

        <table className="form-table">
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
                <select
                  name="vat"
                  value={formData.vat}
                  onChange={handleInputChange}
                >
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
                  {currencyCodes.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.currencyCode}
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
                <button
                  className="btn-primary add-customer-btn"
                  onClick={handleAddCustomer}
                >
                  Add Customer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="customers-card customers-preview">
        <div className="card-title">Customer Preview</div>

        <div className="table-scroll">
          <table className="customers-table">
            <thead>
              <tr>
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
              {customers.map((customer, index) => (
                <tr key={customer.id || index}>
                  <td className="mono">{customer.customerAccountNumber}</td>
                  <td>{customer.customerName}</td>
                  <td>{customer.firstName}</td>
                  <td>{customer.middleName}</td>
                  <td>{customer.lastName}</td>
                  <td>{customer.paymentTerms}</td>
                  <td>{customer.area}</td>
                  <td>{customer.companyType}</td>
                  <td className="mono">{customer.phoneNumber}</td>
                  <td className="mono">{customer.financialNumber}</td>
                  <td className="mono">{customer.invoiceType}</td>
                  <td className="mono">{customer.vat ? `${customer.vat}%` : ""}</td>
                  <td className="mono">{customer.currencyCode}</td>
                  <td className="truncate">{customer.address}</td>
                  <td className="truncate">{customer.location}</td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="15" className="empty-row">
                    No customers loaded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {hasMore && !loading && (
          <button className="btn-secondary load-more-customers-btn" onClick={nextPage}>
            Load More
          </button>
        )}
        {loading && <p className="hint">Loading...</p>}
        {!hasMore && <p className="hint">No more customers to load</p>}
      </div>

      {modalContent && (
        <div className="modal">
          <div
            className={`cus-modal-content ${
              modalType === "success" ? "success-modal" : "error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="modal-success-text">Customer Added Successfully</h2>
                <div className="modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="modal-error-text">Failed to Add Customer</h2>
                <div className="modal-icon">✖</div>
              </>
            )}
            <button className="modal-button" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePreviewCustomers;
