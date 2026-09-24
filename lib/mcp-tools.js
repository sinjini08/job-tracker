import 'server-only';
import { z } from 'zod';
import { BUILTIN_SHEETS, OPTIONS, OPTIONS_FOR, sheetLabel, snapToKnown } from './fields';
import { addDays, todayISO } from './format';
import { computeStats } from './stats';

// Tools for one student's tracker. `store` is already scoped to that student
// (see storeFor); nothing here can reach anyone else's rows.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const opt = (list) => z.enum(list);
// Most dropdowns take a value that isn't listed, so they're a string with the
// usual choices named in the description rather than an enum that would reject
// anything else. Priority is strict, because the sheet sorts by it.
const suggest = (list, extra = '') =>
  z.string().max(100).describe(`Usually one of: ${list.join(', ')}. Another value is allowed when the posting clearly calls for it.${extra ? ` ${extra}` : ''}`);

// Every editable column. Descriptions double as instructions to Claude.
const fields = {
  role: z.string().min(1).max(300).describe('Job title'),
  company: z.string().min(1).max(300).describe('Company, or the university office/department for on-campus jobs'),
  term: suggest(OPTIONS.term, 'The hiring season, e.g. "Summer 2027". Leave out when the posting doesn\'t say.'),
  category: suggest(OPTIONS.category),
  status: suggest(OPTIONS.status, 'Use "No reply" for an application that went silent, never "Ghosted".'),
  priority: opt(OPTIONS.priority),
  deadline: date.describe('Application deadline. Leave out for a rolling posting, and say so in the notes'),
  date_applied: date,
  next_follow_up: date.describe('Reminder to nudge them. Defaults to a week after date_applied'),
  location: z.string().max(200).describe('"City, ST" off campus; the campus or building on campus'),
  work_mode: suggest(OPTIONS.work_mode),
  pay: z.string().max(100).describe('As written in the posting, e.g. "$15/hr" or "$95k–$110k"'),
  hours_per_week: z.number().min(0).max(80).describe('Only when the posting states it'),
  job_link: z.string().max(2000).describe('URL of the posting'),
  source: suggest(OPTIONS.source, 'Where the student found the job.'),
  referral: z.boolean().describe('Whether someone referred the student'),
  outreach_method: suggest(OPTIONS.outreach_method, 'How the student contacted a person about this job.'),
  reached_out_on: date.describe('Date the student contacted them. Put what was said in a history note, not here'),
  contact: z.string().max(200).describe('Contact name'),
  contact_email: z.string().max(320),
  contact_link: z.string().max(2000).describe('LinkedIn profile (or other URL) for the contact, when there is no email'),
  cover_letter: z.boolean().describe('Whether a cover letter was sent'),
  resume_version: z.string().max(200),
  requirements: z.string().max(4000).describe('Two to four short lines of the must-have qualifications, taken from the posting. Fill this whenever you have the posting.'),
  job_description: z.string().max(60000).describe('The posting text, verbatim. Fill this whenever you have it: the listing will not exist in three months and this is the only copy the student keeps.'),
  notes: z.string().max(4000),
};
const FOLLOW_UP_DAYS = 7;
const nullable = Object.fromEntries(
  Object.entries(fields).map(([k, v]) => [k, (k === 'status' || k === 'role' || k === 'company' ? v : v.nullable()).optional()]),
);

const COMPACT = ['id', 'type', 'role', 'company', 'term', 'status', 'category', 'date_applied', 'deadline', 'next_follow_up', 'source'];
const compact = (row) => Object.fromEntries(COMPACT.map((k) => [k, row[k] ?? null]));
const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 1) }] });
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
// Drop the fields that weren't passed, and snap a dropdown value that only
// differs from a listed one by case or spacing, so "linkedin" and "LinkedIn"
// stay one value in the charts.
// `type` is left alone: it is translated from a sheet name to its stored key
// before it gets here, and snapping it against a fixed list would undo that.
const clean = (obj) => Object.fromEntries(Object.entries(obj)
  .filter(([, v]) => v !== undefined)
  .map(([k, v]) => [k, k !== 'type' && OPTIONS_FOR[k] && v != null
    ? snapToKnown(v, OPTIONS[OPTIONS_FOR[k]]) : v]));

// Given to the assistant when it connects. The tools say what can be done;
// this says how the student wants it done — which matters here because the
// tracker is meant to keep up with a conversation that is mostly about
// something else.
export const INSTRUCTIONS = `This is one student's job application tracker.

They will usually be doing something else in the same conversation: rewriting a
bullet on their CV, preparing for an interview, working out whether a posting is
worth their time. Keeping the tracker current is a side job. Do it as you go and
then get back to what they were actually asking about.

- When they paste a posting and say they are applying, or mention in passing
  that they applied, add it. Summarise what you are about to save in a line or
  two, get a yes, then save it.
- A row needs a job title and an employer. If the posting does not name the
  employer, ask for it in one short question. A row missing either scores
  nothing, and the student is never told why.
- Ask for nothing else. Every other field is optional, and a blank is better
  than a guess. Leave out whatever the posting does not say.
- The posting itself is the exception to that. Whenever you have its text,
  because they pasted it or because you could read the link, save it: the text
  in job_description, and two to four lines of the must-have qualifications in
  requirements. Neither is a guess, both are in front of you, and in three
  months the listing will be gone and the student will have nothing to check
  an interview against. Save them without asking and without quoting them
  back; a row they can reread later is the point, not a longer reply. If they
  paste a posting for a job already in the tracker, update that row with it.
- Get date_applied right, and work it out from today's date rather than
  guessing. It is the day they actually applied, which is not always today:
  "last Tuesday" or "a couple of weeks ago" is a real date you can calculate.
  It also decides whether the application scores, because anything dated
  before the day they first signed in is recorded but earns nothing in their
  league. If they are logging a backlog, say so plainly once rather than
  letting them wonder why the leaderboard did not move.
- When they mention progress — a recruiter replied, a screen is booked, they
  were turned down — update the status and record it. Confirm first, briefly.
- Check for a duplicate before adding. The same job logged twice scores once.
- Report what you changed in one line. Do not turn the reply into a status
  report, and do not read the tracker back to them unless they ask.`;

// The sheets one student keeps, as the assistant should see them.
//
// A sheet is a string in applications.type, and since 019 that can be a key
// the student generated for a sheet of their own — 's_4f2a91c0be33', which
// means nothing to an assistant and nothing to the student either. So the
// tools speak in the names on the tabs and this translates, which also keeps
// the connector honest when somebody renames a sheet.
const DEFAULT_SHEETS = BUILTIN_SHEETS.map((key) => ({ key, name: sheetLabel(key, null) }));

function sheetVocab(sheets) {
  const list = (Array.isArray(sheets) && sheets.length ? sheets : DEFAULT_SHEETS)
    .filter((s) => s?.key && s?.name);
  const names = list.map((s) => s.name);
  const toKey = (name) => list.find((s) => s.name === name)?.key ?? list[0].key;
  const toName = (key) => list.find((s) => s.key === key)?.name ?? key;
  // z.enum needs a non-empty tuple, and a student always has at least one sheet.
  const field = z.enum(names);
  const describe = names.length > 1
    ? `Which of the student's sheets this belongs on. One of: ${names.join(', ')}.`
    : `The student keeps one sheet, ${names[0]}, so this is always "${names[0]}".`;
  return { names, toKey, toName, field: field.describe(describe) };
}

export function registerTools(server, store, siteUrl, sheets) {
  const sheet = sheetVocab(sheets);
  // Rows go out with the name on the tab rather than the stored key.
  const outward = (row) => ({ ...compact(row), type: sheet.toName(row.type) });

  const guard = (fn) => async (args) => {
    try { return await fn(args); } catch (e) { return fail(`Error: ${e.message}`); }
  };

  server.registerTool('list_applications', {
    title: 'List applications',
    description: 'List this student\'s job applications (compact rows). Filter by sheet, status, or a search term matched against role and company. Use before adding a job to check for duplicates, and to find the id of an application to update.',
    inputSchema: z.object({
      sheet: sheet.field.optional(),
      status: fields.status.optional(),
      search: z.string().max(200).optional(),
    }),
    annotations: { readOnlyHint: true },
  }, guard(async ({ sheet: named, status, search }) => {
    const q = search?.trim().toLowerCase();
    const want = named ? sheet.toKey(named) : null;
    const rows = (await store.listApplications()).filter((a) =>
      (!want || a.type === want) && (!status || a.status === status) &&
      (!q || `${a.role} ${a.company ?? ''}`.toLowerCase().includes(q)));
    return json({ count: rows.length, applications: rows.map(outward) });
  }));

  server.registerTool('get_application', {
    title: 'Get one application',
    description: 'Full details of one application, including its history (status changes, interviews, notes).',
    inputSchema: z.object({ id: z.string().uuid() }),
    annotations: { readOnlyHint: true },
  }, guard(async ({ id }) => {
    const [application, history] = await Promise.all([store.getApplication(id), store.listEvents(id)]);
    return json({ application, history });
  }));

  server.registerTool('add_application', {
    title: 'Add an application',
    description: 'Add a job to the tracker. Only call this AFTER showing the student a summary and getting their confirmation. A role and a company are required: ask the student for the employer if the posting does not name one, because a row missing either earns no points and nothing will say why. Leave out anything else the posting doesn\'t say; never invent values. Status defaults to Applied, date_applied to today unless the status is Wishlist, and next_follow_up to a week after that. A status history entry is recorded automatically.',
    inputSchema: z.object({ ...nullable, type: sheet.field, role: fields.role, company: fields.company }),
  }, guard(async (args) => {
    const row = clean({ ...args, type: sheet.toKey(args.type) });
    // Anything past the wishlist was applied to; default the date to today,
    // and set the same week-out reminder the website uses.
    if (row.status !== 'Wishlist' && !row.date_applied) row.date_applied = todayISO();
    if (row.date_applied && !row.next_follow_up) row.next_follow_up = addDays(row.date_applied, FOLLOW_UP_DAYS);
    const saved = await store.createApplication(row);
    return json({ saved: outward(saved), view_at: siteUrl });
  }));

  server.registerTool('update_application', {
    title: 'Update an application',
    description: 'Change fields on an existing application (e.g. status, next_follow_up, pay). Pass only the fields to change; pass null to clear one. Status changes are added to the history automatically. Clear next_follow_up when an application is Accepted, Rejected, Withdrawn or No reply.',
    inputSchema: z.object({ id: z.string().uuid(), type: sheet.field.optional(), ...nullable }),
  }, guard(async ({ id, ...patch }) => {
    const changes = clean(patch.type ? { ...patch, type: sheet.toKey(patch.type) } : patch);
    if (!Object.keys(changes).length) return fail('Nothing to update: pass at least one field.');
    const saved = await store.updateApplication(id, changes);
    return json({ updated: outward(saved) });
  }));

  server.registerTool('add_history_note', {
    title: 'Add to an application\'s history',
    description: 'Record something that a status change alone doesn\'t capture: an interview (date, time, format, interviewer), an offer (pay, deadline to respond, start date), a follow-up sent, or a note. Don\'t use this for status changes; those are logged automatically.',
    inputSchema: z.object({
      id: z.string().uuid().describe('Application id'),
      kind: z.enum(['note', 'interview', 'follow_up', 'offer']),
      detail: z.string().min(1).max(2000),
      event_date: date.optional().describe('Defaults to today'),
    }),
  }, guard(async ({ id, kind, detail, event_date }) => {
    const ev = await store.addEvent(clean({ application_id: id, kind, detail, event_date }));
    return json({ added: { kind: ev.kind, event_date: ev.event_date, detail: ev.detail } });
  }));

  server.registerTool('delete_application', {
    title: 'Delete an application',
    description: 'Permanently delete an application and its history. Only after the student explicitly confirms which one.',
    inputSchema: z.object({ id: z.string().uuid() }),
    annotations: { destructiveHint: true },
  }, guard(async ({ id }) => {
    await store.deleteApplication(id);
    return json({ deleted: id });
  }));

  server.registerTool('get_stats', {
    title: 'Application stats',
    description: 'The numbers behind the website\'s Charts tab: totals, response rate, how many applications reached each stage (from history), and breakdowns by status, source and category. Use it for questions like "what\'s my interview rate?"',
    inputSchema: z.object({
      sheet: z.enum(['All', ...sheet.names]).optional(),
      days: z.number().int().min(1).max(3650).optional().describe('Only applications from the last N days'),
    }),
    annotations: { readOnlyHint: true },
  }, guard(async ({ sheet: named = 'All', days }) => {
    const [rows, events] = await Promise.all([store.listApplications(), store.listAllEvents()]);
    // Named only to keep them out of ...stats, which is what the connector
    // sends: the daily series is large and the caller never asked for it.
    const { weekly, series: _series, byDay: _byDay, ...stats } = computeStats(rows, events, {
      sheet: named === 'All' ? 'All' : sheet.toKey(named),
      sheets: sheet.names.map(sheet.toKey),
      days: days ?? null,
    });
    return json({ ...stats, applications_per_week: weekly.map((w) => ({ week_of: w.label, count: w.parts.reduce((t, p) => t + p.value, 0) })) });
  }));
}
