import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteSubscription, getSubscription, updateSubscription } from "../api/spendwise";
import { subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession } from "../utils/storage";

// /admin/subscriptions/:id - admin view of a single product (= subscription).
// Product id is part of the URL.
export default function AdminSubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = readSession();
  const isAdmin = session?.user?.role === "admin";

  const [subscription, setSubscription] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session?.user) {
      navigate("/signin");
      return;
    }
    if (!isAdmin) {
      navigate(`/subscriptions/${id}`);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const row = await getSubscription(id);
        if (cancelled) return;
        const card = subscriptionRowToCard(row);
        setSubscription(card);
        setForm({
          name: card.name,
          category: card.category,
          price: String(card.price),
          billingCycle: card.billingCycle,
          nextBilling: card.nextBilling || "",
          notes: card.notes || ""
        });
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageType("");
    try {
      const updated = await updateSubscription(id, {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        nextBilling: form.nextBilling || null,
        notes: form.notes
      });
      const card = subscriptionRowToCard(updated);
      setSubscription(card);
      setForm({
        name: card.name,
        category: card.category,
        price: String(card.price),
        billingCycle: card.billingCycle,
        nextBilling: card.nextBilling || "",
        notes: card.notes || ""
      });
      setMessage("Saved.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this subscription permanently?")) return;
    try {
      await deleteSubscription(id);
      navigate("/admin");
    } catch (error) {
      alert(error.message);
    }
  }

  if (!isAdmin) return null;

  if (loading) return <main className="feature-main"><div className="feature-shell"><section className="feature-section"><p>Loading...</p></section></div></main>;
  if (errorMessage || !subscription) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <p className="auth-message error">{errorMessage || "Subscription not found."}</p>
            <Link to="/admin">← Back to admin</Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <Link to="/admin">← Back to admin</Link>
          <h1>Product Details</h1>
          <p><strong>Product ID:</strong> <code>{subscription.id}</code></p>
          {subscription.owner && (
            <p>
              <strong>Owner:</strong>{" "}
              <Link to={`/admin/users/${subscription.owner.id}`}>{subscription.owner.full_name}</Link>
              {" "}({subscription.owner.email})
            </p>
          )}

          <div className="cards">
            <div className="card"><h3>Price</h3><p>{formatCurrency(subscription.price)}</p></div>
            <div className="card"><h3>Cycle</h3><p>{subscription.billingCycle}</p></div>
            <div className="card"><h3>Category</h3><p>{categoryLabel(subscription.category)}</p></div>
            <div className="card"><h3>Next billing</h3><p>{subscription.nextBilling ? formatShortDate(subscription.nextBilling) : "—"}</p></div>
          </div>

          <h2 style={{ marginTop: 24 }}>Edit</h2>
          <form onSubmit={handleSave} style={{ display: "grid", gap: "10px", maxWidth: 560 }}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
              <label>Next billing</label>
              <input type="date" value={form.nextBilling} onChange={(e) => setForm({ ...form, nextBilling: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            {message && <p className={`auth-message ${messageType}`}>{message}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
              <button type="button" className="delete-btn" onClick={handleDelete}>Delete</button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
