// Shared by ItemSalesHistoryModal (POS) and ItemPurchaseHistoryModal
// (Purchase Invoice): row display helpers and the Enter-to-pin item search,
// which mirrors the POS Stock tab search exactly (StockTab.jsx).

export const buildDimensionDisplay = (row) => {
  const typeLower = String(row.type || "").toLowerCase();
  if (typeLower === "box") {
    return `${row.length ?? ""}×${row.width ?? ""}-${String(row.sheetsPerBox || 0).padStart(3, "0")}`;
  }
  if (typeLower === "sheet") {
    return `${row.length ?? ""}×${row.width ?? ""}`;
  }
  if (typeLower !== "unit" && typeLower !== "sqm" && row.length && row.width) {
    return `${row.length}×${row.width}`;
  }
  return "—";
};

export const buildItemNameDisplay = (row) => {
  const typeLower = String(row.type || "").toLowerCase();
  const hasThickness = typeLower !== "unit" && row.thickness != null && Number(row.thickness) > 0;
  const thicknessLabel = hasThickness ? `${Number(row.thickness)} ملم ` : "";
  return `${thicknessLabel}${row.itemName ?? ""}`.trim();
};

export const formatDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
};

export const normalizeDigits = (s = "") =>
  String(s)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/،/g, ",");

export const normalizeArabic = (s = "") =>
  String(s || "")
    .replace(/[ً-ٟ]/g, "")
    .replace(/ـ/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/\s+/g, " ")
    .trim();

export const looksLikeDims = (s) => {
  if (!s) return false;
  const t = normalizeDigits(s).trim();
  if (!t.includes("*")) return false;
  const [L, rest] = t.split("*");
  if (!L || !rest) return false;
  if (!/^\s*\d+(\.\d+)?\s*$/.test(L)) return false;
  const parts = rest.split("-");
  if (!/^\s*\d+(\.\d+)?\s*$/.test(parts[0] || "")) return false;
  if (parts[1] && !/^\s*\d+\s*$/.test(parts[1])) return false;
  return true;
};

export const isPlainNumber = (s) => {
  if (!s) return false;
  const t = normalizeDigits(String(s)).trim();
  return /^\d{1,5}(\.\d+)?$/.test(t);
};

// Given the pinned name/dims chips, resolve them into the same {q, length}
// request shape StockTab's fetchSearch sends to /items/v1/real-variant-ledger.
export const buildItemFilters = (nameChip, dimsChip) => {
  let q;
  let length;

  if (nameChip) q = normalizeArabic(nameChip);

  const raw = dimsChip ? normalizeDigits(dimsChip.trim()) : "";
  if (raw) {
    if (looksLikeDims(raw)) {
      q = [q, raw].filter(Boolean).join(" ");
    } else if (isPlainNumber(raw)) {
      length = Number(raw);
    }
  }

  return { q, length };
};

// Same Enter-to-pin parsing as StockTab.jsx's handleEnter: a "*"-shaped
// token (or dims-with-sheets like 225*321-012) becomes the dims chip; two
// bare numbers become dims; one bare number is a lone dims chip; anything
// left over becomes the name chip. Returns { dims, name } — a field is
// undefined when this entry didn't include it, so the caller leaves an
// already-pinned chip alone (e.g. pinning a dimension on its own shouldn't
// wipe out a previously pinned name).
export const parseSearchEntry = (input) => {
  const raw = normalizeDigits(String(input || "").trim()).trim();
  if (!raw) return {};
  const parts = raw.split(/\s+/).filter(Boolean);
  const nameOf = (restParts) => {
    const rest = restParts.join(" ").trim();
    return rest ? normalizeArabic(rest) : undefined;
  };

  const dimsToken = parts.find((p) => p.includes("*") && looksLikeDims(p));
  if (dimsToken) {
    return { dims: dimsToken, name: nameOf(parts.filter((p) => p !== dimsToken)) };
  }

  const numIdx = [];
  for (let i = 0; i < parts.length; i++) {
    if (isPlainNumber(parts[i])) numIdx.push(i);
  }

  if (numIdx.length >= 2) {
    const restParts = parts.slice();
    restParts.splice(numIdx[1], 1);
    restParts.splice(numIdx[0], 1);
    return { dims: `${parts[numIdx[0]]}*${parts[numIdx[1]]}`, name: nameOf(restParts) };
  }

  if (numIdx.length === 1) {
    const restParts = parts.slice();
    restParts.splice(numIdx[0], 1);
    return { dims: parts[numIdx[0]], name: nameOf(restParts) };
  }

  return { name: normalizeArabic(raw) };
};
