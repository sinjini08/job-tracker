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

// The two sheets a student can keep, in the order they appear as tabs. These
// strings are what `applications.type` stores, and they never change: a
// student renaming a sheet changes a label, not the data underneath, so
// nothing has to be migrated and turning a sheet back on recovers nothing.
export const SHEET_KEYS = ['On-Campus', 'Off-Campus'];

// What to call a sheet on screen. The student's own name if they set one,
// otherwise the built-in.
export const sheetLabel = (key, names) => (names?.[key]?.trim() || key);

// Which sheets to show. Falls back to both, which is what every student had
// before the question existed and what someone gets if the profile has not
// loaded yet.
export function enabledSheets(list) {
  const kept = SHEET_KEYS.filter((k) => list?.includes(k));
  return kept.length ? kept : SHEET_KEYS;
}

// Role is what identifies a row, so it can't be hidden and the sheet always
// starts with it. Everything else is the student's choice.
export const ALWAYS_ON = new Set(['role']);

// A column a student added themselves. Its values live in the row's `custom`
// blob rather than in a column of their own, so `key` is the id and the grid
// reads through it.
export function customColumn(def) {
  return {
    id: def.id,
    key: def.id,
    custom: true,
    label: def.label,
    kind: def.kind === 'select' ? 'combo' : def.kind,
    options: def.kind === 'select' ? (def.options ?? []) : undefined,
    width: def.kind === 'bool' ? 90 : def.kind === 'number' ? 100 : 150,
    hint: `A column you added. ${def.kind === 'select'
      ? 'Pick from your list, or type something else.'
      : 'Yours to use however you like.'}`,
  };
}

// The columns to draw: the built-in ones for this sheet plus the student's
// own, minus anything they've hidden.
export function columnsFor(sheet, { custom = [], hidden = {} } = {}) {
  const off = new Set(hidden?.[sheet] ?? []);
  const mine = [...custom]
    .filter((c) => c.applies === 'both' || c.applies === sheet)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.label.localeCompare(b.label))
    .map(customColumn);
  return [...(SHEETS[sheet] ?? SHEETS['On-Campus']), ...mine]
    .filter((c) => ALWAYS_ON.has(c.id) || !off.has(c.id));
}

// Every column for a sheet, hidden or not, for the picker to list.
export function allColumnsFor(sheet, custom = []) {
  return columnsFor(sheet, { custom, hidden: {} });
}

// Columns the API accepts on write. Anything else in a request body is dropped.
export const WRITABLE = new Set([
  'type', 'role', 'company', 'term', 'category', 'status', 'priority', 'deadline', 'date_applied',
  'next_follow_up', 'location', 'work_mode', 'pay', 'hours_per_week', 'source', 'referral',
  'outreach_method', 'job_link', 'resume_version', 'cover_letter',
  // Details panel only.
  'contact', 'contact_email', 'contact_link', 'reached_out_on', 'requirements', 'job_description', 'notes',
  // The bag of values for the student's own columns.
  'custom',
]);

// A row counts as empty when none of these hold anything. Status, the sheet
// (type) and the two checkboxes always have a value, so they don't count.
const CONTENT = [...WRITABLE].filter((k) =>
  !['type', 'status', 'referral', 'cover_letter', 'custom'].includes(k));

const emptyValue = (v) => v == null || v === false || String(v).trim() === '';

export function isBlankRow(row) {
  const customs = Object.values(row.custom ?? {});
  return CONTENT.every((k) => emptyValue(row[k])) && customs.every(emptyValue);
}

export function pickWritable(body) {
  const out = {};
  for (const [k, v] of Object.entries(body ?? {})) {
    if (WRITABLE.has(k)) out[k] = v === '' ? null : v;
  }
  if ('role' in out && out.role == null) out.role = '';
  // `custom` is a bag, not a value: anything that isn't a plain object is
  // dropped rather than written.
  if ('custom' in out && (typeof out.custom !== 'object' || Array.isArray(out.custom))) {
    delete out.custom;
  }
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
