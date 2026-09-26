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
      pay: '$149,700 USD - $224,500 USD', // no field for it; read out of the prose
      category: 'Full-time',             // the list says Part Time
      deadline: '2026-10-30',            // "End Date: October 30, 2026"
      source: 'Company site',
    },
    requirementsStart: 'For Manager (M3) level',
  },
  {
    // Jobright ships the whole posting as JSON in a script tag, which makes
    // it the cleanest of the lot to read. Twelve fields, the only fixture
    // with a real term and the only one with hours.
    name: 'Jobright (JSON in the page)',
    html: () => read('jobright'),
    url: 'https://jobright.ai/jobs/info/6ab5bc02b3db59402d0fecc2',
    expect: {
      role: 'Software Development Engineer Intern - Summer 2027 (USA) , Amazon Dedicated Cloud (ADC)',
      company: 'Amazon',
      location: 'Jessup, MD / Seattle, WA / Arlington, VA / Denver, CO',  // all four, not the first
      work_mode: 'On-site',
      pay: '$109K/yr - $109K/yr',
      category: 'Internship',
      term: 'Summer 2027',            // named in the title
      hours_per_week: 40,             // "Work 40 hours/week minimum", in the requirements
      source: 'Jobright',
      // Amazon's own posting, not the Jobright page: that is where the
      // application happens and it outlives anyone's account here.
      job_link: 'https://www.amazon.jobs/en/jobs/10559746/software-development-engineer-intern-summer-2027-usa-amazon-dedicated-cloud-adc',
    },
    // Eligibility first, because "U.S. Citizen Only" decides whether a
    // student can apply at all and Jobright files it away from the rest.
    requirementsStart: 'No H1B',
  },
  {
    // Handshake, where most US university students actually apply. No
    // JSON-LD, a generic page title, and styled-components class hashes, so
    // the role came out as "Handshake" and there was no company at all.
    //
    // The fixture keeps the list on the left and points it at other
    // employers, because the first attempt read the document's first
    // employer link and answered with one of them.
    name: 'Handshake (detail beside a list)',
    html: () => read('handshake'),
    url: 'https://app.joinhandshake.com/stu/jobs/11462397',
    expect: {
      role: 'Software Engineer',
      company: 'TradingBlock',        // not the industry link beside it, nor one from the list
      location: 'Chicago, IL',
      work_mode: 'Hybrid',            // "Hybrid or onsite, based in Chicago, IL"
      pay: 'US$80\u2013US90k/yr',
      category: 'Full-time',
      deadline: '2026-10-25',         // "Apply by October 25, 2026 at 12:59 AM"
      source: 'Handshake',
    },
    requirementsStart: 'We aren\u2019t looking for years of experience',
  },
  {
    // The same Workday posting at its own URL, which does publish JSON-LD.
    // That used to mean the page reader never ran, and the structured data
    // has no salary and calls the employment type OTHER, so pay and category
    // came back empty on the richer page. Both run now.
    name: 'Workday (direct URL, has JSON-LD)',
    html: () => read('workday-direct'),
    url: 'https://workday.wd5.myworkdayjobs.com/en-US/Workday/job/x_JR-0110265',
    expect: {
      role: 'Manager, Talent Acquisition - North America Revenue',
      company: 'Workday, Inc.',                          // JSON-LD's name, not the page's
      location: 'USA, CA, Pleasanton, United States of America',
      deadline: '2026-10-30',                            // validThrough
      pay: '$149,700 USD - $224,500 USD',                // prose; JSON-LD has no baseSalary
      category: 'Full-time',                             // JSON-LD says OTHER
      work_mode: 'Flex',                                 // JSON-LD says TELECOMMUTE
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
      category: 'Full-time', // LinkedIn's employment type
      term: 'Ongoing',       // term here is academic, and a permanent job has no season
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
// Workday publishes no pay field, so it is read out of the description. A
// posting is full of other numbers, and none of them are wages.
// Handshake matches a posting against the student's own profile and shows
// the result in the same panel: "You do not match any qualifications", the
// courses it wants, a prompt to update the profile. None of that is anything
// the employer wrote and none of it belongs in a row.
// Jobright's blob carries a great deal about the person reading it, next to
// the posting itself: how strongly they match, which of their skills scored
// what, and the names of people they know at the company. The fixture keeps
// all of it, so this fails if any of it ever reaches a row.
console.log('\nJobright: the posting is read, the person is not');
{
  const all = JSON.stringify(extractJob(read('jobright'), 'https://jobright.ai/jobs/info/x').fields);
  for (const phrase of ['Ryan', 'socialConnections', 'recommendationScores', 'q_seniority_match', 'Strong Match', 'displayScore', 'isLiked']) {
    const ok = !all.includes(phrase);
    if (ok) right += 1; else { wrong += 1; fails.push(`jobright: "${phrase}" reached a field`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} "${phrase}" stays out of the row`);
  }
}

// The posting states fifteen requirements and four locations. Saving the
// first of each threw away the ones that decide whether a student can apply.
console.log('\nJobright: nothing the posting states is dropped');
{
  const { fields } = extractJob(read('jobright'), 'https://jobright.ai/jobs/info/x');
  const reqs = fields.requirements?.value ?? '';
  const pairs = [
    ['all four locations are kept', (fields.location?.value ?? '').split(' / ').length === 4],
    ['all fifteen requirements are kept', reqs.split('\n').length === 18],
    ['including the degree conferral window', reqs.includes('October 2027')],
    ['and the quarter-remaining rule', reqs.includes('quarter/semester/trimester')],
    ['eligibility is lifted to the top', reqs.startsWith('No H1B')],
    ['and the citizenship gate is there', reqs.includes('U.S. Citizen Only')],
  ];
  for (const [name, ok] of pairs) {
    if (ok) right += 1; else { wrong += 1; fails.push(`jobright: ${name}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
  }
}

console.log('\nHandshake keeps its profile matching to itself');
{
  const { fields } = extractJob(read('handshake'), 'https://app.joinhandshake.com/stu/jobs/1');
  const all = JSON.stringify(fields);
  for (const phrase of ['do not match any qualifications', 'Update profile', 'Matching is based on your profile']) {
    const ok = !all.includes(phrase);
    if (ok) right += 1; else { wrong += 1; fails.push(`handshake: "${phrase}" reached a field`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} "${phrase}" stays out of the row`);
  }
}

// A bespoke careers page has no structured data and no labelled fields, so
// the only place the arrangement and the place are stated is the prose. A
// real Airbnb posting said "Your Location: This position is US - Remote
// Eligible" and both came back empty.
// The key-details table a lot of careers pages end with: a label on one
// line, its value on the next. A real IBM posting stated its city, state,
// country, work arrangement and salary range in one, and every one of them
// came back empty because nothing read it.
// Who may hold the job at all, which a posting states wherever it likes.
//
// The most consequential sentence in the IBM posting is "IBM will not be
// providing visa sponsorship for this position now or in the future", and it
// sits in a wall of legal boilerplate with no heading of its own. For an
// international student that line decides whether the rest is worth reading.
console.log('\nThe eligibility gate comes first');
{
  const say = (body) => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Engineer',
      hiringOrganization: { name: 'Acme' },
      description: body.split('\n').map((l) => `<p>${l}</p>`).join(''),
    });
    const html = `<html><head><title>x</title><${'script'} type="application/ld+json">${ld}</${'script'}></head><body></body></html>`;
    return extractJob(html, 'https://careers.example.com/j').fields.requirements?.value ?? '';
  };
  const ibm = say([
    'Required technical and professional expertise',
    '- Prior (project or internship) experience in software development',
    '- Strong verbal and written communication skills',
    '- Proficiency in C++, C, Java, Golang, Ruby, Python, Perl, SQL.',
    'IBM is also committed to compliance with all fair employment practices regarding citizenship and immigration status.',
    'IBM will not be providing visa sponsorship for this position now or in the future.',
  ].join('\n'));

  const pairs = [
    ['the sponsorship line leads', ibm.startsWith('IBM will not be providing visa sponsorship')],
    ['with its subject, not headless', !ibm.startsWith('will not')],
    ['the real requirements follow it', ibm.includes('Prior (project or internship) experience')],
    ['and it is not repeated inside them', ibm.split('visa sponsorship').length === 2],
    ['boilerplate ends the list', !ibm.includes('fair employment practices')],
    ['a heading nothing knew is still found', ibm.includes('Proficiency in C++')],
    ['a compliance statement is not a gate',
      !say('Qualifications\n- Three years of Python\nAcme is committed to compliance with all fair employment practices regarding citizenship.').includes('citizenship')],
    ['must be authorised to work counts',
      say('Requirements\n- Three years of Python\nYou must be legally authorized to work in the United States.').includes('authorized to work')],
    ['a clearance requirement counts',
      say('Requirements\n- Three years of Python\nAn active security clearance is required for this role.').includes('security clearance')],
  ];
  for (const [name, ok] of pairs) {
    if (ok) right += 1; else { wrong += 1; fails.push(`eligibility: ${name}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
  }
}

console.log('\nThe key-details table at the foot of a posting');
{
  const body = readFileSync(new URL('./fixtures/ibm-details.txt', import.meta.url), 'utf8');
  const ld = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'JobPosting',
    title: 'Entry level Backend Developer - San Jose, CA - 2027',
    hiringOrganization: { name: 'IBM' },
    description: body.split('\n').map((l) => (l.trim() ? `<p>${l}</p>` : '')).join(''),
  });
  const html = `<html><head><title>x</title><${'script'} type="application/ld+json">${ld}</${'script'}></head><body></body></html>`;
  const f = extractJob(html, 'https://careers.ibm.com/en_US/careers/JobDetail/x/131805').fields;
  const pairs = [
    ['city, state and country are joined', f.location?.value === 'San Jose, California, United States'],
    ['the salary range needs no currency symbol', f.pay?.value === '120,960 - 181,440 per year'],
    ['work arrangement is read from its label', f.work_mode?.value === 'Hybrid'],
    // "Regular" means permanent, not full-time. A regular part-time job is an
    // ordinary thing, so nothing is put in the column the posting never filled.
    ['"Employment type: Regular" is not full-time', f.category === undefined],
    ['nor does 120 hours vacation become the pay', !/120 hours/.test(f.pay?.value ?? '')],
    ['nor 56 hours sick time the hours a week', f.hours_per_week === undefined],
  ];
  for (const [name, ok] of pairs) {
    if (ok) right += 1; else { wrong += 1; fails.push(`ibm table: ${name}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
  }
}

console.log('\nWhere the job is, said in prose');
{
  const say = (line) => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Engineer',
      hiringOrganization: { name: 'Acme' },
      description: `<p>About the role.</p><p>${line}</p><p>We build things and we care about them deeply, every day.</p>`,
    });
    const html = `<html><head><title>x</title><${'script'} type="application/ld+json">${ld}</${'script'}></head><body></body></html>`;
    const f = extractJob(html, 'https://careers.example.com/j').fields;
    return [f.location?.value ?? null, f.work_mode?.value ?? null];
  };
  const cases = [
    ['Airbnb, exactly as written', say('Your Location:</p><p>This position is US - Remote Eligible. The role may include occasional work at an office.'), ['United States', 'Remote']],
    ['a city and state beats a country', say('Location:</p><p>Austin, TX, United States. Some travel expected.'), ['Austin, TX', null]],
    ['a country on its own', say('Your Location:</p><p>This role is based in Canada.'), ['Canada', null]],
    ['remote-friendly counts', say('This is a remote-friendly role on a distributed team.'), [null, 'Remote']],
    ['so does "this role is fully remote"', say('This role is fully remote across the country.'), [null, 'Remote']],
    ['no location heading, no location', say('We are a distributed team spread across Austin, TX and elsewhere.'), [null, null]],
    ['prose about entities is not an address', say('Your Location:</p><p>You must live in a state where Acme, Inc. has a registered entity.'), [null, null]],
    ['occasional remote work is not remote', say('The role is based in the office, with occasional remote work allowed.'), [null, 'On-site']],
    ['hybrid still wins where it is said', say('Your Location:</p><p>London, UK. This is a hybrid role, three days in office.'), ['London, UK', 'Hybrid']],
  ];
  for (const [name, have, want] of cases) {
    const ok = have[0] === want[0] && have[1] === want[1];
    if (ok) right += 1; else { wrong += 1; fails.push(`location: ${name}: got ${JSON.stringify(have)} want ${JSON.stringify(want)}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name.padEnd(36)} ${JSON.stringify(have)}`);
  }
}

console.log('\nPay written into the prose');
{
  const say = (line) => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'JobPosting', title: 'Engineer',
      hiringOrganization: { name: 'Acme' },
      description: `<p>About the role.</p><p>${line}</p><p>We build things and we care about them deeply, every day.</p>`,
    });
    const html = `<html><head><title>x</title><${'script'} type="application/ld+json">${ld}</${'script'}></head><body></body></html>`;
    return extractJob(html, 'https://example.com/j').fields.pay?.value ?? null;
  };
  const cases = [
    ['a labelled range is taken', say('Primary Location Base Pay Range: $149,700 USD - $224,500 USD'), '$149,700 USD - $224,500 USD'],
    ['an hourly rate is taken', say('Compensation: $32.50 per hour, depending on experience.'), '$32.50 per hour'],
    ['pounds work too', say('Salary: \u00a345,000 - \u00a352,000 depending on experience'), '\u00a345,000 - \u00a352,000'],
    ['a budget is not a wage', say('You will manage a $5M budget across the region and report on spend.'), null],
    ['nor is a revenue figure', say('Our customers include firms with over $1B in annual revenue.'), null],
    ['nor is a warning about fees', say('Acme will never ask candidates to pay a recruiting fee in order to apply.'), null],
  ];
  for (const [name, have, want] of cases) {
    const ok = have === want;
    if (ok) right += 1; else { wrong += 1; fails.push(`pay: ${name}: got ${JSON.stringify(have)}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name.padEnd(30)} ${have ?? '(none)'}`);
  }
}

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

// Term and hours were both empty on all ten fixtures. Term turned out not to
// be broken: none of those ten postings names a season, which is what a
// permanent job looks like. These are the postings that do say.
console.log('\nTerm and hours, where a posting states them');
{
  const say = (title, line, employmentType = 'FULL_TIME') => {
    const ld = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'JobPosting', title,
      hiringOrganization: { name: 'Acme' }, employmentType,
      description: `<p>About the role.</p><p>${line}</p><p>We build things and we care about them deeply, every day.</p>`,
    });
    const html = `<html><head><title>x</title><${'script'} type="application/ld+json">${ld}</${'script'}></head><body></body></html>`;
    const f = extractJob(html, 'https://example.com/j').fields;
    return [f.term?.value ?? null, f.hours_per_week?.value ?? null];
  };
  const cases = [
    ['a named season wins', say('Software Engineer Intern', 'Our Summer 2027 internship runs for twelve weeks.', 'INTERN'), ['Summer 2027', null]],
    ['autumn is called Fall here', say('Co-op Student', 'This is our Autumn 2026 co-op placement.', 'INTERN'), ['Fall 2026', null]],
    ['a permanent job is Ongoing', say('Software Engineer', 'This is a permanent position on our platform team.'), ['Ongoing', null]],
    ['hours are read when stated', say('Research Assistant', 'You will work 15 hours per week during term.', 'PART_TIME'), [null, 15]],
    ['a range gives its top end', say('Lab Assistant', 'Expect 10-20 hrs a week depending on the schedule.', 'PART_TIME'), [null, 20]],
    ['nothing is invented from silence', say('Software Engineer Intern', 'You will join a small team and learn fast.', 'INTERN'), [null, null]],
  ];
  for (const [name, have, want] of cases) {
    const ok = have[0] === want[0] && have[1] === want[1];
    if (ok) right += 1; else { wrong += 1; fails.push(`term/hours: ${name}: got ${JSON.stringify(have)} want ${JSON.stringify(want)}`); }
    console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name.padEnd(34)} ${JSON.stringify(have)}`);
  }
}


const total = right + wrong;
console.log(`\n${right}/${total} correct (${Math.round((right / total) * 100)}%)`);
if (fails.length) { console.log('\nFailures:'); fails.forEach((f) => console.log('  ' + f)); }
process.exit(wrong ? 1 : 0);
