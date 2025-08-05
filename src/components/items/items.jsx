// UniqueItemsPage.jsx
import React, { useState, useEffect } from "react";
import "./items.css";

const UniqueItemsPage = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");
  const [newItemData, setNewItemData] = useState({
    itemName: "",
    type: "box",
    descriptions: [
      {
        itemNumber: "", // ← NEW
        categoryName: "",
        subCategory: "",
        colorName: "",
        designName: "",
      },
    ],
    thicknesses: [
      {
        thickness: "",
        variants: [
          {
            length: "",
            width: "",
            sheetsPerBox: "",
            origin: "",
            fixBox: false,
            fixLength: false,
            fixWidth: false,
          },
          {
            length: "",
            width: "",
            sheetsPerBox: "",
            origin: "",
            fixBox: false,
            fixLength: false,
            fixWidth: false,
          },
        ],
      },
    ],
  });

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // ─── extracted fetch into its own function ──────────────────────────────────
  const refreshItems = async () => {
    try {
      const response = await fetch(`${baseUrl}/items/v1/filtered-items`);
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error("Error fetching items:", error);
    }
  };

  useEffect(() => {
    refreshItems(); // ← initial load
  }, [baseUrl]);

  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  const handleModalToggle = () => {
    setShowModal((v) => !v);
    setNewItemData({
      itemName: "",
      type: "box",
      descriptions: [
        {
          itemNumber: "",
          categoryName: "",
          subCategory: "",
          colorName: "",
          designName: "",
        },
      ],
      thicknesses: [
        {
          thickness: "",
          variants: [
            {
              length: "",
              width: "",
              sheetsPerBox: "",
              origin: "",
              fixBox: false,
              fixLength: false,
              fixWidth: false,
            },
            {
              length: "",
              width: "",
              sheetsPerBox: "",
              origin: "",
              fixBox: false,
              fixLength: false,
              fixWidth: false,
            },
          ],
        },
      ],
    });
  };

  const handleInputChange = (e, index = 0, variantIndex = 0) => {
    const { name, value, checked, type } = e.target;
    setNewItemData((prev) => {
      const updated = { ...prev };
      if (name === "type") {
        updated.type = value;
      } else if (name === "thickness") {
        updated.thicknesses[0].thickness = value;
      } else if (["length", "width", "sheetsPerBox", "origin"].includes(name)) {
        updated.thicknesses[0].variants[variantIndex][name] = value;
      } else if (type === "checkbox") {
        updated.thicknesses[0].variants[variantIndex][name] = checked;
      } else if (name === "itemName") {
        updated.itemName = value;
      } else if (name === "itemNumber") {
        // NEW: handle the itemNumber field
        updated.descriptions[index].itemNumber = value;
      } else if (
        ["categoryName", "subCategory", "colorName", "designName"].includes(
          name
        )
      ) {
        updated.descriptions[index][name] = value;
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // strip out any variants without an origin
    const payload = {
      ...newItemData,
      thicknesses: newItemData.thicknesses.map((th) => ({
        thickness: th.thickness,
        variants: th.variants.filter((v) => v.origin.trim() !== ""),
      })),
    };

    try {
      const response = await fetch(`${baseUrl}/items/v1/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        // ← replaced setItems([...]) with a fresh re-fetch
        await refreshItems();
        setModalType("success");
      } else {
        setModalType("error");
      }
    } catch {
      setModalType("error");
    } finally {
      setModalContent(true);
      setShowModal(false);
    }
  };

  const closeModal = () => setModalContent(false);

  const filteredItems = items.filter((item) =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="unique-items-page">
      <h1>Items</h1>
      <div className="search-bar-wrapper">
        <div className="unique-search-bar">
          <input
            type="text"
            placeholder="Search by item name"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <button>Search</button>
        </div>
        <button className="new-item-button" onClick={handleModalToggle}>
          New Item
        </button>
      </div>

      {/* scrolling wrapper so <tbody> spans full width */}
      <div className="unique-items-table-wrapper">
        <table className="unique-items-table">
          <thead>
            <tr>
              <th>Item Number</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Color</th>
              <th>Design</th>
              <th>Item Name</th>
              <th>Type</th>
              <th>Thickness(mm)</th>
              <th>Length(cm)</th>
              <th>Width(cm)</th>
              <th>Sheets/Box</th>
              <th>Origin</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) =>
              item.thicknesses.map((thick) =>
                thick.variants.map((v) => {
                  const d = v.itemNameDescription || {};
                  return (
                    <tr key={`${item.id}-${thick.id}-${v.id}`}>
                      <td>{d.itemNumber || "—"}</td>
                      <td>{d.categoryName || "—"}</td>
                      <td>{d.subCategory || "—"}</td>
                      <td>{d.colorName || "—"}</td>
                      <td>{d.designName || "—"}</td>
                      <td style={{ direction: "rtl", textAlign: "right" }}>
                        {`${thick.thickness} ملم ${item.itemName}`}
                      </td>
                      <td>{item.type}</td>
                      <td>{thick.thickness}</td>
                      {item.type === "sqm" ? (
                        <>
                          <td>—</td>
                          <td>—</td>
                        </>
                      ) : (
                        <>
                          <td>{v.length}</td>
                          <td>{v.width}</td>
                        </>
                      )}
                      <td>
                        {item.type === "box"
                          ? v.sheetsPerBox
                          : item.type === "sheet"
                          ? "—"
                          : "—"}
                      </td>
                      <td>{v.origin}</td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create New Item</h2>
            <form onSubmit={handleFormSubmit} className="form-grid">
              <label>
                Item Name:
                <input
                  type="text"
                  name="itemName"
                  value={newItemData.itemName}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Type:
                <select
                  name="type"
                  value={newItemData.type}
                  onChange={handleInputChange}
                >
                  <option value="box">Box</option>
                  <option value="sheet">Sheet</option>
                  <option value="sqm">SQM</option>
                </select>
              </label>

              {/* NEW Item Number field */}
              <label>
                Item Number:
                <input
                  type="text"
                  name="itemNumber"
                  value={newItemData.descriptions[0].itemNumber}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <label>
                Category:
                <input
                  type="text"
                  name="categoryName"
                  value={newItemData.descriptions[0].categoryName}
                  onChange={handleInputChange}
                />
              </label>
              <label>
                Subcategory:
                <input
                  type="text"
                  name="subCategory"
                  value={newItemData.descriptions[0].subCategory}
                  onChange={handleInputChange}
                />
              </label>
              <label>
                Color:
                <input
                  type="text"
                  name="colorName"
                  value={newItemData.descriptions[0].colorName}
                  onChange={handleInputChange}
                />
              </label>
              <label>
                Design:
                <input
                  type="text"
                  name="designName"
                  value={newItemData.descriptions[0].designName}
                  onChange={handleInputChange}
                />
              </label>

              <label>
                Thickness (mm):
                <input
                  type="number"
                  name="thickness"
                  value={newItemData.thicknesses[0].thickness}
                  onChange={handleInputChange}
                  required
                />
              </label>

              {newItemData.type !== "sqm" && (
                <>
                  <label>
                    Length (cm):
                    <input
                      type="number"
                      name="length"
                      value={newItemData.thicknesses[0].variants[0].length}
                      onChange={handleInputChange}
                    />
                  </label>
                  <label>
                    Width (cm):
                    <input
                      type="number"
                      name="width"
                      value={newItemData.thicknesses[0].variants[0].width}
                      onChange={handleInputChange}
                    />
                  </label>
                </>
              )}

              {newItemData.type === "box" && (
                <label>
                  Sheets Per Box:
                  <input
                    type="number"
                    name="sheetsPerBox"
                    value={newItemData.thicknesses[0].variants[0].sheetsPerBox}
                    onChange={handleInputChange}
                    required
                  />
                </label>
              )}

              <label>
                Origin:
                <input
                  type="text"
                  name="origin"
                  value={newItemData.thicknesses[0].variants[0].origin}
                  onChange={handleInputChange}
                  required
                />
              </label>

              <div className="button-row">
                <button type="submit">Create Item</button>
                <button type="button" onClick={handleModalToggle}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalContent && (
        <div className="modal">
          <div
            className={`modal-content ${
              modalType === "success" ? "success-modal" : "error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="modal-success-text">
                  Item Created Successfully
                </h2>
                <div className="modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="modal-error-text">Failed to Create Item</h2>
                <div className="modal-icon">✖</div>
              </>
            )}
            <button className="modal-button" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniqueItemsPage;
