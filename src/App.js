import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import LoginPage from "./components/login/login";
import SignupPage from "./components/signup/signup";
import DashboardPage from "./components/dashboard/dashboard";
import POSSystemPage from "./components/pos-system/pos";
import AccountingPage from "./components/accounting/accounting";
import PurchasesInvoicePage from "./components/purchases-invoice/purchases-invoice";
import InventoryPage from "./components/inventory/inventory";
import SuppliersPage from "./components/suppliers/suppliers";

// Initialize QueryClient
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/pos-system" element={<POSSystemPage />} />
          <Route path="/accounting" element={<AccountingPage />} />
          <Route path="/purchases-invoice" element={<PurchasesInvoicePage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
