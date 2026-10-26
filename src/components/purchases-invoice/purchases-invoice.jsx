import React, { useState, useEffect, useMemo, useRef } from "react";

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
import ShipmentTrackingMap from "./ShipmentTrackingMap";
import ProformaOrderPickerModal from "./ProformaOrderPickerModal";
import SupplierStatementModal from "./SupplierStatementModal";
import SharedChargeModal from "./SharedChargeModal";
import InvoiceModal from "../pos-system/invoicePreviewModal";
import NotificationModal from "../recievables/NotificationModal";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
// ✅ use axiosClient (auto token)
import { axiosClient } from "../api/axiosClient";
import { getPayload, hasPerm } from "../auth/authz";
import PermGate from "../auth/PermGate";

// Which of the three tracking methods (BL number / container number /
// vessel) an invoice is using — drives which fields/buttons Summary View 2
// shows, and which field an uploaded BL's extraction result gets applied
// to. Shared by the reset/load spots below so they don't each re-derive it
// differently.
const computeTrackingMode = (inv) => {
  if (inv?.vesselImo || inv?.vesselMmsi) return "vessel";
  if (inv?.shipsgoShipmentId) return inv?.blNumber?.trim() ? "bl" : "container";
  if (inv?.vesselName?.trim()) return "vessel";
  if (inv?.containerNumber?.trim() && !inv?.blNumber?.trim()) return "container";
  return "bl";
};

const fetchSuppliersByQuery = async (query) => {
  const { data } = await axiosClient.get(`/suppliers/v1/search`, {
    params: { query },
  });
  return data;
};

// Card date = the PO date. Parsed as a local date (not UTC) so a
// "YYYY-MM-DD" value never shifts a day in the display.
const formatPoDate = (poDate) => {
  if (!poDate) return "—";
  const [y, m, d] = String(poDate).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
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
  const [status, setStatus] = useState("Proforma");
  const [showItemModal, setShowItemModal] = useState(false);
  const [sqmRepeatModal, setSqmRepeatModal] = useState({ open: false, sqmItems: [], nonSqmItems: [], value: "1" });
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
  // Alternate way to start ShipsGo tracking when shipping via a freight
  // forwarder — their house bill number won't resolve, but the container
  // number is carrier-agnostic and always works.
  const [containerNumber, setContainerNumber] = useState("");
  // Set when the currently-open invoice is itself an order spun off a
  // Proforma (via "Create Order") — lets both list columns show the rest
  // of that family, mirroring what already happens when the Proforma
  // itself is selected.
  const [viewingSourceProformaId, setViewingSourceProformaId] = useState(null);
  // Which of the three tracking methods Summary View 2 is currently set to
  // — governs which fields/buttons show there, and which field an uploaded
  // BL's extraction result gets applied to.
  const [trackingMode, setTrackingMode] = useState("bl");
  // Tracks whether the user has manually picked a tracking method for the
  // invoice currently being viewed — once true, an uploaded BL's detected
  // vessel name no longer auto-switches the mode out from under them.
  const hasUserPickedTrackingModeRef = useRef(false);
  const handleTrackingModeChange = (mode) => {
    hasUserPickedTrackingModeRef.current = true;
    setTrackingMode(mode);
  };
  const [blDocumentPath, setBlDocumentPath] = useState(null);
  const [isUploadingBlDocument, setIsUploadingBlDocument] = useState(false);
  const [isUploadingOtherDocuments, setIsUploadingOtherDocuments] = useState(false);
  const [shipsgoShipmentId, setShipsgoShipmentId] = useState(null);
  const [shipsgoStatus, setShipsgoStatus] = useState(null);
  const [shipsgoLastCheckedAt, setShipsgoLastCheckedAt] = useState(null);
  const [isTrackingShipment, setIsTrackingShipment] = useState(false);
  // Charter-party/bulk-vessel tracking (AIS) — separate from ShipsGo above,
  // used when there's no liner carrier/booking number, only a vessel name.
  const [vesselName, setVesselName] = useState("");
  const [vesselImo, setVesselImo] = useState(null);
  const [vesselMmsi, setVesselMmsi] = useState(null);
  const [vesselNavStatus, setVesselNavStatus] = useState(null);
  const [vesselSpeedKnots, setVesselSpeedKnots] = useState(null);
  const [vesselArrivedAtPort, setVesselArrivedAtPort] = useState(null);
  const [vesselLastCheckedAt, setVesselLastCheckedAt] = useState(null);
  // VesselAPI's own reported AIS fix time — distinct from vesselLastCheckedAt
  // (when we merely asked); this is the honest freshness signal, since a
  // provider's feed for a given vessel can stall independent of how often
  // we poll it.
  const [vesselPositionAt, setVesselPositionAt] = useState(null);
  const [isSearchingVessel, setIsSearchingVessel] = useState(false);
  const [isTrackingVessel, setIsTrackingVessel] = useState(false);
  const [vesselSearchResults, setVesselSearchResults] = useState([]);
  const [showVesselPicker, setShowVesselPicker] = useState(false);
  // Placeholder toggles above the Order/Invoices columns — behavior TBD
  const [orderColumnToggle, setOrderColumnToggle] = useState(false);
  const [invoicesColumnToggle, setInvoicesColumnToggle] = useState(false);
  // In مصاريف (Expenses) mode, lets the user hide the items table so the
  // expenses panel can take the full row width.
  const [itemsTableCollapsed, setItemsTableCollapsed] = useState(false);
  // The system-assigned PV.../ORD... number (distinct from the "Invoice
  // Number" field above, which is actually the supplier's own reference).
  const [systemInvoiceNumber, setSystemInvoiceNumber] = useState(null);
  const [systemOrderNumber, setSystemOrderNumber] = useState(null);
  const [systemProformaNumber, setSystemProformaNumber] = useState(null);
  const [isProformaCompleted, setIsProformaCompleted] = useState(false);
  const [isTogglingProformaCompleted, setIsTogglingProformaCompleted] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const isInvoiceSelected = selectedInvoiceId !== null;
  const canEdit = !isInvoiceSelected || isEditMode;
  const isAdmin = getPayload()?.role === "ADMIN";
  // Gates the Track Shipment / Track Vessel / Attach Bill of Lading buttons
  // in Summary View 2 — separate from the broader purchases.update, since
  // those three specifically start/attach shipment tracking rather than
  // just editing invoice fields.
  const canManageShipmentTracking = hasPerm("purchases.shipmentTracking");
  const [invoiceType, setInvoiceType] = useState("S");
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [jvDate, setJvDate] = useState(new Date().toISOString().slice(0, 10)); // تاريخ المعاملة
  const [isPurchaseReturn, setIsPurchaseReturn] = useState(false);
  const [returnBaseType, setReturnBaseType] = useState("S");
  const [warehouse, setWarehouse] = useState("");
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const homeWarehouseRef = useRef("");
  const saveLockRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showProformaOrderPicker, setShowProformaOrderPicker] = useState(false);
  const [showSupplierStatement, setShowSupplierStatement] = useState(false);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [showSharedChargeModal, setShowSharedChargeModal] = useState(false);
  const queryClient = useQueryClient();

  const resetFields = () => {
    const today = new Date().toISOString().slice(0, 10);

    // 🔹 Header fields
    setSupplierName("");
    setSelectedSupplierId(null);
    setInvoiceNumber("");
    setSystemInvoiceNumber(null);
    setSystemOrderNumber(null);
    setSystemProformaNumber(null);
    setIsProformaCompleted(false);
    setStatus("Proforma");
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
    setContainerNumber("");
    setViewingSourceProformaId(null);
    setTrackingMode("bl");
    hasUserPickedTrackingModeRef.current = false;
    setBlDocumentPath(null);
    setShipsgoShipmentId(null);
    setShipsgoStatus(null);
    setShipsgoLastCheckedAt(null);
    setVesselName("");
    setVesselImo(null);
    setVesselMmsi(null);
    setVesselNavStatus(null);
    setVesselSpeedKnots(null);
    setVesselArrivedAtPort(null);
    setVesselLastCheckedAt(null);
    setVesselPositionAt(null);
    setVesselSearchResults([]);
    setShowVesselPicker(false);

    // 🔹 Unit price / modals
    setShowUnitPriceModal(false);
    setUnitPriceRows([]);
    setShowItemModal(false);

    // 🔹 OFR-related
    setShippingCostComputed(0);
    setShippingCostOFR(0);
    setTotalChargesOFR(0);

    setShowTypePopup(false);
    setIsPurchaseReturn(false);
    setReturnBaseType("S");
    setWarehouse(homeWarehouseRef.current || warehouseOptions[0] || "");
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

// Opens the item picker for spinning off a new order from the
// currently-selected Proforma — the Proforma itself is left completely
// untouched (no status mutation), matching the "always there, nothing
// changes in it" rule. A Proforma is often split across several separate
// orders shipped at different times, so which lines/quantities go into
// this particular order is picked explicitly rather than copying everything.
const handleCreateOrderFromProforma = () => {
  if (!selectedInvoiceId) return;
  setShowProformaOrderPicker(true);
};

const handleProformaOrderCreated = async (newOrder) => {
  setShowProformaOrderPicker(false);
  openNotif("success", `Order created: ${newOrder?.orderNumber || `#${newOrder?.id}`}`);
  await queryClient.invalidateQueries({ queryKey: ["minimal-invoices"] });
  if (newOrder?.id) {
    setIsEditMode(false);
    setSelectedInvoiceId(newOrder.id);
  }
};

const handleSharedChargeCreated = async (result, affectedInvoiceIds) => {
  setShowSharedChargeModal(false);
  openNotif("success", `Charge split across ${affectedInvoiceIds.length} invoices.`);
  await queryClient.invalidateQueries({ queryKey: ["minimal-invoices"] });
  // If one of the invoices just touched happens to be the one currently
  // open, refetch it so Summary 1's live final-cost calculation (which
  // reads straight from unitPriceRows) picks up the new charge right away.
  if (selectedInvoiceId && affectedInvoiceIds.includes(selectedInvoiceId)) {
    await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
  }
};

// Manual mark, independent of remaining quantities or linked orders'
// statuses — purely "I'm done splitting orders off this proforma", so the
// Proforma column's Completed filter has something to go on.
const handleToggleProformaCompleted = async () => {
  if (!selectedInvoiceId) return;
  const next = !isProformaCompleted;
  setIsTogglingProformaCompleted(true);
  try {
    await axiosClient.put(`/purchase-invoices/${selectedInvoiceId}/complete`, { completed: next });
    setIsProformaCompleted(next);
    openNotif("success", next ? "Marked as completed." : "Marked as not completed.");
    await queryClient.invalidateQueries({ queryKey: ["minimal-invoices"] });
  } catch (err) {
    openNotif(
      "error",
      err?.response?.data?.message || err.message || "Failed to update completed status."
    );
  } finally {
    setIsTogglingProformaCompleted(false);
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

  const buildItemRow = (item) => ({
    id: Date.now() + Math.random(),
    ...item,
    quantity: item.quantity || 1,
    sqm:
      ((item.length || 0) *
        (item.width || 0) *
        (item.quantity || 1) *
        (item.sheetsPerBox || 1)) /
      10000,
    unitPrice: item.unitPrice || 0,
    total: 0,
  });

  const closeItemModal = () => {
    const sqmItems = selectedItems.filter((i) => String(i.type || "").toLowerCase() === "sqm");
    const nonSqmItems = selectedItems.filter((i) => String(i.type || "").toLowerCase() !== "sqm");

    if (nonSqmItems.length > 0) {
      setItems((prev) => [...prev, ...nonSqmItems.map(buildItemRow)]);
    }

    if (sqmItems.length > 0) {
      // Queue: show modal one item at a time
      setSqmRepeatModal({ open: true, queue: sqmItems, value: "1", _total: sqmItems.length });
    }

    setSelectedItems([]);
    setShowItemModal(false);
  };

  const confirmSqmRepeat = () => {
    const repeat = Math.max(1, Math.floor(Number(sqmRepeatModal.value) || 1));
    const current = sqmRepeatModal.queue[0];
    const newRows = Array.from({ length: repeat }, () => buildItemRow(current));
    setItems((prev) => [...prev, ...newRows]);

    const remaining = sqmRepeatModal.queue.slice(1);
    if (remaining.length > 0) {
      setSqmRepeatModal({ open: true, queue: remaining, value: "1", _total: sqmRepeatModal._total });
    } else {
      setSqmRepeatModal({ open: false, queue: [], value: "1", _total: 0 });
    }
  };

  const getCorrectShippingCost = () => {
    const et = (invoiceType === "PR" || isPurchaseReturn) ? returnBaseType : invoiceType;
    if (et === "S") return shippingCostComputed;
    if (et === "G" || et === "SR" || et === "RVR") return shippingCostOFR;
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

  useEffect(() => {
    axiosClient.get("/warehouses").then((res) => {
      const data = res?.data || [];
      const list = data.map((w) => w.name);
      if (list.length > 0) {
        const home = data.find((w) => w.isHome)?.name || list[0];
        homeWarehouseRef.current = home;
        setWarehouseOptions(list);
        setWarehouse((prev) => (prev ? prev : home));
      }
    }).catch(() => {});
  }, []);

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

  const handleTrackShipment = async () => {
    if (!selectedInvoiceId) {
      openNotif("warning", "Save the invoice first, then track its shipment.");
      return;
    }
    if (!blNumber?.trim() && !containerNumber?.trim()) {
      openNotif("warning", "Enter a BL number or a container number before tracking the shipment.");
      return;
    }
    setIsTrackingShipment(true);
    try {
      const res = await axiosClient.post(`/purchase-invoices/${selectedInvoiceId}/track-shipment`);
      const updated = res.data?.invoice;
      if (updated) {
        setShipsgoShipmentId(updated.shipsgoShipmentId ?? null);
        setShipsgoStatus(updated.shipsgoStatus ?? null);
        setShipsgoLastCheckedAt(updated.shipsgoLastCheckedAt ?? null);
      }
      openNotif("success", "Shipment tracking started — it'll show up on the Shipment Tracking page shortly.");
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to start shipment tracking."
      );
    } finally {
      setIsTrackingShipment(false);
    }
  };

  // On-demand re-check of the linked ShipsGo shipment's status, rather than
  // waiting for the next cron tick.
  const handleSyncShipment = async () => {
    if (!selectedInvoiceId || !shipsgoShipmentId) return;
    setIsTrackingShipment(true);
    try {
      const res = await axiosClient.post(`/purchase-invoices/${selectedInvoiceId}/sync-shipment`);
      const updated = res.data;
      if (updated) {
        setShipsgoStatus(updated.shipsgoStatus ?? null);
        setShipsgoLastCheckedAt(updated.shipsgoLastCheckedAt ?? null);
      }
      openNotif("success", "Shipment status refreshed.");
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to refresh the shipment's status."
      );
    } finally {
      setIsTrackingShipment(false);
    }
  };

  // Unlinks the ShipsGo shipment — for when the wrong BL was tracked by
  // mistake. Confirms first since it also deletes the shipment on ShipsGo's
  // side (frees the credit/slot there).
  const handleUntrackShipment = async () => {
    if (!selectedInvoiceId || !shipsgoShipmentId) return;
    if (!window.confirm("Stop tracking this shipment? This removes it from ShipsGo and the Shipment Tracking page.")) {
      return;
    }
    setIsTrackingShipment(true);
    try {
      await axiosClient.delete(`/purchase-invoices/${selectedInvoiceId}/track-shipment`);
      setShipsgoShipmentId(null);
      setShipsgoStatus(null);
      setShipsgoLastCheckedAt(null);
      openNotif("success", "Shipment tracking removed.");
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to remove shipment tracking."
      );
    } finally {
      setIsTrackingShipment(false);
    }
  };

  const handleUploadBlDocument = async (file) => {
    if (!selectedInvoiceId) {
      openNotif("warning", "Save the invoice first, then attach the Bill of Lading.");
      return;
    }
    if (!file) return;
    setIsUploadingBlDocument(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", trackingMode);
      formData.append("modeLocked", String(hasUserPickedTrackingModeRef.current));
      const res = await axiosClient.post(
        `/purchase-invoices/${selectedInvoiceId}/bl-document`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      const updated = res.data?.invoice;
      if (updated) {
        setBlDocumentPath(updated.blDocumentPath ?? null);
      }
      const {
        found,
        blNumber: extractedBlNumber,
        vesselName: extractedVesselName,
        containerNumber: extractedContainerNumber,
        shippingLine: extractedShippingLine,
      } = res.data?.extracted || {};

      // A detected vessel name means this is a charter-party BL — switch to
      // Vessel mode automatically (that's the point of detecting it), unless
      // the user already deliberately picked a different mode themselves.
      const effectiveMode =
        extractedVesselName && !hasUserPickedTrackingModeRef.current ? "vessel" : trackingMode;
      if (effectiveMode !== trackingMode) setTrackingMode(effectiveMode);

      // Shipping Line is shared by both liner modes (bl/container), unlike
      // the mode-exclusive fields below — same carrier hint either way.
      if ((effectiveMode === "bl" || effectiveMode === "container") && extractedShippingLine) {
        setShippingLine(extractedShippingLine);
      }
      const shippingLineNote = extractedShippingLine ? ` · carrier: ${extractedShippingLine}` : "";

      // Strictly scoped to whichever mode is active — never touches the
      // other two fields, even silently, so switching tabs never reveals a
      // value that came from a document that was never actually about that
      // field (e.g. a normal liner BL's extraction never touches Vessel
      // Name, even though the backend happens to always try reading one).
      if (effectiveMode === "vessel") {
        if (extractedVesselName) {
          setVesselName(extractedVesselName);
          openNotif("success", `BL document attached — vessel name auto-filled: ${extractedVesselName}`);
        } else {
          openNotif(
            "info",
            "BL document attached, but no vessel name was found on it — please enter it manually."
          );
        }
      } else if (effectiveMode === "container") {
        if (extractedContainerNumber) {
          setContainerNumber(extractedContainerNumber);
          openNotif(
            "success",
            `BL document attached — container number auto-filled: ${extractedContainerNumber}${shippingLineNote}`
          );
        } else {
          openNotif(
            "info",
            "BL document attached, but the container number couldn't be read automatically — please enter it manually."
          );
        }
      } else if (found && extractedBlNumber) {
        setBlNumber(extractedBlNumber);
        openNotif("success", `BL document attached — BL number auto-filled: ${extractedBlNumber}${shippingLineNote}`);
      } else {
        openNotif(
          "info",
          "BL document attached, but the BL number couldn't be read automatically — please enter it manually."
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to upload the BL document."
      );
    } finally {
      setIsUploadingBlDocument(false);
    }
  };

  // Fetches the attached BL scan as a blob (auth header attached by
  // axiosClient's interceptor) and either opens it in a new tab ("view") or
  // triggers a save-as download ("download").
  const handleOpenBlDocument = async (mode) => {
    if (!selectedInvoiceId || !blDocumentPath) return;
    try {
      const res = await axiosClient.get(
        `/purchase-invoices/${selectedInvoiceId}/bl-document`,
        { responseType: "blob" }
      );
      const objectUrl = URL.createObjectURL(res.data);
      if (mode === "download") {
        const fileName = blDocumentPath.split(/[/\\]/).pop() || "bill-of-lading";
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to load the BL document."
      );
    }
  };

  // Plain supporting documents (packing list, invoice copy, certificate of
  // origin, etc.) — just saved and stored, no Claude extraction, any number
  // per invoice. Separate from the BL document upload above.
  const handleUploadOtherDocuments = async (files) => {
    if (!selectedInvoiceId) {
      openNotif("warning", "Save the invoice first, then attach documents.");
      return;
    }
    if (!files?.length) return;
    setIsUploadingOtherDocuments(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      await axiosClient.post(
        `/purchase-invoices/${selectedInvoiceId}/documents`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      openNotif("success", `${files.length} document${files.length > 1 ? "s" : ""} attached.`);
      await queryClient.invalidateQueries({ queryKey: ["invoice-documents", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to upload the document(s)."
      );
    } finally {
      setIsUploadingOtherDocuments(false);
    }
  };

  const handleOpenOtherDocument = async (doc, mode) => {
    if (!selectedInvoiceId || !doc) return;
    try {
      const res = await axiosClient.get(
        `/purchase-invoices/${selectedInvoiceId}/documents/${doc.id}`,
        { responseType: "blob" }
      );
      const objectUrl = URL.createObjectURL(res.data);
      if (mode === "download") {
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = doc.originalFileName || "document";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        window.open(objectUrl, "_blank", "noopener,noreferrer");
      }
      setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to load the document."
      );
    }
  };

  const handleDeleteOtherDocument = async (doc) => {
    if (!selectedInvoiceId || !doc) return;
    if (!window.confirm(`Delete "${doc.originalFileName}"?`)) return;
    try {
      await axiosClient.delete(`/purchase-invoices/${selectedInvoiceId}/documents/${doc.id}`);
      openNotif("success", "Document deleted.");
      await queryClient.invalidateQueries({ queryKey: ["invoice-documents", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to delete the document."
      );
    }
  };

  // Vessel names aren't unique, so this only fetches candidates — it never
  // saves anything by itself. Opens the picker once results come back.
  const handleSearchVessel = async () => {
    if (!selectedInvoiceId) {
      openNotif("warning", "Save the invoice first, then search for its vessel.");
      return;
    }
    if (!vesselName?.trim()) {
      openNotif("warning", "Enter a vessel name before searching.");
      return;
    }
    setIsSearchingVessel(true);
    try {
      const res = await axiosClient.get(`/purchase-invoices/${selectedInvoiceId}/vessel-search`, {
        params: { name: vesselName.trim() },
      });
      const results = Array.isArray(res.data) ? res.data : [];
      setVesselSearchResults(results);
      if (results.length === 0) {
        openNotif("info", `No vessel named "${vesselName.trim()}" was found.`);
      } else {
        setShowVesselPicker(true);
      }
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to search for the vessel."
      );
    } finally {
      setIsSearchingVessel(false);
    }
  };

  // Confirms a specific vessel from the search results and starts tracking it.
  const handleConfirmVesselTracking = async (candidate) => {
    if (!selectedInvoiceId) return;
    setIsTrackingVessel(true);
    try {
      const res = await axiosClient.post(`/purchase-invoices/${selectedInvoiceId}/track-vessel`, {
        imo: candidate.imo,
        mmsi: candidate.mmsi,
        name: candidate.name,
      });
      const updated = res.data;
      if (updated) {
        setVesselName(updated.vesselName ?? candidate.name);
        setVesselImo(updated.vesselImo ?? null);
        setVesselMmsi(updated.vesselMmsi ?? null);
        setVesselNavStatus(updated.vesselNavStatus ?? null);
        setVesselSpeedKnots(updated.vesselSpeedKnots ?? null);
        setVesselArrivedAtPort(updated.vesselArrivedAtPort ?? null);
        setVesselLastCheckedAt(updated.vesselLastCheckedAt ?? null);
        setVesselPositionAt(updated.vesselPositionAt ?? null);
      }
      setShowVesselPicker(false);
      setVesselSearchResults([]);
      openNotif("success", `Now tracking ${candidate.name} — position updates automatically.`);
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to start vessel tracking."
      );
    } finally {
      setIsTrackingVessel(false);
    }
  };

  // On-demand re-check of the tracked vessel's position, rather than waiting
  // for the 30-min cron.
  const handleSyncVessel = async () => {
    if (!selectedInvoiceId) return;
    setIsTrackingVessel(true);
    try {
      const res = await axiosClient.post(`/purchase-invoices/${selectedInvoiceId}/sync-vessel`);
      const updated = res.data;
      if (updated) {
        setVesselNavStatus(updated.vesselNavStatus ?? null);
        setVesselSpeedKnots(updated.vesselSpeedKnots ?? null);
        setVesselArrivedAtPort(updated.vesselArrivedAtPort ?? null);
        setVesselLastCheckedAt(updated.vesselLastCheckedAt ?? null);
        setVesselPositionAt(updated.vesselPositionAt ?? null);
      }
      openNotif("success", "Vessel position refreshed.");
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to refresh the vessel's position."
      );
    } finally {
      setIsTrackingVessel(false);
    }
  };

  // Unlinks the tracked vessel — for when the wrong one was picked from the
  // name-search results. Keeps the typed vessel name so the field goes back
  // to editable/re-searchable instead of forcing a retype.
  const handleUntrackVessel = async () => {
    if (!selectedInvoiceId || !(vesselImo || vesselMmsi)) return;
    if (!window.confirm("Stop tracking this vessel? You can search and re-track it again afterward.")) {
      return;
    }
    setIsTrackingVessel(true);
    try {
      await axiosClient.delete(`/purchase-invoices/${selectedInvoiceId}/track-vessel`);
      setVesselImo(null);
      setVesselMmsi(null);
      setVesselNavStatus(null);
      setVesselSpeedKnots(null);
      setVesselArrivedAtPort(null);
      setVesselLastCheckedAt(null);
      setVesselPositionAt(null);
      openNotif("success", "Vessel tracking removed.");
      await queryClient.invalidateQueries({ queryKey: ["invoice", selectedInvoiceId] });
    } catch (err) {
      openNotif(
        "error",
        err?.response?.data?.message || err.message || "Failed to remove vessel tracking."
      );
    } finally {
      setIsTrackingVessel(false);
    }
  };

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
      const totalAmount = items.reduce((sum, item) => sum + (item.total || 0), 0);
      // Grand amount mirrors the Summary's "Total Amount" — offer (OFR) pricing
      // is a parallel figure, not an addition, so it must not be summed in.
      const calculatedVatAmount = type !== "G" ? totalAmount * (vatRate / 100) : 0;
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
        warehouse,
        vatAmount: calculatedVatAmount.toFixed(2),
        vatPercent: vatRate,
        grandAmount: grandTotal,
        exchangeRate,
        status,
        shippingLine,
        etd,
        numberOfContainers: altContainers,
        blNumber,
        containerNumber,
        vesselName,
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
      } else if (isPurchaseReturn) {
        res = await axiosClient.post(`/purchase-invoices/return`, {
          ...invoiceData,
          baseType: returnBaseType,
        });
        openNotif("success", `Purchase return saved: ${res.data.invoiceNumber}`);
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
      case "Proforma":
        return "#93c5fd";
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

  const minimalInvoicesArr = useMemo(
    () => (Array.isArray(minimalInvoices) ? minimalInvoices : []),
    [minimalInvoices]
  );

  // The Proforma that ties the currently-open invoice's family together —
  // its own id if it IS the Proforma, or the Proforma it was spun off from
  // if it's one of the orders. Works in both directions: opening either the
  // Proforma or any one of its orders shows the whole family in both
  // columns.
  const familyProformaId =
    isInvoiceSelected && selectedInvoiceId
      ? status === "Proforma"
        ? selectedInvoiceId
        : viewingSourceProformaId
      : null;

  // Proforma column: still just a quote, not yet a firm order. Narrows to
  // just the one Proforma tying the family together when viewing any
  // member of that family (an order shows its own source Proforma here).
  const ordersList = useMemo(() => {
    const base = minimalInvoicesArr.filter((inv) => inv.status === "Proforma");
    if (familyProformaId) {
      return base.filter((inv) => inv.id === familyProformaId);
    }
    // Newest PO date first; proformas without one go last, ties by newest id.
    return [...base].sort((a, b) => {
      const da = a.poDate ? String(a.poDate).slice(0, 10) : "";
      const db = b.poDate ? String(b.poDate).slice(0, 10) : "";
      if (da !== db) return db.localeCompare(da);
      return (b.id || 0) - (a.id || 0);
    });
  }, [minimalInvoicesArr, familyProformaId]);

  const [proformaListSearch, setProformaListSearch] = useState("");
  // "all" | "completed" | "uncompleted"
  const [proformaFilterMode, setProformaFilterMode] = useState("all");
  const filteredOrdersList = useMemo(() => {
    let list = ordersList;
    if (proformaFilterMode === "completed") {
      list = list.filter((inv) => inv.isCompleted);
    } else if (proformaFilterMode === "uncompleted") {
      list = list.filter((inv) => !inv.isCompleted);
    }
    const q = proformaListSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((inv) => {
        const proforma = String(inv.proformaNumber || "").toLowerCase();
        const supplier = String(inv.supplier?.supplierName || "").toLowerCase();
        return proforma.includes(q) || supplier.includes(q);
      });
    }
    return list;
  }, [ordersList, proformaListSearch, proformaFilterMode]);

  // Invoices column: a firm order onward — Ordered (red), Shipped (yellow),
  // or Recieved. Narrows to just the orders sharing the same source
  // Proforma when viewing any member of that family — click the Proforma
  // to see what came from it, or click one of those orders to see its
  // siblings (and the shared Proforma shows up on the left).
  const shippedOrRecievedList = useMemo(() => {
    const base = minimalInvoicesArr.filter(
      (inv) => inv.status === "Ordered" || inv.status === "Shipped" || inv.status === "Recieved"
    );
    if (familyProformaId) {
      return base.filter((inv) => inv.sourceProformaId === familyProformaId);
    }
    return base;
  }, [minimalInvoicesArr, familyProformaId]);

  const [invoiceListSearch, setInvoiceListSearch] = useState("");
  const filteredMinimalInvoices = useMemo(() => {
    const q = invoiceListSearch.trim().toLowerCase();
    if (!q) return shippedOrRecievedList;
    return shippedOrRecievedList.filter((inv) => {
      const po = String(inv.invoiceNumber || "").toLowerCase();
      const order = String(inv.orderNumber || "").toLowerCase();
      const supplier = String(inv.supplier?.supplierName || "").toLowerCase();
      return po.includes(q) || order.includes(q) || supplier.includes(q);
    });
  }, [shippedOrRecievedList, invoiceListSearch]);

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

  const { data: otherDocuments = [] } = useQuery({
    queryKey: ["invoice-documents", selectedInvoiceId],
    queryFn: () =>
      axiosClient
        .get(`/purchase-invoices/${selectedInvoiceId}/documents`)
        .then((res) => res.data),
    enabled: Boolean(selectedInvoiceId),
  });

  useEffect(() => {
    if (!fullInvoice) return;

    // 1) supplier
    setSupplierName(fullInvoice.supplier.supplierName);
    setSelectedSupplierId(fullInvoice.supplier.id);
    // 2) invoice & dates
    setInvoiceNumber(fullInvoice.supplierInvoiceNumber ?? "");
    setSystemInvoiceNumber(fullInvoice.invoiceNumber ?? null);
    setSystemOrderNumber(fullInvoice.orderNumber ?? null);
    setSystemProformaNumber(fullInvoice.proformaNumber ?? null);
    setIsProformaCompleted(Boolean(fullInvoice.isCompleted));
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
    setShippingLine(fullInvoice.shippingLine ?? "");
    setEtd(fullInvoice.etd ?? "");
    setAltContainers(fullInvoice.numberOfContainers ?? 0);
    setBlNumber(fullInvoice.blNumber ?? "");
    setContainerNumber(fullInvoice.containerNumber ?? "");
    setBlDocumentPath(fullInvoice.blDocumentPath ?? null);
    setShipsgoShipmentId(fullInvoice.shipsgoShipmentId ?? null);
    setShipsgoStatus(fullInvoice.shipsgoStatus ?? null);
    setShipsgoLastCheckedAt(fullInvoice.shipsgoLastCheckedAt ?? null);
    setVesselName(fullInvoice.vesselName ?? "");
    setVesselImo(fullInvoice.vesselImo ?? null);
    setVesselMmsi(fullInvoice.vesselMmsi ?? null);
    setVesselNavStatus(fullInvoice.vesselNavStatus ?? null);
    setVesselSpeedKnots(fullInvoice.vesselSpeedKnots ?? null);
    setVesselArrivedAtPort(fullInvoice.vesselArrivedAtPort ?? null);
    setVesselLastCheckedAt(fullInvoice.vesselLastCheckedAt ?? null);
    setVesselPositionAt(fullInvoice.vesselPositionAt ?? null);
    setTrackingMode(computeTrackingMode(fullInvoice));
    setViewingSourceProformaId(fullInvoice.sourceProformaId ?? null);
    hasUserPickedTrackingModeRef.current = false;
    setPotentialCost(Number(fullInvoice.potentialCost));
    setShippingCostInput(Number(fullInvoice.shippingCost));
    setFinalCost(Number(fullInvoice.finalCost));
    setInvoiceType(fullInvoice.type);
    if (fullInvoice.type === "PR") {
      setIsPurchaseReturn(true);
      setReturnBaseType(fullInvoice.returnBaseType || "S");
    } else {
      setIsPurchaseReturn(false);
      setReturnBaseType("S");
    }
    setWarehouse(fullInvoice.warehouse ?? homeWarehouseRef.current ?? "");
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
    setSystemInvoiceNumber(inv.invoiceNumber ?? null);
    setSystemOrderNumber(inv.orderNumber ?? null);
    setSystemProformaNumber(inv.proformaNumber ?? null);
    setIsProformaCompleted(Boolean(inv.isCompleted));
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
    setShippingLine(inv.shippingLine ?? "");
    setEtd(inv.etd ?? "");
    setAltContainers(inv.numberOfContainers ?? 0);
    setBlNumber(inv.blNumber ?? "");
    setContainerNumber(inv.containerNumber ?? "");
    setBlDocumentPath(inv.blDocumentPath ?? null);
    setShipsgoShipmentId(inv.shipsgoShipmentId ?? null);
    setShipsgoStatus(inv.shipsgoStatus ?? null);
    setShipsgoLastCheckedAt(inv.shipsgoLastCheckedAt ?? null);
    setVesselName(inv.vesselName ?? "");
    setVesselImo(inv.vesselImo ?? null);
    setVesselMmsi(inv.vesselMmsi ?? null);
    setVesselNavStatus(inv.vesselNavStatus ?? null);
    setVesselSpeedKnots(inv.vesselSpeedKnots ?? null);
    setVesselArrivedAtPort(inv.vesselArrivedAtPort ?? null);
    setVesselLastCheckedAt(inv.vesselLastCheckedAt ?? null);
    setVesselPositionAt(inv.vesselPositionAt ?? null);
    setTrackingMode(computeTrackingMode(inv));
    setViewingSourceProformaId(inv.sourceProformaId ?? null);
    hasUserPickedTrackingModeRef.current = false;
    setPotentialCost(Number(inv.potentialCost));
    setShippingCostInput(Number(inv.shippingCost));
    setFinalCost(Number(inv.finalCost));
    setInvoiceType(inv.type);
    if (inv.type === "PR") {
      setIsPurchaseReturn(true);
      setReturnBaseType(inv.returnBaseType || "S");
    } else {
      setIsPurchaseReturn(false);
      setReturnBaseType("S");
    }
    setWarehouse(inv.warehouse ?? homeWarehouseRef.current ?? "");
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

    const et = (invoiceType === "PR" || isPurchaseReturn) ? returnBaseType : invoiceType;
    const ratio = et === "G" ? getCostPercentageOFR() : getCostPercentage();
    if (!isFinite(ratio)) return 0;
    return +(ratio * 100).toFixed(2);
  }, [
    status,
    invoiceType,
    returnBaseType,
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

  const effectiveType = (invoiceType === "PR" || isPurchaseReturn) ? returnBaseType : invoiceType;

  if (status === "Recieved") {
    if (effectiveType === "S") {
      normalCfrFn = realCalculatePriceCFR;
      normalFinalFn = realFinalCost;
      ofrCfrFn = realCalculatePriceCFR;
      ofrFinalFn = realFinalCost;
    } else if (effectiveType === "G") {
      normalCfrFn = () => 0;
      normalFinalFn = () => 0;
      ofrCfrFn = realCalculatePriceCFROFR;
      ofrFinalFn = realFinalCostOFR;
    } else if (effectiveType === "SR") {
      normalCfrFn = realCalculatePriceCFR;
      normalFinalFn = realFinalCost;
      ofrCfrFn = realCalculatePriceCFROFR;
      ofrFinalFn = realFinalCostOFR;
    } else if (effectiveType === "RVR") {
      normalCfrFn = realCalculatePriceCFR;
      normalFinalFn = realFinalCost;
      ofrCfrFn = () => 0;
      ofrFinalFn = () => 0;
    }
  }

  // Shape the current invoice into the sale InvoiceModal's data format so
  // the purchase view prints with the exact same layout. A G invoice shows
  // the OFR figures (SQM OFR / Price OFR / Total OFR) and totals like the
  // Summary's "Offer Amount"; every other type shows the normal figures and
  // totals like "Total Amount". VAT is applied in both cases, same as there.
  const buildPurchasePreviewData = () => {
    const supplier = fullInvoice?.supplier || {};
    const useOfr = invoiceType === "G";
    const totalWithoutVAT = Number((useOfr ? totalOfferAmount : itemsTotalAmount).toFixed(2));
    const totalVAT = Number((totalWithoutVAT * (Number(vatRate) || 0) / 100).toFixed(2));
    return {
      invoiceNumber: systemInvoiceNumber || systemOrderNumber || systemProformaNumber || invoiceNumber || "",
      date: inputedDate,
      customerName: supplier.supplierName || supplierName || "",
      customerAddress: supplier.address || "",
      customerPhone: supplier.phoneNumber || "",
      customerAccountNumber: supplier.supplierAccountNumber || "",
      customerTaxNumber: supplier.financialNumber || "",
      // VAT LBP line needs an LBP rate — exchangeRate holds one for USD
      // invoices; a EURO invoice's rate is EUR→USD, so fall back there.
      currencyRate: currency === "USD" ? Number(exchangeRate) || 89500 : 89500,
      currencyCode: "USD",
      vatPercentage: Number(vatRate) || 0,
      totalWithoutVAT,
      totalVAT,
      grandTotal: Number((totalWithoutVAT + totalVAT).toFixed(2)),
      invoiceType,
      items: items.map((it, idx) => ({
        itemNumber: idx + 1,
        itemName: it.itemName,
        thickness: it.thickness,
        itemType: String(it.type || "").toLowerCase(),
        quantity: it.quantity,
        sheetsPerBox: it.sheetsPerBox,
        length: it.length,
        width: it.width,
        sqm: useOfr ? it.sqmOfr : it.sqm,
        unitPrice: useOfr ? it.priceOFR : it.unitPrice,
        totalAmount: Number((useOfr ? it.totalOFR : it.total) || 0),
      })),
    };
  };

  const purchaseDocNumberLabel =
    invoiceType === "PR"
      ? "مرتجع شراء رقم"
      : systemInvoiceNumber
      ? "رقم الفاتورة"
      : systemOrderNumber
      ? "رقم الطلبية"
      : "Proforma #";

return (
  <div className="pi-page-shell">
      <div className="pi-page-toggles">
        <div className="pi-toggle-slot">
          <label className="pi-column-toggle">
            <input
              type="checkbox"
              checked={orderColumnToggle}
              onChange={() => setOrderColumnToggle((v) => !v)}
            />
            <span className="pi-column-toggle-slider" />
          </label>
          <span className="pi-toggle-label">Shipment Tracking</span>
        </div>
        <div className="pi-toggle-slot pi-toggle-slot--center" />
        <div className="pi-toggle-slot pi-toggle-slot--right">
          <span className="pi-toggle-label" dir="rtl">مصاريف</span>
          <label className="pi-column-toggle">
            <input
              type="checkbox"
              checked={invoicesColumnToggle}
              onChange={() => setInvoicesColumnToggle((v) => !v)}
            />
            <span className="pi-column-toggle-slider" />
          </label>
        </div>
      </div>

      {orderColumnToggle ? (
        <ShipmentTrackingMap />
      ) : (
        <>
      <div className="header">
        <h2>
          {isInvoiceSelected
            ? isEditMode
              ? invoiceType === "PR" ? "Edit Purchase Return" : "Edit Purchase Invoice"
              : invoiceType === "PR" ? "View Purchase Return" : "View Purchase Invoice"
            : isPurchaseReturn
            ? "Create Purchase Return (مرتجع فاتورة شراء)"
            : "Create Purchase Invoice"}
        </h2>
        {isInvoiceSelected && (systemInvoiceNumber || systemOrderNumber || systemProformaNumber) && (
          systemInvoiceNumber ? (
            <span className="pi-doc-number-badge">{systemInvoiceNumber}</span>
          ) : systemOrderNumber ? (
            <span
              className="pi-doc-number-badge pi-doc-number-badge--pending"
              title="Not yet Recieved — this becomes a real invoice number once it is"
            >
              Order {systemOrderNumber}
            </span>
          ) : (
            <span
              className="pi-doc-number-badge pi-doc-number-badge--pending"
              title="Still Proforma — this becomes a real invoice number once Recieved"
            >
              Proforma {systemProformaNumber}
            </span>
          )
        )}
        <div className="button-container">
          {isInvoiceSelected ? (
            isEditMode ? (
              <>
                <button
                  className="save-button"
                  onClick={() => saveInvoice(invoiceType)}
                  disabled={isSaving}
                >
                  {isSaving ? `Saving...` : `Save (${invoiceType})`}
                </button>
                <button className="cancel-button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className="edit-purch-button"
                  onClick={() => setIsEditMode(true)}
                >
                  Edit Invoice
                </button>

                {status === "Proforma" && (
                  <button
                    className="edit-purch-button"
                    onClick={handleCreateOrderFromProforma}
                    title="Pick items/quantities to spin off a new, separate order — this proforma stays unchanged"
                  >
                    Create Order
                  </button>
                )}

                {status === "Proforma" && (
                  <button
                    className={`mark-completed-button${isProformaCompleted ? " is-completed" : ""}`}
                    onClick={handleToggleProformaCompleted}
                    disabled={isTogglingProformaCompleted}
                    title="Manual mark — doesn't affect remaining quantities or orders, just flags this proforma as done in the list"
                  >
                    {isTogglingProformaCompleted
                      ? "Updating…"
                      : isProformaCompleted
                      ? "Mark Not Completed"
                      : "Mark Completed"}
                  </button>
                )}

                <button
                  className="view-jv-button"
                  style={{ backgroundColor: "#dc2626", color: "#fff" }}
                  onClick={() => setShowInvoicePreview(true)}
                  title="Printable invoice — same layout as the sales invoice view"
                >
                  View Invoice
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
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : isPurchaseReturn ? "Save Return" : "Save Invoice"}
            </button>
          )}

          <button
            type="button"
            className="view-jv-button"
            disabled={!selectedSupplierId}
            onClick={() => setShowSupplierStatement(true)}
            title={!selectedSupplierId ? "Select a supplier first" : "View this supplier's account statement"}
          >
            View Statement
          </button>

          <button
            type="button"
            className="view-jv-button"
            onClick={() => setShowSharedChargeModal(true)}
            title="Split one cost (e.g. customs clearance) across two or more invoices that share it"
          >
            Split Shared Charge
          </button>

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

          {!isInvoiceSelected && (
            <PermGate perm="purchases.createReturn">
              <button
                className="new-button"
                style={{ backgroundColor: "#b85c00", color: "#fff" }}
                onClick={() => {
                  resetFields();
                  setSelectedInvoiceId(null);
                  setIsEditMode(false);
                  setUnitPriceRows([]);
                  setShowUnitPriceModal(false);
                  setActiveSummary("main");
                  setIsPurchaseReturn(true);
                  setReturnBaseType("S");
                  setInvoiceType("PR");
                  setStatus("Recieved");
                }}
              >
                New Purchase Return
              </button>
            </PermGate>
          )}
        </div>
      </div>

      <div className={`pi-page-columns${invoicesColumnToggle ? " pi-columns--expenses" : ""}`}>
        {!invoicesColumnToggle && (
        <div className="pi-page-left">
          <h3 className="tittle-label">Proforma</h3>

          <div className="invoice-list-search">
            <input
              type="text"
              placeholder="Search by proforma number or supplier…"
              value={proformaListSearch}
              onChange={(e) => setProformaListSearch(e.target.value)}
            />
            {proformaListSearch && (
              <button
                type="button"
                className="invoice-list-search-clear"
                onClick={() => setProformaListSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="proforma-filter-chips">
            <button
              type="button"
              className={`proforma-filter-chip proforma-filter-chip--all${proformaFilterMode === "all" ? " active" : ""}`}
              onClick={() => setProformaFilterMode("all")}
            >
              All
            </button>
            <button
              type="button"
              className={`proforma-filter-chip proforma-filter-chip--completed${proformaFilterMode === "completed" ? " active" : ""}`}
              onClick={() => setProformaFilterMode("completed")}
            >
              Completed
            </button>
            <button
              type="button"
              className={`proforma-filter-chip proforma-filter-chip--uncompleted${proformaFilterMode === "uncompleted" ? " active" : ""}`}
              onClick={() => setProformaFilterMode("uncompleted")}
            >
              Uncompleted
            </button>
          </div>

          <div className="purchase-invoice-cards-wrapper">
            {ordersList.length === 0 ? (
              <p>No proforma invoices yet.</p>
            ) : filteredOrdersList.length === 0 ? (
              <p>No proforma invoices match the current search/filter.</p>
            ) : (
              filteredOrdersList.map((invoice) => (
                <div
                  key={invoice.id}
                  className={`purchase-invoice-card${selectedInvoiceId === invoice.id ? " selected" : ""}`}
                  onClick={() => setSelectedInvoiceId(invoice.id)}
                >
                  <div className="purchase-invoice-card-header">
                    <div className="supplier-name">
                      {invoice.supplier?.supplierName || "Unknown Supplier"}
                    </div>
                    <div className="invoice-number order-pending" title="Still Proforma — no invoice number assigned yet">
                      {invoice.proformaNumber || "—"}
                    </div>
                  </div>

                  <div className="purchase-invoice-card-footer">
                    <span className="grand-total">
                      ${Number(invoice.grandAmount || 0).toFixed(2)}
                    </span>
                    <span className="purchase-invoice-card-date">
                      {formatPoDate(invoice.poDate)}
                    </span>
                  </div>
                  {invoice.isCompleted && (
                    <span className="proforma-completed-badge">✓ Completed</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        )}

        <div className={`pi-page-center${itemsTableCollapsed ? " collapsed" : ""}`}>
          {invoicesColumnToggle && (
            <button
              type="button"
              className="pi-table-collapse-btn"
              onClick={() => setItemsTableCollapsed((v) => !v)}
              title={itemsTableCollapsed ? "Show items table" : "Hide items table"}
            >
              {itemsTableCollapsed ? "+" : "−"}
            </button>
          )}
          {!itemsTableCollapsed && (
          <>
          <div className="invoice-details">
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
                Invoice Number
                <input
                  type="text"
                  placeholder="Enter invoice number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={!canEdit}
                />
              </label>

              <label className="field-col-date">
                Recieved Date
                <input
                  type="date"
                  value={inputedDate}
                  onChange={(e) => setinputedDate(e.target.value)}
                  disabled={!canEdit}
                  className="field-compact field-date"
                />
              </label>
              <label className="field-jvdate">
                JV Date (تاريخ المعاملة)
                <input
                  type="date"
                  value={jvDate}
                  onChange={(e) => setJvDate(e.target.value)}
                  disabled={!canEdit}
                  className="field-compact field-date"
                />
              </label>
              <label className="field-col-date">
                PO Date
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  disabled={!canEdit}
                  className="field-compact field-date"
                />
              </label>

              <label className="field-col-type">
                Type
                <select
                  value={invoiceType}
                  onChange={(e) => setInvoiceType(e.target.value)}
                  className="field-compact field-type"
                  disabled={!canEdit || isInvoiceSelected || isPurchaseReturn}
                >
                  <option value="S">S</option>
                  <option value="G">G</option>
                  <option value="SR">SR</option>
                  <option value="RVR">RVR</option>
                  <option value="PR">PR</option>
                </select>
              </label>

              {(isPurchaseReturn || invoiceType === "PR") && (
                <label className="field-col-type">
                  Return Base Type
                  <select
                    value={returnBaseType}
                    onChange={(e) => setReturnBaseType(e.target.value)}
                    className="field-compact field-type"
                    disabled={!canEdit}
                  >
                    <option value="S">S</option>
                    <option value="G">G</option>
                    <option value="SR">SR</option>
                  </select>
                </label>
              )}

              <label className="field-status">
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  // A saved Proforma is a permanent record — its status
                  // can't be changed in place; use "Create Order" instead.
                  // (Doesn't restrict a brand-new, not-yet-saved invoice,
                  // which can still be created directly as Ordered etc.)
                  disabled={!canEdit || (isInvoiceSelected && status === "Proforma")}
                  title={
                    isInvoiceSelected && status === "Proforma"
                      ? 'A Proforma is permanent — use "Create Order" to spin off an order from it instead'
                      : undefined
                  }
                  style={{
                    backgroundColor: status ? getStatusColor(status) : "white",
                  }}
                >
                  <option value="">Select Status</option>
                  <option value="Proforma">Proforma</option>
                  <option value="Ordered">Ordered</option>
                  {/* Shipped/Recieved are driven by shipment tracking (ShipsGo or
                      vessel/AIS) once a BL is tracked, so they aren't manually
                      selectable here — except for Purchase Returns, which never
                      go through shipping. */}
                  <option value="Shipped" disabled={!isPurchaseReturn && invoiceType !== "PR"}>
                    Shipped{!isPurchaseReturn && invoiceType !== "PR" ? " (auto)" : ""}
                  </option>
                  {/* Recieved is set automatically by shipment tracking; an admin
                      can also set it by hand as a manual override (tracking
                      stalled, or the shipment was never tracked). Backend
                      enforces the admin check; this just avoids showing a
                      non-admin an option that would 403. Purchase Returns are
                      exempt — they never ship. */}
                  <option
                    value="Recieved"
                    disabled={!isPurchaseReturn && invoiceType !== "PR" && !isAdmin}
                  >
                    Recieved
                    {!isPurchaseReturn && invoiceType !== "PR" && !isAdmin ? " (auto)" : ""}
                  </option>
                </select>
              </label>

              <label>
                Warehouse
                <select
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                  disabled={!canEdit}
                >
                  {(warehouseOptions.length > 0
                    ? (warehouse && !warehouseOptions.includes(warehouse) ? [...warehouseOptions, warehouse] : warehouseOptions)
                    : [warehouse]
                  ).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="field-col-date">
                Expected Arrival Date
                <input
                  type="date"
                  disabled={!canEdit}
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="field-compact field-date"
                />
              </label>

              <label className="field-col-currency">
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

              <label className="field-col-exch">
                Exchange Rate
                <input
                  type="number"
                  step="0.0001"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                  disabled={!canEdit}
                  className="field-compact"
                />
              </label>

              <label className="field-col-vat">
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
            invoiceType={effectiveType}
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

          {sqmRepeatModal.open && sqmRepeatModal.queue?.length > 0 && (() => {
            const current = sqmRepeatModal.queue[0];
            const total = sqmRepeatModal.queue.length;
            const done = (sqmRepeatModal._total || total) - total;
            const grandTotal = sqmRepeatModal._total || total;
            return (
              <div className="sqm-repeat-overlay">
                <div className="sqm-repeat-modal">
                  <div className="sqm-repeat-header">
                    <h3 className="sqm-repeat-title">SQM Repetitions</h3>
                    {grandTotal > 1 && (
                      <span className="sqm-repeat-counter">{done + 1} / {grandTotal}</span>
                    )}
                  </div>
                  <p className="sqm-repeat-desc" dir="rtl">
                    {current.itemNameCombined || current.itemName}
                  </p>
                  <p className="sqm-repeat-label">How many times?</p>
                  <input
                    type="number"
                    className="sqm-repeat-input"
                    min={1}
                    step={1}
                    value={sqmRepeatModal.value}
                    onChange={(e) => setSqmRepeatModal((m) => ({ ...m, value: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmSqmRepeat(); }}
                    autoFocus
                  />
                  <div className="sqm-repeat-actions">
                    <button
                      className="sqm-repeat-btn sqm-repeat-btn--cancel"
                      onClick={() => setSqmRepeatModal({ open: false, queue: [], value: "1" })}
                    >
                      Cancel All
                    </button>
                    <button className="sqm-repeat-btn sqm-repeat-btn--confirm" onClick={confirmSqmRepeat}>
                      {total > 1 ? "Next →" : "Add"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

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
          </>
          )}
        </div>

        {invoicesColumnToggle ? (
        <div className="pi-page-expenses">
          <UnitPriceModal
            isVisible={true}
            embedded
            onClose={() => setInvoicesColumnToggle(false)}
            onSave={handleModalSave}
            isEditable={canEdit}
            invoiceId={isInvoiceSelected ? selectedInvoiceId : null}
            rows={unitPriceRows}
            onRowsChange={setUnitPriceRows}
          />
        </div>
        ) : (
        <div className="pi-page-right">
        <h3 className="tittle-label">
          {familyProformaId ? "Related Orders" : "Purchase Invoices"}
        </h3>

        <div className="invoice-list-search">
          <input
            type="text"
            placeholder="Search by PO number or supplier…"
            value={invoiceListSearch}
            onChange={(e) => setInvoiceListSearch(e.target.value)}
          />
          {invoiceListSearch && (
            <button
              type="button"
              className="invoice-list-search-clear"
              onClick={() => setInvoiceListSearch("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="purchase-invoice-cards-wrapper">
          {shippedOrRecievedList.length === 0 ? (
            <p>
              {familyProformaId
                ? status === "Proforma"
                  ? 'No orders created from this proforma yet — use "Create Order" above.'
                  : "No related orders found."
                : "No ordered, shipped, or recieved invoices yet."}
            </p>
          ) : filteredMinimalInvoices.length === 0 ? (
            <p>No invoices match "{invoiceListSearch}".</p>
          ) : (
            filteredMinimalInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className={`purchase-invoice-card${invoice.status === "Ordered" ? " ordered" : ""}${invoice.status === "Shipped" ? " shipped" : ""}${selectedInvoiceId === invoice.id ? " selected" : ""}`}
                onClick={() => setSelectedInvoiceId(invoice.id)}
              >
                <div className="purchase-invoice-card-header">
                  <div className="supplier-name">
                    {invoice.supplier?.supplierName || "Unknown Supplier"}
                  </div>
                  {invoice.invoiceNumber ? (
                    <div className="invoice-number">{invoice.invoiceNumber}</div>
                  ) : (
                    <div className="invoice-number order-pending" title="Not yet Recieved — no invoice number assigned">
                      {invoice.orderNumber || "—"}
                    </div>
                  )}
                </div>

                <div className="purchase-invoice-card-footer">
                  <span className="grand-total">
                    ${Number(invoice.grandAmount || 0).toFixed(2)}
                  </span>
                  <span className="purchase-invoice-card-date">
                    {formatPoDate(invoice.poDate)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
        )}
      </div>

      {/* Summary — full width, below the Order/Table/Invoices row */}
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
          vatRate={vatRate}
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
          invoiceType={effectiveType}
          status={status}
          shippingCostComputed={getCorrectShippingCost()}
          computedCostPercentageForDisplay={computedCostPercentageForDisplay}
        />
      ) : (
        <AlternativeSummarySection
          trackingMode={trackingMode}
          onTrackingModeChange={handleTrackingModeChange}
          shippingLine={shippingLine}
          onShippingLineChange={setShippingLine}
          etd={etd}
          onEtdChange={setEtd}
          numberOfContainers={altContainers}
          onNumberOfContainersChange={setAltContainers}
          blNumber={blNumber}
          onBlNumberChange={setBlNumber}
          containerNumber={containerNumber}
          onContainerNumberChange={setContainerNumber}
          isEditable={canEdit}
          shipsgoShipmentId={shipsgoShipmentId}
          shipsgoStatus={shipsgoStatus}
          shipsgoLastCheckedAt={shipsgoLastCheckedAt}
          isTrackingShipment={isTrackingShipment}
          onTrackShipment={handleTrackShipment}
          onSyncShipment={handleSyncShipment}
          onUntrackShipment={handleUntrackShipment}
          canTrackShipment={Boolean(selectedInvoiceId)}
          blDocumentPath={blDocumentPath}
          isUploadingBlDocument={isUploadingBlDocument}
          onUploadBlDocument={handleUploadBlDocument}
          onViewBlDocument={() => handleOpenBlDocument("view")}
          onDownloadBlDocument={() => handleOpenBlDocument("download")}
          canUploadBlDocument={Boolean(selectedInvoiceId)}
          canManageShipmentTracking={canManageShipmentTracking}
          otherDocuments={otherDocuments}
          isUploadingOtherDocuments={isUploadingOtherDocuments}
          onUploadOtherDocuments={handleUploadOtherDocuments}
          onViewOtherDocument={(doc) => handleOpenOtherDocument(doc, "view")}
          onDownloadOtherDocument={(doc) => handleOpenOtherDocument(doc, "download")}
          onDeleteOtherDocument={handleDeleteOtherDocument}
          canUploadOtherDocuments={Boolean(selectedInvoiceId)}
          vesselName={vesselName}
          onVesselNameChange={setVesselName}
          vesselImo={vesselImo}
          vesselMmsi={vesselMmsi}
          vesselNavStatus={vesselNavStatus}
          vesselSpeedKnots={vesselSpeedKnots}
          vesselArrivedAtPort={vesselArrivedAtPort}
          vesselLastCheckedAt={vesselLastCheckedAt}
          vesselPositionAt={vesselPositionAt}
          isSearchingVessel={isSearchingVessel}
          isTrackingVessel={isTrackingVessel}
          onSearchVessel={handleSearchVessel}
          onSyncVessel={handleSyncVessel}
          onUntrackVessel={handleUntrackVessel}
          canTrackVessel={Boolean(selectedInvoiceId)}
          vesselSearchResults={vesselSearchResults}
          showVesselPicker={showVesselPicker}
          onCloseVesselPicker={() => setShowVesselPicker(false)}
          onConfirmVesselTracking={handleConfirmVesselTracking}
        />
      )}

      {/* UnitPriceModal (popup — separate from the embedded مصاريف panel) */}
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
        </>
      )}

      {showProformaOrderPicker && selectedInvoiceId && (
        <ProformaOrderPickerModal
          proformaId={selectedInvoiceId}
          onClose={() => setShowProformaOrderPicker(false)}
          onCreated={handleProformaOrderCreated}
        />
      )}

      {showInvoicePreview && (
        <InvoiceModal
          isOpen={showInvoicePreview}
          onClose={() => setShowInvoicePreview(false)}
          invoiceData={buildPurchasePreviewData()}
          partyLabel="المورد"
          hideVatToggle
          docNumberLabel={purchaseDocNumberLabel}
          title={invoiceType === "PR" ? "Purchase Return Preview" : "Purchase Invoice Preview"}
        />
      )}

      <SupplierStatementModal
        isOpen={showSupplierStatement}
        onClose={() => setShowSupplierStatement(false)}
        supplierId={selectedSupplierId}
        supplierName={supplierName}
        defaultDate={inputedDate}
      />

      <SharedChargeModal
        isOpen={showSharedChargeModal}
        onClose={() => setShowSharedChargeModal(false)}
        invoices={minimalInvoicesArr.filter((inv) => inv.status !== "Proforma")}
        onCreated={handleSharedChargeCreated}
      />

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
  );
};

export default PurchasesInvoicePage;
