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
import { computeStats } from '../lib/stats.js';
import { linkParts } from '../lib/job-link.js';
import {
  normalizeSheetPrefs, enabledSheets, sheetLabel, newSheetKey, isCustomSheet,
  BUILTIN_SHEETS, CUSTOM_SHEET_RE, WRITABLE,
} from '../lib/fields.js';
import { readFileSync } from 'fs';

// Read, not imported. lib/mcp-tools.js is server-only and uses extensionless
// imports, so it resolves under the bundler and not under plain node. That is
// fine here: what is being checked is the wording of a prompt, which is a
// string either way.
const MCP_SRC = readFileSync(new URL('../lib/mcp-tools.js', import.meta.url), 'utf8');
const INSTRUCTIONS = MCP_SRC.slice(MCP_SRC.indexOf('export const INSTRUCTIONS'),
  MCP_SRC.indexOf('// The sheets one student keeps'));

let failed = 0;
const section = (name) => console.log(`\n${name}`);
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
const has = (r, id) => r.insights.find((c) => c.id === id);
const chore = (r, id) => r.chores.find((c) => c.id === id);

// ---------------------------------------------------------------------------
section('Insights — silence');
ok(run([]).insights.length === 0, 'no rows produces no insights');
ok(run([]).chores.length === 0, 'no rows produces no chores');
ok(run([app({ date_applied: d(2) })]).insights.length === 0,
  'one fresh application is not enough to claim anything');
ok(run(Array.from({ length: 4 }, (_, i) => app({ date_applied: d(2 + i) }))).insights.length === 0,
  'four applications, all healthy, still says nothing');

section('Insights — chores, which are dated and obvious');
let r = run([
  app({ next_follow_up: d(12), company: 'Acme' }),
  app({ next_follow_up: d(3), company: 'Globex' }),
  app({ next_follow_up: d(-4), company: 'Later' }),
]);
let c = chore(r, 'followups');
ok(c?.count === 2, 'counts only follow-ups whose date has passed');
ok(c.items[0].name === 'Acme' && /12 days late/.test(c.items[0].when),
  'names each job and how late it is, oldest first');
ok(c.items.length === 2 && c.items.every((i) => i.id && i.name && i.when),
  'every reminder carries the job it is about');
ok(!chore(run([app({ next_follow_up: d(12), status: 'Rejected' })]), 'followups'),
  'a closed application is not chased');
ok(!chore(run([app({ next_follow_up: d(12), status: 'Wishlist' })]), 'followups'),
  'a wishlist row is not chased');
r = run([app({ status: 'Wishlist', deadline: d(-3), company: 'Soon' }),
  app({ status: 'Wishlist', deadline: d(-30) }), app({ status: 'Wishlist', deadline: d(2) })]);
ok(chore(r, 'deadlines')?.count === 1, 'only deadlines inside a week, none already past');
ok(chore(run([app({ date_applied: d(30) }), app({ date_applied: d(25) }),
  app({ date_applied: d(5) }), app({ date_applied: d(40), status: 'Screening' })]), 'stale')?.count === 2,
  'stale counts only rows still at Applied past 21 days');

section('Insights \u2014 a job you have stopped chasing');
ok(!chore(run([app({ next_follow_up: d(12), remind: false })]), 'followups'),
  'a muted job is not chased');
ok(!chore(run([app({ status: 'Wishlist', deadline: d(-3), remind: false })]), 'deadlines'),
  'a muted job does not nag about its deadline either');
ok(!chore(run([app({ date_applied: d(40), remind: false })]), 'stale'),
  'a muted job is not counted as gone quiet');
ok(chore(run([app({ next_follow_up: d(12) }), app({ next_follow_up: d(9), remind: false })]),
  'followups')?.count === 1, 'muting one leaves the others');
// remind only silences the reminders. The figures still count the application,
// because it is still an application.
ok(run([...Array.from({ length: 9 }, (_, i) => app({ date_applied: d(30 + i), remind: false }))])
  .state.applied === 9, 'a muted job still counts in the numbers');

section('One definition of still live');
{
  const live = [
    app({ status: 'Applied', date_applied: d(3) }),          // fresh
    app({ status: 'Screening', date_applied: d(40) }),       // old but moving
    app({ status: 'Applied', date_applied: d(40) }),         // gone quiet
    app({ status: 'Rejected', date_applied: d(5) }),         // closed
    app({ status: 'Wishlist' }),                             // not sent
  ];
  const stats = computeStats(live, [], {});
  eq(stats.live, 2, 'live counts the fresh one and the one still moving, and nothing else');
  eq(stats.total, 4, 'the total still counts every application sent');
  eq(buildInsights(live, [], stats, { today: TODAY }).state.live, stats.live,
    'the chart and the rail agree on what live means');
}

section('Insights — where you stand');
const paced = Array.from({ length: 12 }, (_, i) => app({ date_applied: d(7 + i * 2) }));
r = run([...paced, app({ status: 'Interviewing', date_applied: d(10) })]);
ok(r.state.live + r.state.closed === r.state.applied, 'live and closed account for every application');
ok(r.state.forecast?.unit === 'interview', 'forecasts interviews when there are any');
ok(run(paced).state.forecast?.unit === 'screening' || run(paced).state.forecast === null,
  'falls back to screenings, or says nothing, when no interview has happened');
ok(run([app()]).state.forecast === null, 'one application is not a rate');

section('Insights — claims have to earn it');
const bySource = (src, n, replies) => Array.from({ length: n }, (_, i) =>
  app({ source: src, status: i < replies ? 'Rejected' : 'Applied', date_applied: d(30 + i) }));
ok(!has(run([...bySource('Handshake', 4, 3), ...bySource('LinkedIn', 3, 0)]), 'channel-cost'),
  `under ${LIMITS.rates} applications, channels stay quiet`);
c = has(run([...bySource('Handshake', 6, 5), ...bySource('LinkedIn', 8, 1)]), 'channel-cost');
ok(/Handshake answers you more often than LinkedIn/.test(c.claim),
  'names the channel that answers, without scolding the one that does not');
ok(/5 of your 6 Handshake applications came back, against 1 of 8 on LinkedIn/.test(c.support),
  'shows both raw counts');
ok(c.rows.length === 8, 'links to the applications it is about, not both channels');
ok(!has(run([...bySource('Handshake', 6, 3), ...bySource('LinkedIn', 6, 2)]), 'channel-cost'),
  'a gap of one reply is not worth a claim');

const mixed = [
  ...Array.from({ length: 9 }, (_, i) => app({ date_applied: d(30 + i) })),
  ...Array.from({ length: 3 }, (_, i) => app({ referral: true, status: 'Screening', date_applied: d(20 + i) })),
];
c = has(run(mixed), 'referral-lever');
ok(/Referrals have worked every time/.test(c.claim), 'names the lever that works');
ok(/1 application in 4/.test(c.support), 'says how rarely it is used');
ok(!has(run([...Array.from({ length: 6 }, (_, i) => app({ referral: true, status: 'Screening', date_applied: d(20 + i) })),
  ...Array.from({ length: 6 }, (_, i) => app({ date_applied: d(30 + i) }))]), 'referral-lever'),
  'a lever used half the time is not underused');

ok(!has(run(mixed), 'no-outreach'),
  'never claims nobody was spoken to while counting referrals, which would contradict itself');
ok(has(run(Array.from({ length: 10 }, (_, i) => app({ date_applied: d(30 + i) }))), 'no-outreach'),
  'does claim it when there really has been no contact');

const stalePile = [
  ...Array.from({ length: 7 }, (_, i) => app({ date_applied: d(30 + i) })),
  ...Array.from({ length: 3 }, (_, i) => app({ date_applied: d(2 + i) })),
];
c = has(run(stalePile), 'pipeline-reframe');
ok(/3 of your 10 are still moving/.test(c.claim), 'reframes the count to the one still moving');

section('Insights — ranking and the cap');
const everything = [...bySource('Handshake', 6, 5), ...bySource('LinkedIn', 8, 1),
  ...Array.from({ length: 3 }, (_, i) => app({ referral: true, status: 'Screening', date_applied: d(20 + i) })),
  app({ next_follow_up: d(9) })];
r = run(everything);
ok(r.insights.length <= LIMITS.shown, `never more than ${LIMITS.shown} at once`);
ok(r.insights[0].kind === 'counterfactual',
  'what a choice cost you outranks what merely reframes or suggests');
ok(r.insights.every((i) => i.claim && i.support), 'every claim carries its own figures');

section('What the connector is told');
// A user pasted a posting, the row was created, and both folded panels stayed
// empty. Nothing was broken: the fields are writable and in the tool schema,
// but INSTRUCTIONS said "ask for nothing else, leave out whatever the posting
// does not say", so the assistant left them out and did as it was told.
//
// app/Details.js folds those two panels away on the stated grounds that Claude
// fills them, so the promise lives in two places and has to hold in both.
// These are string checks because the contract is a string.
ok(/job_description/.test(INSTRUCTIONS), 'the assistant is told to save the posting text');
ok(/requirements/.test(INSTRUCTIONS), 'and to summarise the qualifications');
ok(WRITABLE.has('job_description') && WRITABLE.has('requirements'),
  'and both are writable, or being told would not help');
ok(/Fill this whenever you have it/.test(MCP_SRC),
  'the job_description field says when to fill it, not just what it is');
ok(/Fill in everything the posting does say/.test(INSTRUCTIONS),
  'and to fill in everything else the posting states');
// The connector is useful because it does not interrupt. One question is a
// judgement; four is a reason to stop using it, so the count is asserted.
ok(/One question is allowed, and only this one/.test(INSTRUCTIONS),
  'exactly one question is permitted, not a general licence to ask');
ok(/do not interrogate/.test(INSTRUCTIONS), 'and it says so twice, in different words');

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


// ---------------------------------------------------------------- job links
//
// The bug these exist for: every LinkedIn posting opened from search results
// shares one path, so a check that ignored the query said "already in your
// tracker" for a job you had never seen, naming a completely different one.
//
// The rule errs towards NOT matching, because the two failures are not
// equally bad: a duplicate row is visible and deletable, a false "already
// saved" blocks the save and shows somebody else's job.

const parts = (u) => linkParts(u);
const LI_A = 'https://www.linkedin.com/jobs/search-results/?currentJobId=4472473316&refId=abc&trk=x';
const LI_B = 'https://www.linkedin.com/jobs/search-results/?currentJobId=9999999999&refId=zzz';

ok(parts(LI_A).base === parts(LI_B).base, 'two LinkedIn search-results links share a path');
eq(parts(LI_A).marks, ['currentJobId=4472473316'], 'so the currentJobId is what tells them apart');
eq(parts(LI_B).marks, ['currentJobId=9999999999'], 'and the other one carries its own');
eq(parts('https://www.indeed.com/viewjob?jk=deadbeef1234&from=serp&tk=zzz').marks,
  ['jk=deadbeef1234'], 'Indeed keeps jk and drops the tracking');

// Two roles at the same employer, which is the case this has to get right.
const CO = 'https://careers.acme.com/openings';
ok(parts(`${CO}?job=1188`).marks[0] !== parts(`${CO}?job=1274`).marks[0],
  'two roles on one careers page are told apart by an id nobody has heard of');
ok(parts('https://boards.greenhouse.io/acme/jobs/5512345').base
  !== parts('https://boards.greenhouse.io/acme/jobs/5512399').base,
  'two roles at one employer differ by path on a board that uses paths');

// Tracking has to be dropped or the same posting never matches itself.
eq(parts('https://x.com/jobs/view/9?utm_source=a&utm_campaign=b&gclid=c').marks, [],
  'utm and click ids are all tracking');
eq(parts(`${CO}?job=1188&utm_source=newsletter`).marks, ['job=1188'],
  'the id survives, the campaign does not');
ok(parts('https://www.linkedin.com/jobs/search-results/?currentJobId=1&keywords=intern').marks
  .join() === 'currentJobId=1', 'the search terms are the visit, not the posting');

eq(parts('https://boards.greenhouse.io/acme/jobs/5512345').marks, [],
  'a posting identified by its path needs no marks');
ok(parts('not a url') === null, 'junk is refused');
ok(parts('https://x.co/') === null, 'a bare domain is not a posting');
ok(parts('https://www.linkedin.com') === null, 'nor is a bare domain without the slash');
eq(parts('https://www.indeed.com/viewjob?jk=').marks, [], 'a blank id is not an id');
eq(parts(`https://www.indeed.com/viewjob?jk=${'a'.repeat(200)}`).marks, [],
  'an absurdly long value is a payload, not an id');
ok(parts(LI_A).base === 'https://www.linkedin.com/jobs/search-results',
  'the trailing slash is dropped so both forms of the same path agree');
ok(parts(`${CO}?a=1&b=2&c=3&d=4&e=5`).marks.length === 3, 'the number of marks is capped');

console.log(failed ? `\n\x1b[31m${failed} failed\x1b[0m\n` : '\n\x1b[32mall passed\x1b[0m\n');
process.exit(failed ? 1 : 0);
