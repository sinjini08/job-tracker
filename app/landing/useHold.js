'use client';

import { useEffect, useRef } from 'react';

// Holds the page at one scroll position until `done`.
//
// For the stages that play on their own clock rather than the scroll's: the
// chat filing a row, the league throwing its party. A fast scroll could reach
// the next thing before they had finished, so the page stops at `limit()`
// until they have, and the next scroll after that carries on as normal.
//
// How: while a hold is waiting and the reader is near it, the page ends
// there. <main> is clipped to the hold point plus one window, so there is
// nothing below to scroll into, and the browser stops dead at the bottom of
// what is left. The first version let the scroll happen and put it back,
// which worked but showed: a fast flick or a trackpad's momentum carried the
// page past the point for a frame or two, the green of the closing screen
// showed at the bottom, and then it jumped back. A page that ends cannot be
// scrolled past by anything, wheel, trackpad, touch, keys or scrollbar, so
// there is nothing to put back.
//
// `overflow: clip` rather than `hidden` because `hidden` makes <main> a
// scroll container and every sticky stage inside it stops sticking. The
// root's overscroll is switched off while clipped, so the bottom of the
// shortened page does not bounce and show whatever is behind it.
//
// Rules, so it never takes anyone somewhere they did not mean to go:
// - Only once the reader has touched a wheel, a screen, a key or the mouse.
//   A browser restoring a scroll position, or a link to a section further
//   down, has already put them where they are going, and is left alone.
// - Only on the way in from above. Someone already below the point is never
//   pulled back to it, and scrolling up is never held.
// - Only within two windows of the point, so the page is not short, and its
//   scrollbar wrong, while the reader is nowhere near it.
//
// `limit` is a function rather than a number because the point moves with the
// layout; it is read fresh every time.

const holds = new Set();
let engaged = false;
// The hold doing the clipping, if any. It is never marked passed: while it
// clips, the page cannot be below it, whatever a rounding error says.
let active = null;

const NEAR = 2;

function apply() {
  const main = document.querySelector('main');
  if (!main) return;
  const root = document.documentElement;
  const y = window.scrollY;
  const vh = window.innerHeight;

  let at = Infinity;
  let by = null;
  if (engaged) {
    holds.forEach((h) => {
      if (h.done || h.passed) return;
      const p = h.limit();
      if (y > p + 1 && h !== active) { h.passed = true; return; }
      if (y >= p - NEAR * vh && p < at) { at = p; by = h; }
    });
  }
  active = by;

  if (!by) {
    main.style.maxHeight = '';
    main.style.overflow = '';
    root.style.overscrollBehaviorY = '';
    return;
  }
  // Anything after <main> still adds to the page's height, so it comes off
  // the clip: the furthest the page can scroll is then exactly the point.
  const box = main.getBoundingClientRect();
  const below = root.scrollHeight - (box.bottom + y);
  main.style.maxHeight = `${Math.max(0, Math.round(at + vh - (box.top + y) - below))}px`;
  main.style.overflow = 'clip';
  root.style.overscrollBehaviorY = 'none';
}

function engage() {
  if (engaged) return;
  engaged = true;
  apply();
}

// The pointer moving counts too, so the hold is already armed by the time a
// first flick arrives: armed by the flick itself, the browser can have moved
// the page before the clip lands.
const INPUT = ['wheel', 'touchstart', 'keydown', 'mousedown', 'pointermove'];

function listen(on) {
  const fn = on ? window.addEventListener : window.removeEventListener;
  INPUT.forEach((type) => fn(type, engage, { passive: true }));
  fn('scroll', apply, { passive: true });
  fn('resize', apply);
}

export default function useHold(limit, done) {
  const hold = useRef(null);

  useEffect(() => {
    const h = { limit: () => limit(), done: false, passed: false };
    hold.current = h;
    if (holds.size === 0) listen(true);
    holds.add(h);
    apply();
    return () => {
      holds.delete(h);
      if (holds.size === 0) listen(false);
      apply();
    };
  }, [limit]);

  useEffect(() => {
    if (!hold.current) return;
    hold.current.done = done;
    apply();
  }, [done]);
}
