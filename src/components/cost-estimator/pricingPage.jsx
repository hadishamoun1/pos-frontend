import React, { useState } from "react";
import "./styles/pricingPage.css";

const PricingPage = () => {
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [shippingTerms, setShippingTerms] = useState("");
  const [customs, setCustoms] = useState(0);
  const [customsCurrency, setCustomsCurrency] = useState("USD");
  const [tva, setTva] = useState(0);
  const [tvaCurrency, setTvaCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [fio, setFio] = useState(0);
  const [fioTva, setFioTva] = useState(0);
  const [transport, setTransport] = useState(0);
  const [transportTva, setTransportTva] = useState(0);
  const [transferFees, setTransferFees] = useState(0);
  const [fobPrice, setFobPrice] = useState(0);

  // Format number with commas
  const formatWithCommas = (value) =>
    value ? value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") : "";

  // Handle input with commas and decimals
  const handleInputWithCommas = (e, setterFunction) => {
    const value = e.target.value.replace(/,/g, "");
    if (!isNaN(value) && /^(\d+(\.\d{0,2})?)?$/.test(value)) {
      setterFunction(value);
    } else {
      setterFunction(0);
    }
  };

  // Calculations
  const convertedCustoms =
    customsCurrency === "LL" ? customs / exchangeRate : customs;
  const convertedTva = tvaCurrency === "LL" ? tva / exchangeRate : tva;
  const totalInvoiceAmount =
    parseFloat(invoiceAmount || 0) + parseFloat(shippingTerms || 0);
  const totalFees = convertedCustoms + fio + transport + transferFees;
  const totalTva = convertedTva + fioTva + transportTva;
  const cfrPrice =
    totalInvoiceAmount > 0
      ? ((shippingTerms / totalInvoiceAmount) + 1) * fobPrice
      : 0;
  const finalCost =
    totalInvoiceAmount > 0 ? ((totalFees / totalInvoiceAmount) + 1) * cfrPrice : 0;

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <h1>Pricing Details</h1>
      </header>

      <div className="pricing-container">
        {/* Invoice Details Section */}
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
            <div className="field">
              <label>FOB Price</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(fobPrice)}
                  onChange={(e) => handleInputWithCommas(e, setFobPrice)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Fees and Taxes Section */}
        <div className="section">
          <div className="section-title">Fees and Taxes</div>
          <div className="field-grid">
            <div className="field">
              <label>Customs</label>
              <div className="dropdown-container">
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
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
              </div>
            </div>
            <div className="field">
              <label>TVA</label>
              <div className="dropdown-container">
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
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
              </div>
            </div>
          </div>
        </div>

        {/* Totals Section */}
        <div className="section">
          <div className="section-title">Totals</div>
          <div className="field-grid">
            <div className="field">
              <label>Total Invoice Amount</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(totalInvoiceAmount.toFixed(2))}
                  readOnly
                />
              </div>
            </div>
            <div className="field">
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
            <div className="field">
              <label>CFR Price</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(cfrPrice.toFixed(2))}
                  readOnly
                />
              </div>
            </div>
            <div className="field">
              <label>Final Cost</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={formatWithCommas(finalCost.toFixed(2))}
                  readOnly
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
