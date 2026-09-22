// The mark from brand/source-logo.png, rebuilt in SVG so the rings and the
// dart can move independently. A PNG can only fade; this can be thrown.
//
// The geometry matches the artwork: two rings broken where the shaft crosses
// them, a solid centre, and a dart on a 45° line with its tip in the middle.
// If the logo is ever redrawn, these numbers move with it.
//
// Everything animates in globals.css (.bullseye.play *) so the whole sequence
// runs on the compositor — no React state ticks a single frame of it.

const CX = 230;
const CY = 320;

// pathLength = 360 puts the dash pattern in degrees, so the same 46° gap works
// on both rings whatever their radius.
//
// The gap is placed with dashoffset rather than by rotating the circle. A
// rotate() on the element itself would be the same CSS `transform` property
// the entrance animation scales, and with transform-box: fill-box underneath
// it the two combine into a displacement that pushes the mark off its own
// viewBox. Offsetting the dash pattern leaves transform free for the animation.
//
// A circle path starts at 3 o'clock and runs clockwise, so a 314° dash that
// begins 22° early leaves the gap spanning 292°–338°: centred on 315°, which
// is the dart's line of flight.
function Ring({ cls, r, w }) {
  return (
    <circle
      className={cls}
      cx={CX} cy={CY} r={r}
      fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="butt"
      pathLength="360" strokeDasharray="314 46" strokeDashoffset="22"
    />
  );
}

export default function Bullseye({ size = 184, playing = false, className = '' }) {
  return (
    <svg
      className={`bullseye${playing ? ' play' : ''} ${className}`}
      viewBox="0 0 560 560"
      width={size}
      height={size}
      role="img"
      aria-label="A dart landing in the centre of a target"
    >
      <Ring cls="bx-ring-outer" r={195} w={52} />
      <Ring cls="bx-ring-inner" r={112} w={48} />

      {/* The impact: a ring thrown off the centre at the moment the tip lands. */}
      <circle
        className="bx-ripple"
        cx={CX} cy={CY} r={54}
        fill="none" stroke="currentColor" strokeWidth={10}
      />

      <circle className="bx-dot" cx={CX} cy={CY} r={54} fill="currentColor" />

      {/* Shaft and two flights, as one body so they fly together. */}
      <g className="bx-dart" fill="currentColor">
        <path d="M230,320 L499.4,23.8 L526.2,50.6 Z" />
        <path d="M396.2,153.8 L425.8,28 L498.9,22.9 L463.3,86.7 Z" />
        <path d="M410.3,139.7 L525.6,120.6 L528.6,52.6 L473.9,76.1 Z" />
      </g>
    </svg>
  );
}
