import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSubscription, deleteSubscription, getUser, listSubscriptions } from "../api/spendwise";
import Spinner from "../components/Spinner";
import { SkeletonTable } from "../components/Skeleton";
import { useToast } from "../components/ToastProvider";
import { subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession, writeSession } from "../utils/storage";

const EMPTY_FORM = {
  name: "",
  category: "entertainment",
  price: "",
  billingCycle: "monthly",
  nextBilling: "",
  notes: ""
};

// /subscriptions - list page where users can browse and create new products.
export default function SubscriptionsListPage() {
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const session = readSession();
  const userId = session?.user?.id;

  // We re-fetch the *current* user from the API on every page load, otherwise
  // an admin's permission flip wouldn't take effect until the affected user
  // signs out and back in. `me` is the fresh server copy; permission flags
  // come from here, NOT from the cached localStorage session.
  const [me, setMe] = useState(null);
  const canManage = me
    ? me.role === "admin" || me.canManageSubscriptions !== false
    : false;

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formMessageType, setFormMessageType] = useState("");

  // Filter state for the search box and category dropdown.
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (!userId) {
      navigate("/signin");
      return;
    }
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function refetch() {
    setLoading(true);
    try {
      const [rows, fresh] = await Promise.all([
        listSubscriptions(userId),
        getUser(userId).then((p) => p.user)
      ]);
      setSubscriptions(rows.map(subscriptionRowToCard));
      setMe(fresh);
      writeSession(fresh);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setFormMessage("");
    setFormMessageType("");
    try {
      const created = await createSubscription({
        userId,
        name: form.name,
        category: form.category,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        nextBilling: form.nextBilling || null,
        notes: form.notes
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      setFormMessage("");
      await refetch();
      toast.success(`Subscription "${created.name}" created.`);
    } catch (error) {
      setFormMessage(error.message);
      setFormMessageType("error");
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(sub) {
    const ok = await confirm({
      title: `Cancel ${sub.name}?`,
      message: "The subscription record will be deleted permanently.",
      confirmLabel: "Cancel subscription",
      danger: true
    });
    if (!ok) return;
    try {
      await deleteSubscription(sub.id);
      await refetch();
      toast.success(`${sub.name} cancelled.`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  // Distinct categories from the loaded subscriptions, used by the filter dropdown.
  const categoryOptions = useMemo(() => {
    const set = new Set(subscriptions.map((s) => s.category).filter(Boolean));
    return Array.from(set).sort();
  }, [subscriptions]);

  // Apply search + category filter to drive the rendered table.
  const filteredSubs = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      if (categoryFilter !== "all" && sub.category !== categoryFilter) return false;
      if (!needle) return true;
      const hay = `${sub.name} ${sub.notes} ${sub.category} ${sub.billingCycle}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [subscriptions, search, categoryFilter]);

  if (!userId) return null;

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <h1>My Subscriptions</h1>
            {canManage && (
              <button type="button" className="btn-add-expense" onClick={() => setShowForm((v) => !v)}>
                {showForm ? "Close form" : "+ New subscription"}
              </button>
            )}
          </div>
          <p>Recurring services you pay for. Click any row to drill into the product details.</p>

          {!canManage && (
            <p className="sw-notice sw-notice--warning">
              An admin has disabled subscription management on your account. You can still view existing subscriptions, but cannot create, edit, or cancel them.
            </p>
          )}

          {errorMessage && <p className="auth-message error">{errorMessage}</p>}

          {showForm && (
            <form onSubmit={handleCreate} style={{ display: "grid", gap: "10px", margin: "16px 0", padding: "16px", border: "1px solid #ddd", borderRadius: "8px" }}>
              <div className="form-group">
                <label>Name</label>
                <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Netflix" />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="entertainment">Entertainment</option>
                  <option value="utilities">Utilities</option>
                  <option value="food">Food</option>
                  <option value="transport">Transport</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Price</label>
                <input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Billing cycle</label>
                <select value={form.billingCycle} onChange={(e) => setForm({ ...form, billingCycle: e.target.value })}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
              <div className="form-group">
                <label>Next billing date</label>
                <input type="date" value={form.nextBilling} onChange={(e) => setForm({ ...form, nextBilling: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Notes (optional)</label>
                <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <p className={`auth-message ${formMessageType}`}>{formMessage}</p>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? <><Spinner size={14} /> Saving...</> : "Create subscription"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <SkeletonTable rows={4} cols={5} />
          ) : subscriptions.length === 0 ? (
            <p>No subscriptions yet. Click "+ New subscription" to add one.</p>
          ) : (
            <>
              <div className="sw-filter-bar">
                <input
                  type="search"
                  placeholder="Search by name, notes, category..."
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
                      <tr><th>Name</th><th>Category</th><th>Price</th><th>Cycle</th><th>Next billing</th><th></th></tr>
                    </thead>
                    <tbody>
                      {filteredSubs.map((sub) => (
                        <tr key={sub.id}>
                          <td><Link to={`/subscriptions/${sub.id}`}>{sub.name}</Link></td>
                          <td>{categoryLabel(sub.category)}</td>
                          <td>{formatCurrency(sub.price)}</td>
                          <td>{sub.billingCycle}</td>
                          <td>{sub.nextBilling ? formatShortDate(sub.nextBilling) : "—"}</td>
                          <td>
                            <Link to={`/subscriptions/${sub.id}`}>Details</Link>
                            {canManage && (
                              <>
                                {" • "}
                                <button type="button" className="delete-btn" onClick={() => handleDelete(sub)}>Cancel</button>
                              </>
                            )}
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
