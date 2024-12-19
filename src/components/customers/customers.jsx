import React, { useState } from "react";
import "./customers.css";

const CreatePreviewCustomers = () => {
  const [customers, setCustomers] = useState([]);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddCustomer = () => {
    setCustomers([
      ...customers,
      { ...formData, id: Date.now(), accountNumber: `ACC-${Date.now()}` },
    ]);
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
  };

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
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="LL">LL</option>
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
              <th>Account Number</th>
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
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.accountNumber}</td>
                <td>{customer.customerName}</td>
                <td>{customer.phoneNumber}</td>
                <td>{customer.financialAccount}</td>
                <td>{customer.invoiceType}</td>
                <td>{customer.vat}</td>
                <td>{customer.currency}</td>
                <td>{customer.address}</td>
                <td>{customer.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreatePreviewCustomers;
