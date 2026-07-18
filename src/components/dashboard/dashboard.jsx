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
  { key: "posSystem",         path: "/pos-system",        image: "/assets/pos.png",             perm: "pos.view" },
  { key: "recievables",       path: "/recivables",         image: "/assets/accounting.png",       perm: "recievables.view" },
  { key: "inventory",         path: "/inventory",          image: "/assets/inventory.png?v=2",    perm: "inventory.view" },
  { key: "customers",         path: "/customers",          image: "/assets/customers.png",       perm: "customers.view" },
  { key: "purchasesInvoice",  path: "/purchases-invoice", image: "/assets/purchase.png",         perm: "purchases.view" },
  { key: "settings",          path: "/settings",           image: "/assets/settings.png?v=2",     perm: "settings.view" },
  { key: "suppliers",         path: "/suppliers",          image: "/assets/suppliers.png",       perm: "suppliers.view" },
  { key: "items",             path: "/items",              image: "/assets/items.png",           perm: "items.view" },
  { key: "costEstimator",     path: "/cost-estimator",     image: "/assets/price.webp",           perm: "cost.view" },
  { key: "accounts",          path: "/accounts",           image: "/assets/accounts.png",           perm: "accounts.view" },
  { key: "payments",          path: "/payments",           image: "/assets/payments.png",  perm: "payments.view" },
  { key: "transactions",      path: "/transactions",       image: "/assets/transactions.png",       perm: "transactions.view" },
  { key: "inventoryActivity", path: "/inventory-activity", image: "/assets/inventoryActivity.png", perm: "inventoryActivity.view" },
  { key: "reports",           path: "/reports",            image: "/assets/reports.png",            perm: "reports.view" },
  { key: "sqm",               path: "/sqm",                image: "/assets/sqm.png",                perm: "sqm.view" },
  { key: "cutsControl",       path: "/cuts-control",       image: "/assets/cutsControl.png",       perm: "cuts.view" },
  { key: "viewing",           path: "/viewing",            image: "/assets/viewing.png",            perm: "viewing.view" },
  { key: "cashCollections",   path: "/cash-collections",   image: "/assets/cashCollection.png",   perm: "cashFlow.view" },
  { key: "employeeFiles",     path: "/employee-files",     image: "/assets/employeesFiles.png",     perm: "employeeFiles.view" },
  { key: "activityMonitor",   path: "/activity-monitor",   image: "/assets/activityMonitor.png",   perm: "activity.view" },
  { key: "users",             path: "/users",              image: "/assets/users.png",       perm: "users.manage" },
  { key: "faceEnroll",        path: "/face-enroll",        image: "/assets/faceLogin.png",        perm: "faceEnroll.view" },
  { key: "recording",         path: "/recording",          image: "/assets/recording.png",          perm: "recording.view" },
  { key: "rvrRandomizer",        path: "/rvr-randomizer",          image: "/assets/rvr.png",          perm: "rvrRandomizer.view" },
  { key: "invoiceTypeConverter", path: "/invoice-type-converter",  image: "/assets/rvr.png",          perm: "invoiceTypeConverter.view" },
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
    <div className="dashboard-wrapper" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/assets/background.png)` }}>
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
                    onLoad={(e) => e.target.classList.add('dashboard-card-image-loaded')}
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
