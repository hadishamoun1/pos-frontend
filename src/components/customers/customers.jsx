import React, { useState } from "react";
import "./styles/customersPage.css";

const CreatePreviewCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [formData, setFormData] = useState({
    company: "",
    supplierType: "",
    mobileNumber: "",
    emailAddress: "",
    address: "",
    businessPhone: "",
    businessFax: "",
    financialAccount: "",
    invoiceType: "",
    vat: "",
    region: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddCustomer = () => {
    setCustomers([...customers, { ...formData, id: Date.now() }]);
    setFormData({
      company: "",
      supplierType: "",
      mobileNumber: "",
      emailAddress: "",
      address: "",
      businessPhone: "",
      businessFax: "",
      financialAccount: "",
      invoiceType: "",
      vat: "",
      region: "",
    });
  };

  return (
    <div className="customers-page-container">
      <h2>Create and Preview Customers</h2>

      {/* Input Table */}
      <div className="customer-form">
        <table>
          <tbody>
            <tr>
              <td>
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Supplier Type</label>
                <input
                  type="text"
                  name="supplierType"
                  value={formData.supplierType}
                  onChange={handleInputChange}
                />
              </td>
            </tr>
            <tr>
              <td>
                <label>Mobile Number</label>
                <input
                  type="text"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>Email Address</label>
                <input
                  type="email"
                  name="emailAddress"
                  value={formData.emailAddress}
                  onChange={handleInputChange}
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
                <label>Business Phone</label>
                <input
                  type="text"
                  name="businessPhone"
                  value={formData.businessPhone}
                  onChange={handleInputChange}
                />
              </td>
            </tr>
            <tr>
              <td>
                <label>Business Fax</label>
                <input
                  type="text"
                  name="businessFax"
                  value={formData.businessFax}
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
            </tr>
            <tr>
              <td>
                <label>Invoice Type</label>
                <input
                  type="text"
                  name="invoiceType"
                  value={formData.invoiceType}
                  onChange={handleInputChange}
                />
              </td>
              <td>
                <label>VAT</label>
                <input
                  type="text"
                  name="vat"
                  value={formData.vat}
                  onChange={handleInputChange}
                />
              </td>
            </tr>
            <tr>
              <td>
                <label>Region</label>
                <input
                  type="text"
                  name="region"
                  value={formData.region}
                  onChange={handleInputChange}
                />
              </td>
              <td>
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
              <th>Company</th>
              <th>Supplier Type</th>
              <th>Mobile Number</th>
              <th>Email Address</th>
              <th>Address</th>
              <th>Business Phone</th>
              <th>Business Fax</th>
              <th>Financial Account</th>
              <th>Invoice Type</th>
              <th>VAT</th>
              <th>Region</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.company}</td>
                <td>{customer.supplierType}</td>
                <td>{customer.mobileNumber}</td>
                <td>{customer.emailAddress}</td>
                <td>{customer.address}</td>
                <td>{customer.businessPhone}</td>
                <td>{customer.businessFax}</td>
                <td>{customer.financialAccount}</td>
                <td>{customer.invoiceType}</td>
                <td>{customer.vat}</td>
                <td>{customer.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CreatePreviewCustomers;
