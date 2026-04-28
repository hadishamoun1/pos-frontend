import React, { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BlinkingItemsProvider } from "./components/blink/blink-cards";
import { LanguageProvider } from "./components/contexts/LanguageContext";
import { hasPerm } from "./components/auth/authz";
import AdminRoute from "./components/auth/AdminRoute";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import MaintenanceGate from "./components/settings/MaintenanceGate";
import SecurityGate from "./components/alerts/Securitygate";
import { useHeartbeat } from "./components/activity-monitor/useHeartbeat";

// Lazy-loaded pages — only downloaded when the user navigates to them
const LoginPage               = lazy(() => import("./components/login/login"));
const SignupPage               = lazy(() => import("./components/signup/signup"));
const DashboardPage            = lazy(() => import("./components/dashboard/dashboard"));
const POSSystemPage            = lazy(() => import("./components/pos-system/pos"));
const AccountingPage           = lazy(() => import("./components/recievables/recievables"));
const PurchasesInvoicePage     = lazy(() => import("./components/purchases-invoice/purchases-invoice"));
const InventoryPage            = lazy(() => import("./components/inventory/inventory"));
const SuppliersPage            = lazy(() => import("./components/suppliers/suppliers"));
const ItemCreationPage         = lazy(() => import("./components/items/items"));
const PricingPage              = lazy(() => import("./components/cost-estimator/pricingPage"));
const CreatePreviewCustomers   = lazy(() => import("./components/customers/customers"));
const AccountsPage             = lazy(() => import("./components/accounts/accounts"));
const PaymentVoucherTable      = lazy(() => import("./components/payments/payments"));
const JournalVoucherPage       = lazy(() => import("./components/vouchers/vouchers"));
const InventoryActivityPage    = lazy(() => import("./components/inventory-activity/inventory-activity"));
const ReportsPage              = lazy(() => import("./components/pos-system/Reports"));
const SqmPiecesPage            = lazy(() => import("./components/sqmPiece/sqmPiece"));
const SettingsPage             = lazy(() => import("./components/settings/settings"));
const CutsQueuePage            = lazy(() => import("./components/cuts-control/CutsQueuePage"));
const InvoiceDetailsPage       = lazy(() => import("./components/Viewing/InvoiceDetailsPage"));
const UsersPage                = lazy(() => import("./components/users/users"));
const FaceEnrollPage           = lazy(() => import("./components/face-enroll/FaceEnrollPage"));
const RecordingPage            = lazy(() => import("./components/recording/RecordingPage"));
const MaintenanceModePage      = lazy(() => import("./components/settings/MaintenanceModePage"));
const CashCollectionsPage      = lazy(() => import("./components/cash-collection/CashCollectionsPage"));
const EmployeeDocManager       = lazy(() => import("./components/Employees/EmployeeDocManager"));
const ActivityMonitor          = lazy(() => import("./components/activity-monitor/ActivityMonitor"));

const queryClient = new QueryClient();

function HeartbeatEmitter() {
  useHeartbeat();
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BlinkingItemsProvider>
          <Router>
            <MaintenanceGate />
            <SecurityGate />
            <HeartbeatEmitter />

            <Suspense fallback={null}>
              <Routes>
                {/* Public */}
                <Route path="/" element={<LoginPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/maintenance" element={<MaintenanceModePage />} />

                {/* Protected */}
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
                  <Route path="/employee-files" element={<EmployeeDocManager />} />
                  <Route path="/activity-monitor" element={<ActivityMonitor />} />
                  <Route path="/face-enroll" element={<FaceEnrollPage />} />

                  {/* Recording — permission-gated */}
                  <Route
                    path="/recording"
                    element={
                      hasPerm("recording.view")
                        ? <RecordingPage />
                        : <Navigate to="/dashboard" replace />
                    }
                  />

                  {/* Admin-only */}
                  <Route element={<AdminRoute />}>
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </BlinkingItemsProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
