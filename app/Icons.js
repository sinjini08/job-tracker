// Small drawn icons for the league. Drawn rather than emoji: emoji render at
// wildly different weights and colours across platforms, and at 14px a 🏆 is
// mostly a brown smudge. These take currentColor, so they pick up whatever
// they sit inside.

export function Trophy({ size = 14, ...rest }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="currentColor" aria-hidden {...rest}>
      {/* cup */}
      <path d="M6 2h8v5.2A4 4 0 0 1 10 11.2 4 4 0 0 1 6 7.2z" />
      {/* handles */}
      <path d="M5 3.2H2.2v1.9A3.4 3.4 0 0 0 5.6 8.5h.6V6.9h-.6a1.8 1.8 0 0 1-1.8-1.8V4.8H5z" />
      <path d="M15 3.2h2.8v1.9A3.4 3.4 0 0 1 14.4 8.5h-.6V6.9h.6a1.8 1.8 0 0 0 1.8-1.8V4.8H15z" />
      {/* stem and base */}
      <rect x="9" y="10.8" width="2" height="3.4" />
      <rect x="5.8" y="14" width="8.4" height="2.6" rx="1.3" />
    </svg>
  );
}

export function Flame({ size = 14, ...rest }) {
  return (
    <svg viewBox="0 0 16 20" width={size} height={size} fill="currentColor" aria-hidden {...rest}>
      <path d="M8.6.4c.5 3 2.3 4.3 3.5 6.1A6.6 6.6 0 0 1 13.3 10a5.3 5.3 0 0 1-10.6 0c0-2.2 1-3.8 2.2-5.1.1 1.5.7 2.4 1.4 2.4.9 0 1.3-1.1.9-2.9-.3-1.5 0-3 1.4-4z" />
      {/* the hotter core, so the flame reads as a flame and not a leaf */}
      <path d="M8.2 11c.6 1 2 1.7 2 3.2a2.4 2.4 0 0 1-4.8 0c0-1.4 1.2-2.1 1.7-3.3.4.5.8.7 1.1.1z"
        fill="#fff" opacity="0.45" />
    </svg>
  );
}

export function Crown({ size = 14, ...rest }) {
  return (
    <svg viewBox="0 0 18 14" width={size} height={size * (11 / 14)} fill="currentColor" aria-hidden {...rest}>
      <path d="M1 12V3l4.2 3L9 1l3.8 5L17 3v9z" />
      <rect x="1" y="12" width="16" height="2" rx="1" />
    </svg>
  );
}
