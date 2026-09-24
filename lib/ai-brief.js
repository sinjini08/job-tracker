// Exactly what leaves this app when a student asks for a written read.
//
// It is a summary, not a copy of the tracker. Companies, pay, links, contacts
// and notes are never in it. What goes is: the figures already on the Insights
// tab, the findings the rules produced, and — only where the student pasted it
// themselves — a trimmed slice of posting text, because comparing what the
// jobs that answered were asking for against the ones that didn't is the one
// question arithmetic cannot settle.
//
// Kept deliberately small. A short brief is cheaper, faster, and gives a model
// less room to wander away from the numbers it was given.

import { CLOSED, STAGES, STAGE_RANK, appliedOn, reachedIndex } from './stats.js';
import { dayNumber, todayISO } from './format.js';

const MAX_ROLES = 12;
const MAX_SNIPPETS = 6;
const SNIPPET_CHARS = 400;

const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function buildBrief(rows, events, stats, insights, { today = todayISO() } = {}) {
  const now = dayNumber(today);
  const reached = reachedIndex(events);
  const applied = (rows ?? []).filter((a) => a.status !== 'Wishlist');

  const tally = (key) => {
    const m = new Map();
    for (const a of applied) {
      const k = clean(a[key], 40) || 'not recorded';
      const seen = m.get(k) ?? { sent: 0, replied: 0, interviewed: 0 };
      seen.sent += 1;
      if (reached(a) >= STAGE_RANK.Screening || CLOSED.has(a.status)) seen.replied += 1;
      if (reached(a) >= STAGE_RANK.Interviewing) seen.interviewed += 1;
      m.set(k, seen);
    }
    return [...m].map(([k, v]) => ({ [key]: k, ...v })).sort((x, y) => y.sent - x.sent).slice(0, 8);
  };

  const dates = applied.map((a) => appliedOn(a)).filter(Boolean).map(dayNumber);
  const weeksSpanned = dates.length ? Math.max(1, Math.round((now - Math.min(...dates)) / 7)) : 0;

  // The one genuinely textual question: what were the jobs that answered
  // asking for, against the ones that didn't? Only from text the student
  // pasted in themselves, and only the first few hundred characters of it.
  const snippet = (a) => clean(a.requirements || a.job_description, SNIPPET_CHARS);
  const withText = applied.filter((a) => snippet(a));
  const got = withText.filter((a) => reached(a) >= STAGE_RANK.Screening);
  const didnt = withText.filter((a) => reached(a) < STAGE_RANK.Screening);

  return {
    today,
    totals: {
      applied: applied.length,
      still_open: applied.filter((a) => !CLOSED.has(a.status)).length,
      on_wishlist: (rows ?? []).length - applied.length,
      reply_rate_percent: stats?.responseRate ?? 0,
      interviews: stats?.interviews ?? 0,
      offers: stats?.offers ?? 0,
    },
    funnel: (stats?.reached ?? []).map((r, i) => ({ stage: STAGES[i], ever_reached: r.value })),
    pace: {
      applications_last_7_days: dates.filter((d) => now - d < 7).length,
      weekly_average: weeksSpanned ? +(dates.length / weeksSpanned).toFixed(1) : 0,
      days_since_last_application: dates.length ? now - Math.max(...dates) : null,
    },
    by_source: tally('source'),
    by_category: tally('category'),
    referrals: {
      referred: applied.filter((a) => a.referral).length,
      referred_replied: applied.filter((a) => a.referral && reached(a) >= STAGE_RANK.Screening).length,
    },
    roles_applied_for: [...new Set(applied.map((a) => clean(a.role, 60)).filter(Boolean))].slice(0, MAX_ROLES),
    // What the rules already found, so the model builds on it rather than
    // rediscovering it and contradicting the page beside it. Claims only: the
    // chores name the employer they are about ("Oldest: Acme"), and no
    // employer belongs in here, because the question being asked is what the
    // pattern is and a pattern never needs one.
    state: insights?.state ?? null,
    findings: (insights?.insights ?? []).map((c) => ({ id: c.id, kind: c.kind, claim: c.claim })),
    postings_that_replied: got.slice(0, MAX_SNIPPETS).map(snippet),
    postings_that_did_not: didnt.slice(0, MAX_SNIPPETS).map(snippet),
  };
}
