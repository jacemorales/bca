
export default function ViewerCountBadge({ count = 0 }: { count?: number }) {
  return <div className="viewer-badge">🔴 Live • {count}</div>;
}
