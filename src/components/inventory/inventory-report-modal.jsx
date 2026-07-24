import React, { useEffect, useMemo, useState } from "react";
import "./inventory-report-modal.css";

/* ----------------- Utilities ----------------- */
const fmt2 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
};
const typeOf = (t) => String(t || "").toLowerCase();

const buildNameThkAr = (itemName, thicknessNum) => {
  const thk = Number.isFinite(thicknessNum) ? thicknessNum : "";
  if (!thk) return String(itemName || "").trim();
  return `${thk} ملم ${itemName || ""}`.trim();
};

const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

const perSheetSqmOf = (lengthCm, widthCm) => {
  const L = toNum(lengthCm), W = toNum(widthCm);
  return L > 0 && W > 0 ? (L * W) / 10000 : 0;
};

const sqmToQty = ({ itemType, lengthCm, widthCm, sheetsPerBox, valueSqm }) => {
  const SPB = Math.max(1, toNum(sheetsPerBox));
  const perSheetSqm = perSheetSqmOf(lengthCm, widthCm);
  const type = typeOf(itemType);
  if (type === "box") {
    const perBoxSqm = perSheetSqm * SPB;
    return perBoxSqm > 0 ? toNum(valueSqm) / perBoxSqm : toNum(valueSqm);
  }
  if (type === "sheet")
    return perSheetSqm > 0 ? toNum(valueSqm) / perSheetSqm : toNum(valueSqm);
  return toNum(valueSqm);
};

const qtyToSqm = ({ itemType, lengthCm, widthCm, sheetsPerBox, valueQty }) => {
  const SPB = Math.max(1, toNum(sheetsPerBox));
  const perSheetSqm = perSheetSqmOf(lengthCm, widthCm);
  const type = typeOf(itemType);
  if (type === "box") return toNum(valueQty) * perSheetSqm * SPB;
  if (type === "sheet") return toNum(valueQty) * perSheetSqm;
  return toNum(valueQty);
};

const pad3 = (n) =>
  String(Math.max(0, Math.floor(Number(n) || 0))).padStart(3, "0");
const prettyDimsBase = (L, W) => {
  const l = Math.floor(Number(L) || 0);
  const w = Math.floor(Number(W) || 0);
  if (l && w) return `${l}×${w}`;
  return "-";
};
const prettyDimsWithSPB = (L, W, spb) => {
  const base = prettyDimsBase(L, W);
  const s = Number(spb);
  return `${base}-${Number.isFinite(s) && s > 0 ? pad3(s) : "000"}`;
};

const deriveBalances = (row, _mode) => {
  const typeLower = typeOf(row?.type);

  const qtyBal =
    Number.isFinite(Number(row?.ones?.balance))
      ? Number(row.ones.balance)
      : Number.isFinite(Number(row?.ofrTotalsUnits?.balance))
      ? Number(row.ofrTotalsUnits.balance)
      : undefined;

  const sqmBal =
    Number.isFinite(Number(row?.ofrTotalsSqm?.balanceOFR))
      ? Number(row.ofrTotalsSqm.balanceOFR)
      : undefined;

  let qty, sqm;

  if (Number.isFinite(qtyBal)) {
    qty = qtyBal;
    if (typeLower === "sqm") {
      sqm = Number.isFinite(sqmBal) ? sqmBal : qty;
    } else {
      sqm = Number.isFinite(sqmBal)
        ? sqmBal
        : qtyToSqm({
            itemType: row.type,
            lengthCm: row.length,
            widthCm: row.width,
            sheetsPerBox: row.sheetsPerBox,
            valueQty: qty,
          });
    }
  } else if (Number.isFinite(sqmBal)) {
    sqm = sqmBal;
    qty =
      typeLower === "sqm"
        ? sqmBal
        : sqmToQty({
            itemType: row.type,
            lengthCm: row.length,
            widthCm: row.width,
            sheetsPerBox: row.sheetsPerBox,
            valueSqm: sqmBal,
          });
  }

  return {
    qty: Number.isFinite(qty) ? Number(qty) : undefined,
    sqm: Number.isFinite(sqm) ? Number(sqm) : undefined,
  };
};

// ✅ Threshold: rows with zero qty AND sqm below this are hidden
const SQM_DISPLAY_THRESHOLD = 0.1;

/* -------- Grouping & detailed rows (with SPB) -------- */
function useGroupedByDescription(
  rows,
  mode,
  { debug = false, rowsForSpbIndex = null, companyWarehouse = null, remoteWarehouse = "Tripoli" } = {}
) {
  const normThkKey = (t) => {
    const n = Number(t);
    return Number.isFinite(n) ? n.toFixed(1) : "0";
  };

  const normItemNameKey = (s) => String(s || "").trim().toLowerCase();

  return React.useMemo(() => {
    const groupsById = new Map();
    const exactSpbIndex = new Map();
    const descThkSpbStats = new Map();

    const ensureGroup = (descId) => {
      if (!groupsById.has(descId)) {
        groupsById.set(descId, {
          descId,
          itemNumber: "",
          headerCombos: [],
          headerSet: new Set(),
          sortIndex: null,
          buckets: new Map(),
          order: [],
          rows: [],
          headerTitle: "",
          debugZeros: [],
        });
      }
      return groupsById.get(descId);
    };

    const idxSource =
      rowsForSpbIndex && rowsForSpbIndex.length ? rowsForSpbIndex : rows;

    (idxSource || []).forEach((r) => {
      if (typeOf(r.type) !== "box") return;

      const desc = r.description || null;
      const descId = desc?.id ?? "null";

      const L = Math.floor(Number(r.length) || 0);
      const W = Math.floor(Number(r.width) || 0);

      // ✅ Skip items with no dimensions in the SPB index too
      if (L === 0 || W === 0) return;

      const origin = String(r.origin ?? "").trim();
      const thicknessNum = Number(r?.thickness ?? 0);
      const thkKey = normThkKey(thicknessNum);
      const itemNameKey = normItemNameKey(r.itemName);

      const spb = Math.max(0, Math.floor(Number(r.sheetsPerBox) || 0));
      if (spb <= 0) return;

      const exactKey = `${descId}|${itemNameKey}|${thkKey}|${L}x${W}|${origin}`;
      if (!exactSpbIndex.has(exactKey)) exactSpbIndex.set(exactKey, new Set());
      exactSpbIndex.get(exactKey).add(spb);

      const dtKey = `${descId}|${itemNameKey}|${thkKey}`;
      if (!descThkSpbStats.has(dtKey)) descThkSpbStats.set(dtKey, new Map());
      const m = descThkSpbStats.get(dtKey);
      m.set(spb, (m.get(spb) || 0) + 1);
    });

    (rows || []).forEach((r) => {
      const desc = r.description || null;
      const descId = desc?.id ?? "null";
      const g = ensureGroup(descId);

      if (!g.itemNumber && desc?.itemNumber)
        g.itemNumber = String(desc.itemNumber);

      const sIdx =
        mode === "real"
          ? desc?.sortIndexRealDescription
          : desc?.sortIndexDescription;
      if (g.sortIndex == null && sIdx != null) g.sortIndex = Number(sIdx);

      const thicknessNum = Number(r?.thickness ?? 0);
      const thkKey = normThkKey(thicknessNum);
      const itemNameKey = normItemNameKey(r.itemName);

      const headerLabel = `${Number.isFinite(thicknessNum) ? thicknessNum : 0}ملم ${
        r.itemName || ""
      }`.trim();
      if (!g.headerSet.has(headerLabel)) {
        g.headerSet.add(headerLabel);
        g.headerCombos.push(headerLabel);
      }

      const { qty } = deriveBalances(r, mode);
      const t = typeOf(r.type);

      const L = Math.floor(Number(r.length) || 0);
      const W = Math.floor(Number(r.width) || 0);
      const origin = String(r.origin ?? "").trim();

      const bucketKey = `${itemNameKey}|${thkKey}|${L}x${W}|${origin}`;

      if (!g.buckets.has(bucketKey)) {
        g.buckets.set(bucketKey, {
          itemNameKey,
          thicknessKey: thkKey,
          thicknessNum,
          itemName: r.itemName || "",
          length: L,
          width: W,
          origin,
          itemNumber: g.itemNumber || "",
          sheetQty: 0,
          boxQtyPerSpb: new Map(),
          tripoliBoxQtyPerSpb: new Map(),
          avgCostPerSpb: new Map(),
          lastCostPerSpb: new Map(),
          fallbackAvgCost: null,
          fallbackLastCost: null,
          sheetAvgCost: null,
          sheetLastCost: null,
          averageCostCVM: null,
          averageCostC: null,
          lastCostC: null,
          lastCostCVM: null,
          sqmTypeQty: 0,
          sqmTypeSqm: 0,
        });
        g.order.push(bucketKey);
      }

      const b = g.buckets.get(bucketKey);
      const q = Number.isFinite(qty) ? qty : 0;

      if (desc) {
        const acvm = Number(desc.averageCostCVM);
        if (Number.isFinite(acvm)) b.averageCostCVM = acvm;
        const ac = Number(desc.averageCostC);
        if (Number.isFinite(ac)) b.averageCostC = ac;
        const lc = Number(desc.lastCostC);
        if (Number.isFinite(lc)) b.lastCostC = lc;
        const lcvm = Number(desc.lastCostCVM);
        if (Number.isFinite(lcvm)) b.lastCostCVM = lcvm;
      }

      if (t === "box") {
        const spb = Math.max(0, Math.floor(Number(r.sheetsPerBox) || 0));

        const homeWh = companyWarehouse ? companyWarehouse.trim() : null;
        const homeQty = (r.batches || []).length > 0 && homeWh
          ? (r.batches || [])
              .filter((bx) => (bx.warehouse ?? null) === homeWh)
              .reduce((sum, bx) => sum + toNum(bx.balanceOFR), 0)
          : (r.batches || []).length > 0
          ? (r.batches || [])
              .filter((bx) => (bx.warehouse ?? null) !== remoteWarehouse)
              .reduce((sum, bx) => sum + toNum(bx.balanceOFR), 0)
          : q;
        b.boxQtyPerSpb.set(spb, (b.boxQtyPerSpb.get(spb) || 0) + homeQty);

        const tripoliQty = (r.batches || [])
          .filter((bx) => (bx.warehouse ?? null) === remoteWarehouse)
          .reduce((sum, bx) => sum + toNum(bx.balanceOFR), 0);
        b.tripoliBoxQtyPerSpb.set(spb, (b.tripoliBoxQtyPerSpb.get(spb) || 0) + tripoliQty);

        const avg = Number(r.averageCost);
        if (Number.isFinite(avg) && spb > 0) b.avgCostPerSpb.set(spb, avg);
        else if (Number.isFinite(avg)) b.fallbackAvgCost = avg;
        const last = Number(r.lastCost);
        if (Number.isFinite(last) && spb > 0) b.lastCostPerSpb.set(spb, last);
        else if (Number.isFinite(last)) b.fallbackLastCost = last;

      } else if (t === "sheet") {
        b.sheetQty += q;

        const sAvg = Number(r.averageCost);
        if (Number.isFinite(sAvg)) {
          if (b.sheetAvgCost == null) b.sheetAvgCost = sAvg;
          if (b.fallbackAvgCost == null) b.fallbackAvgCost = sAvg;
        }
        const sLast = Number(r.lastCost);
        if (Number.isFinite(sLast)) {
          if (b.sheetLastCost == null) b.sheetLastCost = sLast;
          if (b.fallbackLastCost == null) b.fallbackLastCost = sLast;
        }

      } else if (t === "sqm") {
        const { sqm: sqmVal } = deriveBalances(r, mode);
        b.sqmTypeQty += q;
        b.sqmTypeSqm += Number.isFinite(sqmVal) ? sqmVal : 0;

        const sAvg = Number(r.averageCost);
        if (Number.isFinite(sAvg)) {
          if (b.sheetAvgCost == null) b.sheetAvgCost = sAvg;
          if (b.fallbackAvgCost == null) b.fallbackAvgCost = sAvg;
        }
        const sLast = Number(r.lastCost);
        if (Number.isFinite(sLast)) {
          if (b.sheetLastCost == null) b.sheetLastCost = sLast;
          if (b.fallbackLastCost == null) b.fallbackLastCost = sLast;
        }

      } else if (t === "unit" || typeOf(r.stockMode) === "qty") {
        b.sheetQty += q;

        const sAvg = Number(r.averageCost);
        if (Number.isFinite(sAvg)) {
          if (b.sheetAvgCost == null) b.sheetAvgCost = sAvg;
          if (b.fallbackAvgCost == null) b.fallbackAvgCost = sAvg;
        }
        const sLast = Number(r.lastCost);
        if (Number.isFinite(sLast)) {
          if (b.sheetLastCost == null) b.sheetLastCost = sLast;
          if (b.fallbackLastCost == null) b.fallbackLastCost = sLast;
        }
      }
    });

    const pickModalSpb = (descId, itemNameKey, thkKey) => {
      const m = descThkSpbStats.get(`${descId}|${itemNameKey}|${thkKey}`);
      if (!m || m.size === 0) return 0;
      let bestSpb = 0, bestCnt = -1;
      for (const [spb, cnt] of m.entries()) {
        if (cnt > bestCnt) { bestCnt = cnt; bestSpb = spb; }
      }
      return bestSpb;
    };

    const isSpecialItemName = (name) => {
      const n = String(name || "").trim();
      return n.includes("محجر") || n.includes("زلحفة");
    };

    const allGroups = Array.from(groupsById.values()).map((g) => {
      const rowsOut = [];

      const isSpecialGroup = [...g.buckets.values()].some((bkt) =>
        isSpecialItemName(bkt.itemName)
      );

      const sortedOrder = [...g.order].sort((keyA, keyB) => {
        const a = g.buckets.get(keyA);
        const b = g.buckets.get(keyB);

        if (!isSpecialGroup) {
          const ORIGIN_PRIORITY = ["sisecam", "agc", "s.g", "sphinx", "grandstar"];
          const originRank = (origin) => {
            const o = String(origin || "").trim().toLowerCase();
            const idx = ORIGIN_PRIORITY.indexOf(o);
            return idx === -1 ? ORIGIN_PRIORITY.length : idx;
          };
          const aRank = originRank(a.origin);
          const bRank = originRank(b.origin);
          if (aRank !== bRank) return aRank - bRank;
          // same priority tier — sort alphabetically
          const origCmp = String(a.origin || "").localeCompare(String(b.origin || ""));
          if (origCmp !== 0) return origCmp;
        }

        // 1) item name ASC
        const nameCmp = String(a.itemNameKey || "").localeCompare(String(b.itemNameKey || ""));
        if (nameCmp !== 0) return nameCmp;
        // 2) thickness ASC
        if (a.thicknessNum !== b.thicknessNum) return a.thicknessNum - b.thicknessNum;
        // 3) width ASC
        if (a.width !== b.width) return a.width - b.width;
        // 4) length ASC
        return a.length - b.length;
      });

      sortedOrder.forEach((bucketKey) => {
        const b = g.buckets.get(bucketKey);

        // ✅ Skip buckets with no dimensions (length=0 or width=0)
        // Items with L=0, W=0, thickness=0 are dummy placeholders — always skip.
        // Items with L=0, W=0 but thickness>0 are real unit items — show as "Unit" row.
        if (b.length === 0 || b.width === 0) {
          const unitQty = Number(b.sheetQty || 0);
          if (unitQty > 0) {
            rowsOut.push({
              idKey: `${bucketKey}|unit`,
              dim: "Unit",
              itemNumber: b.itemNumber || "",
              origin: b.origin,
              nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),
              qtyBox: 0,
              qtyBoxTripoli: 0,
              sqmTripoli: 0,
              qtySheet: unitQty,
              sqmTotal: 0,
              averageCost: b.fallbackAvgCost ?? null,
              lastCost: b.fallbackLastCost ?? null,
              averageCostCVM: b.averageCostCVM,
              averageCostC: b.averageCostC,
              lastCostC: b.lastCostC,
              lastCostCVM: b.lastCostCVM,
            });
          }
          return;
        }

        const perSheet = perSheetSqmOf(b.length, b.width);

        const exactKey = `${g.descId}|${b.itemNameKey}|${b.thicknessKey}|${b.length}x${b.width}|${b.origin}`;
        const spbSetExact = exactSpbIndex.get(exactKey);
        const spbsFromIndex = spbSetExact
          ? Array.from(spbSetExact).sort((a, b) => a - b)
          : [];
        const spbsFromBoxData = Array.from(b.boxQtyPerSpb.keys())
          .filter((k) => k > 0)
          .sort((a, b) => a - b);

        let spbs = Array.from(
          new Set([...spbsFromIndex, ...spbsFromBoxData])
        ).sort((a, b) => a - b);

        if (spbs.length === 0) {
          const modalSpb = pickModalSpb(g.descId, b.itemNameKey, b.thicknessKey);
          if (modalSpb > 0) spbs = [modalSpb];
        }

        if (spbs.length > 0) {
          let attachSpb = spbs[0];
          let maxBoxes = -1;
          spbs.forEach((spb) => {
            const qb = Number(b.boxQtyPerSpb.get(spb) || 0);
            if (qb > maxBoxes) { maxBoxes = qb; attachSpb = spb; }
          });
          if (maxBoxes <= 0) attachSpb = spbs[0];

          let anyRow = false;

          spbs.forEach((spb) => {
            const qtyBox      = Number(b.boxQtyPerSpb.get(spb) || 0);
            const attachSheets = spb === attachSpb;
            const qtySheet    = attachSheets ? Number(b.sheetQty || 0) : 0;

            if (!attachSheets && qtyBox === 0) return;

            // ✅ Compute sqm from qty × dims
            const sqmBox    = qtyBox * spb * perSheet;
            const sqmSheet  = attachSheets ? (b.sheetQty || 0) * perSheet : 0;
            const sqmSqmType = attachSheets ? (b.sqmTypeSqm || 0) : 0;
            const rowSqm    = sqmBox + sqmSheet + sqmSqmType;

            // ✅ Skip rows with no qty and negligible sqm
            if (qtyBox === 0 && qtySheet === 0 && rowSqm < SQM_DISPLAY_THRESHOLD) return;

            anyRow = true;
            const tripoliQtyRow = Number(b.tripoliBoxQtyPerSpb.get(spb) || 0);
            rowsOut.push({
              idKey: `${bucketKey}|spb:${spb}`,
              dim: prettyDimsWithSPB(b.length, b.width, spb),
              itemNumber: b.itemNumber || "",
              origin: b.origin,
              nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),
              qtyBox,
              qtyBoxTripoli: tripoliQtyRow,
              sqmTripoli: tripoliQtyRow * spb * perSheet,
              qtySheet,
              sqmTotal: rowSqm,
              averageCost: b.avgCostPerSpb.get(spb) ?? b.fallbackAvgCost ?? null,
              lastCost: b.lastCostPerSpb.get(spb) ?? b.fallbackLastCost ?? null,
              averageCostCVM: b.averageCostCVM,
              averageCostC: b.averageCostC,
              lastCostC: b.lastCostC,
              lastCostCVM: b.lastCostCVM,
            });
          });

          if (!anyRow) {
            const fallbackQtySheet = Number(b.sheetQty || 0);
            const fallbackSqm = fallbackQtySheet * perSheet + (b.sqmTypeSqm || 0);

            if (fallbackQtySheet === 0 && fallbackSqm < SQM_DISPLAY_THRESHOLD) return;

            rowsOut.push({
              idKey: `${bucketKey}|spb:${attachSpb}`,
              dim: prettyDimsWithSPB(b.length, b.width, attachSpb),
              itemNumber: b.itemNumber || "",
              origin: b.origin,
              nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),
              qtyBox: 0,
              qtyBoxTripoli: 0,
              sqmTripoli: 0,
              qtySheet: fallbackQtySheet,
              sqmTotal: fallbackSqm,
              averageCost: b.avgCostPerSpb.get(attachSpb) ?? b.fallbackAvgCost ?? null,
              lastCost: b.lastCostPerSpb.get(attachSpb) ?? b.fallbackLastCost ?? null,
              averageCostCVM: b.averageCostCVM,
              averageCostC: b.averageCostC,
              lastCostC: b.lastCostC,
              lastCostCVM: b.lastCostCVM,
            });
          }
        } else {
          const sheetQty = Number(b.sheetQty || 0);
          const sheetSqm = sheetQty * perSheet + (b.sqmTypeSqm || 0);

          if (sheetQty > 0 || sheetSqm >= SQM_DISPLAY_THRESHOLD) {
            rowsOut.push({
              idKey: `${bucketKey}|spb:0`,
              dim: `${prettyDimsBase(b.length, b.width)}-000`,
              itemNumber: b.itemNumber || "",
              origin: b.origin,
              nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),
              qtyBox: 0,
              qtyBoxTripoli: 0,
              sqmTripoli: 0,
              qtySheet: sheetQty,
              sqmTotal: sheetSqm,
              averageCost: b.fallbackAvgCost ?? null,
              lastCost: b.fallbackLastCost ?? null,
              averageCostCVM: b.averageCostCVM,
              averageCostC: b.averageCostC,
              lastCostC: b.lastCostC,
              lastCostCVM: b.lastCostCVM,
            });
          } else if (debug) {
            g.debugZeros.push({
              reason: "NO_SPB_ANYWHERE_AND_NO_SHEETS",
              descId: g.descId,
              dim: `${b.length}x${b.width}`,
              origin: b.origin,
              thkKey: b.thicknessKey,
            });
          }
        }
      });

      g.rows = rowsOut;
      const [first] = g.headerCombos;
      g.headerTitle = first || "";
      delete g.headerSet;

      if (debug && g.debugZeros.length) {
        console.groupCollapsed(`[INV-REPORT] empty buckets — descId=${g.descId}`);
        console.table(g.debugZeros);
        console.groupEnd();
      }
      return g;
    });

    // ✅ Filter out groups that ended up with no rows
    const filteredGroups = allGroups.filter((g) => g.rows.length > 0);

    const num = (x) => (x == null ? null : Number(x));
    filteredGroups.sort((a, b) => {
      const ai = num(a.sortIndex), bi = num(b.sortIndex);
      if (ai == null && bi != null) return 1;
      if (ai != null && bi == null) return -1;
      if (ai != null && bi != null && ai !== bi) return ai - bi;
      const as = String(a.headerTitle || "");
      const bs = String(b.headerTitle || "");
      return as.localeCompare(bs, "ar", { numeric: true, sensitivity: "base" });
    });

    return { groups: filteredGroups };
  }, [rows, mode, rowsForSpbIndex, debug, companyWarehouse]);
}

/* --------- Optional view transform: Transfer-to-SQM --------- */
function useTransferredGroups(groups, transferToSqm, mode) {
  return useMemo(() => {
    if (!transferToSqm || mode !== "name") return groups || [];

    return (groups || []).map((g) => {
      let totalSqm = 0;
      (g.rows || []).forEach((r) => { totalSqm += Number(r.sqmTotal || 0); });

      const firstRow = (g.rows || [])[0] || {};

      const collapsedRow = {
        idKey: `desc-${g.descId}-sqm`,
        dim: "—",
        itemNumber: g.itemNumber || "",
        origin: "",
        nameThkAr: firstRow.nameThkAr || g.headerTitle || "",
        qtyBox: 0,
        qtySheet: 0,
        sqmTotal: totalSqm,
        averageCost: firstRow.averageCost ?? null,
        lastCost: firstRow.lastCost ?? null,
        averageCostCVM: firstRow.averageCostCVM ?? null,
        averageCostC: firstRow.averageCostC ?? null,
        lastCostC: firstRow.lastCostC ?? null,
        lastCostCVM: firstRow.lastCostCVM ?? null,
      };

      return { ...g, rows: [collapsedRow] };
    });
  }, [groups, transferToSqm, mode]);
}

/* --------- Print HTML --------- */
function buildPrintHTML({
  groups,
  title = "Inventory Report",
  transferMode = false,
  showAvgCost = false,
  showLastCost = false,
  showAvgCostCVM = false,
  showAvgCostC = false,
  showLastCostC = false,
  showLastCostCVM = false,
  showSqmAmount = false,
  showSqmAmountTotals = false,
  showGroupHeaders = true,
  showTripoliCol = false,
  remoteWarehouse = "Tripoli",
  mode = "real",
  grandTotals = null,
}) {
  const now = new Date();
  const stamp = now
    .toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
    .replace(",", "");

  const escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])
    );

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

  const costColsName = mode === "name"
    ? (showAvgCostCVM ? 1 : 0) + (showAvgCostC ? 1 : 0) +
      (showLastCostC  ? 1 : 0) + (showLastCostCVM ? 1 : 0)
    : 0;

  const costForAmount = (r) => {
    if (mode === "real") return num(r.averageCost);
    if (mode === "name") {
      if (showAvgCostCVM) return num(r.averageCostCVM);
      if (showAvgCostC)   return num(r.averageCostC);
      return num(r.averageCostCVM) || num(r.averageCostC) || 0;
    }
    return num(r.averageCost) || num(r.averageCostCVM) || num(r.averageCostC) || 0;
  };
  const effectiveSqmP = (r) => num(r.sqmTotal) + (showTripoliCol ? num(r.sqmTripoli) : 0);
  const sqmAmountOfRow = (r) => {
    const cost = costForAmount(r);
    const sqm = effectiveSqmP(r);
    return sqm > 0 ? sqm * cost : num(r.qtySheet) * cost;
  };

  const showAmountCol    = !!showSqmAmount;
  const showAmountTotals = showAmountCol && !!showSqmAmountTotals;

  const costColsReal = mode === "real"
    ? (showAvgCost ? 1 : 0) + (showLastCost ? 1 : 0)
    : 0;
  const costCols = mode === "real" ? costColsReal : costColsName;

  const groupBlocks = (groups || [])
    .map((g) => {
      let totBox = 0, totBoxTripoli = 0, totSheet = 0, totSqm = 0, totSqmTripoli = 0, totAmount = 0;
      let pWAvgNum = 0, pWAvgCVMNum = 0, pWAvgCNum = 0, pWLastCNum = 0, pWLastCVMNum = 0, pWDenom = 0;
      for (const r of g.rows || []) {
        totBox         += Number(r.qtyBox         || 0);
        totBoxTripoli  += Number(r.qtyBoxTripoli  || 0);
        totSheet  += Number(r.qtySheet || 0);
        totSqm    += Number(r.sqmTotal || 0);
        totSqmTripoli += Number(r.sqmTripoli || 0);
        totAmount += sqmAmountOfRow(r);
        const sqm = effectiveSqmP(r);
        if (sqm > 0) {
          pWDenom        += sqm;
          if (r.averageCost    != null) pWAvgNum    += sqm * Number(r.averageCost);
          if (r.averageCostCVM != null) pWAvgCVMNum += sqm * Number(r.averageCostCVM);
          if (r.averageCostC   != null) pWAvgCNum   += sqm * Number(r.averageCostC);
          if (r.lastCostC      != null) pWLastCNum  += sqm * Number(r.lastCostC);
          if (r.lastCostCVM    != null) pWLastCVMNum+= sqm * Number(r.lastCostCVM);
        }
      }
      const totSqmEff = totSqm + (showTripoliCol ? totSqmTripoli : 0);
      const pWAvg    = pWDenom > 0 ? pWAvgNum    / pWDenom : null;
      const pWAvgCVM = pWDenom > 0 ? pWAvgCVMNum / pWDenom : null;
      const pWAvgC   = pWDenom > 0 ? pWAvgCNum   / pWDenom : null;
      const pWLastC  = pWDenom > 0 ? pWLastCNum  / pWDenom : null;
      const pWLastCVM= pWDenom > 0 ? pWLastCVMNum/ pWDenom : null;

      const header = showGroupHeaders ? `<div class="g-head">
        <div class="g-title" style="direction:rtl;text-align:right">${escape(g.headerTitle || "")}</div>
        <div class="g-right"><span class="itmno">Item No.: <strong>${escape(g.itemNumber || "")}</strong></span></div>
      </div>` : "";

      const thead = transferMode
        ? `<thead><tr>
             <th>Origin</th>
             <th class="tc col-ar">Name+Thk (AR)</th>
             ${mode === "name" && showAvgCostCVM ? `<th class="tr">Avg Cost CVM</th>` : ""}
             ${mode === "name" && showAvgCostC   ? `<th class="tr">Avg Cost C</th>`   : ""}
             ${mode === "name" && showLastCostC  ? `<th class="tr">Last Cost C</th>`  : ""}
             ${mode === "name" && showLastCostCVM? `<th class="tr">Last Cost CVM</th>`: ""}
             <th class="tr">SQM (Total)</th>
             ${showAmountCol ? `<th class="tr" style="width:65px">Total Amount</th>` : ""}
           </tr></thead>`
        : `<thead><tr>
             <th>Origin</th>
             <th class="tc col-ar">Name+Thk (AR)</th>
             <th class="tc" style="width:110px">Dimension</th>
             <th class="tr">Qty (Box)</th>
             ${showTripoliCol ? `<th class="tr" style="color:#1a237e;width:52px">Qty ${remoteWarehouse.slice(0,3)}</th>` : ""}
             <th class="tr">Qty (S/U)</th>
             <th class="tr">SQM (Total)</th>
             ${mode === "real" && showAvgCost    ? `<th class="tr">Avg Cost</th>`     : ""}
             ${mode === "real" && showLastCost   ? `<th class="tr">Last Cost</th>`    : ""}
             ${mode === "name" && showAvgCostCVM ? `<th class="tr">Avg Cost CVM</th>` : ""}
             ${mode === "name" && showAvgCostC   ? `<th class="tr">Avg Cost C</th>`   : ""}
             ${mode === "name" && showLastCostC  ? `<th class="tr">Last Cost C</th>`  : ""}
             ${mode === "name" && showLastCostCVM? `<th class="tr">Last Cost CVM</th>`: ""}
             ${showAmountCol ? `<th class="tr" style="width:65px">Total Amount</th>` : ""}
           </tr></thead>`;

      const rowsHtml = (g.rows || [])
        .map((r) => {
          if (transferMode) {
            return `<tr>
              <td>${escape(r.origin || "")}</td>
              <td class="tc col-ar">${escape(r.nameThkAr || "")}</td>
              ${mode === "name" && showAvgCostCVM ? `<td class="tr">${r.averageCostCVM != null ? fmt2(r.averageCostCVM) : ""}</td>` : ""}
              ${mode === "name" && showAvgCostC   ? `<td class="tr">${r.averageCostC   != null ? fmt2(r.averageCostC)   : ""}</td>` : ""}
              ${mode === "name" && showLastCostC  ? `<td class="tr">${r.lastCostC      != null ? fmt2(r.lastCostC)      : ""}</td>` : ""}
              ${mode === "name" && showLastCostCVM? `<td class="tr">${r.lastCostCVM    != null ? fmt2(r.lastCostCVM)    : ""}</td>` : ""}
              <td class="tr">${r.sqmTotal ? fmt2(r.sqmTotal) : ""}</td>
              ${showAmountCol ? `<td class="tr">${(r.sqmTotal || r.qtySheet) ? fmt2(sqmAmountOfRow(r)) : ""}</td>` : ""}
            </tr>`;
          }

          return `<tr>
            <td>${escape(r.origin || "")}</td>
            <td class="tc col-ar">${escape(r.nameThkAr || "")}</td>
            <td class="tc">${escape(r.dim)}</td>
            <td class="tr">${r.qtyBox   ? fmt2(r.qtyBox)   : ""}</td>
            ${showTripoliCol ? `<td class="tr" style="color:#1a237e">${r.qtyBoxTripoli ? fmt2(r.qtyBoxTripoli) : ""}</td>` : ""}
            <td class="tr">${r.qtySheet ? fmt2(r.qtySheet) : ""}</td>
            <td class="tr">${effectiveSqmP(r) ? fmt2(effectiveSqmP(r)) : ""}</td>
            ${mode === "real" && showAvgCost    ? `<td class="tr">${r.averageCost != null ? fmt2(r.averageCost) : ""}</td>` : ""}
            ${mode === "real" && showLastCost   ? `<td class="tr">${r.lastCost    != null ? fmt2(r.lastCost)    : ""}</td>` : ""}
            ${mode === "name" && showAvgCostCVM ? `<td class="tr">${r.averageCostCVM != null ? fmt2(r.averageCostCVM) : ""}</td>` : ""}
            ${mode === "name" && showAvgCostC   ? `<td class="tr">${r.averageCostC   != null ? fmt2(r.averageCostC)   : ""}</td>` : ""}
            ${mode === "name" && showLastCostC  ? `<td class="tr">${r.lastCostC      != null ? fmt2(r.lastCostC)      : ""}</td>` : ""}
            ${mode === "name" && showLastCostCVM? `<td class="tr">${r.lastCostCVM    != null ? fmt2(r.lastCostCVM)    : ""}</td>` : ""}
            ${showAmountCol ? `<td class="tr">${(effectiveSqmP(r) || r.qtySheet) ? fmt2(sqmAmountOfRow(r)) : ""}</td>` : ""}
          </tr>`;
        })
        .join("");

      const totalColsForEmpty = transferMode
        ? 2 + (mode === "name" ? costColsName : 0) + 1 + (showAmountCol ? 1 : 0)
        : 3 + (showTripoliCol ? 1 : 0) + costCols + 3 + (showAmountCol ? 1 : 0);

      const totalRow = transferMode
        ? `<tr>
             <td colspan="${2 + (mode === "name" ? costColsName : 0)}" class="tr" style="font-weight:700;background:#fafafa">Group Total:</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${totSqmEff ? fmt2(totSqmEff) : ""}</td>
             ${showAmountCol ? `<td class="tr" style="font-weight:700;background:#fafafa">${showAmountTotals ? fmt2(totAmount) : ""}</td>` : ""}
           </tr>`
        : `<tr>
             <td colspan="3" class="tr" style="font-weight:700;background:#fafafa">Group Total:</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${totBox   ? fmt2(totBox)   : ""}</td>
             ${showTripoliCol ? `<td class="tr" style="font-weight:700;background:#fafafa;color:#1a237e">${totBoxTripoli ? fmt2(totBoxTripoli) : ""}</td>` : ""}
             <td class="tr" style="font-weight:700;background:#fafafa">${totSheet ? fmt2(totSheet) : ""}</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${totSqmEff ? fmt2(totSqmEff) : ""}</td>
             ${(mode === "real" && showAvgCost)    ? `<td class="tr" style="font-weight:700;background:#fafafa">${pWAvg    != null ? fmt2(pWAvg)    : ""}</td>` : ""}
             ${(mode === "real" && showLastCost)   ? `<td class="tr" style="font-weight:700;background:#fafafa"></td>` : ""}
             ${(mode === "name" && showAvgCostCVM) ? `<td class="tr" style="font-weight:700;background:#fafafa">${pWAvgCVM != null ? fmt2(pWAvgCVM) : ""}</td>` : ""}
             ${(mode === "name" && showAvgCostC)   ? `<td class="tr" style="font-weight:700;background:#fafafa">${pWAvgC   != null ? fmt2(pWAvgC)   : ""}</td>` : ""}
             ${(mode === "name" && showLastCostC)  ? `<td class="tr" style="font-weight:700;background:#fafafa">${pWLastC  != null ? fmt2(pWLastC)  : ""}</td>` : ""}
             ${(mode === "name" && showLastCostCVM)? `<td class="tr" style="font-weight:700;background:#fafafa">${pWLastCVM!= null ? fmt2(pWLastCVM): ""}</td>` : ""}
             ${showAmountCol ? `<td class="tr" style="font-weight:700;background:#fafafa">${showAmountTotals ? fmt2(totAmount) : ""}</td>` : ""}
           </tr>`;

      return `
        <section class="group">
          ${header}
          <table class="table">
            ${thead}
            <tbody>
              ${rowsHtml || `<tr><td colspan="${totalColsForEmpty}" class="tc muted">No rows</td></tr>`}
              ${totalRow}
            </tbody>
          </table>
        </section>`;
    })
    .join("");

  const grand = grandTotals && typeof grandTotals === "object" ? grandTotals : null;
  const gtBoxes     = grand ? Number(grand.boxes      || 0) : 0;
  const gtSheets    = grand ? Number(grand.sheets     || 0) : 0;
  const gtSqmBase   = grand ? Number(grand.sqm        || 0) : 0;
  const gtSqmTrip   = grand ? Number(grand.sqmTripoli || 0) : 0;
  const gtSqm       = gtSqmBase + (showTripoliCol ? gtSqmTrip : 0);
  const gtAmount = showAmountTotals
    ? (groups || []).reduce((sumG, g) =>
        sumG + (g.rows || []).reduce((sumR, r) => sumR + sqmAmountOfRow(r), 0), 0)
    : 0;

  const grandTotalBlock = `
    <section class="group">
      <div class="g-head">
        <div class="g-title">Grand Total</div>
        <div class="g-right"><span class="itmno">All groups combined</span></div>
      </div>
      <table class="table">
        <thead><tr>
          <th class="tr">Boxes</th><th class="tr">Sheets</th><th class="tr">SQM</th>
          ${showAmountTotals ? `<th class="tr" style="width:65px">Total Amount</th>` : ""}
        </tr></thead>
        <tbody><tr>
          <td class="tr" style="font-weight:800;background:#fafafa">${fmt2(gtBoxes)}</td>
          <td class="tr" style="font-weight:800;background:#fafafa">${fmt2(gtSheets)}</td>
          <td class="tr" style="font-weight:800;background:#fafafa">${fmt2(gtSqm)}</td>
          ${showAmountTotals ? `<td class="tr" style="font-weight:800;background:#fafafa">${fmt2(gtAmount)}</td>` : ""}
        </tr></tbody>
      </table>
    </section>`;

  const css = `
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", "Cairo", "Tajawal", Arial, sans-serif; color: #111; margin: 16px; }
    header { display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
    h1 { font-size: 18px; margin: 0; }
    .stamp { font-size: 12px; color:#666; }
    .group { margin: 14px 0 18px; page-break-inside: avoid; }
    .g-head { display:flex; justify-content: space-between; align-items: baseline; background:#fafbff; border:1px solid #e7ebff; border-radius:8px; padding:6px 8px; margin-bottom:6px; }
    .g-title { font-weight: 800; }
    .g-right { display: inline-flex; gap: 12px; align-items: baseline; }
    .itmno { font-weight: 600; }
    .table { width: 100%; border-collapse: collapse; table-layout: auto; }
    .table th, .table td { border:1px solid #e8e8e8; padding:5px 7px; white-space: nowrap; }
    .table thead th { background:#f3f3f3; font-weight:700; font-size:11px; text-transform: uppercase; }
    .tc { text-align:center; } .tr { text-align:right; } .muted { color:#666; }
    .table th.col-ar, .table td.col-ar {
      direction: rtl; unicode-bidi: plaintext; text-align: right;
      font-family: "Inter","Tajawal","Cairo","Segoe UI","Noto Naskh Arabic",system-ui,-apple-system,sans-serif;
    }
    @media print { body { margin: 0; } .group { page-break-inside: avoid; } }
  `;

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${escape(title)}</title><style>${css}</style></head>
    <body>
      <header><h1>${escape(title)}</h1><div class="stamp">${escape(stamp)}</div></header>
      ${groupBlocks || `<div class="muted">No data.</div>`}
      ${groupBlocks ? grandTotalBlock : ""}
    </body></html>`;
}

/* ----------------- Component ----------------- */
export default function ReportModal({
  open,
  onClose,
  rows = [],
  spbSourceRows = [],
  loading = false,
  mode = "real",
  debug = true,
  showTripoliColInitial = false,
  companyWarehouse = null,
  remoteWarehouse = "Tripoli",
}) {
  const rowsForSpbIndex =
    spbSourceRows && spbSourceRows.length ? spbSourceRows : rows;

  const { groups } = useGroupedByDescription(rows, mode, { debug, rowsForSpbIndex, companyWarehouse, remoteWarehouse });

  const [transferToSqm, setTransferToSqm] = useState(false);
  const [showAvgCost,     setShowAvgCost]     = useState(false);
  const [showLastCost,    setShowLastCost]    = useState(false);
  const [showAvgCostCVM,  setShowAvgCostCVM]  = useState(false);
  const [showAvgCostC,    setShowAvgCostC]    = useState(false);
  const [showLastCostC,   setShowLastCostC]   = useState(false);
  const [showLastCostCVM, setShowLastCostCVM] = useState(false);
  const [showSqmAmount,       setShowSqmAmount]       = useState(false);
  const [showSqmAmountTotals, setShowSqmAmountTotals] = useState(false);
  const [showGroupHeaders,    setShowGroupHeaders]    = useState(true);
  const [showTripoliCol,      setShowTripoliCol]      = useState(showTripoliColInitial);
  useEffect(() => {
    setTransferToSqm(false);
    if (mode !== "real") { setShowAvgCost(false); setShowLastCost(false); }
    if (mode !== "name") {
      setShowAvgCostCVM(false); setShowAvgCostC(false);
      setShowLastCostC(false);  setShowLastCostCVM(false);
    }
  }, [mode]);

  useEffect(() => {
    if (open) setShowTripoliCol(showTripoliColInitial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const displayGroups = useTransferredGroups(groups, transferToSqm, mode);
  const transferMode  = transferToSqm && mode === "name";

  const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const costForAmount = (row) => {
    if (mode === "real") return safeNum(row?.averageCost);
    if (mode === "name") {
      if (showAvgCostCVM) return safeNum(row?.averageCostCVM);
      if (showAvgCostC)   return safeNum(row?.averageCostC);
      return safeNum(row?.averageCostCVM) || safeNum(row?.averageCostC) || 0;
    }
    return safeNum(row?.averageCost) || safeNum(row?.averageCostCVM) || safeNum(row?.averageCostC) || 0;
  };
  const effectiveSqm = (row) => {
    const base = safeNum(row?.sqmTotal);
    return showTripoliCol ? base + safeNum(row?.sqmTripoli) : base;
  };
  const sqmAmountOfRow = (row) => {
    const cost = costForAmount(row);
    const sqm = effectiveSqm(row);
    return sqm > 0 ? sqm * cost : safeNum(row?.qtySheet) * cost;
  };

  const showAmountCol    = !!showSqmAmount;
  const showAmountTotals = showAmountCol && !!showSqmAmountTotals;

  const grandTotals = useMemo(() => {
    let boxes = 0, sheets = 0, sqm = 0, sqmTripoli = 0;
    (groups || []).forEach((g) => {
      (g.rows || []).forEach((r) => {
        boxes      += Number(r.qtyBox      || 0);
        sheets     += Number(r.qtySheet    || 0);
        sqm        += Number(r.sqmTotal    || 0);
        sqmTripoli += Number(r.sqmTripoli  || 0);
      });
    });
    return { boxes, sheets, sqm, sqmTripoli };
  }, [groups]);

  const grandAmount = useMemo(() => {
    if (!showAmountTotals) return 0;
    let amt = 0;
    (displayGroups || []).forEach((g) => {
      (g.rows || []).forEach((r) => { amt += sqmAmountOfRow(r); });
    });
    return amt;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayGroups, showAmountTotals, mode, showAvgCostCVM, showAvgCostC]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const title =
    mode === "real"
      ? "Inventory Report — Real Description (balanceOFR)"
      : "Inventory Report — Item-Name Description (balance)";

  const unresolvedCount = (displayGroups || []).reduce(
    (acc, g) => acc + g.rows.filter((r) => /-000$/.test(String(r.dim || ""))).length,
    0
  );

  const handlePrint = () => {
    const html = buildPrintHTML({
      groups: displayGroups, title, transferMode,
      showAvgCost, showLastCost,
      showAvgCostCVM, showAvgCostC, showLastCostC, showLastCostCVM,
      showSqmAmount, showSqmAmountTotals,
      showGroupHeaders, showTripoliCol,
      remoteWarehouse,
      mode, grandTotals,
    });

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();

    const doPrint = () => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      finally { setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 1000); }
    };
    if (doc.readyState === "complete") doPrint(); else iframe.onload = doPrint;
  };

  const costColCount = !transferMode
    ? mode === "real"
      ? (showAvgCost ? 1 : 0) + (showLastCost ? 1 : 0)
      : mode === "name"
      ? (showAvgCostCVM ? 1 : 0) + (showAvgCostC ? 1 : 0) +
        (showLastCostC  ? 1 : 0) + (showLastCostCVM ? 1 : 0)
      : 0
    : 0;

  return (
    <div className="invb-report-overlay" onClick={onClose}>
      <aside className="invb-report-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="invb-report-head">
          <div>
            <div className="invb-report-title">{title}</div>
            <div className="invb-report-sub">
              {transferMode ? (
                <>Collapsed by <strong>Group</strong> into a single <strong>SQM</strong> row.</>
              ) : (
                <>
                  Grouped by <strong>{mode === "real" ? "Real Description" : "Item-Name Description"}</strong>.{" "}
                  {mode === "real" ? (
                    <>One row per <em>dimension + origin + (BOX SPB)</em>. Sheet quantity attaches to the primary SPB row.</>
                  ) : (
                    <>One row per <em>(BOX SPB)</em> bucket in each description.</>
                  )}
                  {debug && (
                    <span style={{ marginLeft: 8, fontWeight: 600, color: "#a33" }}>
                      · unresolved -000 rows: {unresolvedCount}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <button className="invb-btn" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="invb-report-body">
          <div className="invb-report-options">
            {mode === "name" && (
              <>
                <div className="row">
                  <label className="invb-chk">
                    <input type="checkbox" checked={transferToSqm} onChange={(e) => setTransferToSqm(e.target.checked)} />
                    Transfer to SQM (collapse per group)
                  </label>
                </div>
                <div className="row" style={{ gap: 16 }}>
                  <label className="invb-chk">
                    <input type="checkbox" checked={showAvgCostCVM} onChange={(e) => setShowAvgCostCVM(e.target.checked)} />
                    Show Avg Cost CVM
                  </label>
                  <label className="invb-chk">
                    <input type="checkbox" checked={showAvgCostC} onChange={(e) => setShowAvgCostC(e.target.checked)} />
                    Show Avg Cost C
                  </label>
                  <label className="invb-chk">
                    <input type="checkbox" checked={showLastCostC} onChange={(e) => setShowLastCostC(e.target.checked)} />
                    Show Last Cost C
                  </label>
                  <label className="invb-chk">
                    <input type="checkbox" checked={showLastCostCVM} onChange={(e) => setShowLastCostCVM(e.target.checked)} />
                    Show Last Cost CVM
                  </label>
                </div>
              </>
            )}

            {mode === "real" && (
              <div className="row" style={{ gap: 16 }}>
                <label className="invb-chk">
                  <input type="checkbox" checked={showAvgCost} onChange={(e) => setShowAvgCost(e.target.checked)} />
                  Show average cost
                </label>
                <label className="invb-chk">
                  <input type="checkbox" checked={showLastCost} onChange={(e) => setShowLastCost(e.target.checked)} />
                  Show last cost
                </label>
              </div>
            )}

            <div className="row" style={{ gap: 16 }}>
              <label className="invb-chk">
                <input type="checkbox" checked={showGroupHeaders} onChange={(e) => setShowGroupHeaders(e.target.checked)} />
                Show Group Headers
              </label>
              <label className="invb-chk">
                <input type="checkbox" checked={showTripoliCol} onChange={(e) => setShowTripoliCol(e.target.checked)} />
                Inventory {remoteWarehouse}
              </label>
            </div>

            <div className="row" style={{ gap: 16 }}>
              <label className="invb-chk">
                <input type="checkbox" checked={showSqmAmount} onChange={(e) => {
                  const v = e.target.checked;
                  setShowSqmAmount(v);
                  if (!v) setShowSqmAmountTotals(false);
                }} />
                Total Amount (SQM × Avg Cost)
              </label>
              <label className="invb-chk" style={{ opacity: showSqmAmount ? 1 : 0.55 }}>
                <input type="checkbox" disabled={!showSqmAmount} checked={showSqmAmountTotals}
                  onChange={(e) => setShowSqmAmountTotals(e.target.checked)} />
                Show Amount Totals (group + grand)
              </label>
            </div>

            <div className="row">
              <button className="invb-btn" onClick={handlePrint}>🖨️ Print</button>
            </div>
          </div>

          {/* ── Preview table ── */}
          <div className="invb-report-preview">
            <div className="invb-tablewrap">
              {loading && (
                <div className="invb-empty" style={{ padding: 16 }}>Gathering all items for the report…</div>
              )}
              {!loading && (!displayGroups || displayGroups.length === 0) && (
                <div className="invb-empty">No data to preview.</div>
              )}

              {!loading && (displayGroups || []).map((g) => {
                let totBox = 0, totBoxTripoli = 0, totSheet = 0, totSqm = 0, totSqmTripoli = 0, totAmount = 0;
                let wAvgNumerator = 0, wAvgCVMNumerator = 0, wAvgCNumerator = 0;
                let wLastCNumerator = 0, wLastCVMNumerator = 0;
                let wAvgDenom = 0;
                for (const r of g.rows) {
                  totBox         += Number(r.qtyBox         || 0);
                  totBoxTripoli  += Number(r.qtyBoxTripoli  || 0);
                  totSheet  += Number(r.qtySheet || 0);
                  totSqm    += Number(r.sqmTotal || 0);
                  totSqmTripoli += Number(r.sqmTripoli || 0);
                  totAmount += sqmAmountOfRow(r);
                  const sqm = effectiveSqm(r);
                  if (sqm > 0) {
                    wAvgDenom        += sqm;
                    if (r.averageCost    != null) wAvgNumerator    += sqm * Number(r.averageCost);
                    if (r.averageCostCVM != null) wAvgCVMNumerator += sqm * Number(r.averageCostCVM);
                    if (r.averageCostC   != null) wAvgCNumerator   += sqm * Number(r.averageCostC);
                    if (r.lastCostC      != null) wLastCNumerator  += sqm * Number(r.lastCostC);
                    if (r.lastCostCVM    != null) wLastCVMNumerator+= sqm * Number(r.lastCostCVM);
                  }
                }
                const totSqmEffective = totSqm + (showTripoliCol ? totSqmTripoli : 0);
                const wAvg    = wAvgDenom > 0 ? wAvgNumerator    / wAvgDenom : null;
                const wAvgCVM = wAvgDenom > 0 ? wAvgCVMNumerator / wAvgDenom : null;
                const wAvgC   = wAvgDenom > 0 ? wAvgCNumerator   / wAvgDenom : null;
                const wLastC  = wAvgDenom > 0 ? wLastCNumerator  / wAvgDenom : null;
                const wLastCVM= wAvgDenom > 0 ? wLastCVMNumerator/ wAvgDenom : null;

                const nameCostCols =
                  (showAvgCostCVM ? 1 : 0) + (showAvgCostC ? 1 : 0) +
                  (showLastCostC  ? 1 : 0) + (showLastCostCVM ? 1 : 0);

                return (
                  <div className="report-group" key={`desc-${g.descId}`}>
                    {showGroupHeaders && (
                      <div className="report-group-head">
                        <div
                          className="report-group-title"
                          title={`Description ID: ${g.descId}`}
                          style={{ direction: "rtl", textAlign: "right" }}
                        >
                          {g.headerTitle || ""}{" "}
                          <span className="u-muted" style={{ fontWeight: 600 }}>— #{g.itemNumber || ""}</span>
                        </div>
                        <div className="report-group-totals">
                          {transferMode ? (
                            <>
                              <span className="u-muted">SQM: <strong>{fmt2(totSqmEffective)}</strong></span>
                              {showAmountTotals && <span className="u-muted">Amount: <strong>{fmt2(totAmount)}</strong></span>}
                            </>
                          ) : (
                            <>
                              <span>Boxes: <strong>{fmt2(totBox)}</strong></span>
                              <span>Sheets: <strong>{fmt2(totSheet)}</strong></span>
                              <span className="u-muted">SQM: <strong>{fmt2(totSqmEffective)}</strong></span>
                              {showAmountTotals && <span className="u-muted">Amount: <strong>{fmt2(totAmount)}</strong></span>}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    <table className="invb-table invb-table--compact invb-table--striped">
                      <thead>
                        {transferMode ? (
                          <tr>
                            <th>Origin</th>
                            <th className="ta-center col-ar">Name+Thk (AR)</th>
                            {mode === "name" && showAvgCostCVM && <th className="ta-right">Avg Cost CVM</th>}
                            {mode === "name" && showAvgCostC   && <th className="ta-right">Avg Cost C</th>}
                            {mode === "name" && showLastCostC  && <th className="ta-right">Last Cost C</th>}
                            {mode === "name" && showLastCostCVM&& <th className="ta-right">Last Cost CVM</th>}
                            <th className="ta-right">SQM (Total)</th>
                            {showAmountCol && <th className="ta-right">Total Amount</th>}
                          </tr>
                        ) : (
                          <tr>
                            <th>Origin</th>
                            <th className="ta-center col-ar">Name+Thk (AR)</th>
                            <th className="ta-center">Dimension</th>
                            <th className="ta-right">Qty (Box)</th>
                            {showTripoliCol && <th className="ta-right" style={{ color: "#1a237e" }}>Qty {remoteWarehouse.slice(0,3)}</th>}
                            <th className="ta-right">Qty (S/U)</th>
                            <th className="ta-right">SQM (Total)</th>
                            {mode === "real" && showAvgCost    && <th className="ta-right">Avg Cost</th>}
                            {mode === "real" && showLastCost   && <th className="ta-right">Last Cost</th>}
                            {mode === "name" && showAvgCostCVM && <th className="ta-right">Avg Cost CVM</th>}
                            {mode === "name" && showAvgCostC   && <th className="ta-right">Avg Cost C</th>}
                            {mode === "name" && showLastCostC  && <th className="ta-right">Last Cost C</th>}
                            {mode === "name" && showLastCostCVM&& <th className="ta-right">Last Cost CVM</th>}
                            {showAmountCol && <th className="ta-right">Total Amount</th>}
                          </tr>
                        )}
                      </thead>

                      <tbody>
                        {g.rows.map((row) =>
                          transferMode ? (
                            <tr key={row.idKey}>
                              <td>{row.origin || ""}</td>
                              <td className="ta-center col-ar">{row.nameThkAr || ""}</td>
                              {mode === "name" && showAvgCostCVM && <td className="ta-right u-muted">{row.averageCostCVM != null ? fmt2(row.averageCostCVM) : ""}</td>}
                              {mode === "name" && showAvgCostC   && <td className="ta-right u-muted">{row.averageCostC   != null ? fmt2(row.averageCostC)   : ""}</td>}
                              {mode === "name" && showLastCostC  && <td className="ta-right u-muted">{row.lastCostC      != null ? fmt2(row.lastCostC)      : ""}</td>}
                              {mode === "name" && showLastCostCVM&& <td className="ta-right u-muted">{row.lastCostCVM    != null ? fmt2(row.lastCostCVM)    : ""}</td>}
                              <td className="ta-right u-muted">{row.sqmTotal ? fmt2(row.sqmTotal) : ""}</td>
                              {showAmountCol && <td className="ta-right u-muted">{(row.sqmTotal || row.qtySheet) ? fmt2(sqmAmountOfRow(row)) : ""}</td>}
                            </tr>
                          ) : (
                            <tr key={row.idKey}>
                              <td className="truncate">{row.origin || ""}</td>
                              <td className="ta-center col-ar">{row.nameThkAr || ""}</td>
                              <td className="ta-center">{row.dim}</td>
                              <td className="ta-right">{row.qtyBox   ? fmt2(row.qtyBox)   : ""}</td>
                              {showTripoliCol && <td className="ta-right" style={{ color: "#1a237e" }}>{row.qtyBoxTripoli ? fmt2(row.qtyBoxTripoli) : ""}</td>}
                              <td className="ta-right">{row.qtySheet ? fmt2(row.qtySheet) : ""}</td>
                              <td className="ta-right u-muted">{effectiveSqm(row) ? fmt2(effectiveSqm(row)) : ""}</td>
                              {mode === "real" && showAvgCost    && <td className="ta-right u-muted">{row.averageCost != null ? fmt2(row.averageCost) : ""}</td>}
                              {mode === "real" && showLastCost   && <td className="ta-right u-muted">{row.lastCost    != null ? fmt2(row.lastCost)    : ""}</td>}
                              {mode === "name" && showAvgCostCVM && <td className="ta-right u-muted">{row.averageCostCVM != null ? fmt2(row.averageCostCVM) : ""}</td>}
                              {mode === "name" && showAvgCostC   && <td className="ta-right u-muted">{row.averageCostC   != null ? fmt2(row.averageCostC)   : ""}</td>}
                              {mode === "name" && showLastCostC  && <td className="ta-right u-muted">{row.lastCostC      != null ? fmt2(row.lastCostC)      : ""}</td>}
                              {mode === "name" && showLastCostCVM&& <td className="ta-right u-muted">{row.lastCostCVM    != null ? fmt2(row.lastCostCVM)    : ""}</td>}
                              {showAmountCol && <td className="ta-right u-muted">{(effectiveSqm(row) || row.qtySheet) ? fmt2(sqmAmountOfRow(row)) : ""}</td>}
                            </tr>
                          )
                        )}

                        {/* Group total row */}
                        {transferMode ? (
                          <tr>
                            <td colSpan={2 + nameCostCols} className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>Group Total:</td>
                            <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{totSqm ? fmt2(totSqm) : ""}</td>
                            {showAmountCol && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{showAmountTotals ? fmt2(totAmount) : ""}</td>}
                          </tr>
                        ) : (
                          <tr>
                            <td colSpan={3} className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>Group Total:</td>
                            <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{totBox   ? fmt2(totBox)   : ""}</td>
                            {showTripoliCol && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa", color: "#1a237e" }}>{totBoxTripoli ? fmt2(totBoxTripoli) : ""}</td>}
                            <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{totSheet ? fmt2(totSheet) : ""}</td>
                            <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{totSqmEffective ? fmt2(totSqmEffective) : ""}</td>
                            {mode === "real" && showAvgCost    && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{wAvg    != null ? fmt2(wAvg)    : ""}</td>}
                            {mode === "real" && showLastCost   && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}></td>}
                            {mode === "name" && showAvgCostCVM && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{wAvgCVM != null ? fmt2(wAvgCVM) : ""}</td>}
                            {mode === "name" && showAvgCostC   && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{wAvgC   != null ? fmt2(wAvgC)   : ""}</td>}
                            {mode === "name" && showLastCostC  && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{wLastC  != null ? fmt2(wLastC)  : ""}</td>}
                            {mode === "name" && showLastCostCVM && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{wLastCVM!= null ? fmt2(wLastCVM): ""}</td>}
                            {showAmountCol && <td className="ta-right" style={{ fontWeight: 700, background: "#fafafa" }}>{showAmountTotals ? fmt2(totAmount) : ""}</td>}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })}

              {/* Grand total */}
              {!loading && displayGroups && displayGroups.length > 0 && (
                <div className="report-group" key="grand-total">
                  <div className="report-group-head">
                    <div className="report-group-title" style={{ fontWeight: 800 }}>
                      Grand Total <span className="u-muted" style={{ fontWeight: 600 }}>— all groups</span>
                    </div>
                    <div className="report-group-totals">
                      <span>Boxes: <strong>{fmt2(grandTotals.boxes)}</strong></span>
                      <span>Sheets: <strong>{fmt2(grandTotals.sheets)}</strong></span>
                      <span className="u-muted">SQM: <strong>{fmt2(grandTotals.sqm + (showTripoliCol ? grandTotals.sqmTripoli : 0))}</strong></span>
                      {showAmountTotals && <span className="u-muted">Amount: <strong>{fmt2(grandAmount)}</strong></span>}
                    </div>
                  </div>

                  <table className="invb-table invb-table--compact invb-table--striped">
                    <thead>
                      <tr>
                        <th className="ta-right">Boxes</th>
                        <th className="ta-right">Sheets</th>
                        <th className="ta-right">SQM</th>
                        {showAmountTotals && <th className="ta-right">Total Amount</th>}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="ta-right" style={{ fontWeight: 800, background: "#fafafa" }}>{fmt2(grandTotals.boxes)}</td>
                        <td className="ta-right" style={{ fontWeight: 800, background: "#fafafa" }}>{fmt2(grandTotals.sheets)}</td>
                        <td className="ta-right u-muted" style={{ fontWeight: 800, background: "#fafafa" }}>{fmt2(grandTotals.sqm + (showTripoliCol ? grandTotals.sqmTripoli : 0))}</td>
                        {showAmountTotals && <td className="ta-right u-muted" style={{ fontWeight: 800, background: "#fafafa" }}>{fmt2(grandAmount)}</td>}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="invb-report-foot">
          <div className="u-muted">
            {loading ? "Loading…" : rows?.length ? `${rows.length} variants in report` : "No rows"}
          </div>
          <div className="invb-report-actions">
            <button className="invb-btn" onClick={handlePrint}>🖨️ Print</button>
            <button className="invb-btn" disabled>Export CSV</button>
            <button className="invb-btn" disabled>Generate PDF</button>
            <button className="invb-btn invb-btn--ghost" onClick={onClose}>Close</button>
          </div>
        </div>
      </aside>
    </div>
  );
}