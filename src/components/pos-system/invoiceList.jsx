import React, { useEffect, useState } from "react";
import axios from "axios";
import "./invoiceList.css";

const InvoicesList = ({ onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hoveredInvoiceId, setHoveredInvoiceId] = useState(null);

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
              <div
                className="invoice-customer-container"
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.querySelector(".tooltip");
                  if (tooltip) {
                    const rect = tooltip.getBoundingClientRect();
                    if (rect.left < 0) {
                      tooltip.classList.add("left-adjust");
                    } else {
                      tooltip.classList.remove("left-adjust");
                    }
                  }
                }}
              >
                <span className="invoice-customer">
                  {invoice.customer.customerName}
                </span>
                {invoice.customer.customerName.length > 15 && (
                  <span className="tooltip">
                    {invoice.customer.customerName}
                  </span>
                )}
              </div>

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

export default InvoicesList;
