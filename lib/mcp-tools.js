import 'server-only';
import { z } from 'zod';
import { OPTIONS } from './fields';
import { todayISO } from './format';
import { computeStats } from './stats';

// Tools for one student's tracker. `store` is already scoped to that student
// (see storeFor); nothing here can reach anyone else's rows.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const opt = (list) => z.enum(list);

// Every editable column. Descriptions double as instructions to Claude.
const fields = {
  type: opt(OPTIONS.type).describe('Which sheet: On-Campus if the employer is the university itself, else Off-Campus'),
  role: z.string().min(1).max(300).describe('Job title'),
  company: z.string().max(300).describe('Company, or the university office/department for on-campus jobs'),
  category: opt(OPTIONS.category),
  status: opt(OPTIONS.status),
  priority: opt(OPTIONS.priority),
  deadline: date.describe('Application deadline'),
  date_applied: date,
  next_follow_up: date.describe('When to follow up next, or the interview date'),
  location: z.string().max(200).describe('"City, ST"'),
  work_mode: opt(OPTIONS.work_mode),
  pay: z.string().max(100).describe('As written in the posting, e.g. "$15/hr" or "$95k–$110k"'),
  hours_per_week: z.number().min(0).max(80),
  job_link: z.string().max(2000),
  source: opt(OPTIONS.source),
  contact: z.string().max(200),
  contact_email: z.string().max(320),
  referral: z.boolean(),
  cover_letter: z.boolean().describe('Whether a cover letter was sent'),
  resume_version: z.string().max(200),
  requirements: z.string().max(4000).describe('2–4 short lines summarizing must-have qualifications'),
  job_description: z.string().max(60000).describe('Full posting text, kept in case the listing disappears'),
  notes: z.string().max(4000),
};
const nullable = Object.fromEntries(
  Object.entries(fields).map(([k, v]) => [k, (k === 'type' || k === 'status' || k === 'role' ? v : v.nullable()).optional()]),
);

const COMPACT = ['id', 'type', 'role', 'company', 'status', 'category', 'date_applied', 'deadline', 'next_follow_up', 'source'];
const compact = (row) => Object.fromEntries(COMPACT.map((k) => [k, row[k] ?? null]));
const json = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 1) }] });
const fail = (message) => ({ content: [{ type: 'text', text: message }], isError: true });
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

export function registerTools(server, store, siteUrl) {
  const guard = (fn) => async (args) => {
    try { return await fn(args); } catch (e) { return fail(`Error: ${e.message}`); }
  };

  server.registerTool('list_applications', {
    title: 'List applications',
    description: 'List this student\'s job applications (compact rows). Filter by sheet, status, or a search term matched against role and company. Use before adding a job to check for duplicates, and to find the id of an application to update.',
    inputSchema: z.object({
      sheet: opt(OPTIONS.type).optional(),
      status: opt(OPTIONS.status).optional(),
      search: z.string().max(200).optional(),
    }),
    annotations: { readOnlyHint: true },
  }, guard(async ({ sheet, status, search }) => {
    const q = search?.trim().toLowerCase();
    const rows = (await store.listApplications()).filter((a) =>
      (!sheet || a.type === sheet) && (!status || a.status === status) &&
      (!q || `${a.role} ${a.company ?? ''}`.toLowerCase().includes(q)));
    return json({ count: rows.length, applications: rows.map(compact) });
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
    description: 'Add a job to the tracker. Only call this AFTER showing the student a summary and getting their confirmation. Leave out anything the posting doesn\'t say; never invent values. Status defaults to Applied, and date_applied to today unless the status is Wishlist. A status history entry is recorded automatically.',
    inputSchema: z.object({ ...nullable, type: fields.type, role: fields.role }),
  }, guard(async (args) => {
    const row = clean(args);
    // Anything past the wishlist was applied to; default the date to today.
    if (row.status !== 'Wishlist' && !row.date_applied) row.date_applied = todayISO();
    const saved = await store.createApplication(row);
    return json({ saved: compact(saved), view_at: siteUrl });
  }));

  server.registerTool('update_application', {
    title: 'Update an application',
    description: 'Change fields on an existing application (e.g. status, next_follow_up, pay). Pass only the fields to change; pass null to clear one. Status changes are added to the history automatically. Clear next_follow_up when an application is Accepted, Rejected or Withdrawn.',
    inputSchema: z.object({ id: z.string().uuid(), ...nullable }),
  }, guard(async ({ id, ...patch }) => {
    const changes = clean(patch);
    if (!Object.keys(changes).length) return fail('Nothing to update: pass at least one field.');
    const saved = await store.updateApplication(id, changes);
    return json({ updated: compact(saved) });
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
      sheet: z.enum(['All', ...OPTIONS.type]).optional(),
      days: z.number().int().min(1).max(3650).optional().describe('Only applications from the last N days'),
    }),
    annotations: { readOnlyHint: true },
  }, guard(async ({ sheet = 'All', days }) => {
    const [rows, events] = await Promise.all([store.listApplications(), store.listAllEvents()]);
    const { weekly, series, ...stats } = computeStats(rows, events, { sheet, days: days ?? null });
    return json({ ...stats, applications_per_week: weekly.map((w) => ({ week_of: w.label, count: w.parts.reduce((t, p) => t + p.value, 0) })) });
  }));
}
