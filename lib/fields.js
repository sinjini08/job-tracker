// Single source of truth for the sheet's columns. The option lists must match
// the CHECK constraints in supabase/schema.sql.

export const OPTIONS = {
  type: ['On-Campus', 'Off-Campus'],
  category: ['Internship', 'Part-time', 'Full-time', 'Co-op', 'Research / TA / LA', 'Work-Study'],
  status: ['Wishlist', 'Applied', 'OA / Assessment', 'Interviewing', 'Offer', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted'],
  priority: ['High', 'Medium', 'Low'],
  work_mode: ['On-site', 'Hybrid', 'Remote'],
  source: ['Handshake', 'Workday (PSU)', 'LinkedIn', 'Company Site', 'Referral', 'Career Fair', 'Other'],
};

// kind: text | select | date | number | bool | url | email | computed
const F = {
  role:           { label: 'Role',          kind: 'text',   width: 220 },
  company_on:     { key: 'company', label: 'Office / Dept', kind: 'text', width: 180 },
  company_off:    { key: 'company', label: 'Company',       kind: 'text', width: 180 },
  category:       { label: 'Category',      kind: 'select', width: 130 },
  status:         { label: 'Status',        kind: 'select', width: 140 },
  priority:       { label: 'Priority',      kind: 'select', width: 90 },
  deadline:       { label: 'Deadline',      kind: 'date',   width: 118 },
  date_applied:   { label: 'Applied',       kind: 'date',   width: 118 },
  days:           { label: 'Days',          kind: 'computed', width: 60 },
  next_follow_up: { label: 'Follow-up',     kind: 'date',   width: 118 },
  location:       { label: 'Location',      kind: 'text',   width: 150 },
  work_mode:      { label: 'Mode',          kind: 'select', width: 95 },
  pay:            { label: 'Pay',           kind: 'text',   width: 110 },
  hours_per_week: { label: 'Hrs/Wk',        kind: 'number', width: 70 },
  source:         { label: 'Source',        kind: 'select', width: 130 },
  referral:       { label: 'Referral',      kind: 'bool',   width: 72 },
  job_link:       { label: 'Link',          kind: 'url',    width: 150 },
  contact:        { label: 'Contact',       kind: 'text',   width: 140 },
  contact_email:  { label: 'Contact Email', kind: 'email',  width: 180 },
  contact_link:   { label: 'LinkedIn / Link', kind: 'url',   width: 170 },
  resume_version: { label: 'Resume',        kind: 'text',   width: 120 },
  cover_letter:   { label: 'Cover Ltr',     kind: 'bool',   width: 76 },
  notes:          { label: 'Notes',         kind: 'text',   width: 260 },
};

const col = (id) => ({ key: id, ...F[id], id });

export const SHEETS = {
  'On-Campus': [
    'role', 'company_on', 'category', 'status', 'priority', 'deadline', 'date_applied', 'days',
    'next_follow_up', 'pay', 'hours_per_week', 'source', 'job_link', 'contact', 'contact_email',
    'contact_link', 'resume_version', 'cover_letter', 'notes',
  ].map(col),
  'Off-Campus': [
    'role', 'company_off', 'category', 'status', 'priority', 'deadline', 'date_applied', 'days',
    'next_follow_up', 'location', 'work_mode', 'pay', 'source', 'referral', 'job_link', 'contact',
    'contact_email', 'contact_link', 'resume_version', 'cover_letter', 'notes',
  ].map(col),
};

// Columns the API accepts on write. Anything else in a request body is dropped.
export const WRITABLE = new Set([
  'type', 'role', 'company', 'category', 'status', 'priority', 'deadline', 'date_applied',
  'next_follow_up', 'location', 'work_mode', 'pay', 'hours_per_week', 'job_link', 'source',
  'contact', 'contact_email', 'contact_link', 'referral', 'cover_letter', 'resume_version', 'requirements',
  'job_description', 'notes',
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
  return out;
}

export function columnLetter(i) {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
