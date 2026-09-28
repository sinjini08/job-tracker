'use client';

import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import ChatDemo from './ChatDemo';
import PopupDemo from './PopupDemo';
import Section from './Section';
import { byId } from './copy';
import useEnterProgress from './useEnterProgress';
import useSceneProgress from './useSceneProgress';

// Sections three and four, on one stage.
//
// They were two screens asking the same question twice: here is how your
// applications file themselves, and here is how they file themselves if you
// do not use an assistant. Scrolled past separately they read as two
// features. Swapped in place they read as what they are, which is one job
// with two ways in.
//
// So the stage holds still and its contents change over: the assistant's
// words leave to the left, the extension's arrive from the right, and the
// chat is replaced by the popup that does the same thing in one click.

// How much scroll the swap is given. The screen is pinned for all of it, so
// this is not page travel, it is how long the change-over takes: near two
// screens' worth of wheel for one pair of lines to leave and the next to
// arrive. Slow on purpose. The swap is the one thing this section does, and
// at a shorter length it was over before it registered as a transition.
const STAGE_VH = 280;

// The swap, as fractions of that scroll. It starts almost at once and runs
// almost to the end, so every turn of the wheel while the screen is pinned
// moves it and none of them do nothing. The last stretch is deliberately
// left over: the popup has just finished filling itself in and deserves a
// beat before the page moves on.
const A_OUT = [0.06, 0.46];
const B_IN = [0.40, 0.86];
// The visuals follow the words rather than lead them: you read the new
// headline, then see what it is talking about.
const A_OUT_ART = [0.10, 0.50];
const B_IN_ART = [0.46, 0.92];

// Where the popup's own fill-in sequence is allowed to start. Held until the
// swap is well under way, because it is in the layout from the top of the
// section and a demo that finished before you saw it has shown you nothing.
const ARM_AT = 0.40;

function Words({ head, sub, opacity, subOpacity, x, y, subY }) {
  return (
    <motion.header
      style={{ opacity, x }}
      className="tw:col-start-1 tw:row-start-1 tw:max-w-3xl tw:text-center"
    >
      <motion.h2
        style={{ y }}
        className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink"
      >
        {head}
      </motion.h2>
      <motion.p
        style={{ opacity: subOpacity, y: subY }}
        className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-balance tw:text-muted"
      >
        {sub}
      </motion.p>
    </motion.header>
  );
}

export default function TwoWays() {
  const wrap$ = useRef(null);
  const stage$ = useRef(null);
  const reduced = useReducedMotion();
  const a = byId('assistant');
  const b = byId('extension');

  // Two clocks. `enter` is the section arriving, and drives the first
  // headline in the same way every other section's does. `swap` is the
  // scroll spent standing still on the stage, and drives the change-over.
  const enter = useEnterProgress(stage$, { settle: 0.55 });
  // Softer than the opening camera's spring. That one had to stay under a
  // finger pushing into a screen; this one is a dissolve, and a dissolve
  // that snaps is a cut.
  const swap = useSpring(useSceneProgress(wrap$), {
    stiffness: 150, damping: 34, mass: 0.4, restDelta: 0.0005,
  });

  const [armed, setArmed] = useState(false);
  useMotionValueEvent(swap, 'change', (v) => {
    if (v >= ARM_AT && !armed) setArmed(true);
  });

  // Arriving.
  const aIn = useTransform(enter, [0, 0.55], [0, 1]);
  const aInY = useTransform(enter, [0, 0.55], [26, 0]);
  const aSubIn = useTransform(enter, [0.25, 0.85], [0, 1]);
  const aSubY = useTransform(enter, [0.25, 0.85], [18, 0]);

  // Leaving. Opacity is the two multiplied, so the words cannot come back
  // brighter than they arrived.
  const aGone = useTransform(swap, A_OUT, [1, 0]);
  const aOpacity = useTransform([aIn, aGone], ([i, g]) => i * g);
  const aSubOpacity = useTransform([aSubIn, aGone], ([i, g]) => i * g);
  const aX = useTransform(swap, A_OUT, ['0%', '-20%']);

  // Replacing.
  const bOpacity = useTransform(swap, B_IN, [0, 1]);
  const bX = useTransform(swap, B_IN, ['24%', '0%']);
  const bSubOpacity = useTransform(swap, [B_IN[0] + 0.10, B_IN[1] + 0.04], [0, 1]);

  const artAOpacity = useTransform(swap, A_OUT_ART, [1, 0]);
  const artAX = useTransform(swap, A_OUT_ART, ['0%', '-12%']);
  const artBOpacity = useTransform(swap, B_IN_ART, [0, 1]);
  const artBX = useTransform(swap, B_IN_ART, ['16%', '0%']);

  // Anyone who has asked for less motion gets the two stops back, in order,
  // with no stage and no scroll spent on a change-over they did not ask to
  // watch. The page still says both things; it just says them one under the
  // other.
  if (reduced) {
    return (
      <>
        <Section id="assistant" {...a} wide><ChatDemo /></Section>
        <Section id="extension" {...b}><PopupDemo /></Section>
      </>
    );
  }

  return (
    <div id="assistant" ref={wrap$} className="tw:relative" style={{ height: `${STAGE_VH}vh` }}>
      <div
        ref={stage$}
        className="tw:sticky tw:top-0 tw:flex tw:h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-8 tw:overflow-hidden tw:px-6 tw:py-16"
      >
        {/* Both pairs live in the same grid cell, so the stage is as tall as
            the taller of them and neither moves when the other leaves. */}
        <div className="tw:relative tw:z-10 tw:grid tw:w-full tw:place-items-center">
          <Words
            head={a.head} sub={a.sub}
            opacity={aOpacity} subOpacity={aSubOpacity} x={aX} y={aInY} subY={aSubY}
          />
          <Words
            head={b.head} sub={b.sub}
            opacity={bOpacity} subOpacity={bSubOpacity} x={bX} y={0} subY={0}
          />
        </div>

        <div className="tw:relative tw:z-10 tw:grid tw:w-full tw:place-items-center">
          <motion.div
            style={{ opacity: artAOpacity, x: artAX }}
            className="tw:col-start-1 tw:row-start-1 tw:w-full tw:max-w-6xl"
          >
            <ChatDemo />
          </motion.div>
          <motion.div
            style={{ opacity: artBOpacity, x: artBX }}
            className="tw:col-start-1 tw:row-start-1 tw:w-full"
          >
            <PopupDemo armed={armed} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
