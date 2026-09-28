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

// One window of scroll for the swap, plus a little either side: enough that
// the change of copy is something you did rather than something that
// happened at you, and short enough that nobody scrolls twice wondering
// whether the page is stuck.
const STAGE_VH = 215;

// The swap, as fractions of that scroll. The first pair leaves before the
// second arrives, with just enough overlap that the stage is never empty.
const A_OUT = [0.26, 0.48];
const B_IN = [0.44, 0.70];
// The visuals follow the words rather than lead them: you read the new
// headline, then see what it is talking about.
const A_OUT_ART = [0.30, 0.54];
const B_IN_ART = [0.50, 0.78];

// Where the popup's own fill-in sequence is allowed to start. Held until the
// swap is half done, because it is in the layout from the top of the section
// and a demo that finished before you saw it has shown you nothing.
const ARM_AT = 0.42;

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
  const swap = useSpring(useSceneProgress(wrap$), {
    stiffness: 210, damping: 38, mass: 0.35, restDelta: 0.0005,
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
  const aX = useTransform(swap, A_OUT, ['0%', '-26%']);

  // Replacing.
  const bOpacity = useTransform(swap, B_IN, [0, 1]);
  const bX = useTransform(swap, B_IN, ['30%', '0%']);
  const bSubOpacity = useTransform(swap, [B_IN[0] + 0.08, B_IN[1] + 0.06], [0, 1]);

  const artAOpacity = useTransform(swap, A_OUT_ART, [1, 0]);
  const artAX = useTransform(swap, A_OUT_ART, ['0%', '-16%']);
  const artBOpacity = useTransform(swap, B_IN_ART, [0, 1]);
  const artBX = useTransform(swap, B_IN_ART, ['20%', '0%']);

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
