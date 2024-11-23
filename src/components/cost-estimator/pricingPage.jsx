import React, { useState } from "react";

import "./pricingPage.css";
import "./styles/CostTable.css";

import SupplierDetails from "./SupplierDetails";
import ItemDetails from "./ItemDetails";
import InvoiceDetails from "./invoiceDetails";
import FeesAndTaxes from "./FeesAndTaxes ";
import CostTable from "./CostTable";
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
  const [supplierName, setSupplierName] = useState("");
  const [selectedItems, setSelectedItems] = useState([
    { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
  ]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
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
        fobPrice: updatedItems[selectedRowIndex].fobPrice,
        numContainers: updatedItems[selectedRowIndex].numContainers,
      };
    }
    setSelectedItems(updatedItems);
    setShowItemModal(false);
  };

  // Add new empty row
  const addEmptyRow = () => {
    setSelectedItems((prev) => [
      ...prev,
      { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
    ]);
  };

  // Remove a row safely
  const deleteRow = (index) => {
    setSelectedItems((prev) => {
      const updatedItems = prev.filter((_, i) => i !== index);
      if (selectedRowIndex === index) {
        // Reset selectedRowIndex if the deleted row was selected
        setSelectedRowIndex(null);
      }
      return updatedItems;
    });
  };
  // Close the item modal
  const closeItemModal = () => {
    setShowItemModal(false);
  };
  const resetAllFields = () => {
    setSupplierName("");
    setInvoiceAmount("");
    setShippingCost("");
    setCustoms("");
    setTva("");
    setFio("");
    setFioTva("");
    setTransport("");
    setTransportTva("");
    setTransferFees("");

    setSelectedItems([
        { itemName: "", length: "", width: "", fobPrice: "", numContainers: "" },
      ]);
    
  };

  return (
    <div className="pricing-page">
      <div className="container-wrapper">
        <div className="pricing-container">
          <SupplierDetails
            supplierName={supplierName}
            setSupplierName={setSupplierName}
            resetAllFields={resetAllFields}
          />
          <ItemDetails
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            deleteRow={deleteRow}
            setSelectedRowIndex={setSelectedRowIndex}
            selectedRowIndex={selectedRowIndex}
            itemsList={itemsList}
            filteredItems={filteredItems}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            closeModal={closeItemModal}
            handleCheckboxChange={handleCheckboxChange}
          />
          <InvoiceDetails
            invoiceAmount={invoiceAmount}
            setInvoiceAmount={setInvoiceAmount}
            shippingCost={shippingCost}
            setShippingCost={setShippingCost}
            totalInvoiceAmount={totalInvoiceAmount}
          />
          <FeesAndTaxes
            customs={customs}
            setCustoms={setCustoms}
            tva={tva}
            setTva={setTva}
            fio={fio}
            setFio={setFio}
            fioTva={fioTva}
            setFioTva={setFioTva}
            transport={transport}
            setTransport={setTransport}
            transportTva={transportTva}
            setTransportTva={setTransportTva}
            transferFees={transferFees}
            setTransferFees={setTransferFees}
            totalFees={totalFees || 0}
            totalTva={totalTva || 0}
          />
        </div>
        {/* Additional container 1 */}
        <CostTable
          selectedItems={selectedItems}
          shippingCost={shippingCost}
          totalInvoiceAmount={totalInvoiceAmount}
          totalFees={totalFees}
          invoiceAmount={invoiceAmount}
        />

        {/* Additional container 2 */}
        <div className="side-container">
          <h3>Container 2</h3>
          <p>Content for the second side container.</p>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
