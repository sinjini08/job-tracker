'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

// The four charts the wheel turns through.
//
// Drawn rather than charted: a chart library for four fixed pictures with
// invented numbers would be a dependency doing arithmetic we already know the
// answer to. Every value below is a literal, so nothing here can render
// differently from what is written.
//
// The numbers are one plausible six-week search and they agree with each
// other, so a reader who adds them up finds them adding up:
//
//   64 applications, sent 16, 14, 12, 9, 7 and 6 a week.
//   21 of them got past "applied": 2, 3, 4, 4, 4 and 4 a week.
//   Furthest reached: 8 screening, 5 assessment, 3 interview, 3 final, 2 offer.
//   Right now: 30 still waiting, 12 moving, 22 closed, 2 of those 12 offers.
//
// Each chart draws itself the first time it faces front, and stays drawn.
// The wheel says which one is in front; a chart that animated on load would
// have finished long before anyone turned to it. Until then it is faint
// rather than empty, because the next card shows behind the front one and a
// blank card there reads as broken.

// The app's own green ramp, light to dark, from globals.css --ord-*.
const ORD = ['#eceee9', '#a8d4b5', '#86c69a', '#69b57f', '#4a9463', '#2e7d46', '#1d5c36', '#123c22'];

const EASE = [0.22, 1, 0.36, 1];

// Off until the chart first faces front, then on for good. Anyone who has
// asked for less motion gets it drawn from the start.
function useDraw(active) {
  const reduced = useReducedMotion();
  const [seen, setSeen] = useState(false);
  if (active && !seen) setSeen(true);
  return { initial: reduced ? false : 'off', animate: seen || reduced ? 'on' : 'off' };
}

function Card({ title, sub, stat, children }) {
  return (
    <div className="tw:flex tw:h-[240px] tw:w-full tw:flex-col tw:rounded-2xl tw:border tw:border-line tw:bg-white tw:p-4 tw:shadow-[0_1px_2px_rgba(29,35,31,0.04),0_14px_36px_-10px_rgba(29,35,31,0.16)]">
      <div className="tw:mb-3">
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
          <p className="tw:m-0 tw:truncate tw:text-[12.5px] tw:font-semibold tw:text-ink">{title}</p>
          {/* The one number to take away, so the card says something before
              anyone reads the chart. On the title's line rather than beside
              both lines, which squeezed the subtitle onto a second line and
              took that height out of the chart. */}
          {stat && (
            <span className="tw:flex-none tw:whitespace-nowrap tw:rounded-full tw:bg-tint tw:px-2 tw:py-0.5 tw:text-[10.5px] tw:font-semibold tw:tabular-nums tw:text-brand">
              {stat}
            </span>
          )}
        </div>
        <p className="tw:mt-0.5 tw:mb-0 tw:text-[10.5px] tw:leading-snug tw:text-muted">{sub}</p>
      </div>
      <div className="tw:min-h-0 tw:flex-1">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. How far applications get. Each application counted once, at the
// furthest it reached. A donut is the right shape here and only here: the
// parts are parts of one whole.
//
// Six stages rather than four, the same six the app uses, so the ring shows
// the real shape of a search: one wide pale arc of applications that went
// nowhere, then a run of narrowing, darkening arcs to the two offers.

const FURTHEST = [
  { name: 'Applied only', n: 43, fill: '#dfe7da' },
  { name: 'Screening', n: 8, fill: ORD[1] },
  { name: 'OA / Assessment', n: 5, fill: ORD[3] },
  { name: 'Interviewing', n: 3, fill: ORD[4] },
  { name: 'Final round', n: 3, fill: ORD[5] },
  { name: 'Offer', n: 2, fill: ORD[7] },
];
const TOTAL = FURTHEST.reduce((a, s) => a + s.n, 0);

const R = 38;
const THICK = 13;
// The card showing between neighbouring arcs: touching fills read as one
// shape.
const GAP = 1.8;
const C = 2 * Math.PI * R;

// Where each arc starts and how long it is. A circle's stroke starts at three
// o'clock; the extra quarter turn in the offset starts the ring at twelve
// without a rotate(), which a CSS transform on the element would override.
const SLICES = FURTHEST.reduce((acc, s) => {
  const at = acc.length ? acc[acc.length - 1].at + acc[acc.length - 1].frac : 0;
  const frac = s.n / TOTAL;
  acc.push({ ...s, frac, at, len: Math.max(0, frac * C - GAP), pct: Math.round(frac * 100) });
  return acc;
}, []);

function Furthest({ active }) {
  const draw = useDraw(active);

  return (
    <div className="tw:flex tw:h-full tw:items-center tw:gap-5">
      <div className="tw:relative tw:h-[136px] tw:w-[136px] tw:flex-none">
        <svg
          viewBox="0 0 100 100" className="tw:h-full tw:w-full" role="img"
          aria-label="64 applications by the furthest stage each reached: 43 applied only, 8 screening, 5 assessment, 3 interviewing, 3 final round, 2 offers"
        >
          <circle cx="50" cy="50" r={R} fill="none" stroke="#f3f4ef" strokeWidth={THICK} />
          {SLICES.map((s, i) => (
            <motion.circle
              key={s.name} cx="50" cy="50" r={R} fill="none"
              stroke={s.fill} strokeWidth={THICK}
              strokeDashoffset={C / 4 - s.at * C}
              custom={i} initial={draw.initial} animate={draw.animate}
              variants={{
                off: { strokeDasharray: `0 ${C}` },
                on: (k) => ({
                  strokeDasharray: `${s.len} ${C - s.len}`,
                  transition: { duration: 0.7, delay: 0.1 + k * 0.09, ease: EASE },
                }),
              }}
            />
          ))}
        </svg>
        {/* In HTML over the ring rather than SVG text, so it is set on the
            page's type scale instead of scaling with the artwork. */}
        <div className="tw:absolute tw:inset-0 tw:flex tw:flex-col tw:items-center tw:justify-center" aria-hidden>
          <strong className="tw:text-[26px] tw:font-semibold tw:leading-none tw:tracking-[-0.03em] tw:tabular-nums tw:text-ink">{TOTAL}</strong>
          <span className="tw:mt-1 tw:text-[10px] tw:text-muted">applications</span>
        </div>
      </div>

      <ul className="tw:m-0 tw:flex tw:min-w-0 tw:flex-1 tw:list-none tw:flex-col tw:gap-[5px] tw:p-0" aria-hidden>
        {SLICES.map((s, i) => {
          const offer = s.name === 'Offer';
          return (
            <motion.li
              key={s.name}
              custom={i} initial={draw.initial} animate={draw.animate}
              variants={{
                off: { opacity: 0.3, x: -6 },
                on: (k) => ({ opacity: 1, x: 0, transition: { duration: 0.35, delay: 0.15 + k * 0.06, ease: EASE } }),
              }}
              className="tw:flex tw:items-center tw:gap-2 tw:text-[11px]"
            >
              <i
                className="tw:block tw:h-2 tw:w-2 tw:flex-none tw:rounded-full"
                style={{ background: s.fill, boxShadow: i === 0 ? 'inset 0 0 0 1px #cfd8c9' : undefined }}
              />
              <span className={`tw:truncate ${offer ? 'tw:font-semibold tw:text-brand' : 'tw:text-ink-2'}`}>{s.name}</span>
              <b className="tw:ml-auto tw:font-semibold tw:tabular-nums tw:text-ink">{s.n}</b>
              <span className="tw:w-8 tw:text-right tw:tabular-nums tw:text-muted">{s.pct}%</span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Whether it is getting better. The one chart about direction rather
// than totals, and second so the section answers "is this working" before it
// gets into detail.
//
// Two things on one picture, because the note under it says two things:
// pale bars for how many you sent each week, falling, and a line for the
// share of them that got an answer, rising. Sending fewer, hearing back more.

const SENT = [16, 14, 12, 9, 7, 6];
const HEARD = [2, 3, 4, 4, 4, 4];
const RATE = SENT.map((s, i) => Math.round((HEARD[i] / s) * 100));

const BOX = { w: 300, h: 98 };
const PLOT = { x0: 30, x1: 292, y0: 16, y1: 80 };
const TOP_RATE = 75;
const SLOT = (PLOT.x1 - PLOT.x0) / SENT.length;
// The tallest week's bar fills this much of the plot, so the bars stay a
// backdrop under the line rather than competing with it.
const BAR_SHARE = 0.62;
const BAR_W = 18;

const cx = (i) => PLOT.x0 + SLOT * (i + 0.5);
const rateY = (v) => PLOT.y1 - (v / TOP_RATE) * (PLOT.y1 - PLOT.y0);
const barH = (v) => (v / Math.max(...SENT)) * (PLOT.y1 - PLOT.y0) * BAR_SHARE;

const PTS = RATE.map((v, i) => ({ v, x: cx(i), y: rateY(v) }));

// A gentle curve through the points rather than straight segments: the
// reader is meant to follow it, and corners make six points read as six
// things.
const f1 = (n) => n.toFixed(1);
const CURVE = PTS.reduce((d, p, i, a) => {
  if (!i) return `M${f1(p.x)} ${f1(p.y)}`;
  const p0 = a[i - 2] || a[i - 1];
  const p1 = a[i - 1];
  const p3 = a[i + 1] || p;
  const k = 0.18;
  return `${d} C${f1(p1.x + (p.x - p0.x) * k)} ${f1(p1.y + (p.y - p0.y) * k)} ${f1(p.x - (p3.x - p1.x) * k)} ${f1(p.y - (p3.y - p1.y) * k)} ${f1(p.x)} ${f1(p.y)}`;
}, '');
const AREA = `${CURVE} L${f1(PTS[PTS.length - 1].x)} ${PLOT.y1} L${f1(PTS[0].x)} ${PLOT.y1} Z`;
const END = PTS[PTS.length - 1];

function Trend({ active }) {
  const draw = useDraw(active);

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:justify-between tw:gap-1.5">
      <svg
        viewBox={`0 0 ${BOX.w} ${BOX.h}`} className="tw:w-full tw:overflow-visible" role="img"
        aria-label={`Over six weeks you sent ${SENT.join(', ')} applications a week, and the share that got an answer rose from ${RATE[0]} to ${END.v} per cent`}
      >
        <defs>
          <linearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#86c69a" />
            <stop offset="100%" stopColor="#1d5c36" />
          </linearGradient>
          <linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2e7d46" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#2e7d46" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines for the line's scale only. Dashed and pale: enough to
            read a height against. */}
        {[0, 25, 50, 75].map((g) => (
          <g key={g}>
            <line
              x1={PLOT.x0} x2={PLOT.x1} y1={rateY(g)} y2={rateY(g)}
              stroke="#e8e8df" strokeWidth="1" strokeDasharray={g ? '2 3' : undefined}
            />
            <text x={PLOT.x0 - 6} y={rateY(g) + 3} textAnchor="end" className="tw:fill-muted" style={{ fontSize: 8 }}>{g}%</text>
          </g>
        ))}

        {/* Sent per week. */}
        {SENT.map((v, i) => (
          <motion.rect
            key={`b${i}`} x={cx(i) - BAR_W / 2} y={PLOT.y1 - barH(v)} width={BAR_W} height={barH(v)} rx="3"
            fill="#e6ede1"
            style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            custom={i} initial={draw.initial} animate={draw.animate}
            variants={{
              off: { scaleY: 0 },
              on: (k) => ({ scaleY: 1, transition: { duration: 0.5, delay: k * 0.05, ease: EASE } }),
            }}
          />
        ))}
        {/* The first and last bars say what they are; the four between do
            not need to. */}
        {[0, SENT.length - 1].map((i) => (
          <motion.text
            key={`bl${i}`} x={cx(i)} y={PLOT.y1 - barH(SENT[i]) - 4} textAnchor="middle"
            className="tw:fill-muted" style={{ fontSize: 8 }}
            initial={draw.initial} animate={draw.animate}
            variants={{ off: { opacity: 0 }, on: { opacity: 1, transition: { delay: 0.4 } } }}
          >
            {SENT[i]} sent
          </motion.text>
        ))}

        <motion.path
          d={AREA} fill="url(#trend-area)"
          initial={draw.initial} animate={draw.animate}
          variants={{ off: { opacity: 0 }, on: { opacity: 1, transition: { duration: 0.6, delay: 0.75 } } }}
        />
        <motion.path
          d={CURVE} fill="none" stroke="url(#trend-stroke)" strokeWidth="2.25" strokeLinecap="round"
          initial={draw.initial} animate={draw.animate}
          variants={{
            off: { pathLength: 0 },
            on: { pathLength: 1, transition: { duration: 1, delay: 0.2, ease: 'easeInOut' } },
          }}
        />

        {PTS.slice(0, -1).map((p, i) => (
          <motion.circle
            key={`p${i}`} cx={p.x} cy={p.y} r="2.4" fill="#fff" stroke="#2e7d46" strokeWidth="1.6"
            custom={i} initial={draw.initial} animate={draw.animate}
            variants={{ off: { opacity: 0 }, on: (k) => ({ opacity: 1, transition: { delay: 0.25 + k * 0.16 } }) }}
          />
        ))}

        <motion.g
          initial={draw.initial} animate={draw.animate}
          variants={{ off: { opacity: 0 }, on: { opacity: 1, transition: { delay: 1.1 } } }}
        >
          <circle className="l-ping" cx={END.x} cy={END.y} r="3.6" fill="#69b57f" />
          <circle cx={END.x} cy={END.y} r="3.6" fill="#1d5c36" stroke="#fff" strokeWidth="1.5" />
          <text x={END.x + 2} y={END.y - 8} textAnchor="end" className="tw:fill-ink" style={{ fontSize: 9.5, fontWeight: 600 }}>
            {END.v}% replied
          </text>
        </motion.g>

        {SENT.map((_, i) => (
          <text key={`w${i}`} x={cx(i)} y={PLOT.y1 + 13} textAnchor="middle" className="tw:fill-muted" style={{ fontSize: 8 }}>
            {`W${i + 1}`}
          </text>
        ))}
      </svg>

      <p className="tw:m-0 tw:rounded-lg tw:bg-tint tw:px-2.5 tw:py-1.5 tw:text-[10.5px] tw:leading-snug tw:text-brand">
        You are sending fewer and hearing back more. That is the whole idea.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. Where things stand. What every application is doing today, in the
// app's own status chips, so these are the colours a reader will see on
// their own rows tomorrow. Status is not a quantity, so no green ramp.
//
// One bar of the whole first, split by status, then the counts. The bar is
// the shape (most still waiting, a third closed, a thin live middle); the
// tiles are the numbers.

const STATUS = [
  { name: 'Applied', n: 30, bg: '#e0ebfb', fg: '#0f4d93' },
  { name: 'Screening', n: 4, bg: '#d5eef2', fg: '#07646f' },
  { name: 'OA / Assessment', n: 3, bg: '#eae2f7', fg: '#5b2d9c' },
  { name: 'Interviewing', n: 3, bg: '#fcebc4', fg: '#8a5a00' },
  { name: 'Offer', n: 2, bg: '#d3f0d3', fg: '#0c7129' },
  { name: 'Rejected', n: 22, bg: '#fbdbd7', fg: '#a82113' },
];
const ALL = STATUS.reduce((a, s) => a + s.n, 0);
const CLOSED = STATUS.filter((s) => s.name === 'Rejected').reduce((a, s) => a + s.n, 0);
const OPEN = ALL - CLOSED;
// Open and past "applied": the part of the search that is actually moving.
const MOVING = OPEN - STATUS.find((s) => s.name === 'Applied').n;

function Standing({ active }) {
  const draw = useDraw(active);

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:justify-between">
      <div>
        {/* An empty track under the bar, so before it fills there is
            something to fill. */}
        <div className="tw:relative tw:h-3 tw:rounded-full tw:bg-[#eef0ea]">
          <motion.div
            className="tw:absolute tw:inset-0 tw:flex tw:gap-[2px] tw:overflow-hidden tw:rounded-full"
            role="img"
            aria-label={STATUS.map((s) => `${s.n} ${s.name}`).join(', ')}
            initial={draw.initial} animate={draw.animate}
            variants={{
              off: { clipPath: 'inset(0 100% 0 0 round 999px)' },
              on: { clipPath: 'inset(0 0% 0 0 round 999px)', transition: { duration: 0.8, ease: EASE } },
            }}
          >
            {STATUS.map((s) => (
              <i key={s.name} className="tw:block tw:h-full" style={{ flexGrow: s.n, background: s.fg, opacity: 0.82 }} />
            ))}
          </motion.div>
        </div>
        <div className="tw:mt-1.5 tw:flex tw:justify-between tw:text-[10px] tw:tabular-nums tw:text-muted">
          <span><b className="tw:font-semibold tw:text-ink">{OPEN}</b> still open</span>
          <span><b className="tw:font-semibold tw:text-ink">{CLOSED}</b> closed</span>
        </div>
      </div>

      <ul className="tw:m-0 tw:grid tw:list-none tw:grid-cols-2 tw:gap-1.5 tw:p-0" aria-hidden>
        {STATUS.map((s, i) => (
          <motion.li
            key={s.name}
            custom={i} initial={draw.initial} animate={draw.animate}
            variants={{
              off: { opacity: 0.3, y: 6 },
              on: (k) => ({ opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.25 + k * 0.05, ease: EASE } }),
            }}
            className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:rounded-lg tw:border tw:border-line tw:bg-[#fafaf7] tw:py-1 tw:pr-2.5 tw:pl-1.5"
          >
            <span
              className="tw:truncate tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold"
              style={{ background: s.bg, color: s.fg }}
            >
              {s.name}
            </span>
            <b className="tw:text-[14px] tw:font-semibold tw:tabular-nums tw:text-ink">{s.n}</b>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. When you applied. Every day you sent something, darkest on the busiest,
// one row a week for the same six weeks as the trend. Each row ends in its
// total, which is the trend's bars again: the two charts are one search.

const WEEKS = [
  [3, 4, 2, 3, 4, 0, 0],
  [2, 3, 4, 2, 2, 1, 0],
  [4, 2, 1, 3, 2, 0, 0],
  [1, 3, 2, 0, 2, 1, 0],
  [2, 0, 3, 1, 1, 0, 0],
  [1, 2, 0, 2, 1, 0, 0],
];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const HEAT = ['#eef0ea', '#c7e3cf', '#86c69a', '#3f8c58', '#1d5c36'];
const BY_DAY = DAYS.map((_, d) => WEEKS.reduce((a, w) => a + w[d], 0));
const BUSIEST = BY_DAY.indexOf(Math.max(...BY_DAY));

function Activity({ active }) {
  const draw = useDraw(active);

  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:justify-between">
      <div
        className="tw:mx-auto tw:grid tw:w-fit tw:grid-cols-[22px_repeat(7,16px)_26px] tw:items-center tw:gap-1"
        role="img"
        aria-label={`Applications per day over six weeks, busiest on ${['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'][BUSIEST]}`}
      >
        <span />
        {DAYS.map((d, i) => (
          <span
            key={i}
            className={`tw:text-center tw:text-[10px] tw:font-semibold ${i === BUSIEST ? 'tw:text-brand-mid' : 'tw:text-muted'}`}
          >
            {d}
          </span>
        ))}
        <span />

        {WEEKS.map((week, r) => [
          <span key={`w${r}`} className="tw:text-[10px] tw:text-muted">W{r + 1}</span>,
          ...week.map((v, c) => (
            <motion.i
              key={`c${r}-${c}`}
              className="tw:block tw:h-[16px] tw:w-[16px] tw:rounded-[4px]"
              style={{ background: HEAT[v] }}
              custom={r * 7 + c} initial={draw.initial} animate={draw.animate}
              variants={{
                off: { opacity: 0.25, scale: 0.6 },
                on: (k) => ({ opacity: 1, scale: 1, transition: { duration: 0.3, delay: k * 0.012, ease: EASE } }),
              }}
            />
          )),
          <span key={`t${r}`} className="tw:text-right tw:text-[10px] tw:font-semibold tw:tabular-nums tw:text-ink-2">
            {week.reduce((a, v) => a + v, 0)}
          </span>,
        ])}
      </div>

      <div className="tw:flex tw:items-center tw:justify-center tw:gap-1.5 tw:text-[10px] tw:text-muted" aria-hidden>
        <span>Quieter</span>
        {HEAT.map((c) => <i key={c} className="tw:block tw:h-2.5 tw:w-2.5 tw:rounded-[3px]" style={{ background: c }} />)}
        <span>Busier</span>
      </div>
    </div>
  );
}

// In the order the section argues: what happened to everything you sent,
// whether it is getting better, where it all stands today, and the habit
// behind it.
export const CARDS = [
  { key: 'furthest', title: 'How far applications get', sub: 'Every application counted once, at the furthest it reached', stat: '2 offers', Body: Furthest },
  { key: 'trend', title: 'Whether it is getting better', sub: "Share of each week's applications that got an answer", stat: `${RATE[0]}% → ${END.v}%`, Body: Trend },
  { key: 'standing', title: 'Where things stand', sub: `What all ${ALL} are doing right now`, stat: `${MOVING} in progress`, Body: Standing },
  { key: 'activity', title: 'When you applied', sub: 'Every day you sent something, darkest on your busiest', stat: `Busiest: ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][BUSIEST]}`, Body: Activity },
];

export { Card };
