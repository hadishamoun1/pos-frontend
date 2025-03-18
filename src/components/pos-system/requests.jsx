import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./requests.css";
import PropTypes from "prop-types";
import { io } from "socket.io-client";
import { useBlinkingItems } from "../blink/blink-cards"; // Import the generic blinking context

const RequestCard = ({ onSelectRequest }) => {
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Using the blinking logic from the context for both requests and invoices
  const { addItemToBlink, isItemBlinking } = useBlinkingItems();

  const requestListRef = useRef(null);
  const socketRef = useRef(null);

  // Connect WebSocket on Mount
  useEffect(() => {
    socketRef.current = io("http://localhost:3000");

    socketRef.current.on("newRequest", (newRequest) => {
      console.log("New Request Received:", newRequest);

      // Add the new request to the global blinking state
      addItemToBlink(newRequest.id);

      setRequests((prevRequests) => {
        if (prevRequests.some((req) => req.id === newRequest.id)) {
          return prevRequests;
        }
        return [newRequest, ...prevRequests];
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [addItemToBlink]);

  useEffect(() => {
    fetchRequests(1);
  }, []);

  const fetchRequests = async (pageNum) => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `http://localhost:3000/requests/v1/filtered?page=${pageNum}`
      );

      if (response.data?.data && Array.isArray(response.data.data)) {
        setRequests((prevRequests) => {
          const newRequests = response.data.data.filter(
            (newReq) => !prevRequests.some((req) => req.id === newReq.id)
          );
          return [...prevRequests, ...newRequests];
        });

        setPage(pageNum);
        setHasMore(pageNum < response.data.totalPages);
      } else {
        console.error("Unexpected response format:", response.data);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="requests-container">
      <ul className="requests-list" ref={requestListRef}>
        {requests.length === 0 ? (
          <p className="no-requests">No Requests Found</p>
        ) : (
          requests.map((request) => (
            <li
              key={`request-${request.id}`}
              className={`request-item ${
                isItemBlinking(request.id) ? "blink" : ""
              }`} // Apply blinking effect
              onClick={() => onSelectRequest(request.id)}
            >
              <div className="request-header">
                <span className="request-number">{request.requestNumber}</span>
                <span className="request-date">{request.requestDate}</span>
              </div>

              <div className="request-details">
                <div className="request-customer-container">
                  <span className="request-customer">
                    {request.customerName && request.customerName.length > 15
                      ? request.customerName.slice(0, 15) + "..."
                      : request.customerName || "Unknown"}
                  </span>
                  {request.customerName && request.customerName.length > 15 && (
                    <span className="request-tooltip">
                      {request.customerName}
                    </span>
                  )}
                </div>

                <span className="request-total">
                  Total: ${Number(request.grandTotal || 0).toFixed(2)}
                </span>
              </div>
            </li>
          ))
        )}

        {hasMore && (
          <button
            className="request-load-more-button"
            onClick={() => fetchRequests(page + 1)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Load More"}
          </button>
        )}
      </ul>
    </div>
  );
};

RequestCard.propTypes = {
  onSelectRequest: PropTypes.func.isRequired,
};

export default RequestCard;
