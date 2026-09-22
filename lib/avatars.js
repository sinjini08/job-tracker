// The avatars a student can pick from: flat portrait illustrations, drawn as
// SVG in app/Avatar.js from the recipes below. Nothing is fetched at runtime
// and nothing is licensed from anyone — they're a few circles and arcs,
// parameterised by this table.
//
// The server checks a chosen key against this list, so a member can't put an
// arbitrary string on somebody else's screen.
//
// A photo upload is the obvious next step; it needs Supabase Storage and a
// think about what happens when someone uploads something they shouldn't.

// hair: the shape on top · the rest is the palette · specs: glasses
export const AVATAR_STYLES = {
  a1:  { hair: 'short', skin: '#f0d0b4', hairColor: '#2f2a26', shirt: '#2e7d46', bg: '#dceee2' },
  a2:  { hair: 'bun',   skin: '#c98e63', hairColor: '#241c16', shirt: '#2a78d6', bg: '#e4e8f6' },
  a3:  { hair: 'curly', skin: '#8a5a38', hairColor: '#1d1712', shirt: '#e0651f', bg: '#f7ecd7' },
  a4:  { hair: 'long',  skin: '#f7e0c8', hairColor: '#b06b2c', shirt: '#8a5bd0', bg: '#ece7f7' },
  a5:  { hair: 'cap',   skin: '#e8b98f', hairColor: '#4a3728', shirt: '#1f9d55', bg: '#dff0f2', cap: '#d1478c' },
  a6:  { hair: 'afro',  skin: '#7b4b2a', hairColor: '#221a14', shirt: '#d9a441', bg: '#f3e2ef' },
  a7:  { hair: 'short', skin: '#a2673f', hairColor: '#3a2a1e', shirt: '#d1478c', bg: '#f3e2ef', specs: true },
  a8:  { hair: 'long',  skin: '#f0d0b4', hairColor: '#2f2a26', shirt: '#1f9d55', bg: '#dff0f2' },
  a9:  { hair: 'bun',   skin: '#f7e0c8', hairColor: '#8b3a3a', shirt: '#2a78d6', bg: '#dceee2' },
  a10: { hair: 'curly', skin: '#e8b98f', hairColor: '#6b6b6b', shirt: '#4a4a42', bg: '#e9e9e0', specs: true },
  a11: { hair: 'cap',   skin: '#c98e63', hairColor: '#241c16', shirt: '#e0651f', bg: '#f7ecd7', cap: '#1f9d55' },
  a12: { hair: 'afro',  skin: '#f0d0b4', hairColor: '#d9a441', shirt: '#8a5bd0', bg: '#ece7f7' },
};

export const AVATARS = Object.keys(AVATAR_STYLES);

export const isAvatar = (value) => Object.hasOwn(AVATAR_STYLES, String(value));

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
