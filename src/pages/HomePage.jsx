import React from "react";
import { Link } from "react-router-dom";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <h2>Manage Shared Finances Simply</h2>
          <p>Track expenses, categorize spending, and split bills effortlessly.</p>
          <Link to="/dashboard" className="btn">Get Started</Link>
        </div>
      </section>

      <section id="features" className="features">
        <div className="container">
          <h2>Key Features</h2>
          <div className="feature-grid">
            <div className="feature-card">
              <h3>Expense Tracking</h3>
              <p>Input expenses and assign them to categories like rent, groceries, and bills.</p>
            </div>
            <div className="feature-card">
              <h3>Shared Dashboard</h3>
              <p>View summaries of total expenses and see who owes what in your group.</p>
            </div>
            <div className="feature-card">
              <h3>Budget Alerts</h3>
              <p>Set monthly limits and get notified when you're approaching your budget.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="about">
        <div className="container">
          <h2>About SpendWise</h2>
          <p>SpendWise helps individuals and groups manage shared finances in a transparent way.</p>
        </div>
      </section>
    </main>
  );
}
