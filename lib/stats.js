// Numbers behind the Charts tab. Shared with the Claude connector's get_stats
// tool, so Claude and the website always agree.
import { OPTIONS } from './fields';
import { dayNumber, todayISO } from './format';

// Pipeline stages in order. "Reached" = the furthest of these an application
// has ever held (from its history), so a rejection after an interview still
// counts as having reached Interviewing.
export const STAGES = ['Applied', 'OA / Assessment', 'Interviewing', 'Offer', 'Accepted'];
const RANK = Object.fromEntries(STAGES.map((s, i) => [s, i]));
const ACTIVE = new Set(['Applied', 'OA / Assessment', 'Interviewing', 'Offer']);
const NO_RESPONSE = new Set(['Applied', 'Ghosted']);

const appliedOn = (a) => a.date_applied || a.created_at?.slice(0, 10);
export const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

function mondayOf(iso) {
  const n = dayNumber(iso);
  const dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; // Mon = 0
  return n - dow;
}
function fmtWeek(n) {
  const d = new Date(n * 86400000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

// sheet: 'All' | 'On-Campus' | 'Off-Campus'; days: null (all time) or a number.
export function computeStats(rows, events, { sheet = 'All', days = null } = {}) {
  const held = new Map();
  for (const ev of events || []) {
    if (ev.kind !== 'status') continue;
    const set = held.get(ev.application_id) || new Set();
    for (const part of ev.detail.split('→')) set.add(part.trim());
    held.set(ev.application_id, set);
  }
  const maxRank = (a) => {
    let best = RANK[a.status] ?? -1;
    for (const s of held.get(a.id) || []) best = Math.max(best, RANK[s] ?? -1);
    return best;
  };

  const cutoff = days ? dayNumber(todayISO()) - days : null;
  const inScope = rows.filter((a) =>
    (sheet === 'All' || a.type === sheet) &&
    (cutoff == null || (appliedOn(a) && dayNumber(appliedOn(a)) >= cutoff)));
  const applied = inScope.filter((a) => a.status !== 'Wishlist');

  const reached = STAGES.map((s, i) => ({ label: s, value: applied.filter((a) => maxRank(a) >= i).length }));
  const responded = applied.filter((a) => !NO_RESPONSE.has(a.status)).length;

  // Weekly columns, stacked by sheet.
  const series = sheet === 'All' ? ['On-Campus', 'Off-Campus'] : [sheet];
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

  const bySource = countBy(applied, 'source', OPTIONS.source).map((row) => {
    const group = applied.filter((a) => (a.source || 'Not set') === row.label);
    const interviews = group.filter((a) => maxRank(a) >= RANK.Interviewing).length;
    return { ...row, note: `${pct(interviews, group.length)}% reached interview` };
  });

  return {
    total: applied.length,
    active: applied.filter((a) => ACTIVE.has(a.status)).length,
    responseRate: pct(responded, applied.length),
    responded,
    interviews: reached[2].value,
    offers: reached[3].value,
    wishlist: inScope.filter((a) => a.status === 'Wishlist').length,
    reached,
    series,
    weekly,
    byStatus: countBy(inScope, 'status', OPTIONS.status),
    byCategory: countBy(applied, 'category', OPTIONS.category),
    bySource,
  };
}
