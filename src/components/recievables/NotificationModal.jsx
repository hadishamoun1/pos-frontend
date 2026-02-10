// src/recievables/NotificationModal.jsx
import React from "react";
import "./notificationModal.css";
import { useTranslation } from "../hooks/useTranslation"; // ✅ adjust path if needed

const NotificationModal = ({
  type,
  message,
  onClose,
  onConfirm,
  confirmLabel, // optional
  cancelLabel,  // optional
}) => {
  const { t } = useTranslation();

  const finalConfirmLabel =
    confirmLabel ?? (cancelLabel ? t("common.yes") : t("common.ok") || "OK");

  const finalCancelLabel =
    cancelLabel ?? null; // keep same behavior: show cancel only if provided

  return (
    <div className="notification-modal-overlay">
      <div
        className={`notification-modal-content ${
          type === "success"
            ? "notification-success-modal"
            : type === "error"
            ? "notification-error-modal"
            : "notification-warning-modal"
        }`}
      >
        {type === "success" ? (
          <>
            <h2 className="notification-modal-success-text">{message}</h2>
            <div className="notification-modal-icon">✔</div>
          </>
        ) : type === "error" ? (
          <>
            <h2 className="notification-modal-error-text">{message}</h2>
            <div className="notification-modal-icon">✖</div>
          </>
        ) : (
          <>
            <h2 className="notification-modal-warning-text">{message}</h2>
            <div className="notification-modal-icon">⚠</div>
          </>
        )}

        <div className="notification-modal-buttons">
          {finalCancelLabel && (
            <button
              className="notification-modal-button notification-modal-cancel-button"
              onClick={onClose}
            >
              {finalCancelLabel}
            </button>
          )}

          <button
            className="notification-modal-button confirm-button"
            onClick={onConfirm || onClose}
          >
            {finalConfirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
