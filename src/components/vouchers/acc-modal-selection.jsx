import React, { useEffect, useRef, useState } from "react";
import "./acc-modal-selection.css";

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const [data, setData] = useState([]);
  const [filteredTree, setFilteredTree] = useState([]); // tree data (for non-search mode)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null); // flat rows from API when searching
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // for debounced search + abort in-flight fetch
  const searchAbortRef = useRef(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) fetchAccounts();
    // cleanup on close
    return () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${baseUrl}/accounts/v1/acc-arranged`);
      if (!res.ok) throw new Error("Failed to fetch accounts data");
      const combinedData = await res.json();
      setData(combinedData);
      setFilteredTree(combinedData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // Tree renderer (no change)
  const renderAccounts = (accounts, parentNumber = null, level = 0) => {
    const children = accounts.filter(
      (a) => a.parentNumber === parentNumber
    );
    children.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    return children.flatMap((account) => {
      const parentRow = (
        <tr
          key={account.id}
          className="acc-modal-selection-row"
          onClick={() => onSelect({ ...account, entityType: "account" })}
        >
          <td className="acc-modal-selection-cell" style={{ paddingLeft: `${level * 20}px` }}>
            {account.accountNumber}
          </td>
          <td className="acc-modal-selection-cell">{account.accountName}</td>
          <td
            className="acc-modal-selection-cell arabic-text"
            style={{ textAlign: "right", direction: "rtl" }}
          >
            {account.arabicAccountName || "N/A"}
          </td>
        </tr>
      );

      const childrenRows = renderAccounts(accounts, account.accountNumber, level + 1);

      let additionalRows = [];
      if (account.accountNumber === "4111" && account.children?.length) {
        additionalRows = account.children.map((customer) => (
          <tr
            key={`customer-${customer.id}`}
            className="acc-modal-selection-row"
            onClick={() => onSelect({ ...customer, entityType: "customer" })}
          >
            <td className="acc-modal-selection-cell" style={{ paddingLeft: `${(level + 1) * 20}px` }}>
              {customer.accountNumber}
            </td>
            <td className="acc-modal-selection-cell">{customer.accountName}</td>
            <td
              className="acc-modal-selection-cell arabic-text"
              style={{ textAlign: "right", direction: "rtl" }}
            >
              {customer.arabicAccountName || "N/A"}
            </td>
          </tr>
        ));
      }

      if (account.accountNumber === "4011" && account.children?.length) {
        additionalRows = account.children.map((supplier) => (
          <tr
            key={`supplier-${supplier.id}`}
            className="acc-modal-selection-row"
            onClick={() => onSelect({ ...supplier, entityType: "supplier" })}
          >
            <td className="acc-modal-selection-cell" style={{ paddingLeft: `${(level + 1) * 20}px` }}>
              {supplier.accountNumber}
            </td>
            <td className="acc-modal-selection-cell">{supplier.accountName}</td>
            <td
              className="acc-modal-selection-cell arabic-text"
              style={{ textAlign: "right", direction: "rtl" }}
            >
              {supplier.arabicAccountName || "N/A"}
            </td>
          </tr>
        ));
      }

      return [parentRow, ...childrenRows, ...additionalRows];
    });
  };

  // Flat renderer for search results from the API
  const renderSearchRows = (rows) => {
    // rows are: { id, accountNumber, accountName, kind, parentAccountNumber? }
    return rows.map((r) => (
      <tr
        key={`${r.kind}-${r.id}`}
        className="acc-modal-selection-row"
        onClick={() => onSelect({ ...r, entityType: r.kind })}
      >
        <td className="acc-modal-selection-cell">{r.accountNumber}</td>
        <td className="acc-modal-selection-cell">
          {r.accountName}
          <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>
            {r.kind === "customer" ? " (Customer)" : r.kind === "supplier" ? " (Supplier)" : ""}
          </span>
        </td>
        <td
          className="acc-modal-selection-cell arabic-text"
          style={{ textAlign: "right", direction: "rtl" }}
        >
          {/* Search API doesn't send Arabic name; show dash to keep columns aligned */}
          —
        </td>
      </tr>
    ));
  };

  // ─────────────────────────────────────────────────────────────
  // Search input
  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);

    // Local quick filter to keep tree responsive for very short input
    const ql = q.trim().toLowerCase();
    if (!ql) {
      // back to full tree
      setSearchResults(null);
      setFilteredTree(data);
      return;
    }

    // Quick client-side filtering of the tree while we debounce server call
    const quick = data.filter((a) => {
      const n = a.accountNumber?.toLowerCase() || "";
      const en = a.accountName?.toLowerCase() || "";
      const ar = a.arabicAccountName?.toLowerCase() || "";
      return n.includes(ql) || en.includes(ql) || ar.includes(ql);
    });
    setFilteredTree(quick);

    // Debounced server search after 2+ chars
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (ql.length < 2) {
      setSearchResults(null);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setSearching(true);
      try {
        const url = new URL(`${baseUrl}/accounts/v1/jv/search`);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", "100");

        const res = await fetch(url.toString(), { signal: controller.signal });
        if (!res.ok) throw new Error("Search request failed");
        const json = await res.json();
        // Expecting { data: UnifiedRow[], page, limit, total }
        const rows = Array.isArray(json?.data) ? json.data : [];
        setSearchResults(rows);
      } catch (err) {
        if (err.name !== "AbortError") {
          console.warn("search error:", err);
          // keep showing quick filtered tree if API fails
          setSearchResults(null);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  return (
    isOpen && (
      <div className="acc-modal-selection-overlay">
        <div className="acc-modal-selection-container">
          <div className="acc-modal-selection-header">
            <h2>Select an Account</h2>
            <button className="acc-modal-selection-close-btn" onClick={onClose}>
              &times;
            </button>
          </div>

          <div className="acc-modal-selection-body">
            {loading && <p>Loading accounts...</p>}
            {error && <p className="error">{error}</p>}

            {!loading && !error && (
              <div className="acc-modal-selection-table-wrapper">
                <input
                  type="text"
                  className="acc-modal-selection-search-input"
                  placeholder="Search by Account Number, Name, or Arabic Name..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />

                {searching && (
                  <div style={{ padding: "6px 0", fontSize: 12, opacity: 0.7 }}>
                    Searching…
                  </div>
                )}

                <table className="acc-modal-selection-table">
                  <thead>
                    <tr>
                      <th>Account Number</th>
                      <th>Account Name</th>
                      <th>Arabic Account Name</th>
                    </tr>
                  </thead>

                  <tbody>
                    {/* If we have API search results, show them flat.
                        Otherwise, show the (possibly quick-filtered) tree. */}
                    {searchResults
                      ? renderSearchRows(searchResults)
                      : renderAccounts(filteredTree)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  );
};

export default AccountSelectionModal;
