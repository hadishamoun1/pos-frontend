import React, { useEffect, useMemo, useRef, useState } from "react";
import "./acc-modal-selection.css";
import { axiosClient } from "../api/axiosClient"; // ✅ baseURL = /api

const AccountSelectionModal = ({ isOpen, onClose, onSelect }) => {
  const [data, setData] = useState([]);
  const [filteredTree, setFilteredTree] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [filtering, setFiltering] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const filterDebounceRef = useRef(null);

  useEffect(() => {
    if (isOpen) fetchAccounts();

    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axiosClient.get(`/accounts/v1/acc-arranged`);
      const combinedData = res.data;

      setData(combinedData);
      setFilteredTree(combinedData);

      setSearchQuery("");
      setSearchResults(null);
    } catch (e) {
      setError(
        e?.response?.data?.message ||
          e.message ||
          "Failed to fetch accounts data"
      );
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ✅ Detect entity type from child flags (NO hardcoded parent numbers)
  const detectKind = (child) => {
    if (child?.isCustomer) return "customer";
    if (child?.isSupplier) return "supplier";
    return "account"; // fallback
  };

  // ─────────────────────────────────────────────────────────────
  // Build a local flat index (accounts + children)
  const flatIndex = useMemo(() => {
    const out = [];

    (data || []).forEach((a) => {
      out.push({
        id: a.id,
        accountNumber: a.accountNumber,
        accountName: a.accountName,
        arabicAccountName: a.arabicAccountName,
        kind: "account",
      });

      // ✅ add any children (customers / suppliers / whatever)
      if (Array.isArray(a.children) && a.children.length) {
        a.children.forEach((ch) => {
          const kind = detectKind(ch);

          out.push({
            id: ch.id,
            accountNumber: ch.accountNumber,
            accountName: ch.accountName,
            arabicAccountName: ch.arabicAccountName, // may not exist on child (OK)
            kind,
            parentAccountNumber: a.accountNumber,
          });
        });
      }
    });

    return out;
  }, [data]);

  // Pre-normalize for fast filtering
  const indexed = useMemo(() => {
    const normText = (v) =>
      String(v ?? "").toLowerCase().trim().replace(/\s+/g, " ");

    const normNum = (v) =>
      String(v ?? "").toLowerCase().replace(/[^0-9a-z]/g, "");

    return (flatIndex || []).map((r) => {
      const n = String(r.accountNumber ?? "");
      const name = String(r.accountName ?? "");
      const ar = String(r.arabicAccountName ?? "");

      return {
        ...r,
        _num: normNum(n),
        _name: normText(name),
        _ar: normText(ar),
      };
    });
  }, [flatIndex]);

  // ─────────────────────────────────────────────────────────────
  // Debounced local search
  useEffect(() => {
    if (!isOpen) return;

    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);

    const q = String(searchQuery ?? "").trim();
    if (!q) {
      setFiltering(false);
      setSearchResults(null);
      setFilteredTree(data);
      return;
    }

    setFiltering(true);

    filterDebounceRef.current = setTimeout(() => {
      const normText = (v) =>
        String(v ?? "").toLowerCase().trim().replace(/\s+/g, " ");

      const normNum = (v) =>
        String(v ?? "").toLowerCase().replace(/[^0-9a-z]/g, "");

      const qText = normText(q);
      const qNum = normNum(q);

      const tokens = qText.split(" ").filter(Boolean);

      const matches = indexed.filter((r) => {
        const hitNum = qNum ? r._num.includes(qNum) : false;
        const hitName = tokens.every((t) => r._name.includes(t));
        const hitAr = tokens.every((t) => r._ar.includes(t));
        return hitNum || hitName || hitAr;
      });

      const rank = (r) => {
        const num = r._num;
        const name = r._name;

        if (qNum && num === qNum) return 0;
        if (qNum && num.startsWith(qNum)) return 1;
        if (qNum && num.includes(qNum)) return 2;

        if (name.startsWith(qText)) return 3;
        if (name.includes(qText)) return 4;

        return 9;
      };

      matches.sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return String(a.accountNumber || "").localeCompare(
          String(b.accountNumber || "")
        );
      });

      setSearchResults(matches.slice(0, 300));

      // quick tree filter
      const quickTree = (data || []).filter((a) => {
        const n = String(a.accountNumber || "").toLowerCase();
        const en = String(a.accountName || "").toLowerCase();
        return n.includes(qText) || en.includes(qText);
      });
      setFilteredTree(quickTree);

      setFiltering(false);
    }, 120);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, indexed, data, isOpen]);

  // ─────────────────────────────────────────────────────────────
  // Tree renderer
  const renderAccounts = (accounts, parentNumber = null, level = 0) => {
    const children = accounts.filter((a) => a.parentNumber === parentNumber);
    children.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

    return children.flatMap((account) => {
      const parentRow = (
        <tr
          key={account.id}
          className="acc-modal-selection-row"
          onClick={() => onSelect({ ...account, entityType: "account" })}
        >
          <td
            className="acc-modal-selection-cell"
            style={{ paddingLeft: `${level * 20}px` }}
          >
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

      const childrenRows = renderAccounts(
        accounts,
        account.accountNumber,
        level + 1
      );

      let additionalRows = [];

      // ✅ show children based on flags (customer/supplier)
      if (account.children?.length) {
        additionalRows = account.children.map((ch) => {
          const kind = detectKind(ch);

          return (
            <tr
              key={`${kind}-${ch.id}`}
              className="acc-modal-selection-row"
              onClick={() => onSelect({ ...ch, entityType: kind })}
            >
              <td
                className="acc-modal-selection-cell"
                style={{ paddingLeft: `${(level + 1) * 20}px` }}
              >
                {ch.accountNumber}
              </td>
              <td className="acc-modal-selection-cell">{ch.accountName}</td>
              <td
                className="acc-modal-selection-cell arabic-text"
                style={{ textAlign: "right", direction: "rtl" }}
              >
                {ch.arabicAccountName || "N/A"}
              </td>
            </tr>
          );
        });
      }

      return [parentRow, ...childrenRows, ...additionalRows];
    });
  };

  // Flat renderer for search results
  const renderSearchRows = (rows) =>
    rows.map((r) => (
      <tr
        key={`${r.kind}-${r.id}`}
        className="acc-modal-selection-row"
        onClick={() => onSelect({ ...r, entityType: r.kind })}
      >
        <td className="acc-modal-selection-cell">{r.accountNumber}</td>
        <td className="acc-modal-selection-cell">
          {r.accountName}
          <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 12 }}>
            {r.kind === "customer"
              ? " (Customer)"
              : r.kind === "supplier"
              ? " (Supplier)"
              : ""}
          </span>
        </td>
        <td
          className="acc-modal-selection-cell arabic-text"
          style={{ textAlign: "right", direction: "rtl" }}
        >
          {r.arabicAccountName || "—"}
        </td>
      </tr>
    ));

  const handleSearchChange = (e) => setSearchQuery(e.target.value);

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
                  placeholder="Search by Account Number or Account Name..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />

                {filtering && (
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
