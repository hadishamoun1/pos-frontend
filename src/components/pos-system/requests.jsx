import React, { useEffect, useRef, useState } from "react";
import "./requests.css";
import PropTypes from "prop-types";
import { io } from "socket.io-client";
import { useBlinkingItems } from "../blink/blink-cards";
import { axiosClient } from "../api/axiosClient"; // ✅ API client

const PAGE_SIZE = 100;

// Simple Arabic text detector
const hasArabic = (s = "") => /[\u0600-\u06FF]/.test(s);

const RequestCard = ({ onSelectRequest, searchTerm = "" }) => {
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { addItemToBlink, isItemBlinking } = useBlinkingItems();

  const requestListRef = useRef(null);
  const socketRef = useRef(null);
  const debounceRef = useRef(null);

  const isSearching = (searchTerm || "").trim().length > 0;

  // ✅ avoid stale closure inside socket events
  const isSearchingRef = useRef(isSearching);
  useEffect(() => {
    isSearchingRef.current = (searchTerm || "").trim().length > 0;
  }, [searchTerm]);

  // initial load + socket
  useEffect(() => {
    isSearching ? fetchSearch(1, searchTerm) : fetchRequests(1);

    // ✅ nginx proxies backend under /api, so socket should go through /api/socket.io
    socketRef.current = io(window.location.origin, { path: "/api/socket.io" });

    socketRef.current.on("newRequest", (newRequest) => {
      if (isSearchingRef.current) return;

      addItemToBlink(newRequest.id);
      setRequests((prev) => {
        if (prev.some((r) => r.id === newRequest.id)) return prev;
        return [newRequest, ...prev];
      });
    });

    // ✅ NEW: remove request from list when it gets converted to invoice
    socketRef.current.on("requestRemoved", ({ id }) => {
      setRequests((prev) => prev.filter((r) => r.id !== Number(id)));
    });

    return () => {
      socketRef.current?.off("newRequest");
      socketRef.current?.off("requestRemoved");
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to external searchTerm changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setPage(1);
      setRequests([]);
      setHasMore(false);

      const q = (searchTerm || "").trim();
      if (q === "") {
        fetchRequests(1);
      } else {
        fetchSearch(1, q);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (!requestListRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = requestListRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;

      if (isAtBottom && hasMore && !loading) {
        const next = page + 1;
        isSearching ? fetchSearch(next, searchTerm) : fetchRequests(next);
      }
    };

    const el = requestListRef.current;
    el?.addEventListener("scroll", handleScroll);
    return () => el?.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading, page, isSearching, searchTerm]);

  const fetchRequests = async (pageNum) => {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const { data } = await axiosClient.get(`/requests/v1/filtered`, {
        params: { page: pageNum, limit: PAGE_SIZE },
      });

      const list = Array.isArray(data?.data) ? data.data : [];
      setRequests((prev) =>
        pageNum === 1
          ? list
          : [...prev, ...list.filter((n) => !prev.some((p) => p.id === n.id))]
      );

      setPage(pageNum);
      setHasMore(pageNum < Number(data?.totalPages || 1));
    } catch (err) {
      setError("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchSearch = async (pageNum, q) => {
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const { data } = await axiosClient.get(`/requests/v1/filtered/search`, {
        params: { q: q || "", page: pageNum, limit: PAGE_SIZE },
      });

      const list = Array.isArray(data?.data) ? data.data : [];
      setRequests((prev) =>
        pageNum === 1
          ? list
          : [...prev, ...list.filter((n) => !prev.some((p) => p.id === n.id))]
      );

      setPage(pageNum);
      setHasMore(pageNum < Number(data?.totalPages || 1));
    } catch (err) {
      setError("Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="requests-container">
      {error && <p className="error">{error}</p>}
      {loading && page === 1 && <p>Loading...</p>}

      <ul className="requests-list" ref={requestListRef}>
        {requests.length === 0 && !loading ? (
          <p className="no-requests">No Requests Found</p>
        ) : (
          requests.map((request) => {
            const name = request.customerName || "Unknown";
            const isRTL = hasArabic(name);
            const isLong = name.length > 15;

            return (
              <li
                key={`request-${request.id}`}
                className={`request-item ${isItemBlinking(request.id) ? "blink" : ""}`}
                onClick={() => onSelectRequest(request)}
              >
                <div className="request-header">
                  <span
                    className="request-customer-container"
                    dir={isRTL ? "rtl" : "ltr"}
                  >
                    <span className={`request-customer ${isRTL ? "rtl" : ""}`}>
                      {isLong ? name.slice(0, 15) + "..." : name}
                    </span>

                    {isLong && (
                      <span className={`request-tooltip ${isRTL ? "rtl" : ""}`}>
                        {name}
                      </span>
                    )}
                  </span>

                  <span className="request-number">{request.requestNumber}</span>
                </div>

                <div className="request-details">
                  <span className="request-total">
                    ${Number(request.grandTotal || 0).toFixed(2)}
                  </span>
                  <span className="request-date">{request.requestDate}</span>
                </div>
              </li>
            );
          })
        )}

        {hasMore && !loading && (
          <button
            className="request-load-more-button"
            onClick={() =>
              isSearching ? fetchSearch(page + 1, searchTerm) : fetchRequests(page + 1)
            }
          >
            Load More
          </button>
        )}
      </ul>
    </div>
  );
};

RequestCard.propTypes = {
  onSelectRequest: PropTypes.func.isRequired,
  searchTerm: PropTypes.string,
};

export default RequestCard;
