import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { deleteSubscription, deleteUser, listSubscriptions, listUsers } from "../api/spendwise";
import { SkeletonCard, SkeletonTable } from "../components/Skeleton";
import { useToast } from "../components/ToastProvider";
import { subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession } from "../utils/storage";

// /admin - admin dashboard for managing users and subscriptions (= products).
// The admin can see every user, drill into account details, and manage products.
export default function AdminPage() {
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const session = readSession();
  const isAdmin = session?.user?.role === "admin";

  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  // Filters for the subscriptions tab.
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

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

  async function handleDeleteUser(user) {
    if (user.id === session.user.id) {
      toast.error("You cannot delete yourself.");
      return;
    }
    const ok = await confirm({
      title: `Delete ${user.fullName}?`,
      message: `This permanently removes ${user.email} and all their data (subscriptions, expenses, categories).`,
      confirmLabel: "Delete user",
      danger: true
    });
    if (!ok) return;
    try {
      await deleteUser(user.id);
      await refetch();
      toast.success(`Deleted ${user.email}.`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleDeleteSubscription(sub) {
    const ok = await confirm({
      title: `Delete ${sub.name}?`,
      message: "This will be removed from the database immediately.",
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;
    try {
      await deleteSubscription(sub.id);
      await refetch();
      toast.success(`Deleted ${sub.name}.`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  // Convert a subscription's price to its USD-per-month equivalent so the
  // "Estimated monthly revenue" card across mixed cycles is meaningful.
  function monthlyRevenue(sub) {
    const price = Number(sub.price || 0);
    if (sub.billingCycle === "yearly") return price / 12;
    if (sub.billingCycle === "weekly") return price * 4.345;
    return price;
  }

  const stats = useMemo(() => {
    const totalRevenue = subscriptions.reduce((sum, sub) => sum + monthlyRevenue(sub), 0);
    const adminCount = users.filter((u) => u.role === "admin").length;
    return {
      userCount: users.length,
      adminCount,
      subscriptionCount: subscriptions.length,
      monthlyRevenue: totalRevenue
    };
  }, [users, subscriptions]);

  const categoryOptions = useMemo(() => {
    const set = new Set(subscriptions.map((s) => s.category).filter(Boolean));
    return Array.from(set).sort();
  }, [subscriptions]);

  const filteredSubs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      if (!needle) return true;
      return `${sub.name} ${sub.notes}`.toLowerCase().includes(needle);
    });
  }, [subscriptions, search, categoryFilter]);

  if (!isAdmin) return null;

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <h1>Admin Interface</h1>
          <p>CRUD users and subscription products. Hello, {session.user.fullName}.</p>

          {/* Overview stats card row */}
          <div className="sw-stats-grid">
            {loading ? (
              <><SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
            ) : (
              <>
                <div className="sw-stat-card">
                  <span className="sw-stat-card__label">Total Users</span>
                  <span className="sw-stat-card__value">{stats.userCount}</span>
                  <span className="sw-stat-card__hint">{stats.adminCount} admin{stats.adminCount === 1 ? "" : "s"}</span>
                </div>
                <div className="sw-stat-card">
                  <span className="sw-stat-card__label">Subscriptions</span>
                  <span className="sw-stat-card__value">{stats.subscriptionCount}</span>
                  <span className="sw-stat-card__hint">across {categoryOptions.length} categor{categoryOptions.length === 1 ? "y" : "ies"}</span>
                </div>
                <div className="sw-stat-card">
                  <span className="sw-stat-card__label">Est. Monthly Revenue</span>
                  <span className="sw-stat-card__value">{formatCurrency(stats.monthlyRevenue)}</span>
                  <span className="sw-stat-card__hint">normalised across billing cycles</span>
                </div>
                <div className="sw-stat-card">
                  <span className="sw-stat-card__label">Avg per User</span>
                  <span className="sw-stat-card__value">
                    {stats.userCount > 0 ? formatCurrency(stats.monthlyRevenue / stats.userCount) : "—"}
                  </span>
                  <span className="sw-stat-card__hint">monthly recurring spend</span>
                </div>
              </>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, margin: "16px 0", borderBottom: "1px solid var(--sw-border, #ddd)" }}>
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
          {loading && <SkeletonTable rows={5} cols={5} />}

          {!loading && activeTab === "users" && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const suspended = u.isActive === false;
                    const restrictions = [];
                    if (u.canManageSubscriptions === false) restrictions.push("no subs");
                    if (u.canExport === false) restrictions.push("no export");
                    return (
                      <tr key={u.id}>
                        <td>
                          {u.fullName}
                          {suspended && (
                            <span className="sw-badge sw-badge--danger" style={{ marginLeft: 6 }}>Suspended</span>
                          )}
                          {!suspended && restrictions.length > 0 && (
                            <span className="sw-badge sw-badge--warning" style={{ marginLeft: 6 }} title={restrictions.join(", ")}>
                              Restricted
                            </span>
                          )}
                        </td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td>{u.createdAt ? formatShortDate(u.createdAt.slice(0, 10)) : "—"}</td>
                        <td>
                          <Link to={`/admin/users/${u.id}`}>Details</Link>
                          {" • "}
                          <button type="button" className="delete-btn" onClick={() => handleDeleteUser(u)}>Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && activeTab === "subscriptions" && (
            <>
              <div className="sw-filter-bar">
                <input
                  type="search"
                  placeholder="Search by name or notes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  aria-label="Search subscriptions"
                />
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>{categoryLabel(cat)}</option>
                  ))}
                </select>
                <span className="sw-result-count">
                  Showing {filteredSubs.length} of {subscriptions.length}
                </span>
              </div>
              {filteredSubs.length === 0 ? (
                <p>No subscriptions match the current filter.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Category</th><th>Price</th><th>Cycle</th><th>Next billing</th><th>Owner</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((sub) => (
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
                            <button type="button" className="delete-btn" onClick={() => handleDeleteSubscription(sub)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
