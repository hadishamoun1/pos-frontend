import React from "react";
import { hasPerm } from "../../auth/authz"; // ✅ adjust path if needed
import { useTranslation } from "../../hooks/useTranslation"; // ✅ add

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
  returnMode = false,
  returnSelectedCount = 0,
  onStartReturnSelection = () => {},
  onCancelReturnSelection = () => {},
  onConfirmReturnSelected = () => {},
  handleOpenStatement = () => {},
  canOpenStatement = true,
  setShowDeliveryNotePreview = () => {},
  // ✅ Return
  handleCreateReturnInvoice = () => {},
  canCreateReturnInvoice = true,
  // ✅ request preview
  setShowRequestPreview = () => {},
}) => {
  const { t } = useTranslation(); // ✅

  // ✅ permissions
  const canRvr = hasPerm("pos.rvr");
  const canReturn = hasPerm("pos.return");

  return (
    <div className="pos-page-button-row">
      <button
        className="pos-page-toolbar-button pos-page-blue-button"
        onClick={handleNewTransaction}
      >
        {t("posToolbar.new")}
      </button>

      {selectedInvoiceId !== null ? (
        <>
          <button
            className="pos-page-toolbar-button pos-page-green-button"
            onClick={handleEditInvoice}
            disabled={loading}
          >
            {loading ? t("common.processing") : t("posToolbar.editInvoice")}
          </button>

          {/* ✅ Return button (permission controlled) */}
          {canReturn && (
            <>
              {!returnMode ? (
                <button
                  className="pos-page-toolbar-button pos-page-purple-button"
                  onClick={onStartReturnSelection}
                  disabled={loading || isEditable || !canCreateReturnInvoice}
                  title={
                    !canCreateReturnInvoice
                      ? t("posToolbar.returnNotAvailable")
                      : isEditable
                      ? t("posToolbar.finishEditingBeforeReturning")
                      : t("posToolbar.selectItemsToReturn")
                  }
                >
                  {loading ? t("common.processing") : t("posToolbar.return")}
                </button>
              ) : (
                <>
                  <button
                    className="pos-page-toolbar-button pos-page-purple-button"
                    onClick={onConfirmReturnSelected}
                    disabled={loading}
                    title={t("posToolbar.createReturnFromSelectedTitle")}
                  >
                    {loading
                      ? t("common.processing")
                      : t("posToolbar.returnSelectedWithCount", {
                          count: returnSelectedCount || 0,
                        })}
                  </button>

                  <button
                    className="pos-page-toolbar-button pos-page-blue-button"
                    onClick={onCancelReturnSelection}
                    disabled={loading}
                    title={t("posToolbar.cancelReturnSelectionTitle")}
                  >
                    {t("posToolbar.cancelReturn")}
                  </button>
                </>
              )}
            </>
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
                ? t("common.processing")
                : selectedRequestId
                ? t("posToolbar.editRequest")
                : t("posToolbar.request")}
            </button>
          )}

          {(selectedInvoiceType === "S" || selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-red-button"
              onClick={() => handleCreateInvoice("S")}
              disabled={loading || (selectedRequestId !== null && isEditable)}
            >
              {loading ? t("common.processing") : t("posToolbar.issue")}
            </button>
          )}

          {(selectedInvoiceType === "G" || selectedInvoiceType === "Both") && (
            <button
              className="pos-page-toolbar-button pos-page-yellow-button"
              onClick={() => handleCreateInvoice("G")}
              disabled={loading || (selectedRequestId !== null && isEditable)}
            >
              {loading ? t("common.processing") : t("posToolbar.offer")}
            </button>
          )}

          {/* ✅ FIX: RVR ALWAYS visible for allowed users (not tied to selectedInvoiceType) */}
          {canRvr && (
            <button
              className="pos-page-toolbar-button pos-page-purple-button"
              onClick={() => handleCreateInvoice("RVR")}
              disabled={loading || (selectedRequestId !== null && isEditable)}
              title={t("posToolbar.rvrTitle")}
            >
              {loading ? t("common.processing") : t("posToolbar.rvr")}
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
          {loading ? t("common.saving") : t("posToolbar.saveRequest")}
        </button>
      )}

      {selectedInvoiceId !== null && isEditable && (
        <button
          className="pos-page-toolbar-button pos-page-green-button"
          onClick={handleSaveInvoice}
          disabled={loading}
        >
          {loading ? t("common.saving") : t("posToolbar.saveInvoice")}
        </button>
      )}

      <div className="pos-page-date-wrapper">
        {selectedInvoiceId !== null && (
          <button
            className="pos-page-toolbar-button pos-page-blue-button"
            onClick={() => setShowPreview(true)}
          >
            {t("posToolbar.viewInvoice")}
          </button>
        )}

        {selectedRequestId !== null && (
          <button
            className="pos-page-toolbar-button pos-page-blue-button"
            onClick={() => setShowRequestPreview(true)}
          >
            {t("posToolbar.viewRequest")}
          </button>
        )}

        <button
          className="pos-page-toolbar-delvry-note "
          onClick={() => setShowDeliveryNotePreview(true)}
          disabled={loading || (selectedRequestId === null && selectedInvoiceId === null)}
          title={
            selectedRequestId !== null
              ? t("posToolbar.deliveryNoteForRequest")
              : selectedInvoiceId !== null
              ? t("posToolbar.deliveryNoteForInvoice")
              : t("posToolbar.selectRequestOrInvoiceFirst")
          }
        >
          {t("posToolbar.deliveryNoteShort")}
        </button>

        <button
          className="pos-page-toolbar-button pos-page-orange-button"
          onClick={handleOpenStatement}
          disabled={loading || !canOpenStatement}
          title={t("posToolbar.statementTitle")}
          aria-label={t("posToolbar.openStatementAria")}
        >
          {t("posToolbar.statementShort")}
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
