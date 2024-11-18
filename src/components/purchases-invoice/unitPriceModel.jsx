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

  // Function to format a number with commas
  const formatWithCommas = (value) => {
    if (!value) return "";
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // Function to handle input and remove commas for calculations
  const handleInputWithCommas = (e, setterFunction) => {
    const value = e.target.value.replace(/,/g, ""); // Remove commas for calculations
    if (!isNaN(value) && value !== "") {
      setterFunction(Number(value)); // Update state with the numeric value
    } else {
      setterFunction(0); // Reset to 0 if the input is invalid
    }
  };

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
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(invoiceAmount)}
                  onChange={(e) => handleInputWithCommas(e, setInvoiceAmount)}
                />
              </div>
            </div>
            <div className="field">
              <label>Shipping Cost</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(shippingTerms)}
                  onChange={(e) => handleInputWithCommas(e, setShippingTerms)}
                />
              </div>
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Invoice Amount</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(totalInvoiceAmount)}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fees & Taxes Section */}
        <div className="section">
          <div className="section-title">Fees & Taxes</div>
          <div className="field-grid customs-tva-row">
            <div className="field">
              <label>Customs</label>
              <div className="dropdown-container">
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
                    className="customs-input"
                    type="text"
                    value={formatWithCommas(customs)}
                    onChange={(e) => handleInputWithCommas(e, setCustoms)}
                  />
                </div>
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
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
                    className="tva-input"
                    type="text"
                    value={formatWithCommas(tva)}
                    onChange={(e) => handleInputWithCommas(e, setTva)}
                  />
                </div>
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
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(fio)}
                  onChange={(e) => handleInputWithCommas(e, setFio)}
                />
              </div>
            </div>
            <div className="field">
              <label>FIO TVA</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(fioTva)}
                  onChange={(e) => handleInputWithCommas(e, setFioTva)}
                />
              </div>
            </div>
            <div className="field">
              <label>Transport</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(transport)}
                  onChange={(e) => handleInputWithCommas(e, setTransport)}
                />
              </div>
            </div>
            <div className="field">
              <label>Transport TVA</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(transportTva)}
                  onChange={(e) => handleInputWithCommas(e, setTransportTva)}
                />
              </div>
            </div>
            <div className="field">
              <label>Transfer Fees</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(transferFees)}
                  onChange={(e) => handleInputWithCommas(e, setTransferFees)}
                />
              </div>
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Fees</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(totalFees.toFixed(2))}
                  readOnly
                />
              </div>
            </div>
            <div className="total-field">
              <label>Total TVA</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(totalTva.toFixed(2))}
                  readOnly
                />
              </div>
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
