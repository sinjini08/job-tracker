// Numbers behind the Charts tab. Shared with the Claude connector's get_stats
// tool, so Claude and the website always agree.
import { BUILTIN_SHEETS, OPTIONS } from './fields';
import { dayNumber, todayISO } from './format';

// Pipeline stages in order. "Reached" = the furthest of these an application
// has ever held (from its history), so a rejection after an interview still
// counts as having reached Interviewing.
//
// A student can type a status of their own. It shows in the sheet and in the
// "By status" chart, but it has no place in this order, so it sits outside the
// funnel: still open, and not yet counted as a reply.
export const STAGES = ['Applied', 'Screening', 'OA / Assessment', 'Interviewing', 'Final round',
  'Offer', 'Accepted'];
const RANK = Object.fromEntries(STAGES.map((s, i) => [s, i]));
// Statuses that end an application. Everything else past Wishlist is open.
export const CLOSED = new Set(['Rejected', 'Withdrawn', 'No reply']);
// Hearing back means either the employer moved you past Applied, or they said
// no. Withdrawing is your own decision, but it means they were in contact.
const HEARD_BACK = new Set(['Rejected', 'Withdrawn']);

export const appliedOn = (a) => a.date_applied || a.created_at?.slice(0, 10);
export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// How far an application ever got, as an index into STAGES.
//
// Built once from the whole history and handed back as a function, so the
// charts and the Insights tab answer this question the same way rather than
// each keeping their own version of it. The floor is Applied, not "no rung at
// all": a rejection with no recorded history, or a status the student
// invented, still went out of the door.
export function reachedIndex(events) {
  const held = new Map();
  for (const ev of events || []) {
    if (ev.kind !== 'status') continue;
    const set = held.get(ev.application_id) || new Set();
    for (const part of ev.detail.split('→')) set.add(part.trim());
    held.set(ev.application_id, set);
  }
  return (a) => {
    let best = RANK[a.status] ?? -1;
    for (const st of held.get(a.id) || []) best = Math.max(best, RANK[st] ?? -1);
    return Math.max(0, best);
  };
}

// Hearing back at all: they moved you past Applied, or they said no.
export const heardBackFrom = (a, reached) =>
  reached(a) >= RANK.Screening || HEARD_BACK.has(a.status);

export { RANK as STAGE_RANK };

function mondayOf(iso) {
  const n = dayNumber(iso);
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Mon = 0
  return n - dow;
}
function fmtWeek(n) {
  const d = new Date(n * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// sheet: 'All', or the stored key of one sheet. sheets: every key this student
// keeps, which is what 'All' stacks the weekly columns by — it can't be assumed
// to be the two built-ins any more, since 019 let students make their own.
// days: null (all time) or a number.
export function computeStats(rows, events, { sheet = 'All', sheets = BUILTIN_SHEETS, days = null } = {}) {
  // One implementation, shared with the Insights tab. See reachedIndex.
  const maxRank = reachedIndex(events);

  const cutoff = days ? dayNumber(todayISO()) - days : null;
  const inScope = rows.filter((a) =>
    (sheet === 'All' || a.type === sheet) &&
    (cutoff == null || (appliedOn(a) && dayNumber(appliedOn(a)) >= cutoff)));
  const applied = inScope.filter((a) => a.status !== 'Wishlist');

  const reached = STAGES.map((s, i) => ({ label: s, value: applied.filter((a) => maxRank(a) >= i).length }));
  // The same journeys cut the other way: each application counted once, at the
  // furthest rung it ever held. `reached` is cumulative and deliberately double
  // counts — an application that got to Offer is also in all six stages before
  // it — so it can never be a share of anything. These add up to the total, so
  // they can.
  const furthest = STAGES.map((s, i) => ({
    label: s,
    value: applied.filter((a) => maxRank(a) === i).length,
  }));
  const heardBack = (a) => heardBackFrom(a, maxRank);
  const responded = applied.filter(heardBack).length;

  // Weekly columns, stacked by sheet.
  const series = sheet === 'All' ? [...sheets] : [sheet];
  const thisWeek = mondayOf(todayISO());
  const dated = applied.filter((a) => appliedOn(a));
  const firstWeek = dated.length ? Math.min(...dated.map((a) => mondayOf(appliedOn(a)))) : thisWeek;
  const span = days ? Math.ceil(days / 7) : Math.min(26, Math.max(8, (thisWeek - firstWeek) / 7 + 1));
  const weeks = Array.from({ length: span }, (_, i) => thisWeek - (span - 1 - i) * 7);
  const weekly = weeks.map((w) => ({
    label: fmtWeek(w),
    parts: series.map((s) => ({
      series: s,
      value: dated.filter((a) => a.type === s && mondayOf(appliedOn(a)) === w).length,
    })),
  }));

  const countBy = (list, key, order) => {
    const m = new Map();
    for (const a of list) {
      const k = a[key] || 'Not set';
      m.set(k, (m.get(k) || 0) + 1);
    }
    const keys = [...m.keys()].sort((x, y) => {
      const ix = order.indexOf(x), iy = order.indexOf(y);
      return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy) || m.get(y) - m.get(x);
    });
    return keys.map((k) => ({ label: k, value: m.get(k) }));
  };

  // Each breakdown carries the interview cut as well as the count, so a chart
  // can draw "of these, this many got somewhere" inside the same bar instead of
  // putting a second number beside it on a scale of its own.
  const withInterviews = (key, order) => countBy(applied, key, order).map((row) => {
    const group = applied.filter((a) => (a[key] || 'Not set') === row.label);
    const interviews = group.filter((a) => maxRank(a) >= RANK.Interviewing).length;
    return { ...row, interviews, note: `${pct(interviews, group.length)}% reached interview` };
  });

  // One entry per day you applied, for the activity grid. Days with nothing are
  // left out: the grid draws its own empty cells from the window it shows.
  const perDay = new Map();
  for (const a of dated) {
    const d = appliedOn(a);
    perDay.set(d, (perDay.get(d) || 0) + 1);
  }
  const byDay = [...perDay].map(([day, value]) => ({ day, value })).sort((x, y) => (x.day < y.day ? -1 : 1));

  return {
    total: applied.length,
    active: applied.filter((a) => !CLOSED.has(a.status)).length,
    responseRate: pct(responded, applied.length),
    responded,
    interviews: reached[RANK.Interviewing].value,
    offers: reached[RANK.Offer].value,
    wishlist: inScope.filter((a) => a.status === 'Wishlist').length,
    reached,
    furthest,
    series,
    weekly,
    // `closed` marks the statuses an application does not come back from, so
    // the chart can colour them apart from the ones still in play.
    byStatus: countBy(inScope, 'status', OPTIONS.status)
      .map((r) => ({ ...r, closed: CLOSED.has(r.label), waiting: r.label === 'Wishlist' })),
    byCategory: withInterviews('category', OPTIONS.category),
    byWorkMode: withInterviews('work_mode', OPTIONS.work_mode || []),
    bySource: withInterviews('source', OPTIONS.source),
    byDay,
  };
}
