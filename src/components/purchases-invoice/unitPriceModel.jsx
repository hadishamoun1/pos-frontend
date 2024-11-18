import React, { useState } from "react";
import "./styles/unitPriceModel.css";

const UnitPriceModal = ({ isVisible, onClose, item, onSave }) => {
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [shippingTerms, setShippingTerms] = useState("");
  const [customs, setCustoms] = useState(0);
  const [customsCurrency, setCustomsCurrency] = useState("USD"); // Currency for customs
  const [tva, setTva] = useState(0);
  const [tvaCurrency, setTvaCurrency] = useState("USD"); // Currency for TVA
  const [exchangeRate, setExchangeRate] = useState(1); // Exchange rate for conversion
  const [fio, setFio] = useState(0);
  const [fioTva, setFioTva] = useState(0);
  const [transport, setTransport] = useState(0);
  const [transportTva, setTransportTva] = useState(0);
  const [transferFees, setTransferFees] = useState(0);

  // Convert customs and TVA to USD if their currency is LL
  const convertedCustoms =
    customsCurrency === "LL" ? customs / exchangeRate : customs;
  const convertedTva = tvaCurrency === "LL" ? tva / exchangeRate : tva;

  // Derived calculations
  const totalInvoiceAmount = invoiceAmount + shippingTerms;
  const totalFees = convertedCustoms + fio + transport + transferFees;
  const totalTva = convertedTva + fioTva + transportTva;

  if (!isVisible) return null;

  const handleSave = () => {
    onSave({
      invoiceAmount,
      shippingTerms,
      customs: convertedCustoms,
      tva: convertedTva,
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
              <label>Shipping Cost</label>
              <input
                type="number"
                value={shippingTerms}
                onChange={(e) => setShippingTerms(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Invoice Amount</label>
              <input type="number" value={totalInvoiceAmount} readOnly />
            </div>
          </div>
        </div>

        {/* Fees & Taxes Section */}
        <div className="section">
          <div className="section-title">Fees & Taxes</div>
          <div className="field-grid  customs-tva-row">
            <div className="field">
              <label>Customs</label>
              <div className="dropdown-container">
                <input
                  className="customs-input"
                  type="number"
                  value={customs}
                  onChange={(e) => setCustoms(Number(e.target.value))}
                />
                <select
                  value={customsCurrency}
                  onChange={(e) => setCustomsCurrency(e.target.value)}
                  className="currency-select"
                >
                  <option value="USD">USD</option>
                  <option value="LL">LL</option>
                </select>
                <span className="converted-amount">
                  {customsCurrency === "LL"
                    ? `${(customs / exchangeRate).toFixed(2)} USD`
                    : `${customs.toFixed(2)} USD`}
                </span>
              </div>
            </div>

            <div className="field">
              <label>TVA</label>
              <div className="dropdown-container">
                <input
                  className="tva-input"
                  type="number"
                  value={tva}
                  onChange={(e) => setTva(Number(e.target.value))}
                />
                <select
                  value={tvaCurrency}
                  onChange={(e) => setTvaCurrency(e.target.value)}
                  className="currency-select"
                >
                  <option value="USD">USD</option>
                  <option value="LL">LL</option>
                </select>
                <span className="converted-amount">
                  {tvaCurrency === "LL"
                    ? `${(tva / exchangeRate).toFixed(2)} USD`
                    : `${tva.toFixed(2)} USD`}
                </span>
              </div>
            </div>

            <div className="exchange-rate-field">
              <label>Exchange Rate</label>
              <input
                type="number"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(Number(e.target.value))}
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
