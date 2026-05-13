import React, { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getUser } from "./api/spendwise";
import Footer from "./components/Footer";
import Header from "./components/Header";
import AdminPage from "./pages/AdminPage";
import AdminSubscriptionDetailPage from "./pages/AdminSubscriptionDetailPage";
import AdminUserDetailPage from "./pages/AdminUserDetailPage";
import BudgetTimelinePage from "./pages/BudgetTimelinePage";
import CurrencyConverterPage from "./pages/CurrencyConverterPage";
import DashboardPage from "./pages/DashboardPage";
import ExportCenterPage from "./pages/ExportCenterPage";
import HomePage from "./pages/HomePage";
import SignInPage from "./pages/SignInPage";
import SignUpPage from "./pages/SignUpPage";
import SubscriptionDetailPage from "./pages/SubscriptionDetailPage";
import SubscriptionNotificationsPage from "./pages/SubscriptionNotificationsPage";
import SubscriptionsListPage from "./pages/SubscriptionsListPage";
import UserProfilePage from "./pages/UserProfilePage";
import { clearSession, readSession, writeSession } from "./utils/storage";

export default function App() {
  const [session, setSession] = useState(() => readSession());
  const navigate = useNavigate();
  const location = useLocation();

  // Refresh the cached session against the server on every route change. This
  // means admin permission flips (suspend / disable subscription mgmt / disable
  // export) take effect for the user on their very next page navigation rather
  // than requiring a full sign-out + sign-in. If the server reports the account
  // is suspended or gone, we wipe the local session.
  useEffect(() => {
    const stored = readSession();
    if (!stored?.user?.id) return;
    let cancelled = false;
    getUser(stored.user.id)
      .then((payload) => {
        if (cancelled || !payload?.user) return;
        if (payload.user.isActive === false) {
          clearSession();
          setSession(null);
          navigate("/signin");
          return;
        }
        writeSession(payload.user);
        setSession({ isLoggedIn: true, user: payload.user });
      })
      .catch(() => {
        if (cancelled) return;
        // Network blip -- leave the existing session alone rather than booting
        // the user out on a transient error.
      });
    return () => { cancelled = true; };
  }, [location.pathname]);

  function handleLogout() {
    clearSession();
    setSession(null);
    navigate("/");
  }

  function handleLogin() {
    setSession(readSession());
  }

  return (
    <>
      <Header session={session} onLogout={handleLogout} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/signin" element={<SignInPage onLogin={handleLogin} />} />
        <Route path="/signup" element={<SignUpPage onLogin={handleLogin} />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users/:id" element={<UserProfilePage />} />
        <Route path="/subscriptions" element={<SubscriptionsListPage />} />
        <Route path="/subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/users/:id" element={<AdminUserDetailPage />} />
        <Route path="/admin/subscriptions/:id" element={<AdminSubscriptionDetailPage />} />
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
