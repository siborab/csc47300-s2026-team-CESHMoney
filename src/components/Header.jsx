import React, { useEffect, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";

export default function Header({ session, onLogout }) {
  const location = useLocation();
  const onHomePage = location.pathname === "/";
  const user = session?.user;
  const isAdmin = user?.role === "admin";
  const navRef = useRef(null);

  // Update page title based on current route
  useEffect(() => {
    let routeName = location.pathname === "/" ? "Home" : location.pathname.substring(1).split("/")[0];
    routeName = routeName.charAt(0).toUpperCase() + routeName.slice(1);
    document.title = `SpendWise | ${routeName.replace("-", " ")}`;
  }, [location.pathname]);

  // Close any open header dropdown (<details>) when the user navigates to a
  // new route. Without this they remain open across pages and look stale.
  useEffect(() => {
    navRef.current?.querySelectorAll("details[open]").forEach((d) => {
      d.removeAttribute("open");
    });
  }, [location.pathname]);

  // Close header dropdowns when the user clicks outside the nav or presses
  // Escape. The native <details> element only toggles on its own summary, so
  // we add this behavior explicitly to match user expectations.
  useEffect(() => {
    function handleDocClick(event) {
      const nav = navRef.current;
      if (!nav) return;
      const openDetails = nav.querySelectorAll("details[open]");
      if (openDetails.length === 0) return;
      openDetails.forEach((d) => {
        if (!d.contains(event.target)) {
          d.removeAttribute("open");
        }
      });
    }
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      navRef.current?.querySelectorAll("details[open]").forEach((d) => {
        d.removeAttribute("open");
      });
    }
    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header>
      <div className="container">
        <h1>
          <Link to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <span className="brand-mark__inner">S</span>
            </span>
            <span className="brand-text">SpendWise</span>
          </Link>
        </h1>
        <nav ref={navRef}>
          <ul>
            <li><NavLink to={onHomePage ? "#about" : "/#about"} className={({ isActive }) => isActive ? "active-link" : ""}>About</NavLink></li>
            <li><NavLink to="/dashboard" className={({ isActive }) => isActive ? "active-link" : ""}>Dashboard</NavLink></li>
            <li><NavLink to="/subscriptions" className={({ isActive }) => isActive ? "active-link" : ""}>Subscriptions</NavLink></li>
            <li className="login-menu">
              <details>
                <summary>Features</summary>
                <ul className="login-dropdown">
                  <li><NavLink to="/budget-timeline" className={({ isActive }) => isActive ? "active-link" : ""}>Budget Timeline</NavLink></li>
                  <li><NavLink to="/currency-conversion" className={({ isActive }) => isActive ? "active-link" : ""}>Currency Conversion</NavLink></li>
                  <li><NavLink to="/export-center" className={({ isActive }) => isActive ? "active-link" : ""}>Export Center</NavLink></li>
                  <li><NavLink to="/subscription-notifications" className={({ isActive }) => isActive ? "active-link" : ""}>Subscription Alerts</NavLink></li>
                </ul>
              </details>
            </li>
            {isAdmin && <li><NavLink to="/admin" className={({ isActive }) => isActive ? "active-link" : ""}>Admin</NavLink></li>}
            {user ? (
              <>
                <li><NavLink to={`/users/${user.id}`} className={({ isActive }) => isActive ? "active-link" : ""}>Profile ({user.fullName?.split(" ")[0] || "Me"})</NavLink></li>
                <li>
                  <button type="button" className="logout-btn" onClick={onLogout}>
                    Logout
                  </button>
                </li>
              </>
            ) : (
              <li className="login-menu">
                <details>
                  <summary>Login</summary>
                  <ul className="login-dropdown">
                    <li><Link to="/signin">Sign In</Link></li>
                    <li><Link to="/signup">Sign Up</Link></li>
                  </ul>
                </details>
              </li>
            )}
            <li><ThemeToggle /></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
