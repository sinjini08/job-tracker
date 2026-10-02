'use client';

import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * A small sequence that starts when the thing comes into view.
 *
 * The two recreations on this page are both "and then, and then": a message
 * arrives, a reply arrives, a row appears. That is a step counter on timers,
 * not an animation library, so this is a step counter on timers.
 *
 * It starts on entering view rather than on load, because a demo that has
 * already finished by the time you scroll to it has shown you nothing.
 *
 * Anyone who has asked for less motion is put at the last step immediately:
 * they get the finished state, which is the informative part, without the
 * theatre.
 *
 * `armed` holds the sequence at zero. A demo whose steps are driven from
 * somewhere else, as the popup's are by the scroll in TwoWays, keeps it off
 * so the timers never start.
 *
 * @param gaps milliseconds between steps, one per step after the first
 * @param armed hold the sequence at zero until this goes true
 * @returns { ref, step } ref goes on the element to watch
 */
export default function useSteps(gaps, { armed = true } = {}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || !armed) return undefined;
    if (reduced) { setStep(gaps.length); return undefined; }

    const timers = [];
    let at = 0;
    gaps.forEach((gap, i) => {
      at += gap;
      timers.push(setTimeout(() => setStep(i + 1), at));
    });
    return () => timers.forEach(clearTimeout);
    // gaps is a literal at the call site; depending on its identity would
    // restart the sequence on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, armed]);

  return { ref, step };
}
