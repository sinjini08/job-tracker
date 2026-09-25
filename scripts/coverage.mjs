// How much of a row the extension can actually fill.
//
// Standing check, not a spot one. It is easy to fix the field somebody just
// complained about and not notice that another went quiet, so every fixture
// is measured against every column the tracker has, every run.
//
// The columns are in three groups, because "missing" means different things.
// A posting always names the job and who is hiring, so an empty one there is
// a bug and fails the run. Pay and a deadline are often simply not published,
// so those are reported and not judged. The rest is the person's own record
// of what they did, which no web page can know and the extension must never
// invent.
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractJob } from '../lib/extract.js';
import { WRITABLE } from '../lib/fields.js';

const here = dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(join(here, 'fixtures', `${name}.html`), 'utf8');

const ALWAYS = ['role', 'company', 'job_link', 'source', 'job_description'];
const OFTEN = ['location', 'pay', 'work_mode', 'category', 'deadline', 'requirements', 'term', 'hours_per_week'];
const THEIRS = [
  'type', 'status', 'priority', 'date_applied', 'next_follow_up', 'referral',
  'outreach_method', 'resume_version', 'cover_letter', 'remind', 'contact',
  'contact_email', 'contact_link', 'reached_out_on', 'notes', 'custom',
];

const CASES = [
  ['greenhouse', 'https://job-boards.greenhouse.io/stripe/jobs/8172487'],
  ['greenhouse-nold', 'https://job-boards.greenhouse.io/figma/jobs/5426468004'],
  ['lever', 'https://jobs.lever.co/spotify/2193db3f'],
  ['ashby', 'https://jobs.ashbyhq.com/ramp/1'],
  ['bespoke-airbnb', 'https://careers.airbnb.com/positions/1'],
  ['linkedin', 'https://www.linkedin.com/jobs/view/4312345678/'],
  ['indeed', 'https://www.indeed.com/jobs?q=frontend'],
  ['workday', 'https://workday.wd5.myworkdayjobs.com/Workday/job/x_JR-0110265'],
  ['workday-direct', 'https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/x_JR-0110265'],
];

// Every column has to be in exactly one group, or a new column could be added
// to the tracker and quietly never be looked for.
const covered = new Set([...ALWAYS, ...OFTEN, ...THEIRS]);
const unclassified = [...WRITABLE].filter((k) => !covered.has(k));

const mark = (on) => (on ? '\x1b[32m●\x1b[0m' : '\x1b[31m·\x1b[0m');
const pad = (s, n) => String(s).padEnd(n);

console.log('\nWhat the extension fills, per site\n');
console.log(`  ${pad('', 22)}${[...ALWAYS, ...OFTEN].map((k) => pad(k.slice(0, 9), 10)).join('')}`);

const gaps = [];
const tally = Object.fromEntries([...ALWAYS, ...OFTEN].map((k) => [k, 0]));

for (const [name, url] of CASES) {
  const { fields } = extractJob(read(name), url);
  const row = [...ALWAYS, ...OFTEN].map((k) => {
    const on = Boolean(fields[k]?.value);
    if (on) tally[k] += 1;
    if (!on && ALWAYS.includes(k)) gaps.push(`${name}: ${k}`);
    return pad(mark(on), 10 + 9);      // the colour codes take width
  });
  console.log(`  ${pad(name, 22)}${row.join('')}`);
}

console.log(`\n  ${pad('filled, of 9 sites', 22)}${[...ALWAYS, ...OFTEN].map((k) => pad(`${tally[k]}/9`, 10)).join('')}`);

console.log(`\nNever taken from a page, because only the person knows it:\n  ${THEIRS.join(', ')}`);

if (unclassified.length) {
  console.log(`\n\x1b[31mColumns in the tracker that this report does not account for: ${unclassified.join(', ')}\x1b[0m`);
}
if (gaps.length) {
  console.log('\n\x1b[31mFields that should never be empty, and are:\x1b[0m');
  for (const g of gaps) console.log('  ' + g);
}
if (gaps.length || unclassified.length) process.exit(1);
console.log('\n\x1b[32mevery site gives up the fields it always should\x1b[0m');
