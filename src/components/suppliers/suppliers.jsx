import React, { useEffect, useState } from "react";
import "./suppliers.css";
import { FaEdit, FaTrash } from "react-icons/fa";

const SuppliersPage = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    id: null,
    name: "",
    contactInfo: "",
    address: "",
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await fetch("http://localhost:3000/suppliers");
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      } else {
        console.error("Error fetching suppliers:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    }
  };

  const handleFormChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value || "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = isEditing ? "PUT" : "POST";
    const url = isEditing
      ? `http://localhost:3000/suppliers/${form.id}`
      : "http://localhost:3000/suppliers";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        fetchSuppliers();
        resetForm();
      } else {
        console.error("Error submitting form:", response.statusText);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  const handleEdit = (supplier) => {
    setIsEditing(true);
    setForm({
      id: supplier.id || null,
      name: supplier.name || "",
      contactInfo: supplier.contactInfo || "",
      address: supplier.address || "",
    });
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`http://localhost:3000/suppliers/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        fetchSuppliers();
      } else {
        console.error("Error deleting supplier:", response.statusText);
      }
    } catch (error) {
      console.error("Error deleting supplier:", error);
    }
  };

  const resetForm = () => {
    setForm({ id: null, name: "", contactInfo: "", address: "" });
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
            value={form.name || ""}
            onChange={handleFormChange}
            required
          />
        </label>
        <label>
          Contact Info
          <input
            type="text"
            name="contactInfo"
            value={form.contactInfo || ""}
            onChange={handleFormChange}
            required
          />
        </label>
        <label>
          Address
          <input
            type="text"
            name="address"
            value={form.address || ""}
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
            <th>Contact Info</th>
            <th>Address</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {suppliers.map((supplier) => (
            <tr key={supplier.id}>
              <td>{supplier.name}</td>
              <td>{supplier.contactInfo}</td>
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
