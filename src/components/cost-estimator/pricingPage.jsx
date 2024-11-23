import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrashAlt } from "@fortawesome/free-solid-svg-icons";
import ItemModal from "./itemsModel"; // Import the ItemModal
import "./pricingPage.css";

// Sample items with dimensions
const itemsList = [
  {
    id: 1,
    itemName: "Item 1",
    type: "Type A",
    dimensions: [
      {
        dimensionId: 1,
        origin: "Origin A",
        length: 100,
        width: 50,
        sheetsPerBox: 10,
      },
    ],
  },
  {
    id: 2,
    itemName: "Item 2",
    type: "Type B",
    dimensions: [
      {
        dimensionId: 2,
        origin: "Origin B",
        length: 200,
        width: 100,
        sheetsPerBox: 20,
      },
    ],
  },
];

const PricingPage = () => {
  const [selectedItems, setSelectedItems] = useState([
    { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
  ]); // Initial empty row
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null); // Track the selected row index
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [shippingCost, setShippingCost] = useState("");
  const [customs, setCustoms] = useState("");
  const [tva, setTva] = useState("");
  const [fio, setFio] = useState("");
  const [fioTva, setFioTva] = useState("");
  const [transport, setTransport] = useState("");
  const [transportTva, setTransportTva] = useState("");
  const [transferFees, setTransferFees] = useState("");

  // Auto-calculation fields
  const totalFobPrice = selectedItems.reduce(
    (sum, item) => sum + parseFloat(item.fobPrice || 0),
    0
  );
  const totalContainers = selectedItems.reduce(
    (sum, item) => sum + parseFloat(item.numContainers || 0),
    0
  );
  const totalInvoiceAmount =
    parseFloat(invoiceAmount || 0) + parseFloat(shippingCost || 0);
  const totalFees =
    parseFloat(customs || 0) +
    parseFloat(fio || 0) +
    parseFloat(transport || 0) +
    parseFloat(transferFees || 0);
  const totalTva =
    parseFloat(tva || 0) +
    parseFloat(fioTva || 0) +
    parseFloat(transportTva || 0);

  // Filter items based on search query
  const filteredItems = itemsList.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle checkbox selection
  const handleCheckboxChange = (item, dimension) => {
    const updatedItems = [...selectedItems];
    if (selectedRowIndex !== null) {
      updatedItems[selectedRowIndex] = {
        itemName: item.itemName,
        origin: dimension.origin,
        length: dimension.length,
        width: dimension.width,
        type: item.type,
        fobPrice: updatedItems[selectedRowIndex].fobPrice, // Retain existing values
        numContainers: updatedItems[selectedRowIndex].numContainers, // Retain existing values
      };
    }
    setSelectedItems(updatedItems);
    setShowItemModal(false); // Close the modal after selection
  };

  // Add new empty row
  const addEmptyRow = () => {
    setSelectedItems((prev) => [
      ...prev,
      { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
    ]);
  };

  // Remove a row
  const deleteRow = (index) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Close the item modal
  const closeItemModal = () => {
    setShowItemModal(false);
  };

  return (
    <div className="pricing-page">
      <header className="pricing-header">
        <button className="cancel-button">Cancel</button>
        <h1 className="underlined-title">Pricing Details</h1>
        <button className="save-button">Save</button>
      </header>

      <div className="pricing-container">
        {/* Item Details Section */}
        <div className="section">
          <div className="section-title">Item Details</div>
          {selectedItems.map((item, index) => (
            <div className="item-details-row" key={index}>
              <button
                className="delete-row"
                onClick={() => deleteRow(index)}
                aria-label="Delete Row"
              >
                <FontAwesomeIcon icon={faTrashAlt} />
              </button>
              <div className="field">
                <label>Item Name</label>
                <input
                  type="text"
                  value={item.itemName}
                  placeholder="Select item"
                  readOnly
                  onClick={() => {
                    setSelectedRowIndex(index);
                    setShowItemModal(true);
                  }}
                />
              </div>
              <div className="field">
                <label>Length (cm)</label>
                <input
                  type="number"
                  value={item.length}
                  placeholder="Auto-filled"
                  readOnly
                />
              </div>
              <div className="field">
                <label>Width (cm)</label>
                <input
                  type="number"
                  value={item.width}
                  placeholder="Auto-filled"
                  readOnly
                />
              </div>
              <div className="field">
                <label>FOB Price</label>
                <div className="input-with-prefix">
                  <span className="input-prefix">$</span>
                  <input
                    type="text"
                    value={item.fobPrice}
                    onChange={(e) =>
                      setSelectedItems((prev) => {
                        const updated = [...prev];
                        updated[index].fobPrice = e.target.value;
                        return updated;
                      })
                    }
                    placeholder="Enter FOB Price"
                  />
                </div>
              </div>
              <div className="field">
                <label>Nb of Containers</label>
                <input
                  type="text"
                  value={item.numContainers}
                  onChange={(e) =>
                    setSelectedItems((prev) => {
                      const updated = [...prev];
                      updated[index].numContainers = e.target.value;
                      return updated;
                    })
                  }
                  placeholder="Enter nb of containers"
                />
              </div>
            </div>
          ))}
          <button className="load-items-button" onClick={addEmptyRow}>
            Add Item
          </button>
        </div>

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
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="Enter Invoice Amount"
                />
              </div>
            </div>
            <div className="field">
              <label>Shipping Cost</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  placeholder="Enter Shipping Cost"
                />
              </div>
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Invoice Amount</label>
              <input
                type="text"
                value={`$${totalInvoiceAmount.toFixed(2)}`}
                readOnly
              />
            </div>
          </div>
        </div>

        {/* Fees and Taxes Section */}
        <div className="section">
          <div className="section-title">Fees and Taxes</div>
          <div className="field-grid">
            <div className="field">
              <label>Customs</label>
              <div className="input-with-prefix">
                <span className="input-prefix">$</span>
                <input
                  type="text"
                  value={customs}
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
                  value={tva}
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
                  value={fio}
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
                  value={fioTva}
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
                  value={transport}
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
                  value={transportTva}
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
                  value={transferFees}
                  onChange={(e) => setTransferFees(e.target.value)}
                  placeholder="Enter Transfer Fees"
                />
              </div>
            </div>
          </div>
          <div className="total-row">
            <div className="total-field">
              <label>Total Fees</label>
              <input type="text" value={`$${totalFees.toFixed(2)}`} readOnly />
            </div>
            <div className="total-field">
              <label>Total TVA</label>
              <input type="text" value={`$${totalTva.toFixed(2)}`} readOnly />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
