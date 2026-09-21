// Leaderboard helpers shared by the server and the League tab. No imports, no
// secrets: this runs in the browser too.

export const PERIODS = [
  { id: 'week', label: 'This week', points: 'points_week', applied: 'applied_week', goal: 'weekly_goal' },
  { id: 'month', label: 'This month', points: 'points_month', applied: 'applied_month', goal: 'monthly_goal' },
  { id: 'total', label: 'All time', points: 'points_total', applied: 'applied_total', goal: null },
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

// Goal progress for a row, or null when there's no goal to show for this
// period (all-time has none) or the member keeps their counts to themselves.
export function goalProgress(row, period) {
  const p = periodBy(period);
  if (!p.goal) return null;
  const target = row[p.goal];
  const done = row[p.applied];
  if (target == null || done == null || target === 0) return null;
  return { done, target, pct: Math.min(100, Math.round((done / target) * 100)), met: done >= target };
}
