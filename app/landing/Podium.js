'use client';

import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';
import { byId } from './copy';
import useEnterProgress from './useEnterProgress';
import useHold from './useHold';
import useSteps from './useSteps';

// Section six: the week's board, then the week's podium.
//
// Two scenes, one after the other, rather than one shape turning into
// another. The board comes first because it is what a reader recognises and
// it can show points arriving: three scores land, each named by what earned
// it, and the bars grow by that much. Then the board steps aside and a
// podium rises out of the floor in its place, third, second, first, and the
// three of them drop onto it. A burst of confetti from behind first place,
// the cup, and the line about the gap.
//
// You are second. Deliberately. First place on your own landing page is a
// boast, and the sub-heading says climb: a board you are already top of is
// nothing to climb.
//
// It plays itself, once, when it arrives. The other stages on this page are
// scrubbed by the scroll, which suits a camera move and a change of copy; it
// does not suit this. A celebration you have to crank by hand is not one.

// The board's three, in its order. `from` is where the week stood; `add` is
// what lands while you watch, on the app's real scale.
const PEOPLE = [
  { key: 'mei', avatar: 'a3', from: 44, add: { pts: 2, label: 'Screening' }, place: 1 },
  { key: 'you', avatar: 'a20', from: 38, add: { pts: 3, label: 'Interview' }, place: 2, me: true },
  { key: 'rou', avatar: 'a11', from: 26, add: { pts: 1, label: 'Applied' }, place: 3 },
];
const final = (p) => p.from + p.add.pts;

// Yours lands first: it is your page.
const ADD_ORDER = ['you', 'mei', 'rou'];

// The run, as steps: 1 the board fills, 2 to 4 the three scores land, 5 the
// board leaves, 6 the podium rises, 7 the party, 8 most of the confetti is
// down and the page may move on. Each gap is the wait before its step.
const GAPS = [150, 950, 450, 450, 1300, 380, 1350, 1800];
const S = { BOARD: 1, ADD: 2, OUT: 5, RISE: 6, PARTY: 7, DONE: 8 };

// No pinned stretch. The page waits at the point where this screen fills
// the window until the party is over (useHold, in the component), and the
// first scroll after that goes straight on to the closing screen. A pinned
// stretch after it would be scroll that does nothing, which reads as a page
// that has stopped working.

// The bars run to 50 rather than to the leader's score, so first place is a
// long bar rather than a full one: there is still room to climb.
const BAR_MAX = 50;

const EASE = [0.22, 1, 0.36, 1];

// How far this section is pulled up over the end of the insights screen.
// Both centre their contents on a full screen, so on a 1034px window there
// was 52vh of empty paper between the chart dots leaving and this headline
// arriving: 28 under the dots, 23 over the headline. 18 comes out, which
// leaves the same 34vh as the gap above insights and the headline still 5vh
// below the fold when insights lets go.
//
// The empty paper is the window's height less contents of fixed size, so on
// a short window there is far less of it, and at 800px a full 18vh pull put
// the headline 4vh onto the screen while insights was still holding. So the
// pull is the window's surplus over 800px, up to 18vh, and nothing below
// that.
const PULL_VH = 18;
const PULL = `min(${PULL_VH}vh, max(0px, 100vh - 800px))`;

// The stage, in its own pixels, so both scenes are laid out as numbers.
const STAGE = { w: 380, h: 344 };
const COL_W = 108;
const COL_X = { 2: 12, 1: 136, 3: 260 };
const PLINTH_H = { 1: 176, 2: 130, 3: 96 };
// Third rises first and first last, so the podium still builds to something.
const RISE_DELAY = { 3: 0, 2: 0.14, 1: 0.28 };

// Medal colours belong to the podium only. The board is the app's green for
// everyone: a board that is already gold, silver and bronze has given away
// where it is going.
const MEDAL = {
  1: { bg: 'linear-gradient(180deg,#f7e6b4,#f1d68a)', ink: '#6b4e08' },
  2: { bg: 'linear-gradient(180deg,#eeeef2,#dcdce2)', ink: '#4a4a52' },
  3: { bg: 'linear-gradient(180deg,#f0d9c2,#e8c8a8)', ink: '#6d4520' },
};

const CONFETTI = ['#1f9d55', '#69b57f', '#f1d68a', '#e0651f', '#2a78d6', '#d1478c', '#1d5c36'];

// Scattered, but worked out rather than rolled: the same pieces every time,
// from each piece's own index. Math.random in a render body is a different
// page on the server than in the browser.
const spread = (i, salt) => {
  const x = Math.sin((i + 1) * salt) * 43758.5453;
  return x - Math.floor(x);
};

// A burst rather than a rain over the whole screen: thrown up and out from
// behind first place, in a fan from 160 to 20 degrees above the floor, then
// falling.
const BITS = Array.from({ length: 46 }, (_, i) => {
  const a = ((-160 + spread(i, 12.9898) * 140) * Math.PI) / 180;
  const v = 120 + spread(i, 78.233) * 160;
  const w = 5 + spread(i, 63.727) * 4;
  const round = spread(i, 11.482) > 0.6;
  return {
    id: i,
    dx: Math.cos(a) * v,
    dy: Math.sin(a) * v,
    fall: 180 + spread(i, 45.164) * 140,
    spin: (spread(i, 27.311) - 0.5) * 900,
    color: CONFETTI[i % CONFETTI.length],
    w,
    h: round ? w : w * 1.7,
    round,
    duration: 1.6 + spread(i, 94.673) * 0.8,
    delay: spread(i, 33.113) * 0.1,
  };
});

function Face({ avatar, size, me }) {
  return (
    // A plain img, as the app's own Avatar uses: these are small circular
    // PNGs served straight from public/, and the optimiser only softens them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/avatars/${avatar}.png`} alt="" width={size} height={size} draggable={false}
      className="tw:block tw:flex-none tw:rounded-full tw:bg-white tw:object-cover"
      style={{ width: size, height: size, boxShadow: me ? '0 0 0 2px #2e7d46' : '0 0 0 1px #e4e4db' }}
    />
  );
}

// A number that rolls to its new value and lands on the exact integer.
function Tally({ value }) {
  const mv = useMotionValue(value);
  const shown = useTransform(mv, (v) => Math.round(v));
  useEffect(() => {
    const run = animate(mv, value, { duration: 0.7, ease: EASE });
    return () => run.stop();
  }, [mv, value]);
  return <motion.span className="tw:tabular-nums">{shown}</motion.span>;
}

// The winner's cup. Drawn here rather than pulled from the app's Icons,
// which carry the app's own classes and would arrive unstyled on a page that
// prefixes everything.
function Trophy() {
  return (
    <svg viewBox="0 0 24 24" className="tw:h-7 tw:w-7" fill="none" aria-hidden>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" fill="#f1d68a" stroke="#c79a2a" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 5.5H4.8a3.2 3.2 0 0 0 3.2 3.2M17 5.5h2.2a3.2 3.2 0 0 1-3.2 3.2" stroke="#c79a2a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M12 14v3m-3 3h6" stroke="#c79a2a" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M9 20h6" stroke="#c79a2a" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function Row({ p, rank, step }) {
  const shown = step >= S.BOARD;
  const added = step >= S.ADD + ADD_ORDER.indexOf(p.key);
  const pts = added ? final(p) : p.from;

  return (
    <div className={`tw:relative tw:grid tw:grid-cols-[14px_40px_1fr_62px] tw:items-center tw:gap-3 tw:rounded-xl tw:px-3 tw:py-2.5 ${p.me ? 'tw:bg-tint' : ''}`}>
      <span className="tw:text-[13px] tw:font-semibold tw:tabular-nums tw:text-muted">{rank}</span>
      <Face avatar={p.avatar} size={38} me={p.me} />
      <div className="tw:min-w-0">
        <p className={`tw:m-0 tw:text-[14px] tw:font-semibold ${p.me ? 'tw:text-brand' : 'tw:text-ink'}`}>{p.key}</p>
        <div className="tw:mt-1.5 tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-[#eceee7]">
          <motion.i
            className="tw:block tw:h-full tw:rounded-full"
            style={{ background: 'linear-gradient(90deg,#4a9463,#1d5c36)' }}
            initial={{ width: '0%' }}
            animate={{ width: shown ? `${(pts / BAR_MAX) * 100}%` : '0%' }}
            transition={added
              ? { duration: 0.6, ease: EASE }
              : { duration: 0.9, ease: EASE, delay: 0.1 + rank * 0.08 }}
          />
        </div>
      </div>
      <span className="tw:text-right tw:text-[17px] tw:font-bold tw:text-ink">
        <Tally value={shown ? pts : 0} />
        <span className="tw:ml-1 tw:text-[11px] tw:font-medium tw:text-muted">pts</span>
      </span>

      {/* What just scored, named by its kind and never by its company:
          that is what a friend actually sees. */}
      <AnimatePresence>
        {added && (
          <motion.span
            key="pop"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, 0, -4, -14], scale: 1 }}
            transition={{ duration: 1.5, times: [0, 0.15, 0.72, 1], ease: 'easeOut' }}
            className="tw:pointer-events-none tw:absolute tw:-top-3 tw:right-3 tw:z-10 tw:whitespace-nowrap tw:rounded-full tw:bg-brand tw:px-2.5 tw:py-1 tw:text-[11.5px] tw:font-semibold tw:text-white tw:shadow-lg tw:shadow-brand/25"
          >
            +{p.add.pts} {p.add.label}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Column({ p, step }) {
  const up = step >= S.RISE;
  const party = step >= S.PARTY;
  const m = MEDAL[p.place];
  const first = p.place === 1;
  const delay = RISE_DELAY[p.place];

  return (
    <div className="tw:absolute tw:bottom-0 tw:flex tw:flex-col tw:items-center" style={{ left: COL_X[p.place], width: COL_W }}>
      {/* The person, who drops onto the plinth once it has landed. */}
      <motion.div
        className="tw:flex tw:flex-col tw:items-center"
        initial={false}
        animate={up ? { opacity: 1, y: 0 } : { opacity: 0, y: -30 }}
        transition={up ? { type: 'spring', stiffness: 420, damping: 20, delay: delay + 0.45 } : { duration: 0.15 }}
      >
        {/* The cup's place is kept whether it has arrived or not, so its
            arrival moves nothing. */}
        {first && (
          <span className="tw:mb-0.5 tw:block tw:h-7">
            <AnimatePresence>
              {party && (
                <motion.span
                  className="tw:block"
                  initial={{ opacity: 0, scale: 0.3, y: 14, rotate: -18 }}
                  animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 13, delay: 0.15 }}
                >
                  <Trophy />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        )}
        <Face avatar={p.avatar} size={46} me={p.me} />
        <p className={`tw:m-0 tw:mt-0.5 tw:text-[12.5px] tw:font-semibold tw:leading-[17px] ${p.me ? 'tw:text-brand' : 'tw:text-ink'}`}>{p.key}</p>
        <p className="tw:m-0 tw:mb-2.5 tw:text-[15px] tw:font-bold tw:leading-[19px] tw:tabular-nums tw:text-ink">
          {final(p)}
          <span className="tw:ml-0.5 tw:text-[10px] tw:font-semibold tw:text-muted">pts</span>
        </p>
      </motion.div>

      {/* The plinth, rising out of the floor. Clipped below the floor only,
          so it comes up through it rather than fading in over it. */}
      <div className="tw:w-full" style={{ height: PLINTH_H[p.place], clipPath: 'inset(-40px -40px 0 -40px)' }}>
        <motion.div
          className="tw:flex tw:h-full tw:w-full tw:items-end tw:justify-center tw:rounded-t-[14px] tw:pb-[15px]"
          style={{ background: m.bg }}
          initial={false}
          animate={{ y: up ? '0%' : '102%' }}
          transition={{ duration: 0.7, ease: EASE, delay: up ? delay : 0 }}
        >
          <span className="tw:text-[19px] tw:font-bold tw:leading-[22px]" style={{ color: m.ink }}>
            {p.place}
          </span>
        </motion.div>
      </div>
    </div>
  );
}

function Burst() {
  return (
    <div
      aria-hidden
      className="tw:pointer-events-none tw:absolute"
      style={{ left: COL_X[1] + COL_W / 2, top: STAGE.h - PLINTH_H[1] }}
    >
      {BITS.map((b) => (
        <motion.i
          key={b.id}
          className="tw:absolute tw:block"
          style={{
            width: b.w, height: b.h, marginLeft: -b.w / 2, marginTop: -b.h / 2,
            background: b.color, borderRadius: b.round ? 999 : 1.5,
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: [0, b.dx, b.dx * 1.3],
            y: [0, b.dy, b.dy + b.fall],
            rotate: [0, b.spin * 0.4, b.spin],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: b.duration, delay: b.delay, times: [0, 0.3, 1], ease: ['easeOut', 'easeIn'] }}
        />
      ))}
    </div>
  );
}

export default function Podium() {
  const wrap$ = useRef(null);
  const head$ = useRef(null);
  const reduced = useReducedMotion();
  const copy = byId('league');

  // The headline still arrives on the scroll, as every other headline on the
  // page does. Measured on the header rather than the section, because the
  // header sits at the section's middle.
  const enter = useEnterProgress(head$, { settle: 0.55 });
  const headOpacity = useTransform(enter, [0, 0.55], [0, 1]);
  const headY = useTransform(enter, [0, 0.55], [26, 0]);
  const subOpacity = useTransform(enter, [0.25, 0.85], [0, 1]);

  // Starts when the stage is half in view, once: a board that re-runs every
  // time you scroll back past it is a page that will not settle. Anyone who
  // asked for less motion is put at the end, the podium with no party.
  const { ref, step } = useSteps(GAPS);
  const boardGone = step >= S.OUT;
  const party = step >= S.PARTY;
  // Held where this screen fills the window, until the confetti is down.
  const holdAt = useCallback(() => {
    const el = wrap$.current;
    return el ? el.getBoundingClientRect().top + window.scrollY : Infinity;
  }, []);
  useHold(holdAt, step >= S.DONE);

  return (
    <section
      id="league" ref={wrap$}
      className="tw:relative tw:flex tw:min-h-[100svh] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:gap-6 tw:overflow-hidden tw:px-6 tw:pt-20 tw:pb-10 tw:md:gap-8 tw:md:py-14"
      style={{ marginTop: `calc(-1 * ${PULL})` }}
    >
      {/* The top padding on a phone clears the header. On a short one the
          screen is fuller than the window, so nothing centres it down from
          the top, and 56px of padding left the headline under the bar. */}
      <motion.header
        ref={head$}
        style={reduced ? undefined : { opacity: headOpacity, y: headY }}
        className="tw:relative tw:z-10 tw:max-w-3xl tw:text-center"
      >
        <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:font-bold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-balance tw:text-ink">
          {copy.head}
        </h2>
        <motion.p
          style={reduced ? undefined : { opacity: subOpacity }}
          className="tw:mt-3 tw:md:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-balance tw:text-muted"
        >
          {copy.sub}
        </motion.p>
      </motion.header>

      <div ref={ref} className="tw:relative tw:z-10 tw:origin-top tw:scale-[0.8] tw:sm:scale-100">
        <p className="tw:m-0 tw:mb-3 tw:text-center tw:text-[11.5px] tw:font-semibold tw:uppercase tw:tracking-[0.1em] tw:text-muted">
          This week · CS friends
        </p>

        <div className="tw:relative" style={{ width: STAGE.w, height: STAGE.h }}>
          {party && !reduced && <Burst />}

          {/* Scene one: the board. It steps up and away rather than turning
              into anything. */}
          <motion.div
            className="tw:absolute tw:inset-0 tw:flex tw:items-center"
            initial={false}
            animate={boardGone
              ? { opacity: 0, y: -18, scale: 0.97 }
              : { opacity: step >= S.BOARD ? 1 : 0, y: step >= S.BOARD ? 0 : 14, scale: 1 }}
            transition={{ duration: boardGone ? 0.45 : 0.5, ease: EASE }}
            style={{ pointerEvents: boardGone ? 'none' : undefined }}
            aria-hidden={boardGone}
          >
            <div className="tw:w-full tw:rounded-2xl tw:border tw:border-line tw:bg-white tw:p-2 tw:shadow-[0_1px_2px_rgba(29,35,31,0.04),0_18px_44px_-12px_rgba(29,35,31,0.18)]">
              {PEOPLE.map((p, i) => <Row key={p.key} p={p} rank={i + 1} step={step} />)}
            </div>
          </motion.div>

          {/* Scene two: the podium, on its own floor. The floor fades at
              both ends, so it reads as ground rather than as a rule. */}
          {PEOPLE.map((p) => <Column key={p.key} p={p} step={step} />)}
          <motion.i
            aria-hidden
            className="tw:absolute tw:bottom-0 tw:left-[12px] tw:right-[12px] tw:block tw:h-[2px] tw:origin-center tw:rounded-full"
            style={{ background: 'linear-gradient(to right, rgba(200,200,186,0) 0%, #cfcfc2 22%, #cfcfc2 78%, rgba(200,200,186,0) 100%)' }}
            initial={false}
            animate={{ scaleX: step >= S.RISE ? 1 : 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          />
        </div>
      </div>
    </section>
  );
}
