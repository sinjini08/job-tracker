import 'server-only';

// Local-dev stand-in for Supabase (DEMO_MODE=1). Mirrors the schema defaults and
// the status-change trigger so the UI behaves the same. Data resets on restart.

const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();

const DEFAULTS = {
  type: 'Off-Campus', role: '', company: null, category: null, status: 'Applied', priority: null,
  deadline: null, date_applied: null, next_follow_up: null, location: null, work_mode: null,
  pay: null, hours_per_week: null, job_link: null, source: null, contact: null,
  contact_email: null, referral: false, cover_letter: false, resume_version: null,
  requirements: null, job_description: null, notes: null,
};

const SEED = [
  { type: 'On-Campus', role: 'Undergraduate Learning Assistant – CMPSC 131', company: 'EECS Department',
    category: 'Research / TA / LA', status: 'Interviewing', priority: 'High', date_applied: '2026-09-02',
    next_follow_up: '2026-09-18', pay: '$14/hr', hours_per_week: 10, source: 'Workday (PSU)',
    contact: 'Dr. Smith', resume_version: 'Resume v3 – TA', cover_letter: true },
  { type: 'On-Campus', role: 'IT Help Desk Consultant', company: 'Penn State IT', category: 'Part-time',
    status: 'Applied', priority: 'Medium', deadline: '2026-09-30', date_applied: '2026-09-12',
    pay: '$13.50/hr', hours_per_week: 12, source: 'Workday (PSU)', job_link: 'https://psu.wd1.myworkdayjobs.com/example' },
  { type: 'Off-Campus', role: 'Software Engineering Intern (Summer 2027)', company: 'Vanguard',
    category: 'Internship', status: 'OA / Assessment', priority: 'High', deadline: '2026-10-15',
    date_applied: '2026-09-08', next_follow_up: '2026-09-22', location: 'Malvern, PA', work_mode: 'Hybrid',
    pay: '$40/hr', source: 'Handshake', job_link: 'https://www.vanguardjobs.com/example', resume_version: 'Resume v3',
    requirements: 'Java or Python; data structures; expected graduation 2028',
    job_description: 'Sample posting text kept for reference.' },
  { type: 'Off-Campus', role: 'Data Science Intern', company: 'Comcast', category: 'Internship',
    status: 'Wishlist', priority: 'Medium', deadline: '2026-09-21', location: 'Philadelphia, PA',
    work_mode: 'On-site', source: 'LinkedIn', job_link: 'https://jobs.comcast.com/example' },
];

export function memoryStore() {
  const g = globalThis;
  if (!g.__jtMemory) {
    g.__jtMemory = { apps: [], events: [] };
    const s = g.__jtMemory;
    SEED.forEach((row, i) => {
      const t = new Date(Date.now() - (SEED.length - i) * 60000).toISOString();
      const app = { ...DEFAULTS, ...row, id: crypto.randomUUID(), created_at: t, updated_at: t };
      s.apps.push(app);
      s.events.push({ id: crypto.randomUUID(), application_id: app.id, event_date: app.date_applied || today(),
        kind: 'status', detail: app.status, created_at: t });
    });
  }
  const s = g.__jtMemory;
  const find = (id) => {
    const a = s.apps.find((x) => x.id === id);
    if (!a) throw new Error('Not found');
    return a;
  };
  const log = (application_id, detail, event_date = today(), kind = 'status') => {
    const ev = { id: crypto.randomUUID(), application_id, event_date, kind, detail, created_at: now() };
    s.events.push(ev);
    return ev;
  };

  return {
    async listApplications() {
      return structuredClone(s.apps);
    },
    async createApplication(row) {
      const app = { ...DEFAULTS, ...row, id: crypto.randomUUID(), created_at: now(), updated_at: now() };
      s.apps.push(app);
      log(app.id, app.status, app.date_applied || today());
      return structuredClone(app);
    },
    async updateApplication(id, patch) {
      const a = find(id);
      const prevStatus = a.status;
      Object.assign(a, patch, { updated_at: now() });
      if ('status' in patch && patch.status !== prevStatus) log(id, `${prevStatus} → ${a.status}`);
      return structuredClone(a);
    },
    async deleteApplication(id) {
      s.apps = s.apps.filter((x) => x.id !== id);
      s.events = s.events.filter((x) => x.application_id !== id);
      return null;
    },
    async listEvents(id) {
      return structuredClone(s.events.filter((e) => e.application_id === id)
        .sort((a, b) => b.event_date.localeCompare(a.event_date) || b.created_at.localeCompare(a.created_at)));
    },
    async addEvent(row) {
      find(row.application_id);
      return structuredClone(log(row.application_id, row.detail, row.event_date || today(), row.kind));
    },
  };
}
