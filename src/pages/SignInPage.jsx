import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { normalizeEmail, writeSession } from "../utils/storage";

export default function SignInPage({ onLogin }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    try {
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
