import React, { useState } from "react";
import { Link } from "react-router-dom";
import { normalizeEmail } from "../utils/storage";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  function handleSubmit(event) {
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

    setMessage("Sign-up submitted. Demo mode only: add this account to user.json to enable login.");
    setMessageType("success");
    setFullName("");
    setEmail("");
    setPassword("");
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

          <button type="submit" className="auth-submit">Sign Up</button>
          <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
        </form>

        <p className="auth-links">Already have an account? <Link to="/signin">Sign in here</Link>.</p>
      </section>
    </main>
  );
}
