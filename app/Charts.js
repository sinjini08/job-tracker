'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STAGES, computeStats, pct } from '@/lib/stats';
import { SHEET_KEYS } from '@/lib/fields';
import DayChart from './LeagueCharts';

export const PERIODS = [
  { id: 'all', label: 'All time', days: null },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '30', label: 'Last 30 days', days: 30 },
];
// Built from the student's own sheets, so a renamed or hidden one reads the
// same here as it does on the tab strip.
// One step per pipeline stage, so the ring darkens the further along it goes.
// A sequential ramp rather than a set of hues, because the stages are ordered:
// unrelated colours would say they are different kinds of thing rather than
// one thing at different depths.
const RAMP = ['--ord-1', '--ord-2', '--ord-3', '--ord-4', '--ord-5', '--ord-6', '--ord-7'];

const BREAKDOWNS = [
  { id: 'bySource', label: 'Source', title: 'Where you found the job' },
  { id: 'byCategory', label: 'Category', title: 'Type of role' },
  { id: 'byWorkMode', label: 'Work mode', title: 'On-site, hybrid or remote' },
];

export default function Charts({ rows, events, sheets = SHEET_KEYS, sheet = 'All', period = 'all' }) {
  const [daily, setDaily] = useState(null);
  const tip = useTooltip();

  // Your own points per day. It needs no league — this is your history, and
  // the same series the League tab draws for everyone.
  useEffect(() => {
    let live = true;
    fetch('/api/points?days=35')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && d && setDaily(d.daily))
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const days = PERIODS.find((p) => p.id === period).days;
  const data = useMemo(
    () => computeStats(rows, events, { sheet, sheets, days }),
    [rows, events, sheet, sheets, days],
  );

  return (
    <>
      {data.total === 0 && data.wishlist === 0 ? (
        <div className="viz-empty">
          <p className="viz-empty-title">No applications here yet</p>
          <p>Charts fill in as you log applications, either by typing in the sheets or by
            pasting a job posting to Claude.</p>
        </div>
      ) : (
        <>
          <div className="viz-kpis">
            <Stat label="Applications" value={data.total} sub={data.wishlist ? `plus ${data.wishlist} on the wishlist` : 'sent'} />
            {/* The strict one: not closed, and not sitting at Applied for
                three weeks. One definition, shared with the Insights rules, so
                this and the rail can never disagree. */}
            <Stat label="Still live" value={data.live}
              sub="not closed, and not silent for three weeks" />
            <Stat label="Response rate" value={`${data.responseRate}%`} sub={`${data.responded} of ${data.total} heard back`} />
            <Stat label="Reached interview" value={data.interviews} sub={`${pct(data.interviews, data.total)}% of applications`} />
            <Stat label="Offers" value={data.offers} sub={`${pct(data.offers, data.total)}% of applications`} good={data.offers > 0} />
          </div>

          <div className="viz-grid">
            <Card title="When you applied" subtitle="Every day you sent something, darkest on your busiest days"
              full
              table={{ cols: ['Day', 'Applications'], rows: data.byDay.map((d) => [d.day, d.value]) }}>
              <Activity byDay={data.byDay} days={days} tip={tip} />
            </Card>

            <Card title="How far applications get" subtitle="Every application counted once, at the furthest it reached"
              table={{ cols: ['Stage', 'Got no further', 'Reached this stage', 'Carried on from the stage before'],
                rows: data.furthest.map((r, i) => [r.label, r.value, data.reached[i].value,
                  i === 0 ? '—' : `${pct(data.reached[i].value, data.reached[i - 1].value)}%`]) }}>
              <Donut furthest={data.furthest} reached={data.reached} total={data.total} tip={tip} />
            </Card>

            <Card title="Where things stand" subtitle="What every application is doing right now"
              table={{ cols: ['Status', 'Applications'], rows: data.byStatus.map((r) => [r.label, r.value]) }}>
              <Pipeline rows={data.byStatus} tip={tip} />
            </Card>

            {/* Neither of these needs the whole width: one is a sparkline of
                daily points, the other is three or four bars. Side by side
                they read as one question about how the week went. */}
            <Card title="Points per day" subtitle="Applying scores, and getting further scores more. You earn these whether or not you are in a league"
              table={{ cols: ['Day', 'Points'], rows: (daily ?? []).map((d) => [d.day, d.pts]) }}>
              <DayChart monthOnly={false}
                series={daily ? [{ key: 'me', label: 'You', daily: daily.map((d) => d.pts), mine: true }] : []} />
            </Card>

            <Breakdown data={data} tip={tip} />
          </div>
        </>
      )}
      {tip.node}
    </>
  );
}

// ---------------------------------------------------------------------------

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {label && <span className="seg-label">{label}</span>}
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id}
          className={`seg-btn ${value === o.id ? 'on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}


function Stat({ label, value, sub, good }) {
  return (
    <div className={`stat ${good ? 'good' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function Card({ title, subtitle, table, children, full, tools }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className={`viz-card ${full ? 'span-all' : ''}`}>
      <header className="viz-card-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="viz-card-tools">
          {tools}
          <button className="viz-toggle" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
            {asTable ? 'Chart' : 'Table'}
          </button>
        </div>
      </header>
      {asTable ? (
        <table className="viz-table">
          <thead><tr>{table.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {table.rows.map((r, i) => (
              <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ) : children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// How far applications get, as a ring.
//
// The slices are the FURTHEST stage each application reached, not how many
// reached each stage. The second of those is what a funnel draws, and it can
// never be a pie: an application that ended in an offer has also been through
// screening, assessment and interviewing, so the counts overlap and adding
// them up gives a number bigger than the applications you sent. Counted at its
// furthest, every application lands in exactly one slice and the ring is a
// whole. The rate that carried on from each stage still lives in the tooltip
// and in the table, because that is the number worth acting on.

const R = 34;          // ring radius in viewBox units
const THICK = 15;      // ring thickness
const GAP = 1.4;       // the surface showing between slices

function Donut({ furthest, reached, total, tip }) {
  const [hot, setHot] = useState(null);
  if (!total) return <p className="viz-note">Nothing applied for in this range.</p>;

  // A circle's path starts at three o'clock, so every slice is offset by an
  // extra quarter turn to start the ring at twelve. Doing it in the dash offset
  // rather than with a rotate() keeps the element transform-free, which matters
  // because a CSS transform-origin on an SVG shape silently overrides the pivot
  // a rotate(a cx cy) attribute carries and slides the whole ring off centre.
  const C = 2 * Math.PI * R;
  let run = 0;
  const slices = furthest.map((f, i) => {
    const frac = f.value / total;
    const at = run;
    run += frac;
    return { ...f, i, frac, at, got: reached[i].value };
  });

  const note = (s) => {
    const prev = s.i ? reached[s.i - 1].value : null;
    const carried = prev ? `${pct(s.got, prev)}% of those who reached ${furthest[s.i - 1].label} carried on` : null;
    return `${s.got} reached this stage${carried ? `, ${carried}` : ''}`;
  };

  return (
    <div className="pie-wrap">
      <div className="pie-plot">
        {/* The total sits in HTML over the ring rather than in an SVG <text>.
            Inside the SVG it is drawn in viewBox units and scaled with the
            artwork, which puts its size, its weight and the gap under it at the
            mercy of the ring's geometry instead of the app's type scale. */}
        <svg viewBox="0 0 100 100" role="img"
          aria-label={`How far ${total} applications got, counted at the furthest stage each reached`}>
          {slices.filter((s) => s.value > 0).map((s) => (
            <circle key={s.label} className={`pie-seg ${hot != null && hot !== s.i ? 'dim' : ''}`}
              cx="50" cy="50" r={R} fill="none" strokeWidth={THICK}
              stroke={`var(${RAMP[s.i]})`}
              strokeDasharray={`${Math.max(0, s.frac * C - GAP)} ${C - Math.max(0, s.frac * C - GAP)}`}
              strokeDashoffset={C / 4 - s.at * C}
              onPointerMove={(e) => { setHot(s.i); tip.show(e, `Got no further than ${s.label.toLowerCase()}`, s.value, note(s)); }}
              onPointerLeave={() => { setHot(null); tip.hide(); }} />
          ))}
        </svg>
        <div className="pie-centre" aria-hidden>
          <strong>{total.toLocaleString()}</strong>
          <span>{total === 1 ? 'application' : 'applications'}</span>
        </div>
      </div>
      <ol className="pie-key">
        {slices.map((s) => (
          <li key={s.label} className={s.value === 0 ? 'none' : ''} tabIndex={0}
            aria-label={`${s.label}: ${s.value} got no further. ${note(s)}`}
            onPointerEnter={() => setHot(s.i)} onPointerLeave={() => setHot(null)}
            onFocus={(e) => { setHot(s.i); tip.showAt(e.currentTarget, `Got no further than ${s.label.toLowerCase()}`, s.value, note(s)); }}
            onBlur={() => { setHot(null); tip.hide(); }}>
            <i style={{ background: `var(${RAMP[s.i]})` }} />
            <span className="pie-name">{s.label}</span>
            <span className="pie-num">{s.value}</span>
            <span className="pie-pc">{pct(s.value, total)}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The activity grid: a column per week, a row per weekday, shaded by how many
// you sent that day. It shows the thing a weekly total hides — the streaks and
// the fortnight you did nothing.

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Activity({ byDay, days, tip }) {
  const counts = new Map(byDay.map((d) => [d.day, d.value]));
  const iso = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
  const num = (s) => Math.floor(Date.parse(`${s}T00:00:00Z`) / 86400000);
  const today = Math.floor(Date.now() / 86400000);
  // On a fixed period the window is that period. On All time it runs back to
  // the first application rather than to some round number, so the grid does
  // not open with months of blank squares from before you started — capped at
  // half a year so a long search still fits across the card.
  const span = days ?? Math.min(182, Math.max(83, byDay.length ? today - num(byDay[0].day) : 83));
  // Start on the Monday on or before the beginning of the window, so every
  // column is a whole week and the weekday rows line up.
  const start = today - span - ((new Date((today - span) * 86400000).getUTCDay() + 6) % 7);
  const weeks = Math.ceil((today - start + 1) / 7);

  const busiest = Math.max(1, ...byDay.map((d) => d.value));
  // Four steps is as many as the eye can rank in a small square. Below five a
  // day, one step each; above that the top step covers the rest.
  const step = (v) => (v === 0 ? 0 : busiest <= 4 ? v : Math.min(4, Math.ceil((v / busiest) * 4)));

  const cells = [];
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const n = start + w * 7 + d;
      cells.push(n > today ? null : { n, day: iso(n), value: counts.get(iso(n)) || 0, w, d });
    }
  }

  // A month label over the first column that starts a new month, but only if
  // there is room: a month that gets two or three columns would print its name
  // on top of its neighbour's.
  const marks = [];
  for (let w = 0; w < weeks; w++) {
    const first = new Date((start + w * 7) * 86400000);
    const prev = new Date((start + (w - 1) * 7) * 86400000);
    if (w > 0 && first.getUTCMonth() === prev.getUTCMonth()) continue;
    if (marks.length && w - marks[marks.length - 1].w < 3) continue;
    marks.push({ w, label: MONTHS[first.getUTCMonth()] });
  }

  // The run of days in a row with at least one application, longest and current.
  const active = new Set(byDay.filter((d) => d.value > 0).map((d) => num(d.day)));
  let best = 0, run = 0;
  for (let n = start; n <= today; n++) {
    run = active.has(n) ? run + 1 : 0;
    if (run > best) best = run;
  }
  let now = 0;
  for (let n = today; active.has(n); n--) now++;

  return (
    <div className="cal-wrap">
      <div className="cal">
        <div className="cal-months" style={{ '--weeks': weeks }} aria-hidden>
          {marks.map((m) => <span key={m.w} style={{ gridColumn: m.w + 1 }}>{m.label}</span>)}
        </div>
        <div className="cal-body">
          <div className="cal-days" aria-hidden>
            {WEEKDAYS.map((d, i) => <span key={d}>{i % 2 === 0 ? d : ''}</span>)}
          </div>
          <div className="cal-grid" style={{ '--weeks': weeks }} role="img"
            aria-label={`Applications per day. ${byDay.length} days with at least one, busiest was ${busiest}.`}>
            {cells.map((c, i) => c === null
              ? <span key={i} className="cal-cell blank" />
              : (
                <span key={i} className={`cal-cell s${step(c.value)}`} style={{ '--i': c.w }}
                  onPointerMove={(e) => tip.show(e, longDay(c.day), c.value, c.value === 1 ? 'application' : 'applications')}
                  onPointerLeave={tip.hide} />
              ))}
          </div>
        </div>
        <div className="cal-key" aria-hidden>
          <span>Quieter</span>
          {[0, 1, 2, 3, 4].map((s) => <i key={s} className={`cal-cell s${s}`} />)}
          <span>Busier</span>
        </div>
      </div>
      <dl className="cal-side">
        <div><dt>Days you sent something</dt><dd>{byDay.length}</dd></div>
        <div><dt>Busiest day</dt><dd>{busiest}</dd></div>
        <div><dt>Longest run</dt><dd>{best}<em>{best === 1 ? 'day' : 'days in a row'}</em></dd></div>
        <div><dt>On a run right now</dt><dd>{now}<em>{now === 1 ? 'day' : 'days'}</em></dd></div>
      </dl>
    </div>
  );
}

function longDay(iso) {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ---------------------------------------------------------------------------
// Where things stand. The bar lengths are the counts, but the colour says
// something the old chart didn't: whether an application is still alive. Live
// stages take the ramp and darken as they go; the ones that are over go grey.
// Every row is labelled, so nothing rests on colour alone.

function Pipeline({ rows, tip }) {
  if (!rows.length) return <p className="viz-note">Nothing to show for this filter.</p>;
  const top = Math.max(1, ...rows.map((r) => r.value));
  const sum = rows.reduce((t, r) => t + r.value, 0);
  const live = rows.filter((r) => !r.closed && !r.waiting).reduce((t, r) => t + r.value, 0);
  const over = rows.filter((r) => r.closed).reduce((t, r) => t + r.value, 0);
  const waiting = sum - live - over;

  const tone = (r) => {
    if (r.waiting) return 'wait';
    if (r.closed) return 'over';
    const i = STAGES.indexOf(r.label);
    return `live s${i < 0 ? 3 : Math.min(6, i + 1)}`;
  };

  return (
    <div className="pipe">
      <div className="pipe-split" role="img"
        aria-label={`${live} still in play, ${over} finished, ${waiting} on the wishlist`}>
        {live > 0 && <i className="live" style={{ flexGrow: live }} />}
        {waiting > 0 && <i className="wait" style={{ flexGrow: waiting }} />}
        {over > 0 && <i className="over" style={{ flexGrow: over }} />}
      </div>
      <div className="pipe-key">
        <span><i className="live" />{live} in play</span>
        {waiting > 0 && <span><i className="wait" />{waiting} on the wishlist</span>}
        {over > 0 && <span><i className="over" />{over} finished</span>}
      </div>
      <ul className="pipe-rows">
        {rows.map((r) => (
          <li key={r.label} tabIndex={0} aria-label={`${r.label}: ${r.value}`}
            onPointerMove={(e) => tip.show(e, r.label, r.value, r.closed ? 'finished' : r.waiting ? 'not applied yet' : 'still in play')}
            onPointerLeave={tip.hide}
            onFocus={(e) => tip.showAt(e.currentTarget, r.label, r.value)}
            onBlur={tip.hide}>
            <span className="pipe-label">{r.label}</span>
            <span className="pipe-track">
              <i className={tone(r)} style={{ width: `${(r.value / top) * 100}%` }} />
            </span>
            <span className="pipe-count">{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One card for the three breakdowns instead of one card each. They ask the
// same question of different columns, and stacking three identical charts down
// the page was most of what made this tab feel repetitive.
//
// Each bar carries its own interview count inside it, on the same scale and in
// the same unit, so "a lot, but none of it goes anywhere" is visible in the
// shape rather than only in the note at the end.

function Breakdown({ data, tip }) {
  const [which, setWhich] = useState('bySource');
  const spec = BREAKDOWNS.find((b) => b.id === which);
  const rows = data[which] || [];
  const top = Math.max(1, ...rows.map((r) => r.value));

  return (
    <Card title={spec.title} subtitle="How many you sent, and how many of those reached an interview"
      tools={<Segmented label="" options={BREAKDOWNS} value={which} onChange={setWhich} />}
      table={{ cols: [spec.label, 'Applications', 'Reached interview'],
        rows: rows.map((r) => [r.label, r.value, `${r.interviews} (${pct(r.interviews, r.value)}%)`]) }}>
      <div className="viz-legend">
        <span className="legend-item"><i className="sw-all" />Applications</span>
        <span className="legend-item"><i className="sw-got" />Reached an interview</span>
      </div>
      {rows.length === 0 ? <p className="viz-note">Nothing to show for this filter.</p> : (
        <Columns rows={rows} top={top} tip={tip} />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Columns, with the interview count drawn from the baseline up inside each
// one. Same axis, same unit, so the dark block's height is the interviews on
// the very same scale as the column it sits in — not a second measure smuggled
// in on a scale of its own.

function Columns({ rows, top, tip }) {
  const step = top <= 5 ? 1 : top <= 10 ? 2 : Math.ceil(top / 5 / 5) * 5;
  const ceiling = Math.ceil(top / step) * step;
  const ticks = Array.from({ length: ceiling / step + 1 }, (_, i) => i * step);

  return (
    <div className="vcols">
      <div className="vcols-axis" aria-hidden>
        {ticks.slice().reverse().map((t) => <span key={t}>{t}</span>)}
      </div>
      <div className="vcols-area">
        {ticks.map((t) => (
          <div key={t} className="vcols-line" style={{ bottom: `${(t / ceiling) * 100}%` }} />
        ))}
        <div className="vcols-bars">
          {rows.map((r) => (
            <div key={r.label} className="vcol-slot" tabIndex={0}
              aria-label={`${r.label}: ${r.value} applications, ${r.interviews} reached an interview`}
              onPointerMove={(e) => tip.show(e, r.label, r.value, `${r.interviews} reached an interview`)}
              onPointerLeave={tip.hide}
              onFocus={(e) => tip.showAt(e.currentTarget, r.label, r.value, `${r.interviews} reached an interview`)}
              onBlur={tip.hide}>
              <span className="vcol-value">{r.value}</span>
              <div className="vcol" style={{ height: `${(r.value / ceiling) * 100}%` }}>
                <b className="vcol-got" style={{ height: `${pct(r.interviews, r.value)}%` }} />
              </div>
              <span className="vcol-label">{r.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One shared tooltip: value first, label second.
function useTooltip() {
  const [state, setState] = useState(null);
  const ref = useRef(null);
  const place = (x, y, label, value, note) => setState({ x, y, label, value, note });
  return {
    show: (e, label, value, note) => place(e.clientX, e.clientY, label, value, note),
    showAt: (el, label, value, note) => {
      const r = el.getBoundingClientRect();
      place(r.left + r.width / 2, r.top, label, value, note);
    },
    hide: () => setState(null),
    node: state && (
      <div
        ref={ref}
        className="viz-tip"
        role="status"
        style={{
          left: Math.min(state.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 220),
          top: state.y - 12,
        }}
      >
        <div className="viz-tip-value">{state.value}</div>
        <div className="viz-tip-label">{state.label}</div>
        {state.note && <div className="viz-tip-label">{state.note}</div>}
      </div>
    ),
  };
}
