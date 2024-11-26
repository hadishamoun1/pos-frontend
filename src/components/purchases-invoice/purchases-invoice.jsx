import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SupplierInput from "./SupplierInput";
import ItemsTable from "./ItemsTable";
import ItemModal from "./ItemModel";
import SummarySection from "./SummarySelection";
import "./styles/container.css";
import "./styles/header.css";
import "./styles/details.css";
import "./styles/table.css";
import "./styles/model.css";
import "./styles/summary.css";
import "./styles/invoiceModel.css";
import axios from "axios";

const fetchSuppliers = async () => {
  const response = await fetch("http://localhost:3000/suppliers");
  return response.json();
};

const fetchItems = async () => {
  const response = await fetch("http://localhost:3000/items");
  return response.json();
};

const PurchasesInvoicePage = () => {
  const [supplierName, setSupplierName] = useState("");
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [items, setItems] = useState([]);
  const [potentialCost, setPotentialCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [numberOfContainers, setNumberOfContainers] = useState(0);
  const [vat, setVat] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(1.5); // Add exchangeRate state
  const [status, setStatus] = useState("Pending");
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [selectedType, setSelectedType] = useState("");

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });
  const itemsTotalAmount = items.reduce(
    (sum, item) => sum + (item.total || 0),
    0
  );
  const totalOfferAmount = items.reduce(
    (sum, item) => sum + (item.totalOFR || 0),
    0
  );
  const { data: allItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(supplierName.toLowerCase())
  );

  const filteredItems = allItems.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckboxChange = (item, dimension) => {
    const isSelected = selectedItems.some(
      (selectedItem) =>
        selectedItem.itemName === item.itemName &&
        selectedItem.dimensionId === dimension.dimensionId
    );

    if (isSelected) {
      setSelectedItems(
        selectedItems.filter(
          (selectedItem) =>
            !(
              selectedItem.itemName === item.itemName &&
              selectedItem.dimensionId === dimension.dimensionId
            )
        )
      );
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          itemName: item.itemName,
          dimensionId: dimension.dimensionId,
          origin: dimension.origin,
          length: dimension.length,
          width: dimension.width,
          type: item.type,
          sheetsPerBox: dimension.sheetsPerBox || 1,
        },
      ]);
    }
  };

  const closeItemModal = () => {
    const newSelectedItems = selectedItems.map((item) => ({
      id: Date.now() + Math.random(),
      ...item,
      quantity: item.quantity || 1, // Default to 1 if undefined
      sqm:
        ((item.length || 0) *
          (item.width || 0) *
          (item.quantity || 1) *
          (item.sheetsPerBox || 1)) /
        10000, // Avoid NaN
      unitPrice: item.unitPrice || 0, // Default to 0 if undefined
      total: 0, // Total will be updated later
    }));
    setItems((prevItems) => [...prevItems, ...newSelectedItems]);
    setSelectedItems([]);
    setShowItemModal(false);
  };

  const handleSaveButtonClick = () => {
    setShowTypePopup(true); // Show the type selection popup
  };

  const saveInvoice = async (type) => {
    try {
      const invoiceData = {
        supplierName,
        vatAmount,
        grandAmount: totalAmount + vatAmount,
        exchangeRate,
        date: invoiceDate,
        type,
        items: items.map((item) => ({
          itemName: item.itemName,
          dimensionId: item.dimensionId,
          sqm: item.sqm,
          unitPrice: item.unitPrice,
          totalAmount: item.sqm * item.unitPrice,
        })),
      };

      const response = await axios.post(
        "http://localhost:3000/purchase-invoices",
        invoiceData
      );
      alert(
        `Invoice saved successfully! Invoice Number: ${response.data.invoiceNumber}`
      );

      // Reset form
      setSupplierName("");
      setInvoiceDate(new Date().toISOString().slice(0, 10));
      setItems([]);
      setShowTypePopup(false);
    } catch (error) {
      console.error("Failed to save invoice:", error);
      alert("Failed to save the invoice. Please try again.");
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = totalAmount * (vat / 100);
  const grandTotal = totalAmount + vatAmount;

  const getStatusColor = (status) => {
    switch (status) {
      case "Ordered":
        return "red";
      case "Shipped":
        return "yellow";
      case "Recieved":
        return "rgb(2, 235, 2)";
      default:
        return "white"; // Default color
    }
  };

  return (
    <div className="purchase-invoice-container">
      <div className="header">
        <h2>Create Purchase Invoice</h2>
        <button className="save-button" onClick={handleSaveButtonClick}>
          Save Invoice
        </button>
      </div>

      <div className="invoice-details">
        <SupplierInput
          supplierName={supplierName}
          setSupplierName={setSupplierName}
          filteredSuppliers={filteredSuppliers}
          showSupplierSuggestions={showSupplierSuggestions}
          setShowSupplierSuggestions={setShowSupplierSuggestions}
        />
        <label>
          Date
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
        <div className="dropdown-container">
          <label>
            Invoice Number
            <input type="text" placeholder="Enter invoice number" />
          </label>
          <label>
            Exchange Rate
            <select
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            >
              <option value="1.5">1.5</option>
              <option value="1.6">1.6</option>
              <option value="1.7">1.7</option>
            </select>
          </label>
          <label>
            Currency
            <select
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
            >
              <option value="USD">USD</option>
              <option value="EURO">EURO</option>
            </select>
          </label>
          <label>
            Status
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              style={{
                backgroundColor: status ? getStatusColor(status) : "white", // Default background if no status selected
              }}
            >
              <option value="" style={{ backgroundColor: "white" }}>
                Select Status
              </option>
              <option value="Ordered" style={{ backgroundColor: "red" }}>
                Ordered
              </option>
              <option value="Shipped" style={{ backgroundColor: "yellow" }}>
                Shipped
              </option>
              <option
                value="Recieved"
                style={{ backgroundColor: "rgb(2, 235, 2)" }}
              >
                Recieved
              </option>
            </select>
          </label>
          <label>
            Expected Arrival Date
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </label>
        </div>
      </div>

     

      <ItemsTable
        items={items}
        setItems={setItems}
        openItemModal={() => setShowItemModal(true)}
      />

      {showItemModal && (
        <ItemModal
          filteredItems={filteredItems}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedItems={selectedItems}
          handleCheckboxChange={handleCheckboxChange}
          closeItemModal={closeItemModal}
        />
      )}

      {showTypePopup && (
        <div className="invoice-type-modal-overlay">
          <div className="invoice-type-modal-content">
            <h3>Select Invoice Type</h3>
            <div className="invoice-type-selection-buttons">
              <button
                onClick={() => {
                  setSelectedType("S");
                  saveInvoice("S");
                }}
                className="invoice-S-type-button"
              >
                S
              </button>
              <button
                onClick={() => {
                  setSelectedType("G");
                  saveInvoice("G");
                }}
                className="invoice-G-type-button"
              >
                G
              </button>
            </div>
            <button
              className="invoice-type-close-button"
              onClick={() => setShowTypePopup(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <SummarySection
        totalAmount={itemsTotalAmount}
        totalOfferAmount={totalOfferAmount}
        potentialCost={potentialCost}
        setPotentialCost={setPotentialCost}
        shippingCost={shippingCost}
        setShippingCost={setShippingCost}
        numberOfContainers={numberOfContainers}
        setNumberOfContainers={setNumberOfContainers}
      />
    </div>
  );
};

export default PurchasesInvoicePage;
