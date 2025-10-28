import React from "react";
import "./journal-list-modal.css";

const JournalListsModal = ({
  isOpen,
  onClose,
  journalData,
  onView,
  // ✅ NEW props for pagination
  onLoadMore,
  hasMore,
  loadingMore,
}) => {
  return (
    isOpen && (
      <div className="journal-list-modal-overlay">
        <div className="journal-list-modal">
          <div className="journal-list-header">
            <h2>Journal Lists</h2>
            <button className="close-btn" onClick={onClose}>
              &times;
            </button>
          </div>
          <div className="journal-list-body">
            <input
              type="text"
              placeholder="Search..."
              className="journal-list-search"
            />
            <table className="journal-list-table">
              <thead>
                <tr>
                  <th>JV Number</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {journalData.length > 0 ? (
                  journalData.map((item, index) => (
                    <tr key={`${item.id}-${index}`}>
                      <td>{item.jvNumber}</td>
                      <td>{new Date(item.date).toLocaleDateString()}</td>
                      <td>{item.description}</td>
                      <td>{item.jvType}</td>
                      <td>
                        <button
                          className="view-btn"
                          onClick={() => onView(item)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5">No Journal Vouchers Found</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* ✅ NEW: Load more control */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
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
    )
  );
};

export default JournalListsModal;
