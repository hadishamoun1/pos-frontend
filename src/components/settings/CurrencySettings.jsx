import React, { useEffect, useState } from "react";
import "./styles/CurrencySettings.css";

const CurrencySettings = () => {
  const [currencies, setCurrencies] = useState([]);
  const [formData, setFormData] = useState({
    currencyCode: "",
    currencyName: "",
  });
  const [editingCode, setEditingCode] = useState(null); // if not null → we are editing
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const rawBase = process.env.REACT_APP_API_BASE_URL || "";
  const baseUrl = rawBase.replace(/\/+$/, "");

  const clearMessages = () => {
    setStatusMsg("");
    setErrorMsg("");
  };

  // Fetch all currencies
  const fetchCurrencies = async () => {
    try {
      clearMessages();
      const res = await fetch(`${baseUrl}/currency`);
      if (!res.ok) {
        throw new Error(`Failed to fetch currencies (status ${res.status})`);
      }
      const data = await res.json();
      setCurrencies(data || []);
    } catch (err) {
      console.error("Error fetching currencies:", err);
      setErrorMsg("Failed to load currencies.");
    }
  };

  useEffect(() => {
    fetchCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData({
      currencyCode: "",
      currencyName: "",
    });
    setEditingCode(null);
  };

  // Create or update currency
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();

    const { currencyCode, currencyName } = formData;

    if (!currencyCode.trim()) {
      setErrorMsg("Currency code is required.");
      return;
    }

    try {
      setLoading(true);

      if (editingCode) {
        // UPDATE
        const res = await fetch(
          `${baseUrl}/currency/${encodeURIComponent(editingCode)}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currencyName: currencyName || "",
              currencyCode: currencyCode, // you can allow changing code or not
            }),
          }
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to update currency.");
        }

        const updated = await res.json();
        setStatusMsg(`Currency ${updated.currencyCode} updated successfully.`);
      } else {
        // CREATE
        const res = await fetch(`${baseUrl}/currency`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currencyCode: currencyCode,
            currencyName: currencyName || "",
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to create currency.");
        }

        const created = await res.json();
        setStatusMsg(`Currency ${created.currencyCode} created successfully.`);
      }

      resetForm();
      fetchCurrencies();
    } catch (err) {
      console.error("Error saving currency:", err);
      setErrorMsg(err.message || "Error occurred while saving currency.");
    } finally {
      setLoading(false);
    }
  };

  // Edit button → load data into form
  const handleEdit = (currency) => {
    clearMessages();
    setEditingCode(currency.currencyCode);
    setFormData({
      currencyCode: currency.currencyCode || "",
      currencyName: currency.currencyName || "",
    });
  };

  // Delete currency
  const handleDelete = async (currency) => {
    clearMessages();
    if (
      !window.confirm(
        `Are you sure you want to delete currency ${currency.currencyCode}?`
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `${baseUrl}/currency/${encodeURIComponent(currency.currencyCode)}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete currency.");
      }

      setStatusMsg(`Currency ${currency.currencyCode} deleted successfully.`);
      fetchCurrencies();
      if (editingCode === currency.currencyCode) {
        resetForm();
      }
    } catch (err) {
      console.error("Error deleting currency:", err);
      setErrorMsg(err.message || "Error occurred while deleting currency.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setting-currency-container">
      <h2 className="setting-currency-title">Currency Settings</h2>

      <div className="setting-currency-layout">
        {/* LEFT: Form */}
        <div className="setting-currency-card setting-currency-card-form">
          <h3 className="setting-currency-card-title">
            {editingCode ? "Edit Currency" : "Create Currency"}
          </h3>
          <form className="setting-currency-form" onSubmit={handleSubmit}>
            <label className="setting-currency-label">
              Currency Code:
              <input
                type="text"
                name="currencyCode"
                className="setting-currency-input"
                placeholder="Example: USD, LBP"
                value={formData.currencyCode}
                onChange={handleInputChange}
              />
            </label>

            <label className="setting-currency-label">
              Currency Name:
              <input
                type="text"
                name="currencyName"
                className="setting-currency-input"
                placeholder="Example: US Dollar, Lebanese Pound"
                value={formData.currencyName}
                onChange={handleInputChange}
              />
            </label>

            <div className="setting-currency-actions">
              <button
                type="submit"
                className="setting-currency-button"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : editingCode
                  ? "Update Currency"
                  : "Create Currency"}
              </button>
              {editingCode && (
                <button
                  type="button"
                  className="setting-currency-button setting-currency-button-secondary"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>

        {/* RIGHT: List */}
        <div className="setting-currency-card setting-currency-card-list">
          <h3 className="setting-currency-card-title">Currencies List</h3>
          {currencies.length === 0 ? (
            <p className="setting-currency-empty">No currencies found.</p>
          ) : (
            <div className="setting-currency-table-wrapper">
              <table className="setting-currency-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((cur) => (
                    <tr key={cur.id}>
                      <td>{cur.id}</td>
                      <td>{cur.currencyCode}</td>
                      <td>{cur.currencyName || ""}</td>
                      <td>
                        <button
                          type="button"
                          className="setting-currency-action-btn"
                          onClick={() => handleEdit(cur)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="setting-currency-action-btn setting-currency-action-btn-danger"
                          onClick={() => handleDelete(cur)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {(statusMsg || errorMsg) && (
        <div
          className={`setting-currency-message ${
            errorMsg
              ? "setting-currency-message-error"
              : "setting-currency-message-ok"
          }`}
        >
          {errorMsg || statusMsg}
        </div>
      )}
    </div>
  );
};

export default CurrencySettings;
