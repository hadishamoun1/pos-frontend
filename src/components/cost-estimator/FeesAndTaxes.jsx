import React from "react";

const FeesAndTaxes = ({
  customs,
  setCustoms,
  tva,
  setTva,
  fio,
  setFio,
  fioTva,
  setFioTva,
  transport,
  setTransport,
  transportTva,
  setTransportTva,
  transferFees,
  setTransferFees,
  totalFees = 0,
  totalTva = 0,
}) => {
  return (
    <div className="section">
      <div className="section-title">Fees and Taxes</div>
      <div className="field-grid">
        <div className="field">
          <label>Customs</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={customs || ""}
              onChange={(e) => setCustoms(e.target.value)}
              placeholder="Enter Customs"
            />
          </div>
        </div>
        <div className="field">
          <label>TVA</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={tva || ""}
              onChange={(e) => setTva(e.target.value)}
              placeholder="Enter TVA"
            />
          </div>
        </div>
        <div className="field">
          <label>FIO</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={fio || ""}
              onChange={(e) => setFio(e.target.value)}
              placeholder="Enter FIO"
            />
          </div>
        </div>
        <div className="field">
          <label>FIO TVA</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={fioTva || ""}
              onChange={(e) => setFioTva(e.target.value)}
              placeholder="Enter FIO TVA"
            />
          </div>
        </div>
        <div className="field">
          <label>Transport</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={transport || ""}
              onChange={(e) => setTransport(e.target.value)}
              placeholder="Enter Transport"
            />
          </div>
        </div>
        <div className="field">
          <label>Transport TVA</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={transportTva || ""}
              onChange={(e) => setTransportTva(e.target.value)}
              placeholder="Enter Transport TVA"
            />
          </div>
        </div>
        <div className="field">
          <label>Transfer Fees</label>
          <div className="input-with-prefix">
            <span className="input-prefix">$</span>
            <input
              type="text"
              value={transferFees || ""}
              onChange={(e) => setTransferFees(e.target.value)}
              placeholder="Enter Transfer Fees"
            />
          </div>
        </div>
      </div>
      <div className="total-row">
        <div className="total-field">
          <label>Total Fees</label>
          <input
            type="text"
            value={`$${(totalFees || 0).toFixed(2)}`}
            readOnly
          />
        </div>
        <div className="total-field">
          <label>Total TVA</label>
          <input
            type="text"
            value={`$${(totalTva || 0).toFixed(2)}`}
            readOnly
          />
        </div>
      </div>
    </div>
  );
};

export default FeesAndTaxes;
