// The logic that decides what a student is told, checked.
//
//   npm test
//
// No framework and no dependency: plain asserts over the pure modules in lib/.
// Everything here is a pure function of rows and events by design, which is
// what makes it checkable without a database, a browser or a key.
//
// The cases that matter most are the ones asserting SILENCE. A tool that says
// something confident about four applications is worse than one that says
// nothing, and those are the assertions that stop that happening.

import { buildInsights, LIMITS } from '../lib/insights.js';
import { buildBrief } from '../lib/ai-brief.js';
import { shape } from '../lib/ai-read.js';
import { computeStats } from '../lib/stats.js';
import {
  normalizeSheetPrefs, enabledSheets, sheetLabel, newSheetKey, isCustomSheet,
  BUILTIN_SHEETS, CUSTOM_SHEET_RE,
} from '../lib/fields.js';

let failed = 0;
let group = '';
const section = (name) => { group = name; console.log(`\n${name}`); };
const ok = (cond, msg) => {
  if (!cond) failed += 1;
  console.log(`  ${cond ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${msg}`);
};
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b),
  `${msg}${JSON.stringify(a) === JSON.stringify(b) ? '' : `\n         got  ${JSON.stringify(a)}\n         want ${JSON.stringify(b)}`}`);

// ---------------------------------------------------------------------------
const TODAY = '2026-09-23';
const d = (n) => new Date(Date.parse(TODAY) - n * 86400000).toISOString().slice(0, 10);
let seq = 0;
const app = (o = {}) => ({ id: `a${seq += 1}`, role: 'Dev', company: 'Co', status: 'Applied',
  date_applied: d(1), referral: false, ...o });
const run = (rows, events = []) =>
  buildInsights(rows, events, computeStats(rows, events, {}), { today: TODAY });
const card = (r, id) => r.cards.find((c) => c.id === id);

// ---------------------------------------------------------------------------
section('Insights — staying quiet');
ok(run([]).cards.length === 0, 'no rows produces no cards');
ok(run([app({ date_applied: d(2) })]).cards.length === 0, 'one fresh application produces no cards');

section('Insights — things with a clock on them');
let r = run([
  app({ next_follow_up: d(12), company: 'Acme' }),
  app({ next_follow_up: d(3), company: 'Globex' }),
  app({ next_follow_up: d(-4), company: 'Later' }),
]);
let c = card(r, 'followups-overdue');
ok(c?.stat.value === 2, 'counts only follow-ups whose date has passed');
ok(/Acme/.test(c.detail) && /12 days ago/.test(c.detail), 'names the oldest and how late it is');
ok(c.rows.length === 2, 'points at the rows it is about');
ok(!card(run([app({ next_follow_up: d(12), status: 'Rejected' })]), 'followups-overdue'),
  'a closed application is not chased');
ok(!card(run([app({ next_follow_up: d(12), status: 'Wishlist' })]), 'followups-overdue'),
  'a wishlist row is not chased');

r = run([app({ status: 'Wishlist', deadline: d(-3), company: 'Soon' }),
  app({ status: 'Wishlist', deadline: d(-30) }), app({ status: 'Wishlist', deadline: d(2) })]);
c = card(r, 'deadlines-near');
ok(c?.stat.value === 1, 'only deadlines inside a week, and not ones already past');
ok(/Soon/.test(c.detail), 'names the closest deadline');

c = card(run([app({ date_applied: d(30) }), app({ date_applied: d(25) }),
  app({ date_applied: d(5) }), app({ date_applied: d(40), status: 'Screening' })]), 'stale');
ok(c?.stat.value === 2, 'stale counts only rows still sitting at Applied past 21 days');

section('Insights — rates need a sample');
const bySource = (src, n, replies) => Array.from({ length: n }, (_, i) =>
  app({ source: src, status: i < replies ? 'Rejected' : 'Applied', date_applied: d(30 + i) }));
ok(!card(run([...bySource('Handshake', 4, 3), ...bySource('LinkedIn', 3, 0)]), 'source-spread'),
  `under ${LIMITS.rates} applications, sources stay quiet`);
c = card(run([...bySource('Handshake', 6, 4), ...bySource('LinkedIn', 6, 0)]), 'source-spread');
ok(/Handshake/.test(c.title) && /LinkedIn/.test(c.title), 'names best and worst source');
ok(/4 of 6/.test(c.detail) && /0 of 6/.test(c.detail), 'quotes both raw counts');
ok(card(run([...bySource('Handshake', 6, 2),
  ...Array.from({ length: 6 }, (_, i) => app({ date_applied: d(30 + i) }))]), 'source-missing'),
  'says why it cannot compare when half the rows have no source');

const ref = (n, replies, referral) => Array.from({ length: n }, (_, i) =>
  app({ referral, status: i < replies ? 'Screening' : 'Applied', date_applied: d(30 + i) }));
c = card(run([...ref(4, 3, true), ...ref(6, 1, false)]), 'referral-lift');
ok(/3 of 4/.test(c.detail) && /1 of 6/.test(c.detail), 'referral lift quotes both sides');
ok(!card(run([...ref(2, 2, true), ...ref(8, 1, false)]), 'referral-lift'),
  'two referrals is too few to claim a lift');

section('Insights — the funnel and the pace');
const mix = [
  ...Array.from({ length: 10 }, (_, i) => app({ status: 'Applied', date_applied: d(30 + i) })),
  ...Array.from({ length: 6 }, (_, i) => app({ status: 'Screening', date_applied: d(30 + i) })),
  ...Array.from({ length: 5 }, (_, i) => app({ status: 'Interviewing', date_applied: d(30 + i) })),
];
c = card(run(mix), 'funnel-drop');
ok(/never get a reply/.test(c.title), 'reads the biggest drop, in applications not percent');
ok(/21 reached Applied/.test(c.detail) && /11 got to Screening/.test(c.detail),
  'funnel quotes the two stage counts');
const spread = Array.from({ length: 12 }, (_, i) => app({ date_applied: d(14 + i) }));
ok(card(run(spread), 'gap')?.stat.value === 14, 'gap counts days since the most recent application');
ok(!card(run([...spread, app({ date_applied: d(1) })]), 'gap'),
  'one recent application closes the gap card');
ok(run([...mix, app({ next_follow_up: d(9) })]).cards[0].tone === 'urgent', 'dated things rank first');

section('The brief — what leaves the app');
const secret = (o = {}) => app({ company: 'SECRETCORP', pay: '$999999/hr',
  job_link: 'https://secret.example/x', contact: 'Deep Throat', contact_email: 'deep@secret.example',
  notes: 'SECRETNOTE', location: 'Atlantis', ...o });
const rows = [secret({ next_follow_up: d(12) }), secret({ next_follow_up: d(9) }),
  ...Array.from({ length: 6 }, (_, i) => secret({ source: 'Handshake', date_applied: d(25 + i) })),
  secret({ requirements: 'Python and SQL', status: 'Screening' })];
const events = rows.filter((x) => x.status === 'Screening').map((x, i) => ({
  id: `e${i}`, application_id: x.id, kind: 'status', detail: 'Applied → Screening', event_date: x.date_applied }));
const brief = buildBrief(rows, events, computeStats(rows, events, {}),
  buildInsights(rows, events, computeStats(rows, events, {})), { today: TODAY });
const text = JSON.stringify(brief);
for (const [label, needle] of [['a company', 'SECRETCORP'], ['pay', '999999'],
  ['a link', 'secret.example'], ['a contact', 'Deep Throat'], ['a note', 'SECRETNOTE'],
  ['a location', 'Atlantis']]) {
  ok(!text.includes(needle), `${label} never reaches the brief`);
}
ok(text.length < 8000, `the brief stays small (${text.length} bytes)`);
ok(brief.postings_that_replied.length === 1, 'posting text the student pasted is included');

section('The reply — untrusted until parsed');
eq(shape('{"read":"Two lines.","moves":[{"do":"Chase","because":"late"}]}').moves.length, 1, 'plain JSON parses');
eq(shape('```json\n{"read":"Fenced.","moves":[]}\n```').read, 'Fenced.', 'a code fence is stripped');
eq(shape('Sorry, I cannot help.').moves, [], 'non-JSON falls back to raw text rather than throwing');
eq(shape('{"read":"x","moves":[1,2,{"do":"ok","because":"y"},null]}').moves.length, 1, 'junk entries dropped');
eq(shape('{"read":"x","moves":[{"do":"a"},{"do":"b"},{"do":"c"},{"do":"d"}]}').moves.length, 3, 'never more than three moves');
eq(shape(`{"read":"${'x'.repeat(5000)}","moves":[]}`).read.length, 1200, 'a runaway read is cut to length');
eq(shape('{"read":{"a":1},"moves":"nope"}'), { read: '', moves: [] }, 'wrong types become empty, not a crash');
eq(shape(''), { read: '', moves: [] }, 'an empty reply is survivable');

section('Sheets');
eq(enabledSheets(null), BUILTIN_SHEETS, 'no preference falls back to both built-ins');
eq(enabledSheets(['nonsense', 's_SHOUT', 's_ab', 42]), BUILTIN_SHEETS, 'malformed keys are dropped');
eq(enabledSheets(['Off-Campus', 's_abcdef12']), ['Off-Campus', 's_abcdef12'], 'a made sheet is kept');
eq(sheetLabel('Off-Campus', null), 'Job applications', 'the general sheet has a general name');
eq(sheetLabel('s_abcdef12', {}), 'Untitled sheet', 'an unnamed made sheet is named as such');
ok(Array.from({ length: 2000 }, newSheetKey).every((k) => CUSTOM_SHEET_RE.test(k)),
  '2000 generated keys all match the pattern');
ok(new Set(Array.from({ length: 5000 }, newSheetKey)).size === 5000, '5000 generated keys are distinct');
ok(!isCustomSheet('On-Campus'), 'a built-in is not a made sheet');
eq(normalizeSheetPrefs(['Off-Campus', 's_abcdef12'], {}), { enabled: ['Off-Campus'], names: {} },
  'a made sheet with no name is dropped rather than stored unreadable');
eq(normalizeSheetPrefs(['Off-Campus'], { 'Off-Campus': 'Job applications' }),
  { enabled: ['Off-Campus'], names: {} }, 'renaming a built-in to its own default is not a rename');
eq(normalizeSheetPrefs(['s_abcdef12'], {}), { enabled: BUILTIN_SHEETS, names: {} },
  'nobody is ever left with no sheet at all');
eq(normalizeSheetPrefs(undefined, { s_abcdef12: 'Internships' }).names, { s_abcdef12: 'Internships' },
  'a rename on its own keeps made-sheet names');
eq(normalizeSheetPrefs(['On-Campus'], { 'Off-Campus': 'Sneaky' }).names, {},
  'a name for a sheet not on the list is dropped');
eq(normalizeSheetPrefs(Array.from({ length: 30 }, (_, i) => `s_abcdef${String(i).padStart(2, '0')}`),
  Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`s_abcdef${String(i).padStart(2, '0')}`, `S${i}`]))).enabled.length,
  8, 'the number of sheets is capped');

console.log(failed ? `\n\x1b[31m${failed} failed\x1b[0m\n` : '\n\x1b[32mall passed\x1b[0m\n');
process.exit(failed ? 1 : 0);
