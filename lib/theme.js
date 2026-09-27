// Where the light-or-dark choice is kept.
//
// A cookie, not browser storage, because the cookie arrives with the request
// and the server can therefore write the attribute into the HTML. Storage can
// only be read once the page is already running, which means every route has
// to re-apply the choice for itself, in the browser, before the first paint,
// and anything that stops that script leaves the page showing the wrong theme
// with no way to tell.
//
// The value is written in both places. The cookie is the one that is read.
// Storage is kept only so that a choice made on an older build is not lost.

export const THEME_KEY = 'jt_theme';

// A year, on every path, and not sent to anyone else's site. Nothing here is
// worth protecting; it is which of two colour schemes to draw.
export function rememberTheme(value) {
  try {
    document.cookie = `${THEME_KEY}=${value};path=/;max-age=31536000;samesite=lax`;
  } catch { /* nothing to do about it */ }
  try {
    localStorage.setItem(THEME_KEY, value);
  } catch { /* private window: the cookie above is the one that matters */ }
}
