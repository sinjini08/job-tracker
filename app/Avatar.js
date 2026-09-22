'use client';

import { AVATAR_STYLES, avatarColor, initial } from '@/lib/avatars';

// A member's face on the board. Either one of the drawn portraits from
// lib/avatars.js, or — until they pick one — the first letter of their name on
// a colour taken from that name.
//
// The portraits are built the way you'd draw one by hand: a disc, shoulders, a
// head, then hair. Hair goes on BEFORE the face and slightly larger, so the
// face circle covers its lower half and leaves a clean hairline; the styles
// then add a bun, curls, length or a cap on top of that.

export default function Avatar({ name, avatar, size = 40, title }) {
  const style = AVATAR_STYLES[avatar];
  if (!style) {
    return (
      <span className="avatar" title={title}
        style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.4 }}
        aria-hidden>
        {initial(name)}
      </span>
    );
  }
  return (
    <svg className="avatar art" width={size} height={size} viewBox="0 0 100 100"
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <Portrait {...style} />
    </svg>
  );
}

function Portrait({ hair, skin, hairColor, shirt, bg, cap, specs }) {
  const domed = hair === 'short' || hair === 'bun' || hair === 'curly' || hair === 'long';
  return (
    <>
      <circle cx="50" cy="50" r="50" fill={bg} />
      {/* shoulders, so it reads as a portrait rather than a floating head */}
      <path d="M16 100c0-20 15-29 34-29s34 9 34 29z" fill={shirt} />
      <path d="M43 62h14v12H43z" fill={skin} />

      {hair === 'afro' && <circle cx="50" cy="40" r="32" fill={hairColor} />}
      {hair === 'long' && (
        <path d="M20 42c0-17 13-27 30-27s30 10 30 27v34c0 4-3 7-7 7s-7-3-7-7V50H34v26c0 4-3 7-7 7s-7-3-7-7z"
          fill={hairColor} />
      )}
      {domed && <circle cx="50" cy="41" r="27" fill={hairColor} />}
      {hair === 'curly' && (
        <>
          <circle cx="30" cy="32" r="10" fill={hairColor} />
          <circle cx="50" cy="23" r="11" fill={hairColor} />
          <circle cx="70" cy="32" r="10" fill={hairColor} />
        </>
      )}
      {hair === 'bun' && <circle cx="50" cy="14" r="9" fill={hairColor} />}

      {/* the face covers the lower half of the hair, leaving the hairline */}
      <circle cx="50" cy="46" r="26" fill={skin} />
      <circle cx="24" cy="48" r="5" fill={skin} />
      <circle cx="76" cy="48" r="5" fill={skin} />

      {hair === 'cap' && (
        <>
          <path d="M24 40a26 26 0 0 1 52 0z" fill={cap ?? hairColor} />
          <rect x="20" y="37" width="60" height="7" rx="3.5" fill={cap ?? hairColor} />
        </>
      )}

      {specs && (
        <g stroke="#3a3a34" strokeWidth="2" fill="none">
          <circle cx="40" cy="47" r="8.5" />
          <circle cx="60" cy="47" r="8.5" />
          <path d="M48.5 47h3" />
        </g>
      )}

      <circle cx="40" cy="47" r="2.6" fill="#2f2a26" />
      <circle cx="60" cy="47" r="2.6" fill="#2f2a26" />
      <path d="M43 57a7 7 0 0 0 14 0" stroke="#2f2a26" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>
  );
}
