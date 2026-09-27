'use client';

import { useEffect, useState } from 'react';
import { rememberTheme } from '@/lib/theme';

// Light or dark, and the switch for it.
//
// No library. next-themes exists for apps with a provider tree and server
// rendering to reconcile; here the whole job is one attribute on <html>, one
// key in localStorage, and a media query for people who have never pressed
// the button. That last part matters: the default is the system setting, and
// pressing the switch is what turns a preference into a decision.
//
// The flash is handled in layout.js, which reads the choice from a cookie on
// the server and writes the attribute into the HTML. Nothing runs in the
// browser to apply it, so there is no frame in which the theme is wrong.

// What the page is actually showing, which is not the same as what was
// chosen: choosing nothing means following the system.
const current = () => {
  const set = document.documentElement.getAttribute('data-theme');
  if (set === 'dark' || set === 'light') return set;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function ThemeToggle() {
  // Rendered as light until mounted, then corrected. Reading the DOM during
  // render would differ between the server and the browser, and React would
  // throw away the markup to fix it.
  const [theme, setTheme] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTheme(current());
    setReady(true);
    // Someone who has never pressed the button should follow their system
    // when it changes under them, including while the tab is open.
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const follow = () => {
      if (!document.documentElement.hasAttribute('data-theme')) setTheme(current());
    };
    mq.addEventListener('change', follow);
    return () => mq.removeEventListener('change', follow);
  }, []);

  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    // The attribute is for this page, which is already drawn; the cookie is
    // what every page after this one will be built from.
    document.documentElement.setAttribute('data-theme', next);
    rememberTheme(next);
    setTheme(next);
  };

  const dark = theme === 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={flip}
      role="switch"
      aria-checked={dark}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      // Until the effect has run this is showing a guess, and animating from a
      // guess to the truth is a flicker. The first paint is silent.
      data-ready={ready ? '' : undefined}
    >
      <span className="theme-knob" aria-hidden>
        <svg className="theme-sun" viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9" />
        </svg>
        <svg className="theme-moon" viewBox="0 0 24 24" aria-hidden>
          <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z" />
        </svg>
      </span>
    </button>
  );
}
