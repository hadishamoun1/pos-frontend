import React from "react";
import "./notificationModal.css";

const NotificationModal = ({ type, message, onClose }) => {
  return (
    <div className="notification-modal-overlay">
      <div
        className={`notification-modal-content ${
          type === "success"
            ? "notification-success-modal"
            : "notification-error-modal"
        }`}
      >
        {type === "success" ? (
          <>
            <h2 className="notification-modal-success-text">{message}</h2>
            <div className="notification-modal-icon">✔</div>
          </>
        ) : (
          <>
            <h2 className="notification-modal-error-text">{message}</h2>
            <div className="notification-modal-icon">✖</div>
          </>
        )}
        <button className="notification-modal-button" onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  );
};

export default NotificationModal;
