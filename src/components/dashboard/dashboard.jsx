import React, { useMemo } from "react";
import "./dashboard.css";
import { Link } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation"; // adjust path if needed

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

const sections = [
  { key: "posSystem", path: "/pos-system", image: "/assets/pos.jpeg", perm: "pos.view" },
  { key: "recievables", path: "/recivables", image: "/assets/accounting.jpg", perm: "recievables.view" },
  { key: "inventory", path: "/inventory", image: "/assets/inventory.png", perm: "inventory.view" },
  { key: "customers", path: "/customers", image: "/assets/customers.jpeg", perm: "customers.view" },
  { key: "purchasesInvoice", path: "/purchases-invoice", image: "/assets/purchase.jpg", perm: "purchases.view" },
  { key: "settings", path: "/settings", image: "/assets/settings.png", perm: "settings.view" },
  { key: "suppliers", path: "/suppliers", image: "/assets/suppliers.webp", perm: "suppliers.view" },
  { key: "items", path: "/items", image: "/assets/items.webp", perm: "items.view" },
  { key: "costEstimator", path: "/cost-estimator", image: "/assets/price.webp", perm: "cost.view" },
  { key: "accounts", path: "/accounts", image: "/assets/price.webp", perm: "accounts.view" },
  { key: "payments", path: "/payments", image: "/assets/payment-voucher.webp", perm: "payments.view" },
  { key: "transactions", path: "/transactions", image: "/assets/payment-voucher.webp", perm: "transactions.view" },
  { key: "inventoryActivity", path: "/inventory-activity", image: "/assets/payment-voucher.webp", perm: "inventoryActivity.view" },
  { key: "reports", path: "/reports", image: "/assets/payment-voucher.webp", perm: "reports.view" },
  { key: "sqm", path: "/sqm", image: "/assets/payment-voucher.webp", perm: "sqm.view" },
  { key: "cutsControl", path: "/cuts-control", image: "/assets/payment-voucher.webp", perm: "cuts.view" },
  { key: "viewing", path: "/viewing", image: "/assets/payment-voucher.webp", perm: "viewing.view" },
  { key: "cashCollections", path: "/cash-collections", image: "/assets/settings.png", perm: "cashFlow.view" },
  { key: "employeeFiles", path: "/employee-files", image: "/assets/settings.png", perm: "employeeFiles.view" },
  { key: "users", path: "/users", image: "/assets/settings.png", perm: "users.manage" },
];

const DashboardPage = () => {
  const { t } = useTranslation();

  const translatedSections = useMemo(
    () =>
      sections.map((s) => ({
        ...s,
        label: t(`dashboard.sections.${s.key}`),
      })),
    [t]
  );

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <h1 className="dashboard-title">{t("dashboard.title")}</h1>
        <p className="dashboard-subtitle">{t("dashboard.subtitle")}</p>
      </header>

      <div className="dashboard-grid">
        {translatedSections
          .filter((s) => hasPerm(s.perm))
          .map((section, index) => (
            <Link to={section.path} key={index} className="dashboard-card-link">
              <div className="dashboard-card">
                <div className="dashboard-card-image-wrapper">
                  <img
                    src={section.image}
                    alt={section.label}
                    className="dashboard-card-image"
                  />
                </div>
                <div className="dashboard-card-content">
                  <h2 className="dashboard-card-title">{section.label}</h2>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
};

export default DashboardPage;
