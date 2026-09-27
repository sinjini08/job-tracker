'use client';

import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

// A number that counts up when it arrives on screen.
//
// Written out rather than pulled from motion's spring, because the value has
// to land on exactly the number given: a spring that settles on 38.7 and
// rounds is a stat that disagrees with itself between renders.
export default function Counter({ to, suffix = '', duration = 1100 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return undefined;
    if (reduced) { setN(to); return undefined; }

    let raf = 0;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // Ease out, so it decelerates into the number rather than stopping.
      setN(Math.round(to * (1 - (1 - t) ** 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, to, duration]);

  return <span ref={ref}>{n}{suffix}</span>;
}
