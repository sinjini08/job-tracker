'use client';

import { useMemo } from 'react';
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
