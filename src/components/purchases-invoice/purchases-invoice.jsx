import React, { useState } from "react";
import { FaTrash } from "react-icons/fa";
import "./purchases-invoice.css";

const PurchasesInvoicePage = () => {
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [items, setItems] = useState([]);
  const [vat, setVat] = useState(0);

  // Add new item to the invoice
  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        itemName: "",
        origin: "",
        length: "",
        width: "",
        quantity: 1,
        sheetsPerBox: 1,
        sqm: 0,
        unitPrice: "",
        total: 0,
      },
    ]);
  };

  // Update item fields and calculate SQM and Total
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    const { length, width, quantity, sheetsPerBox, unitPrice } =
      newItems[index];
    const sqm = (length * width * quantity * sheetsPerBox) / 10000; // Convert cm² to m²
    newItems[index].sqm = sqm;
    newItems[index].total = sqm * unitPrice;

    setItems(newItems);
  };

  // Delete an item from the invoice
  const deleteItem = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  // Calculate total amounts
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
        <label>
          Supplier Name
          <input
            type="text"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Enter supplier name"
          />
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
                <td>
                  <input
                    type="text"
                    value={item.itemName}
                    onChange={(e) =>
                      handleItemChange(index, "itemName", e.target.value)
                    }
                    placeholder="Enter item name"
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={item.origin}
                    onChange={(e) =>
                      handleItemChange(index, "origin", e.target.value)
                    }
                    placeholder="Enter origin"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.length}
                    onChange={(e) =>
                      handleItemChange(index, "length", Number(e.target.value))
                    }
                    placeholder="Length"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.width}
                    onChange={(e) =>
                      handleItemChange(index, "width", Number(e.target.value))
                    }
                    placeholder="Width"
                  />
                </td>
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
                    placeholder="Quantity"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={item.sheetsPerBox}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "sheetsPerBox",
                        Number(e.target.value)
                      )
                    }
                    placeholder="Sheets/Box"
                  />
                </td>
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
                    placeholder="Unit Price"
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
        <button className="add-item-button" onClick={addItem}>
          Add Item
        </button>
      </div>

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
