import React, { useEffect, useState } from "react";
import axios from "axios";
import "./invoiceList.css";
import PropTypes from "prop-types";

const InvoicesList = ({ onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInvoices();
  }, []);

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

  const handleInvoiceClick = async (invoice) => {
    try {
      const response = await axios.get(
        `http://localhost:3000/invoices/v1/${invoice.id}`
      );
      const fullInvoice = response.data;
      console.log("Fetched Invoice Details:", fullInvoice); // ✅ Debugging log

      onSelectInvoice(fullInvoice); // ✅ Pass full invoice object to POSSystemPage
    } catch (error) {
      console.error("Error fetching invoice details:", error);
    }
  };

  return (
    <>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <ul className="invoices-list">
        {invoices.map((invoice) => (
          <li
            key={invoice.id}
            className="invoice-item"
            onClick={() => handleInvoiceClick(invoice)} // ✅ Call API before passing
          >
            <div className="invoice-header">
              <span className="invoice-number">{invoice.invoiceNumber}</span>
              <span className="invoice-date">{invoice.date}</span>
            </div>
            <div className="invoice-details">
              <span className="invoice-customer">
                {invoice.customer.customerName}
              </span>
              <span className="invoice-total">
                Total: ${invoice.grandTotal}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

InvoicesList.propTypes = {
  onSelectInvoice: PropTypes.func.isRequired,
};

export default InvoicesList;
