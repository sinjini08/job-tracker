import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { currentUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildBrief } from '@/lib/ai-brief';
import { buildInsights } from '@/lib/insights';
import { computeStats } from '@/lib/stats';
import { MODEL, ask } from '@/lib/ai-read';

export const dynamic = 'force-dynamic';

// A short written read of one student's search, over the figures the Insights
// rules already worked out.
//
// Nothing here happens on its own: the student presses a button. Without a key
// the route reports that it is off and the tab simply doesn't offer it, so the
// arithmetic half keeps working on its own.

const DAILY_LIMIT = Number(process.env.INSIGHTS_DAILY_LIMIT || 10);

const digest = (value) => createHash('sha1').update(JSON.stringify(value)).digest('hex');

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return NextResponse.json({ enabled: false });
  const { data } = await user.sb.from('ai_reads')
    .select('body, model, created_at, brief_hash').eq('user_id', user.id).maybeSingle();
  return NextResponse.json({ enabled: true, read: data ?? null });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return NextResponse.json({ enabled: false, error: 'Not switched on.' }, { status: 503 });

  const db = supabaseAdmin();

  // The student's own rows, read server-side. The browser never gets to say
  // what the brief contains.
  const [{ data: rows, error: rowsErr }, { data: events }] = await Promise.all([
    db.from('applications').select('*').eq('user_id', user.id),
    db.from('application_events')
      .select('application_id, kind, detail, event_date').eq('user_id', user.id),
  ]);
  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  const stats = computeStats(rows ?? [], events ?? [], {});
  const insights = buildInsights(rows ?? [], events ?? [], stats);
  const brief = buildBrief(rows ?? [], events ?? [], stats, insights);
  const hash = digest(brief);

  const { data: prior } = await db.from('ai_reads').select('*').eq('user_id', user.id).maybeSingle();

  // Same figures as last time: hand back what was already paid for.
  const forced = new URL(request.url).searchParams.get('force') === '1';
  if (prior && prior.brief_hash === hash && !forced) {
    return NextResponse.json({ enabled: true, read: prior, cached: true });
  }

  const today = new Date().toISOString().slice(0, 10);
  const used = prior && prior.calls_day === today ? prior.calls_today : 0;
  if (used >= DAILY_LIMIT) {
    return NextResponse.json({
      error: `That is ${DAILY_LIMIT} reads today, which is the daily limit. The numbers on this page keep working, and this resets tomorrow.`,
    }, { status: 429 });
  }

  let body;
  try {
    body = await ask(key, brief);
  } catch (e) {
    return NextResponse.json({ error: `Could not write a read just now. ${e.message}` }, { status: 502 });
  }

  const row = {
    user_id: user.id,
    brief_hash: hash,
    body,
    model: MODEL,
    created_at: new Date().toISOString(),
    calls_day: today,
    calls_today: used + 1,
  };
  const { error: saveErr } = await db.from('ai_reads').upsert(row, { onConflict: 'user_id' });
  if (saveErr) return NextResponse.json({ error: saveErr.message }, { status: 500 });

  return NextResponse.json({ enabled: true, read: row, cached: false });
}
