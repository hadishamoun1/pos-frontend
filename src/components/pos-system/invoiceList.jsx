import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "./invoiceList.css";
import PropTypes from "prop-types";
import { io } from "socket.io-client";
import { useBlinkingItems } from "../blink/blink-cards";

const PAGE_SIZE = 100;

const InvoicesList = ({ onSelectInvoice, searchTerm = "" }) => {
  const [invoices, setInvoices] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false); // only true after we know from API
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  const invoicesListRef = useRef(null);
  const socketRef = useRef(null);
  const debounceRef = useRef(null);

  const { addItemToBlink, isItemBlinking } = useBlinkingItems();

  const isSearching = (searchTerm || "").trim().length > 0;

  // utils
  const isArabicText = (s) => /[\u0600-\u06FF]/.test(s || "");

  // initial load + socket
  useEffect(() => {
    isSearching ? fetchSearch(1, searchTerm) : fetchInvoices(1);

    socketRef.current = io(`${baseUrl}`);
    socketRef.current.on("newInvoice", (invoice) => {
      if (isSearching) return; // ignore while user is searching
      addItemToBlink(invoice.id);
      setInvoices((prev) => {
        if (prev.some((p) => p.id === invoice.id)) return prev;
        return [invoice, ...prev];
      });
    });

    return () => socketRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  // react to external searchTerm changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setPage(1);
      setInvoices([]);
      setHasMore(false); // don’t flash Load More between keystrokes

      if ((searchTerm || "").trim() === "") {
        fetchInvoices(1);
      } else {
        fetchSearch(1, searchTerm);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  // infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!invoicesListRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = invoicesListRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      if (isAtBottom && hasMore && !loading) {
        const next = page + 1;
        isSearching ? fetchSearch(next, searchTerm) : fetchInvoices(next);
      }
    };

    const el = invoicesListRef.current;
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, page, isSearching, searchTerm]);

  // normal list fetch
  const fetchInvoices = async (pageNum) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(`${baseUrl}/invoices/filtered`, {
        params: { page: pageNum, limit: PAGE_SIZE },
      });

      const list = Array.isArray(data?.data) ? data.data : [];
      setInvoices((prev) =>
        pageNum === 1
          ? list
          : [...prev, ...list.filter((n) => !prev.some((p) => p.id === n.id))]
      );

      setPage(pageNum);
      setHasMore(pageNum < Number(data?.totalPages || 1));
    } catch {
      setError("Failed to fetch invoices");
    } finally {
      setLoading(false);
    }
  };

  // search fetch
  const fetchSearch = async (pageNum, q) => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get(
        `${baseUrl}/invoices/v1/filtered/search`,
        { params: { q: q || "", page: pageNum, limit: PAGE_SIZE } }
      );

      const list = Array.isArray(data?.data) ? data.data : [];
      setInvoices((prev) =>
        pageNum === 1
          ? list
          : [...prev, ...list.filter((n) => !prev.some((p) => p.id === n.id))]
      );

      setPage(pageNum);
      setHasMore(pageNum < Number(data?.totalPages || 1));
    } catch {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceClick = async (invoice) => {
    try {
      const { data } = await axios.get(`${baseUrl}/invoices/v1/${invoice.id}`);
      onSelectInvoice(data);
    } catch (error) {
      console.error("Error fetching invoice details:", error);
    }
  };

  return (
    <div className="invoices-container" ref={invoicesListRef}>
      {loading && page === 1 && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}

      <ul className="invoices-list">
        {invoices.length === 0 && !loading ? (
          <p className="no-invoices">No Invoices Found</p>
        ) : (
          invoices.map((invoice) => {
            const name = invoice.customerName || "Unknown";
            const arabic = isArabicText(name);

            return (
              <li
                key={`invoice-${invoice.id}`}
                className={`invoice-item ${
                  isItemBlinking(invoice.id) ? "blink" : ""
                }`}
                onClick={() => handleInvoiceClick(invoice)}
              >
                <div className="invoice-list-header">
                  <span className="invoice-customer-container">
                    <span
                      className={`invoice-customer ${arabic ? "rtl-ar" : ""}`}
                      dir="auto"
                      title={name}
                    >
                      {name.length > 15 ? name.slice(0, 15) + "..." : name}
                    </span>
                    {name.length > 15 && (
                      <span
                        className={`invoice-tooltip ${
                          arabic ? "rtl-ar" : ""
                        }`}
                      >
                        {name}
                      </span>
                    )}
                  </span>

                  <span className="invoice-list-invoice-number">
                    {invoice.invoiceNumber}
                  </span>
                </div>

                {/* total + date in one row */}
                <div className="invoice-list-details">
                  <span className="invoice-total">
                    ${Number(invoice.grandTotal).toFixed(2)}
                  </span>
                  <span className="invoice-date">{invoice.date}</span>
                </div>
              </li>
            );
          })
        )}

        {hasMore && !loading && (
          <button
            className="invoice-load-more-button"
            onClick={() =>
              isSearching
                ? fetchSearch(page + 1, searchTerm)
                : fetchInvoices(page + 1)
            }
          >
            Load More
          </button>
        )}
      </ul>
    </div>
  );
};

InvoicesList.propTypes = {
  onSelectInvoice: PropTypes.func.isRequired,
  searchTerm: PropTypes.string,
};

export default InvoicesList;
