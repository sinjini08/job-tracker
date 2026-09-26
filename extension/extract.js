// Copied from lib/extract.js by scripts/sync-extension.mjs. Do not edit here:
// edit lib/extract.js, which is the one with tests against saved postings, and
// run npm run ext:sync. npm run ext:check fails if these two differ.

// Read a job posting off a page.
//
// Takes HTML as a string and returns the tracker's fields. A string, not a
// Document, for two reasons: the extension can hand it
// document.documentElement.outerHTML, which is the page as rendered, so
// client-side sites work; and the same function runs under node with no
// dependencies, so it can be tested against saved pages of real postings.
//
// What separates this from an extractor that fills half the row and puts the
// wrong thing in the other half:
//
//   Nothing is guessed silently. Every field comes back with where it came
//   from, and the caller is expected to show the low-confidence ones for
//   checking rather than saving them quietly. A wrong value in a field is
//   worse than an empty field, because an empty field is obvious.
//
//   The structured source is trusted and the page text is not. schema.org
//   JobPosting is published by every major applicant tracking system for
//   Google Jobs, and it is the difference between reading a field and
//   scraping for one.
//
//   Every shape of every field is handled, because they genuinely differ.
//   Checked against live postings from three systems, saved in
//   scripts/fixtures:
//     jobLocation is an array on Greenhouse and Lever, a bare object on Ashby
//     Lever writes literal nulls into addressRegion and addressCountry, so
//       joining the parts prints "Stockholm, null, null"
//     baseSalary is absent on Lever and a nested QuantitativeValue elsewhere,
//       so reading .value gives an object and prints [object Object]
//     employmentType is FULL_TIME on two and "Permanent" on Lever, which is
//       not in the vocabulary at all
//     Ashby says TELECOMMUTE while also giving a New York address, so the
//       address alone would call a remote job on-site
//     Greenhouse's locality is "Dublin HQ", an office, not a city
//     Ashby's title has a leading space
//
//   h1 is not a fallback for the title. On Ashby the first h1 is "About
//   Ramp", a section heading, and Lever has no h1 at all. That single
//   shortcut is how a role field ends up reading "About Ramp".

import { isoDate } from './iso-date.js';

const HIGH = 'json-ld';
const MED = 'derived';
const LOW = 'guess';

// ---------------------------------------------------------------- html bits

const LD = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

// Every JobPosting on the page, however it is nested. Some sites wrap
// everything in @graph, some ship a bare array, some a single object.
export function jobPostings(html) {
  const out = [];
  const walk = (node, depth = 0) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    if (typeof node !== 'object') return;
    const type = node['@type'];
    const types = Array.isArray(type) ? type : [type];
    if (types.includes('JobPosting')) out.push(node);
    if (node['@graph']) walk(node['@graph'], depth + 1);
  };
  for (const m of String(html).matchAll(LD)) {
    let parsed;
    // Trailing commas and stray control characters are common enough in the
    // wild that one bad block must not lose the others.
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    walk(parsed);
  }
  return out;
}

const meta = (html, prop) => {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${prop}["'][^>]*content\\s*=\\s*["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = String(html).match(re);
    if (m) return decode(m[1]).trim();
  }
  return '';
};

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–',
  mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  hellip: '…', eacute: 'é', pound: '£', euro: '€', reg: '®', trade: '™',
};

export function decode(s) {
  return String(s ?? '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

// Description HTML to something a person would want to read in a text area:
// one blank line between blocks, list items as dashes, no tag soup.
export function htmlToText(html) {
  return decode(
    String(html ?? '')
      .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '')
      // Opening a block starts a line as much as closing one ends it. Without
      // this, "</li><p>The skills you will need:</p>" runs the heading onto
      // the end of the last bullet, and a heading that is not on its own line
      // is not a heading any more: a real posting came back with an empty
      // requirements field for exactly this reason.
      .replace(/<(p|div|h[1-6]|ul|ol|tr|section|article)\b[^>]*>/gi, '\n')
      .replace(/<\/(p|div|h[1-6]|ul|ol|tr|section|article)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------ the fields

// Nulls, empty strings and the string "null" all mean absent. Lever writes
// real nulls into the address, which is what turns a join into "Stockholm,
// null, null".
const real = (v) => {
  const s = clean(v);
  return s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined' ? s : '';
};

const first = (v) => (Array.isArray(v) ? v[0] : v);

function place(post) {
  const loc = first(post.jobLocation);
  const addr = loc?.address ?? loc;
  if (!addr || typeof addr !== 'object') return real(loc);
  // An office name rather than a city: "Dublin HQ", "London Office". Keep the
  // place, drop the label, because "Dublin HQ, IE" is not a location.
  const city = real(addr.addressLocality).replace(/\s+(HQ|Office|Campus)$/i, '');
  const region = real(addr.addressRegion);
  const country = real(addr.addressCountry);
  // The country is only worth saying when there is no region, otherwise
  // "Boston, MA, US" where "Boston, MA" is what anybody writes.
  const parts = [city, region || (city && country !== 'US' && country !== 'USA' ? country : '')];
  return parts.filter(Boolean).join(', ');
}

const CURRENCY = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', INR: '₹' };

const round = (n) => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

function salary(post) {
  const b = post.baseSalary;
  if (!b || typeof b !== 'object') return '';
  const v = b.value ?? b;
  const sym = CURRENCY[b.currency] ?? (b.currency ? `${b.currency} ` : '');
  const unit = String(v.unitText ?? '').toUpperCase();
  const suffix = unit === 'HOUR' ? '/hr' : unit === 'WEEK' ? '/wk' : unit === 'MONTH' ? '/mo' : '';
  const hourly = unit === 'HOUR';
  const num = (n) => (hourly ? String(Math.round(n * 100) / 100) : round(n));
  const lo = Number(v.minValue);
  const hi = Number(v.maxValue);
  const one = Number(v.value);
  if (Number.isFinite(lo) && Number.isFinite(hi) && lo !== hi) {
    return `${sym}${num(lo)} – ${sym}${num(hi)}${suffix}`;
  }
  const only = [one, lo, hi].find(Number.isFinite);
  return Number.isFinite(only) ? `${sym}${num(only)}${suffix}` : '';
}

// The tracker's own categories, which are not schema.org's vocabulary.
const CATEGORY = {
  INTERN: 'Internship', INTERNSHIP: 'Internship',
  FULL_TIME: 'Full-time', FULLTIME: 'Full-time', 'FULL TIME': 'Full-time',
  PART_TIME: 'Part-time', PARTTIME: 'Part-time', 'PART TIME': 'Part-time',
};

function category(post, role, text) {
  const raw = first(post.employmentType);
  const mapped = CATEGORY[String(raw ?? '').toUpperCase().replace(/-/g, '_')];
  if (mapped) return { value: mapped, from: HIGH };
  // An internship is usually said in the title even when employmentType is
  // FULL_TIME, which is how most graduate schemes are tagged.
  if (/\bintern(ship)?\b/i.test(role)) return { value: 'Internship', from: MED };
  if (/\bco-?op\b/i.test(role)) return { value: 'Co-op', from: MED };
  if (/\b(TA|teaching assistant|research assistant|LA)\b/.test(role)) return { value: 'Research / TA / LA', from: MED };
  if (/\bwork[- ]study\b/i.test(text)) return { value: 'Work-Study', from: MED };
  // "Permanent" and "Regular" are outside the vocabulary but mean full time
  // everywhere they appear. A guess, and labelled as one.
  if (/permanent|regular/i.test(String(raw))) return { value: 'Full-time', from: LOW };
  return null;
}

function workMode(post, text) {
  const type = String(first(post.jobLocationType) ?? '').toUpperCase();
  // The only structured signal for remote, and it coexists with a street
  // address, so the address cannot be read as meaning on-site.
  if (type === 'TELECOMMUTE') return { value: 'Remote', from: HIGH };
  if (/\bhybrid\b/i.test(text)) return { value: 'Hybrid', from: MED };
  // "Remote Eligible" is how a great many employers say it, Airbnb included,
  // and none of the phrasings here matched it. The bare word is still not
  // enough: a posting says "occasional remote work" and means the opposite.
  if (/\b(?:fully|100%)\s+remote\b|\bremote[- ](?:first|eligible|friendly)\b|\bthis (?:position|role|job) is[^.]{0,20}\bremote\b|\bremote (?:position|role)\b/i.test(text)) {
    return { value: 'Remote', from: MED };
  }
  // "based in the office" is as common as "in-office" and was not matched.
  if (/\bon[- ]?site\b|\bin[- ]?(?:the\s+)?office\b/i.test(text)) return { value: 'On-site', from: MED };
  return null;
}

// Where the job is, when a page states it in prose and nowhere else.
//
// Bespoke careers pages have no structured data and no labelled field, but
// they nearly all write a heading. Airbnb's says "Your Location:" and then
// "This position is US - Remote Eligible", and both the place and the
// arrangement were being lost because nothing looked there.
//
// Only the sentence under that heading is read, and only a shape that is
// recognisably a place is taken from it, so the surrounding prose about
// registered entities and excluded states cannot become an address.
const LOCATION_HEAD = /(?:^|\n)\s*(?:your\s+)?location\s*:?\s*([\s\S]{0,200})/i;
const CITY_STATE = /\b([A-Z][a-zA-Z.'\u2019-]+(?:\s+[A-Z][a-zA-Z.'\u2019-]+)*,\s*[A-Z]{2})\b/;
const COUNTRY = [
  [/\b(?:United States|U\.?S\.?A?\.?)\b/i, 'United States'],
  [/\bUnited Kingdom\b|\bU\.?K\.?\b/i, 'United Kingdom'],
  [/\bCanada\b/i, 'Canada'],
  [/\bIreland\b/i, 'Ireland'],
  [/\bIndia\b/i, 'India'],
  [/\bAustralia\b/i, 'Australia'],
  [/\bGermany\b/i, 'Germany'],
  [/\bSingapore\b/i, 'Singapore'],
];

// The key-details table many careers pages end with.
//
// IBM's is a label on one line and its value on the next: "City / Township /
// Village", then "San Jose". Taleo, SuccessFactors and Oracle all do a
// version of it. Nothing read it, so a posting that states its city, its
// country, its salary and its work arrangement outright gave up none of them.
//
// Read as exact labels rather than as text containing a word, because the
// prose above the table is full of the same words: "the salary will vary",
// "based on a full-time schedule", "120 hours vacation".
const LABELS = [
  [/^city(?:\s*[/|].*)?$/i, 'city'],
  [/^(?:state|province)(?:\s*[/|].*)?$/i, 'state'],
  [/^country(?:\s*[/|].*)?$/i, 'country'],
  [/^(?:location|job location|primary location)$/i, 'place'],
  [/^(?:work arrangement|work model|workplace type|work setting|remote status)$/i, 'work_mode'],
  [/^(?:employment type|position type|job type|employment status|schedule)$/i, 'kind'],
  [/^(?:projected\s+)?min(?:imum)?\s+salary(?:\s+per\s+year)?$/i, 'pay_min'],
  [/^(?:projected\s+)?max(?:imum)?\s+salary(?:\s+per\s+year)?$/i, 'pay_max'],
  [/^(?:salary|pay|pay range|salary range|compensation|base pay)$/i, 'pay'],
  [/^(?:hours per week|weekly hours|hours)$/i, 'hours'],
  [/^(?:closing date|application deadline|apply by|close date)$/i, 'deadline'],
];

const MODE_WORDS = { onsite: 'On-site', 'on-site': 'On-site', 'in office': 'On-site', remote: 'Remote', hybrid: 'Hybrid', flexible: 'Hybrid' };
const KIND_WORDS = {
  'full time': 'Full-time', 'full-time': 'Full-time',
  'part time': 'Part-time', 'part-time': 'Part-time',
  intern: 'Internship', internship: 'Internship', 'co-op': 'Co-op', coop: 'Co-op',
};
// Deliberately absent: "Regular", which is what IBM writes. In an HR system
// that means permanent rather than temporary and says nothing about hours; a
// regular part-time job is an ordinary thing. Guessing Full-time from it
// would put a value in a column the posting never gave.

function labelledFields(text) {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const found = {};
  for (let i = 0; i < lines.length - 1; i += 1) {
    const hit = LABELS.find(([re]) => re.test(lines[i]));
    if (!hit) continue;
    const value = lines[i + 1];
    // The next line has to look like a value: short, and not another label.
    if (!value || value.length > 80 || LABELS.some(([re]) => re.test(value))) continue;
    if (!(hit[1] in found)) found[hit[1]] = value;
  }

  const out = {};

  // City, then whatever of state and country was also given.
  const place = found.place || [found.city, found.state, found.country].filter(Boolean).join(', ');
  if (place) out.location = { value: place, from: MED };

  const mode = MODE_WORDS[String(found.work_mode ?? '').toLowerCase()];
  if (mode) out.work_mode = { value: mode, from: MED };

  const kind = KIND_WORDS[String(found.kind ?? '').toLowerCase()];
  if (kind) out.category = { value: kind, from: MED };

  const hours = Number(String(found.hours ?? '').replace(/[^\d.]/g, ''));
  if (Number.isFinite(hours) && hours > 0 && hours <= 80) out.hours_per_week = { value: hours, from: MED };

  // A figure in a table has no currency symbol to find: IBM's says
  // "120,960.00" under "Projected Minimum Salary per year". The label is what
  // makes it a salary, so the number is taken as written and the trailing
  // pennies are dropped because nobody writes a wage that way.
  const tidy = (n) => String(n).replace(/\.00$/, '').trim();
  const money = /^[$\u00a3\u20ac]?\s?[\d,]+(?:\.\d+)?$/;
  if (found.pay_min && found.pay_max && money.test(found.pay_min) && money.test(found.pay_max)) {
    out.pay = { value: `${tidy(found.pay_min)} - ${tidy(found.pay_max)} per year`, from: MED };
  } else if (found.pay) {
    out.pay = { value: tidy(found.pay), from: MED };
  }

  const when = isoDate(found.deadline);
  if (when) out.deadline = { value: when, from: MED };

  return out;
}

function placeFromText(text) {
  const near = String(text ?? '').match(LOCATION_HEAD)?.[1];
  if (!near) return null;
  // A city and state beats a country: it is the more useful of the two and
  // the more likely to be what the heading was actually announcing.
  const city = near.match(CITY_STATE);
  if (city) return { value: city[1], from: MED };
  for (const [re, name] of COUNTRY) if (re.test(near)) return { value: name, from: MED };
  return null;
}

// Only when the posting says it. A term invented from today's date would be
// wrong for half the year.
function term(role, text, category) {
  const m = `${role} ${text.slice(0, 3000)}`.match(/\b(Summer|Fall|Autumn|Spring|Winter)\s+(20\d{2})\b/i);
  if (m) {
    const season = m[1].toLowerCase() === 'autumn' ? 'Fall' : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    return { value: `${season} ${m[2]}`, from: MED };
  }
  // A permanent full-time job has no season and is not meant to have one, so
  // the column stays empty on every posting that never says "Summer 2027".
  // Ongoing is what this tracker calls that, and the category has already
  // ruled out an internship by the time this runs.
  if (category === 'Full-time') return { value: 'Ongoing', from: LOW };
  return null;
}

// Hours a week, only where a posting states them. Part-time and campus jobs
// usually do and salaried ones never do, so nothing is inferred from silence.
function hoursFromText(text) {
  const m = String(text ?? '').match(/\b(\d{1,2})(?:\s*(?:\u2013|-|to)\s*(\d{1,2}))?\s*(?:hours?|hrs?)\s*(?:per|a|\/)\s*week\b/i);
  if (!m) return null;
  // A range gets its top end, because that is the commitment being asked for.
  const n = Number(m[2] ?? m[1]);
  return Number.isFinite(n) && n > 0 && n <= 80 ? { value: n, from: MED } : null;
}

const SOURCE = [
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)indeed\.(com|co\.uk|ca)$/, 'Indeed'],
  [/(^|\.)joinhandshake\.com$/, 'Handshake'],
  [/(^|\.)jobright\.ai$/, 'Jobright'],
  [/(^|\.)glassdoor\.(com|co\.uk)$/, 'Glassdoor'],
  [/(^|\.)ziprecruiter\.com$/, 'ZipRecruiter'],
  [/(^|\.)monster\.com$/, 'Monster'],
  [/(^|\.)wellfound\.com$/, 'Wellfound'],
  [/(^|\.)dice\.com$/, 'Dice'],
];

// The applicant tracking systems are the company's own careers page wearing
// somebody else's domain, so they are not a separate source.
const ATS = /greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|myworkdayjobs\.com|icims\.com|jobvite\.com|breezy\.hr|teamtailor\.com|recruitee\.com|bamboohr\.com|paylocity\.com|successfactors\.com|taleo\.net/i;

function source(pageUrl) {
  let host;
  try { host = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, ''); } catch { return null; }
  for (const [re, name] of SOURCE) if (re.test(host)) return { value: name, from: HIGH };
  if (ATS.test(host)) return { value: 'Company site', from: MED };
  if (/\.edu$/.test(host)) return { value: 'University portal', from: MED };
  return { value: 'Company site', from: LOW };
}

// The requirements, pulled out of the description by its own headings.
//
// Riskier than anything above, because it depends on prose. Returned as
// `derived` so the caller shows it for checking, and only when a heading
// actually matched: an empty field is better than the wrong paragraph.
// Headings, in order of how well they answer "what do they actually need".
// An explicit requirements heading beats a soft one, so the tiers are tried
// in turn rather than taking whichever appears first: Greenhouse has "Who you
// are" above "Minimum requirements", and the second is the one wanted.
const REQ_TIERS = [
  /\b(?:minimum|basic|required|preferred)\s+(?:requirements?|qualifications?)\b|^requirements?\b|^qualifications?\b|\b(?:required|technical)[^.]{0,30}\bexpertise\b|\byour expertise\b/i,
  /\bwhat you(?:'|\u2019)?ll need\b|\bwhat you need\b|\bwhat we(?:'|\u2019)?re looking for\b|\bwhat we look for\b|\bskills?\b[^.]{0,40}\byou(?:'|\u2019)?(?:ll)? need\b|\bskills?\b[^.]{0,40}\byou will need\b/i,
  /\bwho you are\b|\babout you\b|\byou(?:'|\u2019)?ll bring\b|\bskills? (?:and|&) experience\b|\bwhat you bring\b|\byou should have\b|\brequirements? for this role\b/i,
];

// Where the requirements stop. This list was doing less work than it looked
// like: the reader also stopped after four items, so a heading it did not
// know was never reached. Letting it read eight walked straight past "What's
// in it for you" and into the benefits, which is the honest state of it.
// Sentences that end a requirements list without being a heading, so
// isHeading never gets a chance to notice them.
const BOILERPLATE = /\b(?:is (?:also )?committed to|is proud to be|equal[- ]opportunity|we consider qualified applicants|reasonable accommodation|recruit(?:ment|ing) scams?|pride ourselves|applicable law)\b/i;

const STOP_HEAD = /\b(?:benefits?|perks?|what we offer|compensation|salary|about (?:us|the (?:company|team|role))|equal opportunit|how to apply|our (?:values|mission)|nice to have|bonus points|preferred qualifications?|preferred requirements?|what(?:'|\u2019)?s in it for you|what you(?:'|\u2019)?ll get|why join|interview process|next steps|to apply)\b|^preferred:?$/i;

// A heading, not a sentence that happens to contain the word.
//
// This is the difference between "Minimum requirements" and "We're looking
// for someone who meets the minimum requirements", which is what the first
// version of this pulled into the field. Headings are short, and they do not
// end in a full stop or a comma.
function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/[.,;]$/.test(t)) return false;
  // Twelve words or fewer once a trailing colon is dropped. Six was too mean:
  // "The skills you will need to be successful in the above:" is a heading by
  // any reading, and cutting it left the field empty on a real posting. The
  // line still has to match one of the tiers above, which is what keeps a
  // sentence from qualifying just by being short.
  return t.replace(/:$/, '').split(/\s+/).length <= 12;
}

// The requirements, taken from the description by its own headings.
//
// Riskier than anything above because it depends on prose, so it comes back
// as `derived` for the caller to show for checking, and only when a real
// heading matched. An empty field beats the wrong paragraph.
// Who is allowed to hold the job at all.
//
// The most consequential sentence in an IBM posting is "IBM will not be
// providing visa sponsorship for this position now or in the future", and it
// sits in a wall of boilerplate near the bottom with no heading of its own.
// For an international student that one line decides whether the rest of the
// posting is worth reading, so it goes at the top of the requirements where
// Jobright's equivalent tags already go.
//
// Only statements about eligibility are taken. A company saying it complies
// with fair employment practices regarding citizenship is not one.
const ELIGIBILITY = [
  /\b(?:will not|cannot|can not|does not|do not|are unable to|is unable to|not able to)\s+(?:be\s+)?(?:provid\w+|offer\w+|sponsor\w*)[^.]{0,80}?\b(?:visa|sponsorship)\b[^.]{0,60}\.?/i,
  /\bno visa sponsorship\b[^.]{0,60}\.?/i,
  /\bwithout\s+(?:the\s+)?need\s+for[^.]{0,60}\bsponsorship\b[^.]{0,40}\.?/i,
  /\bmust\s+(?:be\s+(?:legally\s+)?authori[sz]ed|have\s+(?:the\s+)?(?:legal\s+)?(?:right|authorisation|authorization))\s+to\s+work\b[^.]{0,60}\.?/i,
  /\bU\.?S\.?\s+citizen(?:ship)?\s+(?:is\s+)?(?:only|required)\b[^.]{0,40}\.?/i,
  /\bsecurity clearance\s+(?:is\s+)?required\b[^.]{0,40}\.?/i,
];

function eligibility(text) {
  const all = String(text ?? '');
  for (const re of ELIGIBILITY) {
    const hit = all.match(re);
    if (!hit) continue;
    // Back up to where the sentence began, or the line did. Matching on "will
    // not be providing visa sponsorship" without this left the sentence
    // headless: it is IBM that will not be providing it, and a requirement
    // that does not say who is barely a sentence.
    const from = Math.max(all.lastIndexOf('.', hit.index), all.lastIndexOf('\n', hit.index)) + 1;
    // One is enough: a posting that says it twice says the same thing twice,
    // as IBM's does.
    return clean(all.slice(from, hit.index + hit[0].length)).slice(0, 220);
  }
  return null;
}

function requirements(text) {
  const lines = text.split('\n');
  let start = -1;
  for (const tier of REQ_TIERS) {
    start = lines.findIndex((l) => isHeading(l) && tier.test(l.trim()));
    if (start !== -1) break;
  }
  if (start === -1) return null;
  const picked = [];
  let bulleted = null;
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (!t) continue;
    if (isHeading(t) && STOP_HEAD.test(t)) break;
    // Boilerplate has no heading above it and is not a requirement. Without
    // this the list walked out of IBM's expertise section and collected its
    // equal-opportunity statement and its warning about recruitment scams.
    if (BOILERPLATE.test(t)) break;
    // A requirements list is nearly always a list. Once one bullet has been
    // seen, the first line that is not a bullet is where the list ended, and
    // that is a better stopping point than counting to eight and hoping.
    const bullet = /^[-\u2022*]\s/.test(t);
    if (bulleted === null) bulleted = bullet;
    else if (bulleted && !bullet) break;
    picked.push(t.replace(/^[-\u2022*]\s*/, ''));
    if (picked.length >= 8) break;
  }
  const out = picked.filter((l) => l.length > 3).slice(0, 8);
  return out.length ? { value: out.join('\n'), from: MED } : null;
}

// The requirements, with the eligibility gate in front of them when the
// posting states one. In front because it is the line that decides whether
// the rest applies to you at all.
function asked(text) {
  const gate = eligibility(text);
  const rest = requirements(text);
  if (!gate) return rest;
  // The gate is often inside the list as well as ahead of it, because a
  // posting states it where it likes. Saying it once is enough.
  const lines = (rest?.value ?? '').split('\n').filter((l) => l && !gate.includes(l) && !l.includes(gate));
  return { value: [gate, ...lines].join('\n'), from: MED };
}


// Inner HTML of the first element whose opening tag matches, found by walking
// forward and counting nested opens and closes of the same tag.
//
// Regex alone cannot do this, because a description div is full of divs. This
// is the one place the page's own markup has to be read, so it is worth doing
// properly rather than with a greedy match that swallows the footer.
export function sliceElement(html, open) {
  const src = String(html);
  const m = open.exec(src);
  if (!m) return '';
  const tag = m[0].match(/^<\s*([a-z0-9]+)/i)?.[1];
  if (!tag) return '';
  const start = m.index + m[0].length;
  const re = new RegExp(`<\\s*(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = start;
  let depth = 1;
  let hit;
  while ((hit = re.exec(src))) {
    depth += hit[1] ? -1 : 1;
    if (depth === 0) return src.slice(start, hit.index);
  }
  return src.slice(start);
}

// A listing, not a posting.
//
// The sample that measured coverage included a company's open-positions index,
// which had no JobPosting and an h1 of "Current job openings at Databricks".
// Left alone, an extractor turns that into a row called "Current job openings"
// and the person has to notice and delete it. Better to refuse and say so.
// Phrases only an index uses. Deliberately not the bare word "careers": half
// the real postings on the web are titled "Some Role - Careers at Company",
// and matching that refused a genuine Airbnb posting. Refusing a real page is
// worse than accepting an index, because the person can delete a bad row but
// cannot make a refusal give them their job back.
const INDEX_TITLE = /\b(?:job openings?|current openings?|open positions?|all jobs|search jobs|browse jobs|job (?:search|board|listings?)|vacancies|opportunities at)\b/i;

export function looksLikeIndex(html) {
  const t = decode(meta(html, 'og:title') || (String(html).match(/<title[^>]*>([^<]*)/i)?.[1] ?? ''));
  const h1 = htmlToText(sliceElement(String(html), /<h1\b[^>]*>/i)).split('\n')[0] ?? '';
  // A posting names one job. An index names the act of looking for one, and
  // says so in both places.
  return INDEX_TITLE.test(t) || INDEX_TITLE.test(h1);
}

// Per-host readers, for pages with no JSON-LD.
//
// Keyed by the applicant tracking system rather than the employer, because one
// system serves thousands of employers and the markup is the system's. Whether
// a board publishes JobPosting at all turns out to be a per-employer setting:
// Greenhouse emits it for Stripe's board and not for Figma's, on the same
// domain, so the host cannot be used to predict it and every adapter has to
// work whether or not the structured data happened to be switched on.
const ADAPTERS = [
  {
    // Jobright, which ships the whole posting as JSON in a script tag. No
    // scraping needed, so this reads better than any of the others.
    //
    // The same blob also holds a good deal about the person looking at it:
    // how well they match, which of their skills scored what, and the names
    // of people they know at the company. None of that is the posting and
    // none of it goes in a row. Only the keys named below are read.
    //
    // The link kept is the employer's own posting rather than the Jobright
    // page, because that is where the application actually happens and it
    // outlives anyone's account here.
    host: /(^|\.)jobright\.ai$/,
    read(html) {
      const raw = html.match(/<script[^>]*id="jobright-helper-job-detail-info"[^>]*>([\s\S]*?)<\/script>/i);
      if (!raw) return {};
      let job;
      let firm;
      try {
        const parsed = JSON.parse(decode(raw[1]));
        job = parsed?.jobResult ?? {};
        firm = parsed?.companyResult ?? {};
      } catch { return {}; }

      const out = {};
      const say = (key, value, from = MED) => {
        const v = clean(String(value ?? ''));
        if (v) out[key] = { value: v, from };
      };

      say('role', job.jobTitle);
      say('company', firm.companyName);
      // Every location, not the first. This posting is open in four places
      // and saving only Jessup threw away three of them, one of which might
      // be the one the person actually wants.
      const where = Array.isArray(job.jobLocations) && job.jobLocations.length
        ? job.jobLocations.join(' / ')
        : job.jobLocation;
      say('location', where);
      say('pay', job.salaryDesc);
      say('job_link', job.originalUrl || job.applyLink);

      const MODE = { onsite: 'On-site', 'on-site': 'On-site', remote: 'Remote', hybrid: 'Hybrid' };
      say('work_mode', MODE[String(job.workModel ?? '').toLowerCase()]);

      const KIND = { internship: 'Internship', 'full-time': 'Full-time', 'part-time': 'Part-time' };
      say('category', KIND[String(job.employmentType ?? '').toLowerCase().replace(/\s+/g, '-')]);

      // What the candidate must have, which Jobright lists on its own. All of
      // them: this posting states fifteen and the first six stop short of
      // "expected degree conferral between October 2027 and September 2029",
      // which decides whether a student can apply at all.
      const skills = Array.isArray(job.skillSummaries) ? job.skillSummaries : [];

      // Eligibility that Jobright files under its own tags rather than with
      // the requirements, though that is plainly what they are. Only the ones
      // about who may hold the job are taken; the rest of that list is
      // Jobright's own labelling and none of the tracker's business.
      const ELIGIBILITY = /\b(?:h1b|h-1b|sponsor|visa|clearance|citizen|green card|work authori[sz]ation)\b/i;
      const gates = Array.isArray(job.recommendationTags)
        ? job.recommendationTags.filter((t) => ELIGIBILITY.test(String(t)))
        : [];

      const asked = [...gates, ...skills].map((x) => clean(String(x))).filter(Boolean);
      if (asked.length) {
        out.requirements = { value: asked.join('\n').slice(0, 3500), from: MED };
      }

      // Jobright writes this summary itself rather than quoting the employer,
      // so the employer's own posting is linked above and this is what the
      // person was actually reading when they saved it.
      const duties = Array.isArray(job.coreResponsibilities) ? job.coreResponsibilities : [];
      const body = [job.jobSummary, duties.length ? `Responsibilities\n${duties.map((d) => `- ${d}`).join('\n')}` : '']
        .filter(Boolean).join('\n\n');
      if (body.length > 200) out.job_description = { value: body, from: MED };

      return out;
    },
  },
  {
    // Handshake, which is where most US university students actually apply.
    //
    // Styled-components, so every class is a build hash. What is stable is
    // the shape: the role is the first of those hashed h1s, the employer is
    // the link to its own page, and the facts sit under an "At a glance"
    // heading in label-then-value order.
    //
    // Its "What they're looking for" section is deliberately left alone. That
    // is Handshake matching the posting against the student's own profile,
    // not anything the employer wrote, and it says things like "You do not
    // match any qualifications". None of that belongs in a row.
    host: /(^|\.)joinhandshake\.com$/,
    read(html) {
      const out = {};
      // The page's other h1s are the navigation title, which has a plain
      // class, and dialogs further down the document.
      const roleAt = html.search(/<h1[^>]*class="sc-[^"]*"[^>]*>/i);
      if (roleAt < 0) return {};
      const role = clean(htmlToText(sliceElement(html.slice(roleAt), /<h1[^>]*>/i)).split('\n')[0] ?? '');
      if (role) out.role = { value: role, from: MED };

      // The employer sits just above the title. Scoped to that, because every
      // job in the list on the left has one of these links too, and reading
      // the document's first one answered with a different company entirely.
      // Two links to the same employer sit immediately above the title, the
      // name and then the industry, within 500 characters of it. The first is
      // the name. The window is tight on purpose: every job in the list on
      // the left carries one of these links too, and reaching further back
      // answered with a different company entirely.
      const above = html.slice(Math.max(0, roleAt - 900), roleAt);
      const links = [...above.matchAll(/<a[^>]*href="\/e\/\d+"[^>]*>([\s\S]{0,200}?)<\/a>/gi)];
      const company = links.length ? clean(htmlToText(links[0][1]).split('\n')[0] ?? '') : '';
      if (company) out.company = { value: company, from: MED };

      const glanceAt = html.indexOf('At a glance');
      const lines = glanceAt < 0 ? [] : htmlToText(html.slice(glanceAt, glanceAt + 6000))
        .split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 14);

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (!out.pay && line.length < 60 && /(?:US)?[$\u00a3\u20ac]\s?[\d,]/.test(line)) {
          out.pay = { value: line, from: MED };
        }
        // "Hybrid or onsite, based in Chicago, IL" carries both, in that
        // order, so the place and the arrangement come off the one line.
        const based = line.match(/^(.*?),?\s*based in\s+(.+)$/i);
        if (based) {
          if (!out.location) out.location = { value: based[2], from: MED };
          const mode = based[1].trim().split(/\s+or\s+|\s*,\s*/)[0];
          if (!out.work_mode && /^(remote|hybrid|on-?site)$/i.test(mode)) {
            out.work_mode = { value: /^on/i.test(mode) ? 'On-site' : mode[0].toUpperCase() + mode.slice(1).toLowerCase(), from: MED };
          }
        }
        // Label on one line, value on the next.
        if (!out.category && /^job$/i.test(line) && lines[i + 1]) {
          const kind = lines[i + 1].replace(/\s*job$/i, '');
          if (/^(full-time|part-time|internship)$/i.test(kind)) {
            out.category = { value: kind[0].toUpperCase() + kind.slice(1).toLowerCase(), from: MED };
          }
        }
      }

      // "Posted 1 day ago ∙ Apply by October 25, 2026 at 12:59 AM"
      const by = html.slice(roleAt, roleAt + 4000).replace(/<[^>]+>/g, ' ')
        .match(/apply by\s+([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/i);
      if (by) {
        const when = new Date(`${by[1]} UTC`);
        if (!Number.isNaN(when.getTime())) out.deadline = { value: when.toISOString().slice(0, 10), from: MED };
      }

      // "Job Description" is an h3 and so is whatever follows it.
      const descAt = html.indexOf('Job Description');
      if (descAt >= 0) {
        const rest = html.slice(descAt);
        const next = rest.slice(60).search(/<h3\b/i);
        const body = htmlToText(next > 0 ? rest.slice(0, next + 60) : rest.slice(0, 30000))
          .replace(/^Job Description\s*/i, '')
          // The collapse toggle and the buttons sit inside the same block, so
          // the description otherwise ends "Less SaveApply".
          .replace(/(?:\n\s*(?:less|more|show (?:more|less)|save|apply|saveapply)\s*)+$/i, '')
          .trim();
        if (body.length > 200) out.job_description = { value: body, from: MED };
      }
      return out;
    },
  },
  {
    // Workday, which nearly every large employer's careers site runs on.
    //
    // Like Indeed it shows a list beside the posting you picked, and the two
    // use the same automation ids, so an unscoped lookup answers with the
    // first job in the list rather than the one on screen: the first attempt
    // at this returned Vancouver for a job in Pleasanton. Everything is read
    // inside the jobDetails pane for that reason.
    //
    // Each value is preceded by its own label as hidden text for screen
    // readers, so "locationsUSA, CA, Pleasanton" is one string and the label
    // has to come off the front.
    host: /(^|\.)myworkdayjobs\.com$/,
    read(html) {
      const out = {};
      const pane = sliceElement(html, /<[a-z]+[^>]*data-automation-id="jobDetails"[^>]*>/i) || html;
      const field = (id, label) => {
        const raw = htmlToText(sliceElement(pane, new RegExp(`<[a-z]+[^>]*data-automation-id="${id}"[^>]*>`, 'i')))
          .split('\n').join(' ').trim();
        return clean(label && raw.toLowerCase().startsWith(label) ? raw.slice(label.length) : raw);
      };

      const role = field('jobPostingHeader');
      if (role) out.role = { value: role, from: MED };

      // "Careers at Workday" on the tenant's own pages. Better than the
      // subdomain, which is a slug and gets capitalisation wrong.
      const site = decode(meta(html, 'og:title'));
      const company = clean(site.replace(/\b(?:careers?|jobs?)\s+at\s+/i, '').replace(SITE_NOISE, ''));
      if (company) out.company = { value: company, from: MED };

      const where = field('locations', 'locations');
      if (where) out.location = { value: where, from: MED };

      // Workday tenants write this themselves, so it is not always one of the
      // three the tracker offers: this one says "Flex". The posting's own
      // word is kept rather than translated into a guess about what it meant.
      const mode = field('remoteType', 'remote type');
      if (mode) out.work_mode = { value: /^on-?site$/i.test(mode) ? 'On-site' : mode, from: MED };

      const time = field('time', 'time type');
      const CATEGORY = { 'full time': 'Full-time', 'part time': 'Part-time', intern: 'Internship' };
      const mapped = CATEGORY[time.toLowerCase()] ?? (/^(full-time|part-time|internship)$/i.test(time) ? time : '');
      if (mapped) out.category = { value: mapped, from: MED };

      // "End Date: October 30, 2026 (30+ days left to apply)"
      const ends = field('timeLeftToApply', 'time left to apply')
        .match(/end date:\s*([A-Z][a-z]+\s+\d{1,2},\s*\d{4})/i);
      if (ends) {
        const when = new Date(`${ends[1]} UTC`);
        if (!Number.isNaN(when.getTime())) {
          out.deadline = { value: when.toISOString().slice(0, 10), from: MED };
        }
      }

      const body = htmlToText(sliceElement(pane, /<[a-z]+[^>]*data-automation-id="jobPostingDescription"[^>]*>/i));
      if (body.length > 200) out.job_description = { value: body, from: MED };
      return out;
    },
  },
  {
    // Indeed's search view is a list on the left and the posting you clicked
    // on the right, in the same document. The whole page therefore looks like
    // an index, which it is, and refusing it was right by the rule and wrong
    // for the person: they are looking at one posting and it is all there.
    //
    // Everything here is a data-testid. They are what Indeed's own tests hold
    // on to, which makes them the most stable thing on the page.
    host: /(^|\.)indeed\.com$/,
    read(html) {
      const out = {};
      // The element, walked to its own closing tag. A fixed window instead
      // cuts mid-tag, and half an opening tag reads as text: the first go at
      // this returned the rating element's style attribute as a line, and
      // lost the location that came after it.
      const region = (testid) => htmlToText(
        sliceElement(html, new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`, 'i')),
      ).split('\n').map((l) => l.trim()).filter(Boolean);

      const [role] = region('vj-job-title');
      if (role) out.role = { value: role, from: MED };

      // "DataAnnotation · 4.1 · Alexandria, VA • Remote". The rating and the
      // separators are dropped; what is left is the company, then where.
      const meta = region('company-info-metadata')
        .filter((l) => !/^[\u00b7\u2022|]$/.test(l) && !/^\d(?:\.\d)?$/.test(l));
      if (meta[0]) out.company = { value: meta[0], from: MED };
      for (const line of meta.slice(1)) {
        if (!out.work_mode && /^(remote|hybrid|on-?site)$/i.test(line)) {
          out.work_mode = { value: /^on/i.test(line) ? 'On-site' : line[0].toUpperCase() + line.slice(1).toLowerCase(), from: MED };
        } else if (!out.location && line.length < 80) {
          out.location = { value: line, from: MED };
        }
      }

      // The details panel is label then value, one per line: Pay, then the
      // figure; Job type, then one line for each type offered.
      const details = region('jobDetailsSection');
      for (let i = 0; i < details.length; i += 1) {
        if (/^pay$/i.test(details[i]) && details[i + 1]) {
          out.pay = { value: details[i + 1], from: MED };
        }
        // A posting can be several types at once, as this one is: part-time,
        // contract and full-time. The tracker holds one, so the first that it
        // recognises is taken, in the order the posting lists them. It is the
        // posting's own word either way, and the popup marks it for checking.
        if (!out.category && /^(full-time|part-time|internship)$/i.test(details[i])) {
          out.category = { value: details[i][0].toUpperCase() + details[i].slice(1).toLowerCase(), from: MED };
        }
      }

      const at = html.search(/data-testid="vj-job-description-heading"/i);
      if (at >= 0) {
        const rest = html.slice(html.lastIndexOf('<', at));
        const stop = rest.search(/data-testid="vj-report-job"/i);
        const body = htmlToText(rest.slice(0, stop > 0 ? stop : 40000))
          .replace(/^\s*Full job description\s*/i, '').trim();
        if (body.length > 200) out.job_description = { value: body, from: MED };
      }
      return out;
    },
  },
  {
    // LinkedIn, signed in. There is no JSON-LD on this view and no og: tags,
    // and every class name is a hash that changes between builds, so none of
    // the usual hooks exist. What is stable is the accessible labels, because
    // screen readers depend on them, plus the shape of the card itself.
    host: /(^|\.)linkedin\.com$/,
    read(html) {
      const out = {};
      const pick = (re) => clean(decode(String(html).match(re)?.[1] ?? ''));

      // The page title is "{Role} | {Company} | LinkedIn", which is the one
      // thing here that does not depend on anything having rendered. It is
      // read first because the alternatives are all below the fold.
      //
      // A LinkedIn tab can hold more than one <title>: the app swaps routes
      // without clearing the old one, so a job page can still carry "Feed |
      // LinkedIn" from wherever the person came from. Every title is read and
      // the first one shaped like a posting wins.
      let titled = ['', ''];
      for (const m of String(html).matchAll(/<title[^>]*>([^<]*)<\/title>/gi)) {
        const parts = decode(m[1]).split('|').map((x) => x.trim());
        if (parts.length === 3 && /^linkedin$/i.test(parts[2]) && parts[0] && parts[1]) {
          titled = [parts[0], parts[1]];
          break;
        }
      }

      // "Set alert for similar jobs as X" is the role by itself, with no
      // company attached, so it is preferred when it is there. It sits far
      // down the page and renders late, which is why it cannot be relied on.
      const role = pick(/aria-label="Set alert for similar jobs as ([^"]+)"/i) || titled[0];
      const company = pick(/aria-label="Company,\s*([^"]+?)\.?"/i) || titled[1];
      if (role) out.role = { value: role, from: MED };
      if (company) out.company = { value: company, from: MED };

      // The card, read as lines: company, role, "Location · posted ·
      // applicants", pay, workplace, term. Each is matched whole rather than
      // searched for, so a word inside a sentence cannot be mistaken for the
      // field, and only the top of the card is considered so the next job in
      // the sidebar is out of reach.
      let at = html.search(/aria-label="Company,/i);
      // Without that label, anchor on the first place the role is written on
      // the page, which is the top of the card either way.
      if (at < 0 && role) at = html.indexOf(role);
      const lines = at < 0 ? [] : htmlToText(html.slice(at, at + 12000))
        .split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 14);

      for (const line of lines) {
        if (!out.location && /\s\u00b7\s/.test(line) && /\b(ago|applicants?|reposted)\b/i.test(line)) {
          const where = line.split(/\s*\u00b7\s*/)[0];
          if (where && where.length < 80 && where !== company) out.location = { value: where, from: MED };
        }
        if (!out.work_mode && /^(remote|hybrid|on-?site)$/i.test(line)) {
          out.work_mode = { value: /^on/i.test(line) ? 'On-site' : line[0].toUpperCase() + line.slice(1).toLowerCase(), from: MED };
        }
        // LinkedIn's employment type is this tracker's category, not its
        // term: term here is the academic one, Fall 2026 and the like. Only
        // the types the tracker actually offers are taken; Contract and
        // Temporary have nowhere to go, and inventing a home for them is how
        // a field ends up holding something the person never chose.
        if (!out.category && /^(full-time|part-time|internship)$/i.test(line)) {
          out.category = { value: line[0].toUpperCase() + line.slice(1).toLowerCase(), from: MED };
        }
        if (!out.pay && line.length < 60 && /^[^a-z]*[$\u00a3\u20ac]\s?[\d,]/.test(line)) {
          out.pay = { value: line, from: MED };
        }
      }

      // The description sits between its own heading and the next one.
      const start = html.search(/<h2[^>]*>\s*About the job\s*<\/h2>/i);
      if (start >= 0) {
        const rest = html.slice(start);
        const next = rest.slice(60).search(/<h2\b/i);
        const body = htmlToText(next > 0 ? rest.slice(0, next + 60) : rest.slice(0, 40000))
          .replace(/^About the job\s*/i, '').trim();
        if (body.length > 200) out.job_description = { value: body, from: MED };
      }
      return out;
    },
  },
  {
    host: /(^|\.)greenhouse\.io$/,
    read(html) {
      const out = {};
      // "Job Application for Account Executive, Enterprise at Figma"
      const title = decode(String(html).match(/<title[^>]*>([^<]*)/i)?.[1] ?? '');
      const role = meta(html, 'og:title');
      if (role) out.role = { value: role, from: MED };
      const at = title.match(/\bat\s+(.+?)\s*$/i);
      if (at) out.company = { value: at[1], from: MED };
      // og:description is the location on Greenhouse, bullet separated when a
      // job is open in several places. The first is the one to offer.
      const where = meta(html, 'og:description');
      if (where && where.length < 120) {
        const one = where.split(/\s*[\u2022|]\s*/)[0];
        if (one) out.location = { value: one, from: MED };
      }
      const body = sliceElement(html, /<div[^>]*class="[^"]*job__description[^"]*"[^>]*>/i);
      if (body) out.job_description = { value: htmlToText(body), from: MED };
      return out;
    },
  },
];

// Everything else. Meta tags plus the largest plausible body container.
//
// og:title arrives dressed up on nearly every site: "Associate Legal Counsel,
// Japan - Careers at Airbnb", with og:site_name "Careers at Airbnb". Stripping
// the site name off the title is what leaves the role behind, and it beats
// splitting on punctuation and hoping.
// Pay written into the prose, for the sites that publish no field for it.
//
// Workday is the case in hand: it has an automation id for nearly everything
// and none for pay, which is sitting in the description as "Primary Location
// Base Pay Range: $149,700 USD - $224,500 USD".
//
// A figure alone is not enough. A posting says "manage a $5M budget" and
// "never pay a recruiting fee", so the line has to name what the money is
// before any of it is believed, and only the amount is taken from it.
const PAY_LABEL = /\b(?:base pay|pay range|pay rate|salary|salaries|compensation|hourly rate|per hour|an hour|per year|a year|per annum)\b/i;
const PAY_FIGURE = /[$\u00a3\u20ac]\s?[\d,]+(?:\.\d+)?(?:\s*[A-Z]{3})?(?:\s*(?:-|\u2013|\u2014|to)\s*[$\u00a3\u20ac]?\s?[\d,]+(?:\.\d+)?(?:\s*[A-Z]{3})?)?(?:\s*(?:per|\/)\s*(?:hour|hr|year|yr|annum|month|week)|\s*(?:an hour|a year))?/;

function payFromText(text) {
  // Windows around each label rather than whole lines, because a description
  // does not always have any: Workday's structured data is one unbroken line
  // of eleven thousand characters, and reading it line by line found nothing
  // at all.
  const all = String(text ?? '');
  const finder = new RegExp(PAY_LABEL.source, 'gi');
  for (const hit of all.matchAll(finder)) {
    const near = all.slice(hit.index, hit.index + 160);
    const found = near.match(PAY_FIGURE);
    // The first labelled figure wins. Workday states the primary location's
    // range and then the other locations' underneath, and the primary one is
    // the one the posting is for.
    if (found) return { value: clean(found[0]).slice(0, 100), from: MED };
  }
  return null;
}

const SITE_NOISE = /\b(careers?|jobs?|hiring|work with us|join us)\b/gi;

const BODY_SELECTORS = [
  /<div[^>]*class="[^"]*job__description[^"]*"[^>]*>/i,
  /<div[^>]*class="[^"]*(?:job-detail|job_detail|jobDescription|job-description)[^"]*"[^>]*>/i,
  /<div[^>]*id="[^"]*(?:job-description|jobDescription|content)[^"]*"[^>]*>/i,
  /<article\b[^>]*>/i,
  /<main\b[^>]*>/i,
];

function generic(html) {
  const out = {};
  const site = decode(meta(html, 'og:site_name'));
  const company = clean(site.replace(/\b(?:careers?|jobs?)\s+at\s+/i, '').replace(SITE_NOISE, ''));
  if (company) out.company = { value: company, from: LOW };

  const rawTitle = decode(meta(html, 'og:title')) || decode(String(html).match(/<title[^>]*>([^<]*)/i)?.[1] ?? '');
  let role = rawTitle;
  if (site) role = role.split(site).join(' ');
  if (company) role = role.split(company).join(' ');
  role = clean(role.replace(SITE_NOISE, '').replace(/^[\s\-\u2013\u2014|@\u00b7,]+|[\s\-\u2013\u2014|@\u00b7,]+$/g, ''));
  // h1 only when it agrees, or when the title gave nothing. On Ashby the
  // first h1 is "About Ramp", so it is corroboration and not a source.
  const h1 = clean(htmlToText(sliceElement(String(html), /<h1\b[^>]*>/i)).split('\n')[0] ?? '');
  if (!role && h1) role = h1;
  if (role) out.role = { value: role, from: h1 && h1 === role ? MED : LOW };

  let biggest = '';
  for (const sel of BODY_SELECTORS) {
    const body = htmlToText(sliceElement(html, sel));
    if (body.length > biggest.length) biggest = body;
    if (biggest.length > 1200) break;
  }
  if (biggest.length > 400) out.job_description = { value: biggest, from: LOW };
  return out;
}

// The host's own reader, when there is one and it found the posting.
//
// Run before the listing check, not after. Indeed shows the posting you
// clicked beside a list of the others, so the page is an index and also a
// posting, and the reader knowing where to look settles it.
function adapterFor(html, pageUrl) {
  let host = '';
  try { host = new URL(pageUrl).hostname.toLowerCase(); } catch { /* no url given */ }
  for (const a of ADAPTERS) {
    if (a.host.test(host)) {
      const got = a.read(html);
      // Anything the adapter read wins. The generic reader only fills gaps,
      // and only when the adapter could not name the role, because its idea
      // of a role on these sites is the whole page title.
      if (Object.keys(got).length) return got.role ? got : { ...generic(html), ...got };
    }
  }
  return null;
}

// The page you land on after pressing Apply.
//
// Worth recognising because forgetting to move a row from Wishlist to
// Applied is what makes a tracker stop reflecting reality, and this is the
// one moment the person is definitely looking at proof that they applied.
//
// Recognised from tight phrasings rather than loose ones. A posting says
// "we will review your application" and "thank you for your interest", and
// neither of those means anything has been submitted. The page also has to
// be short: a confirmation is a sentence and a button, while a posting that
// happens to contain one of these phrases is thousands of words.
const APPLIED = [
  /\bthank(?:s| you)[^.]{0,30}\bfor applying\b/i,
  /\byour application (?:has been |was )?(?:submitted|received|sent)\b/i,
  /\bapplication (?:submitted|received|complete|successful)\b/i,
  /\bwe(?:'|\u2019)?ve received your application\b/i,
  /\bwe have received your application\b/i,
  /\byou(?:'|\u2019)?ve (?:successfully )?applied\b/i,
  /\bsuccessfully (?:applied|submitted)\b/i,
];

export function looksApplied(html) {
  const text = htmlToText(String(html ?? ''));
  if (!APPLIED.some((re) => re.test(text))) return false;
  // A confirmation is short. Anything long enough to be a posting is one,
  // even when it contains the words, which is how "thank you for applying"
  // inside a job advert stops counting.
  return text.length < 2500;
}

// ------------------------------------------------------------------ public

/**
 * @param {string} html  the page, as rendered
 * @param {string} pageUrl  the address it was read from
 */
export function extractJob(html, pageUrl = '') {
  const posts = jobPostings(html);
  // More than one on a page means a listing; the one with a description is
  // the posting being looked at.
  const post = posts.find((p) => p.description) ?? posts[0] ?? null;
  const fields = {};
  const put = (key, value, from) => {
    const v = typeof value === 'string' ? clean(value) : value;
    if (v) fields[key] = { value: v, from };
  };

  const descHtml = post?.description ?? '';
  const text = htmlToText(descHtml);

  // The host's own reader runs whether or not there is JSON-LD. The two know
  // different things and treating them as alternatives threw work away:
  // Workday's structured data has no salary and calls its employment type
  // OTHER, while the page itself states the pay range and says Full Time.
  //
  // Three tiers, in this order. A property the structured data states
  // outright. Then a field the page labels for itself. Then anything worked
  // out from prose. That ordering decides the one case where the first two
  // disagree: this posting's structured data says TELECOMMUTE and the page
  // says Flex, and Flex wins, because TELECOMMUTE is schema.org's nearest
  // enum while Flex is what the employer wrote on the posting. Reading
  // TELECOMMUTE as Remote is an interpretation, so it sits in the last tier.
  const read = adapterFor(html, pageUrl);

  if (post) {
    put('role', post.title, HIGH);
    put('company', first(post.hiringOrganization)?.name ?? post.hiringOrganization, HIGH);
    put('location', place(post), HIGH);
    put('pay', salary(post), HIGH);
    put('job_link', real(post.url) || pageUrl, post.url ? HIGH : MED);
    if (post.validThrough) put('deadline', String(post.validThrough).slice(0, 10), HIGH);
    if (text) fields.job_description = { value: text, from: HIGH };
  } else if (!read && looksLikeIndex(html)) {
    // No JSON-LD and nobody who knows this site: a page listing many jobs is
    // refused rather than turned into a row called "Current openings".
    return { fields: {}, sure: {}, review: {}, structured: false, isIndex: true };
  }

  // Workday publishes its whole description as one unbroken line. The text is
  // the same either way, but without line breaks there are no headings to
  // find and no lines to read a pay range off, and it lands in the tracker as
  // a single wall of words. The page's own version has paragraphs.
  const flat = text && !text.includes('\n');
  if (flat && read?.job_description?.value.includes('\n')) {
    fields.job_description = read.job_description;
  }

  for (const [key, got] of Object.entries(read ?? (post ? {} : generic(html)))) {
    if (!fields[key]) fields[key] = got;
  }
  if (!fields.job_link) fields.job_link = { value: pageUrl, from: MED };

  const withRole = fields.role?.value ?? '';
  // Whichever description was kept, not whichever came from JSON-LD. The
  // flat one has no headings to find, so scanning it found no requirements
  // even after the readable version had been put in the field.
  const body = fields.job_description?.value || text || '';
  // Only this posting's own words. Falling back to the whole page reads the
  // sidebar, and on LinkedIn that is a column of other people's jobs: the
  // first real page tested came back "Hybrid" once and "On-site" the next
  // time for a posting that says Remote, because a neighbouring card said so.
  // A field guessed off somebody else's job is worse than an empty field.
  const haystack = `${withRole}\n${body}`;

  // Category is settled before term, because a permanent full-time job is
  // what makes the term Ongoing and an internship is what rules that out.
  const kind = fields.category ?? category(post ?? {}, withRole, haystack);

  // A table of labels and values beats anything worked out from prose, so it
  // is consulted first for every field it can answer.
  const table = body ? labelledFields(body) : {};

  for (const [key, got] of [
    ['location', table.location],
    ['work_mode', table.work_mode],
    ['category', table.category],
    ['pay', table.pay],
    ['hours_per_week', table.hours_per_week],
    ['deadline', table.deadline],
    ['category', kind],
    ['work_mode', workMode(post ?? {}, haystack)],
    ['term', term(withRole, haystack, kind?.value)],
    ['pay', body ? payFromText(body) : null],
    // Requirements as well as the description: "Work 40 hours/week minimum"
    // is a requirement, not a duty, and that is where a posting tends to put
    // the commitment it is asking for.
    ['hours_per_week', hoursFromText(`${body}\n${fields.requirements?.value ?? ''}`)],
    ['location', body ? placeFromText(body) : null],
    ['source', source(pageUrl)],
    ['requirements', body ? asked(body) : null],
  ]) {
    // An adapter that read the value off a labelled field beats a guess made
    // from prose, so a filled field is never overwritten here.
    if (got && !fields[key]) fields[key] = got;
  }

  return {
    fields,
    // What the caller shows without asking, and what it shows for checking.
    // Never save a guess silently: a wrong value in a field is worse than an
    // empty one, because an empty one is obvious.
    sure: Object.fromEntries(Object.entries(fields).filter(([, f]) => f.from === HIGH).map(([k, f]) => [k, f.value])),
    review: Object.fromEntries(Object.entries(fields).filter(([, f]) => f.from !== HIGH).map(([k, f]) => [k, f.value])),
    structured: Boolean(post),
    isIndex: false,
  };
}
