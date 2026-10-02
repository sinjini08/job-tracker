import { NextResponse } from 'next/server';
import { userIdForExtension } from '@/lib/auth';
import { allowedOrigin } from '@/lib/ext-ids';
import { pickSpan } from '@/lib/req-span';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Which lines of a posting are the requirements.
//
// Everything structured is already solved without a model: role, company,
// location, pay, work mode and category come off JSON-LD, meta tags, labelled
// elements or the page title, and they are right because they were read
// rather than guessed. This is the one field that is not like that. It asks
// which stretch of prose lists what the candidate must have, and postings
// write that heading a thousand different ways. Matching on a list of
// phrasings works until the next posting, which said "The skills you will
// need to be successful in the above" and got an empty field.
//
// So the model is asked for line numbers and nothing else. It never supplies
// text. The answer is two integers, they are checked against the lines that
// were actually sent, and the slicing is done here from the text we already
// had. Inventing a requirement is not something it is being asked not to do;
// it is not something it is able to do.
//
// Anything unexpected returns "no answer" rather than an error, because this
// runs while somebody is waiting to save a row and a missing field is a far
// smaller problem than a failed save.

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_CHARS = 24000;
const MAX_LINES = 400;

// Model reads per student per day. This is the one call in the product that
// runs on this app's own key, at about a fifth of a cent each, so the cap is
// not for ordinary use: nobody saves thirty postings a day by hand. It is for
// a script, or a stolen extension token. Past it the save still goes through
// and the popup keeps whatever its own matcher found. Counted in Postgres
// (029_ext_reads.sql) because a serverless function has no memory between
// requests, and in one statement so two saves at once cannot both slip under.
const DAILY_READS = Number(process.env.EXT_READS_PER_DAY) || 30;

// True if this read is allowed, and counts it. If the meter itself fails, the
// answer is no: a missing requirements field costs nothing, an unmetered model
// call is exactly what this is here to prevent.
async function claimRead(userId) {
  const { data, error } = await supabaseAdmin()
    .rpc('claim_ext_read', { p_user_id: userId, p_cap: DAILY_READS });
  return !error && data != null;
}

const PROMPT = `You are given the numbered lines of one job posting.

Find the single contiguous run of lines that lists what the candidate must have: their qualifications, skills, experience or education.

Rules:
- Answer with the line numbers shown, and nothing else.
- Do not include the heading line itself, only the items under it.
- Do not include duties or responsibilities, benefits or perks, the interview process, or descriptions of the company.
- If the posting has no such section, say so rather than picking the nearest thing.

Reply with only a JSON object, no other text:
{"start": <first line number>, "end": <last line number>}
or
{"start": null, "end": null}`;

function corsFor(request) {
  const origin = allowedOrigin(request.headers.get('origin'));
  if (!origin) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsFor(request) });
}

// Not an error. No key configured means the feature is simply off, and the
// popup keeps whatever its own matcher found.
const none = (cors, why) => NextResponse.json({ requirements: null, why }, { headers: cors });

export async function POST(request) {
  const cors = corsFor(request);

  const header = request.headers.get('authorization') ?? '';
  const token = /^Bearer\s+(\S+)$/i.exec(header.trim())?.[1];
  // Authenticated for cost as much as for privacy: an open endpoint that
  // calls a paid model is an invitation.
  const userId = token ? await userIdForExtension(token) : null;
  if (!userId) {
    return NextResponse.json({ error: 'Not connected.' }, { status: 401, headers: cors });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return none(cors, 'no key configured');

  const body = await request.json().catch(() => null);
  const text = String(body?.text ?? '').slice(0, MAX_CHARS);
  if (text.length < 200) return none(cors, 'too short to have a requirements section');

  // Counted before the call rather than after it: a call that times out has
  // usually been paid for anyway. Only here, after the checks above, so a
  // posting too short to ask about does not use up a read.
  if (!(await claimRead(userId))) return none(cors, 'daily limit reached');

  const lines = text.split('\n').map((l) => l.trim()).slice(0, MAX_LINES);
  const numbered = lines.map((l, i) => `${i}: ${l}`).join('\n');

  let answer;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 64,
        temperature: 0,
        system: PROMPT,
        messages: [{ role: 'user', content: numbered }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return none(cors, `model said ${res.status}`);
    const data = await res.json();
    const said = data?.content?.find((c) => c.type === 'text')?.text ?? '';
    answer = JSON.parse(said.slice(said.indexOf('{'), said.lastIndexOf('}') + 1));
  } catch {
    // A timeout, a network failure, or a reply that was not the JSON asked
    // for. All the same thing from here: no answer.
    return none(cors, 'no usable answer');
  }

  // The reply is two numbers and they have to survive every check in
  // pickSpan before a single line is taken. The text is cut from the lines
  // that were sent, never from anything the model wrote.
  const got = pickSpan(lines, answer);
  if (!got.text) return none(cors, got.why);
  return NextResponse.json({ requirements: got.text }, { headers: cors });
}
