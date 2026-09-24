'use client';

import { useMemo, useState } from 'react';
import { buildInsights, LIMITS } from '@/lib/insights';
import { computeStats } from '@/lib/stats';
import { SHEET_KEYS, sheetLabel } from '@/lib/fields';
import Charts, { PERIODS } from './Charts';
import { quoteOfTheDay } from '@/lib/quotes';

// Charts and insights, on one page, because they were always two halves of the
// same question. The charts say what happened; the rail beside them says what
// it means and what to do about it. Reading one without the other was the
// reason neither tab quite worked on its own.
//
// The rail is ordered by how soon it matters: the dated chores first, then the
// findings, then the written read. Everything in it is arithmetic over the
// student's own rows except the last, which says so.

const MARKS = {
  counterfactual: Arrow,
  'cross-cut': Star,
  lever: People,
  reframe: Bulb,
};

export default function Insights({ rows, events, sheets = SHEET_KEYS, names = {}, onOpen, onPatch }) {
  const [sheet, setSheet] = useState('All');
  const [period, setPeriod] = useState('all');

  const days = PERIODS.find((p) => p.id === period).days;

  // The rail reads the whole search, not the filtered slice: "your live
  // pipeline is 6" is a fact about the search, and answering it differently
  // depending on a date filter would make it a fact about the filter.
  const { state, insights, chores, applied } = useMemo(() => {
    const stats = computeStats(rows ?? [], events ?? [], {});
    return buildInsights(rows ?? [], events ?? [], stats);
  }, [rows, events]);

  return (
    <div className="charts viz-root ins-split">
      <div className="ins-main">
        <header className="ins-top">
          <h2>Insights</h2>
          <div className="ins-filters">
            {sheets.length > 1 && (
              <Picker label="Sheet" value={sheet} onChange={setSheet}
                options={[{ id: 'All', label: 'All sheets' },
                  ...sheets.map((k) => ({ id: k, label: sheetLabel(k, names) }))]} />
            )}
            <Picker label="Period" value={period} onChange={setPeriod} options={PERIODS} />
          </div>
        </header>

        <Charts rows={rows} events={events} sheets={sheets} sheet={sheet} period={period} />
      </div>

      <aside className="ins-rail">
            <p className="ins-quote"><span>Today</span>{quoteOfTheDay()}</p>

            {chores.length > 0 && (
              <section className="ins-block">
                <h3 className="ins-head">Needs you</h3>
                {chores.map((c) => (
                  <Group key={c.id} chore={c} onOpen={onOpen} onPatch={onPatch} />
                ))}
              </section>
            )}

            <section className="ins-block">
              <h3 className="ins-head">What the numbers say</h3>
              {insights.length === 0 ? (
                <p className="ins-quiet">
                  {applied === 0
                    ? 'These fill in as you log applications.'
                    : `Nothing yet that you could not see by scrolling your sheet. Patterns need about ${LIMITS.rates} applications before they mean anything.`}
                </p>
              ) : (
                <ul className="ins-keys">
                  {insights.map((item) => {
                    const Mark = MARKS[item.kind] ?? Bulb;
                    return (
                      <li key={item.id}>
                        <span className="ins-mark" aria-hidden><Mark /></span>
                        <div>
                          <b>{item.claim}</b>
                          <p>{item.support}</p>
                          {item.rows?.length > 0 && onOpen && (
                            <button type="button" className="ins-link" onClick={() => onOpen(item.rows)}>
                              Show the {item.rows.length}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

        <AskYours />
      </aside>
    </div>
  );
}

// A dropdown rather than a row of buttons: the page header has two of these
// and a segmented control each would be most of the header.
function Picker({ label, value, options, onChange }) {
  return (
    <label className="ins-pick">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

// The one part that isn't arithmetic. Nothing is sent anywhere until the button
// is pressed, and the button only exists when the feature is switched on at the
// server. Asking again with nothing changed returns the read already paid for.
// One kind of reminder, folded until you want the names. Closed it is a line
// and a count, which is all most days need; open it is the list of jobs you
// have chosen to keep being reminded about.
function Group({ chore, onOpen, onPatch }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`ins-group ${open ? 'on' : ''}`}>
      <button type="button" className="ins-group-top" aria-expanded={open} onClick={() => setOpen(!open)}>
        <svg className={`ins-caret ${open ? 'on' : ''}`} viewBox="0 0 10 6" aria-hidden>
          <path d="M1 1.5l4 3.5 4-3.5" />
        </svg>
        <b>{chore.label}</b>
        <em>{chore.count}</em>
      </button>
      {open && (
        <>
          <p className="ins-group-note">{chore.note}</p>
          <ul className="ins-jobs">
            {chore.items.map((it) => (
              <li key={it.id}>
                {/* The row is the action: the employer's own name says what
                    clicking it will show, which "Show" never did. */}
                <button type="button" className="ins-job" onClick={() => onOpen([it.id])}>
                  <span className="ins-job-name">{it.name}</span>
                  <span className="ins-job-when">{it.when}</span>
                </button>
                {onPatch && (
                  <button type="button" className="ins-mute"
                    title={`Stop reminding me about ${it.name}. The dates stay as they are.`}
                    aria-label={`Stop reminding me about ${it.name}`}
                    onClick={() => onPatch(it.id, { remind: false })}>
                    <svg viewBox="0 0 12 12" aria-hidden><path d="M3 3l6 6M9 3l-6 6" /></svg>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// Everything above is arithmetic, and arithmetic has a ceiling: it can say
// which channel answers, not what to write. That part belongs to the assistant
// the student already has, which can read this tracker directly.
function AskYours() {
  return (
    <section className="ins-block ins-ask">
      <h3 className="ins-head">Want more than numbers?</h3>
      <p>
        Connect your tracker to Claude or ChatGPT in <a href="/settings">Settings</a> and it can
        read your applications directly. Useful for the judgement calls: how to word a follow-up,
        whether a posting is worth the afternoon, what a rejection is telling you.
      </p>
      <p className="ins-ask-eg">
        Try: <i>&ldquo;Look through my tracker and tell me what to do this week.&rdquo;</i>
      </p>
    </section>
  );
}

// Small marks, one per shape of claim, so the rail scans as a list of kinds
// rather than a wall of sentences.
const svg = (d, extra) => (
  <svg viewBox="0 0 16 16" aria-hidden>{d}{extra}</svg>
);
function Arrow() { return svg(<path d="M4 11.5L11.5 4M6 4h5.5V9.5" />); }
function Star() { return svg(<path d="M8 2.5l1.7 3.5 3.8.5-2.8 2.7.7 3.8L8 11.2 4.6 13l.7-3.8L2.5 6.5l3.8-.5z" />); }
function People() { return svg(<><circle cx="6" cy="6" r="2.2" /><circle cx="11.2" cy="6.8" r="1.7" /><path d="M2.5 13c.6-2 2-3 3.5-3s2.9 1 3.5 3M10.5 10.2c1.4 0 2.5.9 3 2.3" /></>); }
function Bulb() { return svg(<><path d="M8 2.5a3.6 3.6 0 00-2.2 6.5c.5.4.8 1 .8 1.6h2.8c0-.6.3-1.2.8-1.6A3.6 3.6 0 008 2.5z" /><path d="M6.8 13h2.4" /></>); }
