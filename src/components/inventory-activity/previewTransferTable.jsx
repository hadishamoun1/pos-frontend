import React, { useState, useEffect } from "react";
import axios from "axios";
import "./previewTransferTable.css";

export default function PreviewTransferTable() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get("http://localhost:3000/transfers/v1/details")
      .then((res) => setTransfers(res.data))
      .catch((err) => {
        console.error(err);
        setError("Failed to load transfers");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="preview-transfer-loading">Loading…</div>;
  if (error) return <div className="preview-transfer-error">{error}</div>;

  return (
    <div className="preview-transfer-table-wrapper">
      <table className="preview-transfer-table">
        <thead>
          <tr>
            <th>Transfer #</th>
            <th>Date</th>
            <th>Type</th>
            <th>Location</th>
            <th>Item Name</th>
            <th>Origin</th>
            <th>type</th>
            <th>Length</th>
            <th>Width</th>
            <th>Sheets/Box</th>
            <th>SQM</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {transfers.flatMap((t) =>
            t.items.map((i) => (
              <tr key={i.id}>
                <td>{t.transferNumber}</td>
                <td>{t.date}</td>
                <td>{t.type}</td>
                <td>{t.location}</td>
                <td>{`${i.thickness} ملم ${i.itemName}`}</td>
                <td>{i.origin}</td>
                <td>{i.itemType === "box" ? "Box" : "Sheet"}</td>
                <td>{Math.floor(Number(i.length))}</td>
                <td>{Math.floor(Number(i.width))}</td>
                <td>{i.sheetsPerBox}</td>
                <td>{i.sqm}</td>
                <td>{i.price}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
