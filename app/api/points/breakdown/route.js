import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// What your points were actually made of, day by day.
//
// Private by construction rather than by a check here: `points` carries an
// RLS policy of (auth.jwt()->>'sub') = user_id, and this runs on the student's
// own scoped client, so the database itself will not hand back anybody else's
// rows. A league mate's breakdown is unreachable from this endpoint even if
// the query asked for it.

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const asked = Number(new URL(request.url).searchParams.get('days'));
  const days = Math.min(Math.max(Number.isFinite(asked) ? asked : 30, 1), 400);
  const since = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10);

  const { data, error } = await user.sb
    .from('points')
    .select('earned_on, milestone, point_values(label, points, sort)')
    .gte('earned_on', since)
    .order('earned_on', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // One entry per day, and within it one line per milestone with how many
  // times it happened. Four applications on a Tuesday is one line reading
  // "Applied to a job x4", not four identical lines.
  const byDay = new Map();
  for (const row of data ?? []) {
    const day = row.earned_on;
    const value = row.point_values ?? {};
    if (!byDay.has(day)) byDay.set(day, { day, total: 0, items: new Map() });
    const entry = byDay.get(day);
    const line = entry.items.get(row.milestone)
      ?? { milestone: row.milestone, label: value.label ?? row.milestone, each: value.points ?? 0, sort: value.sort ?? 99, count: 0, points: 0 };
    line.count += 1;
    line.points += value.points ?? 0;
    entry.items.set(row.milestone, line);
    entry.total += value.points ?? 0;
  }

  const daily = [...byDay.values()]
    .map((d) => ({ ...d, items: [...d.items.values()].sort((a, b) => a.sort - b.sort) }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  return NextResponse.json({ daily });
}
