import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { FaTrash } from "react-icons/fa";
import "./items.css";

const CreateItemWithDimensions = () => {
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const {
    data: fetchedItems = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const { data } = await axios.get("http://localhost:3000/items");
      return data;
    },
  });

  const saveItemMutation = useMutation({
    mutationFn: async (item) => {
      const { data } = await axios.post("http://localhost:3000/items", {
        itemName: item.itemName,
        type: item.type,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const saveDimensionMutation = useMutation({
    mutationFn: async (dimension) => {
      const { data } = await axios.post(
        "http://localhost:3000/dimensions",
        dimension
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dimensions"] });
    },
  });

  const addItem = () => {
    setItems([
      ...items,
      {
        id: Date.now(),
        itemName: "",
        origin: "",
        type: "box",
        length: "",
        width: "",
        sheetsPerBox: 1,
      },
    ]);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleDelete = (id) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const saveItems = async () => {
    try {
      for (const item of items) {
        const newItem = await saveItemMutation.mutateAsync({
          itemName: item.itemName,
          type: item.type,
        });

        await saveDimensionMutation.mutateAsync({
          itemId: newItem.itemId,
          length: item.length,
          width: item.width,
          sheetsPerBox: item.sheetsPerBox,
          origin: item.origin,
        });
      }
      setItems([]);
      queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch (error) {
      console.error("Error saving items and dimensions:", error);
    }
  };

  // Function to filter items based on search query with real-time partial matching
  const filterItems = (items) => {
    if (!searchQuery) return items;

    const searchPattern = /^(.+?)\s*(\d*)\*?(\d*)-?(\d*)$/;
    const match = searchQuery.match(searchPattern);

    if (!match) return items;

    const [
      ,
      searchName = "",
      searchLength = "",
      searchWidth = "",
      searchSheets = "",
    ] = match;

    return items.filter((item) =>
      item.dimensions.some(
        (dimension) =>
          item.itemName.toLowerCase().startsWith(searchName.toLowerCase()) &&
          (!searchLength ||
            dimension.length.toString().startsWith(searchLength)) &&
          (!searchWidth ||
            dimension.width.toString().startsWith(searchWidth)) &&
          (!searchSheets ||
            dimension.sheetsPerBox?.toString().startsWith(searchSheets))
      )
    );
  };

  const filteredItems = filterItems(fetchedItems);

  return (
    <div className="twoColumnContainer">
      <div className="createItemContainer">
        <h2 className="itemFormTitle">Create New Item with Dimensions</h2>

        {items.map((item, index) => (
          <div key={item.id} className="itemRowWrapper">
            <div className="itemFormRow">
              <div className="inputRow">
                <input
                  type="text"
                  className="itemInput"
                  placeholder="Item Name"
                  value={item.itemName}
                  onChange={(e) =>
                    handleItemChange(index, "itemName", e.target.value)
                  }
                />
                <input
                  type="text"
                  className="itemInput"
                  placeholder="Origin"
                  value={item.origin}
                  onChange={(e) =>
                    handleItemChange(index, "origin", e.target.value)
                  }
                />
                <select
                  className="itemInput"
                  value={item.type}
                  onChange={(e) =>
                    handleItemChange(index, "type", e.target.value)
                  }
                >
                  <option value="box">Box</option>
                  <option value="sheet">Sheet</option>
                </select>
              </div>

              <div className="inputRow">
                <input
                  type="number"
                  className="itemInput"
                  placeholder="Length"
                  value={item.length}
                  onChange={(e) =>
                    handleItemChange(index, "length", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="itemInput"
                  placeholder="Width"
                  value={item.width}
                  onChange={(e) =>
                    handleItemChange(index, "width", e.target.value)
                  }
                />
                <input
                  type="number"
                  className="itemInput"
                  placeholder="Sheets per Box"
                  value={item.sheetsPerBox}
                  onChange={(e) =>
                    handleItemChange(index, "sheetsPerBox", e.target.value)
                  }
                  disabled={item.type === "sheet"}
                />
              </div>
            </div>
            <button
              className="itemDeleteBtn"
              onClick={() => handleDelete(item.id)}
            >
              <FaTrash />
            </button>
          </div>
        ))}

        <div className="buttonsContainer">
          <button className="itemAddBtn" onClick={addItem}>
            Add Another Item
          </button>
          <button className="itemSaveBtn" onClick={saveItems}>
            Save Items
          </button>
        </div>
      </div>

      <div className="additionalInfoContainer">
        <h2 className="itemFormTitle">Saved Items & Dimensions</h2>

        {/* Search Bar */}
        <input
          type="text"
          className="searchInput"
          placeholder="Search by format: e.g., 5.5mm clear 225*321-27"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {isLoading ? (
          <p>Loading items...</p>
        ) : isError ? (
          <p>Error fetching items.</p>
        ) : (
          <table className="itemsTable">
            <thead>
              <tr>
                <th>Origin</th>
                <th>Item Name</th>
                <th>Type</th>
                <th>Length (cm)</th>
                <th>Width (cm)</th>
                <th>Sheets per Box</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) =>
                item.dimensions.map((dimension) => (
                  <tr key={dimension.dimensionId}>
                    <td>{dimension.origin}</td>
                    <td>{item.itemName}</td>
                    <td>{item.type}</td>
                    <td>{dimension.length}</td>
                    <td>{dimension.width}</td>
                    <td>{item.type === "box" ? dimension.sheetsPerBox : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default CreateItemWithDimensions;
