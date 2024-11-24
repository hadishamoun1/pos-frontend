import React, { useState, useEffect } from "react";
import "./styles/savedProformas.css";
import { getAllSupplierProformas } from "./supplierProformaApi";

const SavedProformas = () => {
  const [savedProformas, setSavedProformas] = useState([]);

  useEffect(() => {
    const fetchProformas = async () => {
      try {
        const data = await getAllSupplierProformas();
        setSavedProformas(data);
      } catch (error) {
        console.error("Error fetching proformas:", error);
      }
    };

    fetchProformas();
  }, []);

  return (
    <div  className="side-container">
      <h2>Saved Proformas</h2>
      {savedProformas.length > 0 ? (
        <div className="proforma-cards">
          {savedProformas.map((proforma) => (
            <div className="proforma-card" key={proforma.id}>
              <div className="proforma-card-header">
                <span className="proforma-number">
                  {proforma.proformaNumber}
                </span>
                <span className="proforma-date">{proforma.date}</span>
              </div>
              <div className="proforma-card-body">
                <p className="supplier-name">
                  <strong>Supplier:</strong> {proforma.supplier?.name || "N/A"}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-proformas">No saved proformas found.</p>
      )}
    </div>
  );
};

export default SavedProformas;
