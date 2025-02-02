import React from "react";
import "./searchModal.css";

const SearchModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="search-modal-overlay">
      <div className="search-modal-content">
        <h2 className="search-modal-title">Search Results</h2>
        <p className="search-modal-body">
          Your search results will appear here.
        </p>
        <button className="search-modal-close-button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default SearchModal;
