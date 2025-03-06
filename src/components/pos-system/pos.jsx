import React, { useState, useEffect } from "react";
import { FaFileInvoiceDollar, FaClipboardList } from "react-icons/fa";
import "./pos.css";
import SearchModal from "./searchModal";
import RequestCard from "./requests";
import InvoiceCreation from "./invoiceCreation";
import InvoicesList from "./invoiceList";
import axios from "axios";

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

  const handleSearchClick = () => {
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

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

  // Autofill table when a request is clicked
  const handleSelectRequest = (request) => {
    setSelectedCustomerName(request.customerName);
    const updatedData = request.details.map((detail) => ({
      origin: detail.origin,
      item: detail.itemName,
      type: detail.type,
      length: detail.length,
      width: detail.width,
      box: detail.box || "",
      sheet: detail.sheet || detail.sheetPerBox || "",
      sqm: detail.sqm,
      price: detail.price,
      total: detail.total,
    }));

    setTableData(updatedData);
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
  const handleCustomerSelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setSelectedCustomerName(customer.customerName);
    setCustomerInput(customer.customerName);
    setCustomerSuggestions([]); // Hide suggestions
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

    const formattedItems = tableData.map((item) => {
      const unitPrice = Number(item.price) || 0; // ✅ Ensure it's a number
      const sqm = Number(item.sqm) || 0;
      const vatRate = Number(vat) / 100; // ✅ Ensure VAT rate is a number

      const totalAmount = sqm * unitPrice;
      const vatAmount = totalAmount * vatRate;

      return {
        itemVariantId: item.itemVariantId, // ✅ Ensure this exists
        sqm: sqm, // ✅ Send as a number
        unitPrice: unitPrice,
        vat: vatAmount,
      };
    });

    const invoiceData = {
      customerId: selectedCustomerId,
      invoiceType,
      date,
      currencyRate: parseFloat(currencyRate) || 1,
      items: formattedItems,
    };

    // 🔍 Log before sending to see what is being sent
    console.log("Invoice Data Payload:", JSON.stringify(invoiceData, null, 2));
    console.log("📤 Sending Invoice Data:", {
      customerId: selectedCustomerId,
      invoiceType,
      date,
      currencyRate: Number(currencyRate), // ✅ Convert to a number
      items: formattedItems,
    });

    try {
      const response = await axios.post(
        "http://localhost:3000/invoices",
        invoiceData
      );
      console.log("Invoice Created:", response.data);
      alert(`Invoice ${invoiceType} created successfully!`);
    } catch (err) {
      console.error("Error creating invoice:", err);
      console.error("Server Response:", err.response?.data);
      setError(
        `Failed to create invoice. Error: ${
          err.response?.data?.message || err.message
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInvoice = (invoice) => {
    console.log("Selected Invoice:", invoice);
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
          <div className="pos-page-button-row">
            <button className="pos-page-toolbar-button pos-page-blue-button">
              New
            </button>
            <button className="pos-page-toolbar-button pos-page-blue-button">
              Request
            </button>
            <button
              className="pos-page-toolbar-button pos-page-red-button"
              onClick={() => handleCreateInvoice("S")}
              disabled={loading}
            >
              {loading ? "Processing..." : "Issue"}
            </button>
            <button
              className="pos-page-toolbar-button pos-page-yellow-button"
              onClick={() => handleCreateInvoice("G")}
              disabled={loading}
            >
              {loading ? "Processing..." : "Offer"}
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Dropdowns & Checkbox Row */}
          <div className="pos-page-toolbar-row">
            <div className="pos-page-dropdown-container">
              <select className="pos-page-exchange-rate-dropdown">
                value={currencyRate}
                onChange={(e) => setCurrencyRate(e.target.value)}
                <option value="89000">89,000</option>
                <option value="1500">1500</option>
              </select>

              <select
                className="pos-page-vat-dropdown"
                value={vat}
                onChange={(e) => setVat(e.target.value)}
              >
                <option value="0">0%</option>
                <option value="6">6%</option>
                <option value="11">11%</option>
              </select>
            </div>

            <div className="pos-page-checkbox-container">
              <input type="checkbox" id="company-name-checkbox" />
              <label
                htmlFor="company-name-checkbox"
                className="pos-page-checkbox-label"
              >
                Company Name
              </label>
            </div>
          </div>

          {/* Customer Name Input Row */}
          <div className="pos-page-customer-name-row">
            <label className="pos-page-customer-name-label">
              Customer Name
            </label>
            <div className="pos-page-customer-search-container">
              {/* Customer Search Input */}
              <input
                type="text"
                value={customerInput}
                onChange={handleCustomerInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Search Customer Name"
                className="pos-page-customer-name-input"
              />

              {/* Suggestions Dropdown */}
              {customerSuggestions.length > 0 && (
                <ul className="customer-suggestions-dropdown">
                  {customerSuggestions.map((customer, index) => (
                    <li
                      key={customer.id}
                      className={index === highlightedIndex ? "selected" : ""}
                      onClick={() => handleCustomerSelect(customer)}
                    >
                      {customer.customerName}
                    </li>
                  ))}
                </ul>
              )}

              <button
                className="pos-page-toolbar-button pos-page-blue-button"
                style={{ marginLeft: "auto" }}
                onClick={handleSearchClick}
              >
                Search
              </button>
            </div>
          </div>
        </div>
        <div className="pos-page-inventory-table-container">
          {/* Inventory Table */}
          <table className="pos-page-inventory-table">
            <thead>
              <tr>
                <th>Origin</th>
                <th>Item</th>
                <th>Type</th>
                <th>Length</th>
                <th>Width</th>
                <th>Box</th>
                <th>Sheet</th>
                <th>SQM</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, index) => (
                <tr
                  key={index}
                  onClick={() => handleRowClick(index)}
                  onContextMenu={(e) => handleRightClick(e, index)}
                  className={
                    index === selectedRowIndex ? "pos-selected-row" : ""
                  }
                >
                  <td>
                    <input type="text" value={row.origin} readOnly />
                  </td>
                  <td>
                    <input type="text" value={row.item} readOnly />
                  </td>
                  <td>
                    <input type="text" value={row.type} readOnly />
                  </td>
                  <td>
                    <input type="text" value={row.length} readOnly />
                  </td>
                  <td>
                    <input type="text" value={row.width} readOnly />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.box}
                      onChange={(e) =>
                        handleInputChange(index, "box", e.target.value)
                      }
                      disabled={row.type === "sheet"}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={row.sheet}
                      onChange={(e) =>
                        handleInputChange(index, "sheet", e.target.value)
                      }
                      readOnly={row.type === "box"}
                    />
                  </td>
                  <td>
                    <input type="text" value={row.sqm} readOnly />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.price}
                      onChange={(e) =>
                        handleInputChange(index, "price", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input type="text" value={row.total} readOnly />
                  </td>{" "}
                </tr>
              ))}
            </tbody>
          </table>
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

      <SearchModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSelectItems={handleSelectItems}
      />
    </div>
  );
};

export default POSSystemPage;
