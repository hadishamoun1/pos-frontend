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

  const handleSearchClick = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };
  // ✅ Function to show notification modal
  const showNotification = (type, message, onConfirm = null) => {
    setNotification({ show: true, type, message, onConfirm });
  };

  // ✅ Close notification modal
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
    const updatedData = selectedItems.map((item) => ({
      itemVariantId: item.itemVariantId,
      origin: item.origin || "",
      item: item.item || "",
      type: item.type || "",
      length: item.length || "",
      width: item.width || "",
      box: item.type === "box" ? 1 : "",
      sheet: item.type === "sheet" ? 1 : item.sheetsPerBox,
      sqm: item.sqm,
      price: "",
      total: "0.00",
    }));

    setTableData((prevData) => [...prevData, ...updatedData]);
  };
  const handleSelectRequest = async (requestId) => {
    console.log("Fetching request details for ID:", requestId);
    
    if (!requestId) return;
  
    setSelectedRequestId(requestId);
    setSelectedInvoiceId(null);
    setLoading(true);
  
    try {
      // ✅ Fetch full request details
      const response = await axios.get(`http://localhost:3000/requests/${requestId}`);
      const request = response.data;
  
      console.log("Fetched Request:", request);
  
      // ✅ Set customer details
      setCustomerInput(request.customerName || "");
      setSelectedCustomerId(request.customerId || null);
      
      // ✅ Set invoice type
      setSelectedInvoiceType(request.invoiceType || "Both");
  
      // ✅ Map details properly
      const updatedData = request.details.map((detail) => ({
        itemVariantId: detail.itemVariantId || null,
        item: `${parseFloat(detail.thickness)} ملم ${detail.itemName || ""}`,
        origin: detail.origin || "",
        thickness: detail.thickness || "",
        length: detail.length || "",
        width: detail.width || "",
        type: detail.itemType || "",
        box: detail.itemType === "box" ? detail.quantity || 0 : "",
        sheet: detail.itemType === "sheet" ? detail.quantity || 0 : detail.sheetsPerBox,
        sqm: detail.sqm || "",
        price: detail.price || "",
        total: detail.total || "0.00",
      }));
  
      console.log("Updated Table Data:", updatedData);
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

  // Function to calculate SQM based on type (converting cm to meters)
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
    setCurrencyRate("89000");
    setVat("11");
    setSelectedInvoiceId(null);
    setSelectedRequestId(null);
    setSelectedInvoiceType("Both"); 
  };

  const handleInputChange = (index, field, value) => {
    const newData = [...tableData];
    newData[index][field] = value;

    // Automatically calculate sqm when all necessary fields are filled
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
  // Handle input change
  const handleCustomerInputChange = (e) => {
    const query = e.target.value;
    setCustomerInput(query);

    if (query.length > 1) {
      fetchCustomers(query); // ✅ Fetch only if input length > 1
    } else {
      setCustomerSuggestions([]); // ✅ Clear suggestions if input is too short
    }
  };

  // Handle customer selection
  const handleCustomerSelect = async (customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.customerName);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]); // Hide suggestions

    try {
      // Fetch the customer's invoice type
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
  // Handle keyboard navigation
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

  // Handle Invoice Creation (Issue = "S", Offer = "G")
  const handleCreateInvoice = async (invoiceType) => {
    if (!selectedCustomerId || tableData.length === 0) {
      setError("Customer and items are required.");
      return;
    }

    setLoading(true);
    setError("");

    const vatPercentageValue = Number(vat); // ✅ Get the VAT % from dropdown
    const vatRate = vatPercentageValue / 100; // ✅ Convert to decimal

    const formattedItems = tableData.map((item) => {
      const unitPrice = Number(item.price) || 0;
      const sqm = Number(item.sqm) || 0;

      // ✅ Determine correct quantity based on item type
      const quantity =
        item.type === "box" ? Number(item.box) : Number(item.sheet);

      const totalAmount = sqm * unitPrice;
      const vatAmount = totalAmount * vatRate; // ✅ Apply VAT dynamically

      return {
        itemVariantId: item.itemVariantId,
        sqm: sqm,
        unitPrice: unitPrice,
        vat: vatAmount, // ✅ VAT calculated dynamically
        quantity, // ✅ Correct quantity assigned
      };
    });

    const invoiceData = {
      customerId: selectedCustomerId,
      invoiceType,
      date,
      currencyRate: parseFloat(currencyRate) || 1,
      vatPercentage: vatPercentageValue, // ✅ Save the VAT percentage
      items: formattedItems,
    };

    console.log("📤 Sending Invoice Data:", invoiceData);

    try {
      const response = await axios.post(
        "http://localhost:3000/invoices",
        invoiceData
      );
      console.log("✅ Invoice Created:", response.data);
      showNotification(
        "success",
        `Invoice ${invoiceType} created successfully!`
      );
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
    console.log("Selected Invoice:", invoice); // ✅ Debugging

    if (!invoice) return;

    setSelectedInvoiceId(invoice.invoiceId || null);
    setSelectedRequestId(null);

    // ✅ Extract VAT and Currency Rate properly
    const vatPercentage = invoice.vatPercentage
      ? parseFloat(invoice.vatPercentage).toString() // Convert "6.0000" -> "6"
      : "11"; // Default to 11% if missing

    const currencyRateValue = invoice.currencyRate
      ? parseFloat(invoice.currencyRate).toString() // Ensure valid conversion
      : "89000"; // Default currency rate

    // ✅ Update UI fields
    setCustomerInput(invoice.customerName);
    setSelectedCustomerId(invoice.customerId);
    setCurrencyRate(currencyRateValue); // ✅ Ensure currency rate updates
    setVat(vatPercentage); // ✅ Ensure VAT dropdown updates

    // ✅ Format table data properly
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
        };
      })
      .filter(Boolean); // ✅ Remove any null values

    console.log("Updated Table Data:", updatedTableData);

    setTableData(updatedTableData);
  };

  useEffect(() => {
    console.log("Updated selected invoice id:", selectedInvoiceId);
  }, [selectedInvoiceId]);

  const handleEditRequest = async () => {
    if (!selectedRequestId || tableData.length === 0) {
      showNotification("error", "No request selected or items missing.");
      return;
    }

    setLoading(true);

    // Calculate totals
    const totalAmount = tableData.reduce(
      (acc, item) => acc + Number(item.total || 0),
      0
    );
    const vatAmount = totalAmount * (Number(vat) / 100);
    const grandTotal = totalAmount + vatAmount;

    // Prepare the updated request payload
    const updatedRequestData = {
      requestId: selectedRequestId, // ✅ Ensure we are updating the correct request
      customerId: selectedCustomerId,
      requestDate: date,
      totalAmount: totalAmount.toFixed(2),
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      details: tableData.map((item) => ({
        itemVariantId: item.itemVariantId, // Ensure this exists
        sqm: Number(item.sqm),
        price: Number(item.price),
        total: Number(item.total),
        quantity: item.box ? Number(item.box) : Number(item.sheet),
      })),
    };

    console.log("📤 Updating Request:", updatedRequestData);

    try {
      const response = await axios.put(
        `http://localhost:3000/requests/${selectedRequestId}`,
        updatedRequestData
      );
      console.log("✅ Request Updated:", response.data);
      showNotification("success", "Request updated successfully!");
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
    }
  };
  const handleEditInvoice = async () => {
    console.log("Editinggg");
  };
  const handleCreateRequest = async () => {
    if (!selectedCustomerId || tableData.length === 0) {
      showNotification("error", "Customer and items are required.");
      return;
    }

    setLoading(true);

    // Calculate totals
    const totalAmount = tableData.reduce(
      (acc, item) => acc + Number(item.total || 0),
      0
    );
    const vatAmount = totalAmount * (Number(vat) / 100);
    const grandTotal = totalAmount + vatAmount;

    // Format the request payload exactly as expected by the API
    const requestData = {
      customerId: selectedCustomerId,
      requestDate: date,
      totalAmount: totalAmount.toFixed(2), // Ensure numbers are properly formatted
      vatAmount: vatAmount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      details: tableData.map((item) => ({
        itemVariantId: item.itemVariantId, // Make sure this is defined
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

      // Clear table after successful request
      setTableData([]);
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

      {/* Center Section */}
      <div className="pos-page-center">
        <div className="pos-page-toolbar">
          <Toolbar
            handleNewTransaction={handleNewTransaction}
            handleEditInvoice={handleEditInvoice}
            handleEditRequest={handleEditRequest}
            handleCreateRequest={handleCreateRequest}
            handleCreateInvoice={handleCreateInvoice}
            loading={loading}
            selectedInvoiceId={selectedInvoiceId}
            selectedRequestId={selectedRequestId}
            selectedInvoiceType={selectedInvoiceType}
            date={date}
            setDate={setDate}
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
          />
        </div>
      </div>

      {/* Right Sidebar */}
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
