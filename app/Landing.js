'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Bullseye from './Bullseye';
import Logo, { PRODUCT_NAME } from './Logo';

// The front door. The dart lands, the splash dissolves, and what's underneath
// is the sheet itself — the real one when you're signed in, a read-only demo
// when you aren't.
//
// It plays once per browser session, not once per page load: opening your own
// tracker six times on a Tuesday should not mean watching six darts.

const SEEN = 'jt_splash_seen';
const THROW_MS = 1850;   // dart lands ~1.15s, ripple clears ~1.5s, then a beat
const FADE_MS = 620;     // splash out while the sheet comes up underneath

// useLayoutEffect on the client so a returning visitor never sees one frame of
// a splash we're about to skip; useEffect on the server to keep React quiet.
const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export default function Landing({ children, hero = false }) {
  // Rendered as 'splash' so the very first paint is the animation, then
  // corrected before paint for anyone who has seen it or asked for less motion.
  const [phase, setPhase] = useState('splash');
  const [heroOpen, setHeroOpen] = useState(hero);
  const timers = useRef([]);

  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const finish = useCallback(() => {
    clear();
    setPhase((p) => (p === 'splash' ? 'opening' : p));
    timers.current.push(setTimeout(() => setPhase('done'), FADE_MS));
    try { sessionStorage.setItem(SEEN, '1'); } catch { /* private mode: play it again */ }
  }, []);

  useIso(() => {
    let skip = false;
    try { skip = sessionStorage.getItem(SEEN) === '1'; } catch { /* no storage, no memory */ }
    if (!skip && typeof matchMedia === 'function') {
      skip = matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    if (skip) {
      setPhase('done');
      try { sessionStorage.setItem(SEEN, '1'); } catch { /* fine */ }
      return;
    }
    timers.current.push(setTimeout(finish, THROW_MS));
    return clear;
  }, [finish]);

  // Anywhere on the splash, any key: let people past it.
  useEffect(() => {
    if (phase !== 'splash') return;
    const skip = () => finish();
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [phase, finish]);

  return (
    <div className={`landing landing-${phase}`}>
      <div className="landing-stage">{children}</div>

      {phase !== 'done' && (
        <div className="splash" role="status" aria-label={`${PRODUCT_NAME} is opening`}>
          <Bullseye size={188} playing className="splash-mark" />
          <p className="splash-skip" aria-hidden>Click to skip</p>
        </div>
      )}

      {hero && heroOpen && (
        <div className="hero-scrim">
          <div className="hero-card">
            <Logo size={56} badge />
            <h1>{PRODUCT_NAME}</h1>
            <p className="hero-line">
              Every application you send, in one sheet that keeps score — deadlines, follow-ups,
              and a league table you can run with your friends.
            </p>
            <div className="hero-actions">
              <a className="hero-btn primary" href="/sign-up">Start your tracker</a>
              <a className="hero-btn" href="/sign-in">Sign in</a>
            </div>
            <button type="button" className="hero-peek" onClick={() => setHeroOpen(false)}>
              Look around the demo first
            </button>
          </div>
        </div>
      )}

      {hero && !heroOpen && (
        <div className="demo-bar">
          <span className="demo-dot" aria-hidden />
          <span>You’re looking at sample data.</span>
          <a className="hero-btn primary sm" href="/sign-up">Start your own</a>
          <button type="button" className="hero-btn sm" onClick={() => setHeroOpen(true)}>Back</button>
        </div>
      )}
    </div>
  );
}
