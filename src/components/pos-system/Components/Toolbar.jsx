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
  date, // ✅ Receive date as a prop
  setDate, // ✅ Receive setDate as a prop
  handleSaveRequest, // Function to save the request
  handleSaveInvoice, // Function to save the invoice
  isEditable, // This would indicate if the request or invoice is editable
}) => {
  // Debugging: log the isEditable value
  console.log("isEditable in toolbar:", isEditable);

  return (
    <div className="pos-page-button-row">
      {/* ✅ New Transaction Button */}
      <button
        className="pos-page-toolbar-button pos-page-blue-button"
        onClick={handleNewTransaction}
      >
        New
      </button>

      {/* ✅ Show "Edit Invoice" when an invoice is selected */}
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
          {/* ✅ Request / Edit Request Button */}
          {selectedInvoiceType &&
            (selectedInvoiceType === "S" ||
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

          {/* ✅ Show "Issue" button only if invoiceType is 'S' or 'Both' */}
          {(selectedInvoiceType === "S" || selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-red-button"
              onClick={() => handleCreateInvoice("S")}
              disabled={loading || selectedRequestId !== null}
            >
              {loading ? "Processing..." : "Issue"}
            </button>
          )}

          {/* ✅ Show "Offer" button only if invoiceType is 'G' or 'Both' */}
          {(selectedInvoiceType === "G" || selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-yellow-button"
              onClick={() => handleCreateInvoice("G")}
              disabled={loading || selectedRequestId !== null}
            >
              {loading ? "Processing..." : "Offer"}
            </button>
          )}
        </>
      )}

      {/* ✅ Show Save Request button when a request is being edited */}
      {selectedRequestId !== null && isEditable && (
        <button
          className="pos-page-toolbar-button pos-page-green-button"
          onClick={handleSaveRequest} // Trigger saving the edited request
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Request"}
        </button>
      )}

      {/* ✅ Show Save Invoice button when an invoice is being edited */}
      {selectedInvoiceId !== null && isEditable && (
        <button
          className="pos-page-toolbar-button pos-page-green-button"
          onClick={handleSaveInvoice} // Trigger saving the edited invoice
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Invoice"}
        </button>
      )}

      <div className="pos-page-date-wrapper">
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
