// UniqueItemsPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import "./items.css";
import { axiosClient, getUploadsBaseUrl } from "../api/axiosClient"; // ✅ added

const PAGE_SIZE = 50;

// defaults for stock-mode
const defaultStockModeForType = (t) => {
  if (t === "unit") return "QTY";
  if (t === "sqm") return "SQM";
  // glass items typically are SQM-driven even if type is box/sheet in your business
  return "SQM";
};

const normalizeVariantForType = (type, v) => {
  const t = String(type || "").toLowerCase();

  const base = {
    length: v?.length ?? "",
    width: v?.width ?? "",
    sheetsPerBox: v?.sheetsPerBox ?? "",
    origin: v?.origin ?? "",
    fixBox: !!v?.fixBox,
    fixLength: !!v?.fixLength,
    fixWidth: !!v?.fixWidth,
  };

  if (t === "sqm") {
    return {
      ...base,
      length: 0,
      width: 0,
      sheetsPerBox: 0,
      origin: "",
    };
  }

  if (t === "unit") {
    // satisfy NOT NULL columns on backend (length/width/spb/origin)
    const o = String(base.origin || "").trim();
    return {
      ...base,
      length: 0,
      width: 0,
      sheetsPerBox: 1,
      origin: o || "", // avoid empty origin
    };
  }

  // box/sheet
  return {
    ...base,
    length: base.length === "" ? "" : Number(base.length),
    width: base.width === "" ? "" : Number(base.width),
    sheetsPerBox: base.sheetsPerBox === "" ? "" : Number(base.sheetsPerBox),
    origin: String(base.origin || "").trim(),
  };
};

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
  stockMode: "",
  thickness: "", // ✅ Now editable
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

  // Product description + picture (separate from the main edit form/payload above,
  // saved through their own small endpoints so they never touch the fragile
  // createFullItem/editFullItem whitelisted-payload pipeline).
  const [productInfo, setProductInfo] = useState({ productDescription: "", pictureUrl: "" });
  const [productInfoLoading, setProductInfoLoading] = useState(false);
  const [productInfoSaving, setProductInfoSaving] = useState(false);
  const [pictureUploading, setPictureUploading] = useState(false);
  const [productInfoMsg, setProductInfoMsg] = useState("");

  // Photo/description preview popup for a row in the main table
  const [previewInfo, setPreviewInfo] = useState(null);

  // which description mode drives list/edit/create/search APIs
  const [descMode, setDescMode] = useState("real"); // 'real' | 'name'

  // ✅ FIX: Endpoints are RELATIVE (do NOT include /api here)
  const endpoints = useMemo(() => {
    return {
      list: {
        real: (page, limit) =>
          `/items/v1/filtered-items?page=${page}&limit=${limit}`,
        name: (page, limit) =>
          `/items/selected-details/by-description?page=${page}&limit=${limit}`,
      },
      search: {
        real: `/items/v1/search-real`,
        name: `/items/v1/search`,
      },
      edit: {
        real: `/items/v1/full`,
        name: `/items/v1/full`,
      },
      create: {
        real: `/items/v1/full/real`,
        name: `/items/v1/full`,
      },
    };
  }, []);

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

  // 🔁 Flatten non-search items for grouped ("realDescription" or "itemNameDescription") OR legacy ("thicknesses")
  const flattenedListRows = useMemo(() => {
    const arr = Array.isArray(items) ? items : [];
    const out = [];

    for (const entry of arr) {
      const groupDesc = entry?.realDescription || entry?.itemNameDescription;
      if (groupDesc && Array.isArray(entry?.variants)) {
        const desc = groupDesc;
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
            stockMode: v?.stockMode ?? entry?.stockMode ?? null, // ✅ NEW
            length: v?.length,
            width: v?.width,
            sheetsPerBox: v?.sheetsPerBox,
            origin: v?.origin,
            description: desc,
          });
        }
        continue;
      }

      // LEGACY SHAPE
      const itemName = entry?.itemName ?? "";
      const type = entry?.type ?? "";
      const stockMode = entry?.stockMode ?? null; // ✅ NEW
      const ths = Array.isArray(entry?.thicknesses) ? entry.thicknesses : [];
      for (const th of ths) {
        const tval = th?.thickness;
        const tid = th?.id;
        const vars = Array.isArray(th?.variants) ? th.variants : [];
        for (const v of vars) {
          const rdOrName = v?.realDescription || v?.itemNameDescription || {};
          out.push({
            variantId: Number(v?.id),
            itemId: Number(entry?.id),
            thicknessId: Number(tid),
            thickness: tval,
            itemName,
            type,
            stockMode, // ✅ NEW
            length: v?.length,
            width: v?.width,
            sheetsPerBox: v?.sheetsPerBox,
            origin: v?.origin,
            productDescription: v?.productDescription ?? null,
            pictureUrl: v?.pictureUrl ?? null,
            description: rdOrName,
          });
        }
      }
    }

    out.sort((a, b) => {
      const ai = Number(
        a?.description?.sortIndexRealDescription ??
          a?.description?.sortIndexDescription
      );
      const bi = Number(
        b?.description?.sortIndexRealDescription ??
          b?.description?.sortIndexDescription
      );
      const aNull = Number.isNaN(ai);
      const bNull = Number.isNaN(bi);
      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;
      if (!aNull && !bNull && ai !== bi) return ai - bi;

      const ta = Number(a?.thickness ?? 0);
      const tb = Number(b?.thickness ?? 0);
      if (ta !== tb) return ta - tb;
      return Number(a?.length ?? 0) - Number(b?.length ?? 0);
    });

    return out;
  }, [items]);

  // ============ Suggestion-aware Enter ============
  const shouldLetBrowserHandleEnter = (e) => {
    const t = e.target;
    if (e.nativeEvent?.isComposing) return true;
    if (t && t.tagName === "SELECT") return true;
    if (t instanceof HTMLInputElement && t.getAttribute("list")) return true;
    if (t?.getAttribute?.("aria-activedescendant")) return true;
    if (document.querySelector('[role="listbox"][aria-expanded="true"]'))
      return true;
    if (
      document.querySelector(
        ".MuiAutocomplete-popper, .autocomplete-popper, .autocomplete-panel"
      )
    )
      return true;
    if (
      document.querySelector(
        '[data-autocomplete="open"], .typeahead-open, .awesomplete ul[hidden="false"]'
      )
    )
      return true;
    return false;
  };

  // ============ Create modal refs ============
  const refItemName = useRef(null);
  const refType = useRef(null);
  const refStockMode = useRef(null); // ✅ NEW
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
  const idemKeyRef = useRef(
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  // Description + picture collected at creation time — saved as a follow-up
  // to the new variant right after it's created (see handleFormSubmit).
  const [newItemDescription, setNewItemDescription] = useState("");
  const [newItemPicture, setNewItemPicture] = useState(null);

  // initial state
  const [newItemData, setNewItemData] = useState({
    itemName: "",
    type: "box",
    stockMode: "SQM", // ✅ NEW
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
        ],
      },
    ],
  });

  // ============ Fetch helpers ============
  const normalizeItems = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload?.data?.variants))
      return payload.data.variants;
    return [];
  };

  // get page 1 and REPLACE
  const refreshItems = async () => {
    try {
      const url = endpoints.list[descMode](1, PAGE_SIZE);
      const res = await axiosClient.get(url);
      const json = res?.data ?? null;

      const arr = normalizeItems(json);
      setItems(arr);
      setItemsPage(1);

      setHasMoreItems(Boolean(json?.hasMore));
      setTotalItems(
        Number.isFinite(Number(json?.totalGroups ?? json?.total))
          ? Number(json.totalGroups ?? json.total)
          : null
      );
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
    if (loadingMore || !hasMoreItems) return;

    setLoadingMore(true);
    const nextPage = itemsPage + 1;
    try {
      const url = endpoints.list[descMode](nextPage, PAGE_SIZE);
      const res = await axiosClient.get(url);
      const json = res?.data ?? null;

      const arr = normalizeItems(json);

      setItems((prev) => [...prev, ...arr]);
      setItemsPage(nextPage);

      setHasMoreItems(Boolean(json?.hasMore));
      setTotalItems(
        Number.isFinite(Number(json?.totalGroups ?? json?.total))
          ? Number(json.totalGroups ?? json.total)
          : totalItems
      );
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
  }, [descMode]);

  // ============ Tokenized search ============
  const queryString = useMemo(() => tokens.join(" ").trim(), [tokens]);

  const runTokenSearch = async () => {
    if (!queryString) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const base = endpoints.search[descMode];
      const url = `${base}?q=${encodeURIComponent(queryString)}&limit=200`;

      const res = await axiosClient.get(url);
      const json = res?.data ?? null;

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
  }, [queryString, descMode]);

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
    const base = [
      refItemName,
      refType,
      refStockMode, // ✅ NEW
      refItemNumber,
      refDesignName,
      refThickness,
    ];

    // unit + sqm hide dims
    if (t !== "sqm" && t !== "unit") base.push(refLength, refWidth);
    if (t === "box") base.push(refSheetsPerBox);

    // keep origin for unit too (optional, but present)
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
      stockMode: "SQM", // ✅ NEW
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
          ],
        },
      ],
    });
    setNewItemDescription("");
    setNewItemPicture(null);
  };

  const handleInputChange = (e, index = 0, variantIndex = 0) => {
    const { name, value, checked, type } = e.target;
    setNewItemData((prev) => {
      const updated = { ...prev };
      const prevType = updated.type;

      if (name === "type") {
        updated.type = value;

        // ✅ auto-adjust stockMode if the user didn't customize it
        const prevDefault = defaultStockModeForType(prevType);
        const nextDefault = defaultStockModeForType(value);
        if (String(updated.stockMode || "") === String(prevDefault)) {
          updated.stockMode = nextDefault;
        }
      } else if (name === "stockMode") {
        updated.stockMode = value;
      } else if (name === "thickness") {
        updated.thicknesses[0].thickness = value;
      } else if (["length", "width", "sheetsPerBox", "origin"].includes(name)) {
        updated.thicknesses[0].variants[variantIndex][name] = value;
      } else if (type === "checkbox") {
        updated.thicknesses[0].variants[variantIndex][name] = checked;
      } else if (name === "itemName") {
        updated.itemName = value;
      } else if (name === "itemNumber") {
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

  // CREATE — choose API based on toggle (descMode)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    // normalize variants (unit/sqm get forced values)
    const rawVariants = newItemData.thicknesses[0].variants || [];
    const normalized = rawVariants.map((v) =>
      normalizeVariantForType(newItemData.type, v)
    );

    // dedupe variants on the client
    const uniq = new Map();
    for (const v of normalized) {
      const key = [
        newItemData.type,
        Number(v.length || 0),
        Number(v.width || 0),
        Number(v.sheetsPerBox || 0),
        String(v.origin || "").trim().toLowerCase(),
      ].join("|");

      // for SQM, origin is "", still ok: keep first
      if (!uniq.has(key)) uniq.set(key, v);
    }

    const payload = {
      ...newItemData,
      stockMode: newItemData.stockMode, // ✅ NEW
      thicknesses: [
        {
          thickness: newItemData.thicknesses[0].thickness,
          variants: Array.from(uniq.values()),
        },
      ],
    };

    try {
      const url = endpoints.create[descMode];

      const res = await axiosClient.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKeyRef.current,
        },
      });

      // Best-effort: attach the description/picture entered above to the
      // variant that was just created. Doesn't affect the main success/error
      // result — the item itself is already created either way.
      if (newItemDescription.trim() || newItemPicture) {
        const variants = res?.data?.thicknesses?.[0]?.variants || [];
        const newVariant = variants.reduce(
          (best, v) => (!best || Number(v.id) > Number(best.id) ? v : best),
          null,
        );
        const newVariantId = newVariant?.id;
        if (newVariantId) {
          try {
            if (newItemDescription.trim()) {
              await axiosClient.patch(`/items/v1/variants/${newVariantId}/product-info`, {
                productDescription: newItemDescription.trim(),
              });
            }
            if (newItemPicture) {
              const formData = new FormData();
              formData.append("file", newItemPicture);
              await axiosClient.post(`/items/v1/variants/${newVariantId}/picture`, formData, {
                headers: { "Content-Type": "multipart/form-data" },
              });
            }
          } catch (attachErr) {
            console.warn("Item created, but saving description/picture failed:", attachErr);
          }
        }
      }

      await refreshItems();
      setModalType("success");
      idemKeyRef.current = `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;
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

  // 🔁 Works with BOTH grouped results and flat row results
  const flattenedSearchRows = useMemo(() => {
    const groupsOrRows = Array.isArray(searchResults) ? searchResults : [];
    const rows = [];

    for (const g of groupsOrRows) {
      const hasVariantsArray = Array.isArray(g?.variants);

      if (hasVariantsArray) {
        // GROUPED SHAPE
        const rd =
          g?.realDescription || g?.itemNameDescription || g?.description || {};
        const vars = g.variants || [];
        const sortedVars = [...vars].sort((a, b) => {
          const ta = Number(a?.thickness ?? 0);
          const tb = Number(b?.thickness ?? 0);
          if (ta !== tb) return ta - tb;
          return Number(a?.length ?? 0) - Number(b?.length ?? 0);
        });

        for (const v of sortedVars) {
          rows.push({
            ...v,
            variantId: Number(v?.variantId ?? v?.id),
            itemId: Number(v?.itemId),
            thicknessId: Number(v?.thicknessId),
            thickness: v?.thickness,
            itemName: v?.itemName,
            type: v?.type,
            stockMode: v?.stockMode ?? g?.stockMode ?? null, // ✅ NEW
            length: v?.length,
            width: v?.width,
            sheetsPerBox: v?.sheetsPerBox,
            origin: v?.origin,
            description: rd,
          });
        }
      } else {
        // FLAT ROW SHAPE
        const rd =
          g?.realDescription || g?.itemNameDescription || g?.description || {};
        rows.push({
          variantId: Number(g?.variantId ?? g?.id),
          itemId: Number(g?.itemId),
          thicknessId: Number(g?.thicknessId),
          thickness: Number(g?.thickness),
          itemName: g?.itemName,
          type: g?.type,
          stockMode: g?.stockMode ?? null, // ✅ NEW
          length: Number(g?.length ?? 0),
          width: Number(g?.width ?? 0),
          sheetsPerBox: Number(g?.sheetsPerBox ?? 0),
          origin: g?.origin ?? "",
          productDescription: g?.productDescription ?? null,
          pictureUrl: g?.pictureUrl ?? null,
          description: rd,
        });
      }
    }

    rows.sort((a, b) => {
      const ai = Number(
        a?.description?.sortIndexRealDescription ??
          a?.description?.sortIndexDescription
      );
      const bi = Number(
        b?.description?.sortIndexRealDescription ??
          b?.description?.sortIndexDescription
      );
      const aNull = Number.isNaN(ai);
      const bNull = Number.isNaN(bi);
      if (aNull && !bNull) return 1;
      if (!aNull && bNull) return -1;
      if (!aNull && !bNull && ai !== bi) return ai - bi;

      const ta = Number(a?.thickness ?? 0);
      const tb = Number(b?.thickness ?? 0);
      if (ta !== tb) return ta - tb;
      return Number(a?.length ?? 0) - Number(b?.length ?? 0);
    });

    return rows;
  }, [searchResults]);

  const visibleRowKeys = useMemo(() => {
    if (tokens.length > 0) {
      const rows = Array.isArray(flattenedSearchRows)
        ? flattenedSearchRows
        : [];
      return rows.map(makeKeyFromSearch);
    } else {
      const rows = Array.isArray(flattenedListRows)
        ? flattenedListRows
        : [];
      return rows.map(makeKeyFromSearch);
    }
  }, [tokens.length, flattenedSearchRows, flattenedListRows]);

  const allVisibleSelected =
    visibleRowKeys.length > 0 &&
    visibleRowKeys.every((k) => selectedRowKeys.has(k));

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

    // ✅ FIX: relative URL (no baseUrl, no /api here)
    await axiosClient.delete(`/items/variants/${encodeURIComponent(key)}`);
  };

  const selectedVariantIds = useMemo(() => {
    const ids = Array.from(selectedRowKeys)
      .map(getVariantIdFromKey)
      .filter(Boolean);
    return Array.from(new Set(ids));
  }, [selectedRowKeys]);

  const deleteSelected = async () => {
    if (selectedVariantIds.length === 0) return;
    const confirm = window.confirm(
      `Delete ${selectedVariantIds.length} selected variant(s)?`
    );
    if (!confirm) return;

    try {
      for (const vid of selectedVariantIds) {
        await deleteVariantById(vid);
      }
      setSelectedRowKeys(new Set());
      if (tokens.length > 0) await runTokenSearch();
      else await refreshItems();
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

    const pick = (found) => {
      const d = found.description || {};
      const t = safe(found.type);
      return {
        variantId: Number(found.variantId),
        itemId: Number(found.itemId ?? iid),
        thicknessId: Number(found.thicknessId ?? tid),
        itemName: safe(found.itemName),
        type: t,
        stockMode: safe(found.stockMode) || defaultStockModeForType(t), // ✅ NEW
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
    };

    if (tokens.length > 0) {
      const rows = Array.isArray(flattenedSearchRows)
        ? flattenedSearchRows
        : [];
      const found = rows.find((r) => String(r?.variantId) === String(vid));
      if (!found) return null;
      return pick(found);
    } else {
      const rows = Array.isArray(flattenedListRows)
        ? flattenedListRows
        : [];
      const found = rows.find((r) => String(r?.variantId) === String(vid));
      if (found) return pick(found);

      for (const item of items || []) {
        for (const thick of item?.thicknesses || []) {
          for (const v of thick?.variants || []) {
            if (String(v?.id) === String(vid)) {
              const d = v.realDescription || v.itemNameDescription || {};
              const t = safe(item.type);
              return {
                variantId: Number(v.id),
                itemId: Number(item.id ?? iid),
                thicknessId: Number(thick.id ?? tid),
                itemName: safe(item.itemName),
                type: t,
                stockMode: safe(item.stockMode) || defaultStockModeForType(t), // ✅ NEW
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
  setEditCtx({
    itemId: Number(snap.itemId),
    thicknessId: Number(snap.thicknessId),
  });
  setEditForm({
    itemName: snap.itemName, 
    type: snap.type,
    stockMode: snap.stockMode,
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

  setProductInfoMsg("");
  setProductInfo({ productDescription: "", pictureUrl: "" });
  setProductInfoLoading(true);
  axiosClient
    .get(`/items/v1/variants/${snap.variantId}/product-info`)
    .then((res) => {
      setProductInfo({
        productDescription: res.data?.productDescription || "",
        pictureUrl: res.data?.pictureUrl || "",
      });
    })
    .catch(() => {})
    .finally(() => setProductInfoLoading(false));
};

  const closeEdit = () => {
    setEditOpen(false);
    setEditVariantId(null);
  };

  const saveProductDescription = async () => {
    if (!editVariantId) return;
    setProductInfoSaving(true);
    setProductInfoMsg("");
    try {
      await axiosClient.patch(`/items/v1/variants/${editVariantId}/product-info`, {
        productDescription: productInfo.productDescription || null,
      });
      setProductInfoMsg("Description saved.");
    } catch (err) {
      setProductInfoMsg(err?.response?.data?.message || "Failed to save description.");
    } finally {
      setProductInfoSaving(false);
    }
  };

  const uploadVariantPicture = async (file) => {
    if (!editVariantId || !file) return;
    setPictureUploading(true);
    setProductInfoMsg("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axiosClient.post(
        `/items/v1/variants/${editVariantId}/picture`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      setProductInfo((prev) => ({ ...prev, pictureUrl: res.data?.pictureUrl || prev.pictureUrl }));
      setProductInfoMsg("Picture uploaded.");
    } catch (err) {
      setProductInfoMsg(err?.response?.data?.message || "Failed to upload picture.");
    } finally {
      setPictureUploading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "type") {
        // keep stockMode sensible unless user customized
        const prevDefault = defaultStockModeForType(prev.type);
        const nextDefault = defaultStockModeForType(value);
        if (String(prev.stockMode || "") === String(prevDefault)) {
          next.stockMode = nextDefault;
        }
      }
      return next;
    });
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

  // Build payload for editFullItem API
const buildEditPayload = () => {
  const t = String(editForm.type || "").toLowerCase();
  const v = { id: Number(editVariantId) };

  if (t !== "sqm" && t !== "unit") {
    if (editForm.length !== "") v.length = Number(editForm.length);
    if (editForm.width !== "") v.width = Number(editForm.width);
    if (t === "box" && editForm.sheetsPerBox !== "") {
      v.sheetsPerBox = Number(editForm.sheetsPerBox);
    }
    if (editForm.origin !== "") v.origin = String(editForm.origin).trim();
  } else {
    if (t === "unit" && editForm.origin !== "") {
      v.origin = String(editForm.origin).trim();
    }
  }

  if (Number.isFinite(Number(editForm.descriptionId))) {
    if (descMode === "name") {
      v.description = { id: Number(editForm.descriptionId) };
    } else {
      v.realDescription = { id: Number(editForm.descriptionId) };
    }
  }

  const resolvedItemId = resolveItemIdFromThicknessId(editCtx.thicknessId);
  const finalItemId = Number.isFinite(resolvedItemId)
    ? resolvedItemId
    : Number(editCtx.itemId);

  const payload = {
    itemId: Number(finalItemId),
    itemName: editForm.itemName, // ✅ Now sent to backend
    type: editForm.type,
    stockMode: editForm.stockMode || undefined,
    thicknesses: [
      {
        thicknessId: Number(editCtx.thicknessId),
        thickness: Number(editForm.thickness), // ✅ Now sent to backend
        variants: [v],
      },
    ],
  };

  if (!payload.stockMode) delete payload.stockMode;

  return payload;
};

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!editVariantId || !editCtx.thicknessId) return;
    const payload = buildEditPayload();
    setLastSentPayload(payload);
    try {
      const url = endpoints.edit[descMode]; // PUT /items/v1/full
      await axiosClient.put(url, payload, {
        headers: { "Content-Type": "application/json" },
      });

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
      {/* Header */}
      <div className="items-creation-header">
        <div className="items-creation-header-row">
          <h1 className="items-creation-title">Items</h1>

          <div className="items-creation-actions">
            <div className="items-creation-mode-toggle">
              <label className="toggle-pill" title="Switch grouping mode">
                <input
                  type="checkbox"
                  checked={descMode === "real"}
                  onChange={(e) =>
                    setDescMode(e.target.checked ? "real" : "name")
                  }
                />
                <span className="pill">
                  {descMode === "real"
                    ? "Real Description"
                    : "Item Name Description"}
                </span>
              </label>
            </div>

            <button
              className="items-creation-new-item-button"
              onClick={handleModalToggle}
            >
              + New Item
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="items-creation-search-wrap">
          <div className="items-creation-search-bar">
            <input
              type="text"
              placeholder="Search (e.g., 5ملم, 225*321-027, ابيض) • Press Enter to add"
              value={searchTerm}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              className="ar-rtl"
              aria-label="Search items"
            />
            <button
              type="button"
              onClick={() => addToken(searchTerm)}
              aria-label="Add search token"
            >
              Add
            </button>
          </div>

          <div className="items-creation-token-row">
            <div className="items-creation-token-bar">
              {tokens.map((t, idx) => (
                <span key={`tok-${idx}`} className="items-creation-chip">
                  {t}
                  <button
                    className="items-creation-chip-remove"
                    onClick={() => removeToken(idx)}
                    aria-label={`remove token ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {tokens.length > 0 && (
              <button
                className="items-creation-chip-clear"
                onClick={clearTokens}
                aria-label="Clear tokens"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="items-creation-table-wrapper">
        {/* Toolbar */}
        <div className="items-creation-toolbar">
          <label className="items-creation-select-all">
            <input
              type="checkbox"
              checked={
                (inSearchMode
                  ? flattenedSearchRows.length
                  : flattenedListRows.length) > 0 &&
                visibleRowKeys.length > 0 &&
                visibleRowKeys.every((k) => selectedRowKeys.has(k))
              }
              ref={(el) => {
                if (el) {
                  const all =
                    visibleRowKeys.length > 0 &&
                    visibleRowKeys.every((k) => selectedRowKeys.has(k));
                  const none = visibleRowKeys.every(
                    (k) => !selectedRowKeys.has(k)
                  );
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
            title={
              selectedVariantIds.length !== 1
                ? "Select exactly one row to edit"
                : "Edit selected"
            }
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

          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.75 }}>
            Mode:{" "}
            {descMode === "real"
              ? "Real Description"
              : "Item Name Description"}
          </div>
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
              <th>Photo</th>
            </tr>
          </thead>

          <tbody>
            {(inSearchMode ? flattenedSearchRows : flattenedListRows || []).map(
              (r) => {
                const d = r.description || {};
                const rowKey = makeKeyFromSearch(r);
                const checked = selectedRowKeys.has(rowKey);
                const t = String(r.type || "");

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
                    <td className="ar-rtl">
                      {String(r.type || "").toLowerCase() === "unit" ||
                      String(r.type || "").toLowerCase() === "sqm"
                        ? (r.itemName ?? "—")
                        : `${r.thickness ?? ""} ملم ${r.itemName ?? ""}`}
                    </td>

                    <td>{t || "—"}</td>

                    {t === "sqm" || t === "unit" ? (
                      <>
                        <td>—</td>
                        <td>—</td>
                      </>
                    ) : (
                      <>
                        <td className="ltr">{r.length ?? "—"}</td>
                        <td className="ltr">{r.width ?? "—"}</td>
                      </>
                    )}

                    <td className="ltr">
                      {t === "box" ? r.sheetsPerBox ?? "—" : "—"}
                    </td>
                    <td className="ar-rtl">{r.origin ?? "—"}</td>
                    <td className="items-creation-col-photo">
                      {r.pictureUrl || r.productDescription ? (
                        <button
                          type="button"
                          className="items-thumb-btn"
                          onClick={() =>
                            setPreviewInfo({
                              itemName: r.itemName,
                              pictureUrl: r.pictureUrl,
                              productDescription: r.productDescription,
                            })
                          }
                          title="View photo / description"
                        >
                          {r.pictureUrl ? (
                            <img
                              src={`${getUploadsBaseUrl()}${r.pictureUrl}`}
                              alt=""
                              className="items-thumb-img"
                            />
                          ) : (
                            <span className="items-thumb-note">📝</span>
                          )}
                        </button>
                      ) : (
                        <span className="items-thumb-empty">—</span>
                      )}
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>

        {/* Search results counter */}
        {inSearchMode && (
          <div style={{ padding: "8px 0", fontSize: 12, opacity: 0.75 }}>
            {searching
              ? "Searching…"
              : `Showing ${searchResults?.length ?? 0} results`}
          </div>
        )}

        {/* Load more footer — NON-SEARCH mode */}
        {!inSearchMode && (
          <div className="items-creation-loadmore-wrapper">
            {hasMoreItems ? (
              <button
                type="button"
                className="items-creation-loadmore-btn"
                onClick={loadMoreItems}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            ) : (
              <button
                type="button"
                className="items-creation-loadmore-btn"
                disabled
              >
                All items loaded{" "}
                {Number.isFinite(totalItems)
                  ? `(${items.length}/${totalItems})`
                  : `(${items.length})`}
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
            <form
              onSubmit={handleFormSubmit}
              className="items-creation-form-grid"
            >
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
                  <option value="unit">Unit</option> {/* ✅ NEW */}
                </select>
              </label>

              <label>
                Stock Mode:
                <select
                  ref={refStockMode}
                  name="stockMode"
                  value={newItemData.stockMode}
                  onChange={handleInputChange}
                  onKeyDown={(e) => onEnterFocusNext(e, refStockMode)}
                >
                  <option value="SQM">SQM</option>
                  <option value="QTY">QTY</option>
                  <option value="NONE">NONE</option>
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

              {/* unit + sqm hide dims */}
              {newItemData.type !== "sqm" && newItemData.type !== "unit" && (
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
                  required={newItemData.type !== "unit" && newItemData.type !== "sqm"} // ✅ unit/sqm not required
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

              <label style={{ gridColumn: "1 / -1" }}>
                Description:
                <textarea
                  rows={2}
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                  className="ar-rtl"
                  placeholder="Notes about this item…"
                />
              </label>

              <label>
                Picture:
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setNewItemPicture(e.target.files?.[0] || null)}
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

      <form
        onSubmit={saveEdit}
        className="items-creation-form-grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        {/* ✅ Item Name - Now Editable */}
        <label>
          Item Name:
          <input
            type="text"
            name="itemName"
            value={editForm.itemName}
            onChange={handleEditChange}
            className="ar-rtl"
            required
          />
        </label>

        {/* ✅ Thickness - Now Editable */}
        <label>
          Thickness (mm):
          <input
            type="number"
            step="0.1"
            name="thickness"
            value={editForm.thickness}
            onChange={handleEditChange}
            className="ltr"
            required
          />
        </label>

        <label>
          Type:
          <select
            name="type"
            value={editForm.type}
            onChange={handleEditChange}
          >
            <option value="box">box</option>
            <option value="sheet">sheet</option>
            <option value="sqm">sqm</option>
            <option value="unit">unit</option>
          </select>
        </label>

        <label>
          Stock Mode:
          <select
            name="stockMode"
            value={editForm.stockMode}
            onChange={handleEditChange}
          >
            <option value="SQM">SQM</option>
            <option value="QTY">QTY</option>
            <option value="NONE">NONE</option>
          </select>
        </label>

        <label>
          Length (cm):
          <input
            type="number"
            name="length"
            value={editForm.length}
            onChange={handleEditChange}
            className="ltr"
            disabled={editForm.type === "sqm" || editForm.type === "unit"}
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
            disabled={editForm.type === "sqm" || editForm.type === "unit"}
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
            disabled={
              editForm.type === "sheet" ||
              editForm.type === "sqm" ||
              editForm.type === "unit"
            }
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

        <div
          className="items-creation-button-row"
          style={{ gridColumn: "1 / -1" }}
        >
          <button type="submit">Save</button>
          <button type="button" onClick={closeEdit}>
            Cancel
          </button>
        </div>
      </form>

      <div className="items-product-info">
        <h3>Description &amp; Picture</h3>

        {productInfoLoading ? (
          <div className="items-product-info-loading">Loading…</div>
        ) : (
          <div className="items-product-info-body">
            <label>
              Description:
              <textarea
                rows={3}
                value={productInfo.productDescription}
                onChange={(e) =>
                  setProductInfo((prev) => ({ ...prev, productDescription: e.target.value }))
                }
                className="ar-rtl"
                placeholder="Notes about this item…"
              />
            </label>
            <div className="items-product-info-actions">
              <button type="button" onClick={saveProductDescription} disabled={productInfoSaving}>
                {productInfoSaving ? "Saving…" : "Save Description"}
              </button>
            </div>

            <div className="items-product-info-picture-row">
              {productInfo.pictureUrl && (
                <img
                  className="items-product-info-thumb"
                  src={`${getUploadsBaseUrl()}${productInfo.pictureUrl}`}
                  alt="Item"
                />
              )}
              <label>
                Picture:
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => uploadVariantPicture(e.target.files?.[0])}
                  disabled={pictureUploading}
                />
              </label>
            </div>

            {productInfoMsg && (
              <div className={`items-product-info-msg ${productInfoMsg.includes("Failed") ? "error" : "success"}`}>
                {productInfoMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {lastSentPayload && (
        <pre
          style={{
            marginTop: 12,
            fontSize: 11,
            opacity: 0.7,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(lastSentPayload, null, 2)}
        </pre>
      )}
    </div>
  </div>
)}

      {/* Photo / description preview */}
      {previewInfo && (
        <div className="items-creation-modal" onClick={() => setPreviewInfo(null)}>
          <div
            className="items-creation-modal-content items-preview-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{previewInfo.itemName || "Item"}</h2>
            {previewInfo.pictureUrl && (
              <img
                src={`${getUploadsBaseUrl()}${previewInfo.pictureUrl}`}
                alt={previewInfo.itemName || ""}
                className="items-preview-img"
              />
            )}
            {previewInfo.productDescription && (
              <p className="items-preview-desc ar-rtl">{previewInfo.productDescription}</p>
            )}
            {!previewInfo.pictureUrl && !previewInfo.productDescription && (
              <p className="items-preview-desc">No description or picture yet.</p>
            )}
            <div className="items-creation-button-row">
              <button type="button" onClick={() => setPreviewInfo(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status modal */}
      {modalContent && (
        <div className="items-creation-modal">
          <div
            className={`items-creation-modal-status-content ${
              modalType === "success"
                ? "items-creation-success-modal"
                : "items-creation-error-modal"
            }`}
          >
            {modalType === "success" ? (
              <>
                <h2 className="items-creation-modal-success-text">
                  Action Completed
                </h2>
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
