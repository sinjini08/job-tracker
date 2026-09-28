'use client';

import { useMotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * How far a section has come into view, 0 to 1, tied to the scroll.
 *
 * The difference from a whileInView tween matters here. A tween starts the
 * moment the element crosses the threshold and then runs on its own clock, so
 * on a long page it is finished while the section is still half a screen
 * away, and by the time you arrive the thing has simply always been there.
 * Driven by the scroll instead, it arrives as you arrive, and it holds still
 * if you do.
 *
 * 0 when the section's top is at the bottom of the window, 1 by the time that
 * top has risen to `settle` of the way up it. Past that it stays at 1 rather
 * than reversing, because a headline that fades out again as you read on is
 * a page fighting you.
 */
export default function useEnterProgress(ref, { settle = 0.35 } = {}) {
  const progress = useMotionValue(0);
  const seen = useRef(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const update = () => {
      const top = el.getBoundingClientRect().top;
      const from = window.innerHeight;
      const to = window.innerHeight * settle;
      const p = (from - top) / (from - to);
      const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
      // Only ever forwards.
      if (clamped > seen.current) seen.current = clamped;
      progress.set(seen.current);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [ref, progress, settle]);

  // Fonts landing can move everything below them.
  useEffect(() => {
    document.fonts?.ready?.then(() => window.dispatchEvent(new Event('scroll')));
  }, []);

  return progress;
}
