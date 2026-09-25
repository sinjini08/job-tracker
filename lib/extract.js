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
      .replace(/<(script|style|svg|noscript)[^>]*>[\s\S]*?<\/\1>/gi, '')
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
    // LinkedIn, signed in. There is no JSON-LD on this view and no og: tags,
    // and every class name is a hash that changes between builds, so none of
    // the usual hooks exist. What is stable is the accessible labels, because
    // screen readers depend on them, plus the shape of the card itself.
    host: /(^|\.)linkedin\.com$/,
    read(html) {
      const out = {};
      const pick = (re) => clean(decode(String(html).match(re)?.[1] ?? ''));

      // "Set alert for similar jobs as Outbound Sales Representative" carries
      // the role on its own, without the company and the " | LinkedIn" that
      // the page title drags along.
      const role = pick(/aria-label="Set alert for similar jobs as ([^"]+)"/i);
      const company = pick(/aria-label="Company,\s*([^"]+?)\.?"/i);
      if (role) out.role = { value: role, from: MED };
      if (company) out.company = { value: company, from: MED };

      // The card, read as lines: company, role, "Location · posted ·
      // applicants", pay, workplace, term. Each is matched whole rather than
      // searched for, so a word inside a sentence cannot be mistaken for the
      // field, and only the top of the card is considered so the next job in
      // the sidebar is out of reach.
      const at = html.search(/aria-label="Company,/i);
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
        if (!out.term && /^(full-time|part-time|contract|internship|temporary|volunteer)$/i.test(line)) {
          out.term = { value: line[0].toUpperCase() + line.slice(1).toLowerCase(), from: MED };
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

function fromPage(html, pageUrl) {
  let host = '';
  try { host = new URL(pageUrl).hostname.toLowerCase(); } catch { /* no url given */ }
  for (const a of ADAPTERS) {
    if (a.host.test(host)) {
      const got = a.read(html);
      if (got.role) return got;
    }
  }
  return generic(html);
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
    // No JSON-LD. Either the system never publishes it, or the employer has
    // it switched off, which is a real per-employer setting rather than a
    // property of the domain.
    if (looksLikeIndex(html)) {
      return { fields: {}, sure: {}, review: {}, structured: false, isIndex: true };
    }
    for (const [key, got] of Object.entries(fromPage(html, pageUrl))) fields[key] = got;
    if (!fields.job_link) fields.job_link = { value: pageUrl, from: MED };
  }

  const withRole = fields.role?.value ?? '';
  const body = text || fields.job_description?.value || '';
  // Only this posting's own words. Falling back to the whole page reads the
  // sidebar, and on LinkedIn that is a column of other people's jobs: the
  // first real page tested came back "Hybrid" once and "On-site" the next
  // time for a posting that says Remote, because a neighbouring card said so.
  // A field guessed off somebody else's job is worse than an empty field.
  const haystack = `${withRole}\n${body}`;

  for (const [key, got] of [
    ['category', category(post ?? {}, withRole, haystack)],
    ['work_mode', workMode(post ?? {}, haystack)],
    ['term', term(withRole, haystack)],
    ['source', source(pageUrl)],
    ['requirements', body ? requirements(body) : null],
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
