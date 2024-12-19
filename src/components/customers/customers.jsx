import React, { useState, useEffect } from "react";
import axios from "axios";
import "./customers.css";

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
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");

  // Fetch currency codes from the API
  useEffect(() => {
    const fetchCurrencyCodes = async () => {
      try {
        const response = await axios.get(
          "http://localhost:3000/currency/v1/dropdown/currencycodes"
        );
        setCurrencyCodes(response.data);
      } catch (error) {
        console.error("Error fetching currency codes:", error);
      }
    };
    fetchCurrencyCodes();
  }, []);

  // Fetch customers from the API
  const fetchCustomers = async (currentPage) => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      console.log(`Fetching customers for page ${currentPage}`);
      const response = await axios.get(
        `http://localhost:3000/customers/v1/paginated?page=${currentPage}&limit=50`
      );

      setCustomers((prevCustomers) => {
        const newCustomers = response.data.customers.filter(
          (newCustomer) =>
            !prevCustomers.some(
              (existingCustomer) => existingCustomer.id === newCustomer.id
            )
        );
        return [...prevCustomers, ...newCustomers];
      });

      setHasMore(response.data.customers.length > 0);
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Controlled page increment
  const nextPage = () => {
    setPage((prevPage) => {
      const newPage = prevPage + 1;
      fetchCustomers(newPage);
      return newPage;
    });
  };

  // Initial fetch for the first page of customers
  useEffect(() => {
    fetchCustomers(page);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddCustomer = async () => {
    try {
      const newCustomer = {
        customerName: formData.customerName,
        phoneNumber: formData.phoneNumber,
        financialNumber: formData.financialAccount,
        invoiceType: formData.invoiceType,
        vat: formData.vat,
        currencyId: formData.currency,
        address: formData.address,
        location: formData.location,
      };

      const response = await axios.post(
        "http://localhost:3000/customers",
        newCustomer
      );

      setCustomers((prevCustomers) => [...prevCustomers, response.data]);
      setFormData({
        customerName: "",
        phoneNumber: "",
        financialAccount: "",
        invoiceType: "",
        vat: "",
        currency: "",
        address: "",
        location: "",
      });

      // Show success modal
      setModalType("success");
      setModalContent(true);
    } catch (error) {
      console.error("Error adding customer:", error);

      // Show error modal
      setModalType("error");
      setModalContent(true);
    }
  };
  const closeModal = () => setModalContent(false);
  return (
    <div className="customers-page-container">
      <h2>Create and Preview Customers</h2>

      {/* Input Form */}
      <div className="customer-form">
        <table>
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
                </select>
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
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                  <option value="15">15%</option>
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
            </tr>
            <tr>
              <td colSpan="4">
                <button
                  className="add-customer-button"
                  onClick={handleAddCustomer}
                >
                  Add Customer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Preview Table */}
      <div className="customer-preview">
        <h3>Customer Preview</h3>
        <table className="customer-table">
          <thead>
            <tr>
              <th>Customer Account Number</th>
              <th>Customer Name</th>
              <th>Phone Number</th>
              <th>Financial Account</th>
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
                <td>{customer.customerAccountNumber}</td>
                <td>{customer.customerName}</td>
                <td>{customer.phoneNumber}</td>
                <td>{customer.financialNumber}</td>
                <td>{customer.invoiceType}</td>
                <td>{customer.vat}%</td>
                <td>{customer.currencyCode}</td>
                <td>{customer.address}</td>
                <td>{customer.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && !loading && (
          <button className="load-more-button" onClick={nextPage}>
            Load More
          </button>
        )}
        {loading && <p>Loading...</p>}
        {!hasMore && <p>No more customers to load</p>}
      </div>

      {/* Modal */}
      {modalContent && (
        <div className="modal">
          <div
            className={`modal-content ${
              modalType === "success" ? "success-modal" : "error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="modal-success-text">
                  Customer Added Successfully
                </h2>
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
