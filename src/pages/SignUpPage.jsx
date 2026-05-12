import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUp } from "../api/spendwise";
import { normalizeEmail, writeSession } from "../utils/storage";

export default function SignUpPage({ onLogin }) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!fullName.trim() || !normalizeEmail(email) || !password) {
      setMessage("Please fill all required fields.");
      setMessageType("error");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setMessageType("");
    try {
      const user = await signUp({
        fullName: fullName.trim(),
        email: normalizeEmail(email),
        password
      });
      writeSession(user);
      onLogin?.();
      setMessage(`Welcome, ${user.fullName}! Redirecting to your profile...`);
      setMessageType("success");
      setTimeout(() => navigate(`/users/${user.id}`), 600);
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-main">
      <section className="auth-card">
        <h2>Create Account</h2>
        <p className="auth-subtitle">Set up your SpendWise account in a few seconds.</p>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" name="fullName" type="text" required value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>

          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength="6" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? "Creating..." : "Sign Up"}
          </button>
          <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
        </form>

        <p className="auth-links">Already have an account? <Link to="/signin">Sign in here</Link>.</p>
      </section>
    </main>
  );
}
