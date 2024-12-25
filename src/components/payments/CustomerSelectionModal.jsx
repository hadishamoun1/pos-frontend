import React, { useEffect, useState } from "react";
import "./CustomerSelectionModal.css";

const CustomerSelectionModal = ({ onClose, onSelectCustomer }) => {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch(
          "http://localhost:3000/customers/v1/basic-details"
        );
        const data = await response.json();
        setCustomers(data);
        setFilteredCustomers(data); // Initialize filtered list
      } catch (error) {
        console.error("Error fetching customers:", error);
      }
    };

    fetchCustomers();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value.toLowerCase();
    setSearchTerm(value);

    const filtered = customers.filter((customer) =>
      customer.customerName.toLowerCase().includes(value)
    );
    setFilteredCustomers(filtered);
  };

  const handleCustomerClick = (customerName) => {
    onSelectCustomer(customerName);
    onClose();
  };

  return (
    <div className="customer-unique-selection-overlay">
      <div className="customer-unique-selection-modal-content">
        <div className="customer-unique-selection-modal-header">
          <h2>Select Customer</h2>
          <button type="button" className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
        {/* Search Bar */}
        <div className="customer-unique-selection-search">
          <input
            type="text"
            placeholder="Search customer..."
            value={searchTerm}
            onChange={handleSearch}
          />
        </div>
        <table className="customer-unique-selection-modal-table">
          <thead>
            <tr>
              <th>Customer Name</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.map((customer) => (
              <tr
                key={customer.id}
                onDoubleClick={() => handleCustomerClick(customer.customerName)}
              >
                <td>{customer.customerName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CustomerSelectionModal;
