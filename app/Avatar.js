'use client';

import { AVATAR_STYLES, avatarColor, initial } from '@/lib/avatars';

// A member's face on the board. Either one of the drawn portraits from
// lib/avatars.js, or, until they pick one, the first letter of their name on a
// colour taken from that name.
//
// Drawing order is the whole trick: background, shoulders, any hair that sits
// BEHIND the head, then the head, then the face, then the hair that sits in
// FRONT. That is what lets long hair fall past the shoulders while a fringe
// still covers the forehead.

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

// Shadow under the hair, so black hair on a dark skin tone still separates.
const shade = 'rgba(0,0,0,0.13)';

function Portrait({ hair, skin, hairColor, top, bg, cap, specs, earrings, hood }) {
  return (
    <>
      <circle cx="50" cy="50" r="50" fill={bg} />

      {/* hair behind the head and shoulders */}
      {(hair === 'wavyLong' || hair === 'straightLong') && (
        <>
          <path d="M19 50c0-18 14-32 31-32s31 14 31 32v28H19z" fill={hairColor} />
          {/* scalloped ends, so the hair doesn't finish on a straight cut */}
          {hair === 'wavyLong' && (
            <>
              <circle cx="24" cy="78" r="6.5" fill={hairColor} />
              <circle cx="37" cy="80" r="6" fill={hairColor} />
              <circle cx="63" cy="80" r="6" fill={hairColor} />
              <circle cx="76" cy="78" r="6.5" fill={hairColor} />
            </>
          )}
        </>
      )}
      {hair === 'curly' && (
        <>
          <circle cx="50" cy="38" r="30" fill={hairColor} />
          <circle cx="24" cy="44" r="12" fill={hairColor} />
          <circle cx="76" cy="44" r="12" fill={hairColor} />
          <circle cx="32" cy="22" r="13" fill={hairColor} />
          <circle cx="68" cy="22" r="13" fill={hairColor} />
        </>
      )}
      {hair === 'bun' && (
        <>
          <circle cx="50" cy="13" r="11" fill={hairColor} />
          <path d="M40 16c3-4 17-4 20 0" stroke={hairColor} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      )}
      {hair === 'grey' && <circle cx="50" cy="42" r="28" fill={hairColor} />}

      {/* shoulders */}
      {hood ? (
        <>
          <path d="M14 100c0-21 16-30 36-30s36 9 36 30z" fill={top} />
          {/* hood, sitting behind the neck */}
          <path d="M26 78c2-9 11-13 24-13s22 4 24 13c-6-4-14-6-24-6s-18 2-24 6z" fill={top} />
          <path d="M26 78c2-9 11-13 24-13s22 4 24 13" fill="none" stroke={shade} strokeWidth="2" />
        </>
      ) : (
        <path d="M16 100c0-20 15-29 34-29s34 9 34 29z" fill={top} />
      )}
      <path d="M43 60h14v13H43z" fill={skin} />
      <path d="M43 62c4 4 10 4 14 0v-2H43z" fill={shade} />

      {/* head */}
      <path d="M26 46c0-14 11-24 24-24s24 10 24 24v6c0 14-11 24-24 24S26 66 26 52z" fill={skin} />
      <ellipse cx="24" cy="52" rx="4.6" ry="5.4" fill={skin} />
      <ellipse cx="76" cy="52" rx="4.6" ry="5.4" fill={skin} />

      {/* hair in front: the fringe or parting */}
      {hair === 'wavyLong' && (
        <path d="M26 46c0-14 11-24 24-24s24 10 24 24c-3-7-10-12-15-10-6 2-12 5-19 4-6-1-11 1-14 6z" fill={hairColor} />
      )}
      {hair === 'straightLong' && (
        <path d="M26 47c0-14 11-25 24-25s24 11 24 25c-2-8-7-13-13-15-2 6-6 9-11 10-9 2-17 0-24 5z" fill={hairColor} />
      )}
      {hair === 'swoop' && (
        <path d="M25 47c0-15 11-26 25-26 13 0 24 9 25 22 0 5-3 9-7 10 1-6-2-11-7-12-7-2-14 3-21 3-6 0-11 0-15 3z"
          fill={hairColor} />
      )}
      {hair === 'bun' && (
        <path d="M26 47c0-14 11-25 24-25s24 11 24 25c-4-9-12-14-24-14s-20 5-24 14z" fill={hairColor} />
      )}
      {hair === 'curly' && (
        <path d="M27 45c1-13 11-23 23-23s22 10 23 23c-5-8-13-12-23-12s-18 4-23 12z" fill={hairColor} />
      )}
      {hair === 'grey' && (
        <path d="M26 46c0-14 11-24 24-24s24 10 24 24c-5-9-13-13-24-13s-19 4-24 13z" fill={hairColor} />
      )}
      {hair === 'cap' && (
        <>
          <path d="M26 44a24 24 0 0 1 48 0z" fill={cap ?? hairColor} />
          <rect x="22" y="41" width="56" height="7" rx="3.5" fill={cap ?? hairColor} />
          <path d="M50 20c2 0 3 1 3 3h-6c0-2 1-3 3-3z" fill={cap ?? hairColor} />
        </>
      )}

      {/* long hair falls over the shoulders, so these go in front of them */}
      {(hair === 'wavyLong' || hair === 'straightLong') && (
        <>
          <path d="M28 46c-6 13-7 28-4 44 .5 3-6 4-7 1-4-16-3-33 4-45z" fill={hairColor} />
          <path d="M72 46c6 13 7 28 4 44-.5 3 6 4 7 1 4-16 3-33-4-45z" fill={hairColor} />
        </>
      )}

      {earrings && (
        <>
          <circle cx="23" cy="60" r="2.6" fill="#d7ad4e" />
          <circle cx="77" cy="60" r="2.6" fill="#d7ad4e" />
        </>
      )}

      {/* blush, then eyes: big, dark, with a highlight, which is most of what
          makes these read as friendly rather than blank */}
      <ellipse cx="35" cy="59" rx="5" ry="3" fill="#f0a08e" opacity="0.5" />
      <ellipse cx="65" cy="59" rx="5" ry="3" fill="#f0a08e" opacity="0.5" />

      {specs && (
        <g stroke="#2f2a26" strokeWidth="2.2" fill="none">
          <circle cx="39" cy="52" r="9.5" />
          <circle cx="61" cy="52" r="9.5" />
          <path d="M48.5 52h3M29.5 51l-4-1M70.5 51l4-1" />
        </g>
      )}

      <ellipse cx="39" cy="52" rx="4.6" ry="5.2" fill="#241f1c" />
      <ellipse cx="61" cy="52" rx="4.6" ry="5.2" fill="#241f1c" />
      <circle cx="40.8" cy="50" r="1.7" fill="#fff" />
      <circle cx="62.8" cy="50" r="1.7" fill="#fff" />

      <path d="M46 62.5a5 5 0 0 0 8 0" stroke="#7a4a3a" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </>
  );
}
