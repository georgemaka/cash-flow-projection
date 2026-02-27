/** Lightweight skeleton loader — no external deps. */
export function Skeleton({
  width,
  height = "1rem",
  borderRadius = "8px",
  className = "",
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}) {
  return (
    <span
      className={`skeleton-pulse ${className}`}
      style={{ width, height, borderRadius, display: "block" }}
    />
  );
}

/** A card-shaped skeleton placeholder. */
export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <Skeleton width="40%" height="0.75rem" />
      <Skeleton width="70%" height="1.1rem" />
      <Skeleton width="55%" height="0.75rem" />
    </div>
  );
}
