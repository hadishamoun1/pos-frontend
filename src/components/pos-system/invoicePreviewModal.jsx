// components/InvoiceModal.jsx
import React from "react";
import "./invoicePreviewModal.css";

const InvoiceModal = ({ invoiceData, onClose }) => {
  return (
    <div className="invoice-modal-overlay">
      <div className="invoice-modal-content">
        <button className="invoice-modal-close" onClick={onClose}>
          ✕
        </button>
        {/* Your actual invoice */}
        <div className="invoice-a4-wrapper">
          {/* A4 sized content */}

          {/* Inject InvoicePreview here */}
          <div>{invoiceData}</div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
