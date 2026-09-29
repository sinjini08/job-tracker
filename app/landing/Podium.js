'use client';

import { cubicBezier, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { useRef, useState } from 'react';
import { byId } from './copy';
import useEnterProgress from './useEnterProgress';
import useSceneProgress from './useSceneProgress';

// Section six: the week's board, which turns into the week's podium.
//
// It arrives as a leaderboard, because that is what a reader recognises and
// it can show the scores plainly. Then the rows take off: each bar swings up
// into a plinth, the faces climb onto them, and the list is a podium. Third
// place gets there first and first place last, so the thing still rises.
//
// The morph is the argument. A leaderboard is a fact and a podium is an
// occasion, and the feature is about turning the first into the second.
// Cross-fading one for the other would say they are two pictures; moving the
// same three bars says they are one.
//
// You are second. Deliberately. First place on your own landing page is a
// boast, and the sub-heading says climb: a board you are already top of is
// nothing to climb.

const PODIUM_VH = 340;

// The stage, in its own pixels. Every position below is in this space, so
// the two layouts can be written as coordinates and checked against each
// other rather than fought out in flexbox.
const STAGE = { w: 380, h: 344 };
const COL = 108;
const BASE = STAGE.h;

// Left to right on the finished podium: second, first, third.
const COL_X = { 1: 136, 2: 12, 3: 260 };
const PLINTH = { 1: 176, 2: 130, 3: 96 };

// Where each row's middle sits, top to bottom: first, second, third. Rows
// are 58 apart inside a card with 14 of padding at each end, so the three
// gaps a reader sees are the same gap.
const ROW_C = { 1: 83, 2: 141, 3: 199 };
const CARD = { top: 40, height: 202 };

// The row, across and down.
//
// Across: fixed columns with the same 12 between them, because three rows
// that each place their own pieces are three rows that do not line up.
//
// Down: every piece is hung off the row's middle by half its own height,
// rather than by an offset guessed per piece. That is the whole of the
// previous version's problem. The bar sat nine below the middle and the
// numeral three above it, so nothing in a row agreed with anything else in
// it, and the three rows were consistently wrong in the same way, which
// makes it look deliberate and read as sloppy.
//
// Heights are declared rather than inherited, so the halves above are
// arithmetic and not a measurement that changes with the font.
const ROW = {
  num: 16, numW: 20, numLine: 22, numScale: 0.62,
  face: 48, faceSize: 46, faceScale: 0.72,
  label: 93, labelW: 88, labelH: 38,
  track: 192, trackW: 172, barH: 11,
};

const PEAK = 46;

// The leaderboard's bars are the app's green, the same for everyone, against
// a track that is the same length for everyone. The medal colours belong to
// the podium and arrive with it: a board that is already gold, silver and
// bronze has given away where it is going.
const GREEN = '#1d5c36';

const PLACES = [
  {
    rank: 2, name: 'you', pts: 41, avatar: 'a20', me: true,
    bg: 'linear-gradient(180deg,#eeeef2,#dcdce2)', ink: '#4a4a52',
    morph: [0.24, 0.58],
  },
  {
    rank: 1, name: 'mei', pts: 46, avatar: 'a3', streak: '9d',
    bg: 'linear-gradient(180deg,#f7e6b4,#f1d68a)', ink: '#6b4e08',
    morph: [0.40, 0.76],
  },
  {
    rank: 3, name: 'rou', pts: 27, avatar: 'a11',
    bg: 'linear-gradient(180deg,#f0d9c2,#e8c8a8)', ink: '#6d4520',
    morph: [0.10, 0.42],
  },
];

// The card behind the rows goes before they do, so the bars are already in
// the open by the time they start climbing.
const CARD_OUT = [0.10, 0.28];
// Once the last plinth is standing.
const PARTY_AT = 0.82;

// Out fast, in slow. A straight line between two positions is a thing being
// dragged; this is a thing being thrown and landing.
const TRAVEL = cubicBezier(0.22, 1, 0.3, 1);

const CONFETTI = ['#1f9d55', '#69b57f', '#f1d68a', '#e0651f', '#2a78d6', '#d1478c'];

// The app's own confetti, by its own class names: .confetti and its fall
// keyframe live in globals.css, which is loaded here too. Reusing it means
// the party on the landing page is the party in the product rather than a
// second implementation that drifts from it.
// Scattered, but worked out rather than rolled: the same seventy pieces every
// time, from the piece's own index. Math.random in a render body is a
// different page on the server than in the browser, and it means this file
// cannot be looked at twice and compared.
const spread = (i, salt) => {
  const x = Math.sin((i + 1) * salt) * 43758.5453;
  return x - Math.floor(x);
};

const PIECES = Array.from({ length: 70 }, (_, i) => ({
  id: i,
  left: spread(i, 12.9898) * 100,
  delay: spread(i, 78.233) * 0.45,
  duration: 1.9 + spread(i, 45.164) * 1.5,
  drift: `${(spread(i, 94.673) - 0.5) * 140}px`,
  spin: `${(spread(i, 27.311) - 0.5) * 900}deg`,
  color: CONFETTI[i % CONFETTI.length],
  size: 6 + spread(i, 63.727) * 7,
  round: spread(i, 11.482) > 0.65,
}));

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

function Confetti() {
  const pieces = PIECES;

  return (
    <div className="confetti" aria-hidden>
      {pieces.map((p) => (
        <i
          key={p.id}
          className={p.round ? 'round' : undefined}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 0.6),
            background: p.color,
            '--drift': p.drift,
            '--spin': p.spin,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// One member, in both layouts at once.
//
// Every piece of a row is also a piece of a plinth, so each one is a single
// element whose position and size are read off the same 0-to-1: at 0 it is
// where the leaderboard puts it, at 1 where the podium does, and in between
// it is on its way.
function Place({ place, progress, cardOpacity }) {
  const raw = useTransform(progress, place.morph, [0, 1], { clamp: true });
  // One eased clock for everything that travels, so the whole row leaves and
  // lands together instead of each piece easing on its own.
  const p = useTransform(raw, [0, 1], [0, 1], { ease: TRAVEL });
  // Named for the hook it is: called unconditionally, once per pair, in the
  // same order every render.
  const useLerp = (from, to) => useTransform(p, [0, 1], [from, to]);

  const rowC = ROW_C[place.rank];
  const colX = COL_X[place.rank];
  const h = PLINTH[place.rank];
  const top = BASE - h;
  // A bar as long as the score, against the best score on the board.
  const barW = ROW.trackW * (place.pts / PEAK);

  const barX = useLerp(ROW.track, colX);
  const barW$ = useLerp(barW, COL);
  const barTopR = useLerp(6, 14);
  const barBottomR = useLerp(6, 0);

  // Green on the board, medal on the plinth, crossed over while the bar is
  // in the air. Two layers rather than one animated colour, because the
  // plinth's fill is a gradient and there is no half-way between a flat
  // colour and a gradient.
  const greenOut = useTransform(raw, [0.18, 0.58], [1, 0]);
  const medalIn = useTransform(raw, [0.18, 0.58], [0, 1]);

  // The plinth overshoots its height and settles back. Read off the raw
  // clock rather than the eased one, because the eased one is already past
  // 0.85 by the time the bar is halfway there and the bounce would happen
  // before the travel does.
  const barH = useTransform(raw, [0, 0.82, 1], [ROW.barH, h * 1.05, h], { ease: TRAVEL });
  // Whatever the height is doing, the foot of the plinth stays on the floor.
  // Worked out from the height rather than tweened alongside it, so the two
  // cannot disagree by a pixel mid-flight.
  const barY = useTransform([p, barH], ([t, hh]) => (1 - t) * (rowC - ROW.barH / 2) + t * (BASE - hh));

  // The face hops: up past its landing spot, then down onto the plinth.
  const avX = useLerp(ROW.face, colX + (COL - 46) / 2);
  const avY = useTransform(p, [0, 0.74, 1], [rowC - (ROW.faceSize * ROW.faceScale) / 2, top - 112, top - 94]);
  const avScale = useLerp(ROW.faceScale, 1);

  const labX = useLerp(ROW.label, colX);
  const labW = useLerp(ROW.labelW, COL);
  const labY = useTransform(p, [0, 0.74, 1], [rowC - ROW.labelH / 2, top - 62, top - 46]);
  // Ranged left beside a face, centred over a plinth. It snaps rather than
  // tweens, because there is no half of an alignment, and it snaps in the
  // middle of the flight where nothing is settled enough to notice.
  const labAlign = useTransform(raw, (v) => (v < 0.5 ? 'left' : 'center'));

  // The numeral is doing two jobs, small beside a row and large on a plinth,
  // and the in-between sizes are neither. It dips out of sight for the
  // crossing and comes back as the other one.
  const numX = useLerp(ROW.num, colX);
  const numY = useLerp(rowC - (ROW.numLine * ROW.numScale) / 2, BASE - 37);
  const numW = useLerp(ROW.numW, COL);
  const numScale = useLerp(ROW.numScale, 1);
  const numOpacity = useTransform(raw, [0, 0.28, 0.72, 1], [1, 0.08, 0.08, 1]);

  return (
    <>
      {/* The track behind the bar. It belongs to the board, so it goes when
          the board does. */}
      <motion.div
        aria-hidden
        style={{ opacity: cardOpacity, left: ROW.track, top: rowC - ROW.barH / 2, width: ROW.trackW, height: ROW.barH }}
        className="tw:absolute tw:rounded-full tw:bg-sand"
      />

      <motion.div
        style={{
          x: barX, y: barY, width: barW$, height: barH,
          borderTopLeftRadius: barTopR, borderTopRightRadius: barTopR,
          borderBottomLeftRadius: barBottomR, borderBottomRightRadius: barBottomR,
        }}
        className="tw:absolute tw:left-0 tw:top-0"
      >
        <motion.i style={{ opacity: greenOut, background: GREEN, borderRadius: 'inherit' }} className="tw:absolute tw:inset-0 tw:block" />
        <motion.i style={{ opacity: medalIn, background: place.bg, borderRadius: 'inherit' }} className="tw:absolute tw:inset-0 tw:block" />
      </motion.div>

      <motion.div style={{ x: numX, y: numY, width: numW, scale: numScale, opacity: numOpacity }} className="tw:absolute tw:left-0 tw:top-0 tw:origin-top-left">
        <span className="tw:block tw:text-center tw:text-[19px] tw:font-bold tw:leading-[22px]" style={{ color: place.ink }}>
          {place.rank}
        </span>
      </motion.div>

      <motion.div style={{ x: avX, y: avY, scale: avScale }} className="tw:absolute tw:left-0 tw:top-0 tw:origin-top-left">
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
      </motion.div>

      {/* Name over score in both layouts. The two names on this board are
          three letters each, so a centred block reads as left-aligned in the
          row and as centred on the plinth, and nothing has to change
          alignment mid-flight. */}
      <motion.div style={{ x: labX, y: labY, width: labW, textAlign: labAlign }} className="tw:absolute tw:left-0 tw:top-0">
        <p className={`tw:m-0 tw:text-[12.5px] tw:font-semibold tw:leading-[17px] ${place.me ? 'tw:text-brand' : 'tw:text-ink'}`}>
          {place.name}
          {place.streak && <span className="tw:ml-1 tw:text-[10px] tw:font-normal tw:text-muted">{place.streak}</span>}
        </p>
        <p className="tw:m-0 tw:text-[15px] tw:font-bold tw:leading-[19px] tw:text-ink">
          {place.pts}
          <span className="tw:ml-0.5 tw:text-[10px] tw:font-semibold tw:text-muted">pts</span>
        </p>
      </motion.div>
    </>
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

  // Nobody who asked for less motion should get a board mid-flight, so they
  // are driven by a value already at the end. Same components, same code
  // path: only the clock is different.
  const done = useMotionValue(1);
  const progress = reduced ? done : scrolled;

  const headOpacity = useTransform(enter, [0, 0.55], [0, 1]);
  const headY = useTransform(enter, [0, 0.55], [26, 0]);
  const subOpacity = useTransform(enter, [0.25, 0.85], [0, 1]);

  const cardOpacity = useTransform(progress, CARD_OUT, [1, 0]);
  const floor = useTransform(progress, [0.62, 0.84], [0, 1]);
  // The cup is mounted for good once it has been won, but it only shows
  // while the podium is standing. Scrolled back to the board it fades out
  // with it, rather than hanging over a list of rows it has nothing to do
  // with.
  const cupOpacity = useTransform(progress, [PARTY_AT - 0.08, PARTY_AT], [0, 1]);
  // The caption is about the gap between first and second, and there is no
  // gap to talk about until both are standing.
  const capOpacity = useTransform(progress, [0.74, 0.88], [0, 1]);
  const labelOpacity = useTransform(progress, CARD_OUT, [1, 0.55]);

  // Fires once. Scrolling back up and down again does not throw a second
  // party, which is how the app treats a win too.
  const [party, setParty] = useState(false);
  useMotionValueEvent(progress, 'change', (v) => {
    if (!party && v >= PARTY_AT) setParty(true);
  });

  return (
    <div id="league" ref={wrap$} className="tw:relative" style={{ height: reduced ? undefined : `${PODIUM_VH}vh` }}>
      <div
        ref={stage$}
        className={`tw:flex tw:h-[100svh] tw:flex-col tw:items-center tw:justify-center tw:gap-8 tw:overflow-hidden tw:px-6 tw:py-14 ${
          reduced ? '' : 'tw:sticky tw:top-0'
        }`}
      >
        {party && !reduced && <Confetti />}

        <motion.header
          style={reduced ? undefined : { opacity: headOpacity, y: headY }}
          className="tw:relative tw:z-10 tw:max-w-3xl tw:text-center"
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

        <div className="tw:relative tw:z-10 tw:origin-top tw:scale-[0.84] tw:sm:scale-100">
          <motion.p
            style={reduced ? undefined : { opacity: labelOpacity }}
            className="tw:m-0 tw:mb-2 tw:text-center tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-[0.08em] tw:text-muted"
          >
            This week · CS friends
          </motion.p>

          <div className="tw:relative" style={{ width: STAGE.w, height: STAGE.h }}>
            {/* The leaderboard's own card. It is the one piece with nowhere
                to go on a podium, so it is the one piece that fades. */}
            <motion.div
              style={{ ...(reduced ? { opacity: 0 } : { opacity: cardOpacity }), top: CARD.top, height: CARD.height }}
              className="tw:absolute tw:inset-x-0 tw:rounded-2xl tw:border tw:border-line tw:bg-white tw:shadow-xl tw:shadow-ink/5"
              aria-hidden
            />
            {PLACES.map((place) => <Place key={place.name} place={place} progress={progress} cardOpacity={cardOpacity} />)}

            {/* The floor. Three blocks hanging in paper are three blocks; a
                line under them is a podium. It draws outwards from the
                middle as the last one lands. */}
            <motion.i
              aria-hidden
              style={{
                ...(reduced ? {} : { scaleX: floor }),
                // Fading at both ends, so it reads as ground rather than as
                // a rule somebody drew under the picture.
                background: 'linear-gradient(to right, rgba(200,200,186,0) 0%, #cfcfc2 22%, #cfcfc2 78%, rgba(200,200,186,0) 100%)',
              }}
              className="tw:absolute tw:bottom-0 tw:left-[12px] tw:right-[12px] tw:block tw:h-[2px] tw:origin-center tw:rounded-full"
            />

            {/* Two elements, not one. The cup's own pop animates y, and a y
                in `animate` wins over a y in `style`: with both on the same
                node the trophy sprang neatly to the top of the stage. The
                outer one holds the position and the inner one does the
                popping. */}
            {party && !reduced && (
              <motion.div
                className="tw:absolute tw:left-0 tw:top-0 tw:flex tw:w-[108px] tw:justify-center"
                style={{
                  opacity: cupOpacity,
                  transform: `translate(${COL_X[1]}px, ${BASE - PLINTH[1] - 124}px)`,
                }}
              >
                <motion.span
                  initial={{ opacity: 0, scale: 0.4, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 16 }}
                  className="tw:block"
                >
                  <Trophy />
                </motion.span>
              </motion.div>
            )}
          </div>
        </div>

        <motion.p
          style={reduced ? undefined : { opacity: capOpacity }}
          className="tw:relative tw:z-10 tw:m-0 tw:max-w-md tw:text-center tw:text-[13px] tw:leading-relaxed tw:text-muted"
        >
          Five points off the top, which is one interview and a screening.
          Your friends see the points, never where you applied.
        </motion.p>
      </div>
    </div>
  );
}
