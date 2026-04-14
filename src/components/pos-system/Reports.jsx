// src/pages/Reports/ReportsPage.jsx
import React, { useState } from "react";
import "./Reports.css";
import TrialBalance from "./TrialBalance";
import AccountStatement from "./AccountStatement";
import CostAnalysis from "./CostAnalysis";
import CustomerBalances from "./CustomerBalances";
import ProfitabilityReport from "./Profitability-report";
import CustomerActivityReport from "./Customeractivityreport"; // ✅ NEW

// ✅ Permission check helper
function hasPerm(perm) {
  if (!perm) return true;
  const token = sessionStorage.getItem("token");
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const perms = payload?.permissions || [];
    return perms.includes(perm);
  } catch {
    return false;
  }
}

const TABS = [
  {
    key: "trial-balance",
    label: "Trial Balance / ميزان المراجعة",
    perm: "reports.trialBalance",
  },
  {
    key: "account-statement",
    label: "Account Statement / كشف حساب",
    perm: "reports.accountStatement",
  },
  {
    key: "cost-analysis",
    label: "Cost Analysis / تحليل الكلفة",
    perm: "reports.costAnalysis",
  },
  {
    key: "customer-balances",
    label: "Customer Balances / أرصدة الزبائن",
    perm: "reports.customerBalances",
  },
  {
    key: "profitability",
    label: "Profitability / الربحية",
    perm: "reports.profitability",
  },
  // ✅ NEW TAB
  {
    key: "customer-activity",
    label: "Customer Activity / نشاط الزبائن",
    perm: "reports.customerBalances", // reuse same perm or create reports.customerActivity
  },
  {
    key: "aging",
    label: "A/R Aging (soon)",
    disabled: true,
  },
];

export default function ReportsPage() {
  const visibleTabs = TABS.filter((t) => !t.perm || hasPerm(t.perm));
  const [active, setActive] = useState(() => {
    const saved = sessionStorage.getItem("reports_active_tab");
    return saved && visibleTabs.some((t) => t.key === saved) ? saved : (visibleTabs[0]?.key || "trial-balance");
  });

  const handleSetActive = (key) => {
    sessionStorage.setItem("reports_active_tab", key);
    setActive(key);
  };

  const noAccess =
    (active === "trial-balance"       && !hasPerm("reports.trialBalance"))      ||
    (active === "account-statement"   && !hasPerm("reports.accountStatement"))  ||
    (active === "cost-analysis"       && !hasPerm("reports.costAnalysis"))       ||
    (active === "customer-balances"   && !hasPerm("reports.customerBalances"))  ||
    (active === "profitability"       && !hasPerm("reports.profitability"))      ||
    (active === "customer-activity"   && !hasPerm("reports.customerBalances"));

  return (
    <div className="reports-page">
      <div className="reports-tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={`reports-tab ${active === t.key ? "active" : ""}`}
            onClick={() => !t.disabled && handleSetActive(t.key)}
            disabled={t.disabled}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="reports-panel">
        {active === "trial-balance"     && hasPerm("reports.trialBalance")     && <TrialBalance />}
        {active === "account-statement" && hasPerm("reports.accountStatement") && <AccountStatement />}
        {active === "cost-analysis"     && hasPerm("reports.costAnalysis")     && <CostAnalysis />}
        {active === "customer-balances" && hasPerm("reports.customerBalances") && <CustomerBalances />}
        {active === "profitability"     && hasPerm("reports.profitability")    && <ProfitabilityReport />}

        {/* ✅ NEW */}
        {active === "customer-activity" && hasPerm("reports.customerBalances") && <CustomerActivityReport />}

        {noAccess && (
          <div className="reports-no-access">
            <p>🔒 You don't have permission to view this report.</p>
          </div>
        )}

        {active === "aging" && (
          <div className="reports-coming-soon">
            <p>Coming soon…</p>
          </div>
        )}
      </div>
    </div>
  );
}