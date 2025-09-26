// src/pages/Reports/ReportsPage.jsx
import React, { useState } from "react";
import "./Reports.css";
import TrialBalance from "./TrialBalance";
import AccountStatement from "./AccountStatement"; // <-- NEW

const TABS = [
  { key: "trial-balance", label: "Trial Balance / ميزان المراجعة" },
  { key: "account-statement", label: "Account Statement / كشف حساب" }, // NEW
  { key: "ledger", label: "General Ledger (soon)", disabled: true },
  { key: "aging", label: "A/R Aging (soon)", disabled: true },
];

export default function ReportsPage() {
  const [active, setActive] = useState("trial-balance");

  return (
    <div className="reports-page">
      <div className="reports-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`reports-tab ${active === t.key ? "active" : ""}`}
            onClick={() => !t.disabled && setActive(t.key)}
            disabled={t.disabled}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="reports-panel">
        {active === "trial-balance" && <TrialBalance />}
        {active === "account-statement" && <AccountStatement />}{/* NEW */}
        {active !== "trial-balance" && active !== "account-statement" && (
          <div className="reports-coming-soon">
            <p>Coming soon…</p>
          </div>
        )}
      </div>
    </div>
  );
}
