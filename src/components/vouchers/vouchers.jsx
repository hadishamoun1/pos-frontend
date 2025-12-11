import React, { useState, useEffect, useRef } from "react";
import "./vouchers.css";
import AccountSelectionModal from "./acc-modal-selection";
import axios from "axios";
import NotificationModal from "../recievables/NotificationModal";
import JournalListsModal from "./journal-list-modal";

const JournalVoucherPage = () => {
  const [isJournalListOpen, setIsJournalListOpen] = useState(false);
  const [journalData, setJournalData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Header / meta
  const [date, setDate] = useState("");
  const [type, setType] = useState(""); // S | G | SR | RVR
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // Summary list search
  const [summarySeq, setSummarySeq] = useState("");
  const searchDebounceRef = useRef();
  const [kindFilter, setKindFilter] = useState(""); // "" | "INVOICE" | "RECEIVABLE" | "JV"

  // Edit / saved state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaved, setIsSaved] = useState(false); // true if JV exists in DB
  const [originalDetailIds, setOriginalDetailIds] = useState([]);

  // Journal list pagination
  const [summaryPage, setSummaryPage] = useState(1);
  const [hasMoreSummary, setHasMoreSummary] = useState(true);
  const [loadingMoreSummary, setLoadingMoreSummary] = useState(false);

  // Notifications
  const [notification, setNotification] = useState({
    visible: false,
    type: "",
    message: "",
    onConfirm: null,
  });

  // Context menu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
    rowRid: null,
  });

  // Account selection modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [currentRowRid, setCurrentRowRid] = useState(null);

  // Active row (for highlight)
  const [activeRowIndex, setActiveRowIndex] = useState(null);

  const makeRid = () =>
    `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const [entries, setEntries] = useState([
    {
      rid: makeRid(),
      detailId: null,
      originalAccountId: null,
      originalCustomerId: null,
      originalSupplierId: null,

      accountId: null,
      customerId: null,
      supplierId: null,
      accountNumber: "",
      accountName: "",
      currency: "",
      debit: "",
      debitOFR: "",
      credit: "",
      creditOFR: "",
      exchangeRate: "1",
      exchangeRateEURtoUSD: "",
      debitUSD: "",
      debitUSDOFR: "",
      creditUSD: "",
      creditUSDOFR: "",
      debitEx: "",
      debitExOFR: "",
      creditEx: "",
      creditExOFR: "",
      description: "",
      documentNbr: "",
    },
  ]);

  // ---------- READ-ONLY MODE ----------
  const readOnlyMode = isSaved && !isEditing;

  // Status pill
  const statusLabel = !isSaved ? "New" : isEditing ? "Editing" : "Saved";
  const statusClass =
    !isSaved
      ? "status-pill status-new"
      : isEditing
      ? "status-pill status-editing"
      : "status-pill status-saved";

  // ===== Number helpers =====
  const parseNumber = (value) => {
    if (value === "" || value === null || value === undefined) return 0;
    const s = String(value).replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const formatNumber = (value) => {
    const n = parseNumber(value);
    return n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // allow user to type freely (digits + single dot)
  const cleanNumericInput = (s = "") =>
    s.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  // For payload safety
  const nzNumStr = (v) => {
    if (v === null || v === undefined) return "0";
    const s = String(v).trim();
    if (s === "" || s === "NaN") return "0";
    const n = parseFloat(s.replace(/,/g, ""));
    return Number.isFinite(n) ? String(n) : "0";
  };
  const nzOfr = (v) => nzNumStr(v);
  const nzBase = (v) => nzNumStr(v);

  const normalizeEntity = (entity) => {
    const id =
      entity?.id ??
      entity?.accountId ??
      entity?.customerId ??
      entity?.supplierId ??
      null;

    const typ =
      entity?.entityType ||
      (entity?.supplierId
        ? "supplier"
        : entity?.customerId
        ? "customer"
        : "account");

    const number =
      entity?.accountNumber ??
      entity?.supplierAccountNumber ??
      entity?.customerAccountNumber ??
      entity?.number ??
      "";

    const name =
      entity?.accountName ??
      entity?.arabicAccountName ??
      entity?.supplierName ??
      entity?.customerName ??
      "";

    const numericId =
      id !== null && id !== undefined && !Number.isNaN(Number(id))
        ? Number(id)
        : id;

    return { id: numericId, type: typ, number, name };
  };

  // ---------- keyboard grid refs & helpers ----------
  const inputRefs = useRef({});
  const [pendingFocus, setPendingFocus] = useState(null); // { rowIndex, field }

  const registerInputRef = (rowIndex, field) => (el) => {
    if (!inputRefs.current[rowIndex]) inputRefs.current[rowIndex] = {};
    if (el) {
      inputRefs.current[rowIndex][field] = el;
    } else if (inputRefs.current[rowIndex]) {
      delete inputRefs.current[rowIndex][field];
    }
  };

  const INPUT_ORDER_BY_TYPE = {
    S: ["documentNbr", "description", "currency", "exchangeRate", "debit", "credit"],
    RVR: ["documentNbr", "description", "currency", "exchangeRate", "debit", "credit"],
    SR: ["documentNbr", "description", "currency", "exchangeRate", "debit", "credit"],
    G: ["documentNbr", "description", "currency", "exchangeRate", "debitOFR", "creditOFR"],
    default: ["documentNbr", "description", "currency", "exchangeRate", "debit", "credit"],
  };

  const getInputOrder = () => {
    const key = type || "S";
    return INPUT_ORDER_BY_TYPE[key] || INPUT_ORDER_BY_TYPE.default;
  };

  useEffect(() => {
    if (!pendingFocus) return;
    const { rowIndex, field } = pendingFocus;

    const el = inputRefs.current?.[rowIndex]?.[field];
    if (el && typeof el.focus === "function") {
      el.focus();
      if (typeof el.select === "function") el.select();
      setPendingFocus(null);
      return;
    }

    const id = setTimeout(() => {
      const el2 = inputRefs.current?.[rowIndex]?.[field];
      if (el2 && typeof el2.focus === "function") {
        el2.focus();
        if (typeof el2.select === "function") el2.select();
        setPendingFocus(null);
      }
    }, 0);

    return () => clearTimeout(id);
  }, [pendingFocus, entries.length]);

  // ---------- ADD ROW with smart defaults ----------
  const handleAddRow = () => {
    if (readOnlyMode) return;
    setEntries((prev) => {
      const last = prev[prev.length - 1];
      return [
        ...prev,
        {
          rid: makeRid(),
          detailId: null,
          originalAccountId: null,
          originalCustomerId: null,
          originalSupplierId: null,

          accountId: null,
          customerId: null,
          supplierId: null,
          accountNumber: "",
          accountName: "",
          currency: last?.currency || "",
          debit: "",
          debitOFR: "",
          credit: "",
          creditOFR: "",
          exchangeRate: last?.exchangeRate || "1",
          exchangeRateEURtoUSD: last?.exchangeRateEURtoUSD || "",
          debitUSD: "",
          debitUSDOFR: "",
          creditUSD: "",
          creditUSDOFR: "",
          debitEx: "",
          debitExOFR: "",
          creditEx: "",
          creditExOFR: "",
          description: last?.description || "",
          documentNbr: last?.documentNbr || "",
        },
      ];
    });
  };

  // ======= CORE: recalcEntry =======
  const recalcEntry = (entry) => {
    const d = parseNumber(entry.debit);
    const c = parseNumber(entry.credit);
    const r = Math.max(1, parseNumber(entry.exchangeRate || 1)); // guard

    // reset computed fields
    entry.debitUSD = 0;
    entry.creditUSD = 0;
    entry.debitEx = 0;
    entry.creditEx = 0;
    entry.debitUSDOFR = 0;
    entry.creditUSDOFR = 0;
    entry.debitExOFR = 0;
    entry.creditExOFR = 0;

    if (type === "S") {
      if (entry.currency === "USD") {
        entry.debit = String(entry.debit);
        entry.credit = String(entry.credit);

        entry.debitUSD = d;
        entry.debitEx = d * r;
        entry.debitOFR = String(entry.debit);
        entry.debitUSDOFR = d;
        entry.debitExOFR = d * r;

        entry.creditUSD = c;
        entry.creditEx = c * r;
        entry.creditOFR = String(entry.credit);
        entry.creditUSDOFR = c;
        entry.creditExOFR = c * r;
        return;
      }

      if (entry.currency === "LL") {
        entry.debit = String(entry.debit);
        entry.credit = String(entry.credit);

        entry.debitEx = d;
        entry.debitUSD = d / r;
        entry.debitOFR = String(entry.debit);
        entry.debitExOFR = d;
        entry.debitUSDOFR = d / r;

        entry.creditEx = c;
        entry.creditUSD = c / r;
        entry.creditOFR = String(entry.credit);
        entry.creditExOFR = c;
        entry.creditUSDOFR = c / r;
        return;
      }
    }

    if (type === "G") {
      const ofrD = parseNumber(entry.debitOFR);
      const ofrC = parseNumber(entry.creditOFR);

      if (entry.currency === "USD") {
        entry.debitUSDOFR = ofrD;
        entry.creditUSDOFR = ofrC;
        entry.debitExOFR = ofrD * r;
        entry.creditExOFR = ofrC * r;
      } else if (entry.currency === "LL") {
        entry.debitExOFR = ofrD;
        entry.creditExOFR = ofrC;
        entry.debitUSDOFR = ofrD / r;
        entry.creditUSDOFR = ofrC / r;
      }
      return;
    }

    if (type === "SR") {
      // OFR mirrors the base amounts
      entry.debitOFR = String(entry.debit);
      entry.creditOFR = String(entry.credit);

      const ofrD = d;
      const ofrC = c;

      if (entry.currency === "USD") {
        entry.debitUSD = d;
        entry.creditUSD = c;
        entry.debitEx = d * r;
        entry.creditEx = c * r;

        entry.debitUSDOFR = ofrD;
        entry.creditUSDOFR = ofrC;
        entry.debitExOFR = ofrD * r;
        entry.creditExOFR = ofrC * r;
      } else if (entry.currency === "LL") {
        entry.debitEx = d;
        entry.creditEx = c;
        entry.debitUSD = d / r;
        entry.creditUSD = c / r;

        entry.debitExOFR = ofrD;
        entry.creditExOFR = ofrC;
        entry.debitUSDOFR = ofrD / r;
        entry.creditUSDOFR = ofrC / r;
      }
      return;
    }

    if (type === "RVR") {
      // opposite of G: base amounts are input, OFR stays zero
      if (entry.currency === "USD") {
        entry.debit = String(entry.debit);
        entry.credit = String(entry.credit);

        entry.debitUSD = d;
        entry.debitEx = d * r;
        entry.creditUSD = c;
        entry.creditEx = c * r;

        entry.debitOFR = "0";
        entry.creditOFR = "0";
        entry.debitUSDOFR = 0;
        entry.creditUSDOFR = 0;
        entry.debitExOFR = 0;
        entry.creditExOFR = 0;
      } else if (entry.currency === "LL") {
        entry.debit = String(entry.debit);
        entry.credit = String(entry.credit);

        entry.debitEx = d;
        entry.debitUSD = d / r;
        entry.creditEx = c;
        entry.creditUSD = c / r;

        entry.debitOFR = "0";
        entry.creditOFR = "0";
        entry.debitUSDOFR = 0;
        entry.creditUSDOFR = 0;
        entry.debitExOFR = 0;
        entry.creditExOFR = 0;
      }
      return;
    }
  };

  // ====== Input handling ======
  const NUM_FIELDS = new Set([
    "debit",
    "credit",
    "debitOFR",
    "creditOFR",
    "exchangeRate",
    "exchangeRateEURtoUSD",
    "debitUSD",
    "creditUSD",
    "debitUSDOFR",
    "creditUSDOFR",
    "debitEx",
    "creditEx",
    "debitExOFR",
    "creditExOFR",
  ]);

  const EDITABLE_NUM_FIELDS = new Set([
    "debit",
    "credit",
    "debitOFR",
    "creditOFR",
    "exchangeRate",
    "exchangeRateEURtoUSD",
  ]);

  const handleInputChange = (index, field, value) => {
    if (readOnlyMode) return;
    const updated = [...entries];
    const entry = updated[index];

    const next = EDITABLE_NUM_FIELDS.has(field)
      ? cleanNumericInput(value)
      : value;

    entry[field] = next;

    if (NUM_FIELDS.has(field) || field === "currency") {
      recalcEntry(entry);
    }

    setEntries(updated);
  };

  const handleInputBlur = (index, field) => {
    if (readOnlyMode) return;
    const updated = [...entries];
    const entry = updated[index];

    if (EDITABLE_NUM_FIELDS.has(field)) {
      entry[field] = formatNumber(entry[field]);
    }
    setEntries(updated);
  };

  const handleCellKeyDown = (e, rowIndex, field) => {
    if (readOnlyMode) return;

    // Enter navigation
    if (e.key === "Enter") {
      e.preventDefault();
      const order = getInputOrder();
      const idx = order.indexOf(field);
      if (idx === -1) return;

      if (idx < order.length - 1) {
        const nextField = order[idx + 1];
        setPendingFocus({ rowIndex, field: nextField });
        return;
      }

      // last cell in row
      const isLastRow = rowIndex === entries.length - 1;
      if (isLastRow) {
        handleAddRow();
      }
      setPendingFocus({ rowIndex: rowIndex + 1, field: order[0] });
      return;
    }

    // "+" shortcut (also Shift+"=")
    if (e.key === "+" || (e.key === "=" && e.shiftKey)) {
      e.preventDefault();
      if (rowIndex === 0) return;

      setEntries((prev) => {
        const copy = [...prev];
        const prevRow = copy[rowIndex - 1];
        if (!prevRow) return prev;
        let cur = { ...copy[rowIndex] };

        if (field === "credit") {
          cur.credit = prevRow.debit;
        } else if (field === "debit") {
          cur.debit = prevRow.credit;
        } else if (field === "creditOFR") {
          cur.creditOFR = prevRow.debitOFR;
        } else if (field === "debitOFR") {
          cur.debitOFR = prevRow.creditOFR;
        } else {
          return prev;
        }

        recalcEntry(cur);
        copy[rowIndex] = cur;
        return copy;
      });
    }
  };

  const handleAccountSelection = (entity) => {
    if (readOnlyMode) return;
    if (currentRowRid === null) {
      alert("Please select a row to assign an account.");
      return;
    }
    const { id, type: entType, number, name } = normalizeEntity(entity);

    setEntries((prev) =>
      prev.map((row) => {
        if (row.rid !== currentRowRid) return row;
        const next = { ...row };
        next.accountId = null;
        next.customerId = null;
        next.supplierId = null;
        if (entType === "account") next.accountId = id;
        else if (entType === "customer") next.customerId = id;
        else if (entType === "supplier") next.supplierId = id;
        next.accountNumber = number;
        next.accountName = name;
        return next;
      })
    );

    setIsModalOpen(false);
  };

  const handleAccountNumberClick = (indexOrRid) => {
    if (readOnlyMode) return;
    const rid =
      typeof indexOrRid === "string"
        ? indexOrRid
        : entries[indexOrRid]?.rid ?? null;

    setCurrentRowIndex(typeof indexOrRid === "number" ? indexOrRid : null);
    setCurrentRowRid(rid);
    setIsModalOpen(true);
  };

  const handleRightClick = (event, rowIndex, rowRid) => {
    if (readOnlyMode) return;
    event.preventDefault();
    setActiveRowIndex(rowIndex);
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowIndex,
      rowRid,
    });
  };

  const handleDeleteRow = () => {
    if (readOnlyMode) return;
    if (contextMenu.rowRid) {
      setEntries((prev) => prev.filter((r) => r.rid !== contextMenu.rowRid));
      setContextMenu({
        visible: false,
        x: 0,
        y: 0,
        rowIndex: null,
        rowRid: null,
      });
      return;
    }
    if (contextMenu.rowIndex !== null) {
      setEntries((prev) => prev.filter((_, i) => i !== contextMenu.rowIndex));
      setContextMenu({
        visible: false,
        x: 0,
        y: 0,
        rowIndex: null,
        rowRid: null,
      });
    }
  };

  // ---------- DUPLICATE ROW ----------
  const handleDuplicateRow = () => {
    if (readOnlyMode) return;
    if (contextMenu.rowIndex == null) return;
    setEntries((prev) => {
      const row = prev[contextMenu.rowIndex];
      if (!row) return prev;
      const clone = {
        ...row,
        rid: makeRid(),
        detailId: null,
        // keep account links as current, original* are for backend logic if you need
      };
      return [
        ...prev.slice(0, contextMenu.rowIndex + 1),
        clone,
        ...prev.slice(contextMenu.rowIndex + 1),
      ];
    });
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      rowIndex: null,
      rowRid: null,
    });
  };

  const handleCloseContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      rowIndex: null,
      rowRid: null,
    });
  };

  // ===== Totals =====
  const totalDebitBase = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debit), 0)
  );
  const totalCreditBase = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.credit), 0)
  );

  const totalDebitOFR = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debitOFR), 0)
  );
  const totalCreditOFR = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.creditOFR), 0)
  );

  const totalDebitUSD = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debitUSD), 0)
  );
  const totalCreditUSD = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.creditUSD), 0)
  );
  const totalDebitLL = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debitEx), 0)
  );
  const totalCreditLL = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.creditEx), 0)
  );

  const round2 = (n) =>
    Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  const isEqualBase =
    round2(totalDebitBase) === round2(totalCreditBase) &&
    round2(totalDebitBase) !== 0;

  const isEqualOFR =
    round2(totalDebitOFR) === round2(totalCreditOFR) &&
    round2(totalDebitOFR) !== 0;

  const isUSDEqual = totalDebitUSD === totalCreditUSD;
  const isLLEqual = totalDebitLL === totalCreditLL;

  const diffBase = round2(totalDebitBase - totalCreditBase);
  const diffOFR = round2(totalDebitOFR - totalCreditOFR);

  const submitBlocked =
    !type || !date || (type === "G" ? !isEqualOFR : !isEqualBase);

  // ---------- BALANCE LAST ROW (Base) ----------
  const fillBalanceOnLastRow = () => {
    if (type === "G" || readOnlyMode) return; // G uses OFR, skip
    setEntries((prev) => {
      if (!prev.length) return prev;

      const totalDeb = prev.reduce(
        (sum, e) => sum + parseNumber(e.debit),
        0
      );
      const totalCred = prev.reduce(
        (sum, e) => sum + parseNumber(e.credit),
        0
      );
      const diff = round2(totalDeb - totalCred);
      if (diff === 0) return prev;

      const copy = [...prev];
      const idx = copy.length - 1;
      const last = { ...copy[idx] };

      const debitVal = parseNumber(last.debit);
      const creditVal = parseNumber(last.credit);

      // If we need more debit (diff < 0) and last debit is empty
      if (!debitVal && diff < 0) {
        last.debit = String(Math.abs(diff));
      } else if (!creditVal && diff > 0) {
        // need more credit
        last.credit = String(Math.abs(diff));
      } else {
        // nothing to do, both already filled
        return prev;
      }

      recalcEntry(last);
      copy[idx] = last;
      return copy;
    });
  };

  // ---------- payload builders ----------
  const buildCreatePayload = () => {
    const removeCommas = (value) =>
      typeof value === "string" ? value.replace(/,/g, "") : value;

    return {
      date,
      jvType: type,
      details: entries
        .filter((e) => {
          const isZero = (v) => {
            const n = parseNumber(v);
            return !n || n === 0;
          };
          const isEmptyRow =
            !e.accountId &&
            !e.customerId &&
            !e.supplierId &&
            isZero(e.debit) &&
            isZero(e.credit) &&
            isZero(e.debitOFR) &&
            isZero(e.creditOFR);
          return !isEmptyRow;
        })
        .map((entry) => {
          const base = {
            accountId: entry.accountId || undefined,
            customerId: entry.customerId || undefined,
            supplierId: entry.supplierId || undefined,
            description: entry.description,
            currency: entry.currency,
            exchangeRateEURtoUSD: removeCommas(entry.exchangeRateEURtoUSD),
            exchangeRate: removeCommas(entry.exchangeRate),
            docNbr: entry.documentNbr,

            // Always send OFR
            debitOFR: removeCommas(entry.debitOFR),
            debitUSDOFR: removeCommas(entry.debitUSDOFR),
            debitLLOFR: removeCommas(entry.debitExOFR),
            creditOFR: removeCommas(entry.creditOFR),
            creditUSDOFR: removeCommas(entry.creditUSDOFR),
            creditLLOFR: removeCommas(entry.creditExOFR),
          };

          if (type === "G") {
            return {
              ...base,
              debit: "0",
              debitUSD: "0",
              debitLL: "0",
              credit: "0",
              creditUSD: "0",
              creditLL: "0",
            };
          }

          return {
            ...base,
            debit: removeCommas(entry.debit),
            debitUSD: removeCommas(entry.debitUSD),
            debitLL: removeCommas(entry.debitEx),
            credit: removeCommas(entry.credit),
            creditUSD: removeCommas(entry.creditUSD),
            creditLL: removeCommas(entry.creditEx),
          };
        }),
    };
  };

  const buildEditPayload = () => {
    const details = entries
      .filter((e) => {
        const isZero = (v) => {
          const n = parseNumber(v);
          return !n || n === 0;
        };
        const isEmptyRow =
          !e.accountId &&
          !e.customerId &&
          !e.supplierId &&
          isZero(e.debit) &&
          isZero(e.credit) &&
          isZero(e.debitOFR) &&
          isZero(e.creditOFR);
        return !isEmptyRow;
      })
      .map((entry) => {
        const common = {
          accountId: entry.accountId || undefined,
          customerId: entry.customerId || undefined,
          supplierId: entry.supplierId || undefined,
          description: entry.description ?? "",
          currency: entry.currency ?? "",
          exchangeRateEURtoUSD: nzNumStr(entry.exchangeRateEURtoUSD),
          exchangeRate: nzNumStr(entry.exchangeRate),
          docNbr: entry.documentNbr ?? "",
          // OFR
          debitOFR: nzOfr(entry.debitOFR),
          debitUSDOFR: nzOfr(entry.debitUSDOFR),
          debitLLOFR: nzOfr(entry.debitExOFR),
          creditOFR: nzOfr(entry.creditOFR),
          creditUSDOFR: nzOfr(entry.creditUSDOFR),
          creditLLOFR: nzOfr(entry.creditExOFR),
        };

        const baseFields =
          type === "G"
            ? {
                debit: "0",
                debitUSD: "0",
                debitLL: "0",
                credit: "0",
                creditUSD: "0",
                creditLL: "0",
              }
            : {
                debit: nzBase(entry.debit),
                debitUSD: nzBase(entry.debitUSD),
                debitLL: nzBase(entry.debitEx),
                credit: nzBase(entry.credit),
                creditUSD: nzBase(entry.creditUSD),
                creditLL: nzBase(entry.creditEx),
              };

        return { ...common, ...baseFields };
      });

    return { date, jvType: type, details };
  };

  // -------- CREATE (POST) --------
  const handleSubmit = async () => {
    const isZero = (v) => {
      const n = parseNumber(v);
      return !n || n === 0;
    };

    const isEmptyRow = (e) =>
      !e.accountId &&
      !e.customerId &&
      !e.supplierId &&
      isZero(e.debit) &&
      isZero(e.credit) &&
      isZero(e.debitOFR) &&
      isZero(e.creditOFR);

    const effectiveEntries = entries.filter((e) => !isEmptyRow(e));

    try {
      if (effectiveEntries.length === 0) {
        setNotification({
          visible: true,
          type: "error",
          message: "Please add at least one non-empty entry.",
          onConfirm: null,
        });
        return;
      }

      const invalidEntries = effectiveEntries.filter(
        (e) => !e.accountId && !e.customerId && !e.supplierId
      );
      if (invalidEntries.length > 0) {
        setNotification({
          visible: true,
          type: "error",
          message: "Each row must pick an Account, Customer, or Supplier.",
          onConfirm: null,
        });
        return;
      }

      if (!type) {
        setNotification({
          type: "error",
          message: "Please select a type for the Journal Voucher.",
          visible: true,
          onConfirm: null,
        });
        return;
      }
      if (!date) {
        setNotification({
          type: "error",
          message: "Please select a date for the Journal Voucher.",
          visible: true,
          onConfirm: null,
        });
        return;
      }

      const payload = buildCreatePayload();
      const response = await axios.post(`${baseUrl}/journal-vouchers`, payload);

      if (response.status === 201) {
        const created = response.data;
        setNotification({
          visible: true,
          type: "success",
          message: "Journal Voucher saved.",
          onConfirm: null,
        });

        if (created && created.id) {
          setEditingId(created.id);
          setIsSaved(true);
          setIsEditing(false);
          await fetchJournalVoucherById(created.id);
        } else {
          setIsSaved(true);
          setIsEditing(false);
        }
      }
    } catch (error) {
      setNotification({
        visible: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          "Failed to submit the journal voucher. Please try again.",
        onConfirm: null,
      });
    }
  };

  // -------- UPDATE (PUT) --------
  const handleSaveEdit = async () => {
    if (!editingId) {
      setNotification({
        visible: true,
        type: "error",
        message: "No voucher selected to edit.",
        onConfirm: null,
      });
      return;
    }

    try {
      const payload = buildEditPayload();
      const response = await axios.put(
        `${baseUrl}/journal-vouchers/${editingId}`,
        payload
      );

      if (response.status === 200) {
        setNotification({
          visible: true,
          type: "success",
          message: "Journal Voucher updated successfully!",
          onConfirm: null,
        });

        setIsEditing(false);
        setIsSaved(true);
        await fetchJournalVoucherById(editingId);
      }
    } catch (error) {
      setNotification({
        visible: true,
        type: "error",
        message:
          error?.response?.data?.message ||
          "Failed to update the journal voucher. Please try again.",
        onConfirm: null,
      });
    }
  };

  // ====== PAGINATED fetch for the modal list ======
  const fetchJournalData = async (pageArg = 1, seqArg = "", kindArg = "") => {
    const base = `${baseUrl}/journal-vouchers/v1`;

    const seq = (seqArg || "").replace(/\D+/g, "");
    const kind = (kindArg || "").trim();

    const qs = new URLSearchParams();
    qs.set("page", String(pageArg));
    qs.set("limit", "100");
    if (kind) qs.set("type", kind);
    if (seq) qs.set("seq", seq);

    const url = seq
      ? `${base}/search-by-seq?${qs.toString()}`
      : `${base}/list?${qs.toString()}`;

    const response = await axios.get(url);
    return response.data;
  };

  useEffect(() => {
    if (isJournalListOpen) {
      (async () => {
        try {
          setLoading(true);
          setSummaryPage(1);
          const digits = (summarySeq || "").replace(/\D+/g, "");
          const res = await fetchJournalData(1, digits, kindFilter);

          setJournalData(res.data || []);
          setHasMoreSummary(Boolean(res.hasMore));
        } catch (error) {
          setJournalData([]);
          setHasMoreSummary(false);
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJournalListOpen]);

  const handleSearchSeqChange = (val) => {
    const digits = (val || "").replace(/\D+/g, "");
    setSummarySeq(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setSummaryPage(1);
        const res = await fetchJournalData(1, digits, kindFilter);

        setJournalData(res.data || []);
        setHasMoreSummary(Boolean(res.hasMore));
      } catch (e) {
        setJournalData([]);
        setHasMoreSummary(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleLoadMore = async () => {
    if (!hasMoreSummary || loadingMoreSummary) return;
    try {
      setLoadingMoreSummary(true);
      const next = summaryPage + 1;

      const digits = (summarySeq || "").replace(/\D+/g, "");
      const res = await fetchJournalData(next, digits, kindFilter);

      setJournalData((prev) => [...prev, ...(res.data || [])]);
      setSummaryPage(next);
      setHasMoreSummary(Boolean(res.hasMore));
    } catch (e) {
      // ignore
    } finally {
      setLoadingMoreSummary(false);
    }
  };

  const fetchJournalVoucherById = async (id) => {
    try {
      const { data: jv } = await axios.get(
        `${baseUrl}/journal-vouchers/${id}`
      );

      setDate(jv.date);
      setType(jv.jvType);
      setEditingId(jv.id);
      setIsSaved(true);
      setIsEditing(false);

      const rows = (jv.details || []).map((d) => {
        const entityNumber =
          d.account?.accountNumber ||
          d.supplier?.supplierAccountNumber ||
          d.customer?.customerAccountNumber ||
          "";
        const entityName =
          d.account?.arabicAccountName ||
          d.supplier?.supplierName ||
          d.customer?.customerName ||
          "";

        return {
          rid: makeRid(),
          detailId: d.id ?? null,

          originalAccountId: d.accountId ?? null,
          originalCustomerId: d.customerId ?? null,
          originalSupplierId: d.supplierId ?? null,

          accountId: d.accountId ?? null,
          customerId: d.customerId ?? null,
          supplierId: d.supplierId ?? null,
          accountNumber: entityNumber,
          accountName: entityName,
          type: d.jvType,
          currency: d.currency || "",
          debit: d.dr.toString(),
          credit: d.cr.toString(),
          debitOFR: d.drOFR.toString(),
          creditOFR: d.crOFR.toString(),
          exchangeRate: d.exRateUSD.toString(),
          exchangeRateEURtoUSD: d.exRateEUROToUSD.toString(),
          debitUSD: d.drUSD.toString(),
          creditUSD: d.crUSD.toString(),
          debitEx: d.drLL.toString(),
          creditEx: d.crLL.toString(),
          debitUSDOFR: d.drUSDOFR.toString(),
          creditUSDOFR: d.crUSDOFR.toString(),
          debitExOFR: d.drLLOFR.toString(),
          creditExOFR: d.crLLOFR.toString(),
          description: d.description || "",
          documentNbr: d.docNbr || "",
        };
      });

      setEntries(rows);
      setOriginalDetailIds(
        rows.filter((r) => r.detailId).map((r) => r.detailId)
      );
    } catch (error) {
      setNotification({
        visible: true,
        type: "error",
        message:
          "Failed to fetch journal voucher details. Please try again.",
        onConfirm: null,
      });
    }
  };

  const handleView = (journal) => {
    setIsJournalListOpen(false);
    fetchJournalVoucherById(journal.id);
    setIsEditing(false);
    setIsSaved(true);
  };

  const handleReset = () => {
    setDate("");
    setType("");
    setEntries([
      {
        rid: makeRid(),
        detailId: null,
        originalAccountId: null,
        originalCustomerId: null,
        originalSupplierId: null,

        accountId: null,
        customerId: null,
        supplierId: null,
        accountNumber: "",
        accountName: "",
        currency: "",
        debit: "",
        debitOFR: "",
        credit: "",
        creditOFR: "",
        exchangeRate: "1",
        exchangeRateEURtoUSD: "",
        debitUSD: "",
        debitUSDOFR: "",
        creditUSD: "",
        creditUSDOFR: "",
        debitEx: "",
        debitExOFR: "",
        creditEx: "",
        creditExOFR: "",
        description: "",
        documentNbr: "",
      },
    ]);

    setOriginalDetailIds([]);
    setIsEditing(false);
    setEditingId(null);
    setCurrentRowRid(null);
    setCurrentRowIndex(null);
    setIsSaved(false);
    setActiveRowIndex(null);
  };

  const handleStartEdit = () => {
    if (!isSaved || !editingId) {
      setNotification({
        visible: true,
        type: "warning",
        message: "Open or save a journal voucher first, then click Edit.",
        onConfirm: null,
      });
      return;
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!editingId) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    setIsSaved(true);
    fetchJournalVoucherById(editingId);
  };

  const editDisabled = !isSaved || isEditing;

  // ---------- RENDER HELPERS ----------
  const renderTypeSOrRVR = () => (
    <table className="general-vouchers-table">
      <thead>
        <tr>
          <th className="column-line">#</th>
          <th className="column-account-number">Acc Nb</th>
          <th className="column-account-name">Account Name</th>
          <th className="column-doc-nbr">Doc</th>
          <th className="column-description">Description</th>
          <th className="column-currency">Curr</th>
          <th className="column-exchange-rate">Rate</th>
          <th className="column-debit">Debit</th>
          <th className="column-credit">Credit</th>
          <th className="column-debit-usd">Dr USD</th>
          <th className="column-credit-usd">Cr USD</th>
          <th className="column-debit-ex">Dr LL</th>
          <th className="column-credit-ex">Cr LL</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={entry.rid}
            className={index === activeRowIndex ? "row-active" : ""}
            onClick={() => setActiveRowIndex(index)}
            onContextMenu={(e) => handleRightClick(e, index, entry.rid)}
          >
            <td className="column-line-cell">{index + 1}</td>

            <td
              className="column-account-number-cell"
              onClick={() => handleAccountNumberClick(entry.rid)}
            >
              <input
                type="text"
                value={entry.accountNumber}
                placeholder="Acc Nb"
                readOnly
                disabled={readOnlyMode}
                className="general-vouchers-input column-account-number"
              />
            </td>

            <td className="column-account-name-cell">
              <input
                type="text"
                value={entry.accountName}
                readOnly
                disabled={readOnlyMode}
                placeholder="Account Name"
                className={`general-vouchers-input account-name-input ${
                  /[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""
                }`}
              />
            </td>

            <td>
              <input
                type="text"
                value={entry.documentNbr}
                placeholder="Doc"
                onChange={(e) =>
                  handleInputChange(index, "documentNbr", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "documentNbr")}
                ref={registerInputRef(index, "documentNbr")}
                className="general-vouchers-input column-doc-nbr"
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={entry.description}
                placeholder="Description"
                onChange={(e) =>
                  handleInputChange(index, "description", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "description")}
                ref={registerInputRef(index, "description")}
                className="general-vouchers-input column-description"
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <select
                value={entry.currency}
                onChange={(e) =>
                  handleInputChange(index, "currency", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "currency")}
                ref={registerInputRef(index, "currency")}
                disabled={readOnlyMode}
                className="general-vouchers-input column-currency"
              >
                <option value="" disabled hidden>
                  -
                </option>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
                <option value="EUR">EUR</option>
              </select>
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode
                    ? formatNumber(entry.exchangeRate)
                    : entry.exchangeRate
                }
                placeholder="Rate"
                onChange={(e) =>
                  handleInputChange(index, "exchangeRate", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "exchangeRate")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "exchangeRate")}
                ref={registerInputRef(index, "exchangeRate")}
                className="general-vouchers-input column-exchange-rate"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode ? formatNumber(entry.debit) : entry.debit
                }
                placeholder="Debit"
                onChange={(e) =>
                  handleInputChange(index, "debit", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "debit")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "debit")}
                ref={registerInputRef(index, "debit")}
                className="general-vouchers-input column-debit"
                readOnly={readOnlyMode || type === "G"}
                disabled={readOnlyMode || type === "G"}
              />
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode ? formatNumber(entry.credit) : entry.credit
                }
                placeholder="Credit"
                onChange={(e) =>
                  handleInputChange(index, "credit", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "credit")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "credit")}
                ref={registerInputRef(index, "credit")}
                className="general-vouchers-input column-credit"
                readOnly={readOnlyMode || type === "G"}
                disabled={readOnlyMode || type === "G"}
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitUSD)}
                placeholder="Dr USD"
                readOnly
                disabled
                className="general-vouchers-input column-debit-usd"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditUSD)}
                placeholder="Cr USD"
                readOnly
                disabled
                className="general-vouchers-input column-credit-usd"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitEx)}
                placeholder="Dr LL"
                readOnly
                disabled
                className="general-vouchers-input column-debit-ex"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditEx)}
                placeholder="Cr LL"
                readOnly
                disabled
                className="general-vouchers-input column-credit-ex"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTypeG = () => (
    <table className="general-vouchers-table">
      <thead>
        <tr>
          <th className="column-line">#</th>
          <th className="column-account-number">Acc Nb</th>
          <th className="column-account-name">Account Name</th>
          <th className="column-doc-nbr">Doc</th>
          <th className="column-description">Description</th>
          <th className="column-currency">Curr</th>
          <th className="column-exchange-rate">Rate</th>
          <th className="column-debit-ofr">Dr OFR</th>
          <th className="column-credit-ofr">Cr OFR</th>
          <th className="column-debit-usd-ofr">Dr USD OFR</th>
          <th className="column-credit-usd-ofr">Cr USD OFR</th>
          <th className="column-debit-ex-ofr">Dr LL OFR</th>
          <th className="column-credit-ex-ofr">Cr LL OFR</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={entry.rid}
            className={index === activeRowIndex ? "row-active" : ""}
            onClick={() => setActiveRowIndex(index)}
            onContextMenu={(e) => handleRightClick(e, index, entry.rid)}
          >
            <td className="column-line-cell">{index + 1}</td>

            <td
              className="column-account-number-cell"
              onClick={() => handleAccountNumberClick(entry.rid)}
            >
              <input
                type="text"
                value={entry.accountNumber}
                placeholder="Acc Nb"
                readOnly
                disabled={readOnlyMode}
                className="general-vouchers-input column-account-number"
              />
            </td>

            <td className="column-account-name-cell">
              <input
                type="text"
                value={entry.accountName}
                readOnly
                disabled={readOnlyMode}
                placeholder="Account Name"
                className={`general-vouchers-input account-name-input ${
                  /[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""
                }`}
              />
            </td>

            <td>
              <input
                type="text"
                value={entry.documentNbr}
                placeholder="Doc"
                onChange={(e) =>
                  handleInputChange(index, "documentNbr", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "documentNbr")}
                ref={registerInputRef(index, "documentNbr")}
                className="general-vouchers-input column-doc-nbr"
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={entry.description}
                placeholder="Description"
                onChange={(e) =>
                  handleInputChange(index, "description", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "description")}
                ref={registerInputRef(index, "description")}
                className="general-vouchers-input column-description"
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <select
                value={entry.currency}
                onChange={(e) =>
                  handleInputChange(index, "currency", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "currency")}
                ref={registerInputRef(index, "currency")}
                disabled={readOnlyMode}
                className="general-vouchers-input column-currency"
              >
                <option value="" disabled hidden>
                  -
                </option>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
                <option value="EUR">EUR</option>
              </select>
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode
                    ? formatNumber(entry.exchangeRate)
                    : entry.exchangeRate
                }
                placeholder="Rate"
                onChange={(e) =>
                  handleInputChange(index, "exchangeRate", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "exchangeRate")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "exchangeRate")}
                ref={registerInputRef(index, "exchangeRate")}
                className="general-vouchers-input column-exchange-rate"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode ? formatNumber(entry.debitOFR) : entry.debitOFR
                }
                placeholder="Dr OFR"
                onChange={(e) =>
                  handleInputChange(index, "debitOFR", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "debitOFR")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "debitOFR")}
                ref={registerInputRef(index, "debitOFR")}
                className="general-vouchers-input column-debit-ofr"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode ? formatNumber(entry.creditOFR) : entry.creditOFR
                }
                placeholder="Cr OFR"
                onChange={(e) =>
                  handleInputChange(index, "creditOFR", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "creditOFR")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "creditOFR")}
                ref={registerInputRef(index, "creditOFR")}
                className="general-vouchers-input column-credit-ofr"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitUSDOFR)}
                placeholder="Dr USD OFR"
                readOnly
                disabled
                className="general-vouchers-input column-debit-usd-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditUSDOFR)}
                placeholder="Cr USD OFR"
                readOnly
                disabled
                className="general-vouchers-input column-credit-usd-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitExOFR)}
                placeholder="Dr LL OFR"
                readOnly
                disabled
                className="general-vouchers-input column-debit-ex-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditExOFR)}
                placeholder="Cr LL OFR"
                readOnly
                disabled
                className="general-vouchers-input column-credit-ex-ofr"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTypeSR = () => (
    <table className="general-vouchers-table">
      <thead>
        <tr>
          <th className="column-line">#</th>
          <th className="column-account-number">Acc Nb</th>
          <th className="column-account-name">Account Name</th>
          <th className="column-doc-nbr">Doc</th>
          <th className="column-description">Description</th>
          <th className="column-currency">Curr</th>
          <th className="column-exchange-rate">Rate</th>
          <th className="column-debit">Debit</th>
          <th className="column-debit-ofr">Dr OFR</th>
          <th className="column-credit">Credit</th>
          <th className="column-credit-ofr">Cr OFR</th>
          <th className="column-debit-usd">Dr USD</th>
          <th className="column-debit-usd-ofr">Dr USD OFR</th>
          <th className="column-credit-usd">Cr USD</th>
          <th className="column-credit-usd-ofr">Cr USD OFR</th>
          <th className="column-debit-ex">Dr LL</th>
          <th className="column-debit-ex-ofr">Dr LL OFR</th>
          <th className="column-credit-ex">Cr LL</th>
          <th className="column-credit-ex-ofr">Cr LL OFR</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={entry.rid}
            className={index === activeRowIndex ? "row-active" : ""}
            onClick={() => setActiveRowIndex(index)}
            onContextMenu={(e) => handleRightClick(e, index, entry.rid)}
          >
            <td className="column-line-cell">{index + 1}</td>

            <td
              className="column-account-number-cell"
              onClick={() => handleAccountNumberClick(entry.rid)}
            >
              <input
                type="text"
                value={entry.accountNumber}
                placeholder="Acc Nb"
                readOnly
                disabled={readOnlyMode}
                className="general-vouchers-input column-account-number"
              />
            </td>

            <td className="column-account-name-cell">
              <input
                type="text"
                value={entry.accountName}
                readOnly
                disabled={readOnlyMode}
                placeholder="Account Name"
                className={`general-vouchers-input account-name-input ${
                  /[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""
                }`}
              />
            </td>

            <td>
              <input
                type="text"
                value={entry.documentNbr}
                placeholder="Doc"
                onChange={(e) =>
                  handleInputChange(index, "documentNbr", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "documentNbr")}
                ref={registerInputRef(index, "documentNbr")}
                className="general-vouchers-input column-doc-nbr"
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={entry.description}
                placeholder="Description"
                onChange={(e) =>
                  handleInputChange(index, "description", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "description")}
                ref={registerInputRef(index, "description")}
                className="general-vouchers-input column-description"
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <select
                value={entry.currency}
                onChange={(e) =>
                  handleInputChange(index, "currency", e.target.value)
                }
                onKeyDown={(e) => handleCellKeyDown(e, index, "currency")}
                ref={registerInputRef(index, "currency")}
                disabled={readOnlyMode}
                className="general-vouchers-input column-currency"
              >
                <option value="" disabled hidden>
                  -
                </option>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
                <option value="EUR">EUR</option>
              </select>
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode
                    ? formatNumber(entry.exchangeRate)
                    : entry.exchangeRate
                }
                placeholder="Rate"
                onChange={(e) =>
                  handleInputChange(index, "exchangeRate", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "exchangeRate")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "exchangeRate")}
                ref={registerInputRef(index, "exchangeRate")}
                className="general-vouchers-input column-exchange-rate"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode ? formatNumber(entry.debit) : entry.debit
                }
                placeholder="Debit"
                onChange={(e) =>
                  handleInputChange(index, "debit", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "debit")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "debit")}
                ref={registerInputRef(index, "debit")}
                className="general-vouchers-input column-debit"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitOFR)}
                placeholder="Dr OFR"
                readOnly
                disabled
                className="general-vouchers-input column-debit-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={
                  readOnlyMode ? formatNumber(entry.credit) : entry.credit
                }
                placeholder="Credit"
                onChange={(e) =>
                  handleInputChange(index, "credit", e.target.value)
                }
                onBlur={() => handleInputBlur(index, "credit")}
                onKeyDown={(e) => handleCellKeyDown(e, index, "credit")}
                ref={registerInputRef(index, "credit")}
                className="general-vouchers-input column-credit"
                readOnly={readOnlyMode}
                disabled={readOnlyMode}
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditOFR)}
                placeholder="Cr OFR"
                readOnly
                disabled
                className="general-vouchers-input column-credit-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitUSD)}
                placeholder="Dr USD"
                readOnly
                disabled
                className="general-vouchers-input column-debit-usd"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitUSDOFR)}
                placeholder="Dr USD OFR"
                readOnly
                disabled
                className="general-vouchers-input column-debit-usd-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditUSD)}
                placeholder="Cr USD"
                readOnly
                disabled
                className="general-vouchers-input column-credit-usd"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditUSDOFR)}
                placeholder="Cr USD OFR"
                readOnly
                disabled
                className="general-vouchers-input column-credit-usd-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitEx)}
                placeholder="Dr LL"
                readOnly
                disabled
                className="general-vouchers-input column-debit-ex"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.debitExOFR)}
                placeholder="Dr LL OFR"
                readOnly
                disabled
                className="general-vouchers-input column-debit-ex-ofr"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditEx)}
                placeholder="Cr LL"
                readOnly
                disabled
                className="general-vouchers-input column-credit-ex"
              />
            </td>

            <td>
              <input
                type="text"
                value={formatNumber(entry.creditExOFR)}
                placeholder="Cr LL OFR"
                readOnly
                disabled
                className="general-vouchers-input column-credit-ex-ofr"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div>
      <div
        className="general-vouchers-container"
        onClick={handleCloseContextMenu}
      >
        {/* Account picker modal */}
        <AccountSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={handleAccountSelection}
        />

        {/* Journal list modal */}
        <JournalListsModal
          isOpen={isJournalListOpen}
          onClose={() => setIsJournalListOpen(false)}
          journalData={journalData}
          onView={handleView}
          onLoadMore={handleLoadMore}
          hasMore={hasMoreSummary}
          loadingMoreSummary={loadingMoreSummary}
          searchSeq={summarySeq}
          onSearchSeqChange={handleSearchSeqChange}
          kindFilter={kindFilter}
          onKindFilterChange={(val) => {
            setKindFilter(val);
            const digits = (summarySeq || "").replace(/\D+/g, "");
            (async () => {
              try {
                setLoading(true);
                setSummaryPage(1);
                const res = await fetchJournalData(1, digits, val);
                setJournalData(res.data || []);
                setHasMoreSummary(Boolean(res.hasMore));
              } catch (e) {
                setJournalData([]);
                setHasMoreSummary(false);
              } finally {
                setLoading(false);
              }
            })();
          }}
        />

        {/* HEADER */}
        <div className="general-vouchers-header">
          <div className="header-left">
            <h2 className="general-vouchers-title">Journal Voucher</h2>
            <span className={statusClass}>{statusLabel}</span>
          </div>

          <div className="header-right">
            <div className="date-type">
              <label className="general-vouchers-label">
                Date:
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={readOnlyMode}
                  className="general-vouchers-input"
                />
              </label>
              <label className="general-vouchers-label">
                Type:
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  required
                  disabled={readOnlyMode}
                  className="general-vouchers-input"
                >
                  <option value="" disabled hidden>
                    Select Type
                  </option>
                  <option value="S">S – Normal</option>
                  <option value="G">G – Opening / OFR only</option>
                  <option value="SR">SR – Revaluation</option>
                  <option value="RVR">RVR – Reverse OFR</option>
                </select>
              </label>
            </div>

            <div className="header-actions">
              <button className="new-btn" onClick={handleReset}>
                New
              </button>

              <button
                className="edit-journal-voucher"
                onClick={handleStartEdit}
                disabled={editDisabled}
                title={!isSaved ? "Open or save a voucher first" : ""}
              >
                Edit
              </button>

              {isEditing && (
                <button
                  className="edit-journal-voucher"
                  onClick={handleCancelEdit}
                >
                  Cancel Edit
                </button>
              )}

              <button
                className="open-journal-list-btn"
                onClick={() => setIsJournalListOpen(true)}
              >
                Open List
              </button>

              {!isSaved && !isEditing && (
                <button
                  className="general-vouchers-submit-btn"
                  onClick={handleSubmit}
                  disabled={submitBlocked}
                >
                  Submit
                </button>
              )}

              {isEditing && (
                <button
                  className="general-vouchers-submit-btn"
                  onClick={handleSaveEdit}
                  disabled={submitBlocked}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABLE AREA */}
        <div className="general-vouchers-table-container">
          {(!type || type === "S" || type === "RVR") && renderTypeSOrRVR()}
          {type === "G" && renderTypeG()}
          {type === "SR" && renderTypeSR()}
        </div>

        {/* Add row */}
        <div className="general-vouchers-add-row-container">
          <button
            className="general-vouchers-new-btn"
            onClick={handleAddRow}
            disabled={readOnlyMode}
            title={readOnlyMode ? "Click Edit to modify rows" : ""}
          >
            Add Row
          </button>
        </div>

        {/* SUMMARY */}
        <div className="general-vouchers-summary">
          {/* Balance helper */}
          <div className="summary-row summary-actions-row">
            <button
              type="button"
              className="balance-last-row-button"
              onClick={fillBalanceOnLastRow}
              disabled={readOnlyMode || type === "G"}
            >
              Balance last row (Base)
            </button>
          </div>

          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit (Base):{" "}
              <span
                className={`number ${
                  type === "G" ? "" : isEqualBase ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(totalDebitBase)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit (Base):{" "}
              <span
                className={`number ${
                  type === "G" ? "" : isEqualBase ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(totalCreditBase)}
              </span>
            </span>
            <span className="summary-total-txt">
              Diff (Base):{" "}
              <span
                className={`number ${
                  diffBase === 0 ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(diffBase)}
              </span>
            </span>
          </div>

          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit OFR:{" "}
              <span
                className={`number ${
                  type === "G"
                    ? isEqualOFR
                      ? "equal"
                      : "not-equal"
                    : ""
                }`}
              >
                {formatNumber(totalDebitOFR)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit OFR:{" "}
              <span
                className={`number ${
                  type === "G"
                    ? isEqualOFR
                      ? "equal"
                      : "not-equal"
                    : ""
                }`}
              >
                {formatNumber(totalCreditOFR)}
              </span>
            </span>
            <span className="summary-total-txt">
              Diff (OFR):{" "}
              <span
                className={`number ${
                  diffOFR === 0 ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(diffOFR)}
              </span>
            </span>
          </div>

          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit USD:{" "}
              <span
                className={`number ${
                  isUSDEqual ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(totalDebitUSD)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit USD:{" "}
              <span
                className={`number ${
                  isUSDEqual ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(totalCreditUSD)}
              </span>
            </span>
          </div>

          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit LL:{" "}
              <span
                className={`number ${
                  isLLEqual ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(totalDebitLL)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit LL:{" "}
              <span
                className={`number ${
                  isLLEqual ? "equal" : "not-equal"
                }`}
              >
                {formatNumber(totalCreditLL)}
              </span>
            </span>
          </div>
        </div>

        {/* Context menu */}
        {contextMenu.visible && !readOnlyMode && (
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              className="context-menu-item"
              onClick={handleDuplicateRow}
            >
              Duplicate row
            </button>
            <button
              className="context-menu-item"
              onClick={handleDeleteRow}
            >
              Delete row
            </button>
          </div>
        )}

        {/* Notifications */}
        {notification.visible && (
          <NotificationModal
            type={notification.type}
            message={notification.message}
            onClose={() =>
              setNotification({ ...notification, visible: false })
            }
            onConfirm={notification.onConfirm}
            confirmLabel="OK"
            cancelLabel={
              notification.type === "warning" ? "Cancel" : null
            }
          />
        )}
      </div>
    </div>
  );
};

export default JournalVoucherPage;
