import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./invoiceList.css";
import PropTypes from "prop-types";

const InvoicesList = ({ onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const invoicesListRef = useRef(null);

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
        console.error("Unexpected response format:", response.data);
      }
    } catch (err) {
      setError("Failed to fetch invoices");
    } finally {
      setLoading(false);
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
      {error && <p className="error">{error}</p>}

      <ul className="invoices-list">
        {invoices.length === 0 ? (
          <p className="no-invoices">No Invoices Found</p>
        ) : (
          invoices.map((invoice) => (
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
                <span className="invoice-customer">{invoice.customerName}</span>
                <span className="invoice-total">
                  Total: ${Number(invoice.grandTotal).toFixed(2)}
                </span>
              </div>
            </li>
          ))
        )}
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
