import React, { useState, useEffect } from "react";
import axios from "axios";
import "./suppliers.css";

const CreatePreviewSuppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [currencyCodes, setCurrencyCodes] = useState([]);
  const [formData, setFormData] = useState({
    supplierName: "",
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

  // Fetch suppliers from the API
  const fetchSuppliers = async (currentPage) => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      console.log(`Fetching suppliers for page ${currentPage}`);
      const response = await axios.get(
        `http://localhost:3000/suppliers/v1/paginated?page=${currentPage}&limit=50`
      );

      setSuppliers((prevSuppliers) => {
        const newSuppliers = response.data.suppliers.filter(
          (newSupplier) =>
            !prevSuppliers.some(
              (existingSupplier) => existingSupplier.id === newSupplier.id
            )
        );
        return [...prevSuppliers, ...newSuppliers];
      });

      setHasMore(response.data.suppliers.length > 0);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Controlled page increment
  const nextPage = () => {
    setPage((prevPage) => {
      const newPage = prevPage + 1;
      fetchSuppliers(newPage);
      return newPage;
    });
  };

  // Initial fetch for the first page of suppliers
  useEffect(() => {
    fetchSuppliers(page);
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleAddSupplier = async () => {
    try {
      const newSupplier = {
        supplierName: formData.supplierName,
        phoneNumber: formData.phoneNumber,
        financialNumber: formData.financialAccount,
        invoiceType: formData.invoiceType,
        vat: formData.vat,
        currencyId: formData.currency,
        address: formData.address,
        location: formData.location,
      };

      const response = await axios.post(
        "http://localhost:3000/suppliers",
        newSupplier
      );

      setSuppliers((prevSuppliers) => [...prevSuppliers, response.data]);
      setFormData({
        supplierName: "",
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
      console.error("Error adding supplier:", error);

      // Show error modal
      setModalType("error");
      setModalContent(true);
    }
  };

  const closeModal = () => setModalContent(false);

  return (
    <div className="suppliers-container">
      <h2 className="suppliers-heading">Create and Preview Suppliers</h2>

      {/* Input Form */}
      <div className="suppliers-form">
        <table>
          <tbody>
            <tr>
              <td>
                <label>Supplier Name</label>
                <input
                  type="text"
                  name="supplierName"
                  value={formData.supplierName}
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
                  className="add-supplier-btn"
                  onClick={handleAddSupplier}
                >
                  Add Supplier
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Preview Table */}
      <div className="suppliers-preview">
        <h3 className="suppliers-preview-heading">Supplier Preview</h3>
        <table className="suppliers-table">
          <thead>
            <tr>
              <th>Supplier Account Number</th>
              <th>Supplier Name</th>
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
            {suppliers.map((supplier, index) => (
              <tr key={supplier.id || index}>
                <td>{supplier.supplierAccountNumber}</td>
                <td>{supplier.supplierName}</td>
                <td>{supplier.phoneNumber}</td>
                <td>{supplier.financialNumber}</td>
                <td>{supplier.invoiceType}</td>
                <td>{supplier.vat}%</td>
                <td>{supplier.currencyCode}</td>
                <td>{supplier.address}</td>
                <td>{supplier.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && !loading && (
          <button className="load-more-suppliers-btn" onClick={nextPage}>
            Load More
          </button>
        )}
        {loading && <p>Loading...</p>}
        {!hasMore && <p>No more suppliers to load</p>}
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
                  Supplier Added Successfully
                </h2>
                <div className="modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="modal-error-text">Failed to Add Supplier</h2>
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

export default CreatePreviewSuppliers;
