import React, { useEffect, useState } from "react";
import { BUDGET_CATEGORY_ORDER } from "../utils/constants";
import { categoryLabel, getEffectiveExpenseAmount, isInCurrentMonth } from "../utils/dashboard";
import { formatCurrency } from "../utils/format";
import { loadDashboardDbFromStorageOrSeed } from "../utils/storage";

export default function SubscriptionNotificationsPage() {
  const [db, setDb] = useState(null);

  useEffect(() => {
    async function loadDb() {
      const normalizedDb = await loadDashboardDbFromStorageOrSeed();
      setDb(normalizedDb);
    }
    loadDb();
  }, []);

  if (!db) {
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

  const monthlyTransactions = db.transactions.filter((item) => isInCurrentMonth(item.date));
  const alerts = BUDGET_CATEGORY_ORDER.map((category) => {
    const budget = Number(db.categoryBudgets[category] || 0);
    const spent = monthlyTransactions
      .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
      .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
    const ratio = budget > 0 ? spent / budget : 0;

    if (ratio >= 1) {
      return {
        category,
        level: "error",
        text: `${categoryLabel(category)} exceeded budget by ${formatCurrency(spent - budget)}.`
      };
    }
    if (ratio >= 0.8) {
      return {
        category,
        level: "warning",
        text: `${categoryLabel(category)} reached ${Math.round(ratio * 100)}% of budget.`
      };
    }
    return null;
  }).filter(Boolean);

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Subscription Alerts</h1>
          <p>Automatic budget notifications for the current month.</p>
          {alerts.length > 0 ? (
            <div className="section">
              {alerts.map((alert) => (
                <p key={alert.category} className={`auth-message ${alert.level === "error" ? "error" : "success"}`}>
                  {alert.text}
                </p>
              ))}
            </div>
          ) : (
            <p>All categories are under 80% of budget. Keep it up.</p>
          )}
        </section>
      </div>
    </main>
  );
}
