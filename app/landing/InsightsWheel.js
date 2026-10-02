'use client';

import { motion, useInView, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';
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

// 411 rather than 380. At 380 the last chart reached the front with 14vh of
// the pin left, one or two clicks of a wheel, and the page carried on while
// it was still drawing itself. The extra is a hold after it, as the popup
// has; the turn itself is where it was.
const WHEEL_VH = 411;

// The screen is pinned for everything past its own height.
const SPAN = WHEEL_VH - 100;

// Beats are given in viewport heights into the pin, as in DeskScene and
// TwoWays, so changing WHEEL_VH moves the tail and leaves them where they
// are.
const beat = (vh) => vh / SPAN;

// How far this section is pulled up over the end of the one before it. Both
// stages centre their contents on a full screen, so between the popup
// leaving and the first card arriving there was 59vh of empty paper: 22 under
// the popup, 37 over the card. The overlap takes 25 of it out. It stops short
// of 37 so that nothing here is on screen while the popup is still pinned:
// at the moment it lets go, the first card is still 12vh below the fold.
// Both stages are transparent, so the overlap is only ever empty paper on
// empty paper.
const PULL_VH = 25;

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

// The section arrives with the wheel and its own name, and nothing else.
// The claim comes on the next scroll, after the reader has seen what they are
// being asked to believe: a headline that says you can see what is working,
// over a chart that is already showing it, is answering a question nobody has
// asked yet.
const HEAD_IN = [beat(11), beat(42)];
const SUB_IN = [beat(25), beat(56)];

// So the turn starts after the words have landed. It ends at 266, and
// everything from there to 311 is the hold: the last chart faces front and
// draws itself, and nothing moves until it has had a moment to be read.
const FROM = beat(62);
const TO = beat(266);

function WheelCard({ t, index, card, front }) {
  // A chart draws itself when it is the one facing front and is actually on
  // screen. The second half matters for the first card, which is in front
  // from the start: without it, it would draw while the section was still
  // below the fold.
  const ref = useRef(null);
  const visible = useInView(ref, { amount: 0.9 });

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
      ref={ref}
      style={{ y, scale, rotateX, opacity, zIndex }}
      className="tw:absolute tw:inset-x-0 tw:top-1/2 tw:-mt-[120px] tw:mx-auto tw:w-full tw:max-w-[23rem] tw:origin-center"
    >
      <Card title={card.title} sub={card.sub} stat={card.stat}>
        <card.Body active={front && visible} />
      </Card>
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

  // The section's own name comes in from the right as the screen pins, which
  // is the side it stays on.
  const kickOpacity = useTransform(enter, [0, 0.55], [0, 1]);
  const kickX = useTransform(enter, [0, 0.55], [34, 0]);

  // The claim follows on the reader's next scroll, not on arrival.
  const headOpacity = useTransform(progress, HEAD_IN, [0, 1]);
  const headY = useTransform(progress, HEAD_IN, [22, 0]);
  const subOpacity = useTransform(progress, SUB_IN, [0, 1]);
  const subY = useTransform(progress, SUB_IN, [16, 0]);

  if (reduced) {
    return (
      <section id="insights" className="tw:flex tw:min-h-[100svh] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:px-6 tw:py-24">
        <header className="tw:max-w-3xl tw:text-center">
          <p className="tw:m-0 tw:mb-6 tw:text-[clamp(0.8rem,1.1vw,0.95rem)] tw:font-bold tw:uppercase tw:tracking-[0.18em] tw:text-brand-mid">
            Insights
          </p>
          <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink">
            {copy.head}
          </h2>
          <p className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-balance tw:text-muted">{copy.sub}</p>
        </header>
        <div className="tw:grid tw:w-full tw:max-w-5xl tw:gap-4 tw:sm:grid-cols-2">
          {CARDS.map((c) => <Card key={c.key} title={c.title} sub={c.sub} stat={c.stat}><c.Body active /></Card>)}
        </div>
      </section>
    );
  }

  return (
    <div
      id="insights" ref={wrap$} className="tw:relative"
      style={{ height: `${WHEEL_VH}vh`, marginTop: `-${PULL_VH}vh` }}
    >
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
              {CARDS.map((c, i) => <WheelCard key={c.key} t={t} index={i} card={c} front={i === at} />)}
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

          <header className="tw:max-w-xl">
            {/* The section names itself, and for a scroll it is the only
                thing here. The other screens describe something the page
                invented; this one is a tab in the app, and a reader who has
                seen the word here knows where to look once they are inside.
                Set large with a wide gap under it, so it reads as a title
                rather than as a caption that lost its picture. */}
            <motion.p
              style={{ opacity: kickOpacity, x: kickX }}
              className="tw:m-0 tw:mb-7 tw:text-[clamp(0.8rem,1.1vw,0.95rem)] tw:font-bold tw:uppercase tw:tracking-[0.18em] tw:text-brand-mid"
            >
              Insights
            </motion.p>
            <motion.h2
              style={{ opacity: headOpacity, y: headY }}
              className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.7rem,4vw,3rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink"
            >
              {copy.head}
            </motion.h2>
            <motion.p
              style={{ opacity: subOpacity, y: subY }}
              className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.5vw,1.15rem)] tw:leading-relaxed tw:text-muted"
            >
              {copy.sub}
            </motion.p>
          </header>
        </div>
      </div>
    </div>
  );
}
