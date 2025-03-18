import React, { createContext, useState, useContext, useEffect } from "react";

// Create the context
const BlinkingRequestsContext = createContext();

// Custom hook to use the context
export const useBlinkingRequests = () => {
  return useContext(BlinkingRequestsContext);
};

// Provider component to manage state
export const BlinkingRequestsProvider = ({ children }) => {
  const [newRequestBatch, setNewRequestBatch] = useState([]); // Track requests that are blinking
  const [batchEndTime, setBatchEndTime] = useState(null); // Track the batch end time for blinking requests

  // Add a new request to the blinking batch and trigger blinking
  const addRequestToBlink = (requestId) => {
    setNewRequestBatch((prevBatch) => {
      // If it's the first request or the batch is expired, start a new batch
      if (!batchEndTime || Date.now() > batchEndTime) {
        setBatchEndTime(Date.now() + 10000); // Set blinking duration to 10 seconds
        return [requestId]; // Start a new batch with this request
      }

      // Add request to the batch if batch is still active
      return [...prevBatch, requestId];
    });
  };

  // Check if the request should blink
  const isRequestBlinking = (requestId) => {
    return newRequestBatch.includes(requestId) && Date.now() < batchEndTime;
  };

  // Reset batch after the blinking duration ends
  useEffect(() => {
    if (batchEndTime && Date.now() >= batchEndTime) {
      setNewRequestBatch([]); // Clear batch after blinking ends
    }
  }, [batchEndTime]);

  return (
    <BlinkingRequestsContext.Provider
      value={{ addRequestToBlink, isRequestBlinking }}
    >
      {children}
    </BlinkingRequestsContext.Provider>
  );
};
