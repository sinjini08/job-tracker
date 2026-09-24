// What the numbers say that the sheet doesn't.
//
// The first version of this file restated things. "Two follow-ups are overdue"
// is already a column and a counter in the footer; "most applications never get
// a reply" is true of everyone alive. Seven cards of that, all the same size,
// buried the one line that was worth reading.
//
// So this file now separates two kinds of thing and treats them differently:
//
//   CHORES are dated and obvious. Overdue follow-ups, deadlines this week,
//   applications to close out. Worth surfacing, not worth a paragraph. They
//   come back as one compact strip.
//
//   INSIGHTS have to earn the word. A claim only qualifies if it is one of
//   four shapes, none of which can be read off the grid:
//     a REFRAME    — the number you think you have is not the number you have
//     a COUNTERFACTUAL — what a choice cost you, in the units you care about
//     a FORECAST   — where this rate gets you, and when
//     an UNUSED LEVER — the thing that works that you have barely tried
//   At most three are returned, strongest first, and when nothing clears the
//   bar nothing is returned. Silence is a better answer than filler.
//
// Everything is arithmetic over the student's own rows, so every claim carries
// the figures it was built from and can be checked.

import { CLOSED, STAGES, STAGE_RANK, STALE_DAYS, appliedOn, heardBackFrom, pct, reachedIndex } from './stats.js';
import { dayNumber, todayISO } from './format.js';

export const LIMITS = {
  rates: 8,        // applications before comparing anything by rate
  bucket: 3,       // per source before that source is compared
  reframe: 6,      // applications before the live/total split is worth naming
  forecast: 8,     // applications before extrapolating a rate
  stale: STALE_DAYS, // shared with lib/stats, so the page cannot argue with itself
  deadline: 7,     // days ahead to count a deadline as near
  shown: 3,        // insights on screen at once
};

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const name = (a) => a.company?.trim() || a.role?.trim() || 'one application';

export function buildInsights(rows, events, stats, { today = todayISO() } = {}) {
  const now = dayNumber(today);
  const reached = reachedIndex(events);
  const daysAgo = (iso) => (iso ? now - dayNumber(iso) : null);

  const all = rows ?? [];
  const applied = all.filter((a) => a.status !== 'Wishlist');
  const wishlist = all.filter((a) => a.status === 'Wishlist');
  const open = applied.filter((a) => !CLOSED.has(a.status));
  const stale = open.filter((a) => a.status === 'Applied' && appliedOn(a) && daysAgo(appliedOn(a)) >= LIMITS.stale);
  const live = open.filter((a) => !stale.includes(a));
  const replied = applied.filter((a) => heardBackFrom(a, reached));
  const screened = applied.filter((a) => reached(a) >= STAGE_RANK.Screening);
  const interviewed = applied.filter((a) => reached(a) >= STAGE_RANK.Interviewing);

  const dates = applied.map((a) => appliedOn(a)).filter(Boolean).map(dayNumber);
  const weeks = dates.length ? Math.max(1, (now - Math.min(...dates)) / 7) : 0;
  const perWeek = weeks ? applied.length / weeks : 0;

  // ---- the strip -----------------------------------------------------------

  // Only applications that still want chasing. Turning a reminder off leaves
  // its dates alone, so it is a decision about this job rather than an edit.
  const wants = (a) => a.remind !== false;

  const overdue = open
    .filter((a) => wants(a) && a.next_follow_up && dayNumber(a.next_follow_up) < now)
    .sort((x, y) => dayNumber(x.next_follow_up) - dayNumber(y.next_follow_up));
  const soon = wishlist
    .filter((a) => wants(a) && a.deadline && dayNumber(a.deadline) >= now
      && dayNumber(a.deadline) - now <= LIMITS.deadline)
    .sort((x, y) => dayNumber(x.deadline) - dayNumber(y.deadline));
  const staleWanted = stale.filter(wants);

  // Each reminder names the applications behind it, so the rail can show what
  // it is actually talking about rather than a number and a button.
  const item = (a, when) => ({ id: a.id, name: name(a), when });
  const days = (n) => (n === 1 ? '1 day' : `${n} days`);

  const chores = [
    overdue.length && {
      id: 'followups',
      label: 'Follow up',
      count: overdue.length,
      note: 'A week is the usual gap. These are past theirs.',
      items: overdue.map((a) => item(a, `${days(daysAgo(a.next_follow_up))} late`)),
    },
    soon.length && {
      id: 'deadlines',
      label: 'Closing soon',
      count: soon.length,
      note: 'Still on your wishlist, so nothing has gone in yet.',
      items: soon.map((a) => {
        const left = dayNumber(a.deadline) - now;
        return item(a, left === 0 ? 'today' : left === 1 ? 'tomorrow' : `in ${days(left)}`);
      }),
    },
    staleWanted.length && {
      id: 'stale',
      label: 'Gone quiet',
      count: staleWanted.length,
      note: 'Three weeks at Applied. Chase them or mark them No reply.',
      items: staleWanted.map((a) => item(a, `${days(daysAgo(appliedOn(a)))} ago`)),
    },
  ].filter(Boolean);

  // ---- where you stand -----------------------------------------------------

  // One interview every N weeks at this rate. Uses interviews when there are
  // any and screenings otherwise, because a forecast built on zero of
  // something is not a forecast.
  const rateOf = (hit, unit) => {
    if (!hit.length || !perWeek || applied.length < LIMITS.forecast) return null;
    const every = Math.round((applied.length / hit.length) / perWeek);
    return every >= 1 && every <= 52 ? { unit, every } : null;
  };

  const state = {
    applied: applied.length,
    live: live.length,
    closed: applied.length - live.length,
    forecast: rateOf(interviewed, 'interview') ?? rateOf(screened, 'screening'),
  };

  // ---- the three that have to earn it --------------------------------------

  // Ranking. Each rule scored itself on its own scale before, so a referral
  // rate of 100 outranked a channel that had cost five replies, and the
  // sharpest line on the page came last. Priority is now set by SHAPE first —
  // what a claim costs you beats what it reframes, which beats what it
  // suggests — and magnitude only breaks ties inside a shape.
  const BASE = {
    counterfactual: 70,
    'cross-cut': 55,
    lever: 45,
    reframe: 35,
  };
  const found = [];
  const add = (size, insight) =>
    found.push({ ...insight, weight: (BASE[insight.kind] ?? 0) + Math.min(size, 14) });

  // REFRAME. The count on the tab is not the count that is doing anything.
  if (applied.length >= LIMITS.reframe && live.length < applied.length * 0.8) {
    const dead = applied.length - live.length;
    const rejected = dead - stale.length;
    add(stale.length, {
      id: 'pipeline-reframe',
      kind: 'reframe',
      claim: `${live.length} of your ${applied.length} are still moving`,
      support: [
        stale.length && `${stale.length} ${plural(stale.length, 'has', 'have')} been at Applied for over three weeks`,
        rejected > 0 && `${rejected} ${plural(rejected, 'has', 'have')} closed`,
      ].filter(Boolean).join(' and ') + `. Those ${live.length} are the ones worth your time this week.`,
      rows: stale.map((a) => a.id),
    });
  }

  // COUNTERFACTUAL. What the weaker channel cost, priced in replies.
  if (applied.length >= LIMITS.rates) {
    const buckets = byKey(applied.filter((a) => a.source?.trim()), 'source', reached)
      .filter((b) => b.n >= LIMITS.bucket)
      .sort((x, y) => y.rate - x.rate);
    if (buckets.length >= 2) {
      const best = buckets[0];
      const worst = buckets[buckets.length - 1];
      const would = Math.round((worst.n * best.rate) / 100);
      const lost = would - worst.replies;
      if (lost >= 2) {
        add(lost, {
          id: 'channel-cost',
          kind: 'counterfactual',
          claim: `${best.key} answers you more often than ${worst.key}`,
          support: `${best.replies} of your ${best.n} ${best.key} applications came back, against ${worst.replies} of ${worst.n} on ${worst.key}. Worth putting more of the next batch through ${best.key}.`,
          rows: worst.rows,
        });
      }
    }
  }

  // UNUSED LEVER. The thing that works, that you have barely tried.
  const referred = applied.filter((a) => a.referral);
  const cold = applied.filter((a) => !a.referral);
  if (referred.length >= 2 && cold.length >= LIMITS.bucket) {
    const hit = referred.filter((a) => heardBackFrom(a, reached)).length;
    const coldRate = pct(cold.filter((a) => heardBackFrom(a, reached)).length, cold.length);
    const refRate = pct(hit, referred.length);
    const minority = referred.length <= applied.length / 3;
    if (refRate >= Math.max(50, coldRate * 2) && minority) {
      const oneIn = Math.round(applied.length / referred.length);
      add((refRate - coldRate) / 8, {
        id: 'referral-lever',
        kind: 'lever',
        claim: hit === referred.length
          ? 'Referrals have worked every time you have used one'
          : 'Referred applications hear back more often',
        support: `${hit} of your ${referred.length} referred ${plural(referred.length, 'application')} got a reply, against ${pct(cold.filter((a) => heardBackFrom(a, reached)).length, cold.length)}% of the rest. So far you have used a referral on about 1 application in ${oneIn}.`,
        rows: referred.map((a) => a.id),
      });
    }
  }

  // UNUSED LEVER. Nobody has been spoken to at all.
  // A referral is contact, so this cannot be claimed alongside one. Both rules
  // firing at once put a contradiction on the same screen.
  const spokeTo = applied.filter((a) => a.reached_out_on || a.outreach_method?.trim() || a.referral);
  if (applied.length >= LIMITS.rates && spokeTo.length === 0 && pct(replied.length, applied.length) < 40) {
    add(14, {
      id: 'no-outreach',
      kind: 'lever',
      claim: 'No direct contact recorded yet',
      support: `All ${applied.length} went in through a form, and ${replied.length} came back. Messaging one person at a company you have applied to is the thing here you have not tried.`,
      rows: [],
    });
  }

  // REFRAME. Where the funnel actually narrows, phrased as who stopped.
  if (screened.length >= LIMITS.bucket && interviewed.length < screened.length) {
    const stopped = screened.length - interviewed.length;
    add(stopped, {
      id: 'screen-wall',
      kind: 'reframe',
      claim: 'The screening call is where things stop',
      support: `${screened.length} employers screened you and ${interviewed.length} went further. Getting noticed is working; the next step is a clear two-minute answer to what you do and why this role.`,
      rows: screened.map((a) => a.id),
    });
  }

  // CROSS-CUT. One kind of role is carrying the replies.
  if (applied.length >= LIMITS.rates && replied.length >= LIMITS.bucket) {
    const byRole = byKey(applied.filter((a) => a.role?.trim()), 'role', reached)
      .filter((b) => b.n >= 2 && b.replies > 0)
      .sort((x, y) => y.rate - x.rate);
    if (byRole.length >= 2) {
      const top = byRole[0];
      const share = pct(top.n, applied.length);
      const ofReplies = pct(top.replies, replied.length);
      if (ofReplies >= share * 2 && top.replies >= 2) {
        add((ofReplies - share) / 5, {
          id: 'role-cut',
          kind: 'cross-cut',
          claim: `${top.key} roles reply more often than the rest`,
          support: `${top.replies} of your ${replied.length} ${plural(replied.length, 'reply', 'replies')} came from ${top.n} ${plural(top.n, 'application')} to ${top.key}. It may be worth sending more of them.`,
          rows: top.rows,
        });
      }
    }
  }

  const insights = found.sort((x, y) => y.weight - x.weight).slice(0, LIMITS.shown)
    .map(({ weight, ...rest }) => rest);

  return { state, insights, chores, applied: applied.length };
}

// Replies and rates for one column's values.
function byKey(list, key, reached) {
  const m = new Map();
  for (const a of list) {
    const k = a[key].trim();
    m.set(k, [...(m.get(k) ?? []), a]);
  }
  return [...m].map(([k, group]) => {
    const replies = group.filter((a) => heardBackFrom(a, reached)).length;
    return { key: k, n: group.length, replies, rate: pct(replies, group.length), rows: group.map((a) => a.id) };
  });
}

export { STAGES };
