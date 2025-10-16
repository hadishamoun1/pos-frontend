// src/recievables/CountOpeningSearchModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./countOpeningSearchModal.css";

const CountOpeningSearchModal = ({ isOpen, onClose, onSelectItems }) => {
  const [rawData, setRawData] = useState([]);          // whatever the API returns
  const [rows, setRows] = useState([]);                // normalized flat rows for UI
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // ----- helpers -----
  const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const makeUniqueKey = (r) =>
    `${r.itemName || ""}-${r.origin || ""}-${r.thickness || ""}-${r.length || ""}-${r.width || ""}-${r.sheetsPerBox || ""}`;

  const calculateSQM = (length, width, type, box, sheet) => {
    const Lm = toNum(length) / 100;
    const Wm = toNum(width) / 100;
    if (!Lm || !Wm) return "";
    if (type === "box") return (Lm * Wm * toNum(box) * toNum(sheet)).toFixed(2);
    if (type === "sheet") return (Lm * Wm * toNum(sheet)).toFixed(2);
    return ""; // for sqm/unit types (your previous logic)
  };

  // ----- fetch -----
  useEffect(() => {
    if (!isOpen) return;
    setSearchTerm("");
    setSelectedKeys(new Set());
    (async () => {
      try {
        const res = await axios.get(`${baseUrl}/items/v2/filtered-items`);
        const data = res?.data ?? [];
        setRawData(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching items:", err);
        setRawData([]);
      }
    })();
  }, [isOpen, baseUrl]);

  // ----- normalize API -----
  useEffect(() => {
    // Two possible shapes:
    // A) NESTED:
    //   [{ id, itemName, type, thicknesses:[{ id, thickness, variants:[{ id, origin, length, width, sheetsPerBox }] }]}]
    // B) FLAT (from your v2):
    //   [{ itemId, itemName, type, variantId, thickness, length, width, sheetsPerBox, origin, ... }]
    //
    // We normalize both to:
    //   { key, itemId, itemName, type, variantId, thickness, length, width, sheetsPerBox, origin }

    const out = [];

    if (Array.isArray(rawData) && rawData.length > 0) {
      const looksNested =
        rawData[0] &&
        typeof rawData[0] === "object" &&
        Array.isArray(rawData[0].thicknesses);

      if (looksNested) {
        // NESTED → FLATTEN
        for (const item of rawData) {
          const itemId = item?.id;
          const itemName = item?.itemName ?? "";
          const type = item?.type ?? "";
          for (const th of item?.thicknesses ?? []) {
            const thickness = toNum(th?.thickness);
            for (const v of th?.variants ?? []) {
              const row = {
                itemId,
                itemName,
                type,
                variantId: v?.id,
                thickness,
                length: toNum(v?.length),
                width: toNum(v?.width),
                sheetsPerBox: toNum(v?.sheetsPerBox) || 1,
                origin: v?.origin ?? "",
              };
              out.push({ ...row, key: makeUniqueKey(row) });
            }
          }
        }
      } else {
        // Already FLAT → Just map the fields we need (defensive)
        for (const r of rawData) {
          const row = {
            itemId: r.itemId ?? r.id ?? undefined,
            itemName: r.itemName ?? "",
            type: r.type ?? "",
            variantId: r.variantId ?? r.id ?? undefined,
            thickness: toNum(r.thickness),
            length: toNum(r.length),
            width: toNum(r.width),
            sheetsPerBox: toNum(r.sheetsPerBox) || 1,
            origin: r.origin ?? "",
          };
          out.push({ ...row, key: makeUniqueKey(row) });
        }
      }
    }

    setRows(out);
  }, [rawData]);

  // ----- filtering -----
  const filteredRows = useMemo(() => {
    if (!searchTerm) return rows;
    const q = searchTerm.toLowerCase();
    return rows.filter((r) => (r.itemName || "").toLowerCase().includes(q));
  }, [rows, searchTerm]);

  // ----- selection -----
  const toggleSelect = (key) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedKeys(next);
  };

  // ----- OK payload -----
  const handleOk = () => {
    const selectedData = filteredRows
      .filter((r) => selectedKeys.has(r.key))
      .map((r) => {
        // match your previous payload
        const box = r.type === "box" ? 1 : "";
        const sheet = r.type === "sheet" ? 1 : r.sheetsPerBox;

        return {
          itemVariantId: r.variantId,
          origin: r.origin,
          item: `${r.thickness} ملم ${r.itemName}`,
          type: r.type,
          length: Math.floor(r.length),
          width: Math.floor(r.width),
          sheetsPerBox: r.sheetsPerBox,
          box,
          sheet,
          sqm: calculateSQM(r.length, r.width, r.type, box, sheet),
          uniqueId: r.key,
        };
      });

    onSelectItems(selectedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="count-opening-search-modal-overlay">
      <div className="count-opening-search-modal-content">
        <div className="count-opening-search-modal-header">
          <h2 className="count-opening-search-modal-title">Search</h2>
          <div className="count-opening-search-modal-buttons">
            <button
              className="count-opening-search-modal-close-button"
              onClick={onClose}
            >
              Close
            </button>
            <button
              className="count-opening-search-modal-ok-button"
              onClick={handleOk}
              disabled={selectedKeys.size === 0}
            >
              OK
            </button>
          </div>
        </div>

        <input
          type="text"
          placeholder="Enter search term"
          className="count-opening-search-modal-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <table className="count-opening-search-modal-table">
          <thead>
            <tr>
              <th>Select</th>
              <th>Origin</th>
              <th>Item</th>
              <th>Type</th>
              <th>Length</th>
              <th>Width</th>
              <th>Sheets/Box</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", opacity: 0.7 }}>
                  No results
                </td>
              </tr>
            ) : (
              filteredRows.map((r, idx) => (
                <tr key={r.key || idx}>
                  <td>
                    <input
                      type="checkbox"
                      className="count-opening-search-modal-select-checkbox"
                      checked={selectedKeys.has(r.key)}
                      onChange={() => toggleSelect(r.key)}
                    />
                  </td>
                  <td>{r.origin}</td>
                  <td style={{ direction: "rtl", textAlign: "right" }}>
                    {`${r.thickness} ملم ${r.itemName}`}
                  </td>
                  <td>{r.type}</td>
                  <td>{Math.floor(r.length)}</td>
                  <td>{Math.floor(r.width)}</td>
                  <td>{r.sheetsPerBox}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CountOpeningSearchModal;
