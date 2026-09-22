import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// The signed-in student's own points per day, for the chart on the Charts tab.
// No league needed — this is their own history.
export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const days = Number(new URL(request.url).searchParams.get('days')) || 35;
  const { data, error } = await user.sb.rpc('my_points_daily', { p_days: days });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ daily: data ?? [] });
}
