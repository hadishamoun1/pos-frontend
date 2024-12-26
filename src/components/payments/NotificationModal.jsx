import React from "react";
import "./notificationModal.css";

const NotificationModal = ({ type, message, onClose }) => {
  return (
    <div className="notification-modal-overlay">
      <div
        className={`notification-modal-content ${
          type === "success" ? "success" : "error"
        }`}
      >
        <p>{message}</p>
        <button
          type="button"
          className="notification-modal-close-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default NotificationModal;
