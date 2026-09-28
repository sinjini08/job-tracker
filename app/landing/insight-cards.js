'use client';

// The four charts the wheel turns through, in the order the app puts them.
//
// Drawn rather than charted: a chart library for four fixed pictures with
// invented numbers would be a dependency doing arithmetic we already know the
// answer to. Every value below is a literal, so nothing here can render
// differently from what is written.
//
// The numbers are one plausible search and they agree with each other. 47
// applications, of which 18 answered, of which 7 reached an interview, of
// which 2 made an offer. A reader who adds them up should find them adding
// up.

// One hue, light to dark, wherever the quantity is the point: replies, how
// far things got, how busy a day was. Green means more of the same thing
// rather than a different thing.
const RAMP = ['#e8e8dc', '#dcece1', '#69b57f', '#2e7d46', '#1d5c36'];

function Card({ title, sub, children }) {
  return (
    <div className="tw:flex tw:h-[240px] tw:w-full tw:flex-col tw:rounded-2xl tw:border tw:border-line tw:bg-white tw:p-4 tw:shadow-xl tw:shadow-ink/5">
      <p className="tw:m-0 tw:text-[12.5px] tw:font-semibold tw:text-ink">{title}</p>
      <p className="tw:mt-0.5 tw:mb-3 tw:text-[10.5px] tw:leading-snug tw:text-muted">{sub}</p>
      <div className="tw:min-h-0 tw:flex-1">{children}</div>
    </div>
  );
}

// 1. Which routes answer. The section's whole argument in one picture: the
// route used least is the one that replies most.
const SOURCES = [
  { name: 'Referrals', sent: 7, pct: 71, fill: '#1d5c36' },
  { name: 'Campus board', sent: 12, pct: 52, fill: '#2e7d46' },
  { name: 'Job boards', sent: 28, pct: 18, fill: '#69b57f' },
];

function Replies() {
  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:justify-between">
      <div className="tw:flex tw:flex-col tw:gap-2.5">
        {SOURCES.map((s) => (
          <div key={s.name}>
            <div className="tw:mb-1 tw:flex tw:items-baseline tw:justify-between tw:text-[11px]">
              <span className="tw:text-ink-2">{s.name}</span>
              <span className="tw:font-semibold tw:text-ink">{s.pct}%</span>
            </div>
            <div className="tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-sand">
              <i className="tw:block tw:h-full tw:rounded-full" style={{ width: `${s.pct}%`, background: s.fill }} />
            </div>
          </div>
        ))}
      </div>
      <p className="tw:m-0 tw:rounded-lg tw:bg-tint tw:px-2.5 tw:py-1.5 tw:text-[10.5px] tw:leading-snug tw:text-brand">
        You sent four times as many to job boards. They answered one in five.
      </p>
    </div>
  );
}

// 2. Furthest reached, each application counted once. A donut is the right
// shape here and only here: the parts are parts of one whole.
const STAGES = [
  { name: 'Offer', n: 2, fill: RAMP[4] },
  { name: 'Interview', n: 5, fill: RAMP[3] },
  { name: 'Screening', n: 11, fill: RAMP[2] },
  { name: 'No reply yet', n: 29, fill: RAMP[0] },
];
const TOTAL = STAGES.reduce((a, s) => a + s.n, 0);
const R = 34;
const C = 2 * Math.PI * R;

// Each arc's length and where it starts, worked out once at module load. The
// 1.5 taken off every length is the gap between neighbouring arcs: touching
// fills read as one shape.
const ARCS = STAGES.reduce((acc, s) => {
  const len = (s.n / TOTAL) * C;
  const at = acc.length ? acc[acc.length - 1].at + acc[acc.length - 1].len : 0;
  acc.push({ ...s, len, at });
  return acc;
}, []);

function Furthest() {
  return (
    <div className="tw:flex tw:h-full tw:items-center tw:gap-4">
      <svg viewBox="0 0 88 88" className="tw:h-[104px] tw:w-[104px] tw:flex-none" role="img" aria-label="Two offers, five interviews, eleven screenings, twenty-nine with no reply yet">
        <g transform="rotate(-90 44 44)">
          {ARCS.map((s) => (
            <circle
              key={s.name} cx="44" cy="44" r={R} fill="none"
              stroke={s.fill} strokeWidth="13"
              strokeDasharray={`${s.len - 1.5} ${C - s.len + 1.5}`}
              strokeDashoffset={-s.at}
            />
          ))}
        </g>
        <text x="44" y="42" textAnchor="middle" className="tw:fill-ink" style={{ fontSize: 17, fontWeight: 600 }}>{TOTAL}</text>
        <text x="44" y="53" textAnchor="middle" className="tw:fill-muted" style={{ fontSize: 7.5 }}>sent</text>
      </svg>

      <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
        {STAGES.map((s) => (
          <li key={s.name} className="tw:flex tw:items-center tw:gap-2 tw:text-[11px]">
            <i className="tw:block tw:h-2.5 tw:w-2.5 tw:flex-none tw:rounded-sm" style={{ background: s.fill }} />
            <span className="tw:text-ink-2">{s.name}</span>
            <b className="tw:ml-auto tw:font-semibold tw:text-ink">{s.n}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 3. Every day you sent something, darkest on the busiest. Five weeks, read
// left to right. The two empty columns are weekends and they are meant to be
// there.
const WEEKS = [
  [0, 2, 1, 0, 3, 0, 0],
  [1, 3, 4, 2, 1, 0, 0],
  [0, 1, 2, 4, 4, 1, 0],
  [2, 0, 1, 1, 2, 0, 0],
  [3, 4, 2, 3, 0, 0, 0],
];
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function Activity() {
  // Fixed 20px squares rather than aspect-square in a seven-column grid.
  // Square cells sized by the card's width came out 43px each, and five rows
  // of those are taller than the card: the last week and the legend fell off
  // the bottom. Measured: 151px of content in a 160px body.
  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:justify-between">
      <div className="tw:mx-auto tw:w-fit">
        <div className="tw:mb-1.5 tw:grid tw:grid-cols-7 tw:gap-[5px] tw:text-center tw:text-[8.5px] tw:font-semibold tw:text-muted">
          {DAYS.map((d, i) => <span key={i} className="tw:w-5">{d}</span>)}
        </div>
        <div className="tw:grid tw:grid-cols-7 tw:gap-[5px]">
          {WEEKS.flat().map((v, i) => (
            <i key={i} className="tw:block tw:h-5 tw:w-5 tw:rounded-[3px]" style={{ background: RAMP[v] }} />
          ))}
        </div>
      </div>
      <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-[9.5px] tw:text-muted">
        <span>Quieter</span>
        {RAMP.map((c) => <i key={c} className="tw:block tw:h-2.5 tw:w-2.5 tw:rounded-[3px]" style={{ background: c }} />)}
        <span>Busier</span>
      </div>
    </div>
  );
}

// 4. What everything is doing right now, in the app's own chips. Status is
// not a quantity, so it does not get the green ramp: these are the colours a
// reader will see on their own rows tomorrow.
const STANDING = [
  { name: 'Applied', n: 21, bg: '#e0ebfb', fg: '#0f4d93' },
  { name: 'Screening', n: 11, bg: '#d5eef2', fg: '#07646f' },
  { name: 'Interviewing', n: 7, bg: '#fcebc4', fg: '#8a5a00' },
  { name: 'Wishlist', n: 6, bg: '#e7eaf0', fg: '#44516a' },
  { name: 'Offer', n: 2, bg: '#d3f0d3', fg: '#0c7129' },
];
const WIDEST = Math.max(...STANDING.map((s) => s.n));

function Standing() {
  return (
    <ul className="tw:m-0 tw:flex tw:h-full tw:list-none tw:flex-col tw:justify-between tw:p-0">
      {STANDING.map((s) => (
        <li key={s.name} className="tw:flex tw:items-center tw:gap-2.5">
          <span
            className="tw:w-[86px] tw:flex-none tw:rounded-full tw:px-2 tw:py-0.5 tw:text-center tw:text-[9.5px] tw:font-semibold"
            style={{ background: s.bg, color: s.fg }}
          >
            {s.name}
          </span>
          <span className="tw:h-2.5 tw:flex-1 tw:overflow-hidden tw:rounded-full tw:bg-paper">
            <i className="tw:block tw:h-full tw:rounded-full" style={{ width: `${(s.n / WIDEST) * 100}%`, background: s.fg, opacity: 0.55 }} />
          </span>
          <b className="tw:w-5 tw:flex-none tw:text-right tw:text-[11.5px] tw:font-semibold tw:text-ink">{s.n}</b>
        </li>
      ))}
    </ul>
  );
}

// 5. The one chart that is about direction rather than totals. Everything
// above says what has happened; this says whether it is getting better,
// which is the only reason to look at any of it.
//
// A line, because the reader is meant to follow it rather than compare its
// parts: the shape is the point. Six weeks of the same measure, each week's
// applications and how many of them ever got an answer.
const WEEKLY = [14, 19, 26, 31, 42, 48];
const TOP = 50;
// y0 is 18 rather than 8 to leave headroom for the label on the last point.
// At 8 the line topped out at y=11 and the label above it was cut off by the
// top of the viewBox.
const PLOT = { x0: 30, x1: 250, y0: 18, y1: 84 };
const STEP_X = (PLOT.x1 - PLOT.x0) / (WEEKLY.length - 1);
const POINTS = WEEKLY.map((v, i) => ({
  v,
  x: PLOT.x0 + i * STEP_X,
  y: PLOT.y1 - (v / TOP) * (PLOT.y1 - PLOT.y0),
}));
const LINE = POINTS.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
const AREA = `${LINE} L${PLOT.x1} ${PLOT.y1} L${PLOT.x0} ${PLOT.y1} Z`;
const LAST = POINTS[POINTS.length - 1];

function Trend() {
  return (
    <div className="tw:flex tw:h-full tw:flex-col tw:justify-between">
      <svg viewBox="0 0 264 104" className="tw:w-full" role="img" aria-label="Reply rate by week: 14, 19, 26, 31, 42 and 48 per cent">
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1d5c36" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#1d5c36" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Two gridlines and no axis. Enough to read a height against,
            quiet enough that the line is what you see. */}
        {[0, 25, 50].map((g) => {
          const y = PLOT.y1 - (g / TOP) * (PLOT.y1 - PLOT.y0);
          return (
            <g key={g}>
              <line x1={PLOT.x0} y1={y} x2={PLOT.x1} y2={y} stroke="#e4e4db" strokeWidth="1" />
              <text x={PLOT.x0 - 6} y={y + 3} textAnchor="end" className="tw:fill-muted" style={{ fontSize: 7.5 }}>{g}%</text>
            </g>
          );
        })}

        <path d={AREA} fill="url(#trend-fill)" />
        <path d={LINE} fill="none" stroke="#1d5c36" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {POINTS.map((p, i) => (
          <circle
            key={p.x} cx={p.x} cy={p.y} r={i === POINTS.length - 1 ? 4.5 : 3}
            fill={i === POINTS.length - 1 ? '#1d5c36' : '#fff'}
            stroke="#1d5c36" strokeWidth="2"
          />
        ))}

        {/* The end of the line is labelled and nothing else is. A number on
            every point would make six things to read instead of one shape. */}
        <text x={LAST.x} y={LAST.y - 9} textAnchor="end" className="tw:fill-ink" style={{ fontSize: 9.5, fontWeight: 600 }}>
          {LAST.v}%
        </text>

        {POINTS.map((p, i) => (
          <text key={`w${i}`} x={p.x} y={PLOT.y1 + 13} textAnchor="middle" className="tw:fill-muted" style={{ fontSize: 7.5 }}>
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

export const CARDS = [
  { key: 'replies', title: 'Where the replies come from', sub: 'Share of what you sent that got an answer', body: <Replies /> },
  { key: 'furthest', title: 'How far applications get', sub: 'Every application counted once, at the furthest it reached', body: <Furthest /> },
  { key: 'activity', title: 'When you applied', sub: 'Every day you sent something, darkest on your busiest', body: <Activity /> },
  { key: 'standing', title: 'Where things stand', sub: 'What all 47 are doing right now', body: <Standing /> },
  // Last on purpose. Four cards of what happened, then one of which way it
  // is going, which is the note to leave the section on.
  { key: 'trend', title: 'Whether it is getting better', sub: "Share of each week's applications that got an answer", body: <Trend /> },
];

export { Card };
