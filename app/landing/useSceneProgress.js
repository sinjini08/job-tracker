'use client';

import { useMotionValue } from 'motion/react';
import { useEffect, useLayoutEffect, useRef } from 'react';

// How far through a tall sticky section the page has scrolled, 0 to 1.
//
// motion's own useScroll with a target did not measure this layout: it
// reported zero the whole way down a 300vh section whose only child is
// sticky. Rather than work out why, this measures the element and reads
// window.scrollY, which is two lines of arithmetic and cannot be wrong about
// a layout it just measured itself.
//
// Remeasured on resize and whenever the document's height changes, because
// the section above this one can reflow when a font lands and move it.
export default function useSceneProgress(ref) {
  const progress = useMotionValue(0);
  const box = useRef({ top: 0, span: 1 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      // How far the page scrolls while the sticky child is pinned.
      const span = Math.max(1, el.offsetHeight - window.innerHeight);
      box.current = { top, span };
    };
    const update = () => {
      const { top, span } = box.current;
      const p = (window.scrollY - top) / span;
      progress.set(p < 0 ? 0 : p > 1 ? 1 : p);
    };

    measure();
    update();

    const onScroll = () => update();
    const onResize = () => { measure(); update(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [ref, progress]);

  // Fonts land after first paint and can move everything below them.
  useEffect(() => {
    document.fonts?.ready?.then(() => window.dispatchEvent(new Event('resize')));
  }, []);

  return progress;
}
