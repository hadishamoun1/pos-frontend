import React, { useEffect, useState } from "react";
import axios from "axios";
import "./invoiceList.css";

const InvoicesList = ({ onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const response = await axios.get("http://localhost:3000/invoices");
        setInvoices(response.data);
      } catch (err) {
        setError("Failed to fetch invoices");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  return (
    <>
      <h2 className="invoices-list-title">Invoices</h2>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <ul className="invoices-list">
        {invoices.map((invoice) => (
          <li
            key={invoice.id}
            className="invoice-item"
            onClick={() => onSelectInvoice(invoice)}
          >
            <div className="invoice-header">
              <span className="invoice-number">{invoice.invoiceNumber}</span>
              <span className="invoice-date">{invoice.date}</span>
            </div>
            <div className="invoice-details">
              <span className="invoice-customer">{invoice.customer.customerName}</span>
              <span className="invoice-total">Total: ${invoice.grandTotal}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

export default InvoicesList;
