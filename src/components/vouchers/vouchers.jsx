// JournalVoucherPage.jsx - COMPLETE WITH AUTO-CALCULATE EXCHANGE RATE
import React, { useState, useEffect, useRef } from "react";
import "./vouchers.css";
import AccountSelectionModal from "./acc-modal-selection";
import { axiosClient } from "../api/axiosClient";
import NotificationModal from "../recievables/NotificationModal";
import JournalListsModal from "./journal-list-modal";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";

const JournalVoucherPage = () => {
  const [isJournalListOpen, setIsJournalListOpen] = useState(false);
  const [journalData, setJournalData] = useState([]);
  const [loading, setLoading] = useState(false);

  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const isOFRType = (t) => ["G", "RG", "PRG"].includes(String(t || "").toUpperCase());
  const isBaseType = (t) => ["S", "R", "RVR", "PR"].includes(String(t || "").toUpperCase());

  const [summarySeq, setSummarySeq] = useState("");
  const searchDebounceRef = useRef();
  const [kindFilter, setKindFilter] = useState("");
  const [searchText, setSearchText] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [originalDetailIds, setOriginalDetailIds] = useState([]);

  const [summaryPage, setSummaryPage] = useState(1);
  const [hasMoreSummary, setHasMoreSummary] = useState(true);
  const [loadingMoreSummary, setLoadingMoreSummary] = useState(false);

  const { id } = useParams();
  const navigate = useNavigate();

  const [notification, setNotification] = useState({
    visible: false,
    type: "",
    message: "",
    onConfirm: null,
  });

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
    rowRid: null,
    clickedField: null,
    clickedValue: null,
  });

  const [activeFilter, setActiveFilter] = useState(null);
// activeFilter: { field, type: 'eq'|'nonzero'|'contains'|'gt'|'lt', value?, label }
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRowRid, setCurrentRowRid] = useState(null);
  const [activeRowIndex, setActiveRowIndex] = useState(null);

  const typeSelectRef = useRef(null);
  const actionRef = useRef({});

  const makeRid = () => `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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
      currency: "USD",
      debit: "",
      debitOFR: "",
      credit: "",
      creditOFR: "",
      exchangeRate: "89500",
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

  const readOnlyMode = isSaved && !isEditing;
  const isTableDisabled = !date || !type || readOnlyMode;

  const statusLabel = !isSaved ? "New" : isEditing ? "Editing" : "Saved";
  const statusClass =
    !isSaved
      ? "status-pill status-new"
      : isEditing
      ? "status-pill status-editing"
      : "status-pill status-saved";

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

  const normType = (t) => String(t || "").toUpperCase().trim();

  const apiTypeToUiType = (jv) => {
    const t = normType(jv?.jvType);
    if (t === "RTN") {
      const details = jv?.details || [];
      const hasBase = details.some(
        (d) => parseNumber(d?.dr) !== 0 || parseNumber(d?.cr) !== 0
      );
      const hasOFR = details.some(
        (d) => parseNumber(d?.drOFR) !== 0 || parseNumber(d?.crOFR) !== 0
      );
      if (hasOFR && !hasBase) return "RG";
      return "R";
    }
    if (t === "PR") {
      const details = jv?.details || [];
      const hasBase = details.some(
        (d) => parseNumber(d?.dr) !== 0 || parseNumber(d?.cr) !== 0
      );
      const hasOFR = details.some(
        (d) => parseNumber(d?.drOFR) !== 0 || parseNumber(d?.crOFR) !== 0
      );
      if (hasOFR && !hasBase) return "PRG";
      return "PR";
    }
    return t;
  };

  const uiTypeToApiType = (uiType) => {
    const t = normType(uiType);
    if (t === "R" || t === "RG") return "RTN";
    return t;
  };

  const handleExportToExcel = () => {
    if (!isSaved || !editingId) {
      setNotification({
        visible: true,
        type: "warning",
        message: "Please open or save a journal voucher first before exporting.",
        onConfirm: null,
      });
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      const headerData = [
        ["Journal Voucher Export"],
        [],
        ["Date:", date || ""],
        ["Type:", type || ""],
        ["Status:", statusLabel],
        [],
      ];

      let columns = [];
      if (isOFRType(type)) {
        columns = ["#", "Acc Number", "Account Name", "Doc", "Description", "Currency", "Rate", "Dr OFR", "Cr OFR", "Dr USD OFR", "Cr USD OFR", "Dr LL OFR", "Cr LL OFR"];
      } else if (type === "SR") {
        columns = ["#", "Acc Number", "Account Name", "Doc", "Description", "Currency", "Rate", "Debit", "Dr OFR", "Credit", "Cr OFR", "Dr USD", "Dr USD OFR", "Cr USD", "Cr USD OFR", "Dr LL", "Dr LL OFR", "Cr LL", "Cr LL OFR"];
      } else {
        columns = ["#", "Acc Number", "Account Name", "Doc", "Description", "Currency", "Rate", "Debit", "Credit", "Dr USD", "Cr USD", "Dr LL", "Cr LL"];
      }

      const dataRows = entries.map((entry, index) => {
        const baseRow = [index + 1, entry.accountNumber || "", entry.accountName || "", entry.documentNbr || "", entry.description || "", entry.currency || "", formatNumber(entry.exchangeRate)];
        if (isOFRType(type)) {
          return [...baseRow, formatNumber(entry.debitOFR), formatNumber(entry.creditOFR), formatNumber(entry.debitUSDOFR), formatNumber(entry.creditUSDOFR), formatNumber(entry.debitExOFR), formatNumber(entry.creditExOFR)];
        } else if (type === "SR") {
          return [...baseRow, formatNumber(entry.debit), formatNumber(entry.debitOFR), formatNumber(entry.credit), formatNumber(entry.creditOFR), formatNumber(entry.debitUSD), formatNumber(entry.debitUSDOFR), formatNumber(entry.creditUSD), formatNumber(entry.creditUSDOFR), formatNumber(entry.debitEx), formatNumber(entry.debitExOFR), formatNumber(entry.creditEx), formatNumber(entry.creditExOFR)];
        } else {
          return [...baseRow, formatNumber(entry.debit), formatNumber(entry.credit), formatNumber(entry.debitUSD), formatNumber(entry.creditUSD), formatNumber(entry.debitEx), formatNumber(entry.creditEx)];
        }
      });

      const totalDebitBase = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debit), 0));
      const totalCreditBase = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.credit), 0));
      const totalDebitOFR = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitOFR), 0));
      const totalCreditOFR = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditOFR), 0));
      const totalDebitUSD = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitUSD), 0));
      const totalCreditUSD = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditUSD), 0));
      const totalDebitLL = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitEx), 0));
      const totalCreditLL = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditEx), 0));
      const diffBase = totalDebitBase - totalCreditBase;
      const diffOFR = totalDebitOFR - totalCreditOFR;

      const summaryData = [[], ["SUMMARY"], []];
      if (!isOFRType(type)) {
        summaryData.push(["Total Debit (Base):", formatNumber(totalDebitBase)], ["Total Credit (Base):", formatNumber(totalCreditBase)], ["Difference (Base):", formatNumber(diffBase)], []);
      }
      if (isOFRType(type) || type === "SR") {
        summaryData.push(["Total Debit OFR:", formatNumber(totalDebitOFR)], ["Total Credit OFR:", formatNumber(totalCreditOFR)], ["Difference (OFR):", formatNumber(diffOFR)], []);
      }
      summaryData.push(["Total Debit USD:", formatNumber(totalDebitUSD)], ["Total Credit USD:", formatNumber(totalCreditUSD)], [], ["Total Debit LL:", formatNumber(totalDebitLL)], ["Total Credit LL:", formatNumber(totalCreditLL)]);

      const wsData = [...headerData, columns, ...dataRows, ...summaryData];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const colWidths = columns.map((col, idx) => {
        if (idx === 0) return { wch: 5 };
        if (idx === 1) return { wch: 15 };
        if (idx === 2) return { wch: 30 };
        if (idx === 3) return { wch: 15 };
        if (idx === 4) return { wch: 30 };
        return { wch: 15 };
      });
      ws["!cols"] = colWidths;

      const headerRange = XLSX.utils.decode_range(ws["!ref"]);
      const headerRowIndex = headerData.length;
      for (let C = headerRange.s.c; C <= headerRange.e.c; ++C) {
        const address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
        if (!ws[address]) continue;
        ws[address].s = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: "4F81BD" } }, alignment: { horizontal: "center", vertical: "center" } };
      }

      XLSX.utils.book_append_sheet(wb, ws, "Journal Voucher");
      const typeLabel = type === "S" ? "Normal" : type === "G" ? "Opening" : type === "RG" ? "Return_OFR" : type === "R" ? "Return" : type === "SR" ? "Revaluation" : "Reverse";
      const filename = `JV_${typeLabel}_${date || "Unknown"}_${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, filename);

      setNotification({ visible: true, type: "success", message: "Journal Voucher exported successfully!", onConfirm: null });
    } catch (error) {
      console.error("Export error:", error);
      setNotification({ visible: true, type: "error", message: "Failed to export journal voucher. Please try again.", onConfirm: null });
    }
  };

  const cleanNumericInput = (s = "") => s.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

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
    const id = entity?.id ?? entity?.accountId ?? entity?.customerId ?? entity?.supplierId ?? null;
    const typ = entity?.entityType || (entity?.supplierId ? "supplier" : entity?.customerId ? "customer" : "account");
    const number = entity?.accountNumber ?? entity?.supplierAccountNumber ?? entity?.customerAccountNumber ?? entity?.number ?? "";
    const name = entity?.accountName ?? entity?.arabicAccountName ?? entity?.supplierName ?? entity?.customerName ?? "";
    const numericId = id !== null && id !== undefined && !Number.isNaN(Number(id)) ? Number(id) : id;
    return { id: numericId, type: typ, number, name };
  };

  const inputRefs = useRef({});
  const [pendingFocus, setPendingFocus] = useState(null);

  const registerInputRef = (rowIndex, field) => (el) => {
    if (!inputRefs.current[rowIndex]) inputRefs.current[rowIndex] = {};
    if (el) {
      inputRefs.current[rowIndex][field] = el;
    } else if (inputRefs.current[rowIndex]) {
      delete inputRefs.current[rowIndex][field];
    }
  };

  // ✅ UPDATED: Added LL fields to keyboard navigation
  const INPUT_ORDER_BY_TYPE = {
    S:   ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debit", "credit", "debitUSD", "creditUSD", "debitEx", "creditEx"],
    R:   ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debit", "credit", "debitUSD", "creditUSD", "debitEx", "creditEx"],
    G:   ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debitOFR", "creditOFR", "debitUSDOFR", "creditUSDOFR", "debitExOFR", "creditExOFR"],
    RG:  ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debitOFR", "creditOFR", "debitUSDOFR", "creditUSDOFR", "debitExOFR", "creditExOFR"],
    SR:  ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debit", "credit", "debitUSD", "debitUSDOFR", "creditUSD", "creditUSDOFR", "debitEx", "debitExOFR", "creditEx", "creditExOFR"],
    RVR: ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debit", "credit", "debitUSD", "creditUSD", "debitEx", "creditEx"],
    default: ["accountNumber", "documentNbr", "description", "currency", "exchangeRate", "debit", "credit"],
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
    const idt = setTimeout(() => {
      const el2 = inputRefs.current?.[rowIndex]?.[field];
      if (el2 && typeof el2.focus === "function") {
        el2.focus();
        if (typeof el2.select === "function") el2.select();
        setPendingFocus(null);
      }
    }, 0);
    return () => clearTimeout(idt);
  }, [pendingFocus, entries.length]);

  // Auto-focus first row when date+type are both set and table becomes enabled
  const prevTableDisabledRef = useRef(true);
  useEffect(() => {
    const wasDisabled = prevTableDisabledRef.current;
    prevTableDisabledRef.current = isTableDisabled;
    if (wasDisabled && !isTableDisabled) {
      setTimeout(() => {
        const el = inputRefs.current?.[0]?.["accountNumber"];
        if (el && !el.disabled) el.focus();
      }, 50);
    }
  }, [isTableDisabled]);

  // Ctrl+S to submit or save edit
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const { submitBlocked, isEditing, isSaved, handleSubmit, handleSaveEdit } = actionRef.current;
        if (submitBlocked) return;
        if (isEditing) handleSaveEdit();
        else if (!isSaved) handleSubmit();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const runJournalListSearch = async (override = {}) => {
    try {
      setLoading(true);
      setSummaryPage(1);
      const digits = (override.summarySeq ?? summarySeq ?? "").replace(/\D+/g, "");
      const k = override.kindFilter ?? kindFilter ?? "";
      const q = override.searchText ?? searchText ?? "";
      const res = await fetchJournalData(1, digits, k, q);
      setJournalData(res.data || []);
      setHasMoreSummary(Boolean(res.hasMore));
    } catch (e) {
      setJournalData([]);
      setHasMoreSummary(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchJournalVoucherById(Number(id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAddRow = () => {
    if (isTableDisabled) return;
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

  // ✅ UPDATED: recalcEntry with AUTO-CALCULATE EXCHANGE RATE (for BOTH USD and LL)
  const recalcEntry = (entry, changedField = null) => {
    const d = parseNumber(entry.debit);
    const c = parseNumber(entry.credit);
    let r = Math.max(1, parseNumber(entry.exchangeRate || 1));

    // ✅ AUTO-CALCULATE EXCHANGE RATE for USD currency
    if (entry.currency === "USD") {
      // When user enters Dr LL, calculate rate = LL / USD
      if (changedField === "debitEx") {
        const usdAmount = parseNumber(entry.debit);
        const llAmount = parseNumber(entry.debitEx);
        if (usdAmount > 0 && llAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
      // When user enters Cr LL, calculate rate = LL / USD
      else if (changedField === "creditEx") {
        const usdAmount = parseNumber(entry.credit);
        const llAmount = parseNumber(entry.creditEx);
        if (usdAmount > 0 && llAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
      // When user enters Dr LL OFR, calculate rate = LL / USD
      else if (changedField === "debitExOFR") {
        const usdAmount = parseNumber(entry.debitOFR);
        const llAmount = parseNumber(entry.debitExOFR);
        if (usdAmount > 0 && llAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
      // When user enters Cr LL OFR, calculate rate = LL / USD
      else if (changedField === "creditExOFR") {
        const usdAmount = parseNumber(entry.creditOFR);
        const llAmount = parseNumber(entry.creditExOFR);
        if (usdAmount > 0 && llAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
    }

    // AUTO-CALCULATE EXCHANGE RATE for LL currency — user types the USD amount
    if (entry.currency === "LL") {
      // User types Dr USD → rate = Dr LL / Dr USD
      if (changedField === "debitUSD") {
        const llAmount = parseNumber(entry.debit);
        const usdAmount = parseNumber(entry.debitUSD);
        if (llAmount > 0 && usdAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
      // User types Cr USD → rate = Cr LL / Cr USD
      else if (changedField === "creditUSD") {
        const llAmount = parseNumber(entry.credit);
        const usdAmount = parseNumber(entry.creditUSD);
        if (llAmount > 0 && usdAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
      // User types Dr USD OFR → rate = Dr OFR / Dr USD OFR
      else if (changedField === "debitUSDOFR") {
        const llAmount = parseNumber(entry.debitOFR);
        const usdAmount = parseNumber(entry.debitUSDOFR);
        if (llAmount > 0 && usdAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
      // User types Cr USD OFR → rate = Cr OFR / Cr USD OFR
      else if (changedField === "creditUSDOFR") {
        const llAmount = parseNumber(entry.creditOFR);
        const usdAmount = parseNumber(entry.creditUSDOFR);
        if (llAmount > 0 && usdAmount > 0) {
          r = llAmount / usdAmount;
          entry.exchangeRate = String(r);
        }
      }
    }

    entry.debitUSD = 0;
    entry.creditUSD = 0;
    entry.debitEx = 0;
    entry.creditEx = 0;
    entry.debitUSDOFR = 0;
    entry.creditUSDOFR = 0;
    entry.debitExOFR = 0;
    entry.creditExOFR = 0;

    if (type === "S" || type === "R") {
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

    if (type === "G" || type === "RG") {
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

  const NUM_FIELDS = new Set([
    "debit", "credit", "debitOFR", "creditOFR", "exchangeRate", "exchangeRateEURtoUSD",
    "debitUSD", "creditUSD", "debitUSDOFR", "creditUSDOFR", "debitEx", "creditEx", "debitExOFR", "creditExOFR",
  ]);

  // ✅ UPDATED: Added LL fields to editable list
  const EDITABLE_NUM_FIELDS = new Set([
    "debit", "credit", "debitOFR", "creditOFR", "exchangeRate", "exchangeRateEURtoUSD",
    "debitEx", "creditEx", "debitExOFR", "creditExOFR",
    "debitUSD", "creditUSD", "debitUSDOFR", "creditUSDOFR",
  ]);

  // ── Filter helpers ──────────────────────────────────────────────────────────
  const CLASS_TO_FIELD = {
    "column-account-number": "accountNumber",
    "column-account-name": "accountName",
    "column-doc-nbr": "documentNbr",
    "column-description": "description",
    "column-currency": "currency",
    "column-exchange-rate": "exchangeRate",
    "column-debit": "debit",
    "column-credit": "credit",
    "column-debit-usd": "debitUSD",
    "column-credit-usd": "creditUSD",
    "column-debit-ex": "debitEx",
    "column-credit-ex": "creditEx",
    "column-debit-ofr": "debitOFR",
    "column-credit-ofr": "creditOFR",
    "column-debit-usd-ofr": "debitUSDOFR",
    "column-credit-usd-ofr": "creditUSDOFR",
    "column-debit-ex-ofr": "debitExOFR",
    "column-credit-ex-ofr": "creditExOFR",
  };

  const FIELD_LABELS = {
    accountNumber: "Account", accountName: "Account Name",
    documentNbr: "Doc Number", description: "Description",
    currency: "Currency", exchangeRate: "Rate",
    debit: "Dr", credit: "Cr",
    debitUSD: "Dr USD", creditUSD: "Cr USD",
    debitEx: "Dr LL", creditEx: "Cr LL",
    debitOFR: "Dr OFR", creditOFR: "Cr OFR",
    debitUSDOFR: "Dr USD OFR", creditUSDOFR: "Cr USD OFR",
    debitExOFR: "Dr LL OFR", creditExOFR: "Cr LL OFR",
  };

  const NUMERIC_FILTER_FIELDS = new Set([
    "debit", "credit", "debitOFR", "creditOFR", "exchangeRate",
    "debitUSD", "creditUSD", "debitEx", "creditEx",
    "debitUSDOFR", "creditUSDOFR", "debitExOFR", "creditExOFR",
  ]);

const isRowVisible = (entry) => {
  if (!activeFilter) return true;

  const { field, type, value } = activeFilter;
  const raw = entry[field];

  if (type === "eq") {
    return (
      String(raw ?? "").trim().toLowerCase() ===
      String(value ?? "").trim().toLowerCase()
    );
  }

  if (type === "nonzero") {
    return parseNumber(raw) !== 0;
  }

  if (type === "contains") {
    return String(raw ?? "")
      .toLowerCase()
      .includes(String(value ?? "").toLowerCase());
  }

  if (type === "gt") {
    return parseNumber(raw) > parseNumber(value);
  }

  if (type === "lt") {
    return parseNumber(raw) < parseNumber(value);
  }

  return true;
};

  const findNextVisibleRow = (from, direction) => {
    let r = from + direction;
    while (r >= 0 && r < entries.length) {
      if (isRowVisible(entries[r])) return r;
      r += direction;
    }
    return -1;
  };

  const closeContextMenu = () => setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, rowRid: null, clickedField: null, clickedValue: null });

  const applyFilter = (filter) => { setActiveFilter(filter); closeContextMenu(); };

  // ── DC_PAIRS ─────────────────────────────────────────────────────────────────
  const DC_PAIRS = {
    debit: "credit", credit: "debit",
    debitOFR: "creditOFR", creditOFR: "debitOFR",
    debitEx: "creditEx", creditEx: "debitEx",
    debitExOFR: "creditExOFR", creditExOFR: "debitExOFR",
    debitUSD: "creditUSD", creditUSD: "debitUSD",
    debitUSDOFR: "creditUSDOFR", creditUSDOFR: "debitUSDOFR",
  };

  // Returns true when the OPPOSITE side has a value → this field should be locked
  const isLocked = (entry, field) => {
    const opp = DC_PAIRS[field];
    return !!opp && parseNumber(entry[opp]) !== 0;
  };

  // ✅ UPDATED: Pass changed field to recalcEntry
  const handleInputChange = (index, field, value) => {
    if (isTableDisabled) return;
    const updated = [...entries];
    const entry = updated[index];
    const next = EDITABLE_NUM_FIELDS.has(field) ? cleanNumericInput(value) : value;
    entry[field] = next;
    // If this debit/credit field is non-zero, zero out the opposite side
    const opp = DC_PAIRS[field];
    if (opp && parseNumber(next) !== 0) {
      entry[opp] = "";
      // Do NOT recalcEntry here — it would overwrite the user's typed value
      // before the actual changedField recalc below has a chance to use it
    }
    if (NUM_FIELDS.has(field) || field === "currency") {
      recalcEntry(entry, field);
    }
    setEntries(updated);
  };

  const handleInputBlur = (index, field) => {
    if (isTableDisabled) return;
    const updated = [...entries];
    const entry = updated[index];
    if (EDITABLE_NUM_FIELDS.has(field)) {
      entry[field] = formatNumber(entry[field]);
    }
    setEntries(updated);
  };

  const handleCellKeyDown = (e, rowIndex, field) => {
    if (isTableDisabled) return;
    if (e.key === "Enter") {
      e.preventDefault();
      const order = getInputOrder();
      const idx = order.indexOf(field);
      if (idx === -1) return;
      // Find the next non-disabled field in this row
      let nextIdx = idx + 1;
      while (nextIdx < order.length) {
        const el = inputRefs.current?.[rowIndex]?.[order[nextIdx]];
        if (!el || !el.disabled) break;
        nextIdx++;
      }
      if (nextIdx < order.length) {
        setPendingFocus({ rowIndex, field: order[nextIdx] });
        return;
      }
      const isLastRow = rowIndex === entries.length - 1;
      if (isLastRow) {
        handleAddRow();
      }
      setPendingFocus({ rowIndex: rowIndex + 1, field: order[0] });
      return;
    }
    if (e.key === "ArrowDown" && e.target.tagName !== "SELECT") {
      e.preventDefault();
      const nextRow = findNextVisibleRow(rowIndex, 1);
      if (nextRow !== -1) {
        const el = inputRefs.current?.[nextRow]?.[field];
        if (el && !el.disabled) {
          setPendingFocus({ rowIndex: nextRow, field });
        } else {
          const order2 = getInputOrder();
          for (const f of order2) {
            const el2 = inputRefs.current?.[nextRow]?.[f];
            if (el2 && !el2.disabled) { setPendingFocus({ rowIndex: nextRow, field: f }); break; }
          }
        }
      }
      return;
    }
    if (e.key === "ArrowUp" && e.target.tagName !== "SELECT") {
      e.preventDefault();
      const prevRow = findNextVisibleRow(rowIndex, -1);
      if (prevRow !== -1) {
        const el = inputRefs.current?.[prevRow]?.[field];
        if (el && !el.disabled) {
          setPendingFocus({ rowIndex: prevRow, field });
        } else {
          const order2 = getInputOrder();
          for (const f of order2) {
            const el2 = inputRefs.current?.[prevRow]?.[f];
            if (el2 && !el2.disabled) { setPendingFocus({ rowIndex: prevRow, field: f }); break; }
          }
        }
      }
      return;
    }
    if (e.key === "ArrowRight") {
      const isSelect = e.target.tagName === "SELECT";
      if (!isSelect) {
        const val = e.target.value || "";
        if (e.target.selectionStart !== val.length || e.target.selectionEnd !== val.length) return;
      }
      e.preventDefault();
      const order2 = getInputOrder();
      const idx2 = order2.indexOf(field);
      if (idx2 === -1) return;
      let nextIdx2 = idx2 + 1;
      while (nextIdx2 < order2.length) {
        const el = inputRefs.current?.[rowIndex]?.[order2[nextIdx2]];
        if (!el || !el.disabled) break;
        nextIdx2++;
      }
      if (nextIdx2 < order2.length) setPendingFocus({ rowIndex, field: order2[nextIdx2] });
      return;
    }
    if (e.key === "ArrowLeft") {
      const isSelect = e.target.tagName === "SELECT";
      if (!isSelect && (e.target.selectionStart !== 0 || e.target.selectionEnd !== 0)) return;
      e.preventDefault();
      const order2 = getInputOrder();
      const idx2 = order2.indexOf(field);
      if (idx2 === -1) return;
      let prevIdx2 = idx2 - 1;
      while (prevIdx2 >= 0) {
        const el = inputRefs.current?.[rowIndex]?.[order2[prevIdx2]];
        if (!el || !el.disabled) break;
        prevIdx2--;
      }
      if (prevIdx2 >= 0) setPendingFocus({ rowIndex, field: order2[prevIdx2] });
      return;
    }
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

  const handleModalClose = () => {
    setIsModalOpen(false);
    if (currentRowRid !== null) {
      const rowIndex = entries.findIndex((r) => r.rid === currentRowRid);
      if (rowIndex !== -1) setPendingFocus({ rowIndex, field: "accountNumber" });
    }
  };

  const handleAccountSelection = (entity) => {
    if (isTableDisabled) return;
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
    // Auto-focus the next field after accountNumber so the user can continue without mouse
    const rowIndex = entries.findIndex((r) => r.rid === currentRowRid);
    if (rowIndex !== -1) {
      const order = getInputOrder();
      const idx = order.indexOf("accountNumber");
      let nextIdx = idx + 1;
      while (nextIdx < order.length) {
        const el = inputRefs.current?.[rowIndex]?.[order[nextIdx]];
        if (!el || !el.disabled) break;
        nextIdx++;
      }
      if (nextIdx < order.length) {
        setPendingFocus({ rowIndex, field: order[nextIdx] });
      }
    }
  };

  // ── Account number direct-type support ──────────────────────────────────
  const accCacheRef = useRef([]);
  const accCacheLoadedRef = useRef(false);

  const loadAccCache = async () => {
    if (accCacheLoadedRef.current) return;
    try {
      const res = await axiosClient.get("/accounts/v1/acc-arranged");
      const flat = [];
      (res.data || []).forEach((a) => {
        flat.push({
          id: a.id,
          accountNumber: a.accountNumber,
          accountName: a.arabicAccountName || a.accountName,
          kind: "account",
        });
        if (Array.isArray(a.children)) {
          a.children.forEach((ch) => {
            const kind = ch?.isCustomer ? "customer" : ch?.isSupplier ? "supplier" : "account";
            flat.push({
              id: ch.id,
              accountNumber: ch.accountNumber,
              accountName: ch.arabicAccountName || ch.accountName,
              kind,
            });
          });
        }
      });
      accCacheRef.current = flat;
      accCacheLoadedRef.current = true;
    } catch {}
  };

  useEffect(() => { loadAccCache(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccountNumberChange = (index, value) => {
    if (isTableDisabled) return;
    setEntries((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], accountNumber: value };
      return updated;
    });
  };

  const handleAccountNumberBlur = (index) => {
    if (isTableDisabled) return;
    const entry = entries[index];
    const num = String(entry.accountNumber || "").trim();
    if (!num) {
      setEntries((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], accountId: null, customerId: null, supplierId: null, accountName: "" };
        return updated;
      });
      return;
    }
    const found = accCacheRef.current.find(
      (r) => String(r.accountNumber || "").trim().toLowerCase() === num.toLowerCase()
    );
    if (found) {
      setEntries((prev) => {
        const updated = [...prev];
        const row = { ...updated[index] };
        row.accountId = null; row.customerId = null; row.supplierId = null;
        if (found.kind === "customer") row.customerId = found.id;
        else if (found.kind === "supplier") row.supplierId = found.id;
        else row.accountId = found.id;
        row.accountName = found.accountName;
        updated[index] = row;
        return updated;
      });
    } else {
      setEntries((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], accountId: null, customerId: null, supplierId: null, accountName: "" };
        return updated;
      });
    }
  };

  const handleAccountNumberKeyDown = (e, rid) => {
    const rowIndex = entries.findIndex((r) => r.rid === rid);
    if (e.key === "Enter") {
      e.preventDefault();
      if (isTableDisabled) return;
      if (rowIndex === -1) return;
      const num = String(entries[rowIndex]?.accountNumber || "").trim();
      if (num) {
        const found = accCacheRef.current.find(
          (r) => String(r.accountNumber || "").trim().toLowerCase() === num.toLowerCase()
        );
        if (found) {
          setEntries((prev) => {
            const updated = [...prev];
            const row = { ...updated[rowIndex] };
            row.accountId = null; row.customerId = null; row.supplierId = null;
            if (found.kind === "customer") row.customerId = found.id;
            else if (found.kind === "supplier") row.supplierId = found.id;
            else row.accountId = found.id;
            row.accountName = found.accountName;
            updated[rowIndex] = row;
            return updated;
          });
          const order = getInputOrder();
          const accIdx = order.indexOf("accountNumber");
          let nextIdx = accIdx + 1;
          while (nextIdx < order.length) {
            const el = inputRefs.current?.[rowIndex]?.[order[nextIdx]];
            if (!el || !el.disabled) break;
            nextIdx++;
          }
          if (nextIdx < order.length) setPendingFocus({ rowIndex, field: order[nextIdx] });
          return;
        }
      }
      setCurrentRowRid(rid);
      setIsModalOpen(true);
      return;
    }
    if (isTableDisabled) return;
    if (rowIndex === -1) return;
    const order = getInputOrder();
    if (e.key === "ArrowRight") {
      const val = e.target.value || "";
      if (e.target.selectionStart !== val.length || e.target.selectionEnd !== val.length) return;
      e.preventDefault();
      const idx = order.indexOf("accountNumber");
      let nextIdx = idx + 1;
      while (nextIdx < order.length) {
        const el = inputRefs.current?.[rowIndex]?.[order[nextIdx]];
        if (!el || !el.disabled) break;
        nextIdx++;
      }
      if (nextIdx < order.length) setPendingFocus({ rowIndex, field: order[nextIdx] });
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextRow = findNextVisibleRow(rowIndex, 1);
      if (nextRow !== -1) {
        const el = inputRefs.current?.[nextRow]?.["accountNumber"];
        if (el && !el.disabled) setPendingFocus({ rowIndex: nextRow, field: "accountNumber" });
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevRow = findNextVisibleRow(rowIndex, -1);
      if (prevRow !== -1) {
        const el = inputRefs.current?.[prevRow]?.["accountNumber"];
        if (el && !el.disabled) setPendingFocus({ rowIndex: prevRow, field: "accountNumber" });
      }
      return;
    }
  };
  // ────────────────────────────────────────────────────────────────────────

const handleRightClick = (event, rowIndex, rowRid) => {
  if (isTableDisabled) return;
  event.preventDefault();

  setActiveRowIndex(rowIndex);

  const td = event.target.closest("td");
  let clickedField = null;
  let clickedValue = null;

  if (td) {
    // Try input/select first
    const control = td.querySelector("input, select, textarea");

    const getFieldFromClassList = (className = "") => {
      const classes = String(className).split(/\s+/);
      for (const cls of classes) {
        if (CLASS_TO_FIELD[cls]) return CLASS_TO_FIELD[cls];
      }
      return null;
    };

    // 1) detect from control classes
    clickedField =
      getFieldFromClassList(control?.className) ||
      getFieldFromClassList(td.className);

    // 2) fallback from data-field if you add it on td
    if (!clickedField) {
      clickedField = td.getAttribute("data-field") || null;
    }

    if (clickedField) {
      const raw = entries[rowIndex]?.[clickedField];
      clickedValue = raw != null ? String(raw) : "";
    }
  }

  setContextMenu({
    visible: true,
    x: event.clientX,
    y: event.clientY,
    rowIndex,
    rowRid,
    clickedField,
    clickedValue,
  });
};

  const handleDeleteRow = () => {
    if (isTableDisabled) return;
    if (contextMenu.rowRid) {
      setEntries((prev) => prev.filter((r) => r.rid !== contextMenu.rowRid));
      closeContextMenu();
      return;
    }
    if (contextMenu.rowIndex !== null) {
      setEntries((prev) => prev.filter((_, i) => i !== contextMenu.rowIndex));
      closeContextMenu();
    }
  };

  const handleDuplicateRow = () => {
    if (isTableDisabled) return;
    if (contextMenu.rowIndex == null) return;
    setEntries((prev) => {
      const row = prev[contextMenu.rowIndex];
      if (!row) return prev;
      const clone = { ...row, rid: makeRid(), detailId: null };
      return [...prev.slice(0, contextMenu.rowIndex + 1), clone, ...prev.slice(contextMenu.rowIndex + 1)];
    });
    closeContextMenu();
  };

  const handleCloseContextMenu = () => closeContextMenu();

  // ✅ FIXED: Calculate totals using USD values (not base currency values)
  // This prevents mixing USD and LL amounts in totals
  const totalDebitBase = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitUSD), 0));
  const totalCreditBase = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditUSD), 0));
  const totalDebitOFR = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitUSDOFR), 0));
  const totalCreditOFR = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditUSDOFR), 0));
  const totalDebitUSD = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitUSD), 0));
  const totalCreditUSD = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditUSD), 0));
  const totalDebitLL = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.debitEx), 0));
  const totalCreditLL = parseNumber(entries.reduce((sum, entry) => sum + parseNumber(entry.creditEx), 0));

  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  const isEqualBase = round2(totalDebitBase) === round2(totalCreditBase) && round2(totalDebitBase) !== 0;
  const isEqualOFR = round2(totalDebitOFR) === round2(totalCreditOFR) && round2(totalDebitOFR) !== 0;
  const isUSDEqual = round2(totalDebitUSD) === round2(totalCreditUSD);
  const isLLEqual = round2(totalDebitLL) === round2(totalCreditLL);
  const diffBase = round2(totalDebitBase - totalCreditBase);
  const diffOFR = round2(totalDebitOFR - totalCreditOFR);

  const submitBlocked = !type || !date || (isOFRType(type) ? !isEqualOFR : !isEqualBase);

  const fillBalanceOnLastRow = () => {
    if (isOFRType(type) || isTableDisabled) return;
    setEntries((prev) => {
      if (!prev.length) return prev;
      const totalDeb = prev.reduce((sum, e) => sum + parseNumber(e.debit), 0);
      const totalCred = prev.reduce((sum, e) => sum + parseNumber(e.credit), 0);
      const diff = round2(totalDeb - totalCred);
      if (diff === 0) return prev;
      const copy = [...prev];
      const idx = copy.length - 1;
      const last = { ...copy[idx] };
      const debitVal = parseNumber(last.debit);
      const creditVal = parseNumber(last.credit);
      if (!debitVal && diff < 0) {
        last.debit = String(Math.abs(diff));
      } else if (!creditVal && diff > 0) {
        last.credit = String(Math.abs(diff));
      } else {
        return prev;
      }
      recalcEntry(last);
      copy[idx] = last;
      return copy;
    });
  };

  const buildCreatePayload = () => {
    const removeCommas = (value) => (typeof value === "string" ? value.replace(/,/g, "") : value);
    return {
      date,
      jvType: uiTypeToApiType(type),
      details: entries
        .filter((e) => {
          const isZero = (v) => {
            const n = parseNumber(v);
            return !n || n === 0;
          };
          const isEmptyRow = !e.accountId && !e.customerId && !e.supplierId && isZero(e.debit) && isZero(e.credit) && isZero(e.debitOFR) && isZero(e.creditOFR);
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
            debitOFR: removeCommas(entry.debitOFR),
            debitUSDOFR: removeCommas(entry.debitUSDOFR),
            debitLLOFR: removeCommas(entry.debitExOFR),
            creditOFR: removeCommas(entry.creditOFR),
            creditUSDOFR: removeCommas(entry.creditUSDOFR),
            creditLLOFR: removeCommas(entry.creditExOFR),
          };
          if (isOFRType(type)) {
            return { ...base, debit: "0", debitUSD: "0", debitLL: "0", credit: "0", creditUSD: "0", creditLL: "0" };
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
        const isEmptyRow = !e.accountId && !e.customerId && !e.supplierId && isZero(e.debit) && isZero(e.credit) && isZero(e.debitOFR) && isZero(e.creditOFR);
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
          debitOFR: nzOfr(entry.debitOFR),
          debitUSDOFR: nzOfr(entry.debitUSDOFR),
          debitLLOFR: nzOfr(entry.debitExOFR),
          creditOFR: nzOfr(entry.creditOFR),
          creditUSDOFR: nzOfr(entry.creditUSDOFR),
          creditLLOFR: nzOfr(entry.creditExOFR),
        };
        const baseFields = isOFRType(type)
          ? { debit: "0", debitUSD: "0", debitLL: "0", credit: "0", creditUSD: "0", creditLL: "0" }
          : { debit: nzBase(entry.debit), debitUSD: nzBase(entry.debitUSD), debitLL: nzBase(entry.debitEx), credit: nzBase(entry.credit), creditUSD: nzBase(entry.creditUSD), creditLL: nzBase(entry.creditEx) };
        return { ...common, ...baseFields };
      });
    return { date, jvType: uiTypeToApiType(type), details };
  };

  const handleSubmit = async () => {
    const isZero = (v) => {
      const n = parseNumber(v);
      return !n || n === 0;
    };
    const isEmptyRow = (e) => !e.accountId && !e.customerId && !e.supplierId && isZero(e.debit) && isZero(e.credit) && isZero(e.debitOFR) && isZero(e.creditOFR);
    const effectiveEntries = entries.filter((e) => !isEmptyRow(e));
    try {
      if (effectiveEntries.length === 0) {
        setNotification({ visible: true, type: "error", message: "Please add at least one non-empty entry.", onConfirm: null });
        return;
      }
      const invalidEntries = effectiveEntries.filter((e) => !e.accountId && !e.customerId && !e.supplierId);
      if (invalidEntries.length > 0) {
        setNotification({ visible: true, type: "error", message: "Each row must pick an Account, Customer, or Supplier.", onConfirm: null });
        return;
      }
      if (!type) {
        setNotification({ type: "error", message: "Please select a type for the Journal Voucher.", visible: true, onConfirm: null });
        return;
      }
      if (!date) {
        setNotification({ type: "error", message: "Please select a date for the Journal Voucher.", visible: true, onConfirm: null });
        return;
      }
      const payload = buildCreatePayload();
      const response = await axiosClient.post(`/journal-vouchers`, payload);
      if (response.status === 201) {
        const created = response.data;
        setNotification({ visible: true, type: "success", message: "Journal Voucher saved.", onConfirm: null });
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
      setNotification({ visible: true, type: "error", message: error?.response?.data?.message || "Failed to submit the journal voucher. Please try again.", onConfirm: null });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) {
      setNotification({ visible: true, type: "error", message: "No voucher selected to edit.", onConfirm: null });
      return;
    }
    try {
      const payload = buildEditPayload();
      const response = await axiosClient.put(`/journal-vouchers/${editingId}`, payload);
      if (response.status === 200) {
        setNotification({ visible: true, type: "success", message: "Journal Voucher updated successfully!", onConfirm: null });
        setIsEditing(false);
        setIsSaved(true);
        await fetchJournalVoucherById(editingId);
      }
    } catch (error) {
      setNotification({ visible: true, type: "error", message: error?.response?.data?.message || "Failed to update the journal voucher. Please try again.", onConfirm: null });
    }
  };

  const fetchJournalData = async (pageArg = 1, seqArg = "", kindArg = "", qArg = "") => {
    const base = `/journal-vouchers/v1`;
    const seq = (seqArg || "").replace(/\D+/g, "");
    const kind = (kindArg || "").trim();
    const q = (qArg || "").trim();
    const qs = new URLSearchParams();
    qs.set("page", String(pageArg));
    qs.set("limit", "100");
    if (kind) qs.set("type", kind);
    if (seq) qs.set("seq", seq);
    if (q) qs.set("q", q);
    const hasSearch = !!seq || !!q || !!kind;
    const url = hasSearch ? `${base}/search-by-seq?${qs.toString()}` : `${base}/list?${qs.toString()}`;
    const response = await axiosClient.get(url);
    return response.data;
  };

  const handleSearchTextChange = (val) => {
    setSearchText(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      runJournalListSearch({ searchText: val });
    }, 300);
  };

  const handleSearchSeqChange = (val) => {
    const digits = (val || "").replace(/\D+/g, "");
    setSummarySeq(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      runJournalListSearch({ summarySeq: digits });
    }, 300);
  };

  const runSearchNow = async () => {
    try {
      setLoading(true);
      setSummaryPage(1);
      const digits = (summarySeq || "").replace(/\D+/g, "");
      const res = await fetchJournalData(1, digits, kindFilter, searchText);
      setJournalData(res.data || []);
      setHasMoreSummary(Boolean(res.hasMore));
    } catch (e) {
      setJournalData([]);
      setHasMoreSummary(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isJournalListOpen) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      runSearchNow();
    }, 300);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJournalListOpen, summarySeq, kindFilter, searchText]);

  useEffect(() => {
    if (isJournalListOpen) {
      runJournalListSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isJournalListOpen]);

  const handleLoadMore = async () => {
    if (!hasMoreSummary || loadingMoreSummary) return;
    try {
      setLoadingMoreSummary(true);
      const next = summaryPage + 1;
      const digits = (summarySeq || "").replace(/\D+/g, "");
      const res = await fetchJournalData(next, digits, kindFilter, searchText);
      setJournalData((prev) => [...prev, ...(res.data || [])]);
      setSummaryPage(next);
      setHasMoreSummary(Boolean(res.hasMore));
    } catch (e) {
    } finally {
      setLoadingMoreSummary(false);
    }
  };

  const fetchJournalVoucherById = async (id) => {
    try {
      const { data: jv } = await axiosClient.get(`/journal-vouchers/${id}`);
      setDate(jv.date);
      setType(apiTypeToUiType(jv));
      setEditingId(jv.id);
      setIsSaved(true);
      setIsEditing(false);
      const rows = (jv.details || []).map((d) => {
        const entityNumber = d.account?.accountNumber || d.supplier?.supplierAccountNumber || d.customer?.customerAccountNumber || "";
        const entityName = d.account?.arabicAccountName || d.supplier?.supplierName || d.customer?.customerName || "";
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
      setOriginalDetailIds(rows.filter((r) => r.detailId).map((r) => r.detailId));
    } catch (error) {
      setNotification({ visible: true, type: "error", message: "Failed to fetch journal voucher details. Please try again.", onConfirm: null });
    }
  };

  const handleView = (journal) => {
    setIsJournalListOpen(false);
    fetchJournalVoucherById(journal.id);
    setIsEditing(false);
    setIsSaved(true);
  };

  const handleDeleteJV = async (journal) => {
    try {
      await axiosClient.delete(`/journal-vouchers/${journal.id}`);
      setJournalData((prev) => prev.filter((j) => j.id !== journal.id));
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete journal voucher.");
    }
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
        currency: "USD",
        debit: "",
        debitOFR: "",
        credit: "",
        creditOFR: "",
        exchangeRate: "89500",
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
    setIsSaved(false);
    setActiveRowIndex(null);
  };

  const handleClearEntries = () => {
  if (!isEditing) return;
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
      currency: "USD",
      debit: "",
      debitOFR: "",
      credit: "",
      creditOFR: "",
      exchangeRate: "89500",
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
  setActiveRowIndex(null);
};

  const handleStartEdit = () => {
    if (!isSaved || !editingId) {
      setNotification({ visible: true, type: "warning", message: "Open or save a journal voucher first, then click Edit.", onConfirm: null });
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

  // ✅ RENDER HELPERS - Type S/R/RVR with EDITABLE LL fields
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
            style={{ display: isRowVisible(entry) ? "" : "none" }}
            onClick={() => !isTableDisabled && setActiveRowIndex(index)}
            onContextMenu={(e) => handleRightClick(e, index, entry.rid)}
          >
            <td className="column-line-cell">{index + 1}</td>
            <td className="column-account-number-cell">
              <input type="text" value={entry.accountNumber} placeholder="Acc Nb" disabled={isTableDisabled} className="general-vouchers-input column-account-number" ref={registerInputRef(index, "accountNumber")} onChange={(e) => handleAccountNumberChange(index, e.target.value)} onBlur={() => handleAccountNumberBlur(index)} onKeyDown={(e) => handleAccountNumberKeyDown(e, entry.rid)} />
            </td>
            <td className="column-account-name-cell">
              <input type="text" value={entry.accountName} readOnly disabled={isTableDisabled} placeholder="Account Name" className={`general-vouchers-input account-name-input ${/[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""}`} />
            </td>
            <td>
              <input type="text" value={entry.documentNbr} placeholder="Doc" onChange={(e) => handleInputChange(index, "documentNbr", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "documentNbr")} ref={registerInputRef(index, "documentNbr")} className="general-vouchers-input column-doc-nbr" disabled={isTableDisabled} />
            </td>
            <td>
              <input type="text" value={entry.description} placeholder="Description" onChange={(e) => handleInputChange(index, "description", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "description")} ref={registerInputRef(index, "description")} className="general-vouchers-input column-description" disabled={isTableDisabled} />
            </td>
            <td>
              <select value={entry.currency} onChange={(e) => handleInputChange(index, "currency", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "currency")} ref={registerInputRef(index, "currency")} disabled={isTableDisabled} className="general-vouchers-input column-currency">
                <option value="" disabled hidden>-</option>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
                <option value="EUR">EUR</option>
              </select>
            </td>
            <td>
              <input type="text" value={isTableDisabled ? formatNumber(entry.exchangeRate) : entry.exchangeRate} placeholder="Rate" onChange={(e) => handleInputChange(index, "exchangeRate", e.target.value)} onBlur={() => handleInputBlur(index, "exchangeRate")} onKeyDown={(e) => handleCellKeyDown(e, index, "exchangeRate")} ref={registerInputRef(index, "exchangeRate")} className="general-vouchers-input column-exchange-rate" readOnly={isTableDisabled} disabled={isTableDisabled} />
            </td>
            <td>
              <input type="text" value={isLocked(entry, "debit") ? "0" : (isTableDisabled ? formatNumber(entry.debit) : entry.debit)} placeholder="Debit" onChange={(e) => handleInputChange(index, "debit", e.target.value)} onBlur={() => handleInputBlur(index, "debit")} onKeyDown={(e) => handleCellKeyDown(e, index, "debit")} ref={registerInputRef(index, "debit")} className="general-vouchers-input column-debit" readOnly={isTableDisabled || isOFRType(type) || isLocked(entry, "debit")} disabled={isTableDisabled || isOFRType(type) || isLocked(entry, "debit")} />
            </td>
            <td>
              <input type="text" value={isLocked(entry, "credit") ? "0" : (isTableDisabled ? formatNumber(entry.credit) : entry.credit)} placeholder="Credit" onChange={(e) => handleInputChange(index, "credit", e.target.value)} onBlur={() => handleInputBlur(index, "credit")} onKeyDown={(e) => handleCellKeyDown(e, index, "credit")} ref={registerInputRef(index, "credit")} className="general-vouchers-input column-credit" readOnly={isTableDisabled || isOFRType(type) || isLocked(entry, "credit")} disabled={isTableDisabled || isOFRType(type) || isLocked(entry, "credit")} />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSD") ? formatNumber(entry.debitUSD) : entry.debitUSD} placeholder="Dr USD" onChange={(e) => handleInputChange(index, "debitUSD", e.target.value)} onBlur={() => handleInputBlur(index, "debitUSD")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitUSD")} ref={registerInputRef(index, "debitUSD")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSD")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSD")} className="general-vouchers-input column-debit-usd" />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSD") ? formatNumber(entry.creditUSD) : entry.creditUSD} placeholder="Cr USD" onChange={(e) => handleInputChange(index, "creditUSD", e.target.value)} onBlur={() => handleInputBlur(index, "creditUSD")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditUSD")} ref={registerInputRef(index, "creditUSD")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSD")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSD")} className="general-vouchers-input column-credit-usd" />
            </td>
            {/* ✅ EDITABLE Dr LL */}
            <td>
              <input type="text" value={isLocked(entry, "debitEx") ? "0" : (isTableDisabled ? formatNumber(entry.debitEx) : entry.debitEx)} placeholder="Dr LL" onChange={(e) => handleInputChange(index, "debitEx", e.target.value)} onBlur={() => handleInputBlur(index, "debitEx")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitEx")} ref={registerInputRef(index, "debitEx")} className="general-vouchers-input column-debit-ex" readOnly={isTableDisabled || isLocked(entry, "debitEx")} disabled={isTableDisabled || isLocked(entry, "debitEx")} />
            </td>
            {/* ✅ EDITABLE Cr LL */}
            <td>
              <input type="text" value={isLocked(entry, "creditEx") ? "0" : (isTableDisabled ? formatNumber(entry.creditEx) : entry.creditEx)} placeholder="Cr LL" onChange={(e) => handleInputChange(index, "creditEx", e.target.value)} onBlur={() => handleInputBlur(index, "creditEx")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditEx")} ref={registerInputRef(index, "creditEx")} className="general-vouchers-input column-credit-ex" readOnly={isTableDisabled || isLocked(entry, "creditEx")} disabled={isTableDisabled || isLocked(entry, "creditEx")} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ✅ RENDER HELPERS - Type G/RG with EDITABLE LL OFR fields
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
          <tr key={entry.rid} className={index === activeRowIndex ? "row-active" : ""} style={{ display: isRowVisible(entry) ? "" : "none" }} onClick={() => !isTableDisabled && setActiveRowIndex(index)} onContextMenu={(e) => handleRightClick(e, index, entry.rid)}>
            <td className="column-line-cell">{index + 1}</td>
            <td className="column-account-number-cell">
              <input type="text" value={entry.accountNumber} placeholder="Acc Nb" disabled={isTableDisabled} className="general-vouchers-input column-account-number" ref={registerInputRef(index, "accountNumber")} onChange={(e) => handleAccountNumberChange(index, e.target.value)} onBlur={() => handleAccountNumberBlur(index)} onKeyDown={(e) => handleAccountNumberKeyDown(e, entry.rid)} />
            </td>
            <td className="column-account-name-cell">
              <input type="text" value={entry.accountName} readOnly disabled={isTableDisabled} placeholder="Account Name" className={`general-vouchers-input account-name-input ${/[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""}`} />
            </td>
            <td>
              <input type="text" value={entry.documentNbr} placeholder="Doc" onChange={(e) => handleInputChange(index, "documentNbr", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "documentNbr")} ref={registerInputRef(index, "documentNbr")} className="general-vouchers-input column-doc-nbr" disabled={isTableDisabled} />
            </td>
            <td>
              <input type="text" value={entry.description} placeholder="Description" onChange={(e) => handleInputChange(index, "description", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "description")} ref={registerInputRef(index, "description")} className="general-vouchers-input column-description" disabled={isTableDisabled} />
            </td>
            <td>
              <select value={entry.currency} onChange={(e) => handleInputChange(index, "currency", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "currency")} ref={registerInputRef(index, "currency")} disabled={isTableDisabled} className="general-vouchers-input column-currency">
                <option value="" disabled hidden>-</option>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
                <option value="EUR">EUR</option>
              </select>
            </td>
            <td>
              <input type="text" value={isTableDisabled ? formatNumber(entry.exchangeRate) : entry.exchangeRate} placeholder="Rate" onChange={(e) => handleInputChange(index, "exchangeRate", e.target.value)} onBlur={() => handleInputBlur(index, "exchangeRate")} onKeyDown={(e) => handleCellKeyDown(e, index, "exchangeRate")} ref={registerInputRef(index, "exchangeRate")} className="general-vouchers-input column-exchange-rate" readOnly={isTableDisabled} disabled={isTableDisabled} />
            </td>
            <td>
              <input type="text" value={isLocked(entry, "debitOFR") ? "0" : (isTableDisabled ? formatNumber(entry.debitOFR) : entry.debitOFR)} placeholder="Dr OFR" onChange={(e) => handleInputChange(index, "debitOFR", e.target.value)} onBlur={() => handleInputBlur(index, "debitOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitOFR")} ref={registerInputRef(index, "debitOFR")} className="general-vouchers-input column-debit-ofr" readOnly={isTableDisabled || isLocked(entry, "debitOFR")} disabled={isTableDisabled || isLocked(entry, "debitOFR")} />
            </td>
            <td>
              <input type="text" value={isLocked(entry, "creditOFR") ? "0" : (isTableDisabled ? formatNumber(entry.creditOFR) : entry.creditOFR)} placeholder="Cr OFR" onChange={(e) => handleInputChange(index, "creditOFR", e.target.value)} onBlur={() => handleInputBlur(index, "creditOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditOFR")} ref={registerInputRef(index, "creditOFR")} className="general-vouchers-input column-credit-ofr" readOnly={isTableDisabled || isLocked(entry, "creditOFR")} disabled={isTableDisabled || isLocked(entry, "creditOFR")} />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSDOFR") ? formatNumber(entry.debitUSDOFR) : entry.debitUSDOFR} placeholder="Dr USD OFR" onChange={(e) => handleInputChange(index, "debitUSDOFR", e.target.value)} onBlur={() => handleInputBlur(index, "debitUSDOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitUSDOFR")} ref={registerInputRef(index, "debitUSDOFR")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSDOFR")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSDOFR")} className="general-vouchers-input column-debit-usd-ofr" />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSDOFR") ? formatNumber(entry.creditUSDOFR) : entry.creditUSDOFR} placeholder="Cr USD OFR" onChange={(e) => handleInputChange(index, "creditUSDOFR", e.target.value)} onBlur={() => handleInputBlur(index, "creditUSDOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditUSDOFR")} ref={registerInputRef(index, "creditUSDOFR")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSDOFR")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSDOFR")} className="general-vouchers-input column-credit-usd-ofr" />
            </td>
            {/* ✅ EDITABLE Dr LL OFR */}
            <td>
              <input type="text" value={isLocked(entry, "debitExOFR") ? "0" : (isTableDisabled ? formatNumber(entry.debitExOFR) : entry.debitExOFR)} placeholder="Dr LL OFR" onChange={(e) => handleInputChange(index, "debitExOFR", e.target.value)} onBlur={() => handleInputBlur(index, "debitExOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitExOFR")} ref={registerInputRef(index, "debitExOFR")} className="general-vouchers-input column-debit-ex-ofr" readOnly={isTableDisabled || isLocked(entry, "debitExOFR")} disabled={isTableDisabled || isLocked(entry, "debitExOFR")} />
            </td>
            {/* ✅ EDITABLE Cr LL OFR */}
            <td>
              <input type="text" value={isLocked(entry, "creditExOFR") ? "0" : (isTableDisabled ? formatNumber(entry.creditExOFR) : entry.creditExOFR)} placeholder="Cr LL OFR" onChange={(e) => handleInputChange(index, "creditExOFR", e.target.value)} onBlur={() => handleInputBlur(index, "creditExOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditExOFR")} ref={registerInputRef(index, "creditExOFR")} className="general-vouchers-input column-credit-ex-ofr" readOnly={isTableDisabled || isLocked(entry, "creditExOFR")} disabled={isTableDisabled || isLocked(entry, "creditExOFR")} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ✅ Type SR with EDITABLE LL fields (both base and OFR)
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
          <tr key={entry.rid} className={index === activeRowIndex ? "row-active" : ""} style={{ display: isRowVisible(entry) ? "" : "none" }} onClick={() => !isTableDisabled && setActiveRowIndex(index)} onContextMenu={(e) => handleRightClick(e, index, entry.rid)}>
            <td className="column-line-cell">{index + 1}</td>
            <td className="column-account-number-cell">
              <input type="text" value={entry.accountNumber} placeholder="Acc Nb" disabled={isTableDisabled} className="general-vouchers-input column-account-number" ref={registerInputRef(index, "accountNumber")} onChange={(e) => handleAccountNumberChange(index, e.target.value)} onBlur={() => handleAccountNumberBlur(index)} onKeyDown={(e) => handleAccountNumberKeyDown(e, entry.rid)} />
            </td>
            <td className="column-account-name-cell">
              <input type="text" value={entry.accountName} readOnly disabled={isTableDisabled} placeholder="Account Name" className={`general-vouchers-input account-name-input ${/[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""}`} />
            </td>
            <td>
              <input type="text" value={entry.documentNbr} placeholder="Doc" onChange={(e) => handleInputChange(index, "documentNbr", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "documentNbr")} ref={registerInputRef(index, "documentNbr")} className="general-vouchers-input column-doc-nbr" disabled={isTableDisabled} />
            </td>
            <td>
              <input type="text" value={entry.description} placeholder="Description" onChange={(e) => handleInputChange(index, "description", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "description")} ref={registerInputRef(index, "description")} className="general-vouchers-input column-description" disabled={isTableDisabled} />
            </td>
            <td>
              <select value={entry.currency} onChange={(e) => handleInputChange(index, "currency", e.target.value)} onKeyDown={(e) => handleCellKeyDown(e, index, "currency")} ref={registerInputRef(index, "currency")} disabled={isTableDisabled} className="general-vouchers-input column-currency">
                <option value="" disabled hidden>-</option>
                <option value="USD">USD</option>
                <option value="LL">LL</option>
                <option value="EUR">EUR</option>
              </select>
            </td>
            <td>
              <input type="text" value={isTableDisabled ? formatNumber(entry.exchangeRate) : entry.exchangeRate} placeholder="Rate" onChange={(e) => handleInputChange(index, "exchangeRate", e.target.value)} onBlur={() => handleInputBlur(index, "exchangeRate")} onKeyDown={(e) => handleCellKeyDown(e, index, "exchangeRate")} ref={registerInputRef(index, "exchangeRate")} className="general-vouchers-input column-exchange-rate" readOnly={isTableDisabled} disabled={isTableDisabled} />
            </td>
            <td>
              <input type="text" value={isLocked(entry, "debit") ? "0" : (isTableDisabled ? formatNumber(entry.debit) : entry.debit)} placeholder="Debit" onChange={(e) => handleInputChange(index, "debit", e.target.value)} onBlur={() => handleInputBlur(index, "debit")} onKeyDown={(e) => handleCellKeyDown(e, index, "debit")} ref={registerInputRef(index, "debit")} className="general-vouchers-input column-debit" readOnly={isTableDisabled || isLocked(entry, "debit")} disabled={isTableDisabled || isLocked(entry, "debit")} />
            </td>
            <td>
              <input type="text" value={formatNumber(entry.debitOFR)} placeholder="Dr OFR" readOnly disabled className="general-vouchers-input column-debit-ofr" />
            </td>
            <td>
              <input type="text" value={isLocked(entry, "credit") ? "0" : (isTableDisabled ? formatNumber(entry.credit) : entry.credit)} placeholder="Credit" onChange={(e) => handleInputChange(index, "credit", e.target.value)} onBlur={() => handleInputBlur(index, "credit")} onKeyDown={(e) => handleCellKeyDown(e, index, "credit")} ref={registerInputRef(index, "credit")} className="general-vouchers-input column-credit" readOnly={isTableDisabled || isLocked(entry, "credit")} disabled={isTableDisabled || isLocked(entry, "credit")} />
            </td>
            <td>
              <input type="text" value={formatNumber(entry.creditOFR)} placeholder="Cr OFR" readOnly disabled className="general-vouchers-input column-credit-ofr" />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSD") ? formatNumber(entry.debitUSD) : entry.debitUSD} placeholder="Dr USD" onChange={(e) => handleInputChange(index, "debitUSD", e.target.value)} onBlur={() => handleInputBlur(index, "debitUSD")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitUSD")} ref={registerInputRef(index, "debitUSD")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSD")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSD")} className="general-vouchers-input column-debit-usd" />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSDOFR") ? formatNumber(entry.debitUSDOFR) : entry.debitUSDOFR} placeholder="Dr USD OFR" onChange={(e) => handleInputChange(index, "debitUSDOFR", e.target.value)} onBlur={() => handleInputBlur(index, "debitUSDOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitUSDOFR")} ref={registerInputRef(index, "debitUSDOFR")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSDOFR")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "debitUSDOFR")} className="general-vouchers-input column-debit-usd-ofr" />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSD") ? formatNumber(entry.creditUSD) : entry.creditUSD} placeholder="Cr USD" onChange={(e) => handleInputChange(index, "creditUSD", e.target.value)} onBlur={() => handleInputBlur(index, "creditUSD")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditUSD")} ref={registerInputRef(index, "creditUSD")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSD")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSD")} className="general-vouchers-input column-credit-usd" />
            </td>
            <td>
              <input type="text" value={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSDOFR") ? formatNumber(entry.creditUSDOFR) : entry.creditUSDOFR} placeholder="Cr USD OFR" onChange={(e) => handleInputChange(index, "creditUSDOFR", e.target.value)} onBlur={() => handleInputBlur(index, "creditUSDOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditUSDOFR")} ref={registerInputRef(index, "creditUSDOFR")} readOnly={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSDOFR")} disabled={entry.currency !== "LL" || isTableDisabled || isLocked(entry, "creditUSDOFR")} className="general-vouchers-input column-credit-usd-ofr" />
            </td>
            {/* ✅ EDITABLE Dr LL */}
            <td>
              <input type="text" value={isLocked(entry, "debitEx") ? "0" : (isTableDisabled ? formatNumber(entry.debitEx) : entry.debitEx)} placeholder="Dr LL" onChange={(e) => handleInputChange(index, "debitEx", e.target.value)} onBlur={() => handleInputBlur(index, "debitEx")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitEx")} ref={registerInputRef(index, "debitEx")} className="general-vouchers-input column-debit-ex" readOnly={isTableDisabled || isLocked(entry, "debitEx")} disabled={isTableDisabled || isLocked(entry, "debitEx")} />
            </td>
            {/* ✅ EDITABLE Dr LL OFR */}
            <td>
              <input type="text" value={isLocked(entry, "debitExOFR") ? "0" : (isTableDisabled ? formatNumber(entry.debitExOFR) : entry.debitExOFR)} placeholder="Dr LL OFR" onChange={(e) => handleInputChange(index, "debitExOFR", e.target.value)} onBlur={() => handleInputBlur(index, "debitExOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "debitExOFR")} ref={registerInputRef(index, "debitExOFR")} className="general-vouchers-input column-debit-ex-ofr" readOnly={isTableDisabled || isLocked(entry, "debitExOFR")} disabled={isTableDisabled || isLocked(entry, "debitExOFR")} />
            </td>
            {/* ✅ EDITABLE Cr LL */}
            <td>
              <input type="text" value={isLocked(entry, "creditEx") ? "0" : (isTableDisabled ? formatNumber(entry.creditEx) : entry.creditEx)} placeholder="Cr LL" onChange={(e) => handleInputChange(index, "creditEx", e.target.value)} onBlur={() => handleInputBlur(index, "creditEx")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditEx")} ref={registerInputRef(index, "creditEx")} className="general-vouchers-input column-credit-ex" readOnly={isTableDisabled || isLocked(entry, "creditEx")} disabled={isTableDisabled || isLocked(entry, "creditEx")} />
            </td>
            {/* ✅ EDITABLE Cr LL OFR */}
            <td>
              <input type="text" value={isLocked(entry, "creditExOFR") ? "0" : (isTableDisabled ? formatNumber(entry.creditExOFR) : entry.creditExOFR)} placeholder="Cr LL OFR" onChange={(e) => handleInputChange(index, "creditExOFR", e.target.value)} onBlur={() => handleInputBlur(index, "creditExOFR")} onKeyDown={(e) => handleCellKeyDown(e, index, "creditExOFR")} ref={registerInputRef(index, "creditExOFR")} className="general-vouchers-input column-credit-ex-ofr" readOnly={isTableDisabled || isLocked(entry, "creditExOFR")} disabled={isTableDisabled || isLocked(entry, "creditExOFR")} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Keep actionRef current so the Ctrl+S handler never has stale closures
  actionRef.current = { submitBlocked, isEditing, isSaved, handleSubmit, handleSaveEdit };

  return (
    <div>
      <div className="general-vouchers-container" onClick={handleCloseContextMenu}>
        <AccountSelectionModal isOpen={isModalOpen} onClose={handleModalClose} onSelect={handleAccountSelection} />
        <JournalListsModal isOpen={isJournalListOpen} onClose={() => setIsJournalListOpen(false)} journalData={journalData} onView={handleView} onDelete={handleDeleteJV} onLoadMore={handleLoadMore} hasMore={hasMoreSummary} loadingMore={loadingMoreSummary} searchSeq={summarySeq} onSearchSeqChange={handleSearchSeqChange} searchText={searchText} onSearchTextChange={handleSearchTextChange} kindFilter={kindFilter} onKindFilterChange={(val) => { setKindFilter(val); runJournalListSearch({ kindFilter: val }); }} onSearchNow={() => runJournalListSearch()} />

        <div className="general-vouchers-header">
          <div className="header-left">
            <h2 className="general-vouchers-title">Journal Voucher</h2>
            <span className={statusClass}>{statusLabel}</span>
          </div>

          <div className="header-right">
            <div className="date-type">
              <label className="general-vouchers-label">Date: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={readOnlyMode} className="general-vouchers-input" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); typeSelectRef.current?.focus(); } }} /></label>
              <label className="general-vouchers-label">Type:
                <select ref={typeSelectRef} value={type} onChange={(e) => setType(e.target.value)} required disabled={readOnlyMode} className="general-vouchers-input" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setTimeout(() => { const el = inputRefs.current?.[0]?.["accountNumber"]; if (el && !el.disabled) el.focus(); }, 0); } }}>
                  <option value="" disabled hidden>Select Type</option>
                  <option value="S">S – Normal</option>
                  <option value="G">G – Opening / OFR only</option>
                  <option value="SR">SR – Revaluation</option>
                  <option value="RVR">RVR – Reverse OFR</option>
                  <option value="R">R – Return</option>
                  <option value="RG">RG – Return OFR</option>
                  <option value="PR">PR – Purchase Return</option>
                  <option value="PRG">PRG – Purchase Return OFR</option>
                </select>
              </label>
            </div>

            <div className="header-actions">
              <button className="new-btn" onClick={handleReset}>New</button>
{isEditing && (
  <button className="new-btn" onClick={handleClearEntries}>Clear</button>
)}
              <button className="export-journal-voucher-btn" onClick={handleExportToExcel} disabled={!isSaved} title={!isSaved ? "Open or save a voucher first" : "Export to Excel"}>📊 Export</button>
              <button className="edit-journal-voucher" onClick={handleStartEdit} disabled={editDisabled} title={!isSaved ? "Open or save a voucher first" : ""}>Edit</button>
              {isEditing && (<button className="edit-journal-voucher" onClick={handleCancelEdit}>Cancel Edit</button>)}
              <button className="open-journal-list-btn" onClick={() => setIsJournalListOpen(true)}>Open List</button>
              {!isSaved && !isEditing && (<button className="general-vouchers-submit-btn" onClick={handleSubmit} disabled={submitBlocked}>Submit</button>)}
              {isEditing && (<button className="general-vouchers-submit-btn" onClick={handleSaveEdit} disabled={submitBlocked}>Save</button>)}
            </div>
          </div>
        </div>

        {isTableDisabled && !readOnlyMode && (
          <div style={{ padding: "10px", backgroundColor: "#fff3cd", color: "#856404", border: "1px solid #ffc107", borderRadius: "4px", marginBottom: "10px", textAlign: "center" }}>
            ⚠️ Please select both Date and Type to enable the table
          </div>
        )}

        {activeFilter && (
          <div className="filter-indicator">
            <span className="filter-indicator-label">Filtered: {activeFilter.label}</span>
            <button className="filter-indicator-clear" onClick={() => setActiveFilter(null)}>✕ Clear filter</button>
          </div>
        )}

        <div className="general-vouchers-table-container">
          {(!type || isBaseType(type)) && renderTypeSOrRVR()}
          {isOFRType(type) && renderTypeG()}
          {type === "SR" && renderTypeSR()}
        </div>

        <div className="general-vouchers-add-row-container">
          <button className="general-vouchers-new-btn" onClick={handleAddRow} disabled={isTableDisabled} title={isTableDisabled ? "Set Date and Type first, or click Edit to modify rows" : ""}>Add Row</button>
        </div>

        <div className="general-vouchers-summary">
          <div className="summary-row summary-actions-row">
            <button type="button" className="balance-last-row-button" onClick={fillBalanceOnLastRow} disabled={isTableDisabled || isOFRType(type)}>Balance last row (Base)</button>
          </div>
          <div className="summary-row">
            <span className="summary-total-txt">Total Debit (Base): <span className={`number ${isOFRType(type) ? "" : isEqualBase ? "equal" : "not-equal"}`}>{formatNumber(totalDebitBase)}</span></span>
            <span className="summary-total-txt">Total Credit (Base): <span className={`number ${isOFRType(type) ? "" : isEqualBase ? "equal" : "not-equal"}`}>{formatNumber(totalCreditBase)}</span></span>
            <span className="summary-total-txt">Diff (Base): <span className={`number ${diffBase === 0 ? "equal" : "not-equal"}`}>{formatNumber(diffBase)}</span></span>
          </div>
          <div className="summary-row">
            <span className="summary-total-txt">Total Debit OFR: <span className={`number ${isOFRType(type) ? (isEqualOFR ? "equal" : "not-equal") : ""}`}>{formatNumber(totalDebitOFR)}</span></span>
            <span className="summary-total-txt">Total Credit OFR: <span className={`number ${isOFRType(type) ? (isEqualOFR ? "equal" : "not-equal") : ""}`}>{formatNumber(totalCreditOFR)}</span></span>
            <span className="summary-total-txt">Diff (OFR): <span className={`number ${diffOFR === 0 ? "equal" : "not-equal"}`}>{formatNumber(diffOFR)}</span></span>
          </div>
          <div className="summary-row">
            <span className="summary-total-txt">Total Debit USD: <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>{formatNumber(totalDebitUSD)}</span></span>
            <span className="summary-total-txt">Total Credit USD: <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>{formatNumber(totalCreditUSD)}</span></span>
          </div>
          <div className="summary-row">
            <span className="summary-total-txt">Total Debit LL: <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>{formatNumber(totalDebitLL)}</span></span>
            <span className="summary-total-txt">Total Credit LL: <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>{formatNumber(totalCreditLL)}</span></span>
          </div>
        </div>

        {contextMenu.visible && !isTableDisabled && (
          <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <button className="context-menu-item" onClick={handleDuplicateRow}>Duplicate row</button>
            <button className="context-menu-item context-menu-item-danger" onClick={handleDeleteRow}>Delete row</button>

{contextMenu.clickedField && (
  <>
    <div className="context-menu-separator" />

    {/* Currency shortcuts */}
    {contextMenu.clickedField === "currency" &&
      ["USD", "LL", "EUR"].map((cur) => (
        <button
          key={cur}
          className="context-menu-item context-menu-item-filter"
          onClick={() =>
            applyFilter({
              field: "currency",
              type: "eq",
              value: cur,
              label: `Currency = ${cur}`,
            })
          }
        >
          Show {cur} rows
        </button>
      ))}

    {/* Contains filter for ALL fields */}
    {contextMenu.clickedValue &&
      String(contextMenu.clickedValue).trim() !== "" && (
        <button
          className="context-menu-item context-menu-item-filter"
          onClick={() =>
            applyFilter({
              field: contextMenu.clickedField,
              type: "contains",
              value: contextMenu.clickedValue,
              label: `${FIELD_LABELS[contextMenu.clickedField] ?? contextMenu.clickedField} contains "${contextMenu.clickedValue}"`,
            })
          }
        >
          Contains "{String(contextMenu.clickedValue).slice(0, 20)}"
        </button>
      )}

    {/* Numeric filters */}
    {NUMERIC_FILTER_FIELDS.has(contextMenu.clickedField) && (
      <>
        <button
          className="context-menu-item context-menu-item-filter"
          onClick={() =>
            applyFilter({
              field: contextMenu.clickedField,
              type: "nonzero",
              label: `${FIELD_LABELS[contextMenu.clickedField]} ≠ 0`,
            })
          }
        >
          Show non-zero rows
        </button>

        {contextMenu.clickedValue &&
          String(contextMenu.clickedValue).trim() !== "" && (
            <>
              <button
                className="context-menu-item context-menu-item-filter"
                onClick={() =>
                  applyFilter({
                    field: contextMenu.clickedField,
                    type: "gt",
                    value: contextMenu.clickedValue,
                    label: `${FIELD_LABELS[contextMenu.clickedField]} > ${contextMenu.clickedValue}`,
                  })
                }
              >
                Greater than "{String(contextMenu.clickedValue).slice(0, 20)}"
              </button>

              <button
                className="context-menu-item context-menu-item-filter"
                onClick={() =>
                  applyFilter({
                    field: contextMenu.clickedField,
                    type: "lt",
                    value: contextMenu.clickedValue,
                    label: `${FIELD_LABELS[contextMenu.clickedField]} < ${contextMenu.clickedValue}`,
                  })
                }
              >
                Lower than "{String(contextMenu.clickedValue).slice(0, 20)}"
              </button>
            </>
          )}
      </>
    )}

    {/* Equal filter */}
    {contextMenu.clickedValue &&
      String(contextMenu.clickedValue).trim() !== "" && (
        <button
          className="context-menu-item context-menu-item-filter"
          onClick={() =>
            applyFilter({
              field: contextMenu.clickedField,
              type: "eq",
              value: contextMenu.clickedValue,
              label: `${FIELD_LABELS[contextMenu.clickedField] ?? contextMenu.clickedField} = "${contextMenu.clickedValue}"`,
            })
          }
        >
          Show rows matching "{String(contextMenu.clickedValue).slice(0, 20)}"
        </button>
      )}
  </>
)}

            {activeFilter && (
              <>
                <div className="context-menu-separator" />
                <button className="context-menu-item context-menu-item-clear" onClick={() => { setActiveFilter(null); closeContextMenu(); }}>
                  ✕ Clear filter
                </button>
              </>
            )}
          </div>
        )}

        {notification.visible && (<NotificationModal type={notification.type} message={notification.message} onClose={() => setNotification({ ...notification, visible: false })} onConfirm={notification.onConfirm} confirmLabel="OK" cancelLabel={notification.type === "warning" ? "Cancel" : null} />)}
      </div>
    </div>
  );
};

export default JournalVoucherPage;