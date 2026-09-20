// The tracker's mark: a spiral bullseye with a dart. Drawn as one component so
// the app bar, the sign-in page and the exported icons never drift apart.
//
// `tone`:
//   'light'  — white rings on a coloured background (app bar, green surfaces)
//   'dark'   — green rings on white (light backgrounds, print, LinkedIn)
// `badge` draws the rounded green square behind it (app icon, sign-in mark).

export const BRAND = {
  green: '#2e6b3d',
  greenDeep: '#235231',
  ring: '#f5f5f0',
  dart: '#6bb87a',
  dartDark: '#4a8b5a',
};

export default function Logo({ size = 28, tone = 'light', badge = false, title = 'Job Tracker' }) {
  const ring = tone === 'light' ? BRAND.ring : BRAND.green;
  const dart = tone === 'light' ? BRAND.dart : BRAND.dartDark;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title} focusable="false">
      {badge && <rect width="64" height="64" rx="15" fill={BRAND.green} />}
      {/* The dart cuts a gap through the rings so the shapes stay separate. */}
      <mask id="jt-dart-gap">
        <rect width="64" height="64" fill="#fff" />
        <path d="M27 38 L50 15" stroke="#000" strokeWidth="11" strokeLinecap="round" />
      </mask>
      <g mask="url(#jt-dart-gap)" fill="none" stroke={ring} strokeWidth="5.5" strokeLinecap="round">
        {/* Two closed rings; the dart's gap is the only break in them. */}
        <circle cx="27" cy="38" r="19.5" />
        <circle cx="27" cy="38" r="11" />
      </g>
      <circle cx="27" cy="38" r="4.4" fill={ring} />
      <path d="M27 38 L48.5 16.5" stroke={dart} strokeWidth="4.6" strokeLinecap="round" />
      {/* Fletching: two flights, the far one slightly lighter. */}
      <path d="M45 9.5 L56.5 7 L54 18.5 Z" fill={dart} />
      <path d="M49.5 20 L58.5 18 L56.5 27 Z" fill={dart} opacity="0.78" />
    </svg>
  );
}
