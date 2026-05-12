import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listCategories, listExpenses } from "../api/spendwise";
import { SkeletonTable } from "../components/Skeleton";
import { categoryRowToBudgetEntry, expenseRowToTransaction } from "../utils/dataAdapter";
import { categoryLabel, getEffectiveExpenseAmount, isInCurrentMonth } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession } from "../utils/storage";

export default function BudgetTimelinePage() {
  const navigate = useNavigate();
  const session = readSession();
  const userId = session?.user?.id;
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
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
        const [rawExpenses, rawCategories] = await Promise.all([
          listExpenses(userId),
          listCategories(userId)
        ]);
        if (cancelled) return;
        setExpenses(rawExpenses.map(expenseRowToTransaction).filter(Boolean));
        setCategories(rawCategories.map(categoryRowToBudgetEntry));
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
            <h1>Budget Timeline</h1>
            <p>Building your timeline...</p>
            <SkeletonTable rows={5} cols={2} />
          </section>
        </div>
      </main>
    );
  }

  const monthlyTransactions = expenses.filter((item) => isInCurrentMonth(item.date));
  const categoryRows = categories.map(({ category, budget }) => {
    const spent = monthlyTransactions
      .filter((item) => getEffectiveExpenseAmount(item) < 0 && item.category === category)
      .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
    const remaining = Math.max(0, budget - spent);
    const progress = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    return { category, budget, spent, remaining, progress };
  });

  const dailySummaryMap = monthlyTransactions.reduce((acc, item) => {
    if (getEffectiveExpenseAmount(item) >= 0) return acc;
    const key = item.date;
    acc[key] = (acc[key] || 0) + Math.abs(getEffectiveExpenseAmount(item));
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
          {errorMessage && <p className="auth-message error">{errorMessage}</p>}
          <div className="section">
            <h2>Category Progress</h2>
            {categoryRows.length === 0 && <p>No categories yet.</p>}
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
