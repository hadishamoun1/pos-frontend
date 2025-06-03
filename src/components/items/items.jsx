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
    type: "box", // default
    thicknesses: [
      {
        thickness: "",
        variants: [
          {
            length: "",
            width: "",
            sheetsPerBox: "",
            origin: "",
            fixBox: true,
            fixLength: true,
            fixWidth: true,
          },
        ],
      },
    ],
  });

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${baseUrl}/items/v1/filtered-items`);
        const data = await response.json();
        setItems(data);
      } catch (error) {
        console.error("Error fetching items:", error);
      }
    };
    fetchData();
  }, [baseUrl]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleModalToggle = () => {
    setShowModal((v) => !v);
    // reset form on open
    setNewItemData({
      itemName: "",
      type: "box",
      thicknesses: [
        {
          thickness: "",
          variants: [
            {
              length: "",
              width: "",
              sheetsPerBox: "",
              origin: "",
              fixBox: true,
              fixLength: true,
              fixWidth: true,
            },
          ],
        },
      ],
    });
  };

  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setNewItemData((prev) => {
      const updated = { ...prev };
      // If they changed the global "type"
      if (name === "type") {
        updated.type = value;
        // adjust sheetsPerBox depending on new type
        const variant = updated.thicknesses[0].variants[0];
        if (value === "box") {
          variant.sheetsPerBox = "";
        } else if (value === "sheet") {
          variant.sheetsPerBox = 0;
        } else if (value === "sqm") {
          variant.sheetsPerBox = 0;
          variant.length = "";
          variant.width = "";
        }
      }
      // thickness level
      else if (name === "thickness") {
        updated.thicknesses[0].thickness = value;
      }
      // variant fields
      else if (["length", "width", "sheetsPerBox", "origin"].includes(name)) {
        updated.thicknesses[0].variants[0][name] = value;
      }
      // checkboxes
      else if (type === "checkbox") {
        updated.thicknesses[0].variants[0][name] = checked;
      }
      // itemName
      else if (name === "itemName") {
        updated.itemName = value;
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${baseUrl}/items/v1/create-complete-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItemData),
      });
      if (response.ok) {
        const newItem = await response.json();
        setItems((prev) => [...prev, newItem]);
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

      <table className="unique-items-table">
        <thead>
          <tr>
            <th>Item Name</th>
            <th>Type</th>
            <th>Thickness (mm)</th>
            <th>Length (cm)</th>
            <th>Width (cm)</th>
            <th>Sheets/Box</th>
            <th>Origin</th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.map((item) =>
            item.thicknesses.map((thick) =>
              thick.variants.map((v) => (
                <tr
                  key={`${item.id}-${thick.thickness}-${v.length}-${v.width}`}
                >
                  <td>{`${parseFloat(thick.thickness)}mm ${item.itemName}`}</td>
                  <td>{item.type}</td>
                  <td>{thick.thickness}</td>
                  {/* hide length/width for sqm */}
                  {newItemData.type === "sqm" ? (
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
                  {/* sheets per box only for box */}
                  <td>
                    {item.type === "box"
                      ? v.sheetsPerBox
                      : item.type === "sheet"
                      ?"—"
                      : "—"}
                  </td>
                  <td>{v.origin}</td>
                </tr>
              ))
            )
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Create New Item</h2>
            <form onSubmit={handleFormSubmit}>
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

              {/* only show for box or sheet */}
              {newItemData.type !== "sqm" && (
                <>
                  <label>
                    Length (cm):
                    <input
                      type="number"
                      name="length"
                      value={newItemData.thicknesses[0].variants[0].length}
                      onChange={handleInputChange}
                      required={newItemData.type !== "sqm"}
                    />
                  </label>

                  <label>
                    Width (cm):
                    <input
                      type="number"
                      name="width"
                      value={newItemData.thicknesses[0].variants[0].width}
                      onChange={handleInputChange}
                      required={newItemData.type !== "sqm"}
                    />
                  </label>
                </>
              )}

              {/* only for box */}
              {newItemData.type === "box" && (
                <label>
                  Sheets Per Box:
                  <input
                    type="number"
                    name="sheetsPerBox"
                    value={newItemData.thicknesses[0].variants[0].sheetsPerBox}
                    onChange={handleInputChange}
                    required={newItemData.type === "box"}
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

              <div className="checkboxes">
                <label>
                  Fix Box:
                  <input
                    type="checkbox"
                    name="fixBox"
                    checked={newItemData.thicknesses[0].variants[0].fixBox}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  Fix Length:
                  <input
                    type="checkbox"
                    name="fixLength"
                    checked={newItemData.thicknesses[0].variants[0].fixLength}
                    onChange={handleInputChange}
                  />
                </label>
                <label>
                  Fix Width:
                  <input
                    type="checkbox"
                    name="fixWidth"
                    checked={newItemData.thicknesses[0].variants[0].fixWidth}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              <button type="submit">Create Item</button>
              <button type="button" onClick={handleModalToggle}>
                Cancel
              </button>
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
