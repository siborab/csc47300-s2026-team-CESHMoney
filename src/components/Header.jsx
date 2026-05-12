import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header({ session, onLogout }) {
  const location = useLocation();
  const onHomePage = location.pathname === "/";
  const user = session?.user;
  const isAdmin = user?.role === "admin";

  return (
    <header>
      <div className="container">
        <h1><Link to="/">SpendWise</Link></h1>
        <nav>
          <ul>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/subscriptions">Subscriptions</Link></li>
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
            {isAdmin && <li><Link to="/admin">Admin</Link></li>}
            <li><a href={onHomePage ? "#about" : "/#about"}>About</a></li>
            <li className="login-menu">
              {user ? (
                <details>
                  <summary>{user.fullName?.split(" ")[0] || "Account"}</summary>
                  <ul className="login-dropdown">
                    <li><Link to={`/users/${user.id}`}>My Profile</Link></li>
                    <li><button type="button" className="logout-btn" onClick={onLogout}>Logout</button></li>
                  </ul>
                </details>
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
          </ul>
        </nav>
      </div>
    </header>
  );
}
