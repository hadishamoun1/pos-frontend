import React, { useState } from "react";
import { FaFileInvoiceDollar, FaClipboardList } from "react-icons/fa";
import "./pos.css";

const POSSystemPage = () => {
  const [tableData, setTableData] = useState([
    {
      origin: "",
      item: "",
      box: "",
      sheet: "",
      quantity: "",
      sqm: "",
      price: "",
    },
  ]);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);

  const handleInputChange = (index, field, value) => {
    const newData = [...tableData];
    newData[index][field] = value;
    setTableData(newData);
  };

  const addRow = () => {
    setTableData([
      ...tableData,
      {
        origin: "",
        item: "",
        box: "",
        sheet: "",
        quantity: "",
        sqm: "",
        price: "",
      },
    ]);
  };

  return (
    <div className="pos-page-container">
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
            <button className="pos-page-toolbar-button pos-page-red-button">
              Issue
            </button>
            <button className="pos-page-toolbar-button pos-page-yellow-button">
              Offer
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pos-page-date-input"
            />
          </div>

          {/* Restored: Dropdowns & Checkbox Row */}
          <div className="pos-page-toolbar-row">
            {/* Left Side: Dropdowns */}
            <div className="pos-page-dropdown-container">
              <select className="pos-page-exchange-rate-dropdown">
                <option value="usd">USD Ex Rate</option>
                <option value="eur">EUR Ex Rate</option>
              </select>

              <select className="pos-page-vat-dropdown">
                <option value="" disabled hidden>
                  VAT
                </option>
                <option value="0">0%</option>
                <option value="6">6%</option>
                <option value="11">11%</option>
              </select>
            </div>

            {/* Right Side: Company Name Checkbox */}
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

          {/* Restored: Customer Name Input Row */}
          <div className="pos-page-customer-name-row">
            <label className="pos-page-customer-name-label">
              Customer Name
            </label>
            <input
              type="text"
              placeholder="Enter Customer Name"
              className="pos-page-customer-name-input"
            />
          </div>
        </div>

        {/* Inventory Table */}
        <table className="pos-page-inventory-table">
          <thead>
            <tr>
              <th>Origin</th>
              <th>Item</th>
              <th>Box</th>
              <th>Sheet</th>
              <th>Quantity</th>
              <th>SQM</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={row.origin}
                    onChange={(e) =>
                      handleInputChange(index, "origin", e.target.value)
                    }
                    placeholder="Enter origin"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.item}
                    onChange={(e) =>
                      handleInputChange(index, "item", e.target.value)
                    }
                    placeholder="Enter item"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.box}
                    onChange={(e) =>
                      handleInputChange(index, "box", e.target.value)
                    }
                    placeholder="Enter box"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.sheet}
                    onChange={(e) =>
                      handleInputChange(index, "sheet", e.target.value)
                    }
                    placeholder="Enter sheet"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.quantity}
                    onChange={(e) =>
                      handleInputChange(index, "quantity", e.target.value)
                    }
                    placeholder="Enter quantity"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.sqm}
                    onChange={(e) =>
                      handleInputChange(index, "sqm", e.target.value)
                    }
                    placeholder="Enter sqm"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.price}
                    onChange={(e) =>
                      handleInputChange(index, "price", e.target.value)
                    }
                    placeholder="Enter price"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="pos-page-button-container">
          <button onClick={addRow} className="pos-page-add-row-button">
            Add Row
          </button>
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
      </div>
    </div>
  );
};

export default POSSystemPage;
