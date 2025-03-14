import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./invoiceList.css";
import PropTypes from "prop-types";

const InvoicesList = ({ onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]); // Stores invoice data
  const [page, setPage] = useState(1); // Tracks current page
  const [hasMore, setHasMore] = useState(true); // Tracks if more invoices exist
  const [loading, setLoading] = useState(false); // Tracks loading state
  const [error, setError] = useState(""); // Stores errors
  const invoicesListRef = useRef(null); // Reference to invoices container

  useEffect(() => {
    fetchInvoices(1);
  }, []);

  const fetchInvoices = async (pageNum) => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:3000/invoices/filtered?page=${pageNum}`
      );

      if (response.data?.data && Array.isArray(response.data.data)) {
        setInvoices((prevInvoices) => [...prevInvoices, ...response.data.data]);
        setPage(pageNum);
        setHasMore(pageNum < response.data.totalPages);
      } else {
        console.error("❌ Unexpected response format:", response.data);
      }
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
      console.log("✅ Fetched Invoice Details:", fullInvoice);

      onSelectInvoice(fullInvoice);
    } catch (error) {
      console.error("❌ Error fetching invoice details:", error);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (invoicesListRef.current) {
        const { scrollTop, scrollHeight, clientHeight } =
          invoicesListRef.current;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

        if (isAtBottom && hasMore) {
          fetchInvoices(page + 1);
        }
      }
    };

    const invoicesList = invoicesListRef.current;
    if (invoicesList) {
      invoicesList.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (invoicesList) {
        invoicesList.removeEventListener("scroll", handleScroll);
      }
    };
  }, [hasMore, page]);

  return (
    <div className="invoices-container" ref={invoicesListRef}>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <ul className="invoices-list">
        {invoices.length === 0 ? (
          <p className="no-invoices">No Invoices Found</p>
        ) : (
          invoices.map((invoice) => (
            <li
              key={invoice.id}
              className="invoice-item"
              onClick={() => handleInvoiceClick(invoice)}
            >
              <div className="invoice-header">
                <span className="invoice-number">{invoice.invoiceNumber}</span>
                <span className="invoice-date">{invoice.date}</span>
              </div>
              <div className="invoice-details">
                <div className="invoice-customer-container">
                  <span className="invoice-customer">
                    {invoice.customerName.length > 15
                      ? invoice.customerName.slice(0, 15) + "..."
                      : invoice.customerName}
                  </span>
                  {invoice.customerName.length > 15 && (
                    <span className="invoice-tooltip">
                      {invoice.customerName}
                    </span>
                  )}
                </div>

                <span className="invoice-total">
                  Total: ${Number(invoice.grandTotal).toFixed(2)}
                </span>
              </div>
            </li>
          ))
        )}
        {/* ✅ Load More Button (Appears at the end of the scrollable container) */}
        {hasMore && (
          <button
            className="invoice-load-more-button"
            onClick={() => fetchInvoices(page + 1)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        )}
      </ul>
    </div>
  );
};

InvoicesList.propTypes = {
  onSelectInvoice: PropTypes.func.isRequired,
};

export default InvoicesList;
