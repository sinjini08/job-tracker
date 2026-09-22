// Leaderboard helpers shared by the server and the League tab. No imports, no
// secrets: this runs in the browser too.

export const PERIODS = [
  { id: 'week', label: 'This week', points: 'points_week', applied: 'applied_week', hits: 'days_hit_week' },
  { id: 'month', label: 'This month', points: 'points_month', applied: 'applied_month', hits: 'days_hit_month' },
  { id: 'total', label: 'All time', points: 'points_total', applied: 'applied_total', hits: null },
];

export const periodBy = (id) => PERIODS.find((p) => p.id === id) ?? PERIODS[0];

// Sort by the period on screen, and let ties share a place — two people on 14
// points are both 2nd, and nobody is 3rd.
export function rankBoard(rows, userId, period = 'week') {
  const key = periodBy(period).points;
  const sorted = [...(rows ?? [])].sort((a, b) =>
    b[key] - a[key] ||
    b.points_total - a.points_total ||
    String(a.display_name).localeCompare(String(b.display_name)));
  let rank = 0;
  let last = null;
  return sorted.map((row, i) => {
    if (row[key] !== last) { rank = i + 1; last = row[key]; }
    return { ...row, rank, is_me: row.user_id === userId };
  });
}

// How today is going against the league's daily target.
export function todayProgress(row, target) {
  if (!row || !target) return null;
  const done = row.points_today ?? 0;
  return { done, target, pct: Math.min(100, Math.round((done / target) * 100)), met: done >= target };
}

// "Week of 14 Sep" / "September" — how a settled period reads in the history.
export function periodLabel(period, startISO) {
  const [y, m, d] = String(startISO).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const month = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  if (period === 'month') return `${month} ${y}`;
  return `Week of ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}
