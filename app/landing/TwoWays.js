'use client';

import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useCallback, useRef, useState } from 'react';
import ChatDemo from './ChatDemo';
import PopupDemo from './PopupDemo';
import Section from './Section';
import { byId } from './copy';
import useEnterProgress from './useEnterProgress';
import useHold from './useHold';
import useSceneProgress from './useSceneProgress';
import useSteps from './useSteps';

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

// How much scroll the section is given. The screen is pinned for everything
// past its own height, so this is not page travel, it is how long the stage
// holds: near two screens' worth of wheel for the change-over, then one more
// for the popup to fill itself in and be read.
//
// 380 rather than 280. At 280 the popup was fully visible for the last 14vh
// of the pin only, one or two clicks of a wheel, and it filled itself in on
// a 2.3 second timer that had started while it was still fading in. A normal
// scroll left before it said "Saved". The extra screen is the fill and a
// hold after it; the change-over is where it was.
//
// The chat is not in this arithmetic: it plays on its own clock, and the
// page waits at the top of the pin until it has finished (CHAT_GAPS below).
const STAGE_VH = 380;

// The screen is pinned for everything past its own height.
const SPAN = STAGE_VH - 100;

// Beats are given in viewport heights into the pin, as in DeskScene, so
// changing STAGE_VH moves the tail and leaves them where they are.
const at = (vh) => vh / SPAN;

// First the chat, on its own clock: it starts as the section comes into
// view and plays through, ask, thinking, advice, confirmation, row. The
// longest gap is before the confirmation, because the advice above it is
// the one thing here worth stopping to read. The last gap is the new row's
// highlight fading, so the chat counts as finished once the sheet is still.
//
// The page is held at the top of the pin until then, so the change-over
// cannot start with the chat half done, and the first scroll after it has
// finished is the one that starts the change-over.
const CHAT_GAPS = [700, 800, 1000, 1500, 600, 1400];
const CHAT_DONE = CHAT_GAPS.length;

// The change-over. It starts almost at once, so every turn of the wheel
// while the screen is pinned moves something.
const A_OUT = [at(11), at(83)];
const B_IN = [at(72), at(155)];
const B_SUB_IN = [at(90), at(162)];
// The visuals follow the words rather than lead them: you read the new
// headline, then see what it is talking about.
const A_OUT_ART = [at(18), at(90)];
const B_IN_ART = [at(83), at(166)];

// Then the popup fills in, one field per click of a wheel or so, and saves.
// Scroll-driven rather than timed, so the page cannot move on with it half
// done: scrolling is what finishes it. The first field waits until the popup
// has fully arrived, and the save gets a longer gap than the fields, as it
// does in the real extension.
const FILL = [at(168), at(180), at(192), at(204), at(216), at(236)];
// Everything past the save, to 280, is the hold: nothing moves, so there is
// a moment to read the finished popup before the page carries on.

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

  // How many of the popup's steps the scroll has reached. Reversible, like
  // everything else here: scroll back up and the fields empty again.
  const [step, setStep] = useState(0);
  useMotionValueEvent(swap, 'change', (v) => {
    const n = FILL.filter((f) => v >= f).length;
    if (n !== step) setStep(n);
  });

  // The chat's own clock, kept here rather than inside ChatDemo because the
  // hold needs to know when it has finished.
  const { ref: chat$, step: chatStep } = useSteps(CHAT_GAPS);
  const holdAt = useCallback(() => {
    const el = wrap$.current;
    return el ? el.getBoundingClientRect().top + window.scrollY : Infinity;
  }, []);
  useHold(holdAt, chatStep >= CHAT_DONE);

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
  const bSubOpacity = useTransform(swap, B_SUB_IN, [0, 1]);

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
            ref={chat$}
            style={{ opacity: artAOpacity, x: artAX }}
            className="tw:col-start-1 tw:row-start-1 tw:w-full tw:max-w-6xl"
          >
            <ChatDemo step={chatStep} />
          </motion.div>
          <motion.div
            style={{ opacity: artBOpacity, x: artBX }}
            className="tw:col-start-1 tw:row-start-1 tw:w-full"
          >
            <PopupDemo step={step} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
