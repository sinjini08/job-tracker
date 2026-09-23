'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildInsights, LIMITS } from '@/lib/insights';
import { computeStats } from '@/lib/stats';

// What the numbers are telling you to do next.
//
// Every card is arithmetic over your own rows (see lib/insights), so each one
// shows the figure behind it and, where it is about particular applications,
// opens them. Nothing here is generated and nothing is guessed: if the rules
// cannot say something worth acting on, the page says that instead of filling
// the space.

const TONE_WORD = {
  urgent: 'Do this first',
  nudge: 'Worth doing',
  watch: 'Pattern',
  win: 'Going well',
  info: 'To get more out of this',
};

export default function Insights({ rows, events, onOpen }) {
  const { cards, applied, enough } = useMemo(() => {
    const stats = computeStats(rows ?? [], events ?? [], {});
    return buildInsights(rows ?? [], events ?? [], stats);
  }, [rows, events]);

  return (
    <div className="charts viz-root">
      <div className="insights">
        <header className="ins-head">
          <h2>What to do next</h2>
          <p>
            Worked out from your own rows, not guessed. Every number here is one you can click
            through to.
          </p>
        </header>

        <Read applied={applied} />

        {cards.length === 0 && (
          <div className="ins-empty">
            <b>Nothing worth flagging yet.</b>
            <p>
              {applied === 0
                ? 'Log what you have applied to and this fills in. Follow-up dates and deadlines show up here the moment they matter.'
                : `You have ${applied} ${applied === 1 ? 'application' : 'applications'} logged and nothing overdue, which is the quiet version of on track. Rates and patterns need about ${LIMITS.rates} before they say anything honest.`}
            </p>
          </div>
        )}

        {cards.map((card) => (
          <article key={card.id} className={`ins-card ${card.tone}`}>
            <div className="ins-side">
              {card.stat && (
                <>
                  <b className="ins-num">{card.stat.value}</b>
                  <small>{card.stat.label}</small>
                </>
              )}
            </div>
            <div className="ins-body">
              <small className="ins-tone">{TONE_WORD[card.tone]}</small>
              <h3>{card.title}</h3>
              <p>{card.detail}</p>
              {card.rows?.length > 0 && onOpen && (
                <button type="button" className="viz-toggle" onClick={() => onOpen(card.rows)}>
                  Show {card.rows.length === 1 ? 'it' : `these ${card.rows.length}`} on the sheet
                </button>
              )}
            </div>
          </article>
        ))}

        {cards.length > 0 && !enough && (
          <p className="ins-fine">
            Some of this stays quiet until you have around {LIMITS.rates} applications. A rate over
            four of them is noise, and there is no point dressing noise up as advice.
          </p>
        )}
      </div>
    </div>
  );
}

// The one part of this page that isn't arithmetic: a short written read of
// what the figures add up to.
//
// Nothing is sent anywhere until the button is pressed, and the button only
// exists when the feature is switched on at the server. Asking again with
// nothing changed returns the read already paid for rather than writing a new
// one, so the cost lands once per change rather than once per visit.
function Read({ applied }) {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    let live = true;
    fetch('/api/insights')
      .then((r) => r.json())
      .then((d) => live && setState(d.enabled
        ? { status: 'ready', read: d.read?.body ?? null, at: d.read?.created_at ?? null }
        : { status: 'off' }))
      .catch(() => live && setState({ status: 'off' }));
    return () => { live = false; };
  }, []);

  const write = useCallback(async (force) => {
    setState((s) => ({ ...s, status: 'writing' }));
    try {
      const res = await fetch(`/api/insights${force ? '?force=1' : ''}`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not write a read just now.');
      setState({ status: 'ready', read: d.read?.body ?? null, at: d.read?.created_at ?? null });
    } catch (e) {
      setState((s) => ({ ...s, status: 'ready', error: e.message }));
    }
  }, []);

  if (state.status === 'off' || state.status === 'loading') return null;

  const { read, error } = state;
  const busy = state.status === 'writing';

  return (
    <section className="ins-read">
      <div className="ins-read-top">
        <h3>A read of your search</h3>
        <button type="button" className="viz-toggle" disabled={busy || applied === 0}
          onClick={() => write(Boolean(read))}>
          {busy ? 'Reading…' : read ? 'Read it again' : 'Write me a read'}
        </button>
      </div>

      {error && <p className="ins-read-err" role="alert">{error}</p>}

      {!read && !error && (
        <p className="ins-read-hint">
          {applied === 0
            ? 'Once you have logged a few applications, this can look at what they add up to.'
            : 'The cards above are each one number. This looks at them together and says what they mean for the week ahead. Your companies, pay, links, contacts and notes are never part of it.'}
        </p>
      )}

      {read && (
        <>
          <p className="ins-read-body">{read.read}</p>
          {read.moves?.length > 0 && (
            <ol className="ins-moves">
              {read.moves.map((m, i) => (
                <li key={i}><b>{m.do}</b><span>{m.because}</span></li>
              ))}
            </ol>
          )}
          <small className="ins-read-fine">
            Written by Claude from a summary of your figures, so read it as a second opinion rather
            than a fact. The numbers above are the facts.
          </small>
        </>
      )}
    </section>
  );
}
