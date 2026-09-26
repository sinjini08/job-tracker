'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { tryPlayMark } from '@/lib/mark-sound';
import { soundOn } from '@/lib/sound-pref';

// The opening: the target draws itself round its own gap, the bullseye lands,
// the dart arrives along the line it points down, and the mark shrinks away
// into the logo in the app bar as the sheet comes up underneath.
//
// The three moving pieces are the real logo, cut apart by
// scripts/build-splash.cjs rather than redrawn, so the frame it settles on is
// the mark exactly as it appears everywhere else in the app.
//
// It plays once per browser session, gets out of the way on any click or key,
// and stands still for anyone who has asked for less motion.
//
// The sound goes with it, on the beat the dart lands, which is what playMark's
// default lead is measured for. Whether it is audible is the browser's call
// rather than ours: audio cannot start in a document nobody has touched, and a
// session's first load is exactly that, so tryPlayMark reports false and the
// opening runs silent. It becomes audible on a site Chrome has built media
// engagement for, which it earns by the sound having played. So this is a
// thing that starts silent on a machine and turns itself on, rather than a
// thing that works or does not.

const SEEN = 'jt_splash_seen';
const RUN_MS = 2750;   // the whole thing, including the hand-off at the end
const FADE_MS = 600;   // the hand-off: green out, mark down into the app bar

export default function Splash() {
  // Start hidden: deciding on the server would put the overlay in the HTML for
  // people who have already seen it, and they would watch it disappear.
  const [state, setState] = useState('idle'); // idle | playing | leaving | done
  const timers = useRef([]);
  const mark = useRef(null);

  // Marked as seen when it FINISHES, not when it starts. Writing the flag up
  // front looks equivalent and isn't: React runs effects twice in development,
  // and the second run would read back the flag the first run had just written
  // and skip the whole thing.
  const finish = () => {
    try { sessionStorage.setItem(SEEN, '1'); } catch {}
    setState('done');
  };

  useEffect(() => {
    let seen = false;
    try { seen = Boolean(sessionStorage.getItem(SEEN)); } catch { /* private window */ }
    if (seen) { setState('done'); return; }

    setState('playing');
    // Fired here rather than on a timer: the sound carries its own 1.28s of
    // silence before the impact, so it has to start when the animation does.
    // Nothing waits on it and a blocked context costs nothing.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!still && soundOn()) tryPlayMark();
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms));
    at(RUN_MS - FADE_MS, () => setState('leaving'));
    at(RUN_MS, finish);
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);

  // Where the mark is headed. The app bar's logo is the same artwork at 24px,
  // so the opening can hand off to it rather than just dissolving. Measured at
  // run time rather than written down, because the app bar hides its brand on
  // a narrow window and the mark would otherwise fly off to nothing.
  useLayoutEffect(() => {
    if (state !== 'playing' || !mark.current) return;
    const el = mark.current;
    const to = document.querySelector('.brand img')?.getBoundingClientRect();
    if (!to || !to.width) return;              // no logo on screen: plain fade
    const from = el.getBoundingClientRect();
    el.style.setProperty('--to-x', `${(to.left + to.width / 2) - (from.left + from.width / 2)}px`);
    el.style.setProperty('--to-y', `${(to.top + to.height / 2) - (from.top + from.height / 2)}px`);
    el.style.setProperty('--to-s', String(to.width / from.width));
  }, [state]);

  // Anything the person does means they would rather get on with it.
  useEffect(() => {
    if (state !== 'playing') return;
    const skip = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setState('leaving');
      timers.current.push(setTimeout(finish, FADE_MS));
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
    return () => {
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [state]);

  if (state === 'idle' || state === 'done') return null;

  return (
    <div className={`splash ${state === 'leaving' ? 'out' : ''}`} role="presentation" aria-hidden>
      <div className="splash-mark" ref={mark}>
        {/* Painted back to front. The dart goes under the dot so that, once it
            lands, the dot covers the point build-splash.cjs adds back onto the
            shaft and the three layers are the mark again, pixel for pixel. */}
        <div className="sp-stack">
          <span className="sp-flash" />
          {/* The ripple goes under the artwork, not over it. On top it crosses
              the dart's own shaft and carries on through the break in the ring,
              which draws a line where the mark deliberately has none. */}
          <span className="sp-ring" />
          <img className="sp-dart" src="/brand/splash-dart.png" alt="" draggable={false} />
          <img className="sp-dot" src="/brand/splash-dot.png" alt="" draggable={false} />
          <img className="sp-rings" src="/brand/splash-rings.png" alt="" draggable={false} />
        </div>
      </div>
    </div>
  );
}
