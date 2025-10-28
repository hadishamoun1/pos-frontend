import React, { useState, useEffect } from "react";
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
  const [viewMode, setViewMode] = useState(false);
  const baseUrl = process.env.REACT_APP_API_BASE_URL;

  // ✅ NEW: pagination state for the journal list
  const [summaryPage, setSummaryPage] = useState(1);
  const [hasMoreSummary, setHasMoreSummary] = useState(true);
  const [loadingMoreSummary, setLoadingMoreSummary] = useState(false);
  // (optional future) const [summaryQuery, setSummaryQuery] = useState("");

  const [notification, setNotification] = useState({
    visible: false,
    type: "",
    message: "",
    onConfirm: null,
  });
  const [entries, setEntries] = useState([
    {
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
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const parseNumber = (value) => {
    if (value === "" || value === null || value === undefined) return 0;
    const stringValue = value.toString().replace(/,/g, "");
    return isNaN(stringValue) ? 0 : parseFloat(stringValue);
  };

  const formatNumber = (value) => {
    if (value === null || value === undefined || value === "") return "";
    return parseFloat(value).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleAddRow = () => {
    setEntries((e) => [
      ...e,
      {
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

  const recalcEntry = (entry) => {
    // called whenever any of the 6 driving fields changes
    const d = parseNumber(entry.debit);
    const c = parseNumber(entry.credit);
    const ofrD = parseNumber(entry.debitOFR);
    const ofrC = parseNumber(entry.creditOFR);
    const r = parseNumber(entry.exchangeRate);
    const toS = (n) => n.toString();

    // reset everything
    entry.debitUSD = "0";
    entry.creditUSD = "0";
    entry.debitEx = "0";
    entry.creditEx = "0";
    entry.debitUSDOFR = "0";
    entry.creditUSDOFR = "0";
    entry.debitExOFR = "0";
    entry.creditExOFR = "0";

    // TYPE S
    if (type === "S") {
      if (entry.currency === "USD") {
        entry.debitUSD = toS(d);
        entry.creditUSD = toS(c);

        // Keep OFR base equal to base for S-USD
        entry.debitOFR = toS(d);
        entry.creditOFR = toS(c);

        // LL = base * rate
        entry.debitEx = toS(d * r);
        entry.creditEx = toS(c * r);

        // LL OFR = OFR * rate
        entry.debitExOFR = toS(ofrD * r);
        entry.creditExOFR = toS(ofrC * r);

        // USD OFR mirrors OFR amounts for S-USD
        entry.debitUSDOFR = toS(ofrD);
        entry.creditUSDOFR = toS(ofrC);
      } else if (entry.currency === "LL") {
        entry.debitEx = toS(d);
        entry.creditEx = toS(c);
        entry.debitExOFR = toS(ofrD);
        entry.creditExOFR = toS(ofrC);
        entry.debitUSD = toS(d / r);
        entry.creditUSD = toS(c / r);
        entry.debitUSDOFR = toS(ofrD / r);
        entry.creditUSDOFR = toS(ofrC / r);
        entry.debit = entry.debitEx;
        entry.credit = entry.creditEx;
        entry.debitOFR = entry.debitExOFR;
        entry.creditOFR = entry.creditExOFR;
      }
    }

    // TYPE G
    else if (type === "G") {
      if (entry.currency === "USD") {
        // base = zero; OFR stays editable
        entry.debitUSDOFR = toS(ofrD);
        entry.creditUSDOFR = toS(ofrC);
        entry.debitExOFR = toS(ofrD * r);
        entry.creditExOFR = toS(ofrC * r);
      } else if (entry.currency === "LL") {
        entry.debitExOFR = toS(ofrD);
        entry.debitUSDOFR = toS(ofrD / r);
        entry.creditExOFR = toS(ofrC);
        entry.creditUSDOFR = toS(ofrC / r);
      }
    }

    // TYPE SR
    else if (type === "SR") {
      if (entry.currency === "USD") {
        entry.debitUSD = toS(d);
        entry.creditUSD = toS(c);
        entry.debitEx = toS(d * r);
        entry.creditEx = toS(c * r);
        entry.debitUSDOFR = toS(ofrD);
        entry.creditUSDOFR = toS(ofrC);
        entry.debitExOFR = toS(ofrD * r);
        entry.creditExOFR = toS(ofrC * r);
      } else if (entry.currency === "LL") {
        entry.debitEx = toS(d);
        entry.creditEx = toS(c);
        entry.debitExOFR = toS(ofrD);
        entry.creditExOFR = toS(ofrC);
        entry.debitUSD = toS(d / r);
        entry.creditUSD = toS(c / r);
        entry.debitUSDOFR = toS(ofrD / r);
        entry.creditUSDOFR = toS(ofrC / r);
      }
      // (EUR if needed)
    }
  };

  const handleInputChange = (index, field, value) => {
    const updated = [...entries];
    const entry = updated[index];
    entry[field] = value;

    if (
      !viewMode &&
      ["debit", "credit", "debitOFR", "creditOFR", "exchangeRate", "currency"].includes(field)
    ) {
      recalcEntry(entry);
    }

    setEntries(updated);
  };

  const handleInputBlur = (index, field) => {
    const updated = [...entries];
    const value = parseNumber(updated[index][field]);
    updated[index][field] = formatNumber(value);
    setEntries(updated);
  };

  const handleAccountSelection = (entity) => {
    if (currentRowIndex === null) {
      alert("Please select a row to assign an account.");
      return;
    }

    const updatedEntries = [...entries];
    const row = updatedEntries[currentRowIndex];

    // clear previous FKs
    row.accountId = null;
    row.customerId = null;
    row.supplierId = null;

    // set the correct FK based on what was chosen
    if (entity.entityType === "account") row.accountId = entity.id;
    if (entity.entityType === "customer") row.customerId = entity.id;
    if (entity.entityType === "supplier") row.supplierId = entity.id;

    // display number/name in the grid
    row.accountNumber = entity.accountNumber;
    row.accountName = entity.accountName;

    setEntries(updatedEntries);
    setIsModalOpen(false);
  };

  const handleAccountNumberClick = (index) => {
    setCurrentRowIndex(index);
    setIsModalOpen(true);
  };

  const handleRightClick = (event, rowIndex) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      rowIndex,
    });
  };

  const handleDeleteRow = () => {
    if (contextMenu.rowIndex !== null) {
      setEntries(entries.filter((_, index) => index !== contextMenu.rowIndex));
      setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, rowIndex: null });
  };

  // ===== Totals =====
  // Base totals (used for S/SR)
  const totalDebitBase = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debit), 0)
  );
  const totalCreditBase = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.credit), 0)
  );

  // OFR totals (used for G)
  const totalDebitOFR = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debitOFR), 0)
  );
  const totalCreditOFR = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.creditOFR), 0)
  );

  // Other totals you already had
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

  // Equality flags used for UI
  const isEqualBase = totalDebitBase === totalCreditBase && totalDebitBase !== 0;
  const isEqualOFR = totalDebitOFR === totalCreditOFR && totalDebitOFR !== 0;
  const isUSDEqual = totalDebitUSD === totalCreditUSD;
  const isLLEqual = totalDebitLL === totalCreditLL;

  // Use the right equality rule depending on type
  const submitBlocked =
    !type ||
    !date ||
    (type === "G" ? !isEqualOFR : !isEqualBase);

  const handleSubmit = async () => {
    console.log("Current entries state:", entries);

    // helper: treat "", null, "0", "0.00" as zero
    const isZero = (v) => {
      const n = parseNumber(v);
      return !n || n === 0;
    };

    // helper: a row is "empty" if it has no FK and no amounts
    const isEmptyRow = (e) =>
      !e.accountId &&
      !e.customerId &&
      !e.supplierId &&
      isZero(e.debit) &&
      isZero(e.credit) &&
      isZero(e.debitOFR) &&
      isZero(e.creditOFR);

    // ignore totally empty rows
    const effectiveEntries = entries.filter((e) => !isEmptyRow(e));

    try {
      if (effectiveEntries.length === 0) {
        setNotification({
          visible: true,
          type: "error",
          message: "Please add at least one non-empty entry.",
        });
        return;
      }

      // VALIDATION: allow account OR customer OR supplier
      const invalidEntries = effectiveEntries.filter(
        (e) => !e.accountId && !e.customerId && !e.supplierId
      );
      if (invalidEntries.length > 0) {
        setNotification({
          visible: true,
          type: "error",
          message: "Each row must pick an Account, Customer, or Supplier.",
        });
        return;
      }

      if (!type) {
        setNotification({
          type: "error",
          message: "Please select a type for the Journal Voucher.",
          visible: true,
        });
        return;
      }
      if (!date) {
        setNotification({
          type: "error",
          message: "Please select a date for the Journal Voucher.",
          visible: true,
        });
        return;
      }

      // Prepare the payload
      const removeCommas = (value) =>
        typeof value === "string" ? value.replace(/,/g, "") : value;

      const payload = {
        date,
        jvType: type,
        details: effectiveEntries.map((entry) => ({
          accountId: entry.accountId || undefined,
          customerId: entry.customerId || undefined,
          supplierId: entry.supplierId || undefined,
          description: entry.description,
          debit: removeCommas(entry.debit),
          debitUSD: removeCommas(entry.debitUSD),
          debitLL: removeCommas(entry.debitEx),
          credit: removeCommas(entry.credit),
          creditUSD: removeCommas(entry.creditUSD),
          creditLL: removeCommas(entry.creditEx),
          currency: entry.currency,
          exchangeRateEURtoUSD: removeCommas(entry.exchangeRateEURtoUSD),
          exchangeRate: removeCommas(entry.exchangeRate),
          docNbr: entry.documentNbr,
        })),
      };

      console.log("Payload to be sent:", JSON.stringify(payload, null, 2));

      const response = await axios.post(`${baseUrl}/journal-vouchers`, payload);

      if (response.status === 201) {
        setNotification({
          visible: true,
          type: "success",
          message: "Journal Voucher submitted successfully!",
        });

        console.log("Response:", response.data);

        // Reset the form
        setDate("");
        setEntries([
          {
            accountId: null,
            accountNumber: "",
            accountName: "",
            currency: "",
            debit: "",
            credit: "",
            exchangeRate: "1",
            exchangeRateEURtoUSD: "",
            debitUSD: "",
            creditUSD: "",
            debitEx: "",
            creditEx: "",
            description: "",
            documentNbr: "",
          },
        ]);
      }
    } catch (error) {
      console.error(
        "Error submitting journal voucher:",
        error.response || error.message
      );
      setNotification({
        visible: true,
        type: "error",
        message: "Failed to submit the journal voucher. Please try again.",
      });
    }
  };

  // ====== PAGINATED fetch for the modal list ======
  const fetchJournalData = async (pageArg = 1 /* , qArg = "" */) => {
    // The backend forces 100 per page and returns { data, page, limit, total, totalPages, hasMore }
    const url = `${baseUrl}/journal-vouchers/v1/list?page=${pageArg}`;
    // if you add search later: + `&q=${encodeURIComponent(qArg)}`
    const response = await axios.get(url);
    return response.data;
  };

  useEffect(() => {
    if (isJournalListOpen) {
      (async () => {
        try {
          setLoading(true);
          setSummaryPage(1);
          const res = await fetchJournalData(1 /* , summaryQuery */);
          setJournalData(res.data || []);
          setHasMoreSummary(Boolean(res.hasMore));
        } catch (error) {
          console.error("Error fetching journal data:", error);
          setJournalData([]);
          setHasMoreSummary(false);
        } finally {
          setLoading(false);
        }
      })();
    }
  }, [isJournalListOpen /* , summaryQuery */]);

  const handleLoadMore = async () => {
    if (!hasMoreSummary || loadingMoreSummary) return;
    try {
      setLoadingMoreSummary(true);
      const next = summaryPage + 1;
      const res = await fetchJournalData(next /* , summaryQuery */);
      setJournalData((prev) => [...prev, ...(res.data || [])]);
      setSummaryPage(next);
      setHasMoreSummary(Boolean(res.hasMore));
    } catch (e) {
      console.error("Error loading more:", e);
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

      setEntries(
        jv.details.map((d) => {
          const entityId = d.accountId || d.supplierId || d.customerId || null;
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
        })
      );
    } catch (error) {
      console.error("Error fetching journal voucher by ID:", error);
      setNotification({
        visible: true,
        type: "error",
        message: "Failed to fetch journal voucher details. Please try again.",
      });
    }
  };

  const handleView = (journal) => {
    console.log("View journal:", journal);
    setIsJournalListOpen(false);
    fetchJournalVoucherById(journal.id);
    setViewMode(true);
  };

  const handleReset = () => {
    setDate("");
    setType("");
    setEntries([
      {
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

    setViewMode(false);
  };

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
                disabled={viewMode}
                className="general-vouchers-input"
              />
            </label>
            <label className="general-vouchers-label">
              Type:
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                required
                disabled={viewMode}
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
              // ✅ NEW: pagination props
              onLoadMore={handleLoadMore}
              hasMore={hasMoreSummary}
              loadingMore={loadingMoreSummary}
            />

            <button
              className="general-vouchers-submit-btn"
              onClick={handleSubmit}
              disabled={submitBlocked}
            >
              Submit
            </button>
          </div>
        </div>

        <div className="general-vouchers-table-container">
          <table className="general-vouchers-table">
            <thead>
              <tr>
                <th className="column-account-number">Acc Nb</th>
                <th className="column-account-name">Account Name</th>
                <th className="column-currency">Currency</th>

                <th className="column-debit">Debit</th>
                <th className="column-debit-ofr">Dr OFR</th>

                <th className="column-exchange-rate-eur-usd">
                  Exc (EUR to USD)
                </th>
                <th className="column-exchange-rate">Exc Rate</th>

                <th className="column-debit-usd">Dr USD</th>
                <th className="column-debit-usd-ofr">Dr USD OFR</th>

                <th className="column-debit-ex">Dr LL</th>
                <th className="column-debit-ex-ofr">Dr LL OFR</th>

                <th className="column-credit">Credit</th>
                <th className="column-credit-ofr">Cr OFR</th>

                <th className="column-credit-usd">Cr USD</th>
                <th className="column-credit-usd-ofr">Cr USD OFR</th>

                <th className="column-credit-ex">Cr LL</th>
                <th className="column-credit-ex-ofr">Cr LL OFR</th>

                <th className="column-description">Description</th>
                <th className="column-document-nbr">Doc Nbr</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry, index) => (
                <tr key={index} onContextMenu={(e) => handleRightClick(e, index)}>
                  <td onClick={() => handleAccountNumberClick(index)}>
                    <input
                      type="text"
                      value={entry.accountNumber}
                      placeholder="Acc Nb"
                      readOnly
                      disabled={viewMode}
                      className="general-vouchers-input column-account-number"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.accountName}
                      readOnly
                      disabled={viewMode}
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
                      disabled={viewMode}
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

                  <td>
                    <input
                      type="text"
                      value={entry.debit}
                      placeholder="Debit"
                      onChange={(e) =>
                        handleInputChange(index, "debit", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "debit")}
                      className="general-vouchers-input column-debit"
                      readOnly={viewMode || type === "G"}
                      disabled={viewMode || type === "G"}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.debitOFR}
                      placeholder="Dr OFR"
                      onChange={(e) =>
                        handleInputChange(index, "debitOFR", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "creditOFR")}
                      className="general-vouchers-input column-credit-ofr"
                      readOnly={viewMode || type === "S"}
                      disabled={viewMode || type === "S"}
                    />
                  </td>

                  <td className="column-exchange-rate-eur-usd">
                    {entry.currency === "EUR" ? (
                      <input
                        type="text"
                        value={entry.exchangeRateEURtoUSD}
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
                        readOnly={viewMode}
                        disabled={viewMode}
                      />
                    ) : (
                      <div className="disabled-placeholder"></div>
                    )}
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.exchangeRate}
                      placeholder="Exc Rate"
                      onChange={(e) =>
                        handleInputChange(index, "exchangeRate", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "exchangeRate")}
                      className="general-vouchers-input column-exchange-rate"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={entry.debitUSD}
                      placeholder="Debit USD"
                      onChange={(e) =>
                        handleInputChange(index, "debitUSD", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "debitUSD")}
                      className="general-vouchers-input column-debit-usd"
                      readOnly={viewMode || type === "G"}
                      disabled={viewMode || type === "G"}
                    />
                  </td>

                  {/* NOTE: This column was bound to debitOFR in your code.
                      Keeping it as-is to preserve behavior. */}
                  <td>
                    <input
                      type="text"
                      value={entry.debitOFR}
                      placeholder="Dr OFR"
                      onChange={(e) => handleInputChange(index, "debitOFR", e.target.value)}
                      onBlur={() => handleInputBlur(index, "debitOFR")}
                      className="general-vouchers-input column-debit-ofr"
                      readOnly={viewMode || type === "S"}
                      disabled={viewMode || type === "S"}
                    />
                  </td>

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
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.debitExOFR)}
                      placeholder="Dr LL OFR"
                      readOnly
                      disabled={viewMode}
                      className="general-vouchers-input column-debit-ex-ofr"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={entry.credit}
                      placeholder="Credit"
                      onChange={(e) =>
                        handleInputChange(index, "credit", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "credit")}
                      className="general-vouchers-input column-credit"
                      readOnly={viewMode || type === "G"}
                      disabled={viewMode || type === "G"}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.creditOFR}
                      placeholder="Cr OFR"
                      onChange={(e) =>
                        handleInputChange(index, "creditOFR", e.target.value)
                      }
                      onBlur={() => handleInputBlur(index, "creditOFR")}
                      className="general-vouchers-input column-credit-ofr"
                      readOnly={viewMode || type === "S"}
                      disabled={viewMode || type === "S"}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      value={entry.creditUSD}
                      placeholder="Credit USD"
                      className="general-vouchers-input column-credit-usd"
                      readOnly
                      disabled
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={entry.creditUSDOFR}
                      placeholder="Cr USD OFR"
                      readOnly
                      disabled={viewMode}
                      className="general-vouchers-input column-credit-usd-ofr"
                    />
                  </td>

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
                  <td>
                    <input
                      type="text"
                      value={formatNumber(entry.creditExOFR)}
                      placeholder="Cr LL OFR"
                      readOnly
                      disabled={viewMode}
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
                      disabled={viewMode}
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
                      disabled={viewMode}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="general-vouchers-add-row-container">
          <button className="general-vouchers-new-btn" onClick={handleAddRow}>
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

          {/* Your existing extra summaries */}
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

        {contextMenu.visible && (
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
