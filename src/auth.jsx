import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { normalizeEmail, writeSession } from "./utils.js";

// Sign-in page component.
// Replaces the legacy auth.ts/auth.js sign-in flow with React state.
export function SignInPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      // Demo auth reads users from a local JSON file instead of a backend.
      const response = await fetch("/user.json", { cache: "no-store" });
      const data = await response.json();
      const users = Array.isArray(data.users) ? data.users : [];
      const matchedUser = users.find(
        (user) => normalizeEmail(user.email) === normalizeEmail(email) && user.password === password
      );

      if (!matchedUser) {
        setMessage("Invalid email or password");
        setMessageType("error");
        return;
      }

      writeSession({
        id: matchedUser.id,
        fullName: matchedUser.fullName,
        email: matchedUser.email
      });
      // Update app state immediately so the header can reflect the logged-in session.
      onLogin();
      setMessage("Login success, redirecting...");
      setMessageType("success");
      setTimeout(() => {
        navigate("/");
      }, 700);
    } catch (error) {
      setMessage("Cannot read user.json");
      setMessageType("error");
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
            <input id="signinPassword" name="signinPassword" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>

          <button type="submit" className="auth-submit">Sign In</button>
          <p className={`auth-message ${messageType}`} aria-live="polite">{message}</p>
        </form>

        <p className="auth-links">Need an account? <Link to="/signup">Create one here</Link>.</p>
      </section>
    </main>
  );
}

// Sign-up page component.
// Replaces the legacy auth.ts/auth.js sign-up flow with React state.
export function SignUpPage() {
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
