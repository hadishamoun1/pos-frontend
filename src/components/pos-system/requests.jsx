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
  const [newRequestIds, setNewRequestIds] = useState([]); // ✅ Track newly added request IDs

  const requestListRef = useRef(null); // Reference for the list container
  const socketRef = useRef(null); // ✅ Reference for WebSocket connection

  // ✅ Connect WebSocket on Mount
  useEffect(() => {
    socketRef.current = io("http://localhost:3000"); // Adjust URL to match your backend WebSocket

    socketRef.current.on("newRequest", (newRequest) => {
      console.log("✅ New Request Received:", newRequest);

      setRequests((prevRequests) => {
        // ✅ Ensure no duplicates
        if (prevRequests.some((req) => req.id === newRequest.id)) {
          return prevRequests;
        }

        // ✅ Add the new request ID to the list of newRequestIds
        setNewRequestIds((prevIds) => [newRequest.id, ...prevIds]);

        // ✅ Remove the highlight after a short delay (2s)
        setTimeout(() => {
          setNewRequestIds((prevIds) =>
            prevIds.filter((id) => id !== newRequest.id)
          );
        }, 10000);

        return [newRequest, ...prevRequests]; // Add new request at the top
      });
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

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
          // ✅ Remove duplicates
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
      console.error("❌ Error fetching requests:", error);
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
              key={`request-${request.id}`} // ✅ Ensuring unique key
              className={`request-item ${
                newRequestIds.includes(request.id) ? "blink" : "" // ✅ Add blink effect if new
              }`} // ✅ Check if the request is in the list of new requests
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
