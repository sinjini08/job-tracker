// What a token in browser storage can do to a row it already has.
//
// The old PATCH took every writable column. These are the ways somebody
// holding that token might try to reach past a status change.
import { statusPatch } from '../lib/ext-patch.js';
import { isoDate } from '../lib/iso-date.js';

let right = 0; const fails = [];
const check = (ok, name, detail = '') => {
  if (ok) right += 1; else fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
};
const TODAY = '2026-09-25';

console.log('\nWhat it may do');
const applied = statusPatch({ id: 'row-1', status: 'Applied' }, TODAY);
check(JSON.stringify(applied.patch) === JSON.stringify({ status: 'Applied', date_applied: TODAY }),
  'Applied, dated today', JSON.stringify(applied.patch));
check(statusPatch({ id: 'row-1', status: 'Applied', date_applied: '2026-09-01' }, TODAY).patch.date_applied === '2026-09-01',
  'a real date is kept');
const wish = statusPatch({ id: 'row-1', status: 'Wishlist' }, TODAY);
check(JSON.stringify(wish.patch) === JSON.stringify({ status: 'Wishlist' }),
  'back to Wishlist, with no date', JSON.stringify(wish.patch));

console.log('\nStatuses it may not set');
for (const status of ['Rejected', 'Offer', 'Interviewing', 'Screening', 'Final round', 'OA / Assessment', '', 'applied', 'APPLIED']) {
  check(Boolean(statusPatch({ id: 'row-1', status }, TODAY).why), `${status || '(empty)'} is refused`);
}

console.log('\nEverything else in the body is never read');
const greedy = statusPatch({
  id: 'row-1', status: 'Applied',
  role: 'HACKED', company: 'HACKED', notes: 'HACKED', pay: 'HACKED',
  user_id: 'somebody-else', type: 'On-Campus', priority: 'High',
  job_description: 'HACKED', requirements: 'HACKED', contact_email: 'a@b.c',
}, TODAY);
check(Object.keys(greedy.patch).join(',') === 'status,date_applied',
  'the patch holds a status and a date, nothing more', Object.keys(greedy.patch).join(','));
check(!JSON.stringify(greedy).includes('HACKED'), 'none of it survives anywhere in the result');
check(greedy.id === 'row-1', 'and the id is still the one asked for');

console.log('\nMalformed bodies');
for (const [name, body] of [
  ['no id', { status: 'Applied' }],
  ['an empty id', { id: '   ', status: 'Applied' }],
  ['an id that is not a string', { id: 12345, status: 'Applied' }],
  ['no status', { id: 'row-1' }],
  ['a status that is not a string', { id: 'row-1', status: ['Applied'] }],
  ['nothing at all', null],
  ['a string instead of an object', 'id=row-1&status=Applied'],
]) check(Boolean(statusPatch(body, TODAY).why), `${name} is refused`);

console.log('\nDates that are not dates');
for (const bad of ['tomorrow', '25/09/2026', '2026-13-45T00:00:00Z', '', null, 99, { }]) {
  const got = statusPatch({ id: 'row-1', status: 'Applied', date_applied: bad }, TODAY);
  check(got.patch.date_applied === TODAY, `${JSON.stringify(bad)} falls back to today`);
}

// The same check guards the deadline on a saved posting, which is where a
// scraped page can put anything at all.
console.log('\nDates the database would refuse');
{
  const cases = [
    ['2026-09-25', '2026-09-25'],
    ['2026-02-29', null],              // 2026 is not a leap year
    ['2026-13-45', null],              // shaped right, month 13, day 45
    ['2026-13-45T00:00:00Z', null],    // and the same through a timestamp
    ['2026-00-10', null],
    ['2026-09-31', null],              // September has thirty days
    ['2024-02-29', '2024-02-29'],      // 2024 is
    ['25/09/2026', null],
    ['', null],
    [null, null],
  ];
  for (const [input, want] of cases) {
    const got = isoDate(input);
    check(got === want, `${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  }
}

console.log(`\n${right}/${right + fails.length} correct`);
if (fails.length) { for (const f of fails) console.log('  ' + f); process.exit(1); }
