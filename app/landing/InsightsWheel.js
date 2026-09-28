'use client';

import { motion, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { CARDS, Card } from './insight-cards';
import { byId } from './copy';
import useEnterProgress from './useEnterProgress';
import useSceneProgress from './useSceneProgress';

// The insights section: the claim on the right, the evidence turning on the
// left.
//
// Split, because the headline is one sentence and the proof is four pictures.
// Putting them in a column meant either a headline you scroll away from
// before you reach the charts, or four charts squeezed onto one screen at a
// size nobody can read. Side by side the sentence stays put and the pictures
// take turns.
//
// A wheel rather than a stack of cards that cross-fade. The cards are four
// answers to the same question and a wheel says so: they are all there, you
// are looking at one of them, the next is already coming. A fade would say
// each replaces the last.

const WHEEL_VH = 355;

// Radians between neighbouring cards on the wheel. At just over a radian the
// card behind is clearly behind: two thirds the size, most of the way faded,
// and the one after it is gone.
const SPREAD = 1.05;

// How far the wheel's axis sits from the reader. Large enough that the cards
// travel further vertically than they shrink, so it reads as a rolodex
// turning rather than as cards zooming, and large enough that the card
// behind clears the top of the front one instead of sitting across its
// title.
const RADIUS = 245;

// The turn does not start the instant the section pins and does not finish on
// the last pixel of it: a beat at each end to arrive and to land.
const FROM = 0.10;
const TO = 0.94;

function WheelCard({ t, index, card }) {
  // Where this card sits on the wheel right now. Zero is front and centre.
  const angle = useTransform(t, (v) => (index - v) * SPREAD);

  const y = useTransform(angle, (a) => Math.sin(a) * RADIUS);
  const scale = useTransform(angle, (a) => 0.66 + 0.34 * Math.max(0, Math.cos(a)));
  const rotateX = useTransform(angle, (a) => -(a * 180) / Math.PI * 0.8);
  // Faint well before it is side-on. The card behind should read as "there
  // is more", not as a second thing to look at: at a full step off centre it
  // is under half opacity, and by two steps it is gone.
  const opacity = useTransform(angle, (a) => {
    const c = Math.cos(a);
    return c <= 0.25 ? 0 : Math.min(1, (c - 0.25) / 0.55);
  });
  // The front card has to be on top of its neighbours, and which card is in
  // front changes as the wheel turns.
  const zIndex = useTransform(angle, (a) => Math.round(Math.cos(a) * 100));

  return (
    <motion.div
      style={{ y, scale, rotateX, opacity, zIndex }}
      className="tw:absolute tw:inset-x-0 tw:top-1/2 tw:-mt-[120px] tw:mx-auto tw:w-full tw:max-w-[23rem] tw:origin-center"
    >
      <Card title={card.title} sub={card.sub}>{card.body}</Card>
    </motion.div>
  );
}

export default function InsightsWheel() {
  const wrap$ = useRef(null);
  const stage$ = useRef(null);
  const reduced = useReducedMotion();
  const copy = byId('insights');

  const enter = useEnterProgress(stage$, { settle: 0.55 });
  const progress = useSpring(useSceneProgress(wrap$), {
    stiffness: 170, damping: 36, mass: 0.4, restDelta: 0.0005,
  });

  // Scroll position becomes a place on the wheel: 0 is the first card facing
  // front, 3 is the last.
  const t = useTransform(progress, [FROM, TO], [0, CARDS.length - 1], { clamp: true });

  const [at, setAt] = useState(0);
  useMotionValueEvent(t, 'change', (v) => {
    const i = Math.min(CARDS.length - 1, Math.max(0, Math.round(v)));
    if (i !== at) setAt(i);
  });

  // The headline comes in from the right, which is the side it stays on.
  const headOpacity = useTransform(enter, [0, 0.55], [0, 1]);
  const headX = useTransform(enter, [0, 0.55], [34, 0]);
  const subOpacity = useTransform(enter, [0.3, 0.9], [0, 1]);

  if (reduced) {
    return (
      <section id="insights" className="tw:flex tw:min-h-[100svh] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:px-6 tw:py-24">
        <header className="tw:max-w-3xl tw:text-center">
          <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink">
            {copy.head}
          </h2>
          <p className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-balance tw:text-muted">{copy.sub}</p>
        </header>
        <div className="tw:grid tw:w-full tw:max-w-5xl tw:gap-4 tw:sm:grid-cols-2">
          {CARDS.map((c) => <Card key={c.key} title={c.title} sub={c.sub}>{c.body}</Card>)}
        </div>
      </section>
    );
  }

  return (
    <div id="insights" ref={wrap$} className="tw:relative" style={{ height: `${WHEEL_VH}vh` }}>
      <div
        ref={stage$}
        className="tw:sticky tw:top-0 tw:flex tw:h-[100svh] tw:items-center tw:overflow-hidden tw:px-6 tw:py-16"
      >
        <div className="tw:mx-auto tw:grid tw:w-full tw:max-w-6xl tw:items-center tw:gap-10 tw:md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* The wheel. Perspective lives here rather than on the cards, so
              all four turn about the same axis instead of each about its
              own. */}
          <div className="tw:flex tw:flex-col tw:items-center tw:gap-5">
            {/* The cards are direct children of the element carrying the
                perspective, and nothing here sets preserve-3d. Under
                preserve-3d the browser paints by 3D position and ignores
                z-index, so the tilted card behind came through the front
                card's title. Flat, ordinary stacking applies and the card
                facing front is the one on top. */}
            <div className="tw:relative tw:h-[420px] tw:w-full" style={{ perspective: '1100px' }}>
              {CARDS.map((c, i) => <WheelCard key={c.key} t={t} index={i} card={c} />)}
            </div>

            {/* Four charts, and you are on this one. Under the wheel rather
                than inside it: inside, the cards turning past the bottom of
                the arc covered it up. Without it the wheel could be an
                endless reel and there would be no reason to keep turning. */}
            <div className="tw:flex tw:gap-2" aria-hidden>
              {CARDS.map((c, i) => (
                <i
                  key={c.key}
                  className={`tw:block tw:h-1.5 tw:rounded-full tw:transition-all tw:duration-300 ${
                    i === at ? 'tw:w-5 tw:bg-brand' : 'tw:w-1.5 tw:bg-line'
                  }`}
                />
              ))}
            </div>
          </div>

          <motion.header style={{ opacity: headOpacity, x: headX }} className="tw:max-w-xl">
            <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.7rem,4vw,3rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink">
              {copy.head}
            </h2>
            <motion.p
              style={{ opacity: subOpacity }}
              className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.5vw,1.15rem)] tw:leading-relaxed tw:text-muted"
            >
              {copy.sub}
            </motion.p>
          </motion.header>
        </div>
      </div>
    </div>
  );
}
