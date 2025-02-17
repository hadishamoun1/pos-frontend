import React, { useEffect, useState } from "react";
import axios from "axios";
import "./requests.css"; // Create a new CSS file for styling

const RequestCard = () => {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await axios.get("http://localhost:3000/requests/v1/filtered");
      setRequests(response.data);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  return (
    <div className="request-card-container">
      {requests.length === 0 ? (
        <p className="no-requests">No Requests Found</p>
      ) : (
        requests.map((request) => (
          <div key={request.id} className="request-card">
            <h4>Request #{request.id}</h4>
            <p>
              <strong>Date:</strong> {request.requestDate}
            </p>
            <p>
              <strong>Customer:</strong> {request.customerName}
            </p>
            <p>
              <strong>Total:</strong> ${request.grandTotal}
            </p>
          </div>
        ))
      )}
    </div>
  );
};

export default RequestCard;
                                      