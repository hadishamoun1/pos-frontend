import React, { useState, useEffect } from "react";
import "./suppliersModal.css";
import { axiosClient } from "../api/axiosClient"; // ✅ added

const SupplierModal = ({ onClose, onSelectSupplier }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    // Fetch suppliers from API
    const fetchSuppliers = async () => {
      try {
        const res = await axiosClient.get(`${baseUrl}/suppliers/v1/filtered`);
        setSuppliers(res.data || []);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    fetchSuppliers();
  }, []);

  // Filter suppliers based on search query
  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="supplier-modal-overlay" onClick={onClose}>
      <div
        className="supplier-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="supplier-modal-header">
          <h3>Select Supplier</h3>
          <button className="supplier-modal-close" onClick={onClose}>
            close
          </button>
        </div>
        <input
          type="text"
          className="supplier-modal-search"
          placeholder="Search supplier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <table className="supplier-modal-table">
          <thead>
            <tr>
              <th>Supplier Name</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier) => (
              <tr
                key={supplier.id}
                onClick={() => onSelectSupplier(supplier.supplierName)}
              >
                <td>{supplier.supplierName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SupplierModal;
