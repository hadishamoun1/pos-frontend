import React from "react";
import { hasPerm } from "../../auth/authz"; // ✅ adjust path if needed

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
  setShowPreview, // invoice preview
  handleOpenStatement = () => {},
  canOpenStatement = true,
  setShowDeliveryNotePreview = () => {},

  // ✅ Return
  handleCreateReturnInvoice = () => {},
  canCreateReturnInvoice = true,

  // ✅ request preview
  setShowRequestPreview = () => {},
}) => {
  console.log("isEditable in toolbar:", isEditable);

  // ✅ permissions
  const canRvr = hasPerm("pos.rvr");
  const canReturn = hasPerm("pos.return");

  return (
    <div className="pos-page-button-row">
      <button
        className="pos-page-toolbar-button pos-page-blue-button"
        onClick={handleNewTransaction}
      >
        New
      </button>

      {selectedInvoiceId !== null ? (
        <>
          <button
            className="pos-page-toolbar-button pos-page-green-button"
            onClick={handleEditInvoice}
            disabled={loading}
          >
            {loading ? "Processing..." : "Edit Invoice"}
          </button>

          {/* ✅ Return button (permission controlled) */}
          {canReturn && (
            <button
              className="pos-page-toolbar-button pos-page-purple-button"
              onClick={handleCreateReturnInvoice}
              disabled={loading || isEditable || !canCreateReturnInvoice}
              title={
                !canCreateReturnInvoice
                  ? "Return is not available for this invoice"
                  : isEditable
                  ? "Finish editing before returning"
                  : "Create Return Invoice (RTN)"
              }
            >
              {loading ? "Processing..." : "Return"}
            </button>
          )}
        </>
      ) : (
        <>
          {(selectedInvoiceType === "S" ||
            selectedInvoiceType === "G" ||
            selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-blue-button"
              onClick={selectedRequestId ? handleEditRequest : handleCreateRequest}
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

          {/* ✅ RVR button (permission controlled) */}
          {(selectedInvoiceType === "RVR" || selectedInvoiceType === "Both") &&
            canRvr && (
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

        {selectedRequestId !== null && (
          <button
            className="pos-page-toolbar-button pos-page-blue-button"
            onClick={() => setShowRequestPreview(true)}
          >
            View Req
          </button>
        )}

        <button
          className="pos-page-toolbar-delvry-note "
          onClick={() => setShowDeliveryNotePreview(true)}
          disabled={loading || (selectedRequestId === null && selectedInvoiceId === null)}
          title={
            selectedRequestId !== null
              ? "Delivery Note for Request"
              : selectedInvoiceId !== null
              ? "Delivery Note for Invoice"
              : "Select a request or invoice first"
          }
        >
          Del Note
        </button>

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
