import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FaTrash } from "react-icons/fa";
import "./purchases-invoice.css";

const fetchSuppliers = async () => {
  const response = await fetch("http://localhost:3000/suppliers");
  return response.json();
};

const fetchItems = async () => {
  const response = await fetch("http://localhost:3000/items");
  return response.json();
};

const PurchasesInvoicePage = () => {
  const [supplierName, setSupplierName] = useState("");
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [items, setItems] = useState([]);
  const [vat, setVat] = useState(0);
  const [showItemModal, setShowItemModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["items"],
    queryFn: fetchItems,
  });

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(supplierName.toLowerCase())
  );

  const openItemModal = () => {
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    const newSelectedItems = selectedItems.map((item) => ({
      id: Date.now() + Math.random(), // unique id
      ...item,
      quantity: 1,
      sqm: 0,
      unitPrice: "",
      total: 0,
    }));
    setItems((prevItems) => [...prevItems, ...newSelectedItems]);
    setSelectedItems([]);
    setShowItemModal(false);
  };

  const filteredItems = allItems.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckboxChange = (item, dimension) => {
    const isSelected = selectedItems.find(
      (selectedItem) =>
        selectedItem.itemName === item.itemName &&
        selectedItem.origin === dimension.origin &&
        selectedItem.length === dimension.length &&
        selectedItem.width === dimension.width
    );

    if (isSelected) {
      setSelectedItems(
        selectedItems.filter(
          (selectedItem) =>
            !(
              selectedItem.itemName === item.itemName &&
              selectedItem.origin === dimension.origin &&
              selectedItem.length === dimension.length &&
              selectedItem.width === dimension.width
            )
        )
      );
    } else {
      setSelectedItems([
        ...selectedItems,
        {
          itemName: item.itemName,
          origin: dimension.origin,
          length: dimension.length,
          width: dimension.width,
          sheetsPerBox: dimension.sheetsPerBox || 1,
        },
      ]);
    }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    const { length, width, quantity, sheetsPerBox, unitPrice } =
      newItems[index];
    const sqm = (length * width * quantity * sheetsPerBox) / 10000;
    newItems[index].sqm = sqm;
    newItems[index].total = sqm * unitPrice;

    setItems(newItems);
  };

  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = totalAmount * (vat / 100);
  const grandTotal = totalAmount + vatAmount;

  return (
    <div className="purchase-invoice-container">
      <div className="header">
        <h2>Create Purchase Invoice</h2>
        <button className="save-button">Save Invoice</button>
      </div>

      <div className="invoice-details">
        <label style={{ position: "relative" }}>
          Supplier Name
          <input
            type="text"
            value={supplierName}
            onChange={(e) => {
              setSupplierName(e.target.value);
              setShowSupplierSuggestions(true);
            }}
            onFocus={() => setShowSupplierSuggestions(true)}
            onBlur={() =>
              setTimeout(() => setShowSupplierSuggestions(false), 100)
            }
            placeholder="Enter supplier name"
          />
          {showSupplierSuggestions && filteredSuppliers.length > 0 && (
            <div className="suggestions-box">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="suggestion-item"
                  onMouseDown={() => {
                    setSupplierName(supplier.name);
                    setShowSupplierSuggestions(false);
                  }}
                >
                  {supplier.name}
                </div>
              ))}
            </div>
          )}
        </label>
        <label>
          Invoice Number
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="Enter invoice number"
          />
        </label>
        <label>
          Date
          <input
            type="date"
            value={invoiceDate}
            onChange={(e) => setInvoiceDate(e.target.value)}
          />
        </label>
      </div>

      <div className="items-table">
        <h3>Items</h3>
        <table>
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Origin</th>
              <th>Length (cm)</th>
              <th>Width (cm)</th>
              <th>Quantity</th>
              <th>Sheets/Box</th>
              <th>SQM</th>
              <th>Unit Price</th>
              <th>Total</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id}>
                <td>{item.itemName}</td>
                <td>{item.origin}</td>
                <td>{item.length}</td>
                <td>{item.width}</td>
                <td>
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "quantity",
                        Number(e.target.value)
                      )
                    }
                  />
                </td>
                <td>{item.sheetsPerBox}</td>
                <td>{item.sqm.toFixed(2)}</td>
                <td>
                  <input
                    type="number"
                    value={item.unitPrice}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "unitPrice",
                        Number(e.target.value)
                      )
                    }
                  />
                </td>
                <td>{item.total.toFixed(2)}</td>
                <td>
                  <button
                    className="delete-button"
                    onClick={() => deleteItem(item.id)}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button className="select-item-button" onClick={openItemModal}>
          Select Item
        </button>
      </div>

      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Select Items and Dimensions</h3>
            <input
              type="text"
              placeholder="Search for items"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="modal-search"
            />
            <table className="modal-items-table">
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Item Name</th>
                  <th>Origin</th>
                  <th>Length (cm)</th>
                  <th>Width (cm)</th>
                  <th>Sheets/Box</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) =>
                  item.dimensions.map((dimension) => (
                    <tr key={`${item.id}-${dimension.dimensionId}`}>
                      <td>
                        <input
                          type="checkbox"
                          onChange={() => handleCheckboxChange(item, dimension)}
                          checked={selectedItems.some(
                            (selectedItem) =>
                              selectedItem.itemName === item.itemName &&
                              selectedItem.origin === dimension.origin &&
                              selectedItem.length === dimension.length &&
                              selectedItem.width === dimension.width
                          )}
                        />
                      </td>
                      <td>{item.itemName}</td>
                      <td>{dimension.origin}</td>
                      <td>{dimension.length}</td>
                      <td>{dimension.width}</td>
                      <td>{dimension.sheetsPerBox || ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <button className="close-modal-button" onClick={closeItemModal}>
              Close
            </button>
          </div>
        </div>
      )}

      <div className="summary-section">
        <label>
          VAT
          <select value={vat} onChange={(e) => setVat(Number(e.target.value))}>
            <option value="0">0%</option>
            <option value="6">6%</option>
            <option value="11">11%</option>
          </select>
        </label>
        <div className="totals">
          <p>Total Amount: ${totalAmount.toFixed(2)}</p>
          <p>VAT Amount: ${vatAmount.toFixed(2)}</p>
          <p>Grand Total: ${grandTotal.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
};

export default PurchasesInvoicePage;
