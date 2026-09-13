export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="EMV"
      className={className}
    >
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
      />
      <text
        x="15"
        y="79"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="800"
        fontSize="27"
        letterSpacing="0.5"
        fill="currentColor"
      >
        EMV
      </text>
    </svg>
  );
}
