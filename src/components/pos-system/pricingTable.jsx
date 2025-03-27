import React, { useState } from "react";
import "./pricingTable.css";

const PricingTable = () => {
  const [searchTerm, setSearchTerm] = useState("");

  const data = [
    {
      invoiceDate: "2025-03-26",
      invoiceNumber: "INV-001",
      origin: "Kaveh",
      item: "5.5mm Clear",
      type: "Box",
      box: 10,
      sheet: 100,
      sqm: 250.5,
      price: 15,
      vat: `${10}%`,
      total: 4132.5,
    },
    {
      invoiceDate: "2025-03-27",
      invoiceNumber: "INV-002",
      origin: "AGC",
      item: "6ملم تريبلكس برونز",
      type: "Sheet",
      box: "-",
      sheet: 40,
      sqm: 85,
      price: 17,
      vat: `${8}%`,
      total: 1564.2,
    },
  ];

  const filteredData = data.filter((row) =>
    Object.values(row).some((val) =>
      val.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <div className="pricing-table-container">
      <div className="pricing-table-content">
        <input
          type="text"
          placeholder="Search by any field"
          className="pricing-table-search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="pricing-table-wrapper">
          <table className="pricing-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Inv #</th>
                <th>Origin</th>
                <th>Item</th>
                <th>Type</th>
                <th>Box</th>
                <th>Sheet</th>
                <th>SQM</th>
                <th>Price</th>
                <th>VAT</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, index) => (
                <tr key={index}>
                  <td>{row.invoiceDate}</td>
                  <td>{row.invoiceNumber}</td>
                  <td>{row.origin}</td>
                  <td>{row.item}</td>
                  <td>{row.type}</td>
                  <td>{row.box}</td>
                  <td>{row.sheet}</td>
                  <td>{row.sqm}</td>
                  <td>{row.price}</td>
                  <td>{row.vat}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PricingTable;
