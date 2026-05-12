import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteUser, getUser, updateUser } from "../api/spendwise";
import PasswordInput from "../components/PasswordInput";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import { expenseRowToTransaction, subscriptionRowToCard } from "../utils/dataAdapter";
import { categoryLabel, getEffectiveExpenseAmount } from "../utils/dashboard";
import { formatCurrency, formatShortDate, formatTableAmount } from "../utils/format";
import { readSession } from "../utils/storage";

// /admin/users/:id - admin-only deep dive into a single user account.
// Account id is part of the URL (rubric requirement) and admins can update
// the role, edit profile fields, or delete the account from here.
// Translate raw backend errors (Supabase, Postgres) into messages a human can
// actually act on. Falls back to the original message when nothing matches.
function humanizeUserError(message) {
  const lower = String(message || "").toLowerCase();
  if (lower.includes("duplicate key") || lower.includes("users_email_key") || lower.includes("23505")) {
    return "That email is already taken by another account.";
  }
  if (lower.includes("violates check constraint")) {
    return "One of the fields has an invalid value.";
  }
  return message || "Update failed.";
}

export default function AdminUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const session = readSession();
  const isAdmin = session?.user?.role === "admin";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  useEffect(() => {
    if (!session?.user) {
      navigate("/signin");
      return;
    }
    if (!isAdmin) {
      navigate(`/users/${id}`);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    try {
      const payload = await getUser(id);
      setData({
        user: payload.user,
        expenses: (payload.expenses || []).map(expenseRowToTransaction).filter(Boolean),
        subscriptions: (payload.subscriptions || []).map(subscriptionRowToCard)
      });
      setForm({
        fullName: payload.user.fullName,
        email: payload.user.email,
        role: payload.user.role,
        password: ""
      });
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageType("");
    const previousRole = data?.user?.role;
    try {
      const patch = {
        fullName: form.fullName,
        email: form.email,
        role: form.role
      };
      if (form.password) {
        patch.password = form.password;
      }
      const updated = await updateUser(id, patch);
      setData((current) => ({ ...current, user: updated }));
      setForm({ ...form, password: "" });

      // Surface the change kind so admins know exactly what happened.
      const messages = [];
      if (updated.role !== previousRole) {
        messages.push(
          updated.role === "admin"
            ? `${updated.fullName} is now an admin.`
            : `${updated.fullName} is now a regular user.`
        );
      }
      if (form.password) {
        messages.push("Password reset.");
      }
      if (messages.length === 0) {
        messages.push("Profile updated.");
      }
      toast.success(messages.join(" "));
    } catch (error) {
      const friendly = humanizeUserError(error.message);
      setMessage(friendly);
      setMessageType("error");
      toast.error(friendly);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (id === session.user.id) {
      toast.error("You cannot delete yourself.");
      return;
    }
    const ok = await confirm({
      title: `Delete ${data?.user?.fullName || "this user"}?`,
      message: "This permanently removes the account and every subscription, expense, and category they own.",
      confirmLabel: "Delete account",
      danger: true
    });
    if (!ok) return;
    try {
      await deleteUser(id);
      toast.success("Account deleted.");
      navigate("/admin");
    } catch (error) {
      toast.error(error.message);
    }
  }

  if (!isAdmin) return null;

  if (loading) {
    return (
      <main className="feature-main">
        <div className="feature-shell">
          <section className="feature-section">
            <p className="sw-loading-block"><Spinner /> Loading account...</p>
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
            <p className="auth-message error">{errorMessage || "User not found."}</p>
            <Link to="/admin">← Back to admin</Link>
          </section>
        </div>
      </main>
    );
  }

  const { user, expenses, subscriptions } = data;

  return (
    <main className="feature-main">
      <div className="feature-shell">
        <section className="feature-section">
          <Link to="/admin">← Back to admin</Link>
          <h1>Account Details</h1>
          <p><strong>User ID:</strong> <code>{user.id}</code></p>

          <form onSubmit={handleSave} style={{ display: "grid", gap: "10px", maxWidth: 560 }}>
            <div className="form-group">
              <label>Full name</label>
              <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <div className="form-group">
              <label>Reset password (optional)</label>
              <PasswordInput
                placeholder="Leave blank to keep current"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            {message && <p className={`auth-message ${messageType}`}>{message}</p>}
            <div className="modal-actions">
              <button type="submit" className="btn-submit" disabled={saving}>
                {saving ? <><Spinner size={14} /> Saving...</> : "Save changes"}
              </button>
              <button type="button" className="delete-btn" onClick={handleDelete}>Delete account</button>
            </div>
          </form>
        </section>

        <section className="feature-section">
          <h2>Subscriptions ({subscriptions.length})</h2>
          {subscriptions.length === 0 ? (
            <p>No subscriptions.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Next billing</th></tr></thead>
                <tbody>
                  {subscriptions.map((sub) => (
                    <tr key={sub.id}>
                      <td><Link to={`/admin/subscriptions/${sub.id}`}>{sub.name}</Link></td>
                      <td>{categoryLabel(sub.category)}</td>
                      <td>{formatCurrency(sub.price)} / {sub.billingCycle}</td>
                      <td>{sub.nextBilling ? formatShortDate(sub.nextBilling) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="feature-section">
          <h2>Recent Expenses</h2>
          {expenses.length === 0 ? (
            <p>None.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
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
