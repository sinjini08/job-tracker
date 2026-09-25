import { NextResponse } from 'next/server';
import { userIdForExtension } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase/server';
import { OPTIONS as FIELD_OPTIONS, OPTIONS_FOR, WRITABLE, enabledSheets, sheetLabel, snapToKnown } from '@/lib/fields';
import { allowedOrigin } from '@/lib/ext-ids';

export const dynamic = 'force-dynamic';

// What the browser extension posts to.
//
// Deliberately narrower than the connector. That token can read the whole
// tracker; this one lives in browser storage on whatever machine somebody
// installed the extension on, so it can add a row and name the sheet tabs to
// put it on. It cannot list rows, change one, or delete anything.
//
// The token arrives in an Authorization header, never in the path. A path is
// written to every access log between here and the browser, so a token in one
// is a token sitting in logs on every single save. A header is not logged,
// and the link the tracker hands over keeps the token in the URL fragment,
// which browsers never send to a server at all.
//
// The extension does the extracting. This endpoint's job is to refuse
// anything it was not asked to store: only known columns, only known dropdown
// values, and a length cap on every string, because the input is a web page
// somebody else wrote.

const MAX = {
  role: 300, company: 300, term: 100, category: 100, status: 100, priority: 20,
  location: 200, work_mode: 100, pay: 100, source: 100, job_link: 2000,
  resume_version: 200, contact: 200, contact_email: 320, contact_link: 2000,
  requirements: 4000, job_description: 60000, notes: 4000, outreach_method: 100,
};
const DATES = new Set(['deadline', 'date_applied', 'next_follow_up', 'reached_out_on']);
const FLAGS = new Set(['referral', 'cover_letter', 'remind']);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Only fields the tracker has, only values it recognises, nothing longer than
// the column. A posting is somebody else's HTML and is treated that way.
function sanitise(body) {
  const out = {};
  for (const [key, raw] of Object.entries(body ?? {})) {
    if (key === 'type' || key === 'custom' || !WRITABLE.has(key)) continue;
    if (raw == null) continue;
    if (FLAGS.has(key)) { out[key] = Boolean(raw); continue; }
    if (key === 'hours_per_week') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 80) out[key] = n;
      continue;
    }
    if (DATES.has(key)) {
      const s = String(raw).slice(0, 10);
      if (ISO.test(s)) out[key] = s;
      continue;
    }
    // Runs of whitespace collapse to one space. A posting scraped out of HTML
    // is full of newlines and indentation; the job description keeps its line
    // breaks, so it is capped and left alone.
    const flat = key === 'job_description' || key === 'requirements' || key === 'notes'
      ? String(raw)
      : String(raw).replace(/\s+/g, ' ');
    const s = flat.trim().slice(0, MAX[key] ?? 300);
    if (!s) continue;
    // A dropdown gets snapped to the value already in use, so "linkedin" and
    // "LinkedIn" stay one value in the charts.
    out[key] = OPTIONS_FOR[key] ? snapToKnown(s, FIELD_OPTIONS[OPTIONS_FOR[key]]) : s;
  }
  return out;
}

// Bearer, and nothing else. No query string and no path segment, so the token
// never reaches a log line.
async function auth(request) {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const userId = await userIdForExtension(match[1]);
  return userId ? storeFor(supabaseAdmin(), userId) : null;
}

// The popup is a cross-origin caller: it runs on chrome-extension://<id>.
// Only an id this tracker was configured to trust gets CORS headers back, so
// no other extension and no web page can reach this endpoint from a browser.
//
// Allow-Credentials is deliberately absent. The endpoint authenticates on a
// bearer token and nothing else, so a browser must never attach the signed-in
// session cookie to a request from here.
function corsFor(request) {
  const origin = allowedOrigin(request.headers.get('origin'));
  if (!origin) return { Vary: 'Origin' };
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// The preflight. An Authorization header makes every call here a non-simple
// request, so the browser asks first and will not send the real one without
// this answer.
export async function OPTIONS(request) {
  return new NextResponse(null, { status: 204, headers: corsFor(request) });
}

const no = (message, status = 400) => NextResponse.json({ error: message }, { status });
const dead = () => no('This extension is not connected. Connect it again from the tracker Settings.', 401);

// A refusal the popup cannot read is a refusal it reports as "failed to
// fetch", so the error responses carry the same headers as the good ones.
function withCors(response, cors) {
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
}

// Which sheets to offer, so the popup names the student's own tabs rather
// than guessing at somebody who renamed them.
export async function GET(request) {
  const cors = corsFor(request);
  const store = await auth(request);
  if (!store) return withCors(dead(), cors);
  const sheets = await store.sheets().catch(() => null);
  return NextResponse.json({ ok: true, sheets: sheets ?? [] }, { headers: cors });
}

export async function POST(request) {
  const cors = corsFor(request);
  const store = await auth(request);
  if (!store) return withCors(dead(), cors);

  const body = await request.json().catch(() => null);
  if (!body) return withCors(no('Expected a JSON body.'), cors);

  const fields = sanitise(body);
  if (!fields.role || !fields.company) {
    // The same rule the connector has, for the same reason: a row missing
    // either scores nothing and the student is never told why.
    return withCors(no('A row needs both a job title and an employer.'), cors);
  }

  // The sheet arrives as a name, because that is what the person sees on the
  // tab. An unknown name lands on their first sheet rather than failing.
  let sheets = [];
  try { sheets = await store.sheets(); } catch { /* fall through to the default */ }
  const asked = String(body.sheet ?? '').trim().toLowerCase();
  const match = sheets.find((s) => s.name.toLowerCase() === asked || s.key.toLowerCase() === asked);
  const type = match?.key ?? sheets[0]?.key ?? enabledSheets(null)[0];

  // Saving a posting is not applying to one. The extension is used while
  // reading a job, which is usually before anything has been sent, and a row
  // that says Applied when nothing was applied to is worse than no row: it
  // corrupts the count the whole tracker is built on. The popup offers
  // Applied for the case where the person has just sent it.
  if (!fields.status) fields.status = 'Wishlist';

  try {
    const saved = await store.createApplication({ ...fields, type });
    return NextResponse.json({
      saved: {
        id: saved.id,
        role: saved.role,
        company: saved.company,
        sheet: sheetLabel(saved.type, null),
        status: saved.status,
      },
      view_at: new URL(request.url).origin,
    }, { headers: cors });
  } catch (e) {
    return withCors(no(e.message ?? 'Could not save that.', 500), cors);
  }
}
