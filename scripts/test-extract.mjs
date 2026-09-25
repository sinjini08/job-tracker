// How much of a real posting the extractor actually gets, and how much of
// that is right.
//
//   npm run extract
//
// Measured against saved pages of live postings from three applicant tracking
// systems, in scripts/fixtures. Expected values were read out of each page's
// own JSON-LD by hand, so a pass means the extractor agrees with the page and
// not merely with itself.
//
// The number that matters is not "fields filled". It is "fields filled
// correctly", counted separately from "fields the caller is told to check",
// because an extractor that fills everything and is wrong a third of the time
// is worse than one that fills less and says which parts it is unsure about.

import { readFileSync } from 'fs';
import { extractJob, htmlToText, looksLikeIndex } from '../lib/extract.js';

const read = (name) => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');

const CASES = [
  {
    name: 'Greenhouse (Stripe)',
    html: () => read('greenhouse'),
    url: 'https://job-boards.greenhouse.io/stripe/jobs/8172487',
    expect: {
      role: 'Abuse Investigator',
      company: 'Stripe',
      location: 'Dublin, IE',          // "Dublin HQ" is an office, not a city
      pay: '€89k – €134k', // EUR, min/max, YEAR
      category: 'Full-time',
      source: 'Company site',          // greenhouse.io is the company's page
      job_link: 'https://stripe.com/careers/listing/abuse-investigator/8172487',
    },
    requirementsStart: '5+ years of experience',
  },
  {
    // Workday, which most large employers' careers sites run on. The fixture
    // keeps the left-hand list and points it deliberately elsewhere: the list
    // and the detail pane share automation ids, so an unscoped read answers
    // Vancouver, Remote and Part Time for a job that is Pleasanton, Flex and
    // Full Time. Every value below is the selected posting's.
    name: 'Workday (detail beside a list)',
    html: () => read('workday'),
    url: 'https://workday.wd5.myworkdayjobs.com/Workday/job/USA-CA-Pleasanton/x_JR-0110265',
    expect: {
      role: 'Manager, Talent Acquisition - North America Revenue',
      company: 'Workday',                // from "Careers at Workday", not the subdomain slug
      location: 'USA, CA, Pleasanton',   // the list says Canada, BC, Vancouver
      work_mode: 'Flex',                 // the tenant's own word, not translated into Hybrid
      category: 'Full-time',             // the list says Part Time
      deadline: '2026-10-30',            // "End Date: October 30, 2026"
      source: 'Company site',
    },
    requirementsStart: 'For Manager (M3) level',
  },
  {
    // Indeed's search view: the list on the left and the posting you clicked
    // on the right, one document. It is an index and a posting at once, and
    // the listing check refused the whole thing before anything could read it.
    name: 'Indeed (search view)',
    html: () => read('indeed'),
    url: 'https://www.indeed.com/jobs?q=frontend',
    expect: {
      role: 'Frontend Developer - AI Trainer',
      company: 'DataAnnotation',
      location: 'Alexandria, VA',
      work_mode: 'Remote',
      pay: '$50 - $100 an hour',
      category: 'Part-time',   // the posting says part-time, contract and full-time
      source: 'Indeed',
    },
    requirementsStart: 'Fluency in English',
  },
  {
    // Signed-in LinkedIn: no JSON-LD, no og: tags, and every class name is a
    // build hash. The first real page this was ever pointed at, and it put
    // the whole page title in the role and found no company at all.
    name: 'LinkedIn (signed in)',
    html: () => read('linkedin'),
    url: 'https://www.linkedin.com/jobs/view/4312345678/',
    expect: {
      role: 'Outbound Sales Representative',   // not "… | GrowGeneration Corp | LinkedIn"
      company: 'GrowGeneration Corp',
      location: 'United States',
      pay: '$20/hr',
      work_mode: 'Remote',   // said Hybrid, then On-site, before the sidebar was walled off
      category: 'Full-time', // LinkedIn's employment type. Term here is academic: Fall 2026
      term: undefined,
      source: 'LinkedIn',
    },
    requirementsStart: 'Proven experience in cold calling',
  },
  {
    name: 'Lever (Spotify)',
    html: () => read('lever'),
    url: 'https://jobs.lever.co/spotify/2193db3f-77c5-43b8-b030-8f92c9882bf1',
    expect: {
      role: 'Android Engineer - Experience',
      company: 'Spotify',
      location: 'Stockholm',           // addressRegion and country are null
      pay: undefined,                  // no baseSalary at all
      category: 'Full-time',           // "Permanent", outside the vocabulary
      source: 'Company site',
    },
    requirementsStart: 'You have experience developing',
  },
  {
    name: 'Ashby (Ramp)',
    html: () => read('ashby'),
    url: 'https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245',
    expect: {
      role: 'Security Engineer, Cloud', // leading space in the source
      company: 'Ramp',
      location: 'New York City, NY',
      pay: '$211k – $291k',
      category: 'Full-time',
      work_mode: 'Remote',             // TELECOMMUTE, despite a NY address
      source: 'Company site',
    },
    requirementsStart: 'Minimum 5 years of experience',
  },
  // Same system, same domain, structured data switched off by the employer.
  // Greenhouse publishes JobPosting for Stripe's board and not for Figma's,
  // which is why the adapter cannot rely on the host to predict it.
  {
    name: 'Greenhouse, no JSON-LD (Figma)',
    html: () => read('greenhouse-nold'),
    url: 'https://job-boards.greenhouse.io/figma/jobs/5426468004',
    expect: {
      role: 'Account Executive, Enterprise',
      company: 'Figma',                   // from "…at Figma" in <title>
      location: 'San Francisco, CA',      // first of a bullet-separated list
      source: 'Company site',
    },
    requirementsStart: null,
  },
  // No structured data and no adapter: meta tags and the biggest body block.
  {
    name: 'Bespoke careers page (Airbnb)',
    html: () => read('bespoke-airbnb'),
    url: 'https://careers.airbnb.com/positions/7789554',
    expect: {
      role: 'Associate Legal Counsel, Japan',
      company: 'Airbnb',                  // og:site_name is "Careers at Airbnb"
      source: 'Company site',
    },
    requirementsStart: null,
  },
];

let right = 0;
let wrong = 0;
const fails = [];

for (const c of CASES) {
  const got = extractJob(c.html(), c.url);
  console.log(`\n${c.name}  ${got.structured ? '(structured)' : '(no JSON-LD)'}`);
  for (const [key, want] of Object.entries(c.expect)) {
    const have = got.fields[key]?.value;
    const ok = want === undefined ? have === undefined : have === want;
    if (ok) right += 1; else { wrong += 1; fails.push(`${c.name} ${key}: got ${JSON.stringify(have)} want ${JSON.stringify(want)}`); }
    const mark = ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m';
    const from = got.fields[key]?.from ?? '-';
    console.log(`  ${mark} ${key.padEnd(16)} ${String(have ?? '(absent)').slice(0, 46).padEnd(48)} ${from}`);
  }
  // The description is the field the whole feature exists for.
  const d = got.fields.job_description?.value ?? '';
  const clean = d.length > 400 && !/<[a-z]/i.test(d) && !/&[a-z]+;/i.test(d);
  console.log(`  ${clean ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${'job_description'.padEnd(16)} ${d.length} chars, tags stripped: ${!/<[a-z]/i.test(d)}`);
  if (clean) right += 1; else { wrong += 1; fails.push(`${c.name} job_description: ${d.length} chars`); }
  // The field that reads prose, so the one that drifts. It must be found, and
  // it must be a requirement rather than a sentence mentioning the word: the
  // first version pulled in "We're looking for someone who meets the minimum
  // requirements", which is exactly the wrong-field problem this is meant to
  // avoid.
  const req = got.fields.requirements?.value ?? '';
  if (c.requirementsStart) {
    const reqOk = req.startsWith(c.requirementsStart) && !/looking for someone who/i.test(req);
    if (reqOk) right += 1; else { wrong += 1; fails.push(`${c.name} requirements: got ${JSON.stringify(req.slice(0, 70))} want start ${JSON.stringify(c.requirementsStart)}`); }
    console.log(`  ${reqOk ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${'requirements'.padEnd(16)} ${JSON.stringify(req.slice(0, 44))}`);
  } else {
    console.log(`       ${'requirements'.padEnd(16)} ${req ? JSON.stringify(req.slice(0, 44)) : '(none, prose has no heading)'}`);
  }
  console.log(`       fields filled: ${Object.keys(got.fields).length}, of which to check: ${Object.keys(got.review).length}`);
}

// Entity decoding and tag stripping, on the shapes each system actually uses.
// A LinkedIn tab is not one fixed document. The card renders in stages, the
// app leaves old <title> tags behind when it changes route, and the first
// anchor this adapter used sat below the fold and was simply absent when the
// popup read the page. Each of these is a state a real tab was in.
console.log('\nLinkedIn, half rendered');
{
  const full = read('linkedin');
  const url = 'https://www.linkedin.com/jobs/view/4312345678/';
  const noAlert = full.replace(/aria-label="Set alert for similar jobs as [^"]+"/i, '');
  const states = [
    ['as captured', full],
    ['the Set-alert label has not rendered', noAlert],
    ['nor has the company label', noAlert.replace(/aria-label="Company,[^"]*"/gi, '')],
    ['a stale Feed title from the previous route', full.replace('<title>', '<title>Feed | LinkedIn</title><title>')],
  ];
  for (const [name, html] of states) {
    const f = extractJob(html, url).fields;
    const got = `${f.role?.value ?? '(no role)'} / ${f.company?.value ?? '(no company)'} / ${f.work_mode?.value ?? '(no mode)'}`;
    const ok = got === 'Outbound Sales Representative / GrowGeneration Corp / Remote';
    if (ok) right += 1; else { wrong += 1; fails.push(`LinkedIn, ${name}: ${got}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name.padEnd(44)} ${got.slice(0, 46)}`);
  }
}

// A heading only counts if it is on its own line, and only if the wording is
// one this recognises. A real posting failed both tests at once: the heading
// was glued onto the previous bullet because an opening <p> produced no line
// break, and "The skills you will need to be successful in the above:" was
// eleven words when the limit was six.
// The refusal is still right, and it still has to be reachable. The same
// fixture read as any other host is refused, which is what shows the Indeed
// reader is doing the work rather than the check having been weakened.
console.log('\nA page that is a list and a posting at once');
{
  const html = read('indeed');
  const asIndeed = extractJob(html, 'https://www.indeed.com/jobs?q=frontend');
  const asOther = extractJob(html, 'https://somewhere.example/x');
  const pairs = [
    ['the posting beside the list is read', asIndeed.isIndex === false && asIndeed.fields.role?.value === 'Frontend Developer - AI Trainer'],
    ['and the same page elsewhere is still refused', asOther.isIndex === true],
  ];
  for (const [name, ok] of pairs) {
    if (ok) right += 1; else { wrong += 1; fails.push(`index bypass: ${name}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
  }
}

console.log('\nRequirements, from a posting that gave none');
{
  const lines = [
    '<p>About the role:</p>',
    '<p>You will drive pipeline generation across the USA.</p>',
    '<ul><li>Own your pipeline: take full responsibility for prospecting.</li>',
    '<li>Collaborate cross-functionally: work closely with Marketing.</li></ul>',
    '<p>The skills you will need to be successful in the above:</p>',
    '<ul><li>A minimum of 1 years experience in a BDR, SDR, or outbound sales role.</li>',
    '<li>Demonstrated track record of exceeding pipeline generation targets</li>',
    '<li>Fluent English speaker, with exceptional written communication skills</li>',
    '<li>Experience with HubSpot CRM</li></ul>',
    '<p>What\u2019s in it for you:</p><ul><li>Competitive commission</li></ul>',
  ].join('');
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'JobPosting',
    title: 'Business Development Representative',
    hiringOrganization: { name: 'Goodnotes' },
    description: lines,
  });
  const html = `<html><head><title>x</title><${'script'} type="application/ld+json">${ld}</${'script'}></head><body></body></html>`;
  const got = extractJob(html, 'https://www.linkedin.com/jobs/view/1/').fields.requirements?.value ?? '';
  const want = [
    ['the heading is found at all', Boolean(got)],
    ['it starts at the skills, not the duties', got.startsWith('A minimum of 1 years')],
    ['it does not run on into the benefits', !/commission/i.test(got)],
    ['and not into the duties above it', !/Own your pipeline/i.test(got)],
  ];
  for (const [name, ok] of want) {
    if (ok) right += 1; else { wrong += 1; fails.push(`requirements: ${name}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
  }
}

console.log('\nDescription cleanup');
const cases = [
  ['<p>One</p><p>Two</p>', 'One\n\nTwo'],
  ['<ul><li>A</li><li>B</li></ul>', '- A\n- B'],
  ['Caf&eacute; &amp; more', 'Café & more'],
  ['<h2>Head</h2><p>Body<br>Next</p>', 'Head\n\nBody\nNext'],
  ['<script>bad()</script><p>Fine</p>', 'Fine'],
];
for (const [input, want] of cases) {
  const have = htmlToText(input);
  const ok = have === want;
  if (ok) right += 1; else { wrong += 1; fails.push(`htmlToText ${JSON.stringify(input)}: got ${JSON.stringify(have)}`); }
  console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${JSON.stringify(input).slice(0, 40).padEnd(42)} -> ${JSON.stringify(have).slice(0, 30)}`);
}

// A listing page is not a posting. The coverage sample included a company's
// open-positions index, which would otherwise have become a row called
// "Current job openings". Refusing has to be narrow, though: matching the bare
// word "careers" refused a real Airbnb posting titled "… - Careers at Airbnb",
// and refusing a real page is worse than accepting a bad one, because a bad
// row can be deleted.
console.log('\nListings, which are not postings');
for (const [name, file, want] of [
  ['an open-positions index', 'index-page', true],
  ['a real posting on a careers domain', 'bespoke-airbnb', false],
  ['a posting with JSON-LD', 'ashby', false],
]) {
  const got = looksLikeIndex(read(file));
  const ok = got === want;
  if (ok) right += 1; else { wrong += 1; fails.push(`looksLikeIndex(${file}) = ${got}, want ${want}`); }
  console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name.padEnd(38)} refused: ${got}`);
}

const total = right + wrong;
console.log(`\n${right}/${total} correct (${Math.round((right / total) * 100)}%)`);
if (fails.length) { console.log('\nFailures:'); fails.forEach((f) => console.log('  ' + f)); }
process.exit(wrong ? 1 : 0);
