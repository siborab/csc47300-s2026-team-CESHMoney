import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getUser } from "../api/spendwise";
import { SkeletonCard, SkeletonTable } from "../components/Skeleton";
import { expenseRowToTransaction, subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel, getEffectiveExpenseAmount } from "../utils/dashboard";
import { formatCurrency, formatShortDate, formatTableAmount } from "../utils/format";
import { readSession } from "../utils/storage";

// /users/:id - public profile page (called "drill down" in the spec).
// Shows the user's id (in the URL and on the page), their profile info, and a
// "history of work" section listing recent expenses and active subscriptions.
export default function UserProfilePage() {
  const { id } = useParams();
  const session = readSession();
  const isAdmin = session?.user?.role === "admin";
  const isOwner = session?.user?.id === id;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const payload = await getUser(id);
        if (cancelled) return;
        setData({
          user: payload.user,
          expenses: (payload.expenses || []).map(expenseRowToTransaction).filter(Boolean),
          subscriptions: (payload.subscriptions || []).map(subscriptionRowToCard)
        });
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <SkeletonCard />
            <div className="cards" style={{ marginTop: 16 }}>
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          </section>
          <section className="feature-section">
            <h2>Subscriptions</h2>
            <SkeletonTable rows={3} cols={4} />
          </section>
          <section className="feature-section">
            <h2>Recent Activity</h2>
            <SkeletonTable rows={3} cols={4} />
          </section>
        </div>
      </main>
    );
  }
  if (errorMessage || !data) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <h1>User profile</h1>
            <p className="auth-message error">{errorMessage || "User not found."}</p>
          </section>
        </div>
      </main>
    );
  }

  const { user, expenses, subscriptions } = data;
  const totalSpent = expenses
    .filter((item) => item.type !== "income" && getEffectiveExpenseAmount(item) < 0)
    .reduce((sum, item) => sum + Math.abs(getEffectiveExpenseAmount(item)), 0);
  const totalMonthlySubs = subscriptions.reduce((sum, sub) => sum + (sub.billingCycle === "monthly" ? sub.price : 0), 0);

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>{user.fullName}</h1>
          <p>
            <strong>Email:</strong> {user.email}{" "}
            <span style={{ background: user.role === "admin" ? "#ffd54f" : "#e0e0e0", padding: "2px 8px", borderRadius: "12px", fontSize: "0.8em", marginLeft: "8px" }}>
              {user.role}
            </span>
          </p>
          <p><strong>Joined:</strong> {user.createdAt ? formatShortDate(user.createdAt.slice(0, 10)) : "—"}</p>

          <div className="cards" style={{ marginTop: "16px" }}>
            <div className="card"><h3>Lifetime Spend</h3><p>{formatCurrency(totalSpent)}</p></div>
            <div className="card"><h3>Active Subscriptions</h3><p>{subscriptions.length}</p></div>
            <div className="card"><h3>Monthly Subs Total</h3><p>{formatCurrency(totalMonthlySubs)}</p></div>
          </div>

          {(isOwner || isAdmin) && (
            <p style={{ marginTop: "16px" }}>
              <Link to="/dashboard" className="btn-add-expense" style={{ textDecoration: "none" }}>Go to Dashboard</Link>
              {" "}
              <Link to="/subscriptions" className="btn-edit-categories" style={{ textDecoration: "none" }}>Manage subscriptions</Link>
            </p>
          )}
        </section>

        <section className="feature-section" style={{ marginTop: "32px" }}>
          <h2>Subscriptions ({subscriptions.length})</h2>
          {subscriptions.length === 0 && <p>No subscriptions yet.</p>}
          {subscriptions.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Price</th><th>Next Billing</th><th></th></tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td><Link to={`/subscriptions/${sub.id}`}>{sub.name}</Link></td>
                      <td>{categoryLabel(sub.category)}</td>
                      <td>{formatCurrency(sub.price)} / {sub.billingCycle}</td>
                      <td>{sub.nextBilling ? formatShortDate(sub.nextBilling) : "—"}</td>
                      <td><Link to={`/subscriptions/${sub.id}`}>Details →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="feature-section" style={{ marginTop: "32px" }}>
          <h2>Recent Activity</h2>
          {expenses.length === 0 ? (
            <p>No expenses recorded yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {expenses.slice(0, 20).map((item) => (
                    <tr key={item.id}>
                      <td>{formatShortDate(item.date)}</td>
                      <td>{item.description}</td>
                      <td>{categoryLabel(item.category)}</td>
                      <td>{formatTableAmount(getEffectiveExpenseAmount(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
