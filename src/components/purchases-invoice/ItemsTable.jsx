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
  // existing change handler…
  const handleItemChange = (index, field, value) => {
    if (!isEditable) return;
    const newItems = [...items];
    newItems[index][field] = value;
    const { length, width, quantity, sheetsPerBox, euroPrice, euroOfferPrice } =
      newItems[index];

    const sqm = (length * width * quantity * sheetsPerBox) / 10000;
    newItems[index].sqm = sqm;

    if (currency === "EURO") {
      newItems[index].unitPrice = euroPrice ? euroPrice / exchangeRate : 0;
      newItems[index].priceOFR = euroOfferPrice
        ? euroOfferPrice / exchangeRate
        : 0;
    }

    if (invoiceType === "G") {
      newItems[index].unitPrice = 0;
    } else if (invoiceType === "S") {
      newItems[index].priceOFR = newItems[index].unitPrice;
    }

    newItems[index].total = sqm * (newItems[index].unitPrice || 0);
    newItems[index].totalOFR = sqm * (newItems[index].priceOFR || 0);

    setItems(newItems);
  };

  // ── new delete menu state ──
  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  // close anywhere
  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  // on right-click row
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

  // delete that single row
  const handleDeleteSingle = () => {
    const { rowIndex } = deleteMenu;
    if (rowIndex == null) return;
    setItems(items.filter((_, i) => i !== rowIndex));
    closeDeleteMenu();
  };

  // ✅ NEW: one-time backfill so each row has a top-level `thickness`
  useEffect(() => {
    if (!Array.isArray(items) || items.length === 0) return;

    let changed = false;
    const patched = items.map((it) => {
      // If thickness is already a finite number > 0, keep as is
      const hasTopLevel =
        it != null && Number.isFinite(Number(it.thickness)) && Number(it.thickness) > 0;

      if (hasTopLevel) return it;

      // Try common places where thickness might live
      const candidates = [
        it?.payloadVariant?.thickness,
        it?.variant?.thickness,
        it?.dimension?.thickness,
        it?.th,                 // sometimes teams name it "th"
        it?.thk,                // or "thk"
        it?.thickness_mm,       // or "thickness_mm"
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

  // ✅ helper: format “thickness ملم itemName”
  const displayItemName = (item) => {
    const name = item?.itemName || "";

    // Prefer the now-backfilled top-level thickness
    const thicknesses = [
      item?.thickness,
      item?.payloadVariant?.thickness,
      item?.variant?.thickness,
      item?.dimension?.thickness,
    ].map((v) => (v == null ? v : Number(v)));

    const th = thicknesses.find((n) => Number.isFinite(n) && n > 0);

    return th != null ? `${th} ملم ${name}` : name;
  };

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
        {/* ✅ ADDED: per-column width control via percentages */}
        <colgroup>
          <col className="col-itemname" />
          <col className="col-type" />
          <col className="col-origin" />
          <col className="col-length" />
          <col className="col-width" />
          <col className="col-qty" />
          <col className="col-spb" />
          <col className="col-sqm" />
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
            <th>Length (cm)</th>
            <th>Width (cm)</th>
            <th>Quantity</th>
            <th>Sheets/Box</th>
            <th>SQM</th>
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
              {/* show “thickness ملم name” while preserving RTL */}
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
              <td>{(item.sqm || 0).toFixed(2)}</td>
              {currency === "EURO" && (
                <td>
                  <input
                    type="number"
                    value={item.euroPrice || 0}
                    onChange={(e) =>
                      handleItemChange(
                        index,
                        "euroPrice",
                        Number(e.target.value)
                      )
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
                      handleItemChange(
                        index,
                        "unitPrice",
                        Number(e.target.value)
                      )
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
                      handleItemChange(
                        index,
                        "euroOfferPrice",
                        Number(e.target.value)
                      )
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
                      handleItemChange(
                        index,
                        "priceOFR",
                        Number(e.target.value)
                      )
                    }
                    disabled={!isEditable}
                  />
                </td>
              )}
              <td>{(item.total || 0).toFixed(2)}</td>
              <td>{(item.totalOFR || 0).toFixed(2)}</td>
              <td>
                <input
                  type="number"
                  value={item.numberOfContainers || 0}
                  onChange={(e) =>
                    handleItemChange(
                      index,
                      "numberOfContainers",
                      Number(e.target.value)
                    )
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
