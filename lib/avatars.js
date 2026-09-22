// The avatars a student can pick from.
//
// Each one is a PNG in public/avatars, sliced out of brand/source-avatars.webp
// by scripts/build-avatars.cjs. Re-export that sheet and re-run the script and
// every avatar updates together.
//
// The server checks a chosen key against this list, so a member can't put an
// arbitrary string on somebody else's screen.

// Bumped by scripts/build-avatars.cjs when the artwork changes, so a browser
// can't serve a stale face.
export const AVATAR_VERSION = 'f557392a';

// 24 people, then 8 animals, in the order they appear on the sheet.
export const PEOPLE = Array.from({ length: 24 }, (_, i) => `a${i + 1}`);
export const ANIMALS = Array.from({ length: 8 }, (_, i) => `a${i + 25}`);

export const AVATAR_GROUPS = [
  { label: 'People', keys: PEOPLE },
  { label: 'Animals', keys: ANIMALS },
];

export const AVATARS = [...PEOPLE, ...ANIMALS];

const SET = new Set(AVATARS);
export const isAvatar = (value) => SET.has(String(value));

export const avatarSrc = (key) => `/avatars/${key}.png?v=${AVATAR_VERSION}`;

// Someone who hasn't picked yet gets their initial on a colour drawn from
// their name, so two of them still look different.
const DISC = ['#dceee2', '#e4e8f6', '#f7ecd7', '#f3e2ef', '#dff0f2', '#ece7f7'];

export function avatarColor(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DISC[h % DISC.length];
}

export const initial = (name) => String(name ?? '?').trim().charAt(0).toUpperCase() || '?';
