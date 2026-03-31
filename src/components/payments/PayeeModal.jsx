import React, { useState, useEffect } from "react";
import "./PayeeModal.css";
import { axiosClient } from "../api/axiosClient";

const PayeeModal = ({ onClose, onSelectPayee }) => {
  const [activeTab, setActiveTab] = useState("supplier");
  const [searchQuery, setSearchQuery] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [suppRes, accRes] = await Promise.all([
          axiosClient.get("/suppliers/v1/filtered"),
          axiosClient.get("/accounts/v1/payee-list"),
        ]);
        setSuppliers(suppRes.data || []);
        setAccounts(accRes.data || []);
      } catch (error) {
        console.error("Error fetching payee data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filteredSuppliers = suppliers.filter((s) =>
    (s.supplierName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAccounts = accounts.filter((a) =>
    `${a.accountNumber} ${a.accountName}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchQuery("");
  };

  const currentCount =
    activeTab === "supplier" ? filteredSuppliers.length : filteredAccounts.length;

  return (
    <div className="payee-overlay" onClick={onClose}>
      <div className="payee-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="payee-header">
          <div className="payee-header-left">
            <span className="payee-header-icon">💳</span>
            <h2 className="payee-header-title">Select Payee</h2>
          </div>
          <button className="payee-close-btn" onClick={onClose} title="Close">✕</button>
        </div>

        {/* Tabs */}
        <div className="payee-tabs">
          <button
            className={`payee-tab ${activeTab === "supplier" ? "active" : ""}`}
            onClick={() => handleTabChange("supplier")}
          >
            Suppliers
            <span className="payee-tab-badge">{suppliers.length}</span>
          </button>
          <button
            className={`payee-tab ${activeTab === "account" ? "active" : ""}`}
            onClick={() => handleTabChange("account")}
          >
            Accounts
            <span className="payee-tab-badge">{accounts.length}</span>
          </button>
        </div>

        {/* Search */}
        <div className="payee-search-wrapper">
          <span className="payee-search-icon">🔍</span>
          <input
            type="text"
            className="payee-search-input"
            placeholder={
              activeTab === "supplier"
                ? "Search by supplier name…"
                : "Search by account number or name…"
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <button className="payee-search-clear" onClick={() => setSearchQuery("")}>✕</button>
          )}
        </div>

        {/* Results info */}
        <div className="payee-results-info">
          {searchQuery
            ? `${currentCount} result${currentCount !== 1 ? "s" : ""} for "${searchQuery}"`
            : `${currentCount} ${activeTab === "supplier" ? "supplier" : "account"}${currentCount !== 1 ? "s" : ""}`}
        </div>

        {/* Table */}
        <div className="payee-table-wrapper">
          {loading ? (
            <div className="payee-empty-state">Loading…</div>
          ) : activeTab === "supplier" ? (
            filteredSuppliers.length === 0 ? (
              <div className="payee-empty-state">
                {searchQuery ? "No suppliers match your search." : "No suppliers available."}
              </div>
            ) : (
              <table className="payee-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Supplier Name</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map((s, i) => (
                    <tr
                      key={s.id}
                      onClick={() =>
                        onSelectPayee({
                          type: "supplier",
                          id: s.id,
                          displayName: s.supplierName,
                        })
                      }
                    >
                      <td className="payee-row-index">{i + 1}</td>
                      <td>{s.supplierName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : filteredAccounts.length === 0 ? (
            <div className="payee-empty-state">
              {searchQuery ? "No accounts match your search." : "No accounts available."}
            </div>
          ) : (
            <table className="payee-table">
              <thead>
                <tr>
                  <th>Account #</th>
                  <th>Account Name</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() =>
                      onSelectPayee({
                        type: "account",
                        id: a.id,
                        displayName: `${a.accountNumber} - ${a.accountName}`,
                      })
                    }
                  >
                    <td className="payee-account-number">{a.accountNumber}</td>
                    <td>{a.accountName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
};

export default PayeeModal;
