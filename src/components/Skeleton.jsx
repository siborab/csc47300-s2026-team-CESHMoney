import React from "react";

// Generic shimmer placeholder. Use the helpers below for common shapes.
export default function Skeleton({ width = "100%", height = 16, radius = 6, style }) {
  return (
    <span
      className="sw-skeleton"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

// A card-sized skeleton, useful while dashboard cards are loading.
export function SkeletonCard() {
  return (
    <div className="sw-skeleton-card" aria-hidden="true">
      <Skeleton width="40%" height={14} />
      <Skeleton width="70%" height={28} style={{ marginTop: 10 }} />
    </div>
  );
}

// Renders a configurable number of skeleton table rows.
export function SkeletonTable({ rows = 4, cols = 4 }) {
  return (
    <div className="sw-skeleton-table" aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div className="sw-skeleton-row" key={rowIndex}>
          {Array.from({ length: cols }).map((__, colIndex) => (
            <Skeleton key={colIndex} height={14} width={`${60 + ((rowIndex + colIndex) % 4) * 10}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
