import React from "react";

export default function Footer() {
  return (
    <footer>
      <span className="footer-accent" aria-hidden="true" />
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-mark" aria-hidden="true">S</span>
          <span className="footer-brand-text">SpendWise</span>
        </div>
        <p className="footer-copy">&copy; 2026 SpendWise. Built with care.</p>
      </div>
    </footer>
  );
}
