import React, { useEffect, useState } from "react";
import "./suppliers.css";
import { FaEdit, FaTrash } from "react-icons/fa";

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    contact: "",
    email: "",
    address: "",
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    // Fetch suppliers from API
    const response = await fetch("/api/suppliers");
    const data = await response.json();
    setSuppliers(data);
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? `/api/suppliers/${form.id}` : "/api/suppliers";

    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    fetchSuppliers();
    resetForm();
  };

  const handleEdit = (supplier) => {
    setIsEditing(true);
    setForm(supplier);
  };

  const handleDelete = async (id) => {
    await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
    fetchSuppliers();
  };

  const resetForm = () => {
    setForm({ id: null, name: "", contact: "", email: "", address: "" });
    setIsEditing(false);
  };

  return (
    <div className="suppliers-container">
      <div className="header">
        <h2>{isEditing ? "Edit Supplier" : "Create Supplier"}</h2>
        <button onClick={resetForm} className="reset-button">
          {isEditing ? "Cancel" : "Reset"}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="supplier-form">
        <label>
          Name
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleFormChange}
            required
          />
        </label>
        <label>
          Contact
          <input
            type="text"
            name="contact"
            value={form.contact}
            onChange={handleFormChange}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleFormChange}
            required
          />
        </label>
        <label>
          Address
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleFormChange}
          />
        </label>
        <button type="submit" className="submit-button">
          {isEditing ? "Update Supplier" : "Add Supplier"}
        </button>
      </form>

      <table className="suppliers-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.contact}</td>
              <td>{supplier.email}</td>
              <td>{supplier.address}</td>
              <td>
                <button
                  onClick={() => handleEdit(supplier)}
                  className="edit-button"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDelete(supplier.id)}
                  className="delete-button"
                >
                  <FaTrash />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SuppliersPage;
