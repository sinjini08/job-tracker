// What the numbers are telling you to do next.
//
// Every card here is arithmetic over the student's own rows. Nothing is
// guessed and nothing is generated: each one carries the figure it came from
// and the applications it is about, so it can be checked and clicked through.
// That is the point. An insight you cannot trace is one you cannot act on.
//
// Two rules the whole file follows:
//
//   Say nothing rather than something thin. A rate over four applications is
//   noise, and dressing noise up as advice is how a tool loses someone's
//   trust. Each rule below states the sample it needs and stays quiet under
//   it, and where a rule is silent for a fixable reason (no sources recorded)
//   it says so instead of just vanishing.
//
//   One number, one action. A card that does not change what the student does
//   this afternoon is not worth its space.

import { CLOSED, STAGES, STAGE_RANK, appliedOn, heardBackFrom, pct, reachedIndex } from './stats.js';
import { dayNumber, fmtDate, todayISO } from './format.js';

// Sample sizes. Deliberately small, because this is one student's job search
// and not a study, but large enough that a single lucky reply can't flip the
// advice.
export const LIMITS = {
  rates: 8,        // applications before comparing anything by rate
  bucket: 3,       // per source/category before that bucket is compared
  funnel: 6,       // applications before reading the funnel
  pace: 3,         // weeks of history before talking about pace
  stale: 21,       // days at Applied before it is going nowhere
  deadline: 7,     // days ahead to count a deadline as near
  gap: 10,         // days without applying before it is worth mentioning
};

const plural = (n, one, many = `${one}s`) => (n === 1 ? one : many);
const name = (a) => a.company?.trim() || a.role?.trim() || 'one application';

// Cards come out ranked: things with a date attached first, because they stop
// being actionable if they are ignored, then what is going wrong, then what is
// going well.
const TONE_ORDER = { urgent: 0, nudge: 1, watch: 2, win: 3, info: 4 };

export function buildInsights(rows, events, stats, { today = todayISO() } = {}) {
  const now = dayNumber(today);
  const reached = reachedIndex(events);
  const cards = [];
  const add = (card) => { if (card) cards.push(card); };

  const live = (rows ?? []).filter((a) => a.status !== 'Wishlist' && !CLOSED.has(a.status));
  const applied = (rows ?? []).filter((a) => a.status !== 'Wishlist');
  const wishlist = (rows ?? []).filter((a) => a.status === 'Wishlist');
  const daysAgo = (iso) => (iso ? now - dayNumber(iso) : null);

  // ---- things with a clock on them ----------------------------------------

  const overdue = live
    .filter((a) => a.next_follow_up && dayNumber(a.next_follow_up) < now)
    .sort((x, y) => dayNumber(x.next_follow_up) - dayNumber(y.next_follow_up));
  if (overdue.length) {
    const first = overdue[0];
    const late = daysAgo(first.next_follow_up);
    add({
      id: 'followups-overdue',
      tone: 'urgent',
      stat: { value: overdue.length, label: plural(overdue.length, 'follow-up') },
      title: `${overdue.length} ${plural(overdue.length, 'follow-up')} past ${plural(overdue.length, 'its', 'their')} date`,
      detail: `The oldest is ${name(first)}, due ${fmtDate(first.next_follow_up)}, ${late} ${plural(late, 'day')} ago. Sending one is the smallest thing on this page and the one most likely to move something.`,
      rows: overdue.map((a) => a.id),
    });
  }

  const soon = wishlist
    .filter((a) => a.deadline && dayNumber(a.deadline) >= now && dayNumber(a.deadline) - now <= LIMITS.deadline)
    .sort((x, y) => dayNumber(x.deadline) - dayNumber(y.deadline));
  if (soon.length) {
    const first = soon[0];
    const left = dayNumber(first.deadline) - now;
    add({
      id: 'deadlines-near',
      tone: 'urgent',
      stat: { value: soon.length, label: plural(soon.length, 'deadline') },
      title: `${soon.length} ${plural(soon.length, 'deadline')} inside a week`,
      detail: `${name(first)} closes ${left === 0 ? 'today' : `in ${left} ${plural(left, 'day')}`}, on ${fmtDate(first.deadline)}. ${soon.length > 1 ? 'These are still on your wishlist, so nothing has gone in yet.' : 'It is still on your wishlist, so nothing has gone in yet.'}`,
      rows: soon.map((a) => a.id),
    });
  }

  const stale = live
    .filter((a) => a.status === 'Applied' && appliedOn(a) && daysAgo(appliedOn(a)) >= LIMITS.stale)
    .sort((x, y) => dayNumber(appliedOn(x)) - dayNumber(appliedOn(y)));
  if (stale.length) {
    add({
      id: 'stale',
      tone: 'nudge',
      stat: { value: stale.length, label: plural(stale.length, 'application') },
      title: `${stale.length} ${plural(stale.length, 'application has', 'applications have')} sat at Applied for three weeks`,
      detail: `The oldest went in ${daysAgo(appliedOn(stale[0]))} days ago. Chase the ones you still want and mark the rest No reply, so the rates on this page describe a search that is actually happening.`,
      rows: stale.map((a) => a.id),
    });
  }

  // ---- where the effort is paying -----------------------------------------

  const withReply = (list) => list.filter((a) => heardBackFrom(a, reached)).length;

  if (applied.length >= LIMITS.rates) {
    const missing = applied.filter((a) => !a.source?.trim()).length;
    const buckets = groupRate(applied.filter((a) => a.source?.trim()), 'source', withReply)
      .filter((b) => b.n >= LIMITS.bucket)
      .sort((x, y) => y.rate - x.rate);

    if (buckets.length >= 2 && buckets[0].rate > buckets[buckets.length - 1].rate) {
      const best = buckets[0];
      const worst = buckets[buckets.length - 1];
      add({
        id: 'source-spread',
        tone: 'watch',
        stat: { value: `${best.rate}%`, label: best.key },
        title: `${best.key} is answering you, ${worst.key} is not`,
        detail: `${best.replies} of ${best.n} from ${best.key} came back, against ${worst.replies} of ${worst.n} from ${worst.key}. Same hours either way, so spend them where the replies are.`,
        rows: [...best.rows, ...worst.rows],
      });
      // Half, not more than half: at that point the comparison above is
      // drawn from a minority of the search and the gap is the bigger story.
    } else if (missing >= applied.length / 2) {
      add({
        id: 'source-missing',
        tone: 'info',
        stat: { value: missing, label: 'missing a source' },
        title: 'Nothing here can tell you which job boards work',
        detail: `${missing} of your ${applied.length} applications have no source on them. Fill that column in as you go and this turns into a straight answer about where your replies come from.`,
        rows: applied.filter((a) => !a.source?.trim()).map((a) => a.id),
      });
    }

    const referred = applied.filter((a) => a.referral);
    const cold = applied.filter((a) => !a.referral);
    if (referred.length >= LIMITS.bucket && cold.length >= LIMITS.bucket) {
      const r = pct(withReply(referred), referred.length);
      const c = pct(withReply(cold), cold.length);
      if (r > c) {
        add({
          id: 'referral-lift',
          tone: 'win',
          stat: { value: `${r}%`, label: 'when referred' },
          title: 'A referral is worth more than another application',
          detail: `${withReply(referred)} of ${referred.length} referred came back, against ${withReply(cold)} of ${cold.length} cold. Finding one person at the next company beats sending two more forms.`,
          rows: referred.map((a) => a.id),
        });
      }
    }
  }

  // ---- where people are being lost ----------------------------------------

  if (applied.length >= LIMITS.funnel && stats?.reached?.length) {
    const drop = biggestDrop(stats.reached);
    if (drop) {
      add({
        id: 'funnel-drop',
        tone: 'watch',
        stat: { value: `${drop.lost}`, label: `lost after ${drop.from}` },
        title: FUNNEL_TITLES[drop.index] ?? `Most of them stop after ${drop.from}`,
        detail: `${drop.before} reached ${drop.from} and ${drop.after} got to ${drop.to}. ${FUNNEL_ADVICE[drop.index] ?? 'That step is where the work is.'}`,
        rows: [],
      });
    }
  }

  // ---- pace ----------------------------------------------------------------

  const dated = applied.filter((a) => appliedOn(a)).map((a) => dayNumber(appliedOn(a)));
  if (dated.length) {
    const last = Math.max(...dated);
    const quiet = now - last;
    const span = (now - Math.min(...dated)) / 7;
    const thisWeek = dated.filter((d) => now - d < 7).length;
    const before = dated.filter((d) => now - d >= 7);

    if (quiet >= LIMITS.gap) {
      add({
        id: 'gap',
        tone: 'nudge',
        stat: { value: quiet, label: 'days quiet' },
        title: `Nothing new for ${quiet} days`,
        detail: 'Replies follow applications by two to six weeks, so a quiet fortnight now is a quiet month later. One a day is enough to keep the pipe full.',
        rows: [],
      });
    } else if (span >= LIMITS.pace && before.length) {
      const weeks = Math.max(1, Math.round((span * 7 - 7) / 7));
      const average = before.length / weeks;
      if (average >= 1 && thisWeek < average / 2) {
        add({
          id: 'pace-down',
          tone: 'nudge',
          stat: { value: thisWeek, label: 'this week' },
          title: 'This week is well below your own average',
          detail: `You have sent ${thisWeek} in the last seven days, against ${average.toFixed(1)} a week before that. Nothing is wrong with a slow week, as long as it is a choice.`,
          rows: [],
        });
      } else if (thisWeek > average && thisWeek >= 3) {
        add({
          id: 'pace-up',
          tone: 'win',
          stat: { value: thisWeek, label: 'this week' },
          title: 'Your best run in a while',
          detail: `${thisWeek} in the last seven days, against ${average.toFixed(1)} a week before that. Keep it there and the replies arrive together in a few weeks.`,
          rows: [],
        });
      }
    }
  }

  cards.sort((x, y) => (TONE_ORDER[x.tone] ?? 9) - (TONE_ORDER[y.tone] ?? 9));
  return { cards, applied: applied.length, enough: applied.length >= LIMITS.rates };
}

// --- the pieces -------------------------------------------------------------

function groupRate(list, key, count) {
  const m = new Map();
  for (const a of list) {
    const k = a[key].trim();
    m.set(k, [...(m.get(k) ?? []), a]);
  }
  return [...m].map(([k, group]) => ({
    key: k,
    n: group.length,
    replies: count(group),
    rate: pct(count(group), group.length),
    rows: group.map((a) => a.id),
  }));
}

// The step that loses the most people, counted in applications rather than in
// percent: a stage that 2 of 3 fall out of is a worse-looking rate than one
// that 20 of 40 fall out of, and the second is the one worth fixing.
function biggestDrop(reached) {
  let best = null;
  for (let i = 0; i < reached.length - 1; i += 1) {
    const before = reached[i].value;
    const after = reached[i + 1].value;
    if (before < LIMITS.funnel) continue;
    const lost = before - after;
    if (lost <= 0) continue;
    if (!best || lost > best.lost) {
      best = { index: i, lost, before, after, from: STAGES[i], to: STAGES[i + 1] };
    }
  }
  return best;
}

const FUNNEL_TITLES = {
  0: 'Most applications never get a reply',
  1: 'You get screened, then it stops',
  2: 'The assessment is where you go out',
  3: 'You interview, and it ends there',
  4: 'The final round is the wall',
};

const FUNNEL_ADVICE = {
  0: 'That is normal at the top of a funnel, but it is also the step a referral or a sharper match to the posting moves the most.',
  1: 'A recruiter screen turns on a clear two-minute answer to what you do and why this role. That is rehearsable.',
  2: 'Assessments reward practice more than anything else on this list. Find which platform they use and do a timed one.',
  3: 'You are being taken seriously. What is left is the interview itself, so get specific stories ready for the questions you keep being asked.',
  4: 'Getting this far repeatedly means the gap is small. Ask the ones who said no what decided it; at this stage people often tell you.',
};
