import React from "react";
import "./dashboard.css";
import { Link } from "react-router-dom";

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
  { name: "POS System", image: "/assets/pos.jpeg", perm: "pos.view" },
  { name: "Recivables", image: "/assets/accounting.jpg", perm: "recievables.view" },
  { name: "Inventory", image: "/assets/inventory.png", perm: "inventory.view" },
  { name: "Customers", image: "/assets/customers.jpeg", perm: "customers.view" },
  { name: "Purchases Invoice", image: "/assets/purchase.jpg", perm: "purchases.view" },
  { name: "Settings", image: "/assets/settings.png", perm: "settings.view" },
  { name: "Suppliers", image: "/assets/suppliers.webp", perm: "suppliers.view" },
  { name: "Items", image: "/assets/items.webp", perm: "items.view" },
  { name: "Cost Estimator", image: "/assets/price.webp", perm: "cost.view" },
  { name: "Accounts", image: "/assets/price.webp", perm: "accounts.view" },
  { name: "Payments", image: "/assets/payment-voucher.webp", perm: "payments.view" },
  { name: "Transactions", image: "/assets/payment-voucher.webp", perm: "transactions.view" },
  { name: "Inventory Activity", image: "/assets/payment-voucher.webp", perm: "inventoryActivity.view" },
  { name: "Reports", image: "/assets/payment-voucher.webp", perm: "reports.view" },
  { name: "SQM", image: "/assets/payment-voucher.webp", perm: "sqm.view" },
  { name: "Cuts Control", image: "/assets/payment-voucher.webp", perm: "cuts.view" },
  { name: "Viewing", image: "/assets/payment-voucher.webp", perm: "viewing.view" },

  // Admin-only
  { name: "Users", image: "/assets/settings.png", perm: "users.manage" },
];

const DashboardPage = () => {
  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-header">
        <h1 className="dashboard-title">Business Hub</h1>
        <p className="dashboard-subtitle">
          Navigate through modules to manage your operations effectively
        </p>
      </header>

      <div className="dashboard-grid">
        {sections
          .filter((s) => hasPerm(s.perm))
          .map((section, index) => (
            <Link
              to={`/${section.name.toLowerCase().replace(/ /g, "-")}`}
              key={index}
              className="dashboard-card-link"
            >
              <div className="dashboard-card">
                <div className="dashboard-card-image-wrapper">
                  <img
                    src={section.image}
                    alt={section.name}
                    className="dashboard-card-image"
                  />
                </div>
                <div className="dashboard-card-content">
                  <h2 className="dashboard-card-title">{section.name}</h2>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
};

export default DashboardPage;
