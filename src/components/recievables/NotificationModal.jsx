import React from "react";
import "./notificationModal.css";

const NotificationModal = ({
  type,
  message,
  onClose,
  onConfirm,
  confirmLabel = "OK",
  cancelLabel = null,
}) => {
  return (
    <div className="notification-modal-overlay">
      <div
        className={`notification-modal-content ${
          type === "success"
            ? "notification-success-modal"
            : type === "error"
            ? "notification-error-modal"
            : "notification-warning-modal" // Add warning styling
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
          {cancelLabel && (
            <button
              className="notification-modal-button notification-modal-cancel-button"
              onClick={onClose}
            >
              {cancelLabel}
            </button>
          )}
          <button
            className="notification-modal-button confirm-button"
            onClick={onConfirm || onClose}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationModal;
