import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import "./requests.css"; // Ensure this file has styles
import PropTypes from "prop-types";

const RequestCard = ({ onSelectRequest }) => {
  const [requests, setRequests] = useState([]); // Store request data
  const [page, setPage] = useState(1); // Track current page
  const [hasMore, setHasMore] = useState(true); // Track if more data exists
  const [loading, setLoading] = useState(false); // Track loading state

  const requestListRef = useRef(null); // Reference for the list container

  useEffect(() => {
    fetchRequests(1); // Fetch first page on component mount
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
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="requests-container">
      {/* ✅ Scrollable List */}
      <ul className="requests-list" ref={requestListRef}>
        {requests.length === 0 ? (
          <p className="no-requests">No Requests Found</p>
        ) : (
          requests.map((request) => (
            <li
              key={request.id} // ✅ Ensuring unique keys
              className="request-item"
              onClick={() => onSelectRequest(request.id)}
            >
              {/* Request Header */}
              <div className="request-header">
                <span className="request-number">{request.requestNumber}</span>
                <span className="request-date">{request.requestDate}</span>
              </div>

              {/* Request Details */}
              <div className="request-details">
                <div className="request-customer-container">
                  <span className="request-customer">
                    {request.customerName.length > 15
                      ? request.customerName.slice(0, 15) + "..."
                      : request.customerName}
                  </span>
                  {request.customerName.length > 15 && (
                    <span className="request-tooltip">
                      {request.customerName}
                    </span>
                  )}
                </div>

                <span className="request-total">
                  Total: ${Number(request.grandTotal).toFixed(2)}
                </span>
              </div>
            </li>
          ))
        )}

        {/* ✅ Load More Button (Inside scrollable container) */}
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

// Prop validation
RequestCard.propTypes = {
  onSelectRequest: PropTypes.func.isRequired,
};

export default RequestCard;
