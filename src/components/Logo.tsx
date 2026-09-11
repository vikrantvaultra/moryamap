export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="64" height="64" rx="14" fill="#7c2d12" />
      <g fill="#f59e0b">
        <circle cx="44" cy="32" r="7" />
        <circle cx="40.5" cy="40.5" r="7" />
        <circle cx="32" cy="44" r="7" />
        <circle cx="23.5" cy="40.5" r="7" />
        <circle cx="20" cy="32" r="7" />
        <circle cx="23.5" cy="23.5" r="7" />
        <circle cx="32" cy="20" r="7" />
        <circle cx="40.5" cy="23.5" r="7" />
      </g>
      <circle cx="32" cy="32" r="7.5" fill="#fde68a" />
    </svg>
  );
}
