import React, { useState, useEffect } from "react";
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
import AlternativeSummarySection from "./AlternativeSummarySection";

const fetchSuppliersByQuery = async (query) => {
  const response = await fetch(
    `http://localhost:3000/suppliers/v1/search?query=${query}`
  );
  return response.json();
};

const fetchItems = async () => {
  const response = await fetch("http://localhost:3000/items/v1/filtered-items");
  return response.json();
};

const PurchasesInvoicePage = () => {
  const [supplierName, setSupplierName] = useState("");
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [inputedDate, setinputedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [items, setItems] = useState([]);
  const [potentialCost, setPotentialCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [numberOfContainers, setNumberOfContainers] = useState(0);
  const [vat, setVat] = useState(11);
  const [finalCost, setFinalCost] = useState(0);
  const [showUnitPriceModal, setShowUnitPriceModal] = useState(false);
  const [status, setStatus] = useState("Pending");
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [showTypePopup, setShowTypePopup] = useState(false);
  const [selectedType, setSelectedType] = useState("");
  const [activeSummary, setActiveSummary] = useState("main");
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1.5);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [unitPriceRows, setUnitPriceRows] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [shippingLine, setShippingLine] = useState("");
  const [etd, setEtd] = useState(""); // expected time of departure
  const [altContainers, setAltContainers] = useState(0);
  const [blNumber, setBlNumber] = useState("");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const isInvoiceSelected = selectedInvoiceId !== null;
  const canEdit = !isInvoiceSelected || isEditMode;

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

  const filteredItems = allItems.filter((item) =>
    (item?.itemName || "").toLowerCase().includes(searchQuery.toLowerCase())
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

  const handleModalSave = (data) => {
    setUnitPriceRows(data); // Save modal rows
    const total = data.reduce(
      (sum, row) => sum + (parseFloat(row.value) || 0),
      0
    );
    setFinalCost(total); // optional
    setShowUnitPriceModal(false);
  };

  const saveInvoice = async (type) => {
    try {
      const supplierId = selectedSupplierId;
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      const calculatedVatAmount = totalAmount * (vat / 100);
      const grandTotal = totalAmount + calculatedVatAmount;

      const invoiceData = {
        invoiceNumber,
        date: inputedDate,
        expectedArrivalDate: invoiceDate,
        type,
        supplierId,
        vatAmount: calculatedVatAmount,
        grandAmount: grandTotal,
        exchangeRate,
        status,
        shippingLine: shippingLine,
        etd: etd,
        numberOfContainers: altContainers,
        blNumber: blNumber,
        potentialCost,
        shippingCost,
        finalCost,
        items: items.map((item) => ({
          itemVariantId: item.dimensionId,
          sqm: item.sqm,
          unitPrice: item.unitPrice,
          totalAmount: item.total,
          euroPrice: item.euroPrice,
          euroOFRPrice: item.euroOfferPrice,
          priceOFR: item.priceOFR,
          totalOFR: item.totalOFR,
          numberOfContainers: item.numberOfContainers,
        })),
        unitPriceRows: unitPriceRows.map((row) => ({
          chargeName: row.chargeName,
          chargeType: row.chargeType,
          value: row.value,
          valueOFR: row.valueOFR,
          currency: row.currency.toUpperCase(),
          valueExch: row.valueExch,
          valueExchOFR: row.valueExchOFR,
          addToItemCost: row.addToItemCost,
          invoiceNbTax: row.invoiceNbTax,
          supplierId: filteredSuppliers.find(
            (s) => s.supplierName === row.supplierOfTax
          )?.id,
          shipping: row.shipping,
        })),
      };
      console.log(invoiceData);

      const res = await axios.post(
        "http://localhost:3000/purchase-invoices",
        invoiceData
      );
      alert(`Invoice saved successfully: ${res.data.invoiceNumber}`);
      resetFields();
      setShowTypePopup(false);
    } catch (err) {
      console.error("Error saving invoice", err);
      alert("Failed to save invoice");
    }
  };

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

  const handleSupplierNameChange = async (e) => {
    const value = e.target.value;
    setSupplierName(value);
    setShowSupplierSuggestions(true);

    if (value.length > 0) {
      try {
        const results = await fetchSuppliersByQuery(value);
        setFilteredSuppliers(results);
      } catch (error) {
        console.error("Error fetching supplier suggestions:", error);
      }
    } else {
      setFilteredSuppliers([]);
    }
  };
  const fetchFullInvoice = async (id) => {
    const res = await fetch(`http://localhost:3000/purchase-invoices/${id}`);
    if (!res.ok) throw new Error("Error fetching invoice");
    return res.json();
  };

  const fetchMinimalInvoices = async () => {
    const response = await fetch(
      "http://localhost:3000/purchase-invoices/v1/minimal"
    );
    return response.json();
  };

  const { data: minimalInvoices = [] } = useQuery({
    queryKey: ["minimal-invoices"],
    queryFn: fetchMinimalInvoices,
  });

  // ✅ object signature
  const {
    data: fullInvoice,
    isLoading: isLoadingInvoice,
    error: invoiceError,
  } = useQuery({
    queryKey: ["invoice", selectedInvoiceId],
    queryFn: () => fetchFullInvoice(selectedInvoiceId),
    enabled: Boolean(selectedInvoiceId),
  });

  useEffect(() => {
    if (!fullInvoice) return;

    // 1) supplier
    setSupplierName(fullInvoice.supplier.supplierName);
    setSelectedSupplierId(fullInvoice.supplier.id);
    // 2) invoice & dates
    setInvoiceNumber(fullInvoice.invoiceNumber);
    setinputedDate(fullInvoice.date);
    setInvoiceDate(fullInvoice.expectedArrivalDate?.slice(0, 10) || "");
    // 3) status, currency, etc…
    setStatus(fullInvoice.status);
    setExchangeRate(Number(fullInvoice.exchangeRate));
    setVat(Number(fullInvoice.vatAmount));
    setShippingLine(fullInvoice.shippingLine);
    setEtd(fullInvoice.etd);
    setAltContainers(fullInvoice.numberOfContainers);
    setBlNumber(fullInvoice.blNumber);
    setPotentialCost(Number(fullInvoice.potentialCost));
    setShippingCost(Number(fullInvoice.shippingCost));
    setFinalCost(Number(fullInvoice.finalCost));
    // 4) items
    // AFTER
    setItems(
      fullInvoice.items.map((i) => {
        const variant = i.itemVariant;
        const thickness = variant.thickness;
        const item = thickness.item;
        return {
          id: i.id,
          dimensionId: i.itemVariantId,
          // 👇 new fields from the nested relations:
          itemName: item.itemName,
          type: item.type,
          origin: variant.origin,
          length: Number(variant.length),
          width: Number(variant.width),
          sheetsPerBox: variant.sheetsPerBox,
          quantity: i.numberOfContainers ?? 1,
          // 👇 your existing numeric fields:
          sqm: Number(i.sqm),
          unitPrice: Number(i.unitPrice),
          total: Number(i.totalAmount),
          euroPrice: Number(i.euroPrice),
          euroOfferPrice: Number(i.euroOFRPrice),
          priceOFR: Number(i.priceOFR),
          totalOFR: Number(i.totalOFR),
          numberOfContainers: Number(i.numberOfContainers),
        };
      })
    );

    // 5) unit price rows
    setUnitPriceRows(
      fullInvoice.unitPriceRows.map((r) => ({
        chargeName: r.chargeName,
        chargeType: r.chargeType,
        value: Number(r.value),
        valueOFR: Number(r.valueOFR),
        currency: r.currency,
        valueExch: Number(r.valueExch),
        valueExchOFR: Number(r.valueExchOFR),
        addToItemCost: r.addToItemCost,
        invoiceNbTax: r.invoiceNbTax,
        shipping: r.shipping,
      }))
    );
  }, [fullInvoice]);

  return (
    <div className="main-container">
      <div className="purchase-invoice-container">
        <div className="header">
          <h2>
            {isInvoiceSelected
              ? isEditMode
                ? "Edit Purchase Invoice"
                : "View Purchase Invoice"
              : "Create Purchase Invoice"}
          </h2>
          <div className="button-container">
            {isInvoiceSelected ? (
              isEditMode ? (
                // when in edit‐mode, show Save
                <button className="save-button" onClick={handleSaveButtonClick}>
                  Save Invoice
                </button>
              ) : (
                // when an invoice is selected but not yet “in edit mode”
                <button
                  className="edit-button"
                  onClick={() => setIsEditMode(true)}
                >
                  Edit Invoice
                </button>
              )
            ) : (
              // creating a brand new invoice
              <button className="save-button" onClick={handleSaveButtonClick}>
                Save Invoice
              </button>
            )}

            <button
              className="new-button"
              onClick={() => {
                resetFields();
                setSelectedInvoiceId(null);
                setIsEditMode(false);
              }}
            >
              New
            </button>
          </div>
        </div>

        <div className="invoice-details">
          {/* ----------- ROW 1 ----------- */}
          <div className="invoice-row">
            <SupplierInput
              supplierName={supplierName}
              onSupplierNameChange={handleSupplierNameChange}
              filteredSuppliers={filteredSuppliers}
              showSupplierSuggestions={showSupplierSuggestions}
              setShowSupplierSuggestions={setShowSupplierSuggestions}
              setSelectedSupplierId={setSelectedSupplierId}
              disabled={!canEdit}
            />

            <label>
              Date
              <input
                type="date"
                value={inputedDate}
                onChange={(e) => setinputedDate(e.target.value)}
                disabled={!canEdit}
              />
            </label>

            <label>
              Invoice Number
              <input
                type="text"
                placeholder="Enter invoice number"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                disabled={!canEdit}
              />
            </label>
          </div>

          {/* ----------- ROW 2 ----------- */}
          <div className="invoice-row">
            <label>
              Currency
              <select
                value={currency}
                onChange={handleCurrencyChange}
                disabled={!canEdit}
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
                disabled={!canEdit}
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
                disabled={!canEdit}
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
          isEditable={canEdit}
        />

        {showItemModal && (
          <ItemModal
            filteredItems={filteredItems}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedItems={selectedItems}
            handleCheckboxChange={handleCheckboxChange}
            closeItemModal={closeItemModal}
            isEditable={canEdit}
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
        <div className="summary-toggle-navbar">
          <button
            className={activeSummary === "main" ? "active" : ""}
            onClick={() => setActiveSummary("main")}
          >
            Summary View 1
          </button>
          <button
            className={activeSummary === "alt" ? "active" : ""}
            onClick={() => setActiveSummary("alt")}
          >
            Summary View 2
          </button>
        </div>
        {activeSummary === "main" ? (
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
            isEditable={canEdit}
          />
        ) : (
          <AlternativeSummarySection
            shippingLine={shippingLine}
            onShippingLineChange={setShippingLine}
            etd={etd}
            onEtdChange={setEtd}
            numberOfContainers={altContainers}
            onNumberOfContainersChange={setAltContainers}
            blNumber={blNumber}
            onBlNumberChange={setBlNumber}
            isEditable={canEdit}
          />
        )}

        {/* UnitPriceModal */}
        {showUnitPriceModal && (
          <UnitPriceModal
            isVisible={showUnitPriceModal}
            onClose={() => setShowUnitPriceModal(false)}
            onSave={handleModalSave}
            isEditable={canEdit}
            invoiceId={isInvoiceSelected ? selectedInvoiceId : null}
          />
        )}
      </div>
      <div className="additional-container">
        <h3 className="tittle-label">Purchase Invoices</h3>
        <div className="purchase-invoice-cards-wrapper">
          {minimalInvoices.length === 0 ? (
            <p>No invoices found.</p>
          ) : (
            minimalInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="purchase-invoice-card"
                onClick={() => setSelectedInvoiceId(invoice.id)}
              >
                <div className="purchase-invoice-card-header">
                  <div className="supplier-name">
                    {invoice.supplier?.supplierName || "Unknown Supplier"}
                  </div>
                  <div className="invoice-number">{invoice.invoiceNumber}</div>
                </div>

                <div className="purchase-invoice-card-footer">
                  <span className="grand-total">
                    ${Number(invoice.grandAmount || 0).toFixed(2)}
                  </span>
                  <span className="purchase-invoice-card-date">
                    {new Date(invoice.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchasesInvoicePage;
