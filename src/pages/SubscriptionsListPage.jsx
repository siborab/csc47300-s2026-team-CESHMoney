import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createSubscription, deleteSubscription, listSubscriptions } from "../api/spendwise";
import { subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession } from "../utils/storage";

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
  const session = readSession();
  const userId = session?.user?.id;

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formMessageType, setFormMessageType] = useState("");

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
      const rows = await listSubscriptions(userId);
      setSubscriptions(rows.map(subscriptionRowToCard));
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
      await createSubscription({
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
    } catch (error) {
      setFormMessage(error.message);
      setFormMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Cancel this subscription?")) return;
    try {
      await deleteSubscription(id);
      await refetch();
    } catch (error) {
      alert(error.message);
    }
  }

  if (!userId) return null;

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <h1>My Subscriptions</h1>
            <button type="button" className="btn-add-expense" onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Close form" : "+ New subscription"}
            </button>
          </div>
          <p>Recurring services you pay for. Click any row to drill into the product details.</p>

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
                  {submitting ? "Saving..." : "Create subscription"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : subscriptions.length === 0 ? (
            <p>No subscriptions yet. Click "+ New subscription" to add one.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Category</th><th>Price</th><th>Cycle</th><th>Next billing</th><th></th></tr>
                </thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td><Link to={`/subscriptions/${sub.id}`}>{sub.name}</Link></td>
                      <td>{categoryLabel(sub.category)}</td>
                      <td>{formatCurrency(sub.price)}</td>
                      <td>{sub.billingCycle}</td>
                      <td>{sub.nextBilling ? formatShortDate(sub.nextBilling) : "—"}</td>
                      <td>
                        <Link to={`/subscriptions/${sub.id}`}>Details</Link>
                        {" • "}
                        <button type="button" className="delete-btn" onClick={() => handleDelete(sub.id)}>Cancel</button>
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
