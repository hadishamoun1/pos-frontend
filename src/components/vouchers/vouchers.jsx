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

  const [notification, setNotification] = useState({
    visible: false,
    type: "",
    message: "",
    onConfirm: null,
  });
  const [entries, setEntries] = useState([
    {
      accountId: null,
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
        accountId: "",
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
        entry.debitUSDOFR = toS(d);
        entry.creditUSDOFR = toS(c);
        entry.debitEx = toS(d * r);
        entry.creditEx = toS(c * r);
        entry.debitExOFR = toS(d * r);
        entry.creditExOFR = toS(c * r);
        entry.debitOFR = toS(d);
        entry.creditOFR = toS(c);
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
      // (add EUR same pattern if needed)
    }
    // TYPE G
    else if (type === "G") {
      if (entry.currency === "USD") {
        // base = zero
        // OFR stays editable
        entry.debitUSDOFR = toS(ofrD);
        entry.creditUSDOFR = toS(ofrC);
        entry.debitExOFR = toS(ofrD * r);
        entry.creditExOFR = toS(ofrC * r);
      }
      // (LL)
      else if (entry.currency === "LL") {
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
      [
        "debit",
        "credit",
        "debitOFR",
        "creditOFR",
        "exchangeRate",
        "currency",
      ].includes(field)
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

  const handleAccountSelection = (account) => {
    if (currentRowIndex === null) {
      // If no specific row is selected, show an error or handle as needed

      alert("Please select a row to assign an account.");
      return;
    }

    // Set account for the selected entry
    const updatedEntries = [...entries];
    updatedEntries[currentRowIndex].accountId = account.id; // Set the accountId
    updatedEntries[currentRowIndex].accountNumber = account.accountNumber; // Set the accountNumber
    updatedEntries[currentRowIndex].accountName = account.accountName; // Set the accountName

    console.log("Updated entries after account selection:", updatedEntries); // Log updated entries
    setEntries(updatedEntries); // Update the state with modified entries
    setIsModalOpen(false); // Close the modal
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

  const totalDebit = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.debit), 0)
  );
  const totalCredit = parseNumber(
    entries.reduce((sum, entry) => sum + parseNumber(entry.credit), 0)
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

  const handleSubmit = async () => {
    console.log("Current entries state:", entries);
    try {
      // Validate that every entry has an accountId
      const invalidEntries = entries.filter((entry) => !entry.accountId);
      if (invalidEntries.length > 0) {
        setNotification({
          visible: true,
          type: "error",
          message: "All entries must have a valid account selected.",
        });

        console.log("Invalid entries:", invalidEntries);
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
        details: entries.map((entry) => ({
          accountId: entry.accountId,
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

      // Make the API call
      const response = await axios.post(
        "http://localhost:3000/journal-vouchers",
        payload
      );

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

  const isEqual = totalDebit === totalCredit;
  const isUSDEqual = totalDebitUSD === totalCreditUSD;
  const isLLEqual = totalDebitLL === totalCreditLL;

  // Fetch journal data from API
  const fetchJournalData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        "http://localhost:3000/journal-vouchers/v1/list"
      );
      setJournalData(response.data); // Update the journalData state
    } catch (error) {
      console.error("Error fetching journal data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isJournalListOpen) {
      fetchJournalData();
    }
  }, [isJournalListOpen]);

  // Fetch a single journal voucher by ID
  const fetchJournalVoucherById = async (id) => {
    try {
      const { data: jv } = await axios.get(
        `http://localhost:3000/journal-vouchers/${id}`
      );

      setDate(jv.date);
      setType(jv.jvType);
      setEntries(
        jv.details.map((d) => ({
          accountId: d.accountId,
          accountNumber: d.accountNumber || d.account?.accountNumber || "",
          accountName: d.accountName || d.account?.accountName || "",
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
        }))
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

  // Handle the "View" button click
  const handleView = (journal) => {
    console.log("View journal:", journal);
    setIsJournalListOpen(false); // Close the journal list modal
    fetchJournalVoucherById(journal.id); // Fetch and fill the form with details
    setViewMode(true);
  };

  const handleReset = () => {
    setDate(""); // Clear date
    setType(""); // Clear type
    setEntries([
      // Reset entries to the initial empty state
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
    setViewMode(false); // Disable view mode to allow editing
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
                {/* Add other types if necessary */}
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
            />

            <button
              className="general-vouchers-submit-btn"
              onClick={handleSubmit}
              disabled={totalDebit !== totalCredit || totalDebit === 0}
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

                {/* Base Debit */}
                <th className="column-debit">Debit</th>
                {/* OFR Debit */}
                <th className="column-debit-ofr">Dr OFR</th>

                {/* Exchange (EUR→USD) */}
                <th className="column-exchange-rate-eur-usd">
                  Exc (EUR to USD)
                </th>
                {/* Base Exchange Rate */}
                <th className="column-exchange-rate">Exc Rate</th>

                {/* Base Debit USD */}
                <th className="column-debit-usd">Dr USD</th>
                {/* OFR Debit USD */}
                <th className="column-debit-usd-ofr">Dr USD OFR</th>

                {/* Base Debit LL */}
                <th className="column-debit-ex">Dr LL</th>
                {/* OFR Debit LL */}
                <th className="column-debit-ex-ofr">Dr LL OFR</th>

                {/* Base Credit */}
                <th className="column-credit">Credit</th>
                {/* OFR Credit */}
                <th className="column-credit-ofr">Cr OFR</th>

                {/* Base Credit USD */}
                <th className="column-credit-usd">Cr USD</th>
                {/* OFR Credit USD */}
                <th className="column-credit-usd-ofr">Cr USD OFR</th>

                {/* Base Credit LL */}
                <th className="column-credit-ex">Cr LL</th>
                {/* OFR Credit LL */}
                <th className="column-credit-ex-ofr">Cr LL OFR</th>

                <th className="column-description">Description</th>
                <th className="column-document-nbr">Doc Nbr</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry, index) => (
                <tr
                  key={index}
                  onContextMenu={(e) => handleRightClick(e, index)}
                >
                  {/* Acc Nb */}
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
                  {/* Account Name */}
                  <td>
                    <input
                      type="text"
                      value={entry.accountName}
                      readOnly
                      disabled={viewMode}
                      placeholder="Account Name"
                      className="general-vouchers-input column-account-name"
                    />
                  </td>
                  {/* Currency */}
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

                  {/* Base Debit */}
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
                  {/* OFR Debit */}
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

                  {/* Exc (EUR→USD) */}
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
                  {/* Base Exchange Rate */}
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

                  {/* Base Debit USD */}
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
                  {/* OFR Debit USD */}
                  <td>
                    <input
                      type="text"
                      value={entry.debitUSDOFR}
                      placeholder="Dr USD OFR"
                      readOnly
                      disabled={viewMode}
                      className="general-vouchers-input column-debit-usd-ofr"
                    />
                  </td>

                  {/* Base Debit LL */}
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
                  {/* OFR Debit LL */}
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

                  {/* Base Credit */}
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
                  {/* OFR Credit */}
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

                  {/* Base Credit USD */}
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
                  {/* OFR Credit USD */}
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

                  {/* Base Credit LL */}
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
                  {/* OFR Credit LL */}
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

                  {/* Description */}
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
                  {/* Doc Nbr */}
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
          <div className="summary-row">
            <span className="summary-total-txt">
              Total Debit:{" "}
              <span className={`number ${isEqual ? "equal" : "not-equal"}`}>
                {formatNumber(totalDebit)}
              </span>
            </span>
            <span className="summary-total-txt">
              Total Credit:{" "}
              <span className={`number ${isEqual ? "equal" : "not-equal"}`}>
                {formatNumber(totalCredit)}
              </span>
            </span>
          </div>
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
