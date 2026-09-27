'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

// Section two: the cost of section one.
//
// A grid in perspective, running away from the reader, with an application in
// some of the cells and nothing in most of them. The point it has to make is
// volume: that a job search stops being a list you can hold in your head and
// becomes a field you are somewhere in the middle of.
//
// Tilted with a CSS 3D transform rather than drawn in SVG, so the cells are
// real elements and the ones carrying an application can be styled rather
// than plotted. Masked at the edges so it fades out instead of ending on a
// hard line, which is what makes it read as receding rather than as a table.

const COLS = 18;
const ROWS = 12;

// Which cells hold an application. Fixed rather than random: a reload that
// rearranges this looks like a bug, and the pattern is doing a job. Denser at
// the bottom, where the grid is nearest, thinning towards the horizon, so it
// reads as a pile rather than a scatter.
const FILLED = new Set([
  4, 9, 17, 21, 30, 33, 41, 46, 52, 57, 63, 68, 70, 77, 84, 88, 95, 99,
  104, 110, 113, 119, 126, 131, 137, 142, 148, 151, 158, 163, 169, 174,
  180, 183, 189, 194, 196, 201, 207, 212,
]);

// A handful are the ones you have lost: still there, no longer green.
const COLD = new Set([30, 68, 99, 131, 163, 194]);

export default function GridFloor() {
  const wrap = useRef(null);
  const { scrollYProgress } = useScroll({
    target: wrap,
    offset: ['start end', 'end start'],
  });

  // The grid leans back a little further as you come down the page. Small
  // range: enough to feel alive, not enough to notice as an animation.
  const rotateX = useTransform(scrollYProgress, [0, 1], [38, 58]);
  const y = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <div
      ref={wrap}
      className="tw:relative tw:mx-auto tw:h-[clamp(300px,44vh,440px)] tw:w-full tw:[perspective:900px]"
    >
      <motion.div
        style={{
          rotateX,
          y,
          rotateZ: -14,
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          maskImage: 'radial-gradient(75% 65% at 50% 62%, #000 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(75% 65% at 50% 62%, #000 30%, transparent 100%)',
        }}
        className="tw:absolute tw:inset-[-18%] tw:grid tw:gap-px tw:[transform-style:preserve-3d]"
        aria-hidden
      >
        {Array.from({ length: COLS * ROWS }, (_, i) => (
          <span
            key={i}
            className={`tw:border-r tw:border-b tw:border-line ${
              FILLED.has(i)
                ? COLD.has(i)
                  ? 'tw:bg-line'
                  : 'tw:bg-brand-light/45'
                : ''
            }`}
          />
        ))}
      </motion.div>
    </div>
  );
}
