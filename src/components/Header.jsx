import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header({ session, onLogout }) {
  const location = useLocation();
  const onHomePage = location.pathname === "/";

  return (
    <header>
      <div className="container">
        <h1><Link to="/">SpendWise</Link></h1>
        <nav>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li className="login-menu">
              <details>
                <summary>Features</summary>
                <ul className="login-dropdown">
                  <li><Link to="/budget-timeline">Budget Timeline</Link></li>
                  <li><Link to="/currency-conversion">Currency Conversion</Link></li>
                  <li><Link to="/export-center">Export Center</Link></li>
                  <li><Link to="/subscription-notifications">Subscription Alerts</Link></li>
                </ul>
              </details>
            </li>
            <li><a href={onHomePage ? "#about" : "/#about"}>About</a></li>
            <li className="login-menu">
              {session && session.isLoggedIn ? (
                <button type="button" className="logout-btn" onClick={onLogout}>Logout</button>
              ) : (
                <details>
                  <summary>Login</summary>
                  <ul className="login-dropdown">
                    <li><Link to="/signin">Sign In</Link></li>
                    <li><Link to="/signup">Sign Up</Link></li>
                  </ul>
                </details>
              )}
            </li>
            <li><a href={onHomePage ? "#contact" : "/#contact"}>Contact</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
