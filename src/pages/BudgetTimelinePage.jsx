import React, { useEffect, useState } from "react";
import { BUDGET_CATEGORY_ORDER } from "../utils/constants";
import { categoryLabel, getEffectiveExpenseAmount, isInCurrentMonth } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { loadDashboardDbFromStorageOrSeed } from "../utils/storage";

export default function BudgetTimelinePage() {
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
            <h1>Budget Timeline</h1>
            <p>Loading timeline...</p>
          </section>
        </div>
      </main>
    );
  }

  const monthlyTransactions = db.transactions.filter((item) => isInCurrentMonth(item.date));
  const categoryRows = BUDGET_CATEGORY_ORDER.map((category) => {
    const budget = Number(db.categoryBudgets[category] || 0);
    const spent = monthlyTransactions
      .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
      .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
    const remaining = Math.max(0, budget - spent);
    const progress = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    return { category, budget, spent, remaining, progress };
  });

  const dailySummaryMap = monthlyTransactions.reduce((acc, item) => {
    if (getEffectiveExpenseAmount(item) >= 0) {
      return acc;
    }
    const key = item.date;
    const existing = acc[key] || 0;
    acc[key] = existing + Math.abs(getEffectiveExpenseAmount(item));
    return acc;
  }, {});

  const timelineRows = Object.entries(dailySummaryMap)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, amount]) => ({ date, amount }));

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Budget Timeline</h1>
          <p>This month by category and spending day-by-day.</p>
          <div className="section">
            <h2>Category Progress</h2>
            {categoryRows.map((row) => (
              <div key={row.category} className="budget-item">
                <p>
                  {categoryLabel(row.category)}: <strong>{formatCurrency(row.spent)}</strong>
                  {" "}of {formatCurrency(row.budget)} • Remaining <strong>{formatCurrency(row.remaining)}</strong>
                </p>
                <div className="bar" style={{ "--progress": `${row.progress}%` }}>
                  <div className="bar-fill"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="section">
            <h2>Daily Spending Timeline</h2>
            {timelineRows.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Total Spent</th></tr></thead>
                  <tbody>
                    {timelineRows.map((row) => (
                      <tr key={row.date}>
                        <td>{formatShortDate(row.date)}</td>
                        <td>{formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No spending records for this month yet.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
