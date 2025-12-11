import React, { useEffect, useState } from "react";

export default function ItemsTable({
  items,
  setItems,
  openItemModal,
  currency,
  exchangeRate,
  isEditable,
  invoiceType,
}) {
  const num = (v, fb = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  };

  const round2 = (v) => Number(num(v, 0).toFixed(2));

  const calcSqmFromDims = (row) => {
    const length = num(row.length, 0);
    const width = num(row.width, 0);
    const quantity = num(row.quantity, 0);
    const sheetsPerBox = num(row.sheetsPerBox, 1);
    return (length * width * quantity * sheetsPerBox) / 10000;
  };

  const applyTypeRules = (row) => {
    const sqm = num(row.sqm, 0);
    const sqmOfr = num(row.sqmOfr, 0);

    if (invoiceType === "S") {
      // S: sqmOfr only, sqm mirrors sqmOfr
      row.sqmOfr = sqmOfr > 0 ? sqmOfr : round2(calcSqmFromDims(row));
      row.sqm = row.sqmOfr;
      return;
    }

    if (invoiceType === "G") {
      // G: sqmOfr only, sqm is 0
      row.sqmOfr = sqmOfr > 0 ? sqmOfr : round2(calcSqmFromDims(row));
      row.sqm = 0;
      // also force unitPrice=0 (your original rule)
      row.unitPrice = 0;
      return;
    }

    if (invoiceType === "SR") {
      // SR: both sqm and sqmOfr exist. Default sqm from dims if empty.
      // Do NOT force them equal; user can edit both.
      if (!(sqm > 0)) row.sqm = round2(calcSqmFromDims(row));
      if (!(sqmOfr > 0)) row.sqmOfr = row.sqm; // sensible default
      return;
    }

    if (invoiceType === "RVR") {
      // RVR: sqm only, sqmOfr = 0
      row.sqm = sqm > 0 ? sqm : round2(calcSqmFromDims(row));
      row.sqmOfr = 0;
      return;
    }

    // default behavior (your old behavior): compute sqm from dims and set sqmOfr = sqm unless user has set it
    row.sqm = round2(calcSqmFromDims(row));
    row.sqmOfr = num(row.sqmOfr, 0) || row.sqm;
  };

  const applyPrices = (row) => {
    // currency conversions
    if (currency === "EURO") {
      row.unitPrice = row.euroPrice ? num(row.euroPrice, 0) / num(exchangeRate, 1) : 0;
      row.priceOFR = row.euroOfferPrice
        ? num(row.euroOfferPrice, 0) / num(exchangeRate, 1)
        : 0;
    }

    // type rules for prices
    if (invoiceType === "G") {
      row.unitPrice = 0;
    } else if (invoiceType === "S") {
      row.priceOFR = num(row.unitPrice, 0);
    }
  };

  const applyTotals = (row) => {
    // total uses sqm, totalOFR uses sqmOfr
    row.total = round2(num(row.sqm, 0) * num(row.unitPrice, 0));
    row.totalOFR = round2(num(row.sqmOfr, 0) * num(row.priceOFR, 0));
  };

const handleItemChange = (index, field, value) => {
  if (!isEditable) return;

  const newItems = [...items];
  const row = { ...newItems[index], [field]: value };

  const dimFields = new Set(["length", "width", "quantity", "sheetsPerBox"]);
  const isDimChange = dimFields.has(field);

  // 1) Track manual overrides (SR only, but harmless for others)
  if (field === "sqm") {
    row.sqm = num(value, 0);
    row._sqmManual = true;
  }
  if (field === "sqmOfr") {
    row.sqmOfr = num(value, 0);
    row._sqmOfrManual = true;
  }

  // 2) If dimensions changed -> recompute base sqm
  if (isDimChange) {
    const base = round2(calcSqmFromDims(row));

    if (invoiceType === "S") {
      // S: sqmOfr only, sqm mirrors it (always recalc on dims)
      row.sqmOfr = base;
      row.sqm = base;
      row._sqmManual = false;
      row._sqmOfrManual = false;
    } else if (invoiceType === "G") {
      // G: sqmOfr only, sqm is 0 (always recalc on dims)
      row.sqmOfr = base;
      row.sqm = 0;
      row._sqmManual = false;
      row._sqmOfrManual = false;
      row.unitPrice = 0;
    } else if (invoiceType === "RVR") {
      // RVR: sqm only, sqmOfr is 0 (always recalc on dims)
      row.sqm = base;
      row.sqmOfr = 0;
      row._sqmManual = false;
      row._sqmOfrManual = false;
    } else if (invoiceType === "SR") {
      // SR: both exist; only overwrite if user didn't manually edit
      if (!row._sqmManual) row.sqm = base;
      if (!row._sqmOfrManual) row.sqmOfr = base; // default same as base
    } else {
      // default: behave like "both" but keep manual sqmOfr if user set it
      row.sqm = base;
      if (!row._sqmOfrManual) row.sqmOfr = base;
    }
  } else {
    // 3) Non-dimension edits -> enforce type rules (but don't fight SR manual edits)
    const sqm = num(row.sqm, 0);
    const sqmOfr = num(row.sqmOfr, 0);

    if (invoiceType === "S") {
      // keep sqm and sqmOfr tied
      row.sqmOfr = sqmOfr > 0 ? sqmOfr : round2(calcSqmFromDims(row));
      row.sqm = row.sqmOfr;
      row._sqmManual = false;
      row._sqmOfrManual = false;
    } else if (invoiceType === "G") {
      row.sqmOfr = sqmOfr > 0 ? sqmOfr : round2(calcSqmFromDims(row));
      row.sqm = 0;
      row._sqmManual = false;
      row._sqmOfrManual = false;
      row.unitPrice = 0;
    } else if (invoiceType === "RVR") {
      row.sqm = sqm > 0 ? sqm : round2(calcSqmFromDims(row));
      row.sqmOfr = 0;
      row._sqmManual = false;
      row._sqmOfrManual = false;
    } else if (invoiceType === "SR") {
      // do nothing here: SR allows manual edits for sqm/sqmOfr
      // (dims recalculation handled above)
    } else {
      // default: if no sqmOfr, mirror sqm
      row.sqm = num(row.sqm, 0);
      row.sqmOfr = num(row.sqmOfr, 0) || row.sqm;
    }
  }

  // 4) Prices (your existing logic)
  applyPrices(row);

  // 5) Totals
  applyTotals(row);

  newItems[index] = row;
  setItems(newItems);
};


  // ── new delete menu state ──
  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  const handleRowContext = (e, index) => {
    e.preventDefault();
    if (!isEditable) return;
    setDeleteMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      rowIndex: index,
    });
  };

  const handleDeleteSingle = () => {
    const { rowIndex } = deleteMenu;
    if (rowIndex == null) return;
    setItems(items.filter((_, i) => i !== rowIndex));
    closeDeleteMenu();
  };

  // ✅ Backfill thickness
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;

    let changed = false;
    const patched = items.map((it) => {
      const hasTopLevel =
        it != null && Number.isFinite(Number(it.thickness)) && Number(it.thickness) > 0;

      if (hasTopLevel) return it;

      const candidates = [
        it?.payloadVariant?.thickness,
        it?.variant?.thickness,
        it?.dimension?.thickness,
        it?.th,
        it?.thk,
        it?.thickness_mm,
      ].map((v) => (v == null ? v : Number(v)));

      const found = candidates.find((n) => Number.isFinite(n) && n > 0);

      if (found != null) {
        changed = true;
        return { ...it, thickness: found };
      }
      return it;
    });

    if (changed) setItems(patched);
  }, [items, setItems]);

  // ✅ Ensure sqm/sqmOfr consistency when invoiceType changes or items are newly added
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;

    let changed = false;
    const patched = items.map((it) => {
      const row = { ...it };

      // ensure numbers
      row.sqm = num(row.sqm, 0);
      row.sqmOfr = num(row.sqmOfr, 0);

      // apply rules (may override)
      const before = `${row.sqm}|${row.sqmOfr}|${row.unitPrice}|${row.priceOFR}`;
      applyTypeRules(row);
      applyPrices(row);
      applyTotals(row);
      const after = `${row.sqm}|${row.sqmOfr}|${row.unitPrice}|${row.priceOFR}`;

      if (before !== after) changed = true;
      return row;
    });

    if (changed) setItems(patched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceType]);

  const displayItemName = (item) => {
    const name = item?.itemName || "";
    const thicknesses = [
      item?.thickness,
      item?.payloadVariant?.thickness,
      item?.variant?.thickness,
      item?.dimension?.thickness,
    ].map((v) => (v == null ? v : Number(v)));

    const th = thicknesses.find((n) => Number.isFinite(n) && n > 0);
    return th != null ? `${th} ملم ${name}` : name;
  };

  const showSqm = invoiceType !== "G" && invoiceType !== "S"; // SR/RVR (and others) show sqm
  const showSqmOfr = invoiceType !== "RVR"; // S/G/SR show sqmOfr, RVR doesn't
  const sqmEditable = isEditable && (invoiceType === "SR"); // only SR user edits sqm
  const sqmOfrEditable = isEditable && (invoiceType === "SR"); // only SR user edits sqmOfr

  return (
    <div className="items-table" onClick={closeDeleteMenu}>
      <div className="separator">
        <h3>Items</h3>
        <button
          className="select-item-button"
          onClick={openItemModal}
          disabled={!isEditable}
        >
          Select Item
        </button>
      </div>

      <table>
        <colgroup>
          <col className="col-itemname" />
          <col className="col-type" />
          <col className="col-origin" />
          <col className="col-length" />
          <col className="col-width" />
          <col className="col-qty" />
          <col className="col-spb" />

          {/* sqm / sqmOfr cols */}
          {showSqm && <col className="col-sqm" />}
          {showSqmOfr && <col className="col-sqmofr" />}

          {currency === "EURO" && <col className="col-euro" />}
          {invoiceType !== "G" && <col className="col-unit" />}
          {currency === "EURO" && <col className="col-euro-ofr" />}
          {invoiceType !== "S" && invoiceType !== "RVR" && <col className="col-ofr" />}
          <col className="col-total" />
          <col className="col-total-ofr" />
          <col className="col-containers" />
        </colgroup>

        <thead>
          <tr>
            <th>Item Name</th>
            <th>Type</th>
            <th>Origin</th>
            <th>Length</th>
            <th>Width</th>
            <th>Quantity</th>
            <th>Sheets/Box</th>

            {showSqm && <th>SQM</th>}
            {showSqmOfr && <th>SQM OFR</th>}

            {currency === "EURO" && <th>Euro Price</th>}
            {invoiceType !== "G" && <th>Unit Price</th>}
            {currency === "EURO" && <th>Euro Offer Price</th>}
            {invoiceType !== "S" && invoiceType !== "RVR" && <th>Price OFR</th>}
            <th>Total</th>
            <th>Total OFR</th>
            <th>Nb of Cont</th>
          </tr>
        </thead>

        <tbody>
          {items.map((item, index) => (
            <tr
              key={item.id || index}
              onContextMenu={(e) => handleRowContext(e, index)}
            >
              <td style={{ direction: "rtl", textAlign: "right" }}>
                {displayItemName(item)}
              </td>

              <td>{item.type}</td>
              <td>{item.origin}</td>
              <td>{item.length || 0}</td>
              <td>{item.width || 0}</td>

              <td>
                <input
                  type="number"
                  value={item.quantity || 0}
                  onChange={(e) =>
                    handleItemChange(index, "quantity", Number(e.target.value))
                  }
                  disabled={!isEditable}
                />
              </td>

              <td>{item.type === "box" ? item.sheetsPerBox || 0 : ""}</td>

              {/* SQM (editable only for SR) */}
              {showSqm && (
                <td>
                  {invoiceType === "SR" ? (
                    <input
                      type="number"
                      value={num(item.sqm, 0)}
                      onChange={(e) =>
                        handleItemChange(index, "sqm", Number(e.target.value))
                      }
                      disabled={!sqmEditable}
                    />
                  ) : (
                    (num(item.sqm, 0)).toFixed(2)
                  )}
                </td>
              )}

              {/* SQM OFR (editable only for SR) */}
              {showSqmOfr && (
                <td>
                  {invoiceType === "SR" ? (
                    <input
                      type="number"
                      value={num(item.sqmOfr, 0)}
                      onChange={(e) =>
                        handleItemChange(index, "sqmOfr", Number(e.target.value))
                      }
                      disabled={!sqmOfrEditable}
                    />
                  ) : (
                    (num(item.sqmOfr, 0)).toFixed(2)
                  )}
                </td>
              )}

              {currency === "EURO" && (
                <td>
                  <input
                    type="number"
                    value={item.euroPrice || 0}
                    onChange={(e) =>
                      handleItemChange(index, "euroPrice", Number(e.target.value))
                    }
                    disabled={!isEditable}
                  />
                </td>
              )}

              {invoiceType !== "G" && (
                <td>
                  <input
                    type="number"
                    value={item.unitPrice || 0}
                    onChange={(e) =>
                      handleItemChange(index, "unitPrice", Number(e.target.value))
                    }
                    disabled={!isEditable}
                  />
                </td>
              )}

              {currency === "EURO" && (
                <td>
                  <input
                    type="number"
                    value={item.euroOfferPrice || 0}
                    onChange={(e) =>
                      handleItemChange(index, "euroOfferPrice", Number(e.target.value))
                    }
                    disabled={!isEditable}
                  />
                </td>
              )}

              {invoiceType !== "S" && invoiceType !== "RVR" && (
                <td>
                  <input
                    type="number"
                    value={item.priceOFR || 0}
                    onChange={(e) =>
                      handleItemChange(index, "priceOFR", Number(e.target.value))
                    }
                    disabled={!isEditable}
                  />
                </td>
              )}

              <td>{round2(item.total || 0).toFixed(2)}</td>
              <td>{round2(item.totalOFR || 0).toFixed(2)}</td>

              <td>
                <input
                  type="number"
                  value={item.numberOfContainers || 0}
                  onChange={(e) =>
                    handleItemChange(index, "numberOfContainers", Number(e.target.value))
                  }
                  disabled={!isEditable}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {deleteMenu.visible && (
        <div
          className="context-menu-purchases"
          style={{
            top: deleteMenu.y,
            left: deleteMenu.x,
            position: "absolute",
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={handleDeleteSingle}>Delete</button>
        </div>
      )}
    </div>
  );
}
