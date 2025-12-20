import React, { createContext, useState, useContext, useEffect } from "react";

// Create the context
const BlinkingItemsContext = createContext();

// Custom hook to use the context
export const useBlinkingItems = () => {
  return useContext(BlinkingItemsContext);
};

// Provider component to manage state
export const BlinkingItemsProvider = ({ children }) => {
  const [newItemBatch, setNewItemBatch] = useState([]); // Track items that are blinking (requests, invoices, etc.)
  const [batchEndTime, setBatchEndTime] = useState(null); 

  // Add a new item (request or invoice) to the blinking batch and trigger blinking
  const addItemToBlink = (itemId) => {
    setNewItemBatch((prevBatch) => {
      // If it's the first item or the batch is expired, start a new batch
      if (!batchEndTime || Date.now() > batchEndTime) {
        setBatchEndTime(Date.now() + 10000); // Set blinking duration to 10 seconds
        return [itemId]; // Start a new batch with this item
      }

      // Add item to the batch if batch is still active
      return [...prevBatch, itemId];
    });
  };

  // Check if the item should blink
  const isItemBlinking = (itemId) => {
    return newItemBatch.includes(itemId) && Date.now() < batchEndTime;
  };

  // Reset batch after the blinking duration ends
  useEffect(() => {
    if (batchEndTime && Date.now() >= batchEndTime) {
      setNewItemBatch([]); // Clear batch after blinking ends
    }
  }, [batchEndTime]);

  return (
    <BlinkingItemsContext.Provider value={{ addItemToBlink, isItemBlinking }}>
      {children}
    </BlinkingItemsContext.Provider>
  );
};
