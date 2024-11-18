import React, { useState } from "react";
import "./styles/unitPriceModal.css";

const UnitPriceModal = ({ isVisible, onClose, item, onSave }) => {
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [shippingTerms, setShippingTerms] = useState("");
  const [customs, setCustoms] = useState(0);
  const [tva, setTva] = useState(0);
  const [fio, setFio] = useState(0);
  const [fioTva, setFioTva] = useState(0);
  const [transport, setTransport] = useState(0);
  const [transportTva, setTransportTva] = useState(0);
  const [transferFees, setTransferFees] = useState(0);

  // Derived calculations
  const totalInvoiceAmount = invoiceAmount + invoiceAmount * 0.1; // Example logic: add 10% shipping terms
  const totalFees = customs + fio + transport + transferFees;
  const totalTva = tva + fioTva + transportTva;

  if (!isVisible) return null;

  const handleSave = () => {
    onSave({
      invoiceAmount,
      shippingTerms,
      customs,
      tva,
      fio,
      fioTva,
      transport,
      transportTva,
      transferFees,
      totalFees,
      totalTva,
    });
    onClose();
  };

  return (
    <div className="unit-price-modal-overlay">
      <div className="unit-price-modal-content">
        <h3>Set Invoice Details</h3>

        {/* Invoice Section */}
        <div className="section">
          <div className="section-title">Invoice Details</div>
          <div className="field-grid">
            <div className="field">
              <label>Invoice Amount</label>
              <input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Shipping Terms</label>
              <input
                type="text"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(e.target.value)}
              />
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Invoice Amount</label>
              <input
                type="number"
                value={totalInvoiceAmount.toFixed(2)}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Fees & Taxes Section */}
        <div className="section">
          <div className="section-title">Fees & Taxes</div>
          <div className="field-grid">
            <div className="field">
              <label>Customs</label>
              <input
                type="number"
                value={customs}
                onChange={(e) => setCustoms(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>TVA</label>
              <input
                type="number"
                value={tva}
                onChange={(e) => setTva(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>FIO</label>
              <input
                type="number"
                value={fio}
                onChange={(e) => setFio(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>FIO TVA</label>
              <input
                type="number"
                value={fioTva}
                onChange={(e) => setFioTva(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Transport</label>
              <input
                type="number"
                value={transport}
                onChange={(e) => setTransport(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Transport TVA</label>
              <input
                type="number"
                value={transportTva}
                onChange={(e) => setTransportTva(Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Transfer Fees</label>
              <input
                type="number"
                value={transferFees}
                onChange={(e) => setTransferFees(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Fees</label>
              <input type="number" value={totalFees.toFixed(2)} readOnly />
            </div>
            <div className="total-field">
              <label>Total TVA</label>
              <input type="number" value={totalTva.toFixed(2)} readOnly />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="modal-actions">
          <button className="save-button" onClick={handleSave}>
            Save
          </button>
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnitPriceModal;
