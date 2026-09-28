'use client';

import { motion, useTransform } from 'motion/react';
import { useRef } from 'react';
import useEnterProgress from './useEnterProgress';

// One screen of the story: the headline, its one explanatory line, and
// whatever the section shows underneath.
//
// Full height, because the page is read as seven deliberate stops rather than
// a continuous column of text. `min-h` rather than `h`, so a section whose
// visual is taller than the window grows instead of clipping.
//
// The headline arrives on the scroll rather than on a timer. A timed fade
// starts when the section crosses into view and finishes while it is still
// half a screen away, so by the time you get there it has always been there.
// Tied to the scroll it arrives as you do.
export default function Section({ head, sub, children, id, wide = false }) {
  // Measured on the header, not on the section. The header sits at the
  // section's middle, so a section-top measurement finishes the fade while
  // the words are still half a screen below the fold, which is the bug this
  // was meant to fix in the first place.
  const head$ = useRef(null);
  const enter = useEnterProgress(head$, { settle: 0.55 });

  // A headline given as an array breaks where it was written to break. It
  // also needs more room and slightly less size, because the whole point is
  // that its longest part stays on one line: at the size a one-line headline
  // uses, it would not.
  const lines = Array.isArray(head) ? head : null;

  // The line under it follows a beat behind, which is the order they are
  // read in.
  const headOpacity = useTransform(enter, [0, 0.55], [0, 1]);
  const headY = useTransform(enter, [0, 0.55], [26, 0]);
  const subOpacity = useTransform(enter, [0.25, 0.85], [0, 1]);
  const subY = useTransform(enter, [0.25, 0.85], [18, 0]);

  return (
    <section
      id={id}
      className="tw:relative tw:min-h-[100svh] tw:w-full tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:px-6 tw:py-24 tw:overflow-hidden"
    >
      <header ref={head$} className={`tw:relative tw:z-10 tw:text-center ${lines ? 'tw:max-w-5xl' : 'tw:max-w-3xl'}`}>
        <motion.h2
          style={{ opacity: headOpacity, y: headY }}
          className={`tw:m-0 tw:font-[family-name:var(--landing-display)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-ink ${
            lines
              ? 'tw:text-[clamp(1.7rem,3.6vw,2.7rem)]'
              : 'tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:text-balance'
          }`}
        >
          {lines
            ? lines.map((line) => <span key={line} className="tw:block">{line}</span>)
            : head}
        </motion.h2>
        {sub && (
          <motion.p
            style={{ opacity: subOpacity, y: subY }}
            className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-muted tw:text-balance"
          >
            {sub}
          </motion.p>
        )}
      </header>

      {children && (
        <div className={`tw:relative tw:z-10 tw:w-full ${wide ? 'tw:max-w-6xl' : 'tw:max-w-5xl'}`}>
          {children}
        </div>
      )}
    </section>
  );
}
