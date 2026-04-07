import React, { useState, useEffect, useRef } from "react";

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
import AlternativeSummarySection from "./AlternativeSummarySection";
import NotificationModal from "../recievables/NotificationModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
// ✅ use axiosClient (auto token)
import { axiosClient } from "../api/axiosClient";

const fetchSuppliersByQuery = async (query) => {
  const { data } = await axiosClient.get(`/suppliers/v1/search`, {
    params: { query },
  });
  return data;
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
  const [vatRate, setVatRate] = useState(0);
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
  const [exchangeRate, setExchangeRate] = useState(89500);
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
  const [jvDate, setJvDate] = useState(new Date().toISOString().slice(0, 10)); // تاريخ المعاملة
  const saveLockRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();

  const resetFields = () => {
    const today = new Date().toISOString().slice(0, 10);

    // 🔹 Header fields
    setSupplierName("");
    setSelectedSupplierId(null);
    setInvoiceNumber("");
    setStatus("Pending");
    setInvoiceType("S");
    setCurrency("USD");
    setExchangeRate(89500);
    setVatRate(0);

    // 🔹 Dates
    setInvoiceDate(today);
    setinputedDate(today);
    setPoDate(today);
    setJvDate(today);

    // 🔹 Items & totals
    setItems([]);
    setNumberOfContainers(0);
    setShippingCostInput(0);
    setTotalCharges(0);
    setPotentialCost(0);
    setFinalCost(0);

    // 🔹 Summary / alt summary & extra header
    setActiveSummary("main");
    setShippingLine("");
    setEtd("");
    setAltContainers(0);
    setBlNumber("");

    // 🔹 Unit price / modals
    setShowUnitPriceModal(false);
    setUnitPriceRows([]);
    setShowItemModal(false);

    // 🔹 OFR-related
    setShippingCostComputed(0);
    setShippingCostOFR(0);
    setTotalChargesOFR(0);

    setShowTypePopup(false);
  };

  const toYMD = (iso) => (iso ? String(iso).split("T")[0] : "");

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
      const th = Number(dimension?.thickness);
      const itemNameCombined =
        item?.combinedName ??
        (Number.isFinite(th) && th > 0
          ? `${th} ملم ${item?.itemName || ""}`.trim()
          : item?.itemName || "");

      const variantId = dimension?.id ?? dimension?.dimensionId;

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

          itemNameCombined,
          thickness: Number.isFinite(th) ? th : undefined,
          variantId,
          payloadVariant: dimension,
        },
      ]);
    }
  };


  const navigate = useNavigate();

// Add this handler function
const handleViewJournalVoucher = async () => {
  if (!selectedInvoiceId) {
    openNotif("warning", "Please select a purchase invoice first");
    return;
  }

  try {
    // Fetch the journal voucher for this invoice
    const response = await axiosClient.get(
      `/purchase-invoices/${selectedInvoiceId}/journal-vouchers`
    );

    const data = response.data;

    if (!data.journalVouchers || data.journalVouchers.length === 0) {
      openNotif("info", "No journal voucher found for this purchase invoice");
      return;
    }

    // Get the first (or only) journal voucher
    const jv = data.journalVouchers[0];

    // Navigate to journal voucher page with the JV ID
    navigate(`/journal-voucher/${jv.id}`);
  } catch (error) {
    console.error("Error fetching journal voucher:", error);
    openNotif(
      "error",
      error?.response?.data?.message || "Failed to fetch journal voucher"
    );
  }
};


  const handleUnitPriceRowsChange = (updater) => {
    setUnitPriceRows((prev) =>
      typeof updater === "function" ? updater(prev ?? []) : updater ?? []
    );
  };

  // called when you click "Save" inside the UnitPriceModal
  const handleUnitPriceSave = (rowsFromModal) => {
    const safe = rowsFromModal ?? [];
    setUnitPriceRows(safe);
    const total = safe.reduce(
      (sum, row) => sum + (parseFloat(row.value) || 0),
      0
    );
    setFinalCost(total);
    setShowUnitPriceModal(false);
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
    setFinalCost(total); // update final cost total
    setShowUnitPriceModal(false);
  };

  useEffect(() => {
    setIsEditMode(false);
  }, [selectedInvoiceId]);

  const [notif, setNotif] = useState({
    open: false,
    type: "success",
    message: "",
    confirmLabel: "OK",
    cancelLabel: null,
  });

  const openNotif = (type, message, opts = {}) => {
    setNotif({
      open: true,
      type,
      message: String(message || ""),
      confirmLabel: opts.confirmLabel ?? "OK",
      cancelLabel: opts.cancelLabel ?? null,
    });
  };
  const closeNotif = () => setNotif((p) => ({ ...p, open: false }));

  const saveInvoice = async (type) => {
    if (saveLockRef.current || isSaving) return;
    saveLockRef.current = true;
    setIsSaving(true);

    // ✅ basic validation
    if (!selectedSupplierId || !invoiceNumber || items.length === 0) {
      openNotif(
        "warning",
        "Please fill all required fields (Supplier, Invoice Number, Items)"
      );
      saveLockRef.current = false;
      setIsSaving(false);
      return;
    }

    try {
      const supplierId = selectedSupplierId;
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
      const calculatedVatAmount = totalAmount * (vatRate / 100);
      const grandTotal = totalAmount + calculatedVatAmount;

      const enrichedItems = items.map((item) => ({
        itemVariantId: item.dimensionId,
        quantity: item.quantity,
        sqm: item.sqm,
        sqmOfr: item.sqmOfr,
        unitPrice: item.unitPrice,
        totalAmount: item.total,
        euroPrice: item.euroPrice,
        euroOFRPrice: item.euroOfferPrice,
        priceOFR: item.priceOFR,
        totalOFR: item.totalOFR,
        numberOfContainers: item.numberOfContainers,
        cfr: parseFloat(normalCfrFn(item).toFixed(6)),
        finalCost: parseFloat(normalFinalFn(item).toFixed(6)),
        cfrOFR: parseFloat(ofrCfrFn(item).toFixed(6)),
        finalOFR: parseFloat(ofrFinalFn(item).toFixed(6)),
      }));

      const invoiceData = {
        invoiceNumber,
        supplierInvoiceNumber: invoiceNumber,
        date: inputedDate,
        expectedArrivalDate: invoiceDate,
        jvDate,
        poDate,
        type,
        supplierId,
        vatAmount: calculatedVatAmount.toFixed(2),
        vatPercent: vatRate,
        grandAmount: grandTotal,
        exchangeRate,
        status,
        shippingLine,
        etd,
        numberOfContainers: altContainers,
        blNumber,
        potentialCost,
        shippingCostInput,
        finalCost,
        items: enrichedItems,
unitPriceRows: (unitPriceRows || []).map((row) => ({
  id: row.id,
  purchaseInvoiceSettingId: row.purchaseInvoiceSettingId,

  // ✅ charge account
  accountId: row.accountId != null ? Number(row.accountId) : null,

  chargeName: row.chargeName,
  chargeType: row.chargeType ?? "amount",

  value: row.value === "" ? 0 : Number(row.value ?? 0),
  valueOFR: row.valueOFR === "" ? 0 : Number(row.valueOFR ?? 0),

  currency: (row.currency || "USD").toUpperCase(),

  valueExch: row.valueExch === "" ? 0 : Number(row.valueExch ?? 0),
  valueExchOFR: row.valueExchOFR === "" ? 0 : Number(row.valueExchOFR ?? 0),

  addToItemCost: !!row.addToItemCost,
  invoiceNbTax: row.invoiceNbTax ?? "",

  // legacy (keep if backend still expects it)
  supplierId: row.supplierId != null ? Number(row.supplierId) : null,

  shipping: !!row.shipping,

  // ✅✅✅ THIS IS WHAT YOU WERE MISSING
  taxAccountId: row.taxAccountId != null ? Number(row.taxAccountId) : null,
  taxSupplierId: row.taxSupplierId != null ? Number(row.taxSupplierId) : null,
})),

      };

      let res;
      if (isInvoiceSelected) {
        res = await axiosClient.put(
          `/purchase-invoices/${selectedInvoiceId}`,
          invoiceData
        );
        openNotif(
          "success",
          `Invoice updated successfully: ${res.data.invoiceNumber}`
        );
        setIsEditMode(false);
      } else {
        res = await axiosClient.post(`/purchase-invoices`, invoiceData);
        openNotif("success", `Invoice saved successfully: ${res.data.invoiceNumber}`);
      }

      // ⬇️ add this after the above:
      await queryClient.invalidateQueries({ queryKey: ["minimal-invoices"] });
      await queryClient.invalidateQueries({ queryKey: ["invoice"] });

      // then your existing:
      resetFields();
      setShowTypePopup(false);
    } catch (err) {
      console.error("Error saving invoice", err);
      const serverMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to save invoice";
      openNotif("error", serverMsg);
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
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

  // ✅ use axiosClient (token)
  const fetchFullInvoice = async (id) => {
    const res = await axiosClient.get(`/purchase-invoices/${id}`);
    return res.data;
  };

  // ✅ use axiosClient (token)
  const fetchMinimalInvoices = async () => {
    const response = await axiosClient.get(`/purchase-invoices/v1/minimal`);
    const json = response.data;

    // ✅ always return an array no matter what backend shape is
    if (Array.isArray(json)) return json;
    if (Array.isArray(json?.data)) return json.data;
    if (Array.isArray(json?.items)) return json.items;
    if (Array.isArray(json?.rows)) return json.rows;
    if (Array.isArray(json?.invoices)) return json.invoices;

    return [];
  };

  const { data: minimalInvoices = [] } = useQuery({
    queryKey: ["minimal-invoices"],
    queryFn: fetchMinimalInvoices,
  });

  const minimalInvoicesArr = Array.isArray(minimalInvoices) ? minimalInvoices : [];

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
    setInvoiceNumber(fullInvoice.supplierInvoiceNumber ?? "");
    setinputedDate(toYMD(fullInvoice.date));
    setInvoiceDate(fullInvoice.expectedArrivalDate?.slice(0, 10) || "");
    setJvDate(toYMD(fullInvoice.jvDate) || toYMD(fullInvoice.date));

    // 3) status, currency, etc…
    setStatus(fullInvoice.status);
    setExchangeRate(Number(fullInvoice.exchangeRate));
    // Prefer stored percent; otherwise infer below (outside the setItems mapper)
    if (fullInvoice.vatPercent != null) {
      setVatRate(Number(fullInvoice.vatPercent));
    } else {
      const itemsSumForVat = (fullInvoice.items ?? []).reduce(
        (s, i) => s + Number(i.totalAmount || 0),
        0
      );
      const inferred =
        itemsSumForVat > 0
          ? (Number(fullInvoice.vatAmount || 0) / itemsSumForVat) * 100
          : 0;
      setVatRate(Number.isFinite(inferred) ? +inferred.toFixed(2) : 0);
    }
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
    setItems(
      fullInvoice.items.map((i) => {
        const variant = i.itemVariant;
        const t = variant?.thickness;
        const item = t?.item;
        const thNum = Number(t?.thickness);
        const thickness = Number.isFinite(thNum) ? thNum : undefined;

        const baseName = item?.itemName || "";
        const itemNameCombined =
          thickness != null ? `${thickness} ملم ${baseName}` : baseName;

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
          sqmOfr: Number(i.sqmOfr ?? 0),
          unitPrice: Number(i.unitPrice),
          total: Number(i.totalAmount),
          euroPrice: Number(i.euroPrice),
          euroOfferPrice: Number(i.euroOFRPrice),
          priceOFR: Number(i.priceOFR),
          totalOFR: Number(i.totalOFR),
          numberOfContainers: Number(i.numberOfContainers),
          itemName: baseName,
          itemNameCombined,
          thickness,
        };
      })
    );

    // 5) unit price rows
setUnitPriceRows(
  (fullInvoice.unitPriceRows || []).map((r) => ({
    id: r.id,
    purchaseInvoiceSettingId: r.purchaseInvoiceSettingId,

    accountId: r.accountId ?? null,
    accountNumber: r.account?.accountNumber || "",

    chargeName: r.chargeName,
    chargeType: r.chargeType ?? "amount",

    value: Number(r.value ?? 0),
    valueOFR: Number(r.valueOFR ?? 0),
    currency: r.currency,

    valueExch: Number(r.valueExch ?? 0),
    valueExchOFR: Number(r.valueExchOFR ?? 0),

    addToItemCost: !!r.addToItemCost,
    invoiceNbTax: r.invoiceNbTax ?? "",
    shipping: !!r.shipping,

    supplierId: r.supplierId ?? null,

    // ✅ add these
    taxAccountId: r.taxAccountId ?? (r.taxAccount?.id ?? null),
    taxSupplierId: r.taxSupplierId ?? (r.taxSupplier?.id ?? null),

    // UI helpers (optional)
    supplierOfTax: r.taxSupplier?.supplierName || "",
    accNbOfSupplier: r.taxSupplier?.supplierAccountNumber || "",
  }))
);

  }, [fullInvoice]);

  const populateFromInvoice = (inv) => {
    setSupplierName(inv.supplier.supplierName);
    setSelectedSupplierId(inv.supplier.id);
    setInvoiceNumber(inv.supplierInvoiceNumber ?? "");
    setinputedDate(toYMD(inv.date));
    setInvoiceDate(inv.expectedArrivalDate?.slice(0, 10) || "");
    setStatus(inv.status);
    setExchangeRate(Number(inv.exchangeRate));
    setJvDate(toYMD(inv.jvDate) || toYMD(inv.date));

    // Prefer a stored percent; otherwise infer it from amount/total
    const itemsSum = (inv.items ?? []).reduce(
      (s, i) => s + Number(i.totalAmount || 0),
      0
    );
    const inferredRate =
      itemsSum > 0 ? (Number(inv.vatAmount || 0) / itemsSum) * 100 : 0;
    setVatRate(
      inv.vatPercent != null
        ? Number(inv.vatPercent)
        : Number.isFinite(inferredRate)
        ? +inferredRate.toFixed(2)
        : 0
    );
    setShippingLine(inv.shippingLine);
    setEtd(inv.etd);
    setAltContainers(inv.numberOfContainers);
    setBlNumber(inv.blNumber);
    setPotentialCost(Number(inv.potentialCost));
    setShippingCostInput(Number(inv.shippingCost));
    setFinalCost(Number(inv.finalCost));
    setInvoiceType(inv.type);
    const mapped = (inv.items ?? []).map((i) => {
      const v = i.itemVariant;
      const t = v?.thickness;
      const it = t?.item;

      const thNum = Number(t?.thickness);
      const thickness = Number.isFinite(thNum) ? thNum : undefined;
      const baseName = it?.itemName || "";
      const itemNameCombined =
        thickness != null ? `${thickness} ملم ${baseName}` : baseName;

      return {
        id: i.id,
        dimensionId: i.itemVariantId,
        itemName: it?.itemName,
        itemNameCombined,
        thickness,
        type: it?.type,
        origin: v?.origin,
        length: Number(v?.length),
        width: Number(v?.width),
        sheetsPerBox: v?.sheetsPerBox,
        quantity: Number(i.quantity ?? 1),
        sqm: Number(i.sqm),
        sqmOfr: Number(i.sqmOfr ?? 0), // ✅ IMPORTANT (you were missing this)
        unitPrice: Number(i.unitPrice),
        total: Number(i.totalAmount),
        euroPrice: Number(i.euroPrice),
        euroOfferPrice: Number(i.euroOFRPrice),
        priceOFR: Number(i.priceOFR),
        totalOFR: Number(i.totalOFR),
        numberOfContainers: Number(i.numberOfContainers),
      };
    });

    setItems(mapped);

setUnitPriceRows(
  (fullInvoice.unitPriceRows || []).map((r) => ({
    id: r.id,
    purchaseInvoiceSettingId: r.purchaseInvoiceSettingId,

    accountId: r.accountId ?? null,
    accountNumber: r.account?.accountNumber || "",

    chargeName: r.chargeName,
    chargeType: r.chargeType ?? "amount",

    value: Number(r.value ?? 0),
    valueOFR: Number(r.valueOFR ?? 0),
    currency: r.currency,

    valueExch: Number(r.valueExch ?? 0),
    valueExchOFR: Number(r.valueExchOFR ?? 0),

    addToItemCost: !!r.addToItemCost,
    invoiceNbTax: r.invoiceNbTax ?? "",
    shipping: !!r.shipping,

    supplierId: r.supplierId ?? null,

    // ✅ add these
    taxAccountId: r.taxAccountId ?? (r.taxAccount?.id ?? null),
    taxSupplierId: r.taxSupplierId ?? (r.taxSupplier?.id ?? null),

    // UI helpers (optional)
    supplierOfTax: r.taxSupplier?.supplierName || "",
    accNbOfSupplier: r.taxSupplier?.supplierAccountNumber || "",
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
      const fob = parseFloat(item.unitPrice || 0);

      const ccfr = (shippingCostInput / poAmount + 1) * fob;
      return ccfr;
    }
  };

  // 2️⃣ Final cost per item:
  const calculateFinalCost = (item) => {
    if (status !== "Recieved") {
      const cfr = calculatePriceCFR(item);
      const fc = cfr * (potentialCost / 100 + 1);
      console.log(fc);
      return fc;
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
    const base = (itemsTotalAmount || 0) + (shippingCostComputed || 0);
    if (base <= 0) return 0;
    const ratio = totalCharges / base;
    return ratio;
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
    const base = (totalOfferAmount || 0) + (shippingCostOFR || 0);
    if (base <= 0) return 0;
    return totalChargesOFR / base;
  };

  // 5️⃣ Finally, your “real” final cost:
  const realFinalCostOFR = (item) => {
    const cfr = realCalculatePriceCFROFR(item);
    const cp = getCostPercentageOFR();
    return cfr * (1 + cp);
  };

  const computedCostPercentageForDisplay = React.useMemo(() => {
    if (status !== "Recieved") return null;

    const ratio = invoiceType === "G" ? getCostPercentageOFR() : getCostPercentage();
    if (!isFinite(ratio)) return 0;
    return +(ratio * 100).toFixed(2);
  }, [
    status,
    invoiceType,
    totalCharges,
    itemsTotalAmount,
    totalChargesOFR,
    totalOfferAmount,
  ]);

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
                  disabled={isSaving}
                >
                  {isSaving ? `Saving...` : `Save Invoice (${invoiceType})`}
                </button>
                <button className="cancel-button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              </>
            ) : (
              // ✅ Wrap multiple buttons in a fragment
              <>
                <button
                  className="edit-purch-button"
                  onClick={() => setIsEditMode(true)}
                >
                  Edit Invoice
                </button>

                <button
                  className="view-jv-button"
                  onClick={handleViewJournalVoucher}
                >
                  View Journal Voucher
                </button>
              </>
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
              setUnitPriceRows([]);
              setShowUnitPriceModal(false);
              setActiveSummary("main");
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
              JV Date (تاريخ المعاملة)
              <input
                type="date"
                value={jvDate}
                onChange={(e) => setJvDate(e.target.value)}
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
                onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
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
                className="field-compact field-currency"
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
                className="field-compact field-date"
              />
            </label>

            <label>
              PO Date
              <input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                disabled={!canEdit}
                className="field-compact field-date"
              />
            </label>

            <label>
              Type
              <select
                value={invoiceType}
                onChange={(e) => setInvoiceType(e.target.value)}
                className="field-compact field-type"
                disabled={!canEdit || isInvoiceSelected}
              >
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="SR">SR</option>
                <option value="RVR">RVR</option>
              </select>
            </label>

            <label>
              VAT Percentage
              <input
                type="number"
                step="0.01"
                value={vatRate}
                onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                disabled={!canEdit}
                className="field-compact field-vat"
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
          invoiceType={invoiceType}
        />

        {showItemModal && (
          <ItemModal
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
            computedCostPercentageForDisplay={computedCostPercentageForDisplay}
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
            rows={unitPriceRows}
            onRowsChange={setUnitPriceRows}
          />
        )}
      </div>
      <div className="additional-container">
        <h3 className="tittle-label">Purchase Invoices</h3>
        <div className="purchase-invoice-cards-wrapper">
          {minimalInvoicesArr.length === 0 ? (
            <p>No invoices found.</p>
          ) : (
            minimalInvoicesArr.map((invoice) => (
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

      <div className="main-container">
        {/* ✅ Notification Modal */}
        {notif.open && (
          <NotificationModal
            type={notif.type}
            message={notif.message}
            onClose={closeNotif}
            onConfirm={closeNotif}
            confirmLabel={notif.confirmLabel}
            cancelLabel={notif.cancelLabel}
          />
        )}
      </div>
    </div>
  );
};

export default PurchasesInvoicePage;
