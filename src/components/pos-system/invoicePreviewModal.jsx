// components/InvoiceModal.jsx
import React, { useRef } from "react";
import "./invoicePreviewModal.css";
import html2pdf from "html2pdf.js";
import InvoicePreview from "./invoicePreview"; // <- your actual preview
import { FiDownload, FiX } from "react-icons/fi";

const InvoiceModal = ({ onClose }) => {
  const invoiceRef = useRef();

  const handleDownloadPDF = () => {
    const element = invoiceRef.current;
    element.classList.add("pdf-mode");

    const opt = {
      margin: 0,
      filename: "Invoice.pdf",
      image: { type: "jpeg", quality: 1 },
      html2canvas: {
        scale: 3,
        useCORS: true,
        logging: false,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
    };

    html2pdf()
      .set(opt)
      .from(element)
      .save()
      .then(() => {
        element.classList.remove("pdf-mode");
      });
  };

  return (
    <div className="invoice-modal-overlay">
      <div className="invoice-modal-content">
        <div className="invoice-modal-header">
          <button
            className="invoice-modal-icon-btn"
            onClick={handleDownloadPDF}
            title="Download PDF"
          >
            <FiDownload size={18} />
          </button>
          <button
            className="invoice-modal-x-btn"
            onClick={onClose}
            title="Close"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Inject InvoicePreview with ref to target download */}
        <div className="invoice-scale-wrapper" ref={invoiceRef}>
          <InvoicePreview />
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
