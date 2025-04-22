import React, { useRef, useState } from "react";
import "./invoicePreviewModal.css";
import html2pdf from "html2pdf.js";
import InvoicePreview from "./invoicePreview";
import { FiDownload, FiX, FiZoomIn, FiZoomOut } from "react-icons/fi";

const InvoiceModal = ({ onClose }) => {
  const invoiceRef = useRef();

  // 👇 Replace scale with zoomStep to manage steps
  const [zoomStep, setZoomStep] = useState(0);
  const scaleMap = [0.85, 1.0, 1.05]; // 3 zoom levels only
  const maxZoomStep = scaleMap.length - 1;
  const minZoomStep = 0;

  const handleZoomIn = () => {
    setZoomStep((prev) => Math.min(prev + 1, maxZoomStep));
  };

  const handleZoomOut = () => {
    setZoomStep((prev) => Math.max(prev - 1, minZoomStep));
  };

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
      <div className="invoice-modal-header">
        <button
          onClick={handleZoomIn}
          className="invoice-modal-icon-btn"
          title="Zoom In"
          disabled={zoomStep === maxZoomStep}
        >
          <FiZoomIn />
        </button>
        <button
          onClick={handleZoomOut}
          className="invoice-modal-icon-btn"
          title="Zoom Out"
          disabled={zoomStep === minZoomStep}
        >
          <FiZoomOut />
        </button>
        <button
          onClick={handleDownloadPDF}
          className="invoice-modal-icon-btn"
          title="Download PDF"
        >
          <FiDownload />
        </button>
        <button onClick={onClose} className="invoice-modal-x-btn" title="Close">
          <FiX />
        </button>
      </div>

      <div className="invoice-modal-content">
        <div className="invoice-layout">
          <div
            className="invoice-scale-wrapper"
            style={{
              transform: `scale(${scaleMap[zoomStep]})`,
              width: `${100 / scaleMap[zoomStep]}%`,
            }}
            ref={invoiceRef}
          >
            <InvoicePreview />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;
