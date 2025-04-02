import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SupplierInput from "./SupplierInput";
import ItemsTable from "./ItemsTable";
import ItemModal from "./ItemModel";
import SummarySection from "./SummarySelection";
import UnitPriceModal from "./unitPriceModel";
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
  const [finalCost, setFinalCost] = useState(0);
  const [showUnitPriceModal, setShowUnitPriceModal] = useState(false);
  const [status, setStatus] = useState("Pending");
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [selectedType, setSelectedType] = useState("");

  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1.5);
  const [invoiceNumber, setInvoiceNumber] = useState("");

  const resetFields = () => {
    setSupplierName("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setItems([]);
    setPotentialCost(0);
    setShippingCost(0);
    setNumberOfContainers(0);
    setVat(0);
    setStatus("Pending");
    setSearchQuery("");
    setSelectedItems([]);
    setCurrency("USD");
    setExchangeRate(1.5);
    setInvoiceNumber("");
    setFinalCost(0);
  };

  const handleCurrencyChange = (e) => {
    const selectedCurrency = e.target.value;
    setCurrency(selectedCurrency);

    // Optional: Reset exchange rate for Euro when switching currencies
    if (selectedCurrency === "EURO") {
      setExchangeRate(1.5);
    }
  };
  const handleModalSave = (data) => {
    // Save data from the modal
    setFinalCost(data.finalCost);
    setShowUnitPriceModal(false);
  };

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
  // const { data: allItems = [] } = useQuery({
  //   queryKey: ["items"],
  //   queryFn: fetchItems,
  // });

  // const filteredSuppliers = suppliers.filter((supplier) =>
  //   supplier.name.includes(supplierName.toLowerCase())
  // );

  // const filteredItems = allItems.filter((item) =>
  //   item.itemName.includes(searchQuery.toLowerCase())
  // );

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
      quantity: item.quantity || 1,
      sqm:
        ((item.length || 0) *
          (item.width || 0) *
          (item.quantity || 1) *
          (item.sheetsPerBox || 1)) /
        10000, // Avoid NaN
      unitPrice: item.unitPrice || 0,
      total: 0,
    }));
    setItems((prevItems) => [...prevItems, ...newSelectedItems]);
    setSelectedItems([]);
    setShowItemModal(false);
  };

  const handleSaveButtonClick = () => {
    setShowTypePopup(true);
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
        return "white";
    }
  };

  return (
    <div className="main-container">
      <div className="purchase-invoice-container">
        <div className="header">
          <h2>Create Purchase Invoice</h2>
          <div className="button-container">
            <button className="save-button" onClick={handleSaveButtonClick}>
              Save Invoice
            </button>
            <button className="new-button" onClick={resetFields}>
              New
            </button>
          </div>
        </div>

        <div className="invoice-details">
          {/* ----------- ROW 1 ----------- */}
          <div className="invoice-row">
            <label>
              Supplier Name
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Enter supplier name"
              />
            </label>

            <label>
              Date
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </label>

            <label>
              Invoice Number
              <input
                type="text"
                placeholder="Enter invoice number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
              />
            </label>
          </div>

          {/* ----------- ROW 2 ----------- */}
          <div className="invoice-row">
            <label>
              Currency
              <select value={currency} onChange={handleCurrencyChange}>
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
                  backgroundColor: status ? getStatusColor(status) : "white",
                }}
              >
                <option value="">Select Status</option>
                <option value="Ordered">Ordered</option>
                <option value="Shipped">Shipped</option>
                <option value="Recieved">Recieved</option>
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
          currency={currency}
          exchangeRate={exchangeRate}
        />

        {showItemModal && (
          <ItemModal
            // filteredItems={filteredItems}
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
          finalCost={finalCost}
          setFinalCost={setFinalCost}
          openItemModal={() => setShowUnitPriceModal(true)}
          shippingCost={shippingCost}
          setShippingCost={setShippingCost}
          numberOfContainers={numberOfContainers}
          setNumberOfContainers={setNumberOfContainers}
        />
        {/* UnitPriceModal */}
        {showUnitPriceModal && (
          <UnitPriceModal
            isVisible={showUnitPriceModal}
            onClose={() => setShowUnitPriceModal(false)}
            onSave={handleModalSave}
          />
        )}
      </div>
      <div className="additional-container">
        <h3>Additional Information</h3>
        {/* Add your content here */}
        <p>This is the right-side container. Add content here.</p>
      </div>
    </div>
  );
};

export default PurchasesInvoicePage;
