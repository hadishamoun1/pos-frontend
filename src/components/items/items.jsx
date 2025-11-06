// UniqueItemsPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./items.css";

const PAGE_SIZE = 50;

const UniqueItemsPage = () => {
  const [items, setItems] = useState([]);
  const [itemsPage, setItemsPage] = useState(1);
  const [hasMoreItems, setHasMoreItems] = useState(true);
  const [totalItems, setTotalItems] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [tokens, setTokens] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);

  // Create modal
  const [showModal, setShowModal] = useState(false);

  // Status modal
  const [modalContent, setModalContent] = useState(false);
  const [modalType, setModalType] = useState("");

  // Selection (by variant)
  const [selectedRowKeys, setSelectedRowKeys] = useState(new Set());

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editVariantId, setEditVariantId] = useState(null);
  const [editCtx, setEditCtx] = useState({ itemId: null, thicknessId: null });
  const [editForm, setEditForm] = useState({
    itemName: "",
    type: "",
    thickness: "",
    length: "",
    width: "",
    sheetsPerBox: "",
    origin: "",
    descriptionId: null,
    itemNumber: "",
    categoryName: "",
    subCategory: "",
    colorName: "",
    designName: "",
  });

  // Debug: show last sent payload
  const [lastSentPayload, setLastSentPayload] = useState(null);

  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // ============ Utilities ============
  const safe = (v) => (v === 0 || v ? String(v).trim() : "");
  const numOrEmpty = (v) => (v === 0 || v ? String(Number(v)) : "");

  // ✅ Hoisted helper declarations
  function getVariantIdFromKey(key) {
    if (!key) return "";
    const m = key.match(/(?:^..:|;)\s*vid=([^;]+)/);
    return m ? m[1] : "";
  }
  function getItemIdFromKey(key) {
    if (!key) return "";
    const m = key.match(/(?:^..:|;)\s*iid=([^;]+)/);
    return m ? m[1] : "";
  }
  function getThicknessIdFromKey(key) {
    if (!key) return "";
    const m = key.match(/(?:^..:|;)\s*tid=([^;]+)/);
    return m ? m[1] : "";
  }

const makeKeyFromSearch = (r) => {
  const d = r?.description || {};
  const itemId = safe(r?.itemId);
  const type = safe(r?.type);
  const th = numOrEmpty(r?.thickness);
  const len = numOrEmpty(r?.length);
  const wid = numOrEmpty(r?.width);
  const sheets = numOrEmpty(r?.sheetsPerBox);
  const origin = safe(r?.origin);
  const descId = safe(d?.id) || safe(d?.itemNumber);
  const vid = safe(r?.variantId);
  const tid = safe(r?.thicknessId);
  return `sr:vid=${vid};iid=${itemId};tid=${tid};t=${type};th=${th};l=${len};w=${wid};s=${sheets};o=${origin};d=${descId}`;
};

// 🔁 Flatten non-search items for grouped ("realDescription"+"variants") OR legacy ("thicknesses") payloads
const flattenedListRows = useMemo(() => {
  const arr = Array.isArray(items) ? items : [];
  const out = [];

  for (const entry of arr) {
    // NEW SHAPE: { realDescription, variants: [...] }
    if (entry?.realDescription && Array.isArray(entry?.variants)) {
      const rd = entry.realDescription;
      // sort variants by thickness asc then length asc (like search)
      const sortedVars = [...entry.variants].sort((a, b) => {
        const ta = Number(a?.thickness ?? 0);
        const tb = Number(b?.thickness ?? 0);
        if (ta !== tb) return ta - tb;
        return Number(a?.length ?? 0) - Number(b?.length ?? 0);
      });
      for (const v of sortedVars) {
        out.push({
          ...v,
          variantId: Number(v?.variantId ?? v?.id),
          itemId: Number(v?.itemId),
          thicknessId: Number(v?.thicknessId),
          thickness: v?.thickness,
          itemName: v?.itemName,
          type: v?.type,
          length: v?.length,
          width: v?.width,
          sheetsPerBox: v?.sheetsPerBox,
          origin: v?.origin,
          description: rd, // keep RD on each row
        });
      }
      continue;
    }

    // LEGACY SHAPE: { itemName, type, thicknesses:[{ id, thickness, variants:[...] }]}
    const itemName = entry?.itemName ?? "";
    const type = entry?.type ?? "";
    const ths = Array.isArray(entry?.thicknesses) ? entry.thicknesses : [];
    for (const th of ths) {
      const tval = th?.thickness;
      const tid = th?.id;
      const vars = Array.isArray(th?.variants) ? th.variants : [];
      for (const v of vars) {
        // use realDescription first, fallback to itemNameDescription
        const rd = v?.realDescription || v?.itemNameDescription || {};
        out.push({
          variantId: Number(v?.id),
          itemId: Number(entry?.id),
          thicknessId: Number(tid),
          thickness: tval,
          itemName,
          type,
          length: v?.length,
          width: v?.width,
          sheetsPerBox: v?.sheetsPerBox,
          origin: v?.origin,
          description: rd,
        });
      }
    }
  }

  // sort groups by description.sortIndexRealDescription asc (NULLS LAST)
  out.sort((a, b) => {
    const ai = Number(a?.description?.sortIndexRealDescription);
    const bi = Number(b?.description?.sortIndexRealDescription);
    const aNull = Number.isNaN(ai);
    const bNull = Number.isNaN(bi);
    if (aNull && !bNull) return 1;
    if (!aNull && bNull) return -1;
    if (!aNull && !bNull && ai !== bi) return ai - bi;

    // tie-breakers: thickness asc, then length asc
    const ta = Number(a?.thickness ?? 0);
    const tb = Number(b?.thickness ?? 0);
    if (ta !== tb) return ta - tb;
    return Number(a?.length ?? 0) - Number(b?.length ?? 0);
  });

  return out;
}, [items]);

  // 🔧 FIX: prefer realDescription (fallback to legacy itemNameDescription)
  const makeKeyFromLocal = (item, thick, v) => {
    const d = v?.realDescription || v?.itemNameDescription || {};
    const itemId = safe(item?.id);
    const type = safe(item?.type);
    const th = numOrEmpty(thick?.thickness);
    const len = numOrEmpty(v?.length);
    const wid = numOrEmpty(v?.width);
    const sheets = numOrEmpty(v?.sheetsPerBox);
    const origin = safe(v?.origin);
    const descId = safe(d?.id) || safe(d?.itemNumber);
    const vid = safe(v?.id);
    const tid = safe(thick?.id);
    return `lv:vid=${vid};iid=${itemId};tid=${tid};t=${type};th=${th};l=${len};w=${wid};s=${sheets};o=${origin};d=${descId}`;
  };

  // ============ Suggestion-aware Enter ============
  const shouldLetBrowserHandleEnter = (e) => {
    const t = e.target;
    if (e.nativeEvent?.isComposing) return true;
    if (t && t.tagName === "SELECT") return true;
    if (t instanceof HTMLInputElement && t.getAttribute("list")) return true;
    if (t?.getAttribute?.("aria-activedescendant")) return true;
    if (document.querySelector('[role="listbox"][aria-expanded="true"]')) return true;
    if (document.querySelector(".MuiAutocomplete-popper, .autocomplete-popper, .autocomplete-panel")) return true;
    if (document.querySelector('[data-autocomplete="open"], .typeahead-open, .awesomplete ul[hidden="false"]')) return true;
    return false;
  };

  // ============ Create modal refs ============
  const refItemName = useRef(null);
  const refType = useRef(null);
  const refItemNumber = useRef(null);
  const refDesignName = useRef(null);
  const refThickness = useRef(null);
  const refLength = useRef(null);
  const refWidth = useRef(null);
  const refSheetsPerBox = useRef(null);
  const refOrigin = useRef(null);
  const refColorName = useRef(null);
  const refCategoryName = useRef(null);
  const refSubCategory = useRef(null);
  const refSubmit = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const idemKeyRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2)}`); // simple idempotency token

  // initial state
  const [newItemData, setNewItemData] = useState({
    itemName: "",
    type: "box",
    descriptions: [
      { itemNumber: "", categoryName: "", subCategory: "", colorName: "", designName: "" },
    ],
    thicknesses: [
      {
        thickness: "",
        variants: [
          { length: "", width: "", sheetsPerBox: "", origin: "", fixBox: false, fixLength: false, fixWidth: false },
        ],
      },
    ],
  });

  // ============ Fetch helpers ============
  const normalizeItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
  };

  // get page 1 and REPLACE
  const refreshItems = async () => {
    try {
      const res = await fetch(`${baseUrl}/items/v1/filtered-items?page=1&limit=${PAGE_SIZE}`);
      const json = await res.json().catch(() => null);
      const arr = normalizeItems(json);
      setItems(arr);
      setItemsPage(1);

      setHasMoreItems(Boolean(json?.hasMore));
      setTotalItems(Number.isFinite(Number(json?.total)) ? Number(json.total) : null);

      console.log("[FN] refreshItems →", {
        items: arr.length,
        hasMore: json?.hasMore,
        total: json?.total
      });
    } catch (error) {
      console.error("Error fetching items:", error);
      setItems([]);
      setItemsPage(1);
      setTotalItems(null);
      setHasMoreItems(false);
    }
  };

  // get next page and APPEND
  const loadMoreItems = async () => {
    console.log("[FN] loadMoreItems click", { loadingMore, hasMoreItems, itemsPage });
    if (loadingMore || !hasMoreItems) return;

    setLoadingMore(true);
    const nextPage = itemsPage + 1;
    try {
      const res = await fetch(
        `${baseUrl}/items/v1/filtered-items?page=${nextPage}&limit=${PAGE_SIZE}`
      );
      const json = await res.json().catch(() => null);
      const arr = normalizeItems(json);

      setItems((prev) => [...prev, ...arr]);
      setItemsPage(nextPage);

      setHasMoreItems(Boolean(json?.hasMore));
      setTotalItems(Number.isFinite(Number(json?.total)) ? Number(json.total) : totalItems);

      console.log("[FN] loadMoreItems →", {
        page: nextPage,
        fetched: arr.length,
        hasMore: json?.hasMore,
        total: json?.total
      });
    } catch (error) {
      console.error("Error loading more items:", error);
      setHasMoreItems(false);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    refreshItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  // ============ Tokenized search ============
  const queryString = useMemo(() => tokens.join(" ").trim(), [tokens]);

  const runTokenSearch = async () => {
    if (!queryString) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const url = new URL(`${baseUrl}/items/v1/search`);
      url.searchParams.set("q", queryString);
      url.searchParams.set("limit", "200");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Search failed");
      const json = await res.json();
      const rows = Array.isArray(json?.data) ? json.data : [];
      setSearchResults(rows);
    } catch (e) {
      console.warn("token search error:", e);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    runTokenSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString, baseUrl]);

  const addToken = (t) => {
    const v = (t || "").trim();
    if (!v) return;
    setTokens((prev) => [...prev, v]);
    setSearchTerm("");
    setSelectedRowKeys(new Set());
  };
  const removeToken = (idx) => {
    setTokens((prev) => prev.filter((_, i) => i !== idx));
    setSelectedRowKeys(new Set());
  };
  const clearTokens = () => {
    setTokens([]);
    setSelectedRowKeys(new Set());
  };

  const handleSearchChange = (e) => setSearchTerm(e.target.value);

  const handleSearchKeyDown = (e) => {
    if (e.key === "Backspace" && !searchTerm) {
      if (tokens.length > 0) {
        e.preventDefault();
        removeToken(tokens.length - 1);
      }
      return;
    }
    if (e.key === "Enter") {
      if (shouldLetBrowserHandleEnter(e)) return;
      e.preventDefault();
      addToken(searchTerm);
    }
  };

  // ============ Create: modal open/reset ============
  const getVisibleRefsInOrder = () => {
    const t = newItemData.type;
    const base = [refItemName, refType, refItemNumber, refDesignName, refThickness];
    if (t !== "sqm") base.push(refLength, refWidth);
    if (t === "box") base.push(refSheetsPerBox);
    base.push(refOrigin, refColorName, refCategoryName, refSubCategory);
    return base.filter(Boolean);
  };

  const onEnterFocusNext = (e, selfRef) => {
    if (e.key !== "Enter") return;
    if (shouldLetBrowserHandleEnter(e)) return;
    e.preventDefault();
    const visible = getVisibleRefsInOrder();
    const idx = visible.findIndex((r) => r === selfRef);
    const next = visible[idx + 1];
    if (next) {
      next.current?.focus?.();
      next.current?.select?.();
    } else {
      refSubmit.current?.click?.();
    }
  };

  const handleModalToggle = () => {
    setShowModal((v) => !v);
    setNewItemData({
      itemName: "",
      type: "box",
      descriptions: [{ itemNumber: "", categoryName: "", subCategory: "", colorName: "", designName: "" }],
      thicknesses: [
        {
          thickness: "",
          variants: [
            { length: "", width: "", sheetsPerBox: "", origin: "", fixBox: false, fixLength: false, fixWidth: false },
            { length: "", width: "", sheetsPerBox: "", origin: "", fixBox: false, fixLength: false, fixWidth: false },
          ],
        },
      ],
    });
  };

  const handleInputChange = (e, index = 0, variantIndex = 0) => {
    const { name, value, checked, type } = e.target;
    setNewItemData((prev) => {
      const updated = { ...prev };
      if (name === "type") updated.type = value;
      else if (name === "thickness") updated.thicknesses[0].thickness = value;
      else if (["length", "width", "sheetsPerBox", "origin"].includes(name)) {
        updated.thicknesses[0].variants[variantIndex][name] = value;
      } else if (type === "checkbox") {
        updated.thicknesses[0].variants[variantIndex][name] = checked;
      } else if (name === "itemName") {
        updated.itemName = value;
      } else if (name === "itemNumber") {
        updated.descriptions[index].itemNumber = value;
      } else if (["categoryName", "subCategory", "colorName", "designName"].includes(name)) {
        updated.descriptions[index][name] = value;
      }
      return updated;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;        // guard
    setSubmitting(true);

    // dedupe variants on the client just in case
    const rawVariants = newItemData.thicknesses[0].variants || [];
    const uniq = new Map();
    for (const v of rawVariants) {
      const key = [
        newItemData.type,
        v.length || 0,
        v.width || 0,
        v.sheetsPerBox || 0,
        (v.origin || "").trim().toLowerCase(),
      ].join("|");
      if ((v.origin || "").trim() !== "" && !uniq.has(key)) uniq.set(key, v);
    }

    const payload = {
      ...newItemData,
      thicknesses: [
        {
          thickness: newItemData.thicknesses[0].thickness,
          variants: Array.from(uniq.values()),
        },
      ],
    };

    try {
      const response = await fetch(`${baseUrl}/items/v1/full`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKeyRef.current,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        await refreshItems();
        setModalType("success");
        idemKeyRef.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      } else {
        setModalType("error");
      }
    } catch {
      setModalType("error");
    } finally {
      setModalContent(true);
      setShowModal(false);
      setSubmitting(false);
    }
  };

  const closeModal = () => setModalContent(false);

  // ============ Selection ============
  const toggleSelectRow = (rowKey) => {
    if (!rowKey) return;
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  };
  // 🔁 Flatten grouped search results (realDescription + variants[]) to simple rows,
// keeping RD on each row and applying the required sort order.
const flattenedSearchRows = useMemo(() => {
  const groups = Array.isArray(searchResults) ? searchResults : [];
  // Build [ { ...variant, description: {...rd} } ] for every variant in every group
  const rows = [];
  for (const g of groups) {
    const rd = g?.realDescription || g?.description || {};
    const vars = Array.isArray(g?.variants) ? g.variants : [];
    // sort inside the group by thickness asc, then length asc
    const sortedVars = [...vars].sort((a, b) => {
      const ta = Number(a?.thickness ?? 0);
      const tb = Number(b?.thickness ?? 0);
      if (ta !== tb) return ta - tb;
      return Number(a?.length ?? 0) - Number(b?.length ?? 0);
    });

    for (const v of sortedVars) {
      rows.push({
        ...v,
        // normalize names expected by the renderer / key maker
        variantId: Number(v?.variantId ?? v?.id),
        itemId: Number(v?.itemId),
        thicknessId: Number(v?.thicknessId),
        thickness: v?.thickness,
        itemName: v?.itemName,
        type: v?.type,
        length: v?.length,
        width: v?.width,
        sheetsPerBox: v?.sheetsPerBox,
        origin: v?.origin,
        // keep RD on each row under .description (your table already reads this)
        description: rd,
      });
    }
  }

  // sort groups by sortIndexRealDescription asc (NULLS LAST)
  rows.sort((a, b) => {
    const ai = Number(a?.description?.sortIndexRealDescription);
    const bi = Number(b?.description?.sortIndexRealDescription);
    const aNull = Number.isNaN(ai);
    const bNull = Number.isNaN(bi);
    if (aNull && !bNull) return 1;
    if (!aNull && bNull) return -1;
    if (!aNull && !bNull && ai !== bi) return ai - bi;

    // tie-breakers across group boundaries
    const ta = Number(a?.thickness ?? 0);
    const tb = Number(b?.thickness ?? 0);
    if (ta !== tb) return ta - tb;
    return Number(a?.length ?? 0) - Number(b?.length ?? 0);
  });

  return rows;
}, [searchResults]);


const visibleRowKeys = useMemo(() => {
  if (tokens.length > 0) {
    const rows = Array.isArray(flattenedSearchRows) ? flattenedSearchRows : [];
    return rows.map(makeKeyFromSearch);
  } else {
    // ✅ use flattenedListRows instead of walking legacy nesting only
    const rows = Array.isArray(flattenedListRows) ? flattenedListRows : [];
    return rows.map(makeKeyFromSearch);
  }
}, [tokens.length, flattenedSearchRows, flattenedListRows]);


  const allVisibleSelected =
    visibleRowKeys.length > 0 && visibleRowKeys.every((k) => selectedRowKeys.has(k));

  const toggleSelectAllVisible = () => {
    setSelectedRowKeys((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleRowKeys.forEach((k) => next.delete(k));
      } else {
        visibleRowKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // ============ Delete (PER VARIANT) ============
  const deleteVariantById = async (variantId) => {
    const key = (variantId ?? "").toString();
    if (!key) throw new Error("Invalid variant id");
    const res = await fetch(`${baseUrl}/items/variants/${encodeURIComponent(key)}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Delete failed for variant ${key}`);
  };

  const selectedVariantIds = useMemo(() => {
    const ids = Array.from(selectedRowKeys).map(getVariantIdFromKey).filter(Boolean);
    return Array.from(new Set(ids));
  }, [selectedRowKeys]);

  const deleteSelected = async () => {
    if (selectedVariantIds.length === 0) return;
    const confirm = window.confirm(`Delete ${selectedVariantIds.length} selected variant(s)?`);
    if (!confirm) return;

    try {
      for (const vid of selectedVariantIds) {
        await deleteVariantById(vid);
      }
      setSelectedRowKeys(new Set());
      if (tokens.length > 0) await runTokenSearch();
      else await refreshItems(); // reset to page 1
      setModalType("success");
      setModalContent(true);
    } catch (err) {
      console.error(err);
      setModalType("error");
      setModalContent(true);
    }
  };

  // ============ EDIT ============
  const getRowSnapshotByKey = (rowKey) => {
    const vid = getVariantIdFromKey(rowKey);
    const tid = getThicknessIdFromKey(rowKey);
    const iid = getItemIdFromKey(rowKey);
    if (!vid) return null;

if (tokens.length > 0) {
  const rows = Array.isArray(flattenedSearchRows) ? flattenedSearchRows : [];
  const found = rows.find((r) => String(r?.variantId) === String(vid));
  if (!found) return null;
  const d = found.description || {};
  return {
    variantId: Number(found.variantId),
    itemId: Number(found.itemId ?? iid),
    thicknessId: Number(found.thicknessId ?? tid),
    itemName: safe(found.itemName),
    type: safe(found.type),
    thickness: numOrEmpty(found.thickness),
    length: numOrEmpty(found.length),
    width: numOrEmpty(found.width),
    sheetsPerBox: numOrEmpty(found.sheetsPerBox),
    origin: safe(found.origin),
    descriptionId: d?.id ? Number(d.id) : null,
    itemNumber: safe(d.itemNumber),
    categoryName: safe(d.categoryName),
    subCategory: safe(d.subCategory),
    colorName: safe(d.colorName),
    designName: safe(d.designName),
  };


    } else {
  // ✅ Use the flattened non-search rows (works for grouped or legacy)
  const rows = Array.isArray(flattenedListRows) ? flattenedListRows : [];
  const found = rows.find((r) => String(r?.variantId) === String(vid));
  if (found) {
    const d = found.description || {};
    return {
      variantId: Number(found.variantId),
      itemId: Number(found.itemId ?? iid),
      thicknessId: Number(found.thicknessId ?? tid),
      itemName: safe(found.itemName),
      type: safe(found.type),
      thickness: numOrEmpty(found.thickness),
      length: numOrEmpty(found.length),
      width: numOrEmpty(found.width),
      sheetsPerBox: numOrEmpty(found.sheetsPerBox),
      origin: safe(found.origin),
      descriptionId: d?.id ? Number(d.id) : null,
      itemNumber: safe(d.itemNumber),
      categoryName: safe(d.categoryName),
      subCategory: safe(d.subCategory),
      colorName: safe(d.colorName),
      designName: safe(d.designName),
    };
  }

  // (Optional) ultra-legacy deep walk fallback:
  for (const item of items || []) {
    for (const thick of item?.thicknesses || []) {
      for (const v of thick?.variants || []) {
        if (String(v?.id) === String(vid)) {
          const d = v.realDescription || v.itemNameDescription || {};
          return {
            variantId: Number(v.id),
            itemId: Number(item.id ?? iid),
            thicknessId: Number(thick.id ?? tid),
            itemName: safe(item.itemName),
            type: safe(item.type),
            thickness: numOrEmpty(thick.thickness),
            length: numOrEmpty(v.length),
            width: numOrEmpty(v.width),
            sheetsPerBox: numOrEmpty(v.sheetsPerBox),
            origin: safe(v.origin),
            descriptionId: d?.id ? Number(d.id) : null,
            itemNumber: safe(d.itemNumber),
            categoryName: safe(d.categoryName),
            subCategory: safe(d.subCategory),
            colorName: safe(d.colorName),
            designName: safe(d.designName),
          };
        }
      }
    }
  }
}
    return null;
  };

  const openEditSelected = () => {
    if (selectedVariantIds.length !== 1) return;
    const onlyKey = Array.from(selectedRowKeys)[0];
    const snap = getRowSnapshotByKey(onlyKey);
    if (!snap) return;

    setEditVariantId(snap.variantId);
    setEditCtx({ itemId: Number(snap.itemId), thicknessId: Number(snap.thicknessId) });
    setEditForm({
      itemName: snap.itemName,
      type: snap.type,
      thickness: snap.thickness,
      length: snap.length,
      width: snap.width,
      sheetsPerBox: snap.sheetsPerBox,
      origin: snap.origin,
      descriptionId: snap.descriptionId ?? null,
      itemNumber: snap.itemNumber,
      categoryName: snap.categoryName,
      subCategory: snap.subCategory,
      colorName: snap.colorName,
      designName: snap.designName,
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditVariantId(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const resolveItemIdFromThicknessId = (thicknessId) => {
    const tid = Number(thicknessId);
    if (!Number.isFinite(tid)) return null;
    for (const item of items || []) {
      for (const th of item?.thicknesses || []) {
        if (Number(th.id) === tid) {
          return Number(item.id);
        }
      }
    }
    return null;
  };

  const buildEditPayload = () => {
    const v = { id: Number(editVariantId) };
    if (editForm.type !== "sqm") {
      if (editForm.length !== "") v.length = Number(editForm.length);
      if (editForm.width !== "") v.width = Number(editForm.width);
      if (editForm.type === "box" && editForm.sheetsPerBox !== "") {
        v.sheetsPerBox = Number(editForm.sheetsPerBox);
      }
      if (editForm.origin !== "") v.origin = String(editForm.origin).trim();
    }
    if (Number.isFinite(Number(editForm.descriptionId))) {
      v.description = { id: Number(editForm.descriptionId) };
    }
    const resolvedItemId = resolveItemIdFromThicknessId(editCtx.thicknessId);
    const finalItemId = Number.isFinite(resolvedItemId) ? resolvedItemId : Number(editCtx.itemId);
    return {
      itemId: Number(finalItemId),
      thicknesses: [{ thicknessId: Number(editCtx.thicknessId), variants: [v] }],
    };
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editVariantId || !editCtx.thicknessId) return;
    const payload = buildEditPayload();
    setLastSentPayload(payload);
    try {
      const res = await fetch(`${baseUrl}/items/v1/full`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Update failed");
      }
      if (tokens.length > 0) await runTokenSearch();
      else await refreshItems();
      setModalType("success");
      setModalContent(true);
      closeEdit();
    } catch (err) {
      console.error(err);
      setModalType("error");
      setModalContent(true);
    }
  };

  // ============ Render ============
  const inSearchMode = tokens.length > 0;

  return (
    <div className="items-creation-page">
      <h1>Items</h1>

      <div className="items-creation-search-bar-wrapper">
        <div className="items-creation-search-bar">
          <input
            type="text"
            placeholder="Type query (e.g., 5ملم, 225*321-027, ابيض) and press Enter"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="ar-rtl"
          />
          <button type="button" onClick={() => addToken(searchTerm)}>Add</button>
        </div>

        <div className="items-creation-token-bar">
          {tokens.map((t, idx) => (
            <span key={`tok-${idx}`} className="items-creation-chip">
              {t}
              <button
                className="items-creation-chip-remove"
                onClick={() => removeToken(idx)}
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))}
          {tokens.length > 0 && (
            <button className="items-creation-chip-clear" onClick={clearTokens}>
              Clear
            </button>
          )}
        </div>

        <button className="items-creation-new-item-button" onClick={handleModalToggle}>
          New Item
        </button>
      </div>

      {/* Table */}
      <div className="items-creation-table-wrapper">
        {/* 🔽 TOOLBAR */}
        <div className="items-creation-toolbar">
          <label className="items-creation-select-all">
            <input
              type="checkbox"
            checked={
  (inSearchMode ? flattenedSearchRows.length : flattenedListRows.length) > 0 &&
  visibleRowKeys.length > 0 &&
  visibleRowKeys.every((k) => selectedRowKeys.has(k))
}

              ref={(el) => {
                if (el) {
                  const all = visibleRowKeys.length > 0 && visibleRowKeys.every((k) => selectedRowKeys.has(k));
                  const none = visibleRowKeys.every((k) => !selectedRowKeys.has(k));
                  el.indeterminate = !all && !none;
                }
              }}
              onChange={toggleSelectAllVisible}
            />
            <span>Select all in view</span>
          </label>

          <button
            className="items-creation-edit-selected"
            disabled={selectedVariantIds.length !== 1}
            onClick={openEditSelected}
            title={selectedVariantIds.length !== 1 ? "Select exactly one row to edit" : "Edit selected"}
          >
            Edit Selected
          </button>

          <button
            className="items-creation-delete-selected"
            disabled={selectedVariantIds.length === 0}
            onClick={deleteSelected}
          >
            Delete Selected ({selectedVariantIds.length})
          </button>
        </div>

        <table className="items-creation-table">
          <thead>
            <tr>
              <th className="items-creation-col-select">Select</th>
              <th>Item #</th>
              <th>Category</th>
              <th>Subcategory</th>
              <th>Color</th>
              <th>Design</th>
              <th>Item Name</th>
              <th>Type</th>
              <th>Length(cm)</th>
              <th>Width(cm)</th>
              <th>Sheets/Box</th>
              <th>Origin</th>
            </tr>
          </thead>

<tbody>
  {inSearchMode
    ? (flattenedSearchRows || []).map((r) => {
        const d = r.description || {};
        const rowKey = makeKeyFromSearch(r);
        const checked = selectedRowKeys.has(rowKey);
        return (
          <tr key={rowKey}>
            <td className="items-creation-col-select">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSelectRow(rowKey)}
                aria-label={`select row ${rowKey}`}
              />
            </td>
            <td>{d.itemNumber ?? "—"}</td>
            <td className="ar-rtl">{d.categoryName ?? "—"}</td>
            <td className="ar-rtl">{d.subCategory ?? "—"}</td>
            <td className="ar-rtl">{d.colorName ?? "—"}</td>
            <td className="ar-rtl">{d.designName ?? "—"}</td>
            <td className="ar-rtl">{`${r.thickness ?? ""} ملم ${r.itemName ?? ""}`}</td>
            <td>{r.type ?? "—"}</td>
            {r.type === "sqm" ? (
              <>
                <td>—</td><td>—</td>
              </>
            ) : (
              <>
                <td className="ltr">{r.length ?? "—"}</td>
                <td className="ltr">{r.width ?? "—"}</td>
              </>
            )}
            <td className="ltr">{r.type === "box" ? (r.sheetsPerBox ?? "—") : "—"}</td>
            <td className="ar-rtl">{r.origin ?? "—"}</td>
          </tr>
        );
      })
    : (flattenedListRows || []).map((r) => {
        const d = r.description || {};
        const rowKey = makeKeyFromSearch(r);
        const checked = selectedRowKeys.has(rowKey);
        return (
          <tr key={rowKey}>
            <td className="items-creation-col-select">
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSelectRow(rowKey)}
                aria-label={`select row ${rowKey}`}
              />
            </td>
            <td>{d.itemNumber ?? "—"}</td>
            <td className="ar-rtl">{d.categoryName ?? "—"}</td>
            <td className="ar-rtl">{d.subCategory ?? "—"}</td>
            <td className="ar-rtl">{d.colorName ?? "—"}</td>
            <td className="ar-rtl">{d.designName ?? "—"}</td>
            <td className="ar-rtl">{`${r.thickness ?? ""} ملم ${r.itemName ?? ""}`}</td>
            <td>{r.type ?? "—"}</td>
            {r.type === "sqm" ? (
              <>
                <td>—</td><td>—</td>
              </>
            ) : (
              <>
                <td className="ltr">{r.length ?? "—"}</td>
                <td className="ltr">{r.width ?? "—"}</td>
              </>
            )}
            <td className="ltr">{r.type === "box" ? (r.sheetsPerBox ?? "—") : "—"}</td>
            <td className="ar-rtl">{r.origin ?? "—"}</td>
          </tr>
        );
      })}
</tbody>

        </table>

        {/* Search results counter */}
        {inSearchMode && (
          <div style={{ padding: "8px 0", fontSize: 12, opacity: 0.75 }}>
            {searching ? "Searching…" : `Showing ${searchResults?.length ?? 0} results`}
          </div>
        )}

        {/* Load more footer — NON-SEARCH mode */}
        {!inSearchMode && (
          <div className="items-creation-loadmore-wrapper">
            {hasMoreItems ? (
              <button
                type="button"
                className="items-creation-loadmore-btn"
                onClick={() => {
                  console.log("[UI] Load more clicked");
                  loadMoreItems();
                }}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <button type="button" className="items-creation-loadmore-btn" disabled>
                All items loaded {Number.isFinite(totalItems) ? `(${items.length}/${totalItems})` : `(${items.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className="items-creation-modal">
          <div className="items-creation-modal-content">
            <h2>Create New Item</h2>
            <form onSubmit={handleFormSubmit} className="items-creation-form-grid">
              <label>
                Item Name:
                <input
                  ref={refItemName}
                  type="text"
                  name="itemName"
                  value={newItemData.itemName}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refItemName)}
                  className="ar-rtl"
                  required
                />
              </label>

              <label>
                Type:
                <select
                  ref={refType}
                  name="type"
                  value={newItemData.type}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refType)}
                >
                  <option value="box">Box</option>
                  <option value="sheet">Sheet</option>
                  <option value="sqm">SQM</option>
                </select>
              </label>

              <label>
                Item Number:
                <input
                  ref={refItemNumber}
                  type="text"
                  name="itemNumber"
                  value={newItemData.descriptions[0].itemNumber}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refItemNumber)}
                  className="ltr"
                  required
                />
              </label>

              <label>
                Design:
                <input
                  ref={refDesignName}
                  type="text"
                  name="designName"
                  value={newItemData.descriptions[0].designName}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refDesignName)}
                  className="ar-rtl"
                />
              </label>

              <label>
                Thickness (mm):
                <input
                  ref={refThickness}
                  type="number"
                  name="thickness"
                  value={newItemData.thicknesses[0].thickness}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refThickness)}
                  className="ltr"
                  required
                />
              </label>

              {newItemData.type !== "sqm" && (
                <>
                  <label>
                    Length (cm):
                    <input
                      ref={refLength}
                      type="number"
                      name="length"
                      value={newItemData.thicknesses[0].variants[0].length}
                      onChange={handleInputChange}
                      onKeyDown={(e) => onEnterFocusNext(e, refLength)}
                      className="ltr"
                    />
                  </label>
                  <label>
                    Width (cm):
                    <input
                      ref={refWidth}
                      type="number"
                      name="width"
                      value={newItemData.thicknesses[0].variants[0].width}
                      onChange={handleInputChange}
                      onKeyDown={(e) => onEnterFocusNext(e, refWidth)}
                      className="ltr"
                    />
                  </label>
                </>
              )}

              {newItemData.type === "box" && (
                <label>
                  Sheets Per Box:
                  <input
                    ref={refSheetsPerBox}
                    type="number"
                    name="sheetsPerBox"
                    value={newItemData.thicknesses[0].variants[0].sheetsPerBox}
                    onChange={handleInputChange}
                    onKeyDown={(e) => onEnterFocusNext(e, refSheetsPerBox)}
                    className="ltr"
                    required
                  />
                </label>
              )}

              <label>
                Origin:
                <input
                  ref={refOrigin}
                  type="text"
                  name="origin"
                  value={newItemData.thicknesses[0].variants[0].origin}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refOrigin)}
                  className="ar-rtl"
                  required
                />
              </label>

              <label>
                Color:
                <input
                  ref={refColorName}
                  type="text"
                  name="colorName"
                  value={newItemData.descriptions[0].colorName}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refColorName)}
                  className="ar-rtl"
                />
              </label>

              <label>
                Category:
                <input
                  ref={refCategoryName}
                  type="text"
                  name="categoryName"
                  value={newItemData.descriptions[0].categoryName}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refCategoryName)}
                  className="ar-rtl"
                />
              </label>

              <label>
                Subcategory:
                <input
                  ref={refSubCategory}
                  type="text"
                  name="subCategory"
                  value={newItemData.descriptions[0].subCategory}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refSubCategory)}
                  className="ar-rtl"
                />
              </label>

              <div className="items-creation-button-row">
                <button ref={refSubmit} type="submit" disabled={submitting}>
                  {submitting ? "Creating…" : "Create Item"}
                </button>
                <button type="button" onClick={handleModalToggle}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT VARIANT MODAL */}
      {editOpen && (
        <div className="items-creation-modal">
          <div className="items-creation-modal-content">
            <h2>Edit Variant</h2>

            {/* Read-only context */}
            <div style={{ marginBottom: 12, opacity: 0.85, fontSize: 14 }}>
              <div className="ar-rtl">
                <b>الاسم:</b> {editForm.itemName}
              </div>
              <div>
                <b>Type:</b> {editForm.type} &nbsp;|&nbsp; <b>Thickness:</b> {editForm.thickness}
              </div>
              <div className="ar-rtl">
                <b>الوصف:</b>{" "}
                {[
                  editForm.itemNumber,
                  editForm.categoryName,
                  editForm.subCategory,
                  editForm.colorName,
                  editForm.designName,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </div>
            </div>

            <form
              onSubmit={saveEdit}
              className="items-creation-form-grid"
              style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
            >
              <label>
                Length (cm):
                <input
                  type="number"
                  name="length"
                  value={editForm.length}
                  onChange={handleEditChange}
                  className="ltr"
                  disabled={editForm.type === "sqm"}
                />
              </label>

              <label>
                Width (cm):
                <input
                  type="number"
                  name="width"
                  value={editForm.width}
                  onChange={handleEditChange}
                  className="ltr"
                  disabled={editForm.type === "sqm"}
                />
              </label>

              <label>
                Sheets/Box:
                <input
                  type="number"
                  name="sheetsPerBox"
                  value={editForm.sheetsPerBox}
                  onChange={handleEditChange}
                  className="ltr"
                  disabled={editForm.type === "sheet" || editForm.type === "sqm"}
                />
              </label>

              <label>
                Origin:
                <input
                  type="text"
                  name="origin"
                  value={editForm.origin}
                  onChange={handleEditChange}
                  className="ar-rtl"
                  disabled={editForm.type === "sqm"}
                />
              </label>

              <div className="items-creation-button-row" style={{ gridColumn: "1 / -1" }}>
                <button type="submit">Save</button>
                <button type="button" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status modal */}
      {modalContent && (
        <div className="items-creation-modal">
          <div
            className={`items-creation-modal-status-content ${
              modalType === "success" ? "items-creation-success-modal" : "items-creation-error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="items-creation-modal-success-text">Action Completed</h2>
                <div className="items-creation-modal-icon">✔</div>
              </>
            ) : (
              <>
                <h2 className="items-creation-modal-error-text">Action Failed</h2>
                <div className="items-creation-modal-icon">✖</div>
              </>
            )}
            <button className="items-creation-modal-button" onClick={closeModal}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UniqueItemsPage;
