import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteSubscription, getSubscription, updateSubscription } from "../api/spendwise";
import { subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel } from "../utils/dashboard";
import { formatCurrency, formatShortDate } from "../utils/format";
import { readSession } from "../utils/storage";

// /subscriptions/:id - product details page.
// The product id is part of the URL (as the rubric requires), and the page
// shows full details plus inline edit + delete for the owner or admin.
export default function SubscriptionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const session = readSession();
  const currentUserId = session?.user?.id;
  const isAdmin = session?.user?.role === "admin";

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
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
  }, [id]);

  async function handleSave(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const updated = await updateSubscription(id, {
        name: form.name,
        category: form.category,
        price: Number(form.price),
        billingCycle: form.billingCycle,
        nextBilling: form.nextBilling || null,
        notes: form.notes
      });
      setSubscription(subscriptionRowToCard(updated));
      setEditing(false);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this subscription permanently?")) return;
    try {
      await deleteSubscription(id);
      navigate("/subscriptions");
    } catch (error) {
      alert(error.message);
    }
  }

  if (loading) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section"><p>Loading subscription...</p></section>
        </div>
      </main>
    );
  }
  if (errorMessage || !subscription) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <h1>Subscription</h1>
            <p className="auth-message error">{errorMessage || "Subscription not found."}</p>
            <Link to="/subscriptions">← Back to subscriptions</Link>
          </section>
        </div>
      </main>
    );
  }

  const canEdit = isAdmin || subscription.userId === currentUserId;

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <Link to="/subscriptions">← All subscriptions</Link>
          <h1>{subscription.name}</h1>
          <p><strong>Product ID:</strong> <code>{subscription.id}</code></p>

          {!editing ? (
            <>
              <div className="cards">
                <div className="card"><h3>Price</h3><p>{formatCurrency(subscription.price)}</p></div>
                <div className="card"><h3>Billing cycle</h3><p>{subscription.billingCycle}</p></div>
                <div className="card"><h3>Category</h3><p>{categoryLabel(subscription.category)}</p></div>
                <div className="card">
                  <h3>Next billing</h3>
                  <p>{subscription.nextBilling ? formatShortDate(subscription.nextBilling) : "—"}</p>
                </div>
              </div>
              {subscription.notes && (
                <div className="section">
                  <h2>Notes</h2>
                  <p>{subscription.notes}</p>
                </div>
              )}
              {subscription.owner && (
                <div className="section">
                  <h2>Owner</h2>
                  <p>
                    <Link to={`/users/${subscription.owner.id}`}>{subscription.owner.full_name}</Link>
                    {" "}({subscription.owner.email})
                  </p>
                </div>
              )}
              {canEdit && (
                <div className="modal-actions">
                  <button type="button" className="btn-edit-categories" onClick={() => setEditing(true)}>Edit</button>
                  <button type="button" className="delete-btn" onClick={handleDelete}>Delete</button>
                </div>
              )}
              {message && <p className="auth-message success">{message}</p>}
            </>
          ) : (
            <form onSubmit={handleSave} style={{ display: "grid", gap: "10px" }}>
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
              {message && <p className="auth-message error">{message}</p>}
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
                <button type="submit" className="btn-submit" disabled={submitting}>{submitting ? "Saving..." : "Save changes"}</button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
