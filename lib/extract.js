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
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<li[^>]*>/gi, '\n- ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/li>/gi, '')
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
  if (/\bfully remote\b|\bremote[- ]first\b|\b100% remote\b/i.test(text)) return { value: 'Remote', from: MED };
  if (/\bon[- ]?site\b|\bin[- ]office\b/i.test(text)) return { value: 'On-site', from: MED };
  return null;
}

// Only when the posting says it. A term invented from today's date would be
// wrong for half the year.
function term(role, text) {
  const m = `${role} ${text.slice(0, 3000)}`.match(/\b(Summer|Fall|Autumn|Spring|Winter)\s+(20\d{2})\b/i);
  if (!m) return null;
  const season = m[1].toLowerCase() === 'autumn' ? 'Fall' : m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
  return { value: `${season} ${m[2]}`, from: MED };
}

const SOURCE = [
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)indeed\.(com|co\.uk|ca)$/, 'Indeed'],
  [/(^|\.)joinhandshake\.com$/, 'Handshake'],
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
  /\b(?:minimum|basic|required)\s+(?:requirements?|qualifications?)\b|^requirements?\b|^qualifications?\b/i,
  /\bwhat you(?:'|\u2019)?ll need\b|\bwhat you need\b|\bwhat we(?:'|\u2019)?re looking for\b|\bwhat we look for\b/i,
  /\bwho you are\b|\babout you\b|\byou(?:'|\u2019)?ll bring\b|\bskills? (?:and|&) experience\b/i,
];

const STOP_HEAD = /\b(?:benefits?|perks?|what we offer|compensation|salary|about (?:us|the (?:company|team|role))|equal opportunit|how to apply|our (?:values|mission)|nice to have|bonus points|preferred qualifications?|preferred requirements?)\b/i;

// A heading, not a sentence that happens to contain the word.
//
// This is the difference between "Minimum requirements" and "We're looking
// for someone who meets the minimum requirements", which is what the first
// version of this pulled into the field. Headings are short, and they do not
// end in a full stop or a comma.
function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (/[.,;]$/.test(t)) return false;
  // Six words or fewer once a trailing colon is dropped.
  return t.replace(/:$/, '').split(/\s+/).length <= 6;
}

// The requirements, taken from the description by its own headings.
//
// Riskier than anything above because it depends on prose, so it comes back
// as `derived` for the caller to show for checking, and only when a real
// heading matched. An empty field beats the wrong paragraph.
function requirements(text) {
  const lines = text.split('\n');
  let start = -1;
  for (const tier of REQ_TIERS) {
    start = lines.findIndex((l) => isHeading(l) && tier.test(l.trim()));
    if (start !== -1) break;
  }
  if (start === -1) return null;
  const picked = [];
  for (const line of lines.slice(start + 1)) {
    const t = line.trim();
    if (!t) continue;
    if (isHeading(t) && STOP_HEAD.test(t)) break;
    picked.push(t.replace(/^[-\u2022*]\s*/, ''));
    if (picked.length >= 4) break;
  }
  const out = picked.filter((l) => l.length > 3).slice(0, 4);
  return out.length ? { value: out.join('\n'), from: MED } : null;
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

  if (post) {
    put('role', post.title, HIGH);
    put('company', first(post.hiringOrganization)?.name ?? post.hiringOrganization, HIGH);
    put('location', place(post), HIGH);
    put('pay', salary(post), HIGH);
    put('job_link', real(post.url) || pageUrl, post.url ? HIGH : MED);
    if (post.validThrough) put('deadline', String(post.validThrough).slice(0, 10), HIGH);
    if (text) fields.job_description = { value: text, from: HIGH };
  } else {
    // No structured data. og:title is on nearly every page but arrives
    // dressed up: "Stripe Careers | Abuse Investigator", "Spotify - Android
    // Engineer", " Security Engineer, Cloud @ Ramp". The company is usually
    // the half that matches og:site_name, which is how to tell which is
    // which rather than always taking the longer one.
    const site = meta(html, 'og:site_name');
    const raw = meta(html, 'og:title') || (String(html).match(/<title[^>]*>([^<]*)/i)?.[1] ?? '');
    const parts = decode(raw).split(/\s+[|–—@·]\s+|\s+-\s+/).map(clean).filter(Boolean);
    let role = parts[0] ?? '';
    let company = site;
    if (parts.length > 1) {
      const known = site && parts.findIndex((p) => p.toLowerCase().includes(site.toLowerCase()));
      if (known > -1) {
        company = parts[known];
        role = parts[known === 0 ? 1 : 0];
      } else {
        // Careers pages put the company first far more often than last.
        [company, role] = [parts[0], parts.slice(1).join(' ')];
      }
    }
    put('role', role.replace(/\b(careers?|jobs?)\b/gi, '').replace(/\s{2,}/g, ' '), LOW);
    put('company', company, LOW);
    put('job_link', pageUrl, MED);
  }

  const withRole = fields.role?.value ?? '';
  const haystack = `${withRole}\n${text || htmlToText(html).slice(0, 6000)}`;

  for (const [key, got] of [
    ['category', category(post ?? {}, withRole, haystack)],
    ['work_mode', workMode(post ?? {}, haystack)],
    ['term', term(withRole, haystack)],
    ['source', source(pageUrl)],
    ['requirements', text ? requirements(text) : null],
  ]) {
    if (got) fields[key] = got;
  }

  const confident = Boolean(post);
  return {
    fields,
    // What the caller shows without asking, and what it shows for checking.
    // Never save a guess silently: a wrong value in a field is worse than an
    // empty one, because an empty one is obvious.
    sure: Object.fromEntries(Object.entries(fields).filter(([, f]) => f.from === HIGH).map(([k, f]) => [k, f.value])),
    review: Object.fromEntries(Object.entries(fields).filter(([, f]) => f.from !== HIGH).map(([k, f]) => [k, f.value])),
    structured: confident,
  };
}
