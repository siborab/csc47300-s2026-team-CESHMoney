import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteSubscription, deleteUser, listSubscriptions, listUsers } from "../api/spendwise";
import { subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession } from "../utils/storage";

// /admin - admin dashboard for managing users and subscriptions (= products).
// The admin can see every user, drill into account details, and manage products.
export default function AdminPage() {
  const navigate = useNavigate();
  const session = readSession();
  const isAdmin = session?.user?.role === "admin";

  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!session?.user) {
      navigate("/signin");
      return;
    }
    if (!isAdmin) {
      navigate(`/users/${session.user.id}`);
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refetch() {
    setLoading(true);
    setErrorMessage("");
    try {
      const [userRows, subRows] = await Promise.all([listUsers(), listSubscriptions()]);
      setUsers(userRows);
      setSubscriptions(subRows.map(subscriptionRowToCard));
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteUser(id) {
    if (id === session.user.id) {
      alert("You cannot delete yourself.");
      return;
    }
    if (!window.confirm("Delete this user and all their data?")) return;
    try {
      await deleteUser(id);
      await refetch();
    } catch (error) {
      alert(error.message);
    }
  }

  async function handleDeleteSubscription(id) {
    if (!window.confirm("Delete this subscription?")) return;
    try {
      await deleteSubscription(id);
      await refetch();
    } catch (error) {
      alert(error.message);
    }
  }

  if (!isAdmin) return null;

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Admin Interface</h1>
          <p>CRUD users and subscription products. Hello, {session.user.fullName}.</p>

          <div style={{ display: "flex", gap: 8, margin: "16px 0", borderBottom: "1px solid #ddd" }}>
            <button
              type="button"
              className={activeTab === "users" ? "btn-add-expense" : "btn-edit-categories"}
              onClick={() => setActiveTab("users")}
            >
              Users ({users.length})
            </button>
            <button
              type="button"
              className={activeTab === "subscriptions" ? "btn-add-expense" : "btn-edit-categories"}
              onClick={() => setActiveTab("subscriptions")}
            >
              Subscriptions ({subscriptions.length})
            </button>
          </div>

          {errorMessage && <p className="auth-message error">{errorMessage}</p>}
          {loading && <p>Loading...</p>}

          {!loading && activeTab === "users" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td>{u.createdAt ? formatShortDate(u.createdAt.slice(0, 10)) : "—"}</td>
                      <td>
                        <Link to={`/admin/users/${u.id}`}>Details</Link>
                        {" • "}
                        <button type="button" className="delete-btn" onClick={() => handleDeleteUser(u.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && activeTab === "subscriptions" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Price</th><th>Cycle</th><th>Next billing</th><th>Owner</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td><Link to={`/admin/subscriptions/${sub.id}`}>{sub.name}</Link></td>
                      <td>{categoryLabel(sub.category)}</td>
                      <td>{formatCurrency(sub.price)}</td>
                      <td>{sub.billingCycle}</td>
                      <td>{sub.nextBilling ? formatShortDate(sub.nextBilling) : "—"}</td>
                      <td>{sub.userId ? <Link to={`/admin/users/${sub.userId}`}>view owner</Link> : "—"}</td>
                      <td>
                        <Link to={`/admin/subscriptions/${sub.id}`}>Details</Link>
                        {" • "}
                        <button type="button" className="delete-btn" onClick={() => handleDeleteSubscription(sub.id)}>Delete</button>
                      </td>
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
