import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import SupplierInput from "./SupplierInput";
import ItemsTable from "./ItemsTable";
import ItemModal from "./ItemModel";
import SummarySection from "./SummarySelection";
import './styles/container.css';
import './styles/header.css';
import './styles/details.css';
import './styles/table.css';
import './styles/model.css';
import './styles/summary.css';


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

  const filteredItems = allItems.filter((item) =>
    item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCheckboxChange = (item, dimension) => {
    const isSelected = selectedItems.some(
      (selectedItem) =>
        selectedItem.itemName === item.itemName &&
        selectedItem.origin === dimension.origin &&
        selectedItem.length === dimension.length &&
        selectedItem.width === dimension.width &&
        selectedItem.type === item.type
    );

    if (isSelected) {
      setSelectedItems(
        selectedItems.filter(
          (selectedItem) =>
            !(
              selectedItem.itemName === item.itemName &&
              selectedItem.origin === dimension.origin &&
              selectedItem.length === dimension.length &&
              selectedItem.width === dimension.width &&
              selectedItem.type === item.type
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
          type: item.type,
          sheetsPerBox: dimension.sheetsPerBox || 1,
        },
      ]);
    }
  };

  const closeItemModal = () => {
    const newSelectedItems = selectedItems.map((item) => ({
      id: Date.now() + Math.random(),
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
        <SupplierInput
          supplierName={supplierName}
          setSupplierName={setSupplierName}
          filteredSuppliers={filteredSuppliers}
          showSupplierSuggestions={showSupplierSuggestions}
          setShowSupplierSuggestions={setShowSupplierSuggestions}
        />
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

      <ItemsTable
        items={items}
        setItems={setItems}
        openItemModal={() => setShowItemModal(true)}
      />

      {showItemModal && (
        <ItemModal
          filteredItems={filteredItems}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedItems={selectedItems}
          handleCheckboxChange={handleCheckboxChange}
          closeItemModal={closeItemModal}
        />
      )}

      <SummarySection
        vat={vat}
        setVat={setVat}
        totalAmount={totalAmount}
        vatAmount={vatAmount}
        grandTotal={grandTotal}
      />
    </div>
  );
};

export default PurchasesInvoicePage;
