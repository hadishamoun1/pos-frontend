import React, { useEffect, useState } from "react";
import axios from "axios";
import "./requests.css"; // Ensure this file has styles
import PropTypes from "prop-types";

const RequestCard = ({ onSelectRequest }) => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(
        "http://localhost:3000/requests/v1/filtered"
      );
      setRequests(response.data);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  return (
    <ul className="requests-list">
      {requests.length === 0 ? (
        <p className="no-requests">No Requests Found</p>
      ) : (
        requests.map((request) => (
          <li
            key={request.id}
            className="request-item"
            onClick={() => onSelectRequest(request)} 
          >
            {/* Request Header */}
            <div className="request-header">
              <span className="request-number">{request.requestNumber}</span>
              <span className="request-date">{request.requestDate}</span>
            </div>

            {/* Request Details */}
            <div className="request-details">
              {/* Customer Name with Tooltip */}
              <div
                className="request-customer-container"
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.querySelector(".request-tooltip");
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
                <span className="request-customer">
                  {request.customerName.length > 15
                    ? request.customerName.slice(0, 15) + "..."
                    : request.customerName}
                </span>

                {request.customerName.length > 15 && (
                  <span className="request-tooltip">{request.customerName}</span>
                )}
              </div>

              {/* Request Total */}
              <span className="request-total">
                Total: ${Number(request.grandTotal).toFixed(2)}
              </span>
            </div>
          </li>
        ))
      )}
    </ul>
  );
};

// Prop validation
RequestCard.propTypes = {
  onSelectRequest: PropTypes.func.isRequired,
};

export default RequestCard;
