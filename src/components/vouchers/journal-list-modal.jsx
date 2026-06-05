import React from "react";
import "./journal-list-modal.css";
import PermGate from "../auth/PermGate";

const kindLabel = (k) => {
  const x = String(k || "").toUpperCase();
  if (x === "INVOICE") return "فاتورة";
  if (x === "RECEIVABLE") return "دفعة";
  if (x === "PURCHASE") return "فاتورة شراء";
  if (x === "PURCHASE_RETURN") return "مرتجع شراء";
  return "JV";
};

const kindOptionLabel = (k) => {
  const x = String(k || "").toUpperCase();
  if (x === "INVOICE") return "فاتورة";
  if (x === "RECEIVABLE") return "دفعة";
  if (x === "JV") return "قيد يومي";
  if (x === "PURCHASE") return "فاتورة شراء";
  if (x === "PURCHASE_RETURN") return "مرتجع شراء";
  return x || "الكل";
};

const JournalListsModal = ({
  isOpen,
  onClose,
  journalData,

  onView,
  onDelete,

  // pagination
  onLoadMore,
  hasMore,
  loadingMore,

  // search props (seq)
  searchSeq,
  onSearchSeqChange,

  // text search
  searchText,
  onSearchTextChange,

  // type filter
  kindFilter,
  onKindFilterChange,

  // OPTIONAL: force search on Enter (provided by parent)
  onSearchNow,
}) => {
  if (!isOpen) return null;

  const handleEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSearchNow?.();
    }
  };

  return (
    <div className="journal-list-modal-overlay">
      <div className="journal-list-modal">
        <div className="journal-list-header">
          <h2>Journal Lists</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="journal-list-body">
          <div className="journal-list-controls">
            <input
              type="text"
              value={searchSeq || ""}
              onChange={(e) => onSearchSeqChange?.(e.target.value)}
              onKeyDown={handleEnter}
              placeholder="Search by trailing number… e.g. 3 or 003 or 25"
              className="journal-list-search"
              inputMode="numeric"
            />

            <input
              type="text"
              value={searchText || ""}
              onChange={(e) => onSearchTextChange?.(e.target.value)}
              onKeyDown={handleEnter}
              placeholder="Search by customer / supplier / account name or number…"
              className="journal-list-search"
            />

            <div className="journal-list-filter">
              <select
                className="journal-list-filter-select"
                value={kindFilter || ""}
                onChange={(e) => onKindFilterChange?.(e.target.value)}
              >
                <option value="">{kindOptionLabel("")}</option>
                <option value="INVOICE">{kindOptionLabel("INVOICE")}</option>
                <option value="RECEIVABLE">{kindOptionLabel("RECEIVABLE")}</option>
                <option value="JV">{kindOptionLabel("JV")}</option>
                <option value="PURCHASE">{kindOptionLabel("PURCHASE")}</option>
                <option value="PURCHASE_RETURN">{kindOptionLabel("PURCHASE_RETURN")}</option>
              </select>
            </div>
          </div>

          <div className="journal-list-table-wrap">
            <table className="journal-list-table">
              <thead>
                <tr>
                  <th>JV Number</th>
                  <th>Date</th>
                  <th>Identification</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {Array.isArray(journalData) && journalData.length > 0 ? (
                  journalData.map((item, index) => {
                    const kind = String(item.kind || "JV").toUpperCase();
                    const name =
                      item.name ||
                      (item.invoiceNumber
                        ? `فاتورة - ${item.customerName || ""} - ${item.invoiceNumber}`
                        : item.description || "");

                    return (
                      <tr key={`${item.id}-${index}`}>
                        <td className="mono">{item.jvNumber}</td>

                        <td className="mono">
                          {item.date ? new Date(item.date).toLocaleDateString() : ""}
                        </td>

                        <td>
                          <div className="id-cell">
                            <div className="id-top">
                              <span className={`kind-badge kind-${kind}`}>
                                {kindLabel(kind)}
                              </span>

                              {item.receiptCurrency ? (
                                <span className="meta-pill">{item.receiptCurrency}</span>
                              ) : null}

                              {item.invoiceId ? (
                                <span className="meta-pill">INV-ID: {item.invoiceId}</span>
                              ) : null}
                            </div>

                            <div className="id-name" title={name}>
                              {name}
                            </div>

                            {(item.customerName || item.invoiceNumber) && (
                              <div className="id-sub">
                                {item.customerName ? <span>{item.customerName}</span> : null}
                                {item.invoiceNumber ? (
                                  <span className="mono"> • {item.invoiceNumber}</span>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="desc-cell" title={item.description || ""}>
                          {item.description || "—"}
                        </td>

                        <td className="mono">{item.jvType}</td>

                        <td className="action-cell">
                          <button className="view-btn" onClick={() => onView?.(item)}>
                            View
                          </button>
                          <PermGate perm="journal.delete">
                            <button
                              className="delete-btn"
                              onClick={() => {
                                if (window.confirm(`Delete ${item.jvNumber}? This cannot be undone.`)) {
                                  onDelete?.(item);
                                }
                              }}
                            >
                              Delete
                            </button>
                          </PermGate>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-row">
                      No Journal Vouchers Found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="journal-list-footer">
            <button
              className="view-btn"
              onClick={onLoadMore}
              disabled={!hasMore || loadingMore}
            >
              {loadingMore ? "Loading..." : hasMore ? "Load more (100)" : "No more"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JournalListsModal;
