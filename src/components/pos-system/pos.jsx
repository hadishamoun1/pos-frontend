import React, { useState, useEffect } from "react";
import { FaFileInvoiceDollar, FaClipboardList } from "react-icons/fa";
import "./pos.css";
import SearchModal from "./searchModal";
import RequestCard from "./requests";
import InvoiceCreation from "./invoiceCreation";
import InvoicesList from "./invoiceList";
import axios from "axios";
import NotificationModal from "../recievables/NotificationModal";
import Toolbar from "./Components/Toolbar";
import CustomerDetails from "./Components/CustomerDetails";
import InventoryTable from "./Components/InventoryTable";
import PricingTable from "./pricingTable";
import ToggleSwitch from "./Components/ToggleSwitch";
import InvoiceModal from "./invoicePreviewModal";
import StatementModal from "./Components/StatementModal";

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
  const [currencyRate, setCurrencyRate] = useState("89000");
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
const [cutMode, setCutMode] = useState(false);
const [customerPreview, setCustomerPreview] = useState({
  customerName: "",
  customerAddress: "",
  customerPhone: "",
  customerAccountNumber: "",
  customerTaxNumber: "",
  currencyCode: "USD",
});


  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const handleSearchClick = () => {
    setModalOpen(true);
  };
const handleReorder = (newRows) => {
  setTableData(newRows);
};




  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const showNotification = (type, message, onConfirm = null) => {
    setNotification({ show: true, type, message, onConfirm });
  };

  const closeNotification = () => {
    setNotification({ show: false, type: "", message: "", onConfirm: null });
  };

  const [notification, setNotification] = useState({
    show: false,
    type: "",
    message: "",
    onConfirm: null,
  });


  const syncSelectedBatchIdsFromTable = (rows) => {
  const ids = Array.from(
    new Set(rows.map(r => r.batchId).filter(id => id !== undefined && id !== null))
  );
  setSelectedBatchIds(ids);
};

const makeKey = () =>
  (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const handleSelectItems = (selectedItems) => {
  // selectedItems can include { repeat } for SQM rows
  const expanded = [];
  (selectedItems || []).forEach((item) => {
    const type = String(item?.type || "").toLowerCase();
    const repeatRaw = item?.repeat;
    const repeat =
      type === "sqm" ? Math.max(1, Math.floor(Number(repeatRaw || 1))) : 1;

    for (let i = 0; i < repeat; i++) {
      expanded.push({ ...item, __repeatIndex: i, __rowKey: makeKey() });
    }
  });

  const newRows = expanded.map((item) => {
    const length = parseFloat(item.length);
    const width = parseFloat(item.width);
    const type = item.type;
    const sheetsPerBox = parseFloat(item.sheetsPerBox);
    const quantity = 1;

    const isSqm = String(type || "").toLowerCase() === "sqm";

    let sqm = "";
    let box = "";
    let sheet = "";

    if (isSqm) {
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
      __rowKey: item.__rowKey, // ✅ unique row identity (for sqm duplicates)

      itemVariantId: item.itemVariantId,
      batchId: item.batchId,

      origin: item.origin || "",
      item:
        (item.thickness != null ? `${parseFloat(item.thickness)} ملم ` : "") +
        (item.itemName || ""),

      type: type || "",
      length: item.length || "",
      width: item.width || "",
      box,
      sheet,
      quantity,
      sqm,
      price: "",
      total: "0.00",

      // SQM pieces (optional)
      sqmPieceId: isSqm ? (item.sqmPieceId ?? item.id ?? null) : null,
      maxPieces: isSqm ? (item.piecesRemaining ?? null) : null,
    };
  });

 setTableData((prev) => {
  return [...prev, ...newRows];
});

};


  const handleSelectRequest = async (requestId) => {
    console.log("Fetching request details for ID:", requestId);

    if (!requestId) return;

    setSelectedRequestId(requestId);
    setSelectedInvoiceId(null);
    setLoading(true);
    setSelectedCustomerName(requestId.customerName || "");
    setIsEditable(false);

    try {
      const response = await axios.get(
        `${baseUrl}/requests/${requestId}`
      );
      const request = response.data;

      console.log("Fetched Request:", request);

      setCustomerInput(request.customerName || "");
      setSelectedCustomerId(request.customerId || null);
      setSelectedInvoiceType(request.invoiceType || "Both");

      const updatedData = request.details.map((detail) => ({
        __rowKey: makeKey(),
        itemVariantId: detail.itemVariantId || null,
        item: `${parseFloat(detail.thickness)} ملم ${detail.itemName || ""}`,
        origin: detail.origin || "",
        thickness: detail.thickness || "",
        length: detail.length || "",
        width: detail.width || "",
        type: detail.itemType || "",
        box: detail.itemType === "box" ? detail.quantity || 0 : "",
        sheet:
          detail.itemType === "sheet"
            ? detail.quantity || 0
            : detail.sheetsPerBox,
        sqm: detail.sqm || "",
        price: detail.price || "",
        total: detail.total || "0.00",
      }));

      setTableData(updatedData);
      
    } catch (error) {
      console.error("Error fetching request details:", error);
      showNotification("error", "Failed to fetch request details.");
    } finally {
      setLoading(false);
    }
  };


  // ====================== PRICING (Get Price) ======================

const handleGetPriceClick = async () => {

  const ids = Array.from(
    new Set(tableData.map((r) => r.batchId).filter((id) => id !== undefined && id !== null))
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
    const res = await axios.get(
      `${baseUrl}/invoices/v1/browsing/by-item-batches/${selectedCustomerId}`,
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


// put this once near your other hooks
useEffect(() => {
  const ids = Array.from(
    new Set(tableData.map(r => r.batchId).filter(id => id !== undefined && id !== null))
  );
  setSelectedBatchIds(ids);
}, [tableData]);


  const handlePricingLoadMore = async (groupKey, currentPage) => {
    try {
      const nextPage = currentPage + 1;
      const res = await axios.get(
        `${baseUrl}/invoices/v1/browsing/by-item-batches/${selectedCustomerId}`,
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
      showNotification("error", `Failed to load more. ${err.response?.data?.message || err.message}`);
    }
  };
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const calculateSQM = (length, width, type, box, sheet) => {
    if (
      !length ||
      !width ||
      box === "" ||
      sheet === "" ||
      sheet === undefined
    ) {
      return ""; // Prevent premature calculation
    }

    const lengthInMeters = length / 100; // Convert cm to meters
    const widthInMeters = width / 100; // Convert cm to meters

    if (type === "box") {
      return (lengthInMeters * widthInMeters * box * sheet).toFixed(2);
    } else if (type === "sheet") {
      return (lengthInMeters * widthInMeters * sheet).toFixed(2);
    }

    return "";
  };

  const handleNewTransaction = () => {
    setTableData([]);
    setSelectedCustomerId(null);
    setCustomerInput("");
    setSelectedCustomerName(""); 
    setCurrencyRate("89000");
    setVat("11");
    setSelectedInvoiceId(null);
    setSelectedRequestId(null);
    setSelectedInvoiceType("Both");
    setIsEditable(true);
        setSelectedBatchIds([]);
    setPricingGroups(null);
    setEditingInvoiceType(null);
    setCutMode(false);
  };

const handleInputChange = (index, field, value) => {
  const newData = [...tableData];
  newData[index][field] = value;

  const row = newData[index];

  const price = parseFloat(row.price) || 0;

  // ============ SQM ITEMS ============ //
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
  // For box/sheet: auto-calc sqm
  if (row.length && row.width && row.sheet !== "" && row.sheet !== undefined) {
    row.sqm = calculateSQM(
      row.length,
      row.width,
      row.type,
      row.box || 1,
      row.sheet
    );
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
      const response = await axios.get(
        `${baseUrl}/customers/v1/search`,
        {
          params: { query },
        }
      );
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
     const response = await axios.get(
       `${baseUrl}/customers/${customer.id}`
     );
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

 const items = tableData.map((row) => {
  const unitPrice = Number(row.price) || 0;
  const sqm = Number(row.sqm) || 0;

  // these come from:
  // - variant (fixed) for box/sheet
  // - user input for sqm (since we allow editing)
  const length = row.length !== "" && row.length != null ? Number(row.length) : null;
  const width  = row.width  !== "" && row.width  != null ? Number(row.width)  : null;
  const sheetsPerBox =
      row.type === "box" ? Number(row.sheet) || null : null;
  const quantity =
    row.type === "box"
      ? Number(row.box) || 0
      : row.type === "sheet"
      ? Number(row.sheet) || 0
      : row.type === "sqm"
      ? Number(row.sheet) || 0   // keep as sqm for now
      : 0;

  const totalAmount = Number((sqm * unitPrice).toFixed(2));
  const vatAmount   = Number((totalAmount * vatRate).toFixed(2));


  return {
    itemVariantId: row.itemVariantId,
    itemBatchId: row.batchId,
    length,
    width,
    sqm,
    unitPrice,
    totalAmount,
    sheetsPerBox,
    vat: vatAmount,
    quantity,
    sqmPieceId: row.sqmPieceId ?? null,
  };
});

    const totalWithoutVAT = items.reduce(
      (acc, item) => acc + item.totalAmount,
      0
    );
    const totalVAT = items.reduce((acc, item) => acc + item.vat, 0);
    const grandTotal = totalWithoutVAT + totalVAT;

    const payload = {
      customerId: selectedCustomerId,
      date,
      invoiceType, // should be "S"
      documentNumber: "DOC-0001", 
      currencyId: 1, 
      totalWithoutVAT: Number(totalWithoutVAT.toFixed(2)),
      totalVAT: Number(totalVAT.toFixed(2)),
      grandTotal: Number(grandTotal.toFixed(2)),
      currencyRate: parseFloat(currencyRate) || 1,
      vatPercentage: vatPercentageValue,
      items,
     
    };

    console.log("📤 Invoice Payload:", payload);

    try {
      const response = await axios.post(
        `${baseUrl}/invoices`,
        payload
      );
      console.log("✅ Invoice Created:", response.data);
      showNotification(
        "success",
        `Invoice ${invoiceType} created successfully!`
      );
      setTableData([]); // Clear after successful creation
    } catch (err) {
      console.error("❌ Error creating invoice:", err);
      showNotification(
        "error",
        `Failed to create invoice. ${
          err.response?.data?.message || err.message
        }`
      );
    } finally {
      setLoading(false);
    }
  };

const handleSelectInvoice = async (invoiceSummary) => {
  console.log("Selected Invoice:", invoiceSummary);
  if (!invoiceSummary) return;

  // Resolve the real invoice id
  const invId = invoiceSummary.invoiceId || invoiceSummary.id;
  if (!invId) {
    console.error("❌ No invoice id in selected invoice summary:", invoiceSummary);
    return;
  }

  setSelectedInvoiceId(invId);
  setSelectedRequestId(null);
  setEditingInvoiceType(invoiceSummary.invoiceType || "S");

  // 🔹 Fetch the FULL invoice (so we get sqmpieceId, original sizes, etc.)
  let invoice = invoiceSummary;
  try {
    const res = await axios.get(`${baseUrl}/invoices/${invId}`);
    invoice = res.data;
    console.log("📥 Full invoice from API:", invoice);
  } catch (err) {
    console.error("❌ Failed to fetch full invoice, using summary only:", err);
  }

  const vatPercentage = invoice.vatPercentage
    ? parseFloat(invoice.vatPercentage).toString()
    : "11";

  const currencyRateValue = invoice.currencyRate
    ? parseFloat(invoice.currencyRate).toString()
    : "89000";

  // 🔹 Fill customer / header fields
  setCustomerInput(invoice.customerName);
  setSelectedCustomerId(invoice.customerId);
  setSelectedCustomerName(invoice.customerName || "");
  setCurrencyRate(currencyRateValue);
  setIsEditable(false);
  setVat(vatPercentage);

  setCustomerPreview({
    customerName:
      invoice.customerName ??
      invoice.customer?.customerName ??
      "",
    customerAddress:
      invoice.customerAddress ??
      invoice.customer?.address ??
      "",
    customerPhone:
      invoice.customerPhone ??
      invoice.customer?.phoneNumber ??
      "",
    customerAccountNumber:
      invoice.customerAccountNumber ??
      invoice.customer?.customerAccountNumber ??
      "",
    customerTaxNumber:
      invoice.customerTaxNumber ??
      invoice.customer?.financialNumber ??
      "",
    currencyCode:
      invoice.currencyCode ??
      invoice.customer?.currency?.currencyCode ??
      "USD",
  });

  // 🔹 Build items table rows
  const updatedTableData = (invoice.items || [])
    .map((item) => {
      if (!item.itemVariantId || !item.itemName) {
        console.warn("Skipping invalid item:", item);
        return null;
      }

      // IMPORTANT: API returns `sqmpieceId`
      const sqmPieceId =
        item.sqmPieceId ??           // if you later rename in API
        item.sqmpieceId ??           // current key from your DTO
        (item.sqmPiece && item.sqmPiece.id) ??
        null;

      const type = item.itemType || (sqmPieceId ? "sqm" : "");

      return {
        __rowKey: makeKey(),
        origin: item.origin || "",
        item: `${parseFloat(item.thickness)} ملم ${item.itemName}`,
        type,

        length: item.length || "",
        width: item.width || "",
        sqm: item.sqm || "",
        price: item.unitPrice || "",
        total: item.totalAmount || "0.00",

        box: type === "box" ? item.quantity : "",
        sheet:
          type === "sheet" || type === "sqm"
            ? item.quantity            // pieces count for sheet/sqm
            : item.sheetsPerBox,       // for box rows, sheet column shows sheetsPerBox

        itemVariantId: item.itemVariantId,
        batchId: item.itemBatchId ?? (item.batch && item.batch.id) ?? null,

        // original info for tooltip / restoring
        originalLength: item.originalLength ?? null,
        originalWidth: item.originalWidth ?? null,
        originalSheetsPerBox: item.originalSheetsPerBox ?? null,

        invoiceItemId: item.invoiceItemId ?? item.id,

        // 🔥 This is what update payload will use:
        sqmPieceId: sqmPieceId,

        sheetsPerBox: item.sheetsPerBox ?? null,
      };
    })
    .filter(Boolean);

  console.log("✅ Updated Table Data (with sqmPieceId):", updatedTableData);
  setTableData(updatedTableData);

  // For preview modal
  setInvoiceData(invoice);
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

    const totalAmount = tableData.reduce(
      (acc, item) => acc + Number(item.total || 0),
      0
    );
    const vatAmount = totalAmount * (Number(vat) / 100);
    const grandTotal = totalAmount + vatAmount;

    const updatedRequestData = {
      requestId: selectedRequestId,
      customerId: selectedCustomerId,
      requestDate: date,
      totalAmount: totalAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      details: tableData.map((item) => ({
        itemVariantId: item.itemVariantId,
        sqm: Number(item.sqm),
        price: Number(item.price),
        total: Number(item.total),
        quantity: item.box ? Number(item.box) : Number(item.sheet),
      })),
    };

    try {
      const response = await axios.put(
        `${baseUrl}/requests/${selectedRequestId}`,
        updatedRequestData
      );
      console.log("✅ Request Updated:", response.data);
      showNotification("success", "Request updated successfully!");
      setIsEditable(false);
    } catch (err) {
      console.error("❌ Error updating request:", err);
      showNotification(
        "error",
        `Failed to update request. ${
          err.response?.data?.message || err.message
        }`
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

  const formattedItems = tableData.map((row, idx) => {
    const unitPrice = Number(row.price) || 0;
    const sqm = Number(row.sqm) || 0;

    const type = row.type;

    const length =
      row.length !== "" && row.length != null ? Number(row.length) : null;
    const width =
      row.width !== "" && row.width != null ? Number(row.width) : null;

    // how many sheets per box to store
    let sheetsPerBox = null;
    if (type === "box") {
      // from current sheet input or original info
      sheetsPerBox =
        Number(row.sheet) ||
        Number(row.sheetsPerBox) ||
        Number(row.originalSheetsPerBox) ||
        null;
    } else if (type === "sheet") {
      sheetsPerBox =
        Number(row.sheetsPerBox) ||
        Number(row.originalSheetsPerBox) ||
        null;
    }

    const quantity =
      type === "box"
        ? Number(row.box) || 0
        : type === "sheet"
        ? Number(row.sheet) || 0
        : type === "sqm"
        ? Number(row.sheet) || 0 // count of pieces
        : 0;

    const totalAmount = Number((sqm * unitPrice).toFixed(2));
    const vatAmount = Number((totalAmount * vatRate).toFixed(2));

    if (row.batchId == null) {
      console.warn(`Row ${idx} missing batchId`, row);
    }

    return {
      // 🔹 existing line id so backend can treat as "changed", not "new"
      id: row.invoiceItemId ?? row.id ?? undefined,

      itemBatchId: Number(row.batchId),
      itemVariantId: Number(row.itemVariantId),

      // 🔹 NEW: keep geometry
      length,
      width,
      sheetsPerBox,

      sqm,
      unitPrice,
      totalAmount,
      vat: vatAmount,
      quantity,
      invoiceId: Number(selectedInvoiceId),

      // 🔹 NEW: preserve sqm piece link
      sqmPieceId:
        row.sqmPieceId ??
        (row.sqmPiece && row.sqmPiece.id) ??
        null,
    };
  });

  // Header totals (recomputed from formatted items)
  const totalWithoutVAT = formattedItems.reduce(
    (a, it) => a + it.totalAmount,
    0
  );
  const totalVAT = formattedItems.reduce(
    (a, it) => a + it.vat,
    0
  );
  const grandTotal = totalWithoutVAT + totalVAT;

  const typeToSave = editingInvoiceType ?? selectedInvoiceType;

  const invoiceData = {
    id: selectedInvoiceId,
    customerId: selectedCustomerId,
    invoiceType: typeToSave, // 'S' | 'G' | 'RVR'
    date,
    currencyRate: Number(currencyRate) || 1,
    vatPercentage: vatPct,
    totalWithoutVAT: Number(totalWithoutVAT.toFixed(2)),
    totalVAT: Number(totalVAT.toFixed(2)),
    grandTotal: Number(grandTotal.toFixed(2)),
    items: formattedItems,
  };

  console.log("📤 Sending Invoice Update Payload:", invoiceData);

  try {
    const response = await axios.put(
      `${baseUrl}/invoices/${selectedInvoiceId}`,
      invoiceData
    );
    console.log("✅ Invoice Updated:", response.data);
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

    const totalAmount = tableData.reduce(
      (acc, item) => acc + Number(item.total || 0),
      0
    );
    const vatAmount = totalAmount * (Number(vat) / 100);
    const grandTotal = totalAmount + vatAmount;

    const requestData = {
      customerId: selectedCustomerId,
      requestDate: date,
      totalAmount: totalAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      details: tableData.map((item) => ({
        itemVariantId: item.itemVariantId,
        sqm: Number(item.sqm),
        price: Number(item.price),
        total: Number(item.total),
        quantity: item.box ? Number(item.box) : Number(item.sheet),
      })),
    };

    console.log("📤 Sending Request Data:", requestData);

    try {
      const response = await axios.post(
        `${baseUrl}/requests`,
        requestData
      );
      console.log("✅ Request Created:", response.data);
      showNotification("success", "Request created successfully!");

      setTableData([]); // Clear table after request creation
    } catch (err) {
      console.error("❌ Error creating request:", err);
      showNotification(
        "error",
        `Failed to create request. ${
          err.response?.data?.message || err.message
        }`
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

      <div
        className={`pos-page-center ${showOnlyCenter ? "expanded-center" : ""}`}
      >
        <div className="pos-page-toolbar">
          <Toolbar
            handleNewTransaction={handleNewTransaction}
            handleEditInvoice={handleEditInvoice}
            handleSaveRequest={handleSaveRequest}
            handleSaveInvoice={handleSaveInvoice}
            handleEditRequest={handleEditRequest}
            handleCreateRequest={handleCreateRequest}
            handleCreateInvoice={handleCreateInvoice}
            loading={loading}
            selectedInvoiceId={selectedInvoiceId}
            selectedRequestId={selectedRequestId}
            selectedInvoiceType={selectedInvoiceType}
            date={date}
            setDate={setDate}
            isEditable={isEditable}
            setShowPreview={setShowPreview}
                handleOpenStatement={() => setShowStatement(true)}
    canOpenStatement={!!selectedCustomerId}

          />
          
 {showPreview && (
<InvoiceModal
  isOpen={showPreview}
  onClose={() => setShowPreview(false)}
  invoiceData={{
    ...customerPreview,
    ...(invoiceData || {}),
    date: (invoiceData?.date ?? date),
    vatPercentage: (invoiceData?.vatPercentage ?? (Number(vat) || 0)),
    currencyRate: (invoiceData?.currencyRate ?? (Number(currencyRate) || 1)),
    currencyCode: (invoiceData?.currencyCode ?? customerPreview.currencyCode ?? "USD"),
    invoiceType: (invoiceData?.invoiceType ?? selectedInvoiceType ?? "S"),
  }}


       cssHref="/invoicePreview.css"       
  />
)}


          <StatementModal
  isOpen={showStatement}
  onClose={() => setShowStatement(false)}
  customerId={selectedCustomerId}
  defaultDate={date}
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
          />
        </div>
      </div>





<div className="pos-page-toggle-wrapper">
  <ToggleSwitch
    showOnlyCenter={showOnlyCenter}
    setShowOnlyCenter={setShowOnlyCenter}
  />
</div>

{/* Always show PricingTable when toggle is ON */}
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
          <InvoicesList onSelectInvoice={handleSelectInvoice}  searchTerm={invoiceSearch} />
        </div>
      )}

      {/* Context Menu for Right Click */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="delete-button" onClick={handleDeleteRow}>
            Delete
          </button>
        </div>
      )}

      {/* Notification Modal */}
      {notification.show && (
        <NotificationModal
          type={notification.type}
          message={notification.message}
          onClose={closeNotification}
          onConfirm={notification.onConfirm || closeNotification}
        />
      )}

      <SearchModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSelectItems={handleSelectItems}
      />
    </div>
  );
};

export default POSSystemPage;
