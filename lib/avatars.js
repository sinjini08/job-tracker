// The avatars a student can pick from. One emoji each, because it renders
// everywhere without an upload, a storage bucket or a moderation queue — and
// the server checks the chosen value against this same list, so a member can't
// put an arbitrary string on someone else's screen.
//
// A photo upload is the obvious next step; it needs Supabase Storage and a
// think about what happens when someone uploads something they shouldn't.

export const AVATARS = [
  '🦊', '🦉', '🐙', '🐢', '🐝', '🦋',
  '🌵', '🍄', '🌙', '⚡', '🔥', '🌊',
  '🚀', '🎧', '🎸', '🧋', '🍀', '🏔️',
];

export const isAvatar = (value) => AVATARS.includes(value);

// Everyone gets a colour, picked from their name so it's stable and so two
// people who chose the same emoji still look different.
const DISC = ['#dceee2', '#e4e8f6', '#f7ecd7', '#f3e2ef', '#dff0f2', '#ece7f7'];

export function avatarColor(seed) {
  const s = String(seed ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return DISC[h % DISC.length];
}

export const initial = (name) => String(name ?? '?').trim().charAt(0).toUpperCase() || '?';
