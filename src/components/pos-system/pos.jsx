import React, { useState, useEffect, useMemo } from "react";
import { FaFileInvoiceDollar, FaClipboardList } from "react-icons/fa";
import "./pos.css";
import SearchModal from "./searchModal";
import RequestCard from "./requests";
import InvoiceCreation from "./invoiceCreation";
import InvoicesList from "./invoiceList";
import NotificationModal from "../recievables/NotificationModal";
import Toolbar from "./Components/Toolbar";
import CustomerDetails from "./Components/CustomerDetails";
import InventoryTable from "./Components/InventoryTable";
import PricingTable from "./pricingTable";
import ToggleSwitch from "./Components/ToggleSwitch";
import InvoiceModal from "./invoicePreviewModal";
import StatementModal from "./Components/StatementModal";
import RequestPreviewModal from "./RequestPreviewModal";
import DeliveryNoteModal from "./DeliveryNoteModal";

// ✅ API client (baseURL should be "/api")
import { axiosClient } from "../api/axiosClient";

const POSSystemPage = () => {
  const [tableData, setTableData] = useState([]);
  const [isModalOpen, setModalOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [customerInput, setCustomerInput] = useState("");
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [currencyRate, setCurrencyRate] = useState("89500");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [vat, setVat] = useState("11");
  const [selectedInvoiceType, setSelectedInvoiceType] = useState("Both");
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(null);
  const [isEditable, setIsEditable] = useState(true);
  const [invoiceData, setInvoiceData] = useState(null);
  const [showOnlyCenter, setShowOnlyCenter] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [selectedBatchIds, setSelectedBatchIds] = useState([]);
  const [pricingGroups, setPricingGroups] = useState(null);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [editingInvoiceType, setEditingInvoiceType] = useState(null);
const [showRequestPreview, setShowRequestPreview] = useState(false);
  const [cutMode, setCutMode] = useState(false);
  const [showDeliveryNotePreview, setShowDeliveryNotePreview] = useState(false);

  const [selectedRequestNumber, setSelectedRequestNumber] = useState("");

  const [customerPreview, setCustomerPreview] = useState({
    customerName: "",
    customerAddress: "",
    customerPhone: "",
    customerAccountNumber: "",
    customerTaxNumber: "",
    currencyCode: "USD",
  });
  const [statementBaseDate, setStatementBaseDate] = useState(null);
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const toYMDLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const openStatement = () => {
    setStatementBaseDate(toYMDLocal(new Date()));
    setShowStatement(true);
  };

  const handleSearchClick = () => {
    setModalOpen(true);
  };

  const handleReorder = (newRows) => {
    setTableData(newRows);
  };

  const confirmAction = (message, onYes) => {
    showNotification(
      "confirm",
      message,
      () => {
        closeNotification();
        onYes?.();
      },
      { confirmLabel: "Yes", cancelLabel: "No" }
    );
  };

  const handleCreateRequestConfirmed = () => {
    confirmAction("Are you sure you want to create this Request?", () => {
      handleCreateRequest();
    });
  };

  const handleEditRequestConfirmed = () => {
    confirmAction("Are you sure you want to edit this Request?", () => {
      handleEditRequest();
    });
  };



  const handleCreateInvoiceConfirmed = (type) => {
    const label =
      type === "S"
        ? "Issue"
        : type === "G"
        ? "Offer"
        : type === "RVR"
        ? "RVR"
        : type;

    confirmAction(`Are you sure you want to make this an ${label}?`, () => {
      handleCreateInvoice(type);
    });
  };

  const handleCreateReturnInvoiceConfirmed = () => {
    confirmAction(
      "Are you sure you want to create a Return invoice for this invoice?",
      () => {
        handleCreateReturnInvoice();
      }
    );
  };

  const handleCreateReturnInvoice = async () => {
    if (!selectedInvoiceId) {
      showNotification("error", "Please select an invoice first.");
      return;
    }

    if (String(editingInvoiceType || "").toUpperCase() === "RTN") {
      showNotification("error", "You cannot create a return from an RTN invoice.");
      return;
    }

    try {
      setLoading(true);

      // ✅ return date should be "today" (date of return creation)
      const returnDate = new Date().toISOString().slice(0, 10);

      // ✅ FIX: axiosClient + relative path only
      const res = await axiosClient.post(
        `/invoices/${selectedInvoiceId}/return`,
        { date: returnDate }
      );

      const rtn = res.data;
      showNotification(
        "success",
        `Return invoice created: ${rtn.invoiceNumber || "RTN"}`
      );

      await handleSelectInvoice({ id: rtn.id, invoiceType: "RTN" });
    } catch (err) {
      console.error("❌ Return invoice failed:", err);
      showNotification(
        "error",
        `Failed to create return invoice. ${
          err.response?.data?.message || err.message
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const showNotification = (type, message, onConfirm = null, options = {}) => {
    setNotification({
      show: true,
      type,
      message,
      onConfirm,
      confirmLabel: options.confirmLabel ?? "OK",
      cancelLabel: options.cancelLabel ?? null,
    });
  };

  const closeNotification = () => {
    setNotification({
      show: false,
      type: "",
      message: "",
      onConfirm: null,
      confirmLabel: "OK",
      cancelLabel: null,
    });
  };

  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
    onConfirm: null,
    confirmLabel: "OK",
    cancelLabel: null,
  });

  const syncSelectedBatchIdsFromTable = (rows) => {
    const ids = Array.from(
      new Set(rows.map((r) => r.batchId).filter((id) => id !== undefined && id !== null))
    );
    setSelectedBatchIds(ids);
  };

  const fmtItemLabel = (type, thickness, itemName) => {
    const t = String(type || "").toLowerCase();
    const name = String(itemName || "").trim();

    if (t === "unit") return name;

    const th = parseFloat(String(thickness ?? ""));
    if (Number.isFinite(th)) return `${th} ملم ${name}`.trim();

    return name;
  };

  const makeKey = () =>
    window.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const handleSelectItems = (selectedItems) => {
    (selectedItems || []).forEach((it, i) => {
      console.log(
        `🟦 SearchModal selected[${i}] stockMode=`,
        it?.stockMode,
        "| itemType=",
        it?.itemType,
        "| type=",
        it?.type,
        "| batchId=",
        it?.batchId,
        "| itemBatchId=",
        it?.itemBatchId
      );
    });


    const expanded = [];
    (selectedItems || []).forEach((item) => {
      const t = String(item?.type || "").toLowerCase();
      const repeatRaw = item?.repeat;
      const repeat =
        t === "sqm" ? Math.max(1, Math.floor(Number(repeatRaw || 1))) : 1;

      for (let i = 0; i < repeat; i++) {
        expanded.push({ ...item, __repeatIndex: i, __rowKey: makeKey() });
      }
    });

    const newRows = expanded.map((item) => {
      const length = parseFloat(item.length);
      const width = parseFloat(item.width);
      const type = item.type;

      const typeLower = String(type || "").toLowerCase();
      const isSqm = typeLower === "sqm";
      const isUnit = typeLower === "unit";

      const sheetsPerBox = parseFloat(item.sheetsPerBox);
      const quantity = 1;

      let sqm = "";
      let box = "";
      let sheet = "";

      if (isUnit) {
        sheet = 1;
        sqm = 0;
        box = "";
      } else if (isSqm) {
        sqm = "";
        box = "";
        sheet = "";
      } else if (length && width) {
        const sqmPerSheet = (length / 100) * (width / 100);
        if (type === "box") {
          sqm = (sqmPerSheet * sheetsPerBox * quantity).toFixed(2);
          box = quantity;
          sheet = sheetsPerBox;
        } else if (type === "sheet") {
          sqm = (sqmPerSheet * quantity).toFixed(2);
          sheet = quantity;
        }
      }

      return {
        __rowKey: item.__rowKey,

        itemVariantId: item.itemVariantId,
        batchId: item.batchId,

        origin: item.origin || "",
        item: fmtItemLabel(item.type, item.thickness, item.itemName),

        type: type || "",
        itemType: item.itemType ?? item.type ?? "",

        stockMode: item.stockMode ?? null,

        length: item.length || "",
        width: item.width || "",
        box,
        sheet,
        quantity,
        sqm,

        price: "",
        total: "0.00",

        sqmPieceId: isSqm ? item.sqmPieceId ?? item.id ?? null : null,
        maxPieces: isSqm ? item.piecesRemaining ?? null : null,
      };
    });

    newRows.forEach((r, i) => {
      console.log(
        `🟩 MAPPED row[${i}] stockMode=`,
        r.stockMode,
        "| itemType=",
        r.itemType,
        "| type=",
        r.type,
        "| batchId=",
        r.batchId
      );
    });

    setTableData((prev) => [...prev, ...newRows]);
  };

  
const requestForPreview = {
  requestNumber: selectedRequestNumber || "", 
  customerName: selectedCustomerName || customerInput || "",
  requestDate: date,
  address: customerPreview?.customerAddress || "",
  telephone: customerPreview?.customerPhone || "",
  items: (tableData || []).map((r, i) => ({
    itemNumber: i + 1,
    
    // ✅ Use invoiceDisplayName if available, otherwise use item
    itemName: r.invoiceDisplayName || r.item || "",
    
    box: r.box ?? "",
    sheet: r.sheet ?? "",
    length: r.length ?? "",
    width: r.width ?? "",
    sqm: r.sqm ?? "",
    unit: (String(r.type || r.itemType || "").toUpperCase() || ""),
    unitPrice: r.price ?? "",
    invoicePrice: r.total ?? "",
  })),
};



const handleSelectRequest = async (reqOrId) => {
  const id =
    typeof reqOrId === "object"
      ? reqOrId?.id ?? reqOrId?.requestId ?? null
      : reqOrId;

  console.log("Fetching request details for:", reqOrId, "→ id:", id);
  if (!id) return;

  setSelectedRequestId(id);
  setSelectedInvoiceId(null);
  setLoading(true);
  setIsEditable(false);

  if (typeof reqOrId === "object") {
    setSelectedRequestNumber(reqOrId?.requestNumber || "");
    setSelectedCustomerName(reqOrId?.customerName || "");
    setCustomerInput(reqOrId?.customerName || "");
    setDate(toYMD(reqOrId?.requestDate || reqOrId?.date));

    if (reqOrId?.vatPercentage != null) {
      setVat(String(parseFloat(reqOrId.vatPercentage)));
    }
  } else {
    setSelectedRequestNumber("");
  }

  try {
    const { data: request } = await axiosClient.get(`/requests/${id}`);
    console.log("Fetched Request:", request);

    setSelectedRequestNumber(
      request?.requestNumber ||
        (typeof reqOrId === "object" ? reqOrId?.requestNumber : "") ||
        ""
    );

    setCustomerInput(request.customerName || "");
    setSelectedCustomerName(request.customerName || "");
    setSelectedCustomerId(request.customerId || null);
    setSelectedInvoiceType(request.invoiceType || "Both");
    setDate(toYMD(request.requestDate || request.date));

    const reqVat =
      request?.vatPercentage != null
        ? String(parseFloat(request.vatPercentage))
        : "0";
    setVat(reqVat);

    const details = Array.isArray(request.details) ? request.details : [];

    const updatedData = details.map((detail) => {
      const itemType = String(detail?.itemType || "").toLowerCase();
      const stockMode = detail?.stockMode ?? null;

      const qty = Number(detail?.quantity ?? 0);

      const isBox = itemType === "box";
      const isSheet = itemType === "sheet";
      const isSqm = itemType === "sqm";
      const isUnit = itemType === "unit";

      const boxVal = isBox ? qty : "";
      const sheetVal = isBox ? detail?.sheetsPerBox ?? "" : qty;

      const sqmVal = isUnit ? 0 : detail?.sqm ?? "";

      return {
        __rowKey: makeKey(),

        itemVariantId: detail?.itemVariantId || null,
        batchId: detail?.itemBatchId ?? detail?.batchId ?? null,

        origin: detail?.origin || "",
        
        // ✅ Keep normal formatting for table display
        item: fmtItemLabel(itemType, detail?.thickness, detail?.itemName),
        
        // ✅ Store invoiceDisplayName separately for preview modal ONLY
        invoiceDisplayName: detail?.invoiceDisplayName || null,

        type: itemType,

        itemType,
        stockMode,

        thickness: detail?.thickness || "",
        length: detail?.length ?? "",
        width: detail?.width ?? "",

        box: boxVal,
        sheet: sheetVal,

        sqm: sqmVal,
        price: detail?.price ?? "",
        total: detail?.total ?? "0.00",
      };
    });

    setTableData(updatedData);
  } catch (error) {
    console.error("Error fetching request details:", error);
    showNotification(
      "error",
      `Failed to fetch request details: ${
        error.response?.data?.message || error.message
      }`
    );
  } finally {
    setLoading(false);
  }
};



const deliveryDocForPreview = useMemo(() => {
  // If request selected -> reuse requestForPreview (already has requestNumber, items, customer)
  if (selectedRequestId !== null) return requestForPreview;

  // If invoice selected -> build from invoice state
  if (selectedInvoiceId !== null) {
    return {
    
      customerName: selectedCustomerName || customerInput || "",
      invoiceDate: date,
      address: customerPreview?.customerAddress || "",
      telephone: customerPreview?.customerPhone || "",
      // IMPORTANT: items must match your invoice table data shape
      items: (tableData || []).map((r, i) => ({
        itemNumber: i + 1,
        itemName: r.item || "",
        box: r.box ?? "",
        sheet: r.sheet ?? "",
        length: r.length ?? "",
        width: r.width ?? "",
        sqm: r.sqm ?? "",
        unit: String(r.type || r.itemType || "").toUpperCase(),
      })),
    };
  }

  return null;
}, [
  selectedRequestId,
  selectedInvoiceId,
  requestForPreview,
  
  selectedCustomerName,
  customerInput,
  date,
  customerPreview,
  tableData,
]);



  // ====================== PRICING (Get Price) ======================

  const handleGetPriceClick = async () => {
    const ids = Array.from(
      new Set(
        tableData
          .map((r) => r.batchId)
          .filter((id) => id !== undefined && id !== null)
      )
    );

    if (!selectedCustomerId) {
      showNotification("error", "Please select a customer first.");
      return;
    }
    if (!ids.length) {
      showNotification("error", "Please select items (batches) from Search first.");
      return;
    }

    try {
      setLoading(true);
      setSelectedBatchIds(ids);

      // ✅ FIX
      const res = await axiosClient.get(
        `/invoices/v1/browsing/by-item-batches/${selectedCustomerId}`,
        { params: { itemBatchIds: ids } }
      );

      setPricingGroups(res.data);
      setShowOnlyCenter(true);
    } catch (err) {
      console.error(err);
      showNotification(
        "error",
        `Failed to fetch pricing. ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ids = Array.from(
      new Set(
        tableData
          .map((r) => r.batchId)
          .filter((id) => id !== undefined && id !== null)
      )
    );
    setSelectedBatchIds(ids);
  }, [tableData]);

  const handlePricingLoadMore = async (groupKey, currentPage) => {
    try {
      const nextPage = currentPage + 1;

      // ✅ FIX
      const res = await axiosClient.get(
        `/invoices/v1/browsing/by-item-batches/${selectedCustomerId}`,
        {
          params: {
            itemBatchIds: selectedBatchIds,
            groupKey,
            page: nextPage,
            limit: 5,
          },
        }
      );

      setPricingGroups((prev) => {
        if (!Array.isArray(prev)) return prev;
        const pageObj = res.data;
        return prev.map((g) =>
          g.groupKey === groupKey
            ? {
                ...g,
                page: nextPage,
                items: [...g.items, ...pageObj.items],
                total: pageObj.total,
                totalPages: pageObj.totalPages,
              }
            : g
        );
      });
    } catch (err) {
      console.error(err);
      showNotification(
        "error",
        `Failed to load more. ${err.response?.data?.message || err.message}`
      );
    }
  };



  const calculateSQM = (length, width, type, box, sheet) => {
    if (!length || !width || box === "" || sheet === "" || sheet === undefined) {
      return "";
    }

    const lengthInMeters = length / 100;
    const widthInMeters = width / 100;

    if (type === "box") {
      return (lengthInMeters * widthInMeters * box * sheet).toFixed(2);
    } else if (type === "sheet") {
      return (lengthInMeters * widthInMeters * sheet).toFixed(2);
    }

    return "";
  };

  const handleNewTransaction = () => {
    const today = new Date().toISOString().slice(0, 10);

    setTableData([]);
    setSelectedCustomerId(null);
    setCustomerInput("");
    setSelectedCustomerName("");
    setCurrencyRate("89500");
    setVat("11");
    setSelectedInvoiceId(null);
    setSelectedRequestId(null);
    setSelectedInvoiceType("Both");
    setIsEditable(true);
    setSelectedBatchIds([]);
    setPricingGroups(null);
    setEditingInvoiceType(null);
    setCutMode(false);
    setDate(today);
    setSelectedRequestNumber("");
  };

  const handleInputChange = (index, field, value) => {
    const newData = [...tableData];
    newData[index][field] = value;

    const row = newData[index];

    const price = parseFloat(row.price) || 0;
    const currRaw = String(customerPreview?.currencyCode ?? "")
      .toUpperCase()
      .trim();
    const currNorm = currRaw.replace(/[^A-Z]/g, "");
    const isLLCurrency = currNorm === "LL" || currNorm === "LBP";

    if (isLLCurrency && ["length", "width", "box", "sheet"].includes(field)) {
      row._manualSqm = false;
    }
    if (
      isLLCurrency &&
      field === "sqm" &&
      String(row.type || "").toLowerCase() !== "unit"
    ) {
      row._manualSqm = true;
      const sqmNum = parseFloat(value) || 0;
      row.total = (sqmNum * price).toFixed(2);

      newData[index] = row;
      setTableData(newData);
      return;
    }

    if (row.type === "sqm") {
      const lengthNum = parseFloat(row.length) || 0;
      const widthNum = parseFloat(row.width) || 0;
      const sheetNum = parseFloat(row.sheet) || 0;

      if (lengthNum && widthNum && sheetNum) {
        const sqmPerSheet = (lengthNum / 100) * (widthNum / 100);
        row.sqm = (sqmPerSheet * sheetNum).toFixed(2);
      } else {
        row.sqm = "";
      }

      const sqmNum = parseFloat(row.sqm) || 0;
      row.total = (sqmNum * price).toFixed(2);

      newData[index] = row;
      setTableData(newData);
      return;
    }

    if (String(row.type || "").toLowerCase() === "unit") {
      const qty = Number(row.sheet || row.quantity || 0);
      row.sqm = 0;
      row.total = (qty * price).toFixed(2);

      newData[index] = row;
      setTableData(newData);
      return;
    }

    if (row.length && row.width && row.sheet !== "" && row.sheet !== undefined) {
      row.sqm = calculateSQM(row.length, row.width, row.type, row.box || 1, row.sheet);
    } else {
      row.sqm = "";
    }

    const sqm = parseFloat(row.sqm) || 0;
    row.total = (sqm * price).toFixed(2);

    setTableData(newData);
  };

  const handleRightClick = (event, index) => {
    event.preventDefault();
    setSelectedRowIndex(index);
    setContextMenu({
      x: event.pageX,
      y: event.pageY,
    });
  };

  const handleRowClick = (index) => {
    setSelectedRowIndex(index);
    setContextMenu(null);
  };

  const handleDeleteRow = () => {
    if (selectedRowIndex !== null) {
      setTableData((prev) => {
        const updated = prev.filter((_, index) => index !== selectedRowIndex);
        syncSelectedBatchIdsFromTable(updated);
        return updated;
      });
      setContextMenu(null);
      setSelectedRowIndex(null);
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const fetchCustomers = async (query) => {
    if (!query) {
      setCustomerSuggestions([]);
      return;
    }

    try {
      // ✅ FIX
      const response = await axiosClient.get(`/customers/v1/search`, {
        params: { query },
      });
      setCustomerSuggestions(response.data);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setCustomerSuggestions([]);
    }
  };

  const handleCustomerInputChange = (e) => {
    const query = e.target.value;
    setCustomerInput(query);

    if (query.length > 1) {
      fetchCustomers(query);
    } else {
      setCustomerSuggestions([]);
    }
  };

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.customerName);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]);

    try {
      // ✅ FIX
      const response = await axiosClient.get(`/customers/${customer.id}`);
      const customerData = response.data;

      if (!selectedInvoiceId) {
        if (customerData.invoiceType) {
          setSelectedInvoiceType(customerData.invoiceType || "Both");
        } else {
          setSelectedInvoiceType("Both");
        }
      }

      setCustomerPreview({
        customerName: customerData.customerName || "",
        customerAddress: customerData.address || "",
        customerPhone: customerData.phoneNumber || "",
        customerAccountNumber: customerData.customerAccountNumber || "",
        customerTaxNumber: customerData.financialNumber || "",
        currencyCode: customerData.currency?.currencyCode || "USD",
      });
    } catch (error) {
      console.error("Error fetching customer details:", error);
      setSelectedInvoiceType("Both");

      setCustomerPreview((prev) => ({
        ...prev,
        customerName: customer.customerName || prev.customerName,
      }));
    }
  };

  const setCurrencyCode = (code) => {
    const raw = String(code ?? "").toUpperCase().trim();
    const norm = raw.replace(/[^A-Z]/g, "");
    const finalCode = norm === "LBP" ? "LL" : norm || "USD";

    setCustomerPreview((prev) => ({
      ...prev,
      currencyCode: finalCode,
    }));

    setInvoiceData((prev) => (prev ? { ...prev, currencyCode: finalCode } : prev));
  };

  const handleKeyDown = (e) => {
    if (customerSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      setHighlightedIndex((prevIndex) =>
        prevIndex < customerSuggestions.length - 1 ? prevIndex + 1 : prevIndex
      );
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : 0));
    } else if (e.key === "Enter" && highlightedIndex !== -1) {
      handleCustomerSelect(customerSuggestions[highlightedIndex]);
    }
  };

  const handleCreateInvoice = async (invoiceType = "S") => {
    if (!selectedCustomerId || tableData.length === 0) {
      setError("Customer and items are required.");
      return;
    }

    setLoading(true);
    setError("");

    const vatPercentageValue = Number(vat);
    const vatRate = vatPercentageValue / 100;

    const round2 = (n) => Number(Number(n || 0).toFixed(2));

    const items = tableData.map((row) => {
      const unitPrice = Number(row.price) || 0;

      const itemType = String(row.itemType ?? row.type ?? "").toLowerCase();

      const length =
        row.length !== "" && row.length != null ? Number(row.length) : null;
      const width = row.width !== "" && row.width != null ? Number(row.width) : null;

      const sheetsPerBox = itemType === "box" ? Number(row.sheet) || null : null;

      const quantity =
        itemType === "box"
          ? Number(row.box) || 0
          : itemType === "sheet" || itemType === "sqm" || itemType === "unit"
          ? Number(row.sheet) || 0
          : 0;

      const sqm = Number(row.sqm) || 0;

      const baseForTotal = itemType === "unit" ? quantity : sqm;

      const totalAmount = round2(baseForTotal * unitPrice);
      const vatAmount = round2(totalAmount * vatRate);

      return {
        itemVariantId: row.itemVariantId,
        itemBatchId: row.batchId,
        itemType,
        stockMode: row.stockMode ?? null,

        length,
        width,
        sheetsPerBox,

        sqm,
        unitPrice,
        totalAmount,
        vat: vatAmount,
        quantity,

        sqmPieceId: row.sqmPieceId ?? null,
      };
    });

    const totalWithoutVAT = items.reduce((acc, item) => acc + item.totalAmount, 0);
    const totalVAT = items.reduce((acc, item) => acc + item.vat, 0);
    const grandTotal = totalWithoutVAT + totalVAT;

    const payload = {
      customerId: selectedCustomerId,
      date,
      invoiceType,
      documentNumber: "DOC-0001",
      currencyId: 1,
      totalWithoutVAT: Number(totalWithoutVAT.toFixed(2)),
      totalVAT: Number(totalVAT.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      currencyRate: parseFloat(currencyRate) || 1,
      vatPercentage: vatPercentageValue,
      items,
      requestId: selectedRequestId ?? null,
    };

    console.log("📤 Invoice Payload:", payload);

    try {
      // ✅ FIX
      const response = await axiosClient.post(`/invoices`, payload);

      console.log("✅ Invoice Created:", response.data);
      showNotification("success", `Invoice ${invoiceType} created successfully!`);
      setTableData([]);
    } catch (err) {
      console.error("❌ Error creating invoice:", err);
      showNotification(
        "error",
        `Failed to create invoice. ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  // put these helpers near the top of POSSystemPage (above handleSelectInvoice)
  const toYMD = (x) => {
    if (!x) return new Date().toISOString().slice(0, 10);

    const s = String(x);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const d = new Date(x);
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const pickInvoiceDate = (inv) =>
    inv?.date ?? inv?.invoiceDate ?? inv?.invDate ?? inv?.createdAt ?? null;

  // ✅ COMPLETE handleSelectInvoice
  const handleSelectInvoice = async (invoiceSummary) => {
    console.log("Selected Invoice:", invoiceSummary);
    if (!invoiceSummary) return;

    const invId = invoiceSummary.invoiceId || invoiceSummary.id;
    if (!invId) {
      console.error("❌ No invoice id in selected invoice summary:", invoiceSummary);
      return;
    }

    setSelectedInvoiceId(invId);
    setSelectedRequestId(null);
    setEditingInvoiceType(invoiceSummary.invoiceType || "S");

    let invoice = invoiceSummary;
    try {
      // ✅ FIX
const res = await axiosClient.get(`/invoices/v1/${invId}`);
      invoice = res.data;
      console.log("📥 Full invoice from API:", invoice);
    } catch (err) {
      console.error("❌ Failed to fetch full invoice, using summary only:", err);
    }

    const rawDate = pickInvoiceDate(invoice);
    console.log("🧾 invoice raw date =", rawDate, "keys:", Object.keys(invoice || {}));
    setDate(toYMD(rawDate));

    const vatPercentage = invoice?.vatPercentage
      ? parseFloat(invoice.vatPercentage).toString()
      : "11";

    const currencyRateValue = invoice?.currencyRate
      ? parseFloat(invoice.currencyRate).toString()
      : "89500";

    setCustomerInput(invoice?.customerName || invoice?.customer?.customerName || "");
    setSelectedCustomerId(invoice?.customerId ?? invoice?.customer?.id ?? null);
    setSelectedCustomerName(
      invoice?.customerName || invoice?.customer?.customerName || ""
    );
    setCurrencyRate(currencyRateValue);
    setIsEditable(false);
    setVat(vatPercentage);

    setCustomerPreview({
      customerName: invoice?.customerName ?? invoice?.customer?.customerName ?? "",
      customerAddress: invoice?.customerAddress ?? invoice?.customer?.address ?? "",
      customerPhone:
        invoice?.customerPhone ?? invoice?.customer?.phoneNumber ?? "",
      customerAccountNumber:
        invoice?.customerAccountNumber ??
        invoice?.customer?.customerAccountNumber ??
        "",
      customerTaxNumber:
        invoice?.customerTaxNumber ?? invoice?.customer?.financialNumber ?? "",
      currencyCode:
        invoice?.currencyCode ?? invoice?.customer?.currency?.currencyCode ?? "USD",
    });

    const updatedTableData = (invoice?.items || [])
      .map((item) => {
        if (!item?.itemVariantId || !item?.itemName) {
          console.warn("Skipping invalid item:", item);
          return null;
        }

        const sqmPieceId =
          item?.sqmPieceId ??
          item?.sqmpieceId ??
          (item?.sqmPiece && item.sqmPiece.id) ??
          null;

        const qty = Number(item?.quantity ?? 0);

        const itemTypeLower = String(item?.itemType ?? "").toLowerCase();
        const type = itemTypeLower || (sqmPieceId ? "sqm" : "");

        const isBox = type === "box";
        const isSheet = type === "sheet";
        const isSqm = type === "sqm";
        const isUnit = type === "unit";
        const label =
          itemTypeLower === "unit"
            ? String(item?.itemName ?? "").trim()
            : `${parseFloat(String(item?.thickness))} ملم ${String(
                item?.itemName ?? ""
              ).trim()}`.trim();

        return {
          __rowKey: makeKey(),
          origin: item?.origin || "",
          item: label,
          type,

          length: item?.length || "",
          width: item?.width || "",

          box: isBox ? qty : "",
          sheet: isSheet || isSqm || isUnit ? qty : item?.sheetsPerBox ?? "",

          sqm: isUnit ? 0 : item?.sqm ?? "",

          price: item?.unitPrice ?? "",
          total: item?.totalAmount ?? "0.00",

          itemVariantId: item?.itemVariantId,
          batchId: item?.itemBatchId ?? (item?.batch && item.batch.id) ?? null,
          itemType: item?.itemType ?? type,
          stockMode: item?.stockMode ?? null,

          originalLength: item?.originalLength ?? null,
          originalWidth: item?.originalWidth ?? null,
          originalSheetsPerBox: item?.originalSheetsPerBox ?? null,

          invoiceItemId: item?.invoiceItemId ?? item?.id,

          sqmPieceId,

          sheetsPerBox: item?.sheetsPerBox ?? null,
        };
      })
      .filter(Boolean);

    console.log("✅ Updated Table Data (with sqmPieceId):", updatedTableData);
    setTableData(updatedTableData);

    setInvoiceData({
      ...(invoice || {}),
      date: toYMD(rawDate),
    });
  };

  useEffect(() => {
    console.log("Updated selected invoice id:", selectedInvoiceId);
  }, [selectedInvoiceId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && e.code === "KeyA") {
        e.preventDefault();
        setShowOnlyCenter((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleEditRequest = async () => {
    setIsEditable(true);
    console.log("isEditable:", isEditable);
  };

  const handleSaveRequest = async () => {
    if (!selectedRequestId || tableData.length === 0) {
      showNotification("error", "No request selected or items missing.");
      setIsEditable(false);
      return;
    }

    setLoading(true);

    const totalAmount = tableData.reduce((acc, item) => acc + Number(item.total || 0), 0);
    const vatAmount = totalAmount * (Number(vat) / 100);
    const grandTotal = totalAmount + vatAmount;

    const updatedRequestData = {
      requestId: selectedRequestId,
      customerId: selectedCustomerId,
      requestDate: date,
      totalAmount: totalAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      vatPercentage: Number(vat) || 0,
      details: tableData.map((item) => ({
        itemVariantId: item.itemVariantId,
        itemBatchId: item.batchId,
        sqm: Number(item.sqm),
        price: Number(item.price),
        total: Number(item.total),
        quantity: item.box ? Number(item.box) : Number(item.sheet),
      })),
    };

    try {
      // ✅ FIX
      const response = await axiosClient.put(`/requests/${selectedRequestId}`, updatedRequestData);
      console.log("✅ Request Updated:", response.data);
      showNotification("success", "Request updated successfully!");
      setIsEditable(false);
    } catch (err) {
      console.error("❌ Error updating request:", err);
      showNotification(
        "error",
        `Failed to update request. ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
      setIsEditable(false);
    }
  };

  const handleEditInvoice = async () => {
    setIsEditable(true);
  };

  const handleSaveInvoice = async () => {
    if (!selectedInvoiceId) {
      console.error("Invoice ID is missing.");
      return;
    }

    setLoading(true);

    const vatPct = Number(vat) || 0;
    const vatRate = vatPct / 100;

    const formattedItems = tableData.map((row) => {
      const unitPrice = Number(row.price) || 0;

      const itemType = String(row.itemType ?? row.type ?? "").toLowerCase();
      const isUnit = itemType === "unit";

      const length = row.length !== "" && row.length != null ? Number(row.length) : null;
      const width = row.width !== "" && row.width != null ? Number(row.width) : null;

      let sheetsPerBox = null;
      if (itemType === "box") {
        sheetsPerBox =
          Number(row.sheet) ||
          Number(row.sheetsPerBox) ||
          Number(row.originalSheetsPerBox) ||
          null;
      } else if (itemType === "sheet") {
        sheetsPerBox =
          Number(row.sheetsPerBox) || Number(row.originalSheetsPerBox) || null;
      }

      const quantity =
        itemType === "box"
          ? Number(row.box) || 0
          : itemType === "sheet" || itemType === "sqm" || itemType === "unit"
          ? Number(row.sheet) || 0
          : 0;

      const sqm = isUnit ? 0 : Number(row.sqm) || 0;

      const baseForTotal = isUnit ? quantity : sqm;
      const totalAmount = Number((baseForTotal * unitPrice).toFixed(2));
      const vatAmount = Number((totalAmount * vatRate).toFixed(2));

      return {
        id: row.invoiceItemId ?? row.id ?? undefined,

        itemBatchId: Number(row.batchId),
        itemVariantId: Number(row.itemVariantId),

        itemType: row.itemType,
        stockMode: row.stockMode ?? null,

        length,
        width,
        sheetsPerBox,

        sqm,
        unitPrice,
        totalAmount,
        vat: vatAmount,
        quantity,
        invoiceId: Number(selectedInvoiceId),

        sqmPieceId: row.sqmPieceId ?? (row.sqmPiece && row.sqmPiece.id) ?? null,
      };
    });

    const totalWithoutVAT = formattedItems.reduce((a, it) => a + it.totalAmount, 0);
    const totalVAT = formattedItems.reduce((a, it) => a + it.vat, 0);
    const grandTotal = totalWithoutVAT + totalVAT;

    const typeToSave = editingInvoiceType ?? selectedInvoiceType;

    const invoiceDataToSave = {
      id: selectedInvoiceId,
      customerId: selectedCustomerId,
      invoiceType: typeToSave,
      date,
      currencyRate: Number(currencyRate) || 1,
      vatPercentage: vatPct,
      totalWithoutVAT: Number(totalWithoutVAT.toFixed(2)),
      totalVAT: Number(totalVAT.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      items: formattedItems,
    };

    console.log("📤 Sending Invoice Update Payload:", invoiceDataToSave);

    try {
      // ✅ FIX
  const response = await axiosClient.put(
    `/invoices/${selectedInvoiceId}`,
    invoiceDataToSave
  );

  console.log("✅ Invoice Updated:", response.data);
  showNotification("success", "Invoice updated successfully!");

  // ✅ refresh state so preview shows the latest
  await handleSelectInvoice({ id: selectedInvoiceId, invoiceType: typeToSave });

  // optional: exit edit mode
  setIsEditable?.(false);
      showNotification("success", "Invoice updated successfully!");
    } catch (err) {
      console.error("❌ Error saving invoice:", err);
      showNotification(
        "error",
        `Failed to save invoice: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async () => {
    if (!selectedCustomerId || tableData.length === 0) {
      showNotification("error", "Customer and items are required.");
      return;
    }

    setLoading(true);

    const totalAmount = tableData.reduce((acc, item) => acc + Number(item.total || 0), 0);
    const vatAmount = totalAmount * (Number(vat) / 100);
    const grandTotal = totalAmount + vatAmount;

    const requestData = {
      customerId: selectedCustomerId,
      requestDate: date,
      totalAmount: totalAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      vatPercentage: Number(vat) || 0,
      details: tableData.map((item) => ({
        itemVariantId: item.itemVariantId,
        itemBatchId: item.batchId,
        sqm: Number(item.sqm),
        price: Number(item.price),
        total: Number(item.total),
        quantity: item.box ? Number(item.box) : Number(item.sheet),
      })),
    };

    console.log("📤 Sending Request Data:", requestData);

    try {
      // ✅ FIX
      const response = await axiosClient.post(`/requests`, requestData);
      console.log("✅ Request Created:", response.data);
      showNotification("success", "Request created successfully!");
      setTableData([]);
    } catch (err) {
      console.error("❌ Error creating request:", err);
      showNotification(
        "error",
        `Failed to create request. ${err.response?.data?.message || err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pos-page-container" onClick={handleCloseContextMenu}>
      {/* Left Sidebar */}
      {!showOnlyCenter && (
        <div className="pos-page-left">
          <div className="pos-page-container-header">
            <FaClipboardList className="pos-page-header-icon" />
            <span className="pos-page-header-text">Requests</span>
          </div>

          <input
            type="text"
            placeholder="Search Requests"
            className="pos-page-search-input"
            value={requestSearch}
            onChange={(e) => setRequestSearch(e.target.value)}
          />

          <RequestCard onSelectRequest={handleSelectRequest} searchTerm={requestSearch} />
        </div>
      )}

      {/* Center Section */}
      <div className={`pos-page-center ${showOnlyCenter ? "expanded-center" : ""}`}>
        <div className="pos-page-toolbar">
          <Toolbar
            handleNewTransaction={handleNewTransaction}
            handleEditInvoice={handleEditInvoice}
            handleSaveRequest={handleSaveRequest}
            handleSaveInvoice={handleSaveInvoice}
            handleEditRequest={handleEditRequestConfirmed}
            handleCreateRequest={handleCreateRequestConfirmed}
            handleCreateInvoice={handleCreateInvoiceConfirmed}
            loading={loading}
            selectedInvoiceId={selectedInvoiceId}
            selectedRequestId={selectedRequestId}
            selectedInvoiceType={selectedInvoiceType}
            date={date}
            setDate={setDate}
            isEditable={isEditable}
            setShowPreview={setShowPreview}
            handleOpenStatement={openStatement}
            canOpenStatement={!!selectedCustomerId}
            handleCreateReturnInvoice={handleCreateReturnInvoiceConfirmed}
            setShowRequestPreview={setShowRequestPreview}
            setShowDeliveryNotePreview={setShowDeliveryNotePreview}  

            canCreateReturnInvoice={
              !!selectedInvoiceId && String(editingInvoiceType || "").toUpperCase() !== "RTN"
            }
          />

          {showPreview && (
            <InvoiceModal
              isOpen={showPreview}
              onClose={() => setShowPreview(false)}
              invoiceData={{
                ...customerPreview,
                ...(invoiceData || {}),
                date: invoiceData?.date ?? date,
                vatPercentage: invoiceData?.vatPercentage ?? (Number(vat) || 0),
                currencyRate: invoiceData?.currencyRate ?? (Number(currencyRate) || 1),
                currencyCode:
                  invoiceData?.currencyCode ?? customerPreview.currencyCode ?? "USD",
                invoiceType: invoiceData?.invoiceType ?? selectedInvoiceType ?? "S",
              }}
              cssHref="/invoicePreview.css"
            />
          )}
          <RequestPreviewModal
  open={showRequestPreview}
  onClose={() => setShowRequestPreview(false)}
  request={requestForPreview}
  currencyCode={customerPreview.currencyCode}
  vatPercent={Number(vat || 0)} 
  currencyRate={Number(currencyRate || 0)}
/>

<DeliveryNoteModal
  open={showDeliveryNotePreview}
  onClose={() => setShowDeliveryNotePreview(false)}
  doc={deliveryDocForPreview || {}}
/>

          <StatementModal
            isOpen={showStatement}
            onClose={() => setShowStatement(false)}
            customerId={selectedCustomerId}
            defaultDate={statementBaseDate}
            customerName={selectedCustomerName}
          />

          <CustomerDetails
            currencyRate={currencyRate}
            setCurrencyRate={setCurrencyRate}
            vat={vat}
            setVat={setVat}
            customerInput={customerInput}
            handleCustomerInputChange={handleCustomerInputChange}
            handleKeyDown={handleKeyDown}
            customerSuggestions={customerSuggestions}
            handleCustomerSelect={handleCustomerSelect}
            highlightedIndex={highlightedIndex}
            handleSearchClick={handleSearchClick}
            setHighlightedIndex={setHighlightedIndex}
            handleGetPriceClick={handleGetPriceClick}
            cutMode={cutMode}
            onToggleCutMode={() => setCutMode((prev) => !prev)}
            isEditable={isEditable}
            currencyCode={customerPreview.currencyCode}
            onCurrencyCodeChange={setCurrencyCode}
          />
        </div>

        <div className="pos-page-inventory-table-container">
          <InventoryTable
            tableData={tableData}
            handleRowClick={handleRowClick}
            handleRightClick={handleRightClick}
            selectedRowIndex={selectedRowIndex}
            handleInputChange={handleInputChange}
            isEditable={isEditable}
            selectedRequestId={selectedRequestId}
            onReorder={handleReorder}
            cutMode={cutMode}
            currencyCode={customerPreview.currencyCode}
          />
        </div>
      </div>

      <div className="pos-page-toggle-wrapper">
        <ToggleSwitch showOnlyCenter={showOnlyCenter} setShowOnlyCenter={setShowOnlyCenter} />
      </div>

      {showOnlyCenter && (
        <PricingTable
          presetGroups={Array.isArray(pricingGroups) ? pricingGroups : undefined}
          onRequestLoadMore={handlePricingLoadMore}
          customerName={selectedCustomerName}
          onRefreshPreset={handleGetPriceClick}
          customerId={selectedCustomerId}
        />
      )}

      {!showOnlyCenter && (
        <div className="pos-page-right">
          <div className="pos-page-container-header">
            <FaFileInvoiceDollar className="pos-page-header-icon" />
            <span className="pos-page-header-text">Invoices</span>
          </div>

          <input
            type="text"
            placeholder="Search Invoices"
            className="pos-page-search-input"
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
          />

          <InvoicesList onSelectInvoice={handleSelectInvoice} searchTerm={invoiceSearch} />
        </div>
      )}

      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <button className="delete-button" onClick={handleDeleteRow}>
            Delete
          </button>
        </div>
      )}

      {notification.show && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={closeNotification}
          onConfirm={notification.onConfirm || closeNotification}
          confirmLabel={notification.confirmLabel}
          cancelLabel={notification.cancelLabel}
        />
      )}

      <SearchModal isOpen={isModalOpen} onClose={handleCloseModal} onSelectItems={handleSelectItems} />
    </div>
  );
};

export default POSSystemPage;
