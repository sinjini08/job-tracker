// The avatars a student can pick from: flat portrait illustrations, drawn as
// SVG in app/Avatar.js from the recipes below. Nothing is fetched at runtime
// and nothing is licensed from anyone.
//
// The server checks a chosen key against this list, so a member can't put an
// arbitrary string on somebody else's screen.
//
// A photo upload is the obvious next step; it needs Supabase Storage and a
// think about what happens when someone uploads something they shouldn't.

const SKIN = {
  porcelain: '#f6ddc6',
  light: '#f0cba8',
  tan: '#dda877',
  warm: '#c98a55',
  deep: '#a26739',
  rich: '#75482a',
};

const HAIR = {
  black: '#241f1c',
  darkBrown: '#3b2a20',
  brown: '#5c3a24',
  chestnut: '#7b4a26',
  auburn: '#95502a',
  blonde: '#c99a4e',
  sand: '#d9b675',
  grey: '#6f6b66',
};

const TOP = {
  cream: '#f2ece2',
  charcoal: '#2f2d2b',
  green: '#2e7d46',
  blue: '#2a5fae',
  navy: '#27406b',
  grey: '#9aa0a6',
  rose: '#d98ba6',
  plum: '#7a5bd0',
  rust: '#c2642a',
};

const BG = {
  blush: '#fbe3e6',
  sky: '#dbe8fb',
  peach: '#fcE6d6',
  mint: '#dcf0e2',
  lilac: '#e9e2fa',
  butter: '#fbf0d4',
  cloud: '#eceef1',
};

// hair: the shape · specs / earrings / hood: extras
export const AVATAR_STYLES = {
  a1:  { hair: 'wavyLong', skin: SKIN.light, hairColor: HAIR.darkBrown, top: TOP.cream, bg: BG.blush, earrings: true },
  a2:  { hair: 'swoop', skin: SKIN.light, hairColor: HAIR.darkBrown, top: TOP.charcoal, bg: BG.sky, hood: true },
  a3:  { hair: 'bun', skin: SKIN.tan, hairColor: HAIR.brown, top: TOP.charcoal, bg: BG.peach },
  a4:  { hair: 'curly', skin: SKIN.porcelain, hairColor: HAIR.black, top: TOP.green, bg: BG.mint, specs: true },
  a5:  { hair: 'straightLong', skin: SKIN.light, hairColor: HAIR.black, top: TOP.rose, bg: BG.lilac, earrings: true },
  a6:  { hair: 'swoop', skin: SKIN.light, hairColor: HAIR.brown, top: TOP.grey, bg: BG.mint, hood: true },
  a7:  { hair: 'wavyLong', skin: SKIN.light, hairColor: HAIR.chestnut, top: TOP.charcoal, bg: BG.butter, earrings: true },
  a8:  { hair: 'swoop', skin: SKIN.porcelain, hairColor: HAIR.sand, top: TOP.navy, bg: BG.sky, hood: true },
  a9:  { hair: 'wavyLong', skin: SKIN.deep, hairColor: HAIR.black, top: TOP.cream, bg: BG.blush },
  a10: { hair: 'cap', skin: SKIN.tan, hairColor: HAIR.black, top: TOP.charcoal, bg: BG.cloud, cap: '#2f2d2b' },
  a11: { hair: 'straightLong', skin: SKIN.light, hairColor: HAIR.black, top: TOP.blue, bg: BG.sky },
  a12: { hair: 'curly', skin: SKIN.tan, hairColor: HAIR.darkBrown, top: TOP.cream, bg: BG.peach },
  a13: { hair: 'bun', skin: SKIN.porcelain, hairColor: HAIR.blonde, top: TOP.charcoal, bg: BG.lilac },
  a14: { hair: 'swoop', skin: SKIN.light, hairColor: HAIR.chestnut, top: TOP.rust, bg: BG.mint },
  a15: { hair: 'straightLong', skin: SKIN.warm, hairColor: HAIR.black, top: TOP.cream, bg: BG.blush, earrings: true },
  a16: { hair: 'swoop', skin: SKIN.light, hairColor: HAIR.brown, top: TOP.green, bg: BG.butter },
  a17: { hair: 'wavyLong', skin: SKIN.rich, hairColor: HAIR.black, top: TOP.cream, bg: BG.lilac },
  a18: { hair: 'curly', skin: SKIN.porcelain, hairColor: HAIR.black, top: TOP.grey, bg: BG.sky, specs: true },
  a19: { hair: 'wavyLong', skin: SKIN.tan, hairColor: HAIR.brown, top: TOP.green, bg: BG.peach, earrings: true },
  a20: { hair: 'cap', skin: SKIN.light, hairColor: HAIR.black, top: TOP.charcoal, bg: BG.mint, cap: '#f2ece2' },
  a21: { hair: 'grey', skin: SKIN.light, hairColor: HAIR.grey, top: TOP.plum, bg: BG.cloud, specs: true },
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
