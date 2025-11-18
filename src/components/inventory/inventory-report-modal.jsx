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
  return `${thk} ملم ${itemName || ""}`.trim(); // 3 ملم ابيض
};


const toNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const perSheetSqmOf = (lengthCm, widthCm) => {
  const L = toNum(lengthCm),
    W = toNum(widthCm);
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

const normNum = (x) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.floor(n) : 0;
};
const normOrigin = (s) => String(s ?? "").trim();

/** STRICT mode-aware balance derivation */
const deriveBalances = (row, mode) => {
  const typeLower = typeOf(row?.type);

  const unitsBal = Number.isFinite(Number(row?.ofrTotalsUnits?.balance))
    ? Number(row.ofrTotalsUnits.balance)
    : Number.isFinite(Number(row?.ones?.balance))
    ? Number(row.ones.balance)
    : undefined;

  const sqmBal = Number.isFinite(Number(row?.ofrTotalsSqm?.balanceOFR))
    ? Number(row.ofrTotalsSqm.balanceOFR)
    : undefined;

  let qty, sqm;

  if (mode === "name") {
    if (Number.isFinite(unitsBal)) {
      qty = unitsBal;
      sqm = qtyToSqm({
        itemType: row.type,
        lengthCm: row.length,
        widthCm: row.width,
        sheetsPerBox: row.sheetsPerBox,
        valueQty: qty,
      });
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
  } else {
    if (Number.isFinite(sqmBal)) {
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
    } else if (Number.isFinite(unitsBal)) {
      qty = unitsBal;
      sqm = qtyToSqm({
        itemType: row.type,
        lengthCm: row.length,
        widthCm: row.width,
        sheetsPerBox: row.sheetsPerBox,
        valueQty: qty,
      });
      if (typeLower === "sqm") sqm = qty;
    }
  }

  return {
    qty: Number.isFinite(qty) ? Number(qty) : undefined,
    sqm: Number.isFinite(sqm) ? Number(sqm) : undefined,
  };
};

/* -------- Grouping & detailed rows (with SPB) -------- */
function useGroupedByDescription(
  rows,
  mode,
  { debug = false, rowsForSpbIndex = null } = {}
) {
  const normThkKey = (t) => {
    const n = Number(t);
    return Number.isFinite(n) ? n.toFixed(1) : "0";
  };
  const prettyDimsSPB = (L, W, spb) =>
    Number(spb) > 0
      ? prettyDimsWithSPB(L, W, spb)
      : `${prettyDimsBase(L, W)}-000`;

  // normalized itemName key so grouping treats different names separately
  const normItemNameKey = (s) => String(s || "").trim().toLowerCase();

  return React.useMemo(() => {
    const groupsById = new Map();
    const exactSpbIndex = new Map(); // descId|itemNameKey|thkKey|LxW|origin -> Set(SPB)
    const descThkSpbStats = new Map(); // descId|itemNameKey|thkKey -> Map(spb -> count)

    const ensureGroup = (descId) => {
      if (!groupsById.has(descId)) {
        groupsById.set(descId, {
          descId,
          itemNumber: "",
          headerCombos: [],
          headerSet: new Set(),
          sortIndex: null,
          buckets: new Map(), // key(itemNameKey|thk|dim|origin) -> bucket
          order: [],
          rows: [],
          headerTitle: "",
          debugZeros: [],
        });
      }
      return groupsById.get(descId);
    };

    // 0) Build SPB indices from the widest set
    const idxSource =
      rowsForSpbIndex && rowsForSpbIndex.length ? rowsForSpbIndex : rows;
    (idxSource || []).forEach((r) => {
      if (typeOf(r.type) !== "box") return;

      const desc = r.description || null;
      const descId = desc?.id ?? "null";

      const L = Math.floor(Number(r.length) || 0);
      const W = Math.floor(Number(r.width) || 0);
      const origin = String(r.origin ?? "").trim();
      const thicknessNum = Number(r?.thickness ?? 0);
      const thkKey = normThkKey(thicknessNum);
      const itemNameKey = normItemNameKey(r.itemName);

      const spb = Math.max(0, Math.floor(Number(r.sheetsPerBox) || 0));
      if (spb <= 0) return;

      // itemName included in SPB index key
      const exactKey = `${descId}|${itemNameKey}|${thkKey}|${L}x${W}|${origin}`;
      if (!exactSpbIndex.has(exactKey)) exactSpbIndex.set(exactKey, new Set());
      exactSpbIndex.get(exactKey).add(spb);

      const dtKey = `${descId}|${itemNameKey}|${thkKey}`;
      if (!descThkSpbStats.has(dtKey)) descThkSpbStats.set(dtKey, new Map());
      const m = descThkSpbStats.get(dtKey);
      m.set(spb, (m.get(spb) || 0) + 1);
    });

    // 1) Aggregate visible rows
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

      const { qty, sqm } = deriveBalances(r, mode);
      const t = typeOf(r.type);

      const L = Math.floor(Number(r.length) || 0);
      const W = Math.floor(Number(r.width) || 0);
      const origin = String(r.origin ?? "").trim();

      // itemNameKey added into the bucket key
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
          sheetSqm: 0,
          boxQtyPerSpb: new Map(),
          boxSqmPerSpb: new Map(),
          // cost info at bucket level (variant-level for real, description-level for name)
          averageCost: null,
          lastCost: null,
          averageCostCVM: null,
          averageCostC: null,
          lastCostC: null,
          lastCostCVM: null,
        });
        g.order.push(bucketKey);
      }
      const b = g.buckets.get(bucketKey);

      const q = Number.isFinite(qty) ? qty : 0;
      const s = Number.isFinite(sqm) ? sqm : 0;

      // Variant-level costs (used in real mode)
      const avg = Number(r.averageCost);
      if (Number.isFinite(avg)) b.averageCost = avg;

      const last = Number(r.lastCost);
      if (Number.isFinite(last)) b.lastCost = last;

      // Description-level costs (used in name mode)
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
        b.boxQtyPerSpb.set(spb, (b.boxQtyPerSpb.get(spb) || 0) + q);
        b.boxSqmPerSpb.set(spb, (b.boxSqmPerSpb.get(spb) || 0) + s);
      } else if (t === "sheet") {
        b.sheetQty += q;
        b.sheetSqm += s;
      } else if (t === "sqm") {
        b.sheetSqm += s;
      }
    });

    const pickModalSpb = (descId, itemNameKey, thkKey) => {
      const m = descThkSpbStats.get(`${descId}|${itemNameKey}|${thkKey}`);
      if (!m || m.size === 0) return 0;
      let bestSpb = 0,
        bestCnt = -1;
      for (const [spb, cnt] of m.entries()) {
        if (cnt > bestCnt) {
          bestCnt = cnt;
          bestSpb = spb;
        }
      }
      return bestSpb;
    };

    // 2) Build output rows (always with an SPB)
    const allGroups = Array.from(groupsById.values()).map((g) => {
      const rowsOut = [];

      g.order.forEach((bucketKey) => {
        const b = g.buckets.get(bucketKey);

        // itemNameKey included in the exact key for SPB lookup
        const exactKey = `${g.descId}|${b.itemNameKey}|${b.thicknessKey}|${b.length}x${b.width}|${b.origin}`;
        const spbSetExact = exactSpbIndex.get(exactKey);
        const spbsFromIndex = spbSetExact
          ? Array.from(spbSetExact).sort((a, b) => a - b)
          : [];
        const spbsFromBoxData = Array.from(b.boxQtyPerSpb.keys())
          .filter((k) => k > 0)
          .sort((a, b) => a - b);

        let spbs = Array.from(new Set([...spbsFromIndex, ...spbsFromBoxData])).sort(
          (a, b) => a - b
        );
        if (spbs.length === 0) {
          const modalSpb = pickModalSpb(g.descId, b.itemNameKey, b.thicknessKey);
          if (modalSpb > 0) spbs = [modalSpb];
        }

        if (spbs.length > 0) {
          let attachSpb = spbs[0];
          let maxBoxes = -1;
          spbs.forEach((spb) => {
            const qb = Number(b.boxQtyPerSpb.get(spb) || 0);
            if (qb > maxBoxes) {
              maxBoxes = qb;
              attachSpb = spb;
            }
          });
          if (maxBoxes <= 0) attachSpb = spbs[0];

          let anyRow = false;
          spbs.forEach((spb) => {
            const qtyBox = Number(b.boxQtyPerSpb.get(spb) || 0);
            const sqmBox = Number(b.boxSqmPerSpb.get(spb) || 0);
            const attachSheets = spb === attachSpb;

            if (!attachSheets && qtyBox === 0) return;

            anyRow = true;
            rowsOut.push({
              idKey: `${bucketKey}|spb:${spb}`,
              dim: prettyDimsSPB(b.length, b.width, spb),
              itemNumber: b.itemNumber || "",
              origin: b.origin,
          nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),

              qtyBox,
              qtySheet: attachSheets ? Number(b.sheetQty || 0) : 0,
              sqmTotal: Number(sqmBox + (attachSheets ? b.sheetSqm || 0 : 0)),
              averageCost: b.averageCost,
              lastCost: b.lastCost,
              averageCostCVM: b.averageCostCVM,
              averageCostC: b.averageCostC,
              lastCostC: b.lastCostC,
              lastCostCVM: b.lastCostCVM,
            });
          });

          if (!anyRow) {
            rowsOut.push({
              idKey: `${bucketKey}|spb:${attachSpb}`,
              dim: prettyDimsSPB(b.length, b.width, attachSpb),
              itemNumber: b.itemNumber || "",
              origin: b.origin,
         nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),

              qtyBox: 0,
              qtySheet: Number(b.sheetQty || 0),
              sqmTotal: Number(b.sheetSqm || 0),
              averageCost: b.averageCost,
              lastCost: b.lastCost,
              averageCostCVM: b.averageCostCVM,
              averageCostC: b.averageCostC,
              lastCostC: b.lastCostC,
              lastCostCVM: b.lastCostCVM,
            });
          }
        } else {
          if ((b.sheetQty || 0) > 0 || (b.sheetSqm || 0) > 0) {
            rowsOut.push({
              idKey: `${bucketKey}|spb:0`,
              dim: prettyDimsSPB(b.length, b.width, 0),
              itemNumber: b.itemNumber || "",
              origin: b.origin,
      nameThkAr: buildNameThkAr(b.itemName, b.thicknessNum),

              qtyBox: 0,
              qtySheet: Number(b.sheetQty || 0),
              sqmTotal: Number(b.sheetSqm || 0),
              averageCost: b.averageCost,
              lastCost: b.lastCost,
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
        console.groupCollapsed(
          `[INV-REPORT] empty buckets — descId=${g.descId}`
        );
        console.table(g.debugZeros);
        console.groupEnd();
      }
      return g;
    });

    const num = (x) => (x == null ? null : Number(x));
    allGroups.sort((a, b) => {
      const ai = num(a.sortIndex),
        bi = num(b.sortIndex);
      if (ai == null && bi != null) return 1;
      if (ai != null && bi == null) return -1;
      if (ai != null && bi != null && ai !== bi) return ai - bi;

      const as = String(a.headerTitle || "");
      const bs = String(b.headerTitle || "");
      return as.localeCompare(bs, "ar", {
        numeric: true,
        sensitivity: "base",
      });
    });

    return { groups: allGroups };
  }, [rows, mode, rowsForSpbIndex, debug]);
}

/* --------- Optional view transform: Transfer-to-SQM (name mode only) --------- */
function useTransferredGroups(groups, transferToSqm, mode) {
  return useMemo(() => {
    if (!transferToSqm || mode !== "name") return groups || [];

    return (groups || []).map((g) => {
      let totalSqm = 0;
      (g.rows || []).forEach((r) => {
        totalSqm += Number(r.sqmTotal || 0);
      });

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
        // carry over cost from the group (same description)
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

/* --------- Print HTML (mirrors current view) --------- */
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
  mode = "real",
}) {
  const now = new Date();
  const stamp = now
    .toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", "");

  const escape = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[ch])
    );

  const costColsReal =
    mode === "real"
      ? (showAvgCost ? 1 : 0) + (showLastCost ? 1 : 0)
      : 0;

  const costColsName =
    mode === "name"
      ? (showAvgCostCVM ? 1 : 0) +
        (showAvgCostC ? 1 : 0) +
        (showLastCostC ? 1 : 0) +
        (showLastCostCVM ? 1 : 0)
      : 0;

  const groupBlocks = (groups || [])
    .map((g) => {
      const header = `<div class="g-head">
         <div class="g-title" style="direction:rtl;text-align:right">${escape(
           g.headerTitle || ""
         )}</div>
         <div class="g-right"><span class="itmno">Item No.: <strong>${escape(
           g.itemNumber || ""
         )}</strong></span></div>
       </div>`;

      const rowsHtml = (g.rows || [])
        .map((r) => {
          if (transferMode) {
            // name-mode transfer: no dimension/origin, but show name-costs
            const costNameCells =
              mode === "name"
                ? `
            ${
              showAvgCostCVM
                ? `<td class="tr">${
                    r.averageCostCVM != null ? fmt2(r.averageCostCVM) : ""
                  }</td>`
                : ""
            }
            ${
              showAvgCostC
                ? `<td class="tr">${
                    r.averageCostC != null ? fmt2(r.averageCostC) : ""
                  }</td>`
                : ""
            }
            ${
              showLastCostC
                ? `<td class="tr">${
                    r.lastCostC != null ? fmt2(r.lastCostC) : ""
                  }</td>`
                : ""
            }
            ${
              showLastCostCVM
                ? `<td class="tr">${
                    r.lastCostCVM != null ? fmt2(r.lastCostCVM) : ""
                  }</td>`
                : ""
            }
          `
                : "";
            return `<tr>
              <td class="tc">${escape(r.itemNumber || "")}</td>
              <td class="tc col-ar">${escape(r.nameThkAr || "")}</td>
              ${costNameCells}
              <td class="tr">${r.sqmTotal ? fmt2(r.sqmTotal) : ""}</td>
            </tr>`;
          }
          return `<tr>
          <td class="tc">${escape(r.itemNumber || "")}</td>
          <td class="tc col-ar">${escape(r.nameThkAr || "")}</td>
            ${
              mode === "real"
                ? `<td class="tc">${escape(r.dim)}</td>
                   <td class="origin">${escape(r.origin || "")}</td>`
                : ""
            }
            ${
              mode === "real" && showAvgCost
                ? `<td class="tr">${
                    r.averageCost != null ? fmt2(r.averageCost) : ""
                  }</td>`
                : ""
            }
            ${
              mode === "real" && showLastCost
                ? `<td class="tr">${
                    r.lastCost != null ? fmt2(r.lastCost) : ""
                  }</td>`
                : ""
            }
            ${
              mode === "name" && showAvgCostCVM
                ? `<td class="tr">${
                    r.averageCostCVM != null ? fmt2(r.averageCostCVM) : ""
                  }</td>`
                : ""
            }
            ${
              mode === "name" && showAvgCostC
                ? `<td class="tr">${
                    r.averageCostC != null ? fmt2(r.averageCostC) : ""
                  }</td>`
                : ""
            }
            ${
              mode === "name" && showLastCostC
                ? `<td class="tr">${
                    r.lastCostC != null ? fmt2(r.lastCostC) : ""
                  }</td>`
                : ""
            }
            ${
              mode === "name" && showLastCostCVM
                ? `<td class="tr">${
                    r.lastCostCVM != null ? fmt2(r.lastCostCVM) : ""
                  }</td>`
                : ""
            }
            <td class="tr">${r.qtyBox ? fmt2(r.qtyBox) : ""}</td>
            <td class="tr">${r.qtySheet ? fmt2(r.qtySheet) : ""}</td>
            <td class="tr">${r.sqmTotal ? fmt2(r.sqmTotal) : ""}</td>
          </tr>`;
        })
        .join("");

      let totBox = 0,
        totSheet = 0,
        totSqm = 0;
      for (const r of g.rows || []) {
        totBox += Number(r.qtyBox || 0);
        totSheet += Number(r.qtySheet || 0);
        totSqm += Number(r.sqmTotal || 0);
      }

      const thead = transferMode
        ? `<thead>
             <tr>
               <th class="tc">Item No.</th>
               <th class="tc col-ar">Name+Thk (AR)</th>
               ${
                 mode === "name"
                   ? [
                       showAvgCostCVM
                         ? `<th class="tr">Avg Cost CVM</th>`
                         : "",
                       showAvgCostC ? `<th class="tr">Avg Cost C</th>` : "",
                       showLastCostC ? `<th class="tr">Last Cost C</th>` : "",
                       showLastCostCVM
                         ? `<th class="tr">Last Cost CVM</th>`
                         : "",
                     ].join("")
                   : ""
               }
               <th class="tr">SQM (Total)</th>
             </tr>
           </thead>`
        : mode === "real"
        ? `<thead>
             <tr>
               <th class="tc">Item No.</th>
               <th class="tc col-ar">Name+Thk (AR)</th>
               <th class="tc">Dimension</th>
               <th>Origin</th>
               ${showAvgCost ? `<th class="tr">Avg Cost</th>` : ""}
               ${showLastCost ? `<th class="tr">Last Cost</th>` : ""}
               <th class="tr">Qty (Box)</th>
               <th class="tr">Qty (Sheet)</th>
               <th class="tr">SQM (Total)</th>
             </tr>
           </thead>`
        : `<thead>
             <tr>
               <th class="tc">Item No.</th>
               <th class="tc col-ar">Name+Thk (AR)</th>
               ${showAvgCostCVM ? `<th class="tr">Avg Cost CVM</th>` : ""}
               ${showAvgCostC ? `<th class="tr">Avg Cost C</th>` : ""}
               ${showLastCostC ? `<th class="tr">Last Cost C</th>` : ""}
               ${showLastCostCVM ? `<th class="tr">Last Cost CVM</th>` : ""}
               <th class="tr">Qty (Box)</th>
               <th class="tr">Qty (Sheet)</th>
               <th class="tr">SQM (Total)</th>
             </tr>
           </thead>`;

      const totalRow = (() => {
        if (transferMode) {
          const nameCostCols = mode === "name" ? costColsName : 0;
          return `<tr>
             <td colspan="${
               2 + nameCostCols
             }" class="tr" style="font-weight:700;background:#fafafa">Group Total:</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totSqm ? fmt2(totSqm) : ""
             }</td>
           </tr>`;
        }
        if (mode === "real") {
          return `<tr>
             <td colspan="${
               4 + costColsReal
             }" class="tr" style="font-weight:700;background:#fafafa">Group Total:</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totBox ? fmt2(totBox) : ""
             }</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totSheet ? fmt2(totSheet) : ""
             }</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totSqm ? fmt2(totSqm) : ""
             }</td>
           </tr>`;
        }
        // name mode, non-transfer
        return `<tr>
             <td colspan="${
               2 + costColsName
             }" class="tr" style="font-weight:700;background:#fafafa">Group Total:</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totBox ? fmt2(totBox) : ""
             }</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totSheet ? fmt2(totSheet) : ""
             }</td>
             <td class="tr" style="font-weight:700;background:#fafafa">${
               totSqm ? fmt2(totSqm) : ""
             }</td>
           </tr>`;
      })();

      const totalColsForEmpty = (() => {
        if (transferMode) {
          const nameCostCols = mode === "name" ? costColsName : 0;
          return 3 + nameCostCols; // itemNo + name + costs + sqm
        }
        if (mode === "real") return 7 + costColsReal;
        return 5 + costColsName; // name mode, non-transfer
      })();

      return `
        <section class="group">
          ${header}
          <table class="table">
            ${thead}
            <tbody>
              ${
                rowsHtml ||
                `<tr><td colspan="${totalColsForEmpty}" class="tc muted">No rows</td></tr>`
              }
              ${totalRow}
            </tbody>
          </table>
        </section>`;
    })
    .join("");

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
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { border:1px solid #e8e8e8; padding:6px 8px; }
    .table thead th { background:#f3f3f3; font-weight:700; font-size:11px; text-transform: uppercase; }
    .tc { text-align:center; } 
    .tr { text-align:right; } 
    .muted { color:#666; }

    /* RTL + numeric-friendly for Arabic+numbers column in PRINT */
    .table th.col-ar,
    .table td.col-ar {
      direction: rtl;
      unicode-bidi: plaintext;
      text-align: right;
      font-variant-numeric: lining-nums tabular-nums;
      font-feature-settings: "lnum","tnum";
      font-family: "Inter", "Tajawal", "Cairo", "Segoe UI",
                   "Noto Naskh Arabic", system-ui, -apple-system, sans-serif;
    }

    @media print { body { margin: 0; } header { position: sticky; top: 0; background: #fff; } .group { page-break-inside: avoid; } }
  `;

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escape(title)}</title>
      <style>${css}</style>
    </head>
    <body>
      <header>
        <h1>${escape(title)}</h1>
        <div class="stamp">${escape(stamp)}</div>
      </header>
      ${groupBlocks || `<div class="muted">No data.</div>`}
    </body>
  </html>`;
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
}) {
  const rowsForSpbIndex =
    spbSourceRows && spbSourceRows.length ? spbSourceRows : rows;
  const { groups } = useGroupedByDescription(rows, mode, {
    debug,
    rowsForSpbIndex,
  });

  const [transferToSqm, setTransferToSqm] = useState(false);
  // cost toggles
  const [showAvgCost, setShowAvgCost] = useState(false);
  const [showLastCost, setShowLastCost] = useState(false);

  const [showAvgCostCVM, setShowAvgCostCVM] = useState(false);
  const [showAvgCostC, setShowAvgCostC] = useState(false);
  const [showLastCostC, setShowLastCostC] = useState(false);
  const [showLastCostCVM, setShowLastCostCVM] = useState(false);

  useEffect(() => {
    setTransferToSqm(false);
    if (mode !== "real") {
      setShowAvgCost(false);
      setShowLastCost(false);
    }
    if (mode !== "name") {
      setShowAvgCostCVM(false);
      setShowAvgCostC(false);
      setShowLastCostC(false);
      setShowLastCostCVM(false);
    }
  }, [mode]);

  const displayGroups = useTransferredGroups(groups, transferToSqm, mode);
  const transferMode = transferToSqm && mode === "name";

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
    (acc, g) =>
      acc +
      g.rows.filter((r) => /-000$/.test(String(r.dim || ""))).length,
    0
  );

  const handlePrint = () => {
    const html = buildPrintHTML({
      groups: displayGroups,
      title,
      transferMode,
      showAvgCost,
      showLastCost,
      showAvgCostCVM,
      showAvgCostC,
      showLastCostC,
      showLastCostCVM,
      mode,
    });
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(html);
    doc.close();

    const doPrint = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 1000);
      }
    };
    if (doc.readyState === "complete") doPrint();
    else iframe.onload = doPrint;
  };

  const costColCount = !transferMode
    ? mode === "real"
      ? (showAvgCost ? 1 : 0) + (showLastCost ? 1 : 0)
      : mode === "name"
      ? (showAvgCostCVM ? 1 : 0) +
        (showAvgCostC ? 1 : 0) +
        (showLastCostC ? 1 : 0) +
        (showLastCostCVM ? 1 : 0)
      : 0
    : 0;

  return (
    <div className="invb-report-overlay" onClick={onClose}>
      <aside
        className="invb-report-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="invb-report-head">
          <div>
            <div className="invb-report-title">{title}</div>
            <div className="invb-report-sub">
              {transferMode ? (
                <>
                  Collapsed by <strong>Group</strong> into a single{" "}
                  <strong>SQM</strong> row (includes SQM-only items).
                </>
              ) : (
                <>
                  Grouped by{" "}
                  <strong>
                    {mode === "real" ? "Real Description" : "Item-Name Description"}
                  </strong>
                  .{" "}
                  {mode === "real" ? (
                    <>
                      One row per{" "}
                      <em>dimension + origin + (BOX SPB)</em>. Sheet quantity
                      attaches to the primary SPB row.
                    </>
                  ) : (
                    <>One row per <em>(BOX SPB)</em> bucket in each description.</>
                  )}
                  {debug && (
                    <span
                      style={{
                        marginLeft: 8,
                        fontWeight: 600,
                        color: "#a33",
                      }}
                    >
                      · unresolved -000 rows: {unresolvedCount}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <button className="invb-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="invb-report-body">
          <div className="invb-report-options">
            {mode === "name" && (
              <>
                <div className="row">
                  <label className="invb-chk">
                    <input
                      type="checkbox"
                      checked={transferToSqm}
                      onChange={(e) => setTransferToSqm(e.target.checked)}
                    />
                    Transfer to SQM (collapse per group)
                  </label>
                </div>
                <div className="row" style={{ gap: 16 }}>
                  <label className="invb-chk">
                    <input
                      type="checkbox"
                      checked={showAvgCostCVM}
                      onChange={(e) => setShowAvgCostCVM(e.target.checked)}
                    />
                    Show Avg Cost CVM
                  </label>
                  <label className="invb-chk">
                    <input
                      type="checkbox"
                      checked={showAvgCostC}
                      onChange={(e) => setShowAvgCostC(e.target.checked)}
                    />
                    Show Avg Cost C
                  </label>
                  <label className="invb-chk">
                    <input
                      type="checkbox"
                      checked={showLastCostC}
                      onChange={(e) => setShowLastCostC(e.target.checked)}
                    />
                    Show Last Cost C
                  </label>
                  <label className="invb-chk">
                    <input
                      type="checkbox"
                      checked={showLastCostCVM}
                      onChange={(e) => setShowLastCostCVM(e.target.checked)}
                    />
                    Show Last Cost CVM
                  </label>
                </div>
              </>
            )}

            {mode === "real" && (
              <div className="row" style={{ gap: 16 }}>
                <label className="invb-chk">
                  <input
                    type="checkbox"
                    checked={showAvgCost}
                    onChange={(e) => setShowAvgCost(e.target.checked)}
                  />
                  Show average cost
                </label>
                <label className="invb-chk">
                  <input
                    type="checkbox"
                    checked={showLastCost}
                    onChange={(e) => setShowLastCost(e.target.checked)}
                  />
                  Show last cost
                </label>
              </div>
            )}

            <div className="row">
              <button className="invb-btn" onClick={handlePrint}>
                🖨️ Print
              </button>
            </div>
          </div>

          <div className="invb-report-preview">
            <div className="invb-tablewrap">
              {loading && (
                <div className="invb-empty" style={{ padding: 16 }}>
                  Gathering all items for the report…
                </div>
              )}
              {!loading &&
                (!displayGroups || displayGroups.length === 0) && (
                  <div className="invb-empty">No data to preview.</div>
                )}

              {!loading &&
                (displayGroups || []).map((g) => {
                  let totBox = 0,
                    totSheet = 0,
                    totSqm = 0;
                  for (const r of g.rows) {
                    totBox += Number(r.qtyBox || 0);
                    totSheet += Number(r.qtySheet || 0);
                    totSqm += Number(r.sqmTotal || 0);
                  }

                  const nameCostCols =
                    (showAvgCostCVM ? 1 : 0) +
                    (showAvgCostC ? 1 : 0) +
                    (showLastCostC ? 1 : 0) +
                    (showLastCostCVM ? 1 : 0);

                  const nonCostBeforeQty = transferMode
                    ? 2
                    : mode === "real"
                    ? 4
                    : 2;

                  return (
                    <div
                      className="report-group"
                      key={`desc-${g.descId}`}
                    >
                      <div className="report-group-head">
                        <div
                          className="report-group-title"
                          title={`Description ID: ${g.descId}`}
                          style={{
                            direction: "rtl",
                            textAlign: "right",
                          }}
                        >
                          {g.headerTitle || ""}{" "}
                          <span
                            className="u-muted"
                            style={{ fontWeight: 600 }}
                          >
                            — #{g.itemNumber || ""}
                          </span>
                        </div>
                        <div className="report-group-totals">
                          {transferMode ? (
                            <span className="u-muted">
                              SQM: <strong>{fmt2(totSqm)}</strong>
                            </span>
                          ) : (
                            <>
                              <span>
                                Boxes: <strong>{fmt2(totBox)}</strong>
                              </span>
                              <span>
                                Sheets: <strong>{fmt2(totSheet)}</strong>
                              </span>
                              <span className="u-muted">
                                SQM: <strong>{fmt2(totSqm)}</strong>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <table className="invb-table invb-table--compact invb-table--striped">
                        <thead>
                          {transferMode ? (
                            <tr>
                              <th className="ta-center">Item No.</th>
                              <th className="ta-center col-ar">
                                Name+Thk (AR)
                              </th>

                              {mode === "name" && showAvgCostCVM && (
                                <th className="ta-right">
                                  Avg Cost CVM
                                </th>
                              )}
                              {mode === "name" && showAvgCostC && (
                                <th className="ta-right">
                                  Avg Cost C
                                </th>
                              )}
                              {mode === "name" && showLastCostC && (
                                <th className="ta-right">
                                  Last Cost C
                                </th>
                              )}
                              {mode === "name" && showLastCostCVM && (
                                <th className="ta-right">
                                  Last Cost CVM
                                </th>
                              )}
                              <th className="ta-right">
                                SQM (Total)
                              </th>
                            </tr>
                          ) : (
                            <tr>
                              <th className="ta-center">Item No.</th>
                              <th className="ta-center col-ar">
                                Name+Thk (AR)
                              </th>

                              {mode === "real" && (
                                <>
                                  <th className="ta-center">
                                    Dimension
                                  </th>
                                  <th>Origin</th>
                                </>
                              )}
                              {mode === "real" && showAvgCost && (
                                <th className="ta-right">
                                  Avg Cost
                                </th>
                              )}
                              {mode === "real" && showLastCost && (
                                <th className="ta-right">
                                  Last Cost
                                </th>
                              )}
                              {mode === "name" && showAvgCostCVM && (
                                <th className="ta-right">
                                  Avg Cost CVM
                                </th>
                              )}
                              {mode === "name" && showAvgCostC && (
                                <th className="ta-right">
                                  Avg Cost C
                                </th>
                              )}
                              {mode === "name" && showLastCostC && (
                                <th className="ta-right">
                                  Last Cost C
                                </th>
                              )}
                              {mode === "name" && showLastCostCVM && (
                                <th className="ta-right">
                                  Last Cost CVM
                                </th>
                              )}
                              <th className="ta-right">Qty (Box)</th>
                              <th className="ta-right">
                                Qty (Sheet)
                              </th>
                              <th className="ta-right">
                                SQM (Total)
                              </th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {g.rows.map((row) =>
                            transferMode ? (
                              <tr key={row.idKey}>
                                <td className="ta-center">
                                  {row.itemNumber || ""}
                                </td>
                                <td className="ta-center col-ar">
                                  {row.nameThkAr || ""}
                                </td>

                                {mode === "name" &&
                                  showAvgCostCVM && (
                                    <td className="ta-right u-muted">
                                      {row.averageCostCVM != null
                                        ? fmt2(row.averageCostCVM)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showAvgCostC && (
                                    <td className="ta-right u-muted">
                                      {row.averageCostC != null
                                        ? fmt2(row.averageCostC)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showLastCostC && (
                                    <td className="ta-right u-muted">
                                      {row.lastCostC != null
                                        ? fmt2(row.lastCostC)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showLastCostCVM && (
                                    <td className="ta-right u-muted">
                                      {row.lastCostCVM != null
                                        ? fmt2(row.lastCostCVM)
                                        : ""}
                                    </td>
                                  )}
                                <td className="ta-right u-muted">
                                  {row.sqmTotal
                                    ? fmt2(row.sqmTotal)
                                    : ""}
                                </td>
                              </tr>
                            ) : (
                              <tr key={row.idKey}>
                                <td className="ta-center">
                                  {row.itemNumber || ""}
                                </td>
                                <td className="ta-center col-ar">
                                  {row.nameThkAr || ""}
                                </td>

                                {mode === "real" && (
                                  <>
                                    <td className="ta-center">
                                      {row.dim}
                                    </td>
                                    <td className="truncate">
                                      {row.origin || ""}
                                    </td>
                                  </>
                                )}
                                {mode === "real" &&
                                  showAvgCost && (
                                    <td className="ta-right u-muted">
                                      {row.averageCost != null
                                        ? fmt2(row.averageCost)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "real" &&
                                  showLastCost && (
                                    <td className="ta-right u-muted">
                                      {row.lastCost != null
                                        ? fmt2(row.lastCost)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showAvgCostCVM && (
                                    <td className="ta-right u-muted">
                                      {row.averageCostCVM != null
                                        ? fmt2(row.averageCostCVM)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showAvgCostC && (
                                    <td className="ta-right u-muted">
                                      {row.averageCostC != null
                                        ? fmt2(row.averageCostC)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showLastCostC && (
                                    <td className="ta-right u-muted">
                                      {row.lastCostC != null
                                        ? fmt2(row.lastCostC)
                                        : ""}
                                    </td>
                                  )}
                                {mode === "name" &&
                                  showLastCostCVM && (
                                    <td className="ta-right u-muted">
                                      {row.lastCostCVM != null
                                        ? fmt2(row.lastCostCVM)
                                        : ""}
                                    </td>
                                  )}
                                <td className="ta-right">
                                  {row.qtyBox ? fmt2(row.qtyBox) : ""}
                                </td>
                                <td className="ta-right">
                                  {row.qtySheet
                                    ? fmt2(row.qtySheet)
                                    : ""}
                                </td>
                                <td className="ta-right u-muted">
                                  {row.sqmTotal
                                    ? fmt2(row.sqmTotal)
                                    : ""}
                                </td>
                              </tr>
                            )
                          )}

                          {transferMode ? (
                            <tr>
                              <td
                                colSpan={2 + nameCostCols}
                                className="ta-right"
                                style={{
                                  fontWeight: 700,
                                  background: "#fafafa",
                                }}
                              >
                                Group Total:
                              </td>
                              <td
                                className="ta-right"
                                style={{
                                  fontWeight: 700,
                                  background: "#fafafa",
                                }}
                              >
                                {totSqm ? fmt2(totSqm) : ""}
                              </td>
                            </tr>
                          ) : (
                            <tr>
                              <td
                                colSpan={nonCostBeforeQty + costColCount}
                                className="ta-right"
                                style={{
                                  fontWeight: 700,
                                  background: "#fafafa",
                                }}
                              >
                                Group Total:
                              </td>
                              <td
                                className="ta-right"
                                style={{
                                  fontWeight: 700,
                                  background: "#fafafa",
                                }}
                              >
                                {totBox ? fmt2(totBox) : ""}
                              </td>
                              <td
                                className="ta-right"
                                style={{
                                  fontWeight: 700,
                                  background: "#fafafa",
                                }}
                              >
                                {totSheet ? fmt2(totSheet) : ""}
                              </td>
                              <td
                                className="ta-right"
                                style={{
                                  fontWeight: 700,
                                  background: "#fafafa",
                                }}
                              >
                                {totSqm ? fmt2(totSqm) : ""}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="invb-report-foot">
          <div className="u-muted">
            {loading
              ? "Loading…"
              : rows?.length
              ? `${rows.length} variants in report`
              : "No rows"}
          </div>
          <div className="invb-report-actions">
            <button className="invb-btn" onClick={handlePrint}>
              🖨️ Print
            </button>
            <button className="invb-btn" disabled>
              Export CSV
            </button>
            <button className="invb-btn" disabled>
              Generate PDF
            </button>
            <button
              className="invb-btn invb-btn--ghost"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
