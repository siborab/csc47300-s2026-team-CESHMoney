import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCategories, listExpenses, listSubscriptions } from "../api/spendwise";
import {
  categoryRowToBudgetEntry,
  expenseRowToTransaction,
  subscriptionRowToCard
} from "../utils/dataAdapter";
import { categoryLabel, getEffectiveExpenseAmount, isInCurrentMonth } from "../utils/dashboard";
import { formatCurrency } from "../utils/format";
import { readSession } from "../utils/storage";

function daysUntil(dateString) {
  if (!dateString) return null;
  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export default function SubscriptionNotificationsPage() {
  const navigate = useNavigate();
  const session = readSession();
  const userId = session?.user?.id;
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/signin");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const [rawExpenses, rawCategories, rawSubs] = await Promise.all([
          listExpenses(userId),
          listCategories(userId),
          listSubscriptions(userId)
        ]);
        if (cancelled) return;
        setExpenses(rawExpenses.map(expenseRowToTransaction).filter(Boolean));
        setCategories(rawCategories.map(categoryRowToBudgetEntry));
        setSubscriptions(rawSubs.map(subscriptionRowToCard));
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, navigate]);

  if (!userId) return null;

  if (loading) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <h1>Subscription Alerts</h1>
            <p>Loading notifications...</p>
          </section>
        </div>
      </main>
    );
  }

  const monthlyTransactions = expenses.filter((item) => isInCurrentMonth(item.date));
  const budgetAlerts = categories
    .map(({ category, budget }) => {
      const spent = monthlyTransactions
        .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
        .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
      const ratio = budget > 0 ? spent / budget : 0;
      if (ratio >= 1) {
        return { category, level: "error", text: `${categoryLabel(category)} exceeded budget by ${formatCurrency(spent - budget)}.` };
      }
      if (ratio >= 0.8) {
        return { category, level: "warning", text: `${categoryLabel(category)} reached ${Math.round(ratio * 100)}% of budget.` };
      }
      return null;
    })
    .filter(Boolean);

  const upcomingSubs = subscriptions
    .map((sub) => ({ ...sub, daysUntil: daysUntil(sub.nextBilling) }))
    .filter((sub) => sub.daysUntil !== null && sub.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Subscription Alerts</h1>
          <p>Upcoming subscription charges and automatic budget warnings.</p>
          {errorMessage && <p className="auth-message error">{errorMessage}</p>}

          <div className="section">
            <h2>Upcoming Subscriptions</h2>
            {upcomingSubs.length === 0 && (
              <p>
                No subscriptions due in the next 14 days.
                {" "}<Link to="/subscriptions">Manage subscriptions</Link>.
              </p>
            )}
            {upcomingSubs.map((sub) => (
              <p key={sub.id} className={`auth-message ${sub.daysUntil <= 3 ? "error" : "success"}`}>
                <Link to={`/subscriptions/${sub.id}`} style={{ color: "inherit" }}>{sub.name}</Link>
                {" "}charges {formatCurrency(sub.price)} in {sub.daysUntil} day{sub.daysUntil === 1 ? "" : "s"} ({sub.nextBilling}).
              </p>
            ))}
          </div>

          <div className="section">
            <h2>Budget Notifications</h2>
            {budgetAlerts.length > 0 ? (
              budgetAlerts.map((alert) => (
                <p key={alert.category} className={`auth-message ${alert.level === "error" ? "error" : "success"}`}>
                  {alert.text}
                </p>
              ))
            ) : (
              <p>All categories are under 80% of budget. Keep it up.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
