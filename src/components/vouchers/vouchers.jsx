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
  const [date, setDate] = useState("");
  const [type, setType] = useState("");
  const [viewMode, setViewMode] = useState(false); // kept for compatibility
  const baseUrl = process.env.REACT_APP_API_BASE_URL;
  const [summarySeq, setSummarySeq] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const searchDebounceRef = useRef();

  // Edit / saved state
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [isSaved, setIsSaved] = useState(false); // true if JV exists in DB

  const [originalDetailIds, setOriginalDetailIds] = useState([]);

  // Journal list pagination
  const [summaryPage, setSummaryPage] = useState(1);
  const [hasMoreSummary, setHasMoreSummary] = useState(true);
  const [loadingMoreSummary, setLoadingMoreSummary] = useState(false);

  const [notification, setNotification] = useState({
    visible: false,
    type: "",
    message: "",
    onConfirm: null,
  });

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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  const [currentRowRid, setCurrentRowRid] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
    rowRid: null,
  });

  // ---------- READ-ONLY MODE (lock UI when saved & not editing) ----------
  const readOnlyMode = isSaved && !isEditing;

  // ===== Number helpers =====
  const parseNumber = (value) => {
    if (value === "" || value === null || value === undefined) return 0;
    const s = String(value).replace(/,/g, "");
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const formatNumber = (value) => {
    const n = parseNumber(value);
    return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // allow user to type freely (digits + single dot)
  const cleanNumericInput = (s = "") =>
    s.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");

  // For payload safety (kept)
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
      (entity?.supplierId ? "supplier" : entity?.customerId ? "customer" : "account");

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

  const handleAddRow = () => {
    if (readOnlyMode) return;
    setEntries((e) => [
      ...e,
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
  };

  // ======= CORE: recalcEntry (S+USD mirrors; do NOT format while typing) =======
  const recalcEntry = (entry) => {
    const d = parseNumber(entry.debit);
    const c = parseNumber(entry.credit);
    const r = Math.max(1, parseNumber(entry.exchangeRate || 1)); // guard

    // reset computed fields (keep as numbers internally)
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
        // user types only DR/CR; mirror to everything
        entry.debit = String(entry.debit);   // keep raw the user typed
        entry.credit = String(entry.credit); // keep raw
        // derived values:
        entry.debitUSD = d;
        entry.debitEx = d * r;
        entry.debitOFR = String(entry.debit); // mirror raw so on blur it formats
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
    }
  };

  // ====== Input handling ======
  const NUM_FIELDS = new Set([
    "debit", "credit", "debitOFR", "creditOFR",
    "exchangeRate", "exchangeRateEURtoUSD",
    "debitUSD", "creditUSD",
    "debitUSDOFR", "creditUSDOFR",
    "debitEx", "creditEx",
    "debitExOFR", "creditExOFR",
  ]);

  const EDITABLE_NUM_FIELDS = new Set([
    "debit", "credit", "debitOFR", "creditOFR", "exchangeRate", "exchangeRateEURtoUSD"
  ]);

  const handleInputChange = (index, field, value) => {
    if (readOnlyMode) return;
    const updated = [...entries];
    const entry = updated[index];

    // let the user type normally (raw) for editable numeric fields
    const next =
      EDITABLE_NUM_FIELDS.has(field) ? cleanNumericInput(value) : value;

    entry[field] = next;

    // Recalculate when numbers or currency change (without formatting)
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
      entry[field] = formatNumber(entry[field]); // format only on blur
    }
    setEntries(updated);
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
      setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, rowRid: null });
      return;
    }
    if (contextMenu.rowIndex !== null) {
      setEntries((prev) => prev.filter((_, i) => i !== contextMenu.rowIndex));
      setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, rowRid: null });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null, rowRid: null });
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

  
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;


const isEqualBase =
  round2(totalDebitBase) === round2(totalCreditBase) && round2(totalDebitBase) !== 0;

const isEqualOFR =
  round2(totalDebitOFR) === round2(totalCreditOFR) && round2(totalDebitOFR) !== 0;
  const isUSDEqual = totalDebitUSD === totalCreditUSD;
  const isLLEqual = totalDebitLL === totalCreditLL;

  const submitBlocked =
    !type ||
    !date ||
    (type === "G" ? !isEqualOFR : !isEqualBase);

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

  // PUT mirrors create — no detail ids
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

    const payload = { date, jvType: type, details };
    return payload;
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

        // Stay on the saved JV in read-only mode
        if (created && created.id) {
          setEditingId(created.id);
          setIsSaved(true);
          setIsEditing(false);
          setViewMode(true);
          await fetchJournalVoucherById(created.id); // DB truth
        } else {
          setIsSaved(true);
          setIsEditing(false);
          setViewMode(true);
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
        setViewMode(true);
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
  const fetchJournalData = async (pageArg = 1, seqArg = "") => {
    const base = `${baseUrl}/journal-vouchers/v1`;
    const url =
      seqArg && seqArg.trim()
        ? `${base}/search-by-seq?seq=${encodeURIComponent(seqArg)}&page=${pageArg}`
        : `${base}/list?page=${pageArg}`;
    const response = await axios.get(url);
    return response.data;
  };

  useEffect(() => {
    if (isJournalListOpen) {
      (async () => {
        try {
          setLoading(true);
          setSummaryPage(1);
          const res = await fetchJournalData(1, summarySeq);
          setJournalData(res.data || []);
          setHasMoreSummary(Boolean(res.hasMore));
          setSearchActive(Boolean(summarySeq && summarySeq.trim()));
        } catch (error) {
          setJournalData([]);
          setHasMoreSummary(false);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isJournalListOpen]); // eslint-disable-line

  const handleSearchSeqChange = (val) => {
    const digits = (val || "").replace(/\D+/g, "");
    setSummarySeq(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        setSummaryPage(1);
        const res = await fetchJournalData(1, digits);
        setJournalData(res.data || []);
        setHasMoreSummary(Boolean(res.hasMore));
        setSearchActive(Boolean(digits));
      } catch (e) {
        setJournalData([]);
        setHasMoreSummary(false);
        setSearchActive(Boolean(digits));
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
      const res = await fetchJournalData(next, digits);
      setJournalData((prev) => [...prev, ...(res.data || [])]);
      setSummaryPage(next);
      setHasMoreSummary(Boolean(res.hasMore));
    } catch (e) {
      // ignore
    } finally {
      setLoadingMoreSummary(false);
    }
  };

  // Fetch a single journal voucher by ID
  const fetchJournalVoucherById = async (id) => {
    try {
      const { data: jv } = await axios.get(`${baseUrl}/journal-vouchers/${id}`);

      setDate(jv.date);
      setType(jv.jvType);
      setEditingId(jv.id);
      setIsSaved(true);
      setIsEditing(false);
      setViewMode(true);

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
      setOriginalDetailIds(rows.filter((r) => r.detailId).map((r) => r.detailId));
    } catch (error) {
      setNotification({
        visible: true,
        type: "error",
        message: "Failed to fetch journal voucher details. Please try again.",
        onConfirm: null,
      });
    }
  };

  const handleView = (journal) => {
    setIsJournalListOpen(false);
    fetchJournalVoucherById(journal.id);
    setViewMode(true);
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
    setViewMode(false);
    setIsEditing(false);
    setEditingId(null);
    setCurrentRowRid(null);
    setCurrentRowIndex(null);
    setIsSaved(false); // new JV (unsaved)
  };

  // start edit
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
    setViewMode(false);
  };

  // cancel edit (re-lock)
  const handleCancelEdit = () => {
    if (!editingId) {
      setIsEditing(false);
      setViewMode(false);
      return;
    }
    setIsEditing(false);
    setViewMode(true);
    setIsSaved(true);
    fetchJournalVoucherById(editingId);
  };

  // Edit button disabled logic
  const editDisabled = !isSaved || isEditing;

  return (
    <div>
      <div
        className={`general-vouchers-container ${isJournalListOpen}`}
        onClick={handleCloseContextMenu}
      >
        <AccountSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={handleAccountSelection}
        />
        <div className="general-vouchers-header">
          <h2 className="general-vouchers-title">Journal Voucher</h2>
        </div>
        <div className="general-vouchers-date-wrapper">
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
                <option value="S">S</option>
                <option value="G">G</option>
                <option value="SR">SR</option>
              </select>
            </label>
          </div>
          <div>
            <button className="new-btn" onClick={handleReset}>
              New
            </button>

            {/* Edit */}
            <button
              className="edit-journal-voucher"
              onClick={handleStartEdit}
              disabled={editDisabled}
              title={!isSaved ? "Open or save a voucher first" : ""}
            >
              Edit
            </button>

            {/* Cancel Edit */}
            {isEditing && (
              <button className="edit-journal-voucher" onClick={handleCancelEdit}>
                Cancel Edit
              </button>
            )}

            <button
              className="open-journal-list-btn"
              onClick={() => setIsJournalListOpen(true)}
            >
              Open Journal List
            </button>
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
            />

            {/* Submit vs Save Edit */}
            {!isSaved && !isEditing ? (
              <button
                className="general-vouchers-submit-btn"
                onClick={handleSubmit}
                disabled={submitBlocked}
              >
                Submit
              </button>
            ) : null}

            {isEditing && (
              <button
                className="general-vouchers-submit-btn"
                onClick={handleSaveEdit}
                disabled={submitBlocked}
              >
                Save Edit
              </button>
            )}
          </div>
        </div>

        <div className="general-vouchers-table-container">
          <table className="general-vouchers-table">
            <thead>
              <tr>
                <th className="column-account-number">Acc Nb</th>
                <th className="column-account-name">Account Name</th>
                <th className="column-currency">Currency</th>
                <th className="column-exchange-rate">Exc Rate</th>

                <th className="column-debit">Debit</th>
                <th className="column-debit-usd">Dr USD</th>
                <th className="column-debit-ex">Dr LL</th>

                <th className="column-debit-ofr">Dr OFR</th>
                <th className="column-debit-usd-ofr">Dr USD OFR</th>
                <th className="column-debit-ex-ofr">Dr LL OFR</th>

                <th className="column-exchange-rate-eur-usd">Exc (EUR to USD)</th>

                <th className="column-credit">Credit</th>
                <th className="column-credit-usd">Cr USD</th>
                <th className="column-credit-ex">Cr LL</th>
                <th className="column-credit-ofr">Cr OFR</th>
                <th className="column-credit-usd-ofr">Cr USD OFR</th>
                <th className="column-credit-ex-ofr">Cr LL OFR</th>

                <th className="column-description">Description</th>
                <th className="column-document-nbr">Doc Nbr</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={entry.rid}
                  onContextMenu={(e) => handleRightClick(e, index, entry.rid)}
                >
                  <td onClick={() => handleAccountNumberClick(entry.rid)}>
                    <input
                      type="text"
                      value={entry.accountNumber}
                      placeholder="Acc Nb"
                      readOnly
                      disabled={readOnlyMode}
                      className="general-vouchers-input column-account-number"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.accountName}
                      readOnly
                      disabled={readOnlyMode}
                      placeholder="Account Name"
                      className={`general-vouchers-input column-account-name ${
                        /[\u0600-\u06FF]/.test(entry.accountName) ? "is-arabic" : ""
                      }`}
                    />
                  </td>
                  <td>
                    <select
                      value={entry.currency}
                      onChange={(e) =>
                        handleInputChange(index, "currency", e.target.value)
                      }
                      disabled={readOnlyMode}
                      className="general-vouchers-input column-currency"
                    >
                      <option value="" disabled hidden>
                        Select
                      </option>
                      <option value="USD">USD</option>
                      <option value="LL">LL</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </td>

                  {/* Exc Rate */}
                  <td>
                    <input
                      type="text"
                      value={readOnlyMode ? formatNumber(entry.exchangeRate) : entry.exchangeRate}
                      placeholder="Exc Rate"
                      onChange={(e) =>
                        handleInputChange(index, "exchangeRate", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "exchangeRate")}
                      className="general-vouchers-input column-exchange-rate"
                      readOnly={readOnlyMode}
                      disabled={readOnlyMode}
                    />
                  </td>

                  {/* Debit */}
                  <td>
                    <input
                      type="text"
                      value={readOnlyMode ? formatNumber(entry.debit) : entry.debit}
                      placeholder="Debit"
                      onChange={(e) =>
                        handleInputChange(index, "debit", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "debit")}
                      className="general-vouchers-input column-debit"
                      readOnly={readOnlyMode || type === "G"}
                      disabled={readOnlyMode || type === "G"}
                    />
                  </td>

                  {/* Dr USD (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.debitUSD)}
                      placeholder="Debit USD"
                      readOnly
                      disabled
                      className="general-vouchers-input column-debit-usd"
                    />
                  </td>

                  {/* Dr LL (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.debitEx)}
                      placeholder="Debit LL"
                      className="general-vouchers-input column-debit-ex"
                      readOnly
                      disabled
                    />
                  </td>

                  {/* Dr OFR */}
                  <td>
                    <input
                      type="text"
                      value={readOnlyMode ? formatNumber(entry.debitOFR) : entry.debitOFR}
                      placeholder="Dr OFR"
                      onChange={(e) => handleInputChange(index, "debitOFR", e.target.value)}
                      onBlur={() => handleInputBlur(index, "debitOFR")}
                      className="general-vouchers-input column-debit-ofr"
                      readOnly={readOnlyMode || type === "S"}
                      disabled={readOnlyMode || type === "S"}
                    />
                  </td>

                  {/* Dr USD OFR (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.debitUSDOFR)}
                      placeholder="Dr USD OFR"
                      readOnly
                      disabled={readOnlyMode}
                      className="general-vouchers-input column-debit-usd-ofr"
                    />
                  </td>

                  {/* Dr LL OFR (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.debitExOFR)}
                      placeholder="Dr LL OFR"
                      readOnly
                      disabled={readOnlyMode}
                      className="general-vouchers-input column-debit-ex-ofr"
                    />
                  </td>

                  {/* Exc (EUR→USD) */}
                  <td className="column-exchange-rate-eur-usd">
                    {entry.currency === "EUR" ? (
                      <input
                        type="text"
                        value={
                          readOnlyMode
                            ? formatNumber(entry.exchangeRateEURtoUSD)
                            : entry.exchangeRateEURtoUSD
                        }
                        placeholder="Exc (EUR→USD)"
                        onChange={(e) =>
                          handleInputChange(
                            index,
                            "exchangeRateEURtoUSD",
                            e.target.value
                          )
                        }
                        onBlur={() =>
                          handleInputBlur(index, "exchangeRateEURtoUSD")
                        }
                        className="general-vouchers-input"
                        readOnly={readOnlyMode}
                        disabled={readOnlyMode}
                      />
                    ) : (
                      <div className="disabled-placeholder"></div>
                    )}
                  </td>

                  {/* Credit */}
                  <td>
                    <input
                      type="text"
                      value={readOnlyMode ? formatNumber(entry.credit) : entry.credit}
                      placeholder="Credit"
                      onChange={(e) =>
                        handleInputChange(index, "credit", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "credit")}
                      className="general-vouchers-input column-credit"
                      readOnly={readOnlyMode || type === "G"}
                      disabled={readOnlyMode || type === "G"}
                    />
                  </td>

                  {/* Cr USD (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.creditUSD)}
                      placeholder="Credit USD"
                      className="general-vouchers-input column-credit-usd"
                      readOnly
                      disabled
                    />
                  </td>

                  {/* Cr LL (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.creditEx)}
                      placeholder="Credit LL"
                      readOnly
                      className="general-vouchers-input column-credit-ex"
                      disabled
                    />
                  </td>

                  {/* Cr OFR */}
                  <td>
                    <input
                      type="text"
                      value={readOnlyMode ? formatNumber(entry.creditOFR) : entry.creditOFR}
                      placeholder="Cr OFR"
                      onChange={(e) =>
                        handleInputChange(index, "creditOFR", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "creditOFR")}
                      className="general-vouchers-input column-credit-ofr"
                      readOnly={readOnlyMode || type === "S"}
                      disabled={readOnlyMode || type === "S"}
                    />
                  </td>

                  {/* Cr USD OFR (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.creditUSDOFR)}
                      placeholder="Cr USD OFR"
                      readOnly
                      disabled={readOnlyMode}
                      className="general-vouchers-input column-credit-usd-ofr"
                    />
                  </td>

                  {/* Cr LL OFR (derived; formatted) */}
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.creditExOFR)}
                      placeholder="Cr LL OFR"
                      readOnly
                      disabled={readOnlyMode}
                      className="general-vouchers-input column-credit-ex-ofr"
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
                      className="general-vouchers-input column-description"
                      disabled={readOnlyMode}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.documentNbr}
                      placeholder="Doc Nbr"
                      onChange={(e) =>
                        handleInputChange(index, "documentNbr", e.target.value)
                      }
                      className="general-vouchers-input column-document-nbr"
                      disabled={readOnlyMode}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

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

        <div className="general-vouchers-summary">
          {/* Base totals row (used for S/SR) */}
          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit (Base):{" "}
              <span className={`number ${type === "G" ? "" : isEqualBase ? "equal" : "not-equal"}`}>
                {formatNumber(totalDebitBase)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit (Base):{" "}
              <span className={`number ${type === "G" ? "" : isEqualBase ? "equal" : "not-equal"}`}>
                {formatNumber(totalCreditBase)}
              </span>
            </span>
          </div>

          {/* OFR totals row (used for G) */}
          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit OFR:{" "}
              <span className={`number ${type === "G" ? (isEqualOFR ? "equal" : "not-equal") : ""}`}>
                {formatNumber(totalDebitOFR)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit OFR:{" "}
              <span className={`number ${type === "G" ? (isEqualOFR ? "equal" : "not-equal") : ""}`}>
                {formatNumber(totalCreditOFR)}
              </span>
            </span>
          </div>

          {/* Extra summaries */}
          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit USD:{" "}
              <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>
                {formatNumber(totalDebitUSD)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit USD:{" "}
              <span className={`number ${isUSDEqual ? "equal" : "not-equal"}`}>
                {formatNumber(totalCreditUSD)}
              </span>
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit LL:{" "}
              <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>
                {formatNumber(totalDebitLL)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit LL:{" "}
              <span className={`number ${isLLEqual ? "equal" : "not-equal"}`}>
                {formatNumber(totalCreditLL)}
              </span>
            </span>
          </div>
        </div>

        {contextMenu.visible && !readOnlyMode && (
          <div
            className="context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button className="context-menu-item" onClick={handleDeleteRow}>
              Delete
            </button>
          </div>
        )}
        {notification.visible && (
          <NotificationModal
            type={notification.type}
            message={notification.message}
            onClose={() => setNotification({ ...notification, visible: false })}
            onConfirm={notification.onConfirm}
            confirmLabel="OK"
            cancelLabel={notification.type === "warning" ? "Cancel" : null}
          />
        )}
      </div>
    </div>
  );
};

export default JournalVoucherPage;
