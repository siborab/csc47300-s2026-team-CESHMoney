import React from "react";

// Inline circular spinner. Pass `size` in pixels and optional `label` for a11y.
export default function Spinner({ size = 18, label = "Loading" }) {
  return (
    <span
      className="sw-spinner"
      role="status"
      aria-label={label}
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 8)) }}
    />
  );
}
