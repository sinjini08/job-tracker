// Whether the app is allowed to make a noise.
//
// One key in localStorage, read directly rather than through React: the
// celebration reads it inside an effect, and the settings page writes it on a
// click. Nothing else needs to watch it change.
//
// It defaults to on. There are two sounds, the opening and the win chime,
// both under a second, and the win fires at most once a day.

const KEY = 'jt_sound';

export function soundOn() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundOn(on) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private window: it lasts the session */ }
}
