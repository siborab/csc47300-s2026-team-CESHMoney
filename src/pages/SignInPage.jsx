import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/spendwise";
import PasswordInput from "../components/PasswordInput";
import Spinner from "../components/Spinner";
import { useToast } from "../components/ToastProvider";
import { normalizeEmail, writeSession } from "../utils/storage";

export default function SignInPage({ onLogin }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setMessageType("");
    try {
      const user = await login({
        email: normalizeEmail(email),
        password
      });
      writeSession(user);
      onLogin();
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}!`);
      setTimeout(() => {
        if (user.role === "admin") {
          navigate("/admin");
        } else {
          navigate(`/users/${user.id}`);
        }
      }, 250);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to continue managing shared expenses.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="signinEmail">Email</label>
            <input id="signinEmail" name="signinEmail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div>
            <label htmlFor="signinPassword">Password</label>
            <PasswordInput
              id="signinPassword"
              name="signinPassword"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? <><Spinner size={14} /> Signing in...</> : "Sign In"}
          </button>
          <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
        </form>

        <p className="auth-links">
          Need an account? <Link to="/signup">Create one here</Link>.
        </p>
        <p className="auth-links" style={{ fontSize: "0.85em", opacity: 0.7 }}>
          Demo: <code>demo@spendwise.com / demo123</code> &middot; Admin: <code>admin@spendwise.com / admin123</code>
        </p>
      </section>
    </main>
  );
}
