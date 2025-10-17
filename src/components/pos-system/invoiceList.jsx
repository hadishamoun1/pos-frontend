import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./invoiceList.css";
import PropTypes from "prop-types";
import { io } from "socket.io-client"; // WebSocket client
import { useBlinkingItems } from "../blink/blink-cards"; // Import the updated context

const InvoicesList = ({ onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]); // Stores invoice data
  const [page, setPage] = useState(1); // Tracks current page
  const [hasMore, setHasMore] = useState(true); // Tracks if more invoices exist
  const [loading, setLoading] = useState(false); // Tracks loading state
  const [error, setError] = useState(""); // Stores errors
  const [newInvoiceBatch, setNewInvoiceBatch] = useState([]); // Tracks new invoices to blink
  const [batchEndTime, setBatchEndTime] = useState(null); // Tracks the batch end time for blinking
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const invoicesListRef = useRef(null); // Reference to invoices container
  const socketRef = useRef(null); // WebSocket connection reference

  // Using the blinking logic from the context
  const { addItemToBlink, isItemBlinking } = useBlinkingItems();

  useEffect(() => {
    fetchInvoices(1); // Fetch invoices when the component mounts

    // Set up the WebSocket client
    socketRef.current = io(`${baseUrl}`); // Adjust URL to match your backend WebSocket

    // Listen for the newInvoice event
    socketRef.current.on("newInvoice", (invoice) => {
      console.log("New Invoice Received:", invoice);

      // Add the new invoice to the batch of blinking invoices
      addItemToBlink(invoice.id);

      // Add the new invoice to the invoices list
      setInvoices((prevInvoices) => {
        const updatedInvoices = [invoice, ...prevInvoices]; // Make sure it's added to the start of the list
        return updatedInvoices;
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [batchEndTime, addItemToBlink]);

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

  const fetchInvoices = async (pageNum) => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${baseUrl}/invoices/filtered?page=${pageNum}`
      );

      if (response.data?.data && Array.isArray(response.data.data)) {
        setInvoices((prevInvoices) => {
          // Prevent duplicates before adding new invoices
          const newInvoices = response.data.data.filter(
            (newInvoice) =>
              !prevInvoices.some((inv) => inv.id === newInvoice.id)
          );
          return [...prevInvoices, ...newInvoices];
        });

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

  const handleInvoiceClick = async (invoice) => {
    try {
      const response = await axios.get(
        `${baseUrl}/invoices/v1/${invoice.id}`
      );
      const fullInvoice = response.data;
      console.log("Fetched Invoice Details:", fullInvoice);

      onSelectInvoice(fullInvoice);
    } catch (error) {
      console.error("Error fetching invoice details:", error);
    }
  };

  // Function to check if an invoice is currently blinking
  const isInvoiceBlinking = (invoiceId) => {
    if (newInvoiceBatch.includes(invoiceId) && Date.now() < batchEndTime) {
      return true;
    }
    return false;
  };

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
              key={`invoice-${invoice.id}`}
              className={`invoice-item ${
                isItemBlinking(invoice.id) ? "blink" : ""
              }`}
              onClick={() => handleInvoiceClick(invoice)}
            >
              <div className="invoice-list-header">
                {/* Access customerName directly */}
                <span className="invoice-customer">
                  {invoice.customerName?.length > 15
                    ? invoice.customerName.slice(0, 15) + "..."
                    : invoice.customerName || "Unknown"}
                </span>
                {invoice.customerName?.length > 15 && (
                  <span className="invoice-tooltip">
                    {invoice.customerName}
                  </span>
                )}
                <span className="invoice-list-invoice-number">{invoice.invoiceNumber}</span>
              </div>
              <div className="invoice-details">
             
                  <span className="invoice-total">
                    Total: ${Number(invoice.grandTotal).toFixed(2)}
                  </span>
                

                <span className="invoice-date">{invoice.date}</span>
              </div>
            </li>
          ))
        )}
        {/* Load More Button */}
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
