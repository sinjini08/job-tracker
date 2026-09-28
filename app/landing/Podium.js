'use client';

import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { byId } from './copy';
import useEnterProgress from './useEnterProgress';
import useSceneProgress from './useSceneProgress';

// Section six: the week's podium, built as you scroll.
//
// Third place rises, then second, then first, and the points climb with each
// block rather than being there when it arrives. A finished podium is a
// picture of somebody else's week. One being built is a week in progress,
// which is the thing the feature is actually for.
//
// You are second. Deliberately. First place on your own landing page is a
// boast, and the sub-heading says climb: a board you are already top of is
// nothing to climb. Five points behind is a number a reader can price, and
// the caption prices it.

const PODIUM_VH = 265;

// Tallest first, so the row reads as a podium rather than as three bars.
const PLACES = [
  {
    rank: 2, name: 'you', pts: 41, avatar: 'a20', h: 132, me: true,
    bg: 'linear-gradient(180deg,#eeeef2,#dcdce2)', ink: '#4a4a52',
    beat: [0.28, 0.60],
  },
  {
    rank: 1, name: 'mei', pts: 46, avatar: 'a3', h: 178, streak: '9d',
    bg: 'linear-gradient(180deg,#f7e6b4,#f1d68a)', ink: '#6b4e08',
    beat: [0.52, 0.88],
  },
  {
    rank: 3, name: 'rou', pts: 27, avatar: 'a11', h: 98,
    bg: 'linear-gradient(180deg,#f0d9c2,#e8c8a8)', ink: '#6d4520',
    beat: [0.08, 0.36],
  },
];

// Left to right on screen: second, first, third.
const ORDER = [0, 1, 2];

const TALLEST = Math.max(...PLACES.map((p) => p.h));
// Room above the tallest block for the avatar, name and points that ride on
// top of it.
const RIDER = 104;

// A number that counts as its block rises.
//
// Rendered from state rather than straight off the motion value, because
// motion writes styles and this is text. The state only changes when the
// rounded number does, so a forty-six point climb is forty-six renders
// spread over a screen of scroll rather than one per frame.
function Ticks({ p, to }) {
  const value = useTransform(p, (v) => Math.round(v * to));
  // Seeded from the value rather than from zero, because a reader on reduced
  // motion is handed a finished podium: their p never changes, so a change
  // handler would never fire and every score would read nought.
  const [n, setN] = useState(() => value.get());
  useMotionValueEvent(value, 'change', setN);
  return <>{n}</>;
}

function Place({ place, progress }) {
  const p = useTransform(progress, place.beat, [0, 1], { clamp: true });

  const scaleY = useTransform(p, (v) => Math.max(0.001, v));
  // The rider sits on top of the finished block, so it starts a whole block
  // lower and comes up as the block grows under it.
  const y = useTransform(p, (v) => (1 - v) * place.h);
  const opacity = useTransform(p, (v) => Math.min(1, v * 2.2));

  return (
    <div className="tw:flex tw:w-[clamp(5.5rem,17vw,7.5rem)] tw:flex-none tw:flex-col tw:items-center tw:justify-end"
      style={{ height: TALLEST + RIDER }}
    >
      <motion.div style={{ y, opacity }} className="tw:relative tw:z-10 tw:flex tw:flex-col tw:items-center tw:pb-2.5">
        {/* A plain img, as the app's own Avatar uses: these are small
            circular PNGs served straight from public/, and the optimiser
            only softens them. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/avatars/${place.avatar}.png`} alt="" width={46} height={46}
          className={`tw:h-[46px] tw:w-[46px] tw:rounded-full tw:bg-white tw:object-cover ${
            place.me ? 'tw:ring-2 tw:ring-brand' : 'tw:ring-1 tw:ring-line'
          }`}
          draggable={false}
        />
        <p className={`tw:mt-1.5 tw:mb-0 tw:text-[12.5px] tw:font-semibold ${place.me ? 'tw:text-brand' : 'tw:text-ink'}`}>
          {place.name}
          {place.streak && <span className="tw:ml-1 tw:text-[10px] tw:font-normal tw:text-muted">{place.streak}</span>}
        </p>
        <p className="tw:m-0 tw:text-[15px] tw:font-bold tw:leading-tight tw:text-ink">
          <Ticks p={p} to={place.pts} />
          <span className="tw:ml-0.5 tw:text-[10px] tw:font-semibold tw:text-muted">pts</span>
        </p>
      </motion.div>

      <div className="tw:relative tw:w-full" style={{ height: place.h }}>
        <motion.div
          style={{ scaleY, transformOrigin: 'bottom', background: place.bg }}
          className="tw:absolute tw:inset-0 tw:rounded-t-xl"
        />
        {/* The numeral sits near the base rather than inside the scaled
            block. Inside, it would be squashed flat with it; near the base,
            the block is always taller than it by the time it can be seen. */}
        <motion.span
          style={{ opacity, color: place.ink }}
          className="tw:absolute tw:inset-x-0 tw:bottom-3 tw:text-center tw:text-[19px] tw:font-bold"
        >
          {place.rank}
        </motion.span>
      </div>
    </div>
  );
}

export default function Podium() {
  const wrap$ = useRef(null);
  const stage$ = useRef(null);
  const reduced = useReducedMotion();
  const copy = byId('league');

  const enter = useEnterProgress(stage$, { settle: 0.55 });
  const scrolled = useSpring(useSceneProgress(wrap$), {
    stiffness: 170, damping: 36, mass: 0.4, restDelta: 0.0005,
  });

  // Nobody who asked for less motion should get a podium of empty plinths,
  // so they are driven by a value that is already at the end. Same code
  // path, same components: only the clock is different.
  const done = useMotionValue(1);
  const progress = reduced ? done : scrolled;

  const headOpacity = useTransform(enter, [0, 0.55], [0, 1]);
  const headY = useTransform(enter, [0, 0.55], [26, 0]);
  const subOpacity = useTransform(enter, [0.25, 0.85], [0, 1]);

  // The caption lands once the podium is built, not before: it is about the
  // gap between first and second, and there is no gap until both are up.
  const capOpacity = useTransform(progress, [0.86, 0.97], [0, 1]);

  return (
    <div id="league" ref={wrap$} className="tw:relative" style={{ height: reduced ? undefined : `${PODIUM_VH}vh` }}>
      <div
        ref={stage$}
        className={`tw:flex tw:h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:overflow-hidden tw:px-6 tw:py-16 ${
          reduced ? '' : 'tw:sticky tw:top-0'
        }`}
      >
        <motion.header
          style={reduced ? undefined : { opacity: headOpacity, y: headY }}
          className="tw:max-w-3xl tw:text-center"
        >
          <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink">
            {copy.head}
          </h2>
          <motion.p
            style={reduced ? undefined : { opacity: subOpacity }}
            className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-balance tw:text-muted"
          >
            {copy.sub}
          </motion.p>
        </motion.header>

        <div>
          <p className="tw:m-0 tw:mb-3 tw:text-center tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-[0.08em] tw:text-muted">
            This week · CS friends
          </p>
          <div className="tw:flex tw:items-end tw:justify-center tw:gap-2.5">
            {ORDER.map((i) => <Place key={PLACES[i].name} place={PLACES[i]} progress={progress} />)}
          </div>
        </div>

        <motion.p
          style={reduced ? undefined : { opacity: capOpacity }}
          className="tw:m-0 tw:max-w-md tw:text-center tw:text-[13px] tw:leading-relaxed tw:text-muted"
        >
          Five points off the top, which is one interview and a screening.
          Your friends see the points, never where you applied.
        </motion.p>
      </div>
    </div>
  );
}
