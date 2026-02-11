// src/pages/Reports/ReportsPage.jsx
import React, { useState } from "react";
import "./Reports.css";
import TrialBalance from "./TrialBalance";
import AccountStatement from "./AccountStatement";
import CostAnalysis from "./CostAnalysis";
import CustomerBalances from "./CustomerBalances";

// ✅ Import Profitability (adjust path if yours is different)
import ProfitabilityReport from "./Profitability-report";

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
    perm: "reports.trialBalance"
  },
  { 
    key: "account-statement", 
    label: "Account Statement / كشف حساب",
    perm: "reports.accountStatement"
  },
  { 
    key: "cost-analysis", 
    label: "Cost Analysis / تحليل الكلفة",
    perm: "reports.costAnalysis"
  },
  { 
    key: "customer-balances", 
    label: "Customer Balances / أرصدة الزبائن",
    perm: "reports.customerBalances"
  },
  // ✅ NEW TAB with permission
  { 
    key: "profitability", 
    label: "Profitability / الربحية",
    perm: "reports.profitability" // ✅ Only users with this permission can see it
  },
  { 
    key: "aging", 
    label: "A/R Aging (soon)", 
    disabled: true 
  },
];

export default function ReportsPage() {
  // ✅ Filter tabs based on permissions
  const visibleTabs = TABS.filter(t => !t.perm || hasPerm(t.perm));
  
  // ✅ Set first visible tab as default
  const [active, setActive] = useState(visibleTabs[0]?.key || "trial-balance");

  return (
    <div className="reports-page">
      <div className="reports-tabs">
        {visibleTabs.map((t) => (
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
        {active === "trial-balance" && hasPerm("reports.trialBalance") && <TrialBalance />}
        {active === "account-statement" && hasPerm("reports.accountStatement") && <AccountStatement />}
        {active === "cost-analysis" && hasPerm("reports.costAnalysis") && <CostAnalysis />}
        {active === "customer-balances" && hasPerm("reports.customerBalances") && <CustomerBalances />}

        {/* ✅ NEW: Only render if user has permission */}
        {active === "profitability" && hasPerm("reports.profitability") && <ProfitabilityReport />}

        {/* No access message */}
        {((active === "trial-balance" && !hasPerm("reports.trialBalance")) ||
          (active === "account-statement" && !hasPerm("reports.accountStatement")) ||
          (active === "cost-analysis" && !hasPerm("reports.costAnalysis")) ||
          (active === "customer-balances" && !hasPerm("reports.customerBalances")) ||
          (active === "profitability" && !hasPerm("reports.profitability"))) && (
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