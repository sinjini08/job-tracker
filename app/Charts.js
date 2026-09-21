'use client';

import { useMemo, useRef, useState } from 'react';
import { computeStats, pct } from '@/lib/stats';

const PERIODS = [
  { id: 'all', label: 'All time', days: null },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: '30', label: 'Last 30 days', days: 30 },
];
const SHEET_FILTERS = ['All', 'On-Campus', 'Off-Campus'];
const SERIES = { 'On-Campus': 'var(--series-1)', 'Off-Campus': 'var(--series-2)' };
// Used where each bar is its own category (by source, by category).
const CATEGORY_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)',
  'var(--series-4)', 'var(--series-5)'];
// One step per pipeline stage, so the funnel darkens as it narrows.
const FUNNEL_RAMP = ['var(--ord-1)', 'var(--ord-2)', 'var(--ord-3)', 'var(--ord-4)',
  'var(--ord-5)', 'var(--ord-6)', 'var(--ord-7)'];

export default function Charts({ rows, events }) {
  const [sheet, setSheet] = useState('All');
  const [period, setPeriod] = useState('all');
  const tip = useTooltip();

  const data = useMemo(
    () => computeStats(rows, events, { sheet, days: PERIODS.find((p) => p.id === period).days }),
    [rows, events, sheet, period],
  );

  return (
    <div className="charts viz-root">
      <div className="viz-filters" role="toolbar" aria-label="Chart filters">
        <Segmented label="Sheet" options={SHEET_FILTERS.map((s) => ({ id: s, label: s }))} value={sheet} onChange={setSheet} />
        <Segmented label="Period" options={PERIODS} value={period} onChange={setPeriod} />
        {events == null && <span className="viz-note">Loading history…</span>}
      </div>

      {data.total === 0 && data.wishlist === 0 ? (
        <div className="viz-empty">
          <p className="viz-empty-title">No applications here yet</p>
          <p>Charts fill in as you log applications, either by typing in the sheets or by
            pasting a job posting to Claude.</p>
        </div>
      ) : (
        <>
          <div className="viz-kpis">
            <Stat label="Applications" value={data.total} sub={data.wishlist ? `+ ${data.wishlist} on wishlist` : 'sent'} />
            <Stat label="Still in progress" value={data.active} sub="not rejected, withdrawn or silent" />
            <Stat label="Response rate" value={`${data.responseRate}%`} sub={`${data.responded} of ${data.total} heard back`} />
            <Stat label="Reached interview" value={data.interviews} sub={`${pct(data.interviews, data.total)}% of applications`} />
            <Stat label="Offers" value={data.offers} sub={`${pct(data.offers, data.total)}% of applications`} />
          </div>

          <div className="viz-grid">
            <Card title="How far applications get" subtitle="Applications that reached each stage"
              table={{ cols: ['Stage', 'Applications', '% of applied'],
                rows: data.reached.map((r) => [r.label, r.value, `${pct(r.value, data.total)}%`]) }}>
              <HBars rows={data.reached.map((r, i) => ({ ...r, color: FUNNEL_RAMP[i], note: `${pct(r.value, data.total)}%` }))}
                max={data.total} tip={tip} />
            </Card>

            <Card title="Applications per week" subtitle="By the date you applied"
              table={{ cols: ['Week of', ...data.series, 'Total'],
                rows: data.weekly.map((w) => [w.label, ...w.parts.map((p) => p.value), w.parts.reduce((t, p) => t + p.value, 0)]) }}>
              <Columns weeks={data.weekly} series={data.series} tip={tip} />
            </Card>

            <Card title="Where things stand" subtitle="Current status of every application"
              table={{ cols: ['Status', 'Applications'], rows: data.byStatus.map((r) => [r.label, r.value]) }}>
              <HBars rows={data.byStatus} tip={tip} />
            </Card>

            <Card title="By source" subtitle="Where you found the job, and how often it led to an interview"
              table={{ cols: ['Source', 'Applications', 'Reached interview'], rows: data.bySource.map((r) => [r.label, r.value, r.note]) }}>
              <HBars rows={data.bySource.map((r, i) => ({ ...r, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))} tip={tip} />
            </Card>

            <Card title="By category" subtitle="Type of role"
              table={{ cols: ['Category', 'Applications'], rows: data.byCategory.map((r) => [r.label, r.value]) }}>
              <HBars rows={data.byCategory.map((r, i) => ({ ...r, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }))} tip={tip} />
            </Card>
          </div>
        </>
      )}
      {tip.node}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id}
          className={`seg-btn ${value === o.id ? 'on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function Card({ title, subtitle, table, children }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="viz-card">
      <header className="viz-card-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button className="viz-toggle" onClick={() => setAsTable((t) => !t)} aria-pressed={asTable}>
          {asTable ? 'Chart' : 'Table'}
        </button>
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

// Horizontal bars: one per row, label on the left, value at the tip.
function HBars({ rows, max, tip }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="viz-note">Nothing to show for this filter.</p>;
  return (
    <div className="hbars">
      {rows.map((r) => {
        const w = top ? (r.value / top) * 100 : 0;
        const text = `${r.label}: ${r.value}${r.note ? ` · ${r.note}` : ''}`;
        return (
          <div key={r.label} className="hbar-row">
            <span className="hbar-label">{r.label}</span>
            <div
              className="hbar-track"
              tabIndex={0}
              aria-label={text}
              onPointerMove={(e) => tip.show(e, r.label, r.value, r.note)}
              onPointerLeave={tip.hide}
              onFocus={(e) => tip.showAt(e.currentTarget, r.label, r.value, r.note)}
              onBlur={tip.hide}
            >
              <div className="hbar" style={{ width: `${w}%`, background: r.color || 'var(--series-1)' }} />
              <span className="hbar-value">
                {r.value}{r.note && <span className="hbar-note"> · {r.note}</span>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Stacked weekly columns with a clean integer y-axis.
function Columns({ weeks, series, tip }) {
  const maxTotal = Math.max(1, ...weeks.map((w) => w.parts.reduce((t, p) => t + p.value, 0)));
  const step = maxTotal <= 5 ? 1 : maxTotal <= 10 ? 2 : Math.ceil(maxTotal / 5);
  const top = Math.ceil(maxTotal / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const showEvery = weeks.length > 14 ? 2 : 1;

  return (
    <div className="cols">
      {series.length > 1 && (
        <div className="viz-legend">
          {series.map((s) => (
            <span key={s} className="legend-item"><i style={{ background: SERIES[s] }} />{s}</span>
          ))}
        </div>
      )}
      <div className="cols-plot">
        <div className="cols-axis" aria-hidden>
          {ticks.slice().reverse().map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="cols-area">
          {ticks.map((t) => (
            <div key={t} className="gridline" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="cols-bars">
            {weeks.map((w, i) => {
              const total = w.parts.reduce((t, p) => t + p.value, 0);
              const nonzero = w.parts.filter((p) => p.value > 0);
              return (
                <div key={w.label} className="col-slot">
                  <div className="col-stack" style={{ height: `${(total / top) * 100}%` }}>
                    {nonzero.map((p, j) => (
                      <div
                        key={p.series}
                        className={`col-seg ${j === nonzero.length - 1 ? 'cap' : ''}`}
                        style={{ flexGrow: p.value, background: SERIES[p.series] }}
                        tabIndex={0}
                        aria-label={`Week of ${w.label}, ${p.series}: ${p.value}`}
                        onPointerMove={(e) => tip.show(e, `${p.series} · week of ${w.label}`, p.value)}
                        onPointerLeave={tip.hide}
                        onFocus={(e) => tip.showAt(e.currentTarget, `${p.series} · week of ${w.label}`, p.value)}
                        onBlur={tip.hide}
                      />
                    ))}
                  </div>
                  <span className="col-label">{i % showEvery === 0 ? w.label : ''}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

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
