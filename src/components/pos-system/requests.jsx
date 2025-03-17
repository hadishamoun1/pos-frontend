import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./requests.css";
import PropTypes from "prop-types";
import { io } from "socket.io-client"; // ✅ Import WebSocket Client

const RequestCard = ({ onSelectRequest }) => {
  const [requests, setRequests] = useState([]); // Store request data
  const [page, setPage] = useState(1); // Track current page
  const [hasMore, setHasMore] = useState(true); // Track if more data exists
  const [loading, setLoading] = useState(false); // Track loading state
  const [newRequestBatch, setNewRequestBatch] = useState([]); // Track newly added request IDs
  const [batchStartTime, setBatchStartTime] = useState(null); // Track the batch start time
  const [batchEndTime, setBatchEndTime] = useState(null); // Track the batch end time for blinking requests

  const requestListRef = useRef(null); // Reference for the list container
  const socketRef = useRef(null); // WebSocket connection

  // Connect WebSocket on Mount
  useEffect(() => {
    socketRef.current = io("http://localhost:3000"); // Adjust URL to match your backend WebSocket

    socketRef.current.on("newRequest", (newRequest) => {
      console.log("New Request Received:", newRequest);

      setRequests((prevRequests) => {
        // Ensure no duplicates
        if (prevRequests.some((req) => req.id === newRequest.id)) {
          return prevRequests;
        }

        // If it's the first request or if a batch is already running, add it to the batch
        if (!batchStartTime) {
          // Start a new batch for the first request and set the batch end time (10 seconds)
          setBatchStartTime(Date.now());
          setBatchEndTime(Date.now() + 10000); // Set blinking duration to 10 seconds
        }

        // Add new request to the batch
        setNewRequestBatch((prevBatch) => [...prevBatch, newRequest.id]);

        return [newRequest, ...prevRequests]; // Add new request at the top
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [batchStartTime]);

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
          // Remove duplicates
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

  // Function to check if a request is currently blinking
  const isBlinking = (requestId) => {
    if (newRequestBatch.includes(requestId) && Date.now() < batchEndTime) {
      return true;
    }
    return false;
  };

  return (
    <div className="requests-container">
      <ul className="requests-list" ref={requestListRef}>
        {requests.length === 0 ? (
          <p className="no-requests">No Requests Found</p>
        ) : (
          requests.map((request) => (
            <li
              key={`request-${request.id}`} // Ensuring unique key
              className={`request-item ${
                isBlinking(request.id) ? "blink" : "" // Apply blinking effect to requests in the batch
              }`} // Check if the request is in the same batch
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
