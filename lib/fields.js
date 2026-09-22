// Single source of truth for the sheet's columns.
//
// Most dropdowns are suggestions rather than rules: the database no longer
// constrains them (migration 007), so a student can type a value that isn't
// listed. Priority is the exception and stays strict, because the sheet sorts
// by it. Typed values snap to a listed spelling when they only differ by case
// or spacing (see snapToKnown), so the charts don't split into near-duplicates.

export const OPTIONS = {
  type: ['On-Campus', 'Off-Campus'],
  term: ['Summer 2027', 'Fall 2026', 'Spring 2027', 'Ongoing'],
  category: ['Internship', 'Part-time', 'Full-time', 'Co-op', 'Research / TA / LA', 'Work-Study'],
  status: ['Wishlist', 'Applied', 'Screening', 'OA / Assessment', 'Interviewing', 'Final round',
    'Offer', 'Accepted', 'Rejected', 'Withdrawn', 'No reply'],
  priority: ['High', 'Medium', 'Low'],
  work_mode: ['On-site', 'Hybrid', 'Remote'],
  source: ['Handshake', 'University portal', 'LinkedIn', 'Indeed', 'Company site', 'Referral', 'Career fair'],
  outreach_method: ['LinkedIn', 'Email', 'In person', 'Career fair'],
};

// Which option list a combo/select column offers.
export const OPTIONS_FOR = {
  type: 'type', term: 'term', category: 'category', status: 'status', priority: 'priority',
  work_mode: 'work_mode', source: 'source', outreach_method: 'outreach_method',
};

// A typed value that matches a listed one apart from case or spacing becomes
// the listed one, so "linkedin" doesn't become a second bar beside "LinkedIn".
export function snapToKnown(value, list) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
  return (list ?? []).find((k) => norm(k) === norm(v)) ?? v;
}

// kind: text | select (listed values only) | combo (listed values + free text)
//       | date | number | bool | url | email | computed
const F = {
  role:            { label: 'Role', kind: 'text', width: 220,
    hint: 'The job title, as the posting writes it.' },
  company_on:      { key: 'company', label: 'Office / Dept', kind: 'text', width: 180,
    hint: 'The department, lab or office hiring you.' },
  company_off:     { key: 'company', label: 'Company', kind: 'text', width: 180,
    hint: 'The employer.' },
  term:            { label: 'Term', kind: 'combo', width: 118,
    hint: 'Which hiring season this is for, e.g. Summer 2027. Blank when the posting doesn’t say.' },
  category:        { label: 'Category', kind: 'combo', width: 140,
    hint: 'What kind of role it is. Pick one or type your own.' },
  status:          { label: 'Status', kind: 'combo', width: 140,
    hint: 'Where this application stands. Every change is saved to the row’s history.' },
  priority:        { label: 'Priority', kind: 'select', width: 90,
    hint: 'How much you want this one. The sheet can sort by it.' },
  deadline:        { label: 'Deadline', kind: 'date', width: 118,
    hint: 'When applications close. Turns red within 3 days while you still haven’t applied. Leave it blank if the posting has no closing date.' },
  date_applied:    { label: 'Date applied', kind: 'date', width: 118,
    hint: 'The day you submitted it.' },
  days:            { label: 'Days since applied', kind: 'computed', width: 132,
    hint: 'How long you’ve been waiting, counted from Date applied. Stops once the application is closed.' },
  next_follow_up:  { label: 'Follow up by', kind: 'date', width: 118,
    hint: 'Your reminder to nudge them. It starts a week after you apply, and turns red when it is due.' },
  location_on:     { key: 'location', label: 'Campus / Building', kind: 'text', width: 165,
    hint: 'Which campus or building the job is in.' },
  location_off:    { key: 'location', label: 'Location', kind: 'text', width: 150,
    hint: 'Where the role is based, e.g. "Malvern, PA".' },
  work_mode:       { label: 'Work mode', kind: 'combo', width: 110,
    hint: 'On-site, hybrid or remote.' },
  pay:             { label: 'Pay', kind: 'text', width: 110,
    hint: 'As the posting states it, e.g. "$15/hr" or "$95k to $110k".' },
  hours_per_week:  { label: 'Hours/week', kind: 'number', width: 100,
    hint: 'Expected hours per week. Blank when the posting doesn’t say.' },
  source:          { label: 'Source', kind: 'combo', width: 150,
    hint: 'Where you found the job. This is what the “By source” chart counts.' },
  referral:        { label: 'Referral', kind: 'bool', width: 78,
    hint: 'Tick when someone referred you.' },
  outreach_method: { label: 'Reached out', kind: 'combo', width: 124,
    hint: 'How you contacted a person about it. The date and what you said live in the row’s details.' },
  job_link:        { label: 'Posting URL', kind: 'url', width: 150,
    hint: 'Link to the posting. The full text is kept in the row’s details, in case the listing disappears.' },
  resume_version:  { label: 'Resume', kind: 'text', width: 120,
    hint: 'Which resume you sent, e.g. "Resume v3".' },
  cover_letter:    { label: 'Cover letter', kind: 'bool', width: 100,
    hint: 'Tick when you sent one.' },
};

const col = (id) => ({ key: id, ...F[id], id, options: OPTIONS[OPTIONS_FOR[F[id].key ?? id]] });

const ORDER = (company, location) => [
  'role', company, 'term', 'category', 'status', 'priority', 'deadline', 'date_applied', 'days',
  'next_follow_up', location, 'work_mode', 'pay', 'hours_per_week', 'source', 'referral',
  'outreach_method', 'job_link', 'resume_version', 'cover_letter',
].map(col);

export const SHEETS = {
  'On-Campus': ORDER('company_on', 'location_on'),
  'Off-Campus': ORDER('company_off', 'location_off'),
};

// Columns the API accepts on write. Anything else in a request body is dropped.
export const WRITABLE = new Set([
  'type', 'role', 'company', 'term', 'category', 'status', 'priority', 'deadline', 'date_applied',
  'next_follow_up', 'location', 'work_mode', 'pay', 'hours_per_week', 'source', 'referral',
  'outreach_method', 'job_link', 'resume_version', 'cover_letter',
  // Details panel only.
  'contact', 'contact_email', 'contact_link', 'reached_out_on', 'requirements', 'job_description', 'notes',
]);

// A row counts as empty when none of these hold anything. Status, the sheet
// (type) and the two checkboxes always have a value, so they don't count.
const CONTENT = [...WRITABLE].filter((k) => !['type', 'status', 'referral', 'cover_letter'].includes(k));

export function isBlankRow(row) {
  return CONTENT.every((k) => row[k] == null || String(row[k]).trim() === '');
}

export function pickWritable(body) {
  const out = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (WRITABLE.has(k)) out[k] = v === '' ? null : v;
  }
  if ('role' in out && out.role == null) out.role = '';
  // Keep dropdown spellings consistent no matter where the value came from.
  for (const [k, list] of Object.entries(OPTIONS_FOR)) {
    if (out[k] != null) out[k] = snapToKnown(out[k], OPTIONS[list]);
  }
  return out;
}

export function columnLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
