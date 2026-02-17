// UnitPriceModal.jsx
import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import "./styles/unitPriceModel.css";
import { axiosClient } from "../api/axiosClient"; // ✅ api client (adjust path if needed)

export default function UnitPriceModal({
  isVisible,
  onClose,
  onSave,
  isEditable,
  invoiceId,
  rows,
  onRowsChange,
}) {
  const [suppliers, setSuppliers] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // delete‐menu state
  const [deleteMenu, setDeleteMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    rowIndex: null,
  });

  const safeRows = rows ?? [];

  // 🔹 ref for keyboard navigation
  const tableRef = useRef(null);

  // ───────────────────────────── helpers ─────────────────────────────
  const setRows = (updater) => {
    // allow both functional and value usage
    if (typeof updater === "function") {
      onRowsChange((prev) => updater(prev ?? []));
    } else {
      onRowsChange(updater ?? []);
    }
  };

  // Close delete menu
  const closeDeleteMenu = () =>
    setDeleteMenu({ visible: false, x: 0, y: 0, rowIndex: null });

  // Right-click handler for delete
  const handleRowContext = (e, index) => {
    e.preventDefault();
    if (!isEditable) return;
    setDeleteMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      rowIndex: index,
    });
  };

  // Delete one row
  const handleDeleteRow = () => {
    if (deleteMenu.rowIndex == null) return;
    setRows((prev) => prev.filter((_, i) => i !== deleteMenu.rowIndex));
    closeDeleteMenu();
  };

  // Add a blank row
  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: undefined,
        purchaseInvoiceSettingId: null,
        chargeName: "",
        accountId: null,
        accountNumber: "",
        chargeType: "amount",
        value: 0,
        valueOFR: 0,
        currency: "usd",
        valueExch: 0,
        valueExchOFR: 0,
        addToItemCost: false,
        invoiceNbTax: "",
        supplierId: null, // (legacy/optional)
        supplierOfTax: "",
        accNbOfSupplier: "",
        shipping: false,

        // ✅ NEW persisted fields (match backend)
        taxAccountId: null,
        taxSupplierId: null,

        // UI helper
        supplierOfTaxType: "supplier", // "supplier" | "account"
      },
    ]);
  };

  // ─────────────────────── data loading on open ───────────────────────
  useEffect(() => {
    if (!isVisible) return;

    // suppliers
    axiosClient
      .get(`/suppliers`)
      .then((res) => setSuppliers(res.data))
      .catch(console.error);

    // accounts (flat, nested)
    axiosClient
      .get(`/accounts/v1/acc-flat-arranged`)
      .then((res) => setAccounts(res.data))
      .catch(console.error);
  }, [isVisible]);

  // ───────────────────────── 4619 + 2233 accounts ─────────────────────────
  const flattenAccounts = useCallback((list, out = []) => {
    (list || []).forEach((a) => {
      out.push(a);
      if (a.children?.length) flattenAccounts(a.children, out);
    });
    return out;
  }, []);

  const taxAccounts4619 = useMemo(() => {
    const flat = flattenAccounts(accounts || []);
    return flat.filter((a) =>
      String(a.accountNumber || "").startsWith("4619")
    );
  }, [accounts, flattenAccounts]);

  // ✅ NEW: 2233 accounts for Supplier of Tax
  const taxAccounts2233 = useMemo(() => {
    const flat = flattenAccounts(accounts || []);
    return flat.filter((a) =>
      String(a.accountNumber || "").startsWith("2233")
    );
  }, [accounts, flattenAccounts]);

  // Prefer already-typed rows from parent; only fetch rows if none exist
  useEffect(() => {
    if (!isVisible) return;
    if (safeRows.length > 0) return;

    const loadExisting = async () => {
      try {
        const { data } = await axiosClient.get(
          `/purchase-invoices/${invoiceId}`
        );

        const mapped = (data.unitPriceRows || []).map((r) => {
          // ✅ backend persisted fields
          const taxAccountId =
            r.taxAccountId ?? (r.taxAccount?.id ?? null);

          const taxSupplierId =
            r.taxSupplierId ?? (r.taxSupplier?.id ?? null);

          const supplierOfTaxType =
            taxAccountId != null
              ? "account"
              : "supplier";

          return {
            id: r.id,
            purchaseInvoiceSettingId: r.purchaseInvoiceSettingId,
            chargeName: r.chargeName,
            accountId: r.accountId,
            accountNumber: r.account?.accountNumber || "",
            chargeType: r.chargeType,
            value: Number(r.value),
            valueOFR: Number(r.valueOFR),
            currency: (r.currency || "USD").toLowerCase(),
            valueExch: Number(r.valueExch),
            valueExchOFR: Number(r.valueExchOFR),
            addToItemCost: !!r.addToItemCost,
            invoiceNbTax: r.invoiceNbTax,

            // keep legacy fields if present
            supplierId: r.supplierId ?? null,

            supplierOfTax: "",
            accNbOfSupplier: "",
            shipping: !!r.shipping,

            // ✅ persisted selection
            taxAccountId,
            taxSupplierId,

            // UI helper
            supplierOfTaxType,
          };
        });

        setRows(mapped);
      } catch (e) {
        console.error(e);
      }
    };

    const loadDefaults = async () => {
      try {
        const { data } = await axiosClient.get(`/purchase-invoice-setting`);
        const mapped = (data || []).map((row) => ({
          id: undefined,
          purchaseInvoiceSettingId: row.id,
          chargeName: row.chargeName || "",
          accountId: row.accountId ?? null,
          accountNumber: row.accountNumber ?? "",
          chargeType: row.type || "amount",
          value: row.value || 0,
          valueOFR: 0,
          currency: (row.currency || "USD").toLowerCase(),
          valueExch: row.valueEx || 0,
          valueExchOFR: 0,
          addToItemCost: !!row.atc,
          invoiceNbTax: "",
          supplierId: null,
          supplierOfTax: "",
          accNbOfSupplier: "",
          shipping: !!row.shipping,

          // ✅ persisted selection
          taxAccountId: null,
          taxSupplierId: null,

          // UI helper
          supplierOfTaxType: "supplier",
        }));
        setRows(mapped);
      } catch (e) {
        console.error(e);
      }
    };

    if (invoiceId) loadExisting();
    else loadDefaults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, invoiceId, safeRows.length]);

  // Once suppliers/accounts load, fill in derived fields for display (accNbOfSupplier + supplierOfTax)
  useEffect(() => {
    if (!isVisible) return;
    if (!suppliers.length && !accounts.length) return;

    const flat = flattenAccounts(accounts || []);
    const accById = new Map(flat.map((a) => [Number(a.id), a]));

    setRows((prev) =>
      (prev || []).map((r) => {
        // account selected for tax (covers both 4619 and 2233)
        if (r.taxAccountId) {
          const acc = accById.get(Number(r.taxAccountId));
          return {
            ...r,
            supplierOfTaxType: "account",
            supplierOfTax: acc
              ? `${acc.accountNumber} – ${acc.accountName}`
              : "",
            accNbOfSupplier: acc?.accountNumber || "",
          };
        }

        // supplier selected for tax
        const taxSupId = r.taxSupplierId ?? null;
        if (taxSupId) {
          const sup = suppliers.find((s) => Number(s.id) === Number(taxSupId));
          return {
            ...r,
            supplierOfTaxType: "supplier",
            supplierOfTax: sup?.supplierName || "",
            accNbOfSupplier: sup?.supplierAccountNumber || "",
          };
        }

        // none selected
        return {
          ...r,
          supplierOfTax: r.supplierOfTax || "",
          accNbOfSupplier: r.accNbOfSupplier || "",
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, suppliers, accounts, flattenAccounts]);

  // ───────────────────────── inputs & toggles ─────────────────────────
  const handleInput = (i, field, val) => {
    setRows((prev) => {
      const copy = [...(prev || [])];
      copy[i] = { ...copy[i] };

      // keep chargeType/currency/name/text fields as string; numeric as number
      if (
        field === "chargeType" ||
        field === "currency" ||
        field === "chargeName" ||
        field === "invoiceNbTax"
      ) {
        copy[i][field] = val;
      } else {
        copy[i][field] = val === "" ? "" : Number(val);
        if (!Number.isFinite(copy[i][field])) copy[i][field] = 0;
      }

      return copy;
    });
  };

  const handleToggle = (i, field) => {
    setRows((prev) => {
      const copy = [...(prev || [])];
      copy[i] = { ...copy[i], [field]: !copy[i][field] };
      return copy;
    });
  };

  // Charge account (JV debit uses this.accountId)
  const handleAccountChange = (i, acctId, e) => {
    const acctNumber =
      e.target.selectedOptions[0]?.getAttribute("data-account-number") || "";
    setRows((prev) => {
      const copy = [...(prev || [])];
      copy[i] = {
        ...copy[i],
        accountId: +acctId || null,
        accountNumber: acctNumber,
      };
      return copy;
    });
  };

  // Supplier of Tax dropdown change:
  // - If supplier selected  -> set taxSupplierId, clear taxAccountId
  // - If account selected   -> set taxAccountId,  clear taxSupplierId
  //   (works for both 4619 and 2233 accounts — both use the "acc:" prefix)
  // IMPORTANT: does NOT touch charge accountId
  const handleSupplierOfTaxChange = (i, rawVal) => {
    setRows((prev) => {
      const copy = [...(prev || [])];
      copy[i] = { ...copy[i] };

      const v = String(rawVal || "");
      if (!v) {
        copy[i].taxSupplierId = null;
        copy[i].taxAccountId = null;
        copy[i].supplierOfTaxType = "supplier";
        copy[i].supplierOfTax = "";
        copy[i].accNbOfSupplier = "";
        return copy;
      }

      const [kind, idStr] = v.split(":");
      const id = Number(idStr);

      if (kind === "sup") {
        const sup = suppliers.find((s) => s.id === id);

        copy[i].supplierOfTaxType = "supplier";
        copy[i].taxSupplierId = Number.isFinite(id) ? id : null;
        copy[i].taxAccountId = null;

        // optional legacy mirror (safe with your backend fallback)
        copy[i].supplierId = Number.isFinite(id) ? id : null;

        copy[i].supplierOfTax = sup?.supplierName || "";
        copy[i].accNbOfSupplier = sup?.supplierAccountNumber || "";

      } else if (kind === "acc") {
        // ✅ Handles both 4619 and 2233 accounts — search both lists
        const acc =
          taxAccounts4619.find((a) => a.id === id) ??
          taxAccounts2233.find((a) => a.id === id);

        copy[i].supplierOfTaxType = "account";
        copy[i].taxAccountId = Number.isFinite(id) ? id : null;
        copy[i].taxSupplierId = null;
        copy[i].supplierId = null;

        copy[i].supplierOfTax = acc
          ? `${acc.accountNumber} – ${acc.accountName}`
          : "";
        copy[i].accNbOfSupplier = acc?.accountNumber || "";
      }

      return copy;
    });
  };

  // ✅ When saving, send only what backend expects (keep extra UI fields if you want, backend ignores them)
  const save = () => {
    const payload = (safeRows || []).map((r) => ({
      ...r,
      // ensure numbers/nulls
      accountId: r.accountId != null ? Number(r.accountId) : null,
      supplierId: r.supplierId != null ? Number(r.supplierId) : null, // legacy
      taxAccountId: r.taxAccountId != null ? Number(r.taxAccountId) : null,
      taxSupplierId: r.taxSupplierId != null ? Number(r.taxSupplierId) : null,
      value: r.value === "" ? 0 : Number(r.value ?? 0),
      valueOFR: r.valueOFR === "" ? 0 : Number(r.valueOFR ?? 0),
      valueExch: r.valueExch === "" ? 0 : Number(r.valueExch ?? 0),
      valueExchOFR: r.valueExchOFR === "" ? 0 : Number(r.valueExchOFR ?? 0),
    }));

    onSave(payload);
  };

  const renderAccountOptions = (list, level = 0) =>
    (list || []).map((acc) => (
      <React.Fragment key={acc.id}>
        <option value={acc.id} data-account-number={acc.accountNumber}>
          {`${"  ".repeat(level)}${acc.accountNumber} – ${acc.accountName}`}
        </option>
        {acc.children?.length > 0 &&
          renderAccountOptions(acc.children, level + 1)}
      </React.Fragment>
    ));

  // Small perf: memoize suppliers map for select
  const supplierOptions = useMemo(() => suppliers || [], [suppliers]);

  // 🔹 ENTER navigation across inputs & selects
  const handleEnterNav = useCallback((e) => {
    if (e.key !== "Enter") return;

    e.preventDefault();

    const root = tableRef.current;
    if (!root) return;

    const focusable = Array.from(
      root.querySelectorAll(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
      )
    ).filter((el) => el.tabIndex !== -1);

    const idx = focusable.indexOf(e.target);
    if (idx === -1) return;

    const next = focusable[idx + 1];
    if (next) next.focus();
  }, []);

  if (!isVisible) return null;

  return (
    <div className="unit-price-modal-overlay" onClick={closeDeleteMenu}>
      <div
        className="unit-price-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Unit Price Details</h3>
          <button className="close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="unit-price-table-container">
          <table className="unit-price-table" ref={tableRef}>
            <thead>
              <tr>
                <th>Charge Name</th>
                <th>Charge Account</th>
                <th>Type</th>
                <th>Value</th>
                <th>Value OFR</th>
                <th>Currency</th>
                <th>Exch.</th>
                <th>Exch. OFR</th>
                <th>ATC</th>
                <th>Nb Tax</th>
                <th>Supplier of Tax</th>
                <th>Acc. Nb</th>
                <th>Shipping</th>
              </tr>
            </thead>

            <tbody>
              {safeRows.map((r, i) => (
                <tr key={i} onContextMenu={(e) => handleRowContext(e, i)}>
                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.chargeName || ""}
                      onChange={(e) =>
                        handleInput(i, "chargeName", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  {/* Charge Account (JV Debit uses row.accountId) */}
                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.accountId || ""}
                      onChange={(e) =>
                        handleAccountChange(i, e.target.value, e)
                      }
                      onKeyDown={handleEnterNav}
                    >
                      <option value="">Select Account</option>
                      {renderAccountOptions(accounts)}
                    </select>
                  </td>

                  <td>
                    <select
                      disabled={!isEditable}
                      value={r.chargeType || "amount"}
                      onChange={(e) =>
                        handleInput(i, "chargeType", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    >
                      <option value="amount">Amount</option>
                      <option value="percent">Percent</option>
                    </select>
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.value ?? 0}
                      onChange={(e) => handleInput(i, "value", e.target.value)}
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueOFR ?? 0}
                      onChange={(e) =>
                        handleInput(i, "valueOFR", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  <td>
                    <select
                      disabled={!isEditable}
                      value={(r.currency || "usd").toLowerCase()}
                      onChange={(e) =>
                        handleInput(i, "currency", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    >
                      <option value="usd">USD</option>
                      <option value="euro">Euro</option>
                      <option value="ll">LL</option>
                    </select>
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueExch ?? 0}
                      onChange={(e) =>
                        handleInput(i, "valueExch", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      type="number"
                      value={r.valueExchOFR ?? 0}
                      onChange={(e) =>
                        handleInput(i, "valueExchOFR", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      type="checkbox"
                      checked={!!r.addToItemCost}
                      onChange={() => handleToggle(i, "addToItemCost")}
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      value={r.invoiceNbTax || ""}
                      onChange={(e) =>
                        handleInput(i, "invoiceNbTax", e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  {/* ✅ Supplier of Tax: Suppliers + 4619 Accounts + 2233 Accounts */}
                  <td>
                    <select
                      disabled={!isEditable}
                      value={
                        r.taxAccountId
                          ? `acc:${r.taxAccountId}`
                          : r.taxSupplierId
                          ? `sup:${r.taxSupplierId}`
                          : ""
                      }
                      onChange={(e) =>
                        handleSupplierOfTaxChange(i, e.target.value)
                      }
                      onKeyDown={handleEnterNav}
                    >
                      <option value="">-- select --</option>

                      <optgroup label="Suppliers">
                        {supplierOptions.map((s) => (
                          <option key={`sup:${s.id}`} value={`sup:${s.id}`}>
                            {s.supplierName}
                          </option>
                        ))}
                      </optgroup>

                      <optgroup label="4619 Accounts">
                        {taxAccounts4619.map((a) => (
                          <option key={`acc:${a.id}`} value={`acc:${a.id}`}>
                            {a.accountNumber} – {a.accountName}
                          </option>
                        ))}
                      </optgroup>

                      {/* ✅ NEW: 2233 Accounts */}
                      <optgroup label="2233 Accounts">
                        {taxAccounts2233.map((a) => (
                          <option key={`acc:${a.id}`} value={`acc:${a.id}`}>
                            {a.accountNumber} – {a.accountName}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </td>

                  {/* Acc Nb: shows supplier account number OR account number (4619 or 2233) */}
                  <td>
                    <input
                      readOnly
                      value={r.accNbOfSupplier || ""}
                      placeholder="Acct #"
                      onKeyDown={handleEnterNav}
                    />
                  </td>

                  <td>
                    <input
                      disabled={!isEditable}
                      type="checkbox"
                      checked={!!r.shipping}
                      onChange={() => handleToggle(i, "shipping")}
                      onKeyDown={handleEnterNav}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {deleteMenu.visible && (
          <div
            className="context-menu-purchases"
            style={{
              position: "absolute",
              top: deleteMenu.y,
              left: deleteMenu.x,
              zIndex: 1000,
            }}
          >
            <button onClick={handleDeleteRow}>Delete Row</button>
          </div>
        )}

        <div className="table-actions">
          <button
            className="unit-price-add-row-button"
            disabled={!isEditable}
            onClick={handleAddRow}
          >
            + Add Row
          </button>
          <button
            className="unit-price-save-button"
            disabled={!isEditable}
            onClick={save}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}