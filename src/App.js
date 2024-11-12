import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/login/login";
import SignupPage from "./components/signup/signup";
import DashboardPage from "./components/dashboard/dashboard";
import POSSystemPage from "./components/pos-system/pos";
import AccountingPage from "./components/accounting/accounting";
import PurchasesInvoicePage from "./components/purchases-invoice/purchases-invoice";
import InventoryPage from "./components/inventory/inventory";
import SuppliersPage from "./components/suppliers/suppliers";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/Signup" element={<SignupPage />} />
        <Route path="/Dashboard" element={<DashboardPage />} />
        <Route path="/pos-system" element={<POSSystemPage />} />
        <Route path="/accounting" element={<AccountingPage />} />
        <Route path="/purchases-invoice" element={<PurchasesInvoicePage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/suppliers" element={<SuppliersPage />} />
      </Routes>
    </Router>
  );
}

export default App;
