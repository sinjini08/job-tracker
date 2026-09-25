'use client';

import { useId, useMemo, useRef, useState } from 'react';

// Points per day, drawn as lines over a soft fill, with the daily target as a
// dashed rule so "above the line" reads as "won that day".
//
// The series colours are the fixed categorical order from globals.css, never
// cycled: past five members the chart shows the top five and says so, which is
// the honest alternative to inventing a sixth hue.

const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
const MAX_SERIES = 5;

const PAD = { top: 14, right: 14, bottom: 26, left: 34 };
const W = 720;
const H = 240;

// The array from league_board ends today; walk backwards to get each date.
export function seriesDates(length) {
  const out = [];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = length - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d);
  }
  return out;
}

const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function DayChart({ series, target, title, subtitle, monthOnly = true }) {
  // No target passed (the personal chart) means no rule and no "won" tag.
  const showTarget = Number(target) > 0;
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);
  // useId returns something with punctuation in it, which is legal in an id
  // and not legal inside url(#...). Stripped to letters and digits.
  const gradId = useId().replace(/[^a-zA-Z0-9]/g, '');

  const { lines, dates, max, hidden } = useMemo(() => {
    const longest = Math.max(0, ...series.map((s) => s.daily?.length ?? 0));
    let dates = seriesDates(longest);
    let slice = 0;
    if (monthOnly) {
      // Only this calendar month, so "This month" means the month.
      const first = dates.findIndex((d) => d.getDate() === 1 && d.getMonth() === new Date().getMonth());
      slice = first > 0 ? first : 0;
      dates = dates.slice(slice);
    }
    const withData = series.filter((s) => Array.isArray(s.daily));
    const ranked = [...withData].sort((a, b) =>
      (b.daily.slice(slice).reduce((t, n) => t + n, 0)) - (a.daily.slice(slice).reduce((t, n) => t + n, 0)));
    const shown = ranked.slice(0, MAX_SERIES);
    const lines = shown.map((s, i) => ({
      ...s,
      color: SERIES[i],
      values: s.daily.slice(slice),
    }));
    // Yours last, so it draws over the others rather than under them.
    lines.sort((a, b) => Number(Boolean(a.mine)) - Number(Boolean(b.mine)));
    const max = Math.max(showTarget ? target * 1.2 : 0, ...lines.flatMap((l) => l.values), 1);
    return { lines, dates, max, hidden: ranked.length - shown.length };
  }, [series, target, monthOnly, showTarget]);

  if (!lines.length || dates.length < 2) {
    return <p className="muted">No days to draw yet. Points show up here as you log applications.</p>;
  }

  const filled = lines.find((l) => l.mine) ?? (lines.length === 1 ? lines[0] : null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (dates.length === 1 ? plotW / 2 : (i / (dates.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (Math.min(v, max) / max) * plotH;

  // Curved, not cornered, and specifically monotone cubic rather than the
  // usual Catmull-Rom.
  //
  // Catmull-Rom is two lines shorter and overshoots: between a 0 and a 4 it
  // bulges past both, so a line dips below zero points and rises above the
  // day's actual best. On a chart of somebody's real week that is the mark
  // lying about the data, which is worse than a sharp corner.
  //
  // Fritsch-Carlson picks tangents that cannot overshoot: where consecutive
  // points move the same way the curve stays between them, and where the
  // direction changes the tangent is flattened to zero, so every peak and
  // trough sits exactly on its own data point.
  const curve = (values) => {
    const n = values.length;
    if (n === 0) return '';
    const px = values.map((_, i) => x(i));
    const py = values.map((v) => y(v));
    if (n === 1) return `M${px[0].toFixed(1)},${py[0].toFixed(1)}`;

    // Secant slope of each span.
    const d = [];
    for (let i = 0; i < n - 1; i += 1) d.push((py[i + 1] - py[i]) / (px[i + 1] - px[i]));

    // Tangent at each point. Flat wherever the direction reverses, which is
    // every peak and trough, and the average of the two spans elsewhere.
    //
    // Zeroing on a reversal is the part that actually prevents overshoot, and
    // leaving it out is a quiet failure: the curve still looks smooth, it just
    // sails past the data. With points at 5, 0, 5 the control points reached
    // 12% above the highest day and below zero, so a chart of points per day
    // showed a negative day.
    const m = [d[0]];
    for (let i = 1; i < n - 1; i += 1) {
      m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
    }
    m.push(d[n - 2]);

    // Then the Fritsch-Carlson clamp, for spans where the averaged tangent is
    // still too steep to stay between its own two points.
    for (let i = 0; i < n - 1; i += 1) {
      if (d[i] === 0) {                       // a flat span pins both ends flat
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const h = a * a + b * b;
      if (h > 9) {
        const t = 3 / Math.sqrt(h);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }

    let out = `M${px[0].toFixed(1)},${py[0].toFixed(1)}`;
    for (let i = 0; i < n - 1; i += 1) {
      const dx = (px[i + 1] - px[i]) / 3;
      out += ` C${(px[i] + dx).toFixed(1)},${(py[i] + m[i] * dx).toFixed(1)}`
        + ` ${(px[i + 1] - dx).toFixed(1)},${(py[i + 1] - m[i + 1] * dx).toFixed(1)}`
        + ` ${px[i + 1].toFixed(1)},${py[i + 1].toFixed(1)}`;
    }
    return out;
  };

  const path = curve;
  const area = (values) =>
    `${path(values)} L${x(values.length - 1).toFixed(1)},${(PAD.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + plotH).toFixed(1)} Z`;

  // A tick every few days, so the axis stays readable at a month's width. The
  // last day is always worth labelling — unless it would collide with the tick
  // before it, which is what happens whenever the span isn't a clean multiple.
  const step = Math.max(1, Math.ceil(dates.length / 7));
  const ticks = dates.map((d, i) => ({ d, i })).filter(({ i }) => i % step === 0);
  const lastIndex = dates.length - 1;
  if (lastIndex - ticks[ticks.length - 1].i >= Math.ceil(step / 2)) {
    ticks.push({ d: dates[lastIndex], i: lastIndex });
  } else {
    ticks[ticks.length - 1] = { d: dates[lastIndex], i: lastIndex };
  }

  const onMove = (e) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box) return;
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.left) / plotW) * (dates.length - 1));
    setHover(i >= 0 && i < dates.length ? i : null);
  };

  return (
    <figure className="daychart">
      {(title || subtitle) && (
        <figcaption>
          {title && <h4>{title}</h4>}
          {subtitle && <p>{subtitle}</p>}
        </figcaption>
      )}
      <div className="chart-legend">
        {lines.map((l) => (
          <span key={l.key ?? l.label}><i style={{ background: l.color }} />{l.label}</span>
        ))}
        {showTarget && <span className="legend-rule"><i className="rule" />target {target}</span>}
      </div>

      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        aria-label={`Points per day for ${lines.map((l) => l.label).join(', ')}`}>
        <defs>
          {filled && (
            <linearGradient id={`fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={filled.color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={filled.color} stopOpacity="0" />
            </linearGradient>
          )}
        </defs>

        {[0, 0.5, 1].map((f) => (
          <line key={f} className="chart-grid" x1={PAD.left} x2={W - PAD.right}
            y1={PAD.top + plotH * f} y2={PAD.top + plotH * f} />
        ))}
        {[0, Math.round(max / 2), Math.round(max)].map((v, i) => (
          <text key={v + '-' + i} className="chart-axis" x={PAD.left - 8} y={y(v)} textAnchor="end" dominantBaseline="middle">{v}</text>
        ))}

        {/* Grouped so the fills and lines rise together off the baseline.
            non-scaling-stroke keeps the 2px line 2px while it's mid-scale. */}
        <g className="chart-rise" style={{ transformOrigin: `0px ${PAD.top + plotH}px` }}>
          {/* One fill. Three of them overlapped into brown sludge and buried
              the lines they were meant to support, which is the whole reason
              a chart like this reads as cluttered. Everybody else is a
              stroke, thinner and quieter, so the shape of your own month is
              the thing the eye lands on. */}
          {filled && <path d={area(filled.values)} fill={`url(#fill-${gradId})`} />}
        {/* The target sits above the fill so it never gets lost under it. */}
        {showTarget && <line className="chart-target" x1={PAD.left} x2={W - PAD.right} y1={y(target)} y2={y(target)} />}
          {lines.map((l) => (
            <path key={`l-${l.key ?? l.label}`} d={path(l.values)} fill="none" stroke={l.color}
              strokeWidth={l === filled ? 2.5 : 1.6}
              opacity={filled && l !== filled ? 0.7 : 1}
              strokeLinejoin="round" strokeLinecap="round"
              vectorEffect="non-scaling-stroke" />
          ))}
        </g>

        {hover != null && (
          <>
            <line className="chart-cross" x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} />
            {lines.map((l) => (
              <circle key={`d-${l.key ?? l.label}`} cx={x(hover)} cy={y(l.values[hover] ?? 0)} r="4"
                fill={l.color} stroke="var(--viz-surface)" strokeWidth="2" />
            ))}
          </>
        )}

        {ticks.map(({ d, i }) => (
          <text key={i} className="chart-axis" x={x(i)} y={H - 8} textAnchor="middle">{fmtDay(d)}</text>
        ))}
      </svg>

      {hover != null && (
        <div className="chart-readout">
          <b>{fmtDay(dates[hover])}</b>
          {lines.map((l) => (
            <span key={l.key ?? l.label}>
              <i style={{ background: l.color }} />{l.label}
              <b>{l.values[hover] ?? 0}</b>
              {showTarget && (l.values[hover] ?? 0) >= target && <em>won</em>}
            </span>
          ))}
        </div>
      )}
      {hidden > 0 && <p className="league-fine">Showing the top {MAX_SERIES}. There are {hidden} more in the league.</p>}
    </figure>
  );
}
