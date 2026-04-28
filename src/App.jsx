import React, { useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import Footer from "./components/Footer";
import Header from "./components/Header";
import BudgetTimelinePage from "./pages/BudgetTimelinePage";
import CurrencyConverterPage from "./pages/CurrencyConverterPage";
import DashboardPage from "./pages/DashboardPage";
import ExportCenterPage from "./pages/ExportCenterPage";
import HomePage from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import SubscriptionNotificationsPage from "./pages/SubscriptionNotificationsPage";
import { clearSession, readSession } from "./utils/storage";

export default function App() {
  const [session, setSession] = useState(() => readSession());
  const navigate = useNavigate();

  function handleLogout() {
    clearSession();
    setSession(null);
    navigate("/");
  }

  return (
    <>
      <Header session={session} onLogout={handleLogout} />
      {/* React Router replaces the old multi-page HTML files with route-based pages. */}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignInPage onLogin={() => setSession(readSession())} />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/currency-conversion" element={<CurrencyConverterPage />} />
        <Route path="/budget-timeline" element={<BudgetTimelinePage />} />
        <Route path="/export-center" element={<ExportCenterPage />} />
        <Route path="/subscription-notifications" element={<SubscriptionNotificationsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}
