import React, { useState, useEffect } from "react";
import "./suppliers.css";
import { axiosClient } from "../api/axiosClient";
import { useTranslation } from "../hooks/useTranslation";

const CreatePreviewSuppliers = () => {
  const { t } = useTranslation();

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
  const [modalType, setModalType] = useState(""); // success | error

  // Fetch currency codes
  useEffect(() => {
    const fetchCurrencyCodes = async () => {
      try {
        const response = await axiosClient.get("/currency/v1/dropdown/currencycodes");
        setCurrencyCodes(response.data || []);
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
      const response = await axiosClient.get("/suppliers/v1/paginated", {
        params: { page: currentPage, limit: 50 },
      });

      const list = Array.isArray(response?.data?.suppliers) ? response.data.suppliers : [];

      setSuppliers((prevSuppliers) => {
        const newSuppliers = list.filter(
          (newSupplier) => !prevSuppliers.some((p) => p.id === newSupplier.id)
        );
        return [...prevSuppliers, ...newSuppliers];
      });

      setHasMore(list.length > 0);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSuppliers(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load more
  const nextPage = () => {
    setPage((prevPage) => {
      const newPage = prevPage + 1;
      fetchSuppliers(newPage);
      return newPage;
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
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

      const response = await axiosClient.post("/suppliers", newSupplier);

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

      setModalType("success");
      setModalContent(true);
    } catch (error) {
      console.error("Error adding supplier:", error);
      setModalType("error");
      setModalContent(true);
    }
  };

  const closeModal = () => setModalContent(false);

  return (
    <div className="suppliers-container">
      <h2 className="suppliers-heading">{t("suppliersPage.title")}</h2>

      {/* Input Form */}
      <div className="suppliers-form">
        <table>
          <tbody>
            <tr>
              <td>
                <label>{t("suppliersPage.form.supplierName")}</label>
                <input
                  type="text"
                  name="supplierName"
                  value={formData.supplierName}
                  onChange={handleInputChange}
                />
              </td>

              <td>
                <label>{t("suppliersPage.form.phoneNumber")}</label>
                <input
                  type="text"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                />
              </td>

              <td>
                <label>{t("suppliersPage.form.financialAccount")}</label>
                <input
                  type="text"
                  name="financialAccount"
                  value={formData.financialAccount}
                  onChange={handleInputChange}
                />
              </td>

              <td>
                <label>{t("suppliersPage.form.invoiceType")}</label>
                <select
                  name="invoiceType"
                  value={formData.invoiceType}
                  onChange={handleInputChange}
                >
                  <option value="">{t("suppliersPage.form.selectType")}</option>
                  <option value="S">S</option>
                  <option value="G">G</option>
                </select>
              </td>
            </tr>

            <tr>
              <td>
                <label>{t("suppliersPage.form.vat")}</label>
                <select name="vat" value={formData.vat} onChange={handleInputChange}>
                  <option value="">{t("suppliersPage.form.selectVat")}</option>
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                </select>
              </td>

              <td>
                <label>{t("suppliersPage.form.currency")}</label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                >
                  <option value="">{t("suppliersPage.form.selectCurrency")}</option>
                  {currencyCodes.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.currencyCode}
                    </option>
                  ))}
                </select>
              </td>

              <td>
                <label>{t("suppliersPage.form.address")}</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                />
              </td>

              <td>
                <label>{t("suppliersPage.form.location")}</label>
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
                <button className="add-supplier-btn" onClick={handleAddSupplier}>
                  {t("suppliersPage.buttons.addSupplier")}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Preview Table */}
      <div className="suppliers-preview">
        <h3 className="suppliers-preview-heading">{t("suppliersPage.previewTitle")}</h3>

        <table className="suppliers-table">
          <thead>
            <tr>
              <th>{t("suppliersPage.table.supplierAccountNumber")}</th>
              <th>{t("suppliersPage.table.supplierName")}</th>
              <th>{t("suppliersPage.table.phoneNumber")}</th>
              <th>{t("suppliersPage.table.financialAccount")}</th>
              <th>{t("suppliersPage.table.invoiceType")}</th>
              <th>{t("suppliersPage.table.vat")}</th>
              <th>{t("suppliersPage.table.currency")}</th>
              <th>{t("suppliersPage.table.address")}</th>
              <th>{t("suppliersPage.table.location")}</th>
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
                <td>{supplier.vat ? `${supplier.vat}%` : ""}</td>
                <td>{supplier.currencyCode}</td>
                <td>{supplier.address}</td>
                <td>{supplier.location}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {hasMore && !loading && (
          <button className="load-more-suppliers-btn" onClick={nextPage}>
            {t("suppliersPage.buttons.loadMore")}
          </button>
        )}

        {loading && <p>{t("common.loading")}</p>}
        {!hasMore && <p>{t("suppliersPage.messages.noMoreSuppliers")}</p>}
      </div>

      {/* Modal */}
      {modalContent && (
        <div className="modal">
          <div
            className={`suppliers-modal-content ${
              modalType === "success" ? "success-modal" : "error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="modal-success-text">
                  {t("suppliersPage.messages.supplierAdded")}
                </h2>
                <div className="modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="modal-error-text">
                  {t("suppliersPage.messages.failedAddSupplier")}
                </h2>
                <div className="modal-icon">✖</div>
              </>
            )}

            <button className="modal-button" onClick={closeModal}>
              {t("common.ok")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreatePreviewSuppliers;
