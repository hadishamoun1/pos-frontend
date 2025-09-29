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

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

const fetchSuppliersByQuery = async (query) => {
  const response = await fetch(
    `${baseUrl}/suppliers/v1/search?query=${query}`
  );
  return response.json();
};

const fetchItems = async () => {
  const response = await fetch(`${baseUrl}/items/v1/filtered-items`);
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
  const [totalCharges, setTotalCharges] = useState(0);
  const [shippingCostComputed, setShippingCostComputed] = useState(0); // from your unit-price rows
  const [shippingCostInput, setShippingCostInput] = useState(0); // user-typed in the Summary
  const [shippingCostOFR, setShippingCostOFR] = useState(0);
  const [totalChargesOFR, setTotalChargesOFR] = useState(0);

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
  const [invoiceType, setInvoiceType] = useState("S");
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));

  const resetFields = () => {
    setSupplierName("");
    setInvoiceDate(new Date().toISOString().slice(0, 10));
    setItems([]);
    setPotentialCost(0);

    setShippingCostInput(0);
    setNumberOfContainers(0);
    setVat(0);
    setStatus("Pending");
    setSearchQuery("");
    setSelectedItems([]);
    setCurrency("USD");
    setExchangeRate(1.5);
    setInvoiceNumber("");
    setFinalCost(0);
    setInvoiceType("S");
    setPoDate(new Date().toISOString().slice(0, 10));
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

  const getCorrectShippingCost = () => {
    if (invoiceType === "S") return shippingCostComputed; // from normal (value)
    if (invoiceType === "G" || invoiceType === "SR" || invoiceType === "RVR")
      return shippingCostOFR; // from OFR (valueOFR)
    return 0;
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

  useEffect(() => {
    setIsEditMode(false);
  }, [selectedInvoiceId]);

  const saveInvoice = async (type) => {
    try {
      const supplierId = selectedSupplierId;
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      const calculatedVatAmount = totalAmount * (vat / 100);
      const grandTotal = totalAmount + calculatedVatAmount;

      // ⬇️ build enrichedItems with the four computed fields ⬇️
      const enrichedItems = items.map((item) => ({
        itemVariantId: item.dimensionId,
        quantity: item.quantity,
        sqm: item.sqm,
        unitPrice: item.unitPrice,
        totalAmount: item.total,
        euroPrice: item.euroPrice,
        euroOFRPrice: item.euroOfferPrice,
        priceOFR: item.priceOFR,
        totalOFR: item.totalOFR,
        numberOfContainers: item.numberOfContainers,

        // these four use the same functions your UI used:
        cfr: parseFloat(normalCfrFn(item).toFixed(6)),
        finalCost: parseFloat(normalFinalFn(item).toFixed(6)),
        cfrOFR: parseFloat(ofrCfrFn(item).toFixed(6)),
        finalOFR: parseFloat(ofrFinalFn(item).toFixed(6)),
      }));

      const invoiceData = {
        invoiceNumber,
        date: inputedDate,
        expectedArrivalDate: invoiceDate,
        poDate: poDate,
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
        shippingCostInput,
        finalCost,
        items: enrichedItems,
        unitPriceRows: unitPriceRows.map((row) => ({
          id: row.id,
          purchaseInvoiceSettingId: row.purchaseInvoiceSettingId,
          accountId: row.accountId,
          chargeName: row.chargeName,
          chargeType: row.chargeType,
          value: row.value,
          valueOFR: row.valueOFR,
          currency: row.currency.toUpperCase(),
          valueExch: row.valueExch,
          valueExchOFR: row.valueExchOFR,
          addToItemCost: row.addToItemCost,
          invoiceNbTax: row.invoiceNbTax,
          supplierId: row.supplierId,
          shipping: row.shipping,
        })),
      };
      console.log(invoiceData);
      let res;
      if (isInvoiceSelected) {
        // editing existing invoice
        console.log(
          "PUT /purchase-invoices payload:",
          JSON.stringify(invoiceData, null, 2)
        );
        res = await axios.put(
          `${baseUrl}/purchase-invoices/${selectedInvoiceId}`,
          invoiceData
        );
        alert(`Invoice updated successfully: ${res.data.invoiceNumber}`);
        setIsEditMode(false);
      } else {
        // creating new invoice
        res = await axios.post(
          `${baseUrl}/purchase-invoices`,
          invoiceData
        );
        alert(`Invoice saved successfully: ${res.data.invoiceNumber}`);
      }
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
    const res = await fetch(`${baseUrl}/purchase-invoices/${id}`);
    if (!res.ok) throw new Error("Error fetching invoice");
    return res.json();
  };

  const fetchMinimalInvoices = async () => {
    const response = await fetch(
      `${baseUrl}/purchase-invoices/v1/minimal`
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
    setShippingCostInput(Number(fullInvoice.shippingCost));
    setFinalCost(Number(fullInvoice.finalCost));
    setInvoiceType(fullInvoice.type);
    setPoDate(fullInvoice.poDate?.slice(0, 10) || "");

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
          quantity: i.quantity ?? 1,
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
        id: r.id,
        purchaseInvoiceSettingId: r.purchaseInvoiceSettingId,
        supplierId: r.supplierId,
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

  const populateFromInvoice = (inv) => {
    setSupplierName(inv.supplier.supplierName);
    setSelectedSupplierId(inv.supplier.id);
    setInvoiceNumber(inv.invoiceNumber);
    setinputedDate(inv.date);
    setInvoiceDate(inv.expectedArrivalDate?.slice(0, 10) || "");
    setStatus(inv.status);
    setExchangeRate(Number(inv.exchangeRate));
    setVat(Number(inv.vatAmount));
    setShippingLine(inv.shippingLine);
    setEtd(inv.etd);
    setAltContainers(inv.numberOfContainers);
    setBlNumber(inv.blNumber);
    setPotentialCost(Number(inv.potentialCost));
    setShippingCostInput(Number(inv.shippingCost));
    setFinalCost(Number(inv.finalCost));
    setInvoiceType(inv.type);
    setItems(
      inv.items.map((i) => {
        const v = i.itemVariant,
          t = v.thickness,
          it = t.item;
        return {
          id: i.id,
          dimensionId: i.itemVariantId,
          itemName: it.itemName,
          type: it.type,
          origin: v.origin,
          length: Number(v.length),
          width: Number(v.width),
          sheetsPerBox: v.sheetsPerBox,
          quantity: i.quantity ?? 1,
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
    setUnitPriceRows(
      inv.unitPriceRows.map((r) => ({
        id: r.id,
        purchaseInvoiceSettingId: r.purchaseInvoiceSettingId,
        chargeName: r.chargeName,
        chargeType: r.chargeType,
        value: Number(r.value),
        valueOFR: Number(r.valueOFR),
        currency: r.currency,
        valueExch: Number(r.valueExch),
        valueExchOFR: Number(r.valueExchOFR),
        addToItemCost: r.addToItemCost,
        invoiceNbTax: r.invoiceNbTax,
        supplierId: r.supplierId,
        shipping: r.shipping,
      }))
    );
  };
  useEffect(() => {
    if (fullInvoice) {
      populateFromInvoice(fullInvoice);
    }
  }, [fullInvoice]);

  const handleCancelEdit = () => {
    setIsEditMode(false);
    if (fullInvoice) {
      populateFromInvoice(fullInvoice);
    } else {
      resetFields();
    }
  };

  // 1️⃣ Cost-and-Freight per item:
  const calculatePriceCFR = (item) => {
    if (status !== "Recieved") {
      const poAmount = itemsTotalAmount || 0;
      console.log(itemsTotalAmount);
      const fob = parseFloat(item.unitPrice || 0);

      const ccfr = (shippingCostInput / poAmount + 1) * fob;
      return ccfr;
    }
  };

  // 2️⃣ Final cost per item:
  const calculateFinalCost = (item) => {
    if (status !== "Recieved") {
      const cfr = calculatePriceCFR(item);

      return cfr * (potentialCost / 100 + 1);
    }
  };

  const calculatePriceCFROFR = (item) => {
    if (
      (status !== "Recieved" && invoiceType === "SR") ||
      invoiceType === "G"
    ) {
      const totalOFR = totalOfferAmount || 0;
      const fobOFR = parseFloat(item.priceOFR) || 0;
      if (totalOFR === 0) return fobOFR;
      return (1 + shippingCostInput / totalOFR) * fobOFR;
    } else if (status !== "Recieved" && invoiceType === "S") {
      const totalOFR = itemsTotalAmount || 0;
      const fobOFR = parseFloat(item.unitPrice) || 0;
      if (totalOFR === 0) return fobOFR;
      return (1 + shippingCostInput / totalOFR) * fobOFR;
    }
    return 0;
  };

  // only returns the OFR-final cost when SR + Recieved
  const calculateFinalCostOFR = (item) => {
    if (
      (status !== "Recieved" && invoiceType === "SR") ||
      invoiceType === "G"
    ) {
      const cfrOFR = calculatePriceCFROFR(item);
      return cfrOFR * (1 + potentialCost / 100);
    } else if (status !== "Recieved" && invoiceType === "S") {
      const cfrOFR = calculatePriceCFROFR(item);
      return cfrOFR * (1 + potentialCost / 100);
    }
    return 0;
  };

  useEffect(() => {
    if (status === "Recieved") {
      // — normal (value) —
      const normalShipping = unitPriceRows
        .filter((r) => r.shipping)
        .reduce((sum, r) => sum + Number(r.value), 0);
      const normalCharges = unitPriceRows
        .filter((r) => r.addToItemCost)
        .reduce((sum, r) => sum + Number(r.value), 0);
      setShippingCostComputed(normalShipping);
      setTotalCharges(normalCharges);

      // — OFR (valueOFR) —
      const ofrShipping = unitPriceRows
        .filter((r) => r.shipping)
        .reduce((sum, r) => sum + Number(r.valueOFR), 0);
      const ofrCharges = unitPriceRows
        .filter((r) => r.addToItemCost)
        .reduce((sum, r) => sum + Number(r.valueOFR), 0);
      setShippingCostOFR(ofrShipping);
      setTotalChargesOFR(ofrCharges);
    }
  }, [status, invoiceType, unitPriceRows]);

  // 3️⃣ Calculate CFR using the up-to-date shippingCost & itemsTotalAmount:
  const realCalculatePriceCFR = (item) => {
    const poAmount = itemsTotalAmount || 0;
    if (poAmount === 0) return 0;
    const fob = parseFloat(item.unitPrice || 0);
    return (shippingCostComputed / poAmount + 1) * fob;
  };

  // 4️⃣ Compute your cost percentage once per render:
  const getCostPercentage = () => {
    const poAmount = itemsTotalAmount || 0;
    if (poAmount === 0) return 0;

    let final = totalCharges / poAmount;
    console.log("Final Cost Percentage:", final);
    return final;
  };

  // 5️⃣ Finally, your “real” final cost:
  const realFinalCost = (item) => {
    const cfr = realCalculatePriceCFR(item);
    const cp = getCostPercentage();
    return cfr * (1 + cp);
  };

  const realCalculatePriceCFROFR = (item) => {
    const poAmount = totalOfferAmount || 0;
    if (poAmount === 0) return 0;
    const fob = parseFloat(item.priceOFR || 0);
    return (shippingCostOFR / poAmount + 1) * fob;
  };

  // 4️⃣ Compute your cost percentage once per render:
  const getCostPercentageOFR = () => {
    const poAmount = totalOfferAmount || 0;
    if (poAmount === 0) return 0;
    return totalChargesOFR / poAmount;
  };

  // 5️⃣ Finally, your “real” final cost:
  const realFinalCostOFR = (item) => {
    const cfr = realCalculatePriceCFROFR(item);
    const cp = getCostPercentageOFR();
    return cfr * (1 + cp);
  };

  // choose the right CFR / final‐cost functions for S, G, SR when Recieved
  let normalCfrFn = calculatePriceCFR;
  let normalFinalFn = calculateFinalCost;
  let ofrCfrFn = calculatePriceCFROFR;
  let ofrFinalFn = calculateFinalCostOFR;

  if (status === "Recieved") {
    if (invoiceType === "S") {
      // Services only
      normalCfrFn = realCalculatePriceCFR;
      normalFinalFn = realFinalCost;
      ofrCfrFn = realCalculatePriceCFR;
      ofrFinalFn = realFinalCost;
    } else if (invoiceType === "G") {
      normalCfrFn = () => 0;
      normalFinalFn = () => 0;
      // Goods only
      ofrCfrFn = realCalculatePriceCFROFR;
      ofrFinalFn = realFinalCostOFR;
    } else if (invoiceType === "SR") {
      // Both
      normalCfrFn = realCalculatePriceCFR;
      normalFinalFn = realFinalCost;
      ofrCfrFn = realCalculatePriceCFROFR;
      ofrFinalFn = realFinalCostOFR;
    } else if (invoiceType === "RVR") {
      // Both
      normalCfrFn = realCalculatePriceCFR;
      normalFinalFn = realFinalCost;
      ofrCfrFn = () => 0;
      ofrFinalFn = () => 0;
    }
  }

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
                <>
                  <button
                    className="save-button"
                    onClick={() => saveInvoice(invoiceType)}
                  >
                    Save
                  </button>
                  <button className="cancel-button" onClick={handleCancelEdit}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="edit-button"
                  onClick={() => setIsEditMode(true)}
                >
                  Edit Invoice
                </button>
              )
            ) : (
              <button
                className="save-button"
                onClick={() => saveInvoice(invoiceType)}
              >
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
          <div className="invoice-row row-1">
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
              Recieved Date
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
            <label>
              Exchange Rate
              <input
                type="number"
                step="0.0001"
                value={exchangeRate}
                onChange={(e) =>
                  setExchangeRate(parseFloat(e.target.value) || 0)
                }
                disabled={!canEdit}
              />
            </label>

            {/* ----------- ROW 2 ----------- */}

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

            <label>
              PO Date
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                disabled={!canEdit}
              />
            </label>

            <label>
              Type
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                disabled={!canEdit}
              >
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="SR">SR</option>
                <option value="RVR">RVR</option>
              </select>
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
          invoiceType={invoiceType}
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
            shippingCost={shippingCostInput}
            setShippingCost={setShippingCostInput}
            numberOfContainers={numberOfContainers}
            setNumberOfContainers={setNumberOfContainers}
            isEditable={canEdit}
            calculatePriceCFR={normalCfrFn}
            calculateFinalCost={normalFinalFn}
            calculatePriceCFROFR={ofrCfrFn}
            calculateFinalCostOFR={ofrFinalFn}
            selectedItems={items}
            invoiceType={invoiceType}
            status={status}
            shippingCostComputed={getCorrectShippingCost()}
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
