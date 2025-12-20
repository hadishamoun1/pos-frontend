import React, { useState } from "react";
import { axiosClient } from "../api/axiosClient"; // ✅ use your api client

const InvoiceCreation = ({
  invoiceType,
  customerId,
  date,
  tableData,
  currencyRate,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateInvoice = async () => {
    if (!customerId || tableData.length === 0) {
      setError("Customer and items are required.");
      return;
    }

    setLoading(true);
    setError("");

    const formattedItems = tableData.map((item) => {
      const price = parseFloat(item.price) || 0;
      return {
        itemVariantId: item.itemVariantId,
        sqm: parseFloat(item.sqm) || 0,
        unitPrice: price,
        vat: (price * 0.11).toFixed(2), // Assuming VAT is 11%
      };
    });

    const invoiceData = {
      customerId,
      invoiceType, // "S" for Issue, "G" for Offer
      date,
      currencyRate: parseFloat(currencyRate) || 1,
      items: formattedItems,
    };

    try {
      // ✅ relative endpoint only (axiosClient baseURL already has /api)
      const response = await axiosClient.post(`/invoices`, invoiceData);

      console.log("Invoice Created:", response.data);
      onSuccess(response.data);
    } catch (err) {
      setError("Failed to create invoice. Please try again.");
      console.error("Error creating invoice:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        className={`pos-page-toolbar-button ${
          invoiceType === "S" ? "pos-page-red-button" : "pos-page-yellow-button"
        }`}
        onClick={handleCreateInvoice}
        disabled={loading}
      >
        {loading
          ? "Processing..."
          : invoiceType === "S"
          ? "Issue Invoice"
          : "Offer Invoice"}
      </button>
      {error && <p className="error-message">{error}</p>}
    </div>
  );
};

export default InvoiceCreation;
