import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import LoginPage from "./components/login/login";
import SignupPage from "./components/signup/signup";
import DashboardPage from "./components/dashboard/dashboard";
import POSSystemPage from "./components/pos-system/pos";
import AccountingPage from "./components/recievables/recievables";
import PurchasesInvoicePage from "./components/purchases-invoice/purchases-invoice";
import InventoryPage from "./components/inventory/inventory";
import SuppliersPage from "./components/suppliers/suppliers";
import ItemCreationPage from "./components/items/items";
import PricingPage from "./components/cost-estimator/pricingPage";
import CreatePreviewCustomers from "./components/customers/customers";
import AccountsPage from "./components/accounts/accounts";
import PaymentVoucherTable from "./components/payments/payments";
import JournalVoucherPage from "./components/vouchers/vouchers";
import InventoryActivityPage from "./components/inventory-activity/inventory-activity";
import ReportsPage from "./components/pos-system/Reports";
import SqmPiecesPage from "./components/sqmPiece/sqmPiece";
import { BlinkingItemsProvider } from "./components/blink/blink-cards";
import SettingsPage from "./components/settings/settings";
import CutsQueuePage from "./components/cuts-control/CutsQueuePage";
import InvoiceDetailsPage from "./components/Viewing/InvoiceDetailsPage";
import UsersPage from "./components/users/users";

import AdminRoute from "./components/auth/AdminRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";

import MaintenanceModePage from "./components/settings/MaintenanceModePage";
import MaintenanceGate from "./components/settings/MaintenanceGate"; // ✅ FIX
import CashCollectionsPage from "./components/cash-collection/CashCollectionsPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BlinkingItemsProvider>
        <Router>
          {/* ✅ Global gate */}
          <MaintenanceGate />

          <Routes>
            {/* ✅ Public */}
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} /> {/* ✅ alias */}
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/maintenance" element={<MaintenanceModePage />} />

            {/* ✅ Protected */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/pos-system" element={<POSSystemPage />} />
              <Route path="/recivables" element={<AccountingPage />} />
              <Route path="/purchases-invoice" element={<PurchasesInvoicePage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
              <Route path="/items" element={<ItemCreationPage />} />
              <Route path="/cost-estimator" element={<PricingPage />} />
              <Route path="/customers" element={<CreatePreviewCustomers />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/payments" element={<PaymentVoucherTable />} />
              <Route path="/transactions" element={<JournalVoucherPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/sqm" element={<SqmPiecesPage />} />
              <Route path="/inventory-activity" element={<InventoryActivityPage />} />
              <Route path="/cuts-control" element={<CutsQueuePage />} />
              <Route path="/viewing" element={<InvoiceDetailsPage />} />
              <Route path="/journal-voucher/:id?" element={<JournalVoucherPage />} />
                <Route path="/cash-collections" element={<CashCollectionsPage />} />
                



              {/* ✅ Admin-only */}
              <Route element={<AdminRoute />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
          </Routes>
        </Router>
      </BlinkingItemsProvider>
    </QueryClientProvider>
  );
}

export default App;
