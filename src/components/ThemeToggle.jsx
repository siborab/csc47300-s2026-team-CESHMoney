import React, { useEffect, useState } from "react";

const STORAGE_KEY = "spendwise_theme";

function readInitialTheme() {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

// Header button that flips a `data-theme` attribute on <html>. CSS variables in
// polish.css supply the dark palette, so every component reacts automatically.
export default function ThemeToggle() {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function toggle() {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="sw-theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
