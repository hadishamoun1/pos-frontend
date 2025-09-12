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
import InvoicePreview from "./invoicePreview";
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

  const handleSearchClick = () => {
    setModalOpen(true);
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

  const handleSelectItems = (selectedItems) => {
    const updatedData = selectedItems.map((item) => {
      const length = parseFloat(item.length);
      const width = parseFloat(item.width);
      const type = item.type;
      const sheetsPerBox = parseFloat(item.sheetsPerBox);

      // Default quantity = 1 for both types
      const quantity = 1;

      let sqm = "";
      if (length && width && quantity) {
        const sqmPerSheet = (length / 100) * (width / 100);
        if (type === "box") {
          sqm = (sqmPerSheet * sheetsPerBox * quantity).toFixed(2);
        } else if (type === "sheet") {
          sqm = (sqmPerSheet * quantity).toFixed(2);
        } else if (type === "sqm") {
          sqm = quantity.toFixed(2);
        }
      }

      return {
        itemVariantId: item.itemVariantId,
        batchId: item.batchId,
        origin: item.origin || "",
        item: `${parseFloat(item.thickness)} ملم ${item.itemName}` || "",
        type: item.type || "",
        length: item.length || "",
        width: item.width || "",
        box: type === "box" ? quantity : "",
        sheet: type === "sheet" ? quantity : item.sheetsPerBox,
        quantity,
        sqm,
        price: "",
        total: "0.00",
      };
    });

    console.log("Selected Items:", selectedItems);
    console.log("Updated Table Data:", updatedData);

    setTableData((prevData) => [...prevData, ...updatedData]);
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
        `http://localhost:3000/requests/${requestId}`
      );
      const request = response.data;

      console.log("Fetched Request:", request);

      setCustomerInput(request.customerName || "");
      setSelectedCustomerId(request.customerId || null);
      setSelectedInvoiceType(request.invoiceType || "Both");

      const updatedData = request.details.map((detail) => ({
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
  };

  const handleInputChange = (index, field, value) => {
    const newData = [...tableData];
    newData[index][field] = value;

    if (newData[index].length && newData[index].width && newData[index].sheet) {
      newData[index].sqm = calculateSQM(
        newData[index].length,
        newData[index].width,
        newData[index].type,
        newData[index].box || 1,
        newData[index].sheet
      );
    } else {
      newData[index].sqm = "";
    }

    const price = parseFloat(newData[index].price) || 0;
    const sqm = parseFloat(newData[index].sqm) || 0;
    newData[index].total = (sqm * price).toFixed(2);

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
      const updatedTable = tableData.filter(
        (_, index) => index !== selectedRowIndex
      );
      setTableData(updatedTable);
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
        `http://localhost:3000/customers/v1/search`,
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
      fetchCustomers(query); // Fetch only if input length > 1
    } else {
      setCustomerSuggestions([]); // Clear suggestions if input is too short
    }
  };

  const handleCustomerSelect = async (customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.customerName);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]); // Hide suggestions

    try {
      const response = await axios.get(
        `http://localhost:3000/customers/${customer.id}`
      );
      const customerData = response.data;

      if (customerData.invoiceType) {
        setSelectedInvoiceType(customerData.invoiceType || "Both"); // Set invoice type (S, G, or Both)
      } else {
        setSelectedInvoiceType("Both"); // Default to 'Both' if missing
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
      setSelectedInvoiceType("Both"); // Default fallback
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

    const items = tableData.map((item) => {
      const unitPrice = Number(item.price) || 0;
      const sqm = Number(item.sqm) || 0;
      const quantity =
        item.type === "box" ? Number(item.box) : Number(item.sheet);

      const totalAmount = sqm * unitPrice;
      const vatAmount = totalAmount * vatRate;

      return {
        itemVariantId: item.itemVariantId,
        itemBatchId: item.batchId, // ensure batchId is present
        sqm,
        unitPrice,
        totalAmount: Number(totalAmount.toFixed(2)),
        vat: Number(vatAmount.toFixed(2)),
        quantity,
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
      documentNumber: "DOC-0001", // Can be replaced with actual document number if needed
      currencyId: 1, // You can make this dynamic later
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
        "http://localhost:3000/invoices",
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

  const handleSelectInvoice = (invoice) => {
    console.log("Selected Invoice:", invoice);

    if (!invoice) return;

    setSelectedInvoiceId(invoice.invoiceId || null);
    setSelectedRequestId(null);

    const vatPercentage = invoice.vatPercentage
      ? parseFloat(invoice.vatPercentage).toString()
      : "11";

    const currencyRateValue = invoice.currencyRate
      ? parseFloat(invoice.currencyRate).toString()
      : "89000";

    setCustomerInput(invoice.customerName);
    setSelectedCustomerId(invoice.customerId);
    setSelectedCustomerName(invoice.customerName || "");
    setCurrencyRate(currencyRateValue);
    setIsEditable(false);
    setVat(vatPercentage);

    const updatedTableData = invoice.items
      .map((item) => {
        if (!item.itemVariantId || !item.itemName) {
          console.warn("Skipping invalid item:", item);
          return null;
        }

        return {
          origin: item.origin || "",
          item: `${parseFloat(item.thickness)} ملم ${item.itemName}`,
          type: item.itemType || "",
          length: item.length || "",
          width: item.width || "",
          sqm: item.sqm || "",
          price: item.unitPrice || "",
          total: item.totalAmount || "0.00",
          box: item.itemType === "box" ? item.quantity : "",
          sheet: item.itemType === "sheet" ? item.quantity : item.sheetsPerBox,
          itemVariantId: item.itemVariantId,
        };
      })
      .filter(Boolean);

    console.log("Updated Table Data:", updatedTableData);

    setTableData(updatedTableData);
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
        `http://localhost:3000/requests/${selectedRequestId}`,
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

    // Ensure that the data is formatted to match backend expectations
    const formattedItems = tableData.map((item) => ({
      itemVariantId: item.itemVariantId,
      sqm: parseFloat(item.sqm) || 0,
      unitPrice: parseFloat(item.price) || 0,
      vat: parseFloat(item.vat) || 0,
      quantity: parseInt(item.box || item.sheet, 10),
    }));

    const invoiceData = {
      id: selectedInvoiceId,
      customerId: selectedCustomerId,
      invoiceType: selectedInvoiceType,
      date,
      currencyRate: parseFloat(currencyRate) || 1,
      vatPercentage: parseFloat(vat) || 0,
      items: formattedItems,
    };

    console.log("📤 Sending Invoice Data:", invoiceData);

    try {
      const response = await axios.put(
        `http://localhost:3000/invoices/${selectedInvoiceId}`,
        invoiceData
      );
      console.log("Invoice Updated:", response.data);
      showNotification("success", "Invoice updated successfully!");
    } catch (err) {
      console.error("Error saving invoice:", err);
      showNotification("error", `Failed to save invoice: ${err.message}`);
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
        "http://localhost:3000/requests",
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
          />
          <RequestCard onSelectRequest={handleSelectRequest} />
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
              invoiceData={<InvoicePreview invoiceData={invoiceData} />}
              onClose={() => setShowPreview(false)}
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
          />
        </div>
      </div>

      {showOnlyCenter && <PricingTable />}
      <div className="pos-page-toggle-wrapper">
        <ToggleSwitch
          showOnlyCenter={showOnlyCenter}
          setShowOnlyCenter={setShowOnlyCenter}
        />
      </div>

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
          />
          <InvoicesList onSelectInvoice={handleSelectInvoice} />
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
