import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/login/login";
import SignupPage from "./components/signup/signup";
import DashboardPage from "./components/dashboard/dashboard";
import POSSystemPage from "./components/pos-system/pos";
import AccountingPage from "./components/accounting/accounting";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/Signup" element={<SignupPage />} />
        <Route path="/Dashboard" element={<DashboardPage />} />
        <Route path="/pos-system" element={<POSSystemPage />} />
        <Route path="/accounting" element={<AccountingPage />} />

      </Routes>
    </Router>
  );
}

export default App;
