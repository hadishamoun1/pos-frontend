import React from "react";

const Toolbar = ({
  handleNewTransaction,
  handleEditInvoice,
  handleEditRequest,
  handleCreateRequest,
  handleCreateInvoice,
  loading,
  selectedInvoiceId,
  selectedRequestId,
  selectedInvoiceType,
  date,
  setDate,
  handleSaveRequest,
  handleSaveInvoice,
  isEditable,
  setShowPreview,
  handleOpenStatement = () => {},
  /* NEW: disable Stmt if no customer selected */
  canOpenStatement = true,
}) => {
  console.log("isEditable in toolbar:", isEditable);

  return (
    <div className="pos-page-button-row">
      <button
        className="pos-page-toolbar-button pos-page-blue-button"
        onClick={handleNewTransaction}
      >
        New
      </button>

      {selectedInvoiceId !== null ? (
        <button
          className="pos-page-toolbar-button pos-page-green-button"
          onClick={handleEditInvoice}
          disabled={loading}
        >
          {loading ? "Processing..." : "Edit Invoice"}
        </button>
      ) : (
        <>
          {(selectedInvoiceType === "S" ||
            selectedInvoiceType === "G" ||
            selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-blue-button"
              onClick={
                selectedRequestId ? handleEditRequest : handleCreateRequest
              }
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : selectedRequestId
                ? "Edit Request"
                : "Request"}
            </button>
          )}

          {(selectedInvoiceType === "S" || selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-red-button"
              onClick={() => handleCreateInvoice("S")}
              disabled={loading || (selectedRequestId !== null && isEditable)}
            >
              {loading ? "Processing..." : "Issue"}
            </button>
          )}

          {(selectedInvoiceType === "G" || selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-yellow-button"
              onClick={() => handleCreateInvoice("G")}
              disabled={loading || (selectedRequestId !== null && isEditable)}
            >
              {loading ? "Processing..." : "Offer"}
            </button>
          )}

          {(selectedInvoiceType === "RVR" ||
            selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-purple-button"
              onClick={() => handleCreateInvoice("RVR")}
              disabled={loading || (selectedRequestId !== null && isEditable)}
            >
              {loading ? "Processing..." : "RVR"}
            </button>
          )}
        </>
      )}

      {selectedRequestId !== null && isEditable && (
        <button
          className="pos-page-toolbar-button pos-page-green-button"
          onClick={handleSaveRequest}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Request"}
        </button>
      )}

      {selectedInvoiceId !== null && isEditable && (
        <button
          className="pos-page-toolbar-button pos-page-green-button"
          onClick={handleSaveInvoice}
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Invoice"}
        </button>
      )}

      <div className="pos-page-date-wrapper">
        {selectedInvoiceId !== null && (
          <button
            className="pos-page-toolbar-button pos-page-blue-button"
            onClick={() => setShowPreview(true)}
          >
            View Invoice
          </button>
        )}

        {/* Stmt button (left of date) */}
        <button
          className="pos-page-toolbar-button pos-page-orange-button"
          onClick={handleOpenStatement}
          disabled={loading || !canOpenStatement}
          title="Statement"
          aria-label="Open Statement"
        >
          Stmt
        </button>

        <input
          className="pos-page-date-picker"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>
    </div>
  );
};

export default Toolbar;
