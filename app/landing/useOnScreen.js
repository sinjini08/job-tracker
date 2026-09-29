'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Whether a tall section is anywhere near the window.
 *
 * For switching a section off rather than for triggering anything: the
 * opening scene carries the wall of postings, which is most of this page's
 * DOM, and it stays mounted the whole way down. Measured on the built site,
 * leaving it rendering cost the sections below it about twenty frames a
 * second each, for a picture nobody can see any more.
 *
 * `margin` keeps a screen of slack on each side, so the switch happens well
 * outside the window and never on the frame you are looking at.
 */
export default function useOnScreen(ref, { margin = '100% 0px' } = {}) {
  const [on, setOn] = useState(true);
  const seen = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;

    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting !== seen.current) {
        seen.current = entry.isIntersecting;
        setOn(entry.isIntersecting);
      }
    }, { rootMargin: margin });

    io.observe(el);
    return () => io.disconnect();
  }, [ref, margin]);

  return on;
}
