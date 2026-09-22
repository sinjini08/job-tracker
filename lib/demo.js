// The rows a signed-out visitor sees on the landing page. They are never
// written anywhere: the sheet renders them read-only with the network off, so
// the front door shows the real product instead of a screenshot of it.
//
// Dates are relative to today so the demo never looks abandoned.

const day = 86400000;
const iso = (offset) => new Date(Date.now() + offset * day).toISOString().slice(0, 10);

const ROWS = [
  { type: 'On-Campus', role: 'Learning Assistant, CMPSC 131', company: 'Dept. of Computer Science',
    term: 'Spring 2027', category: 'Research / TA / LA', status: 'Interviewing', priority: 'High',
    deadline: iso(-12), date_applied: iso(-19), next_follow_up: iso(2), location: 'Westgate Building',
    work_mode: 'On-site', pay: '$14/hr', hours_per_week: 10, source: 'University portal',
    referral: true, outreach_method: 'Email', resume_version: 'Resume v4', cover_letter: false },

  { type: 'On-Campus', role: 'Undergraduate Research Assistant', company: 'Human-Computer Interaction Lab',
    term: 'Spring 2027', category: 'Research / TA / LA', status: 'Offer', priority: 'High',
    deadline: null, date_applied: iso(-31), next_follow_up: null, location: 'IST Building',
    work_mode: 'Hybrid', pay: '$16/hr', hours_per_week: 12, source: 'Referral',
    referral: true, outreach_method: 'In person', resume_version: 'Resume v4', cover_letter: true },

  { type: 'On-Campus', role: 'IT Service Desk Consultant', company: 'Information Technology Services',
    term: 'Ongoing', category: 'Part-time', status: 'Applied', priority: 'Medium',
    deadline: iso(1), date_applied: iso(-4), next_follow_up: iso(3), location: 'Pattee Library',
    work_mode: 'On-site', pay: '$13.50/hr', hours_per_week: 15, source: 'Handshake',
    referral: false, outreach_method: null, resume_version: 'Resume v3', cover_letter: false },

  { type: 'On-Campus', role: 'Grader, MATH 230', company: 'Dept. of Mathematics',
    term: 'Spring 2027', category: 'Work-Study', status: 'No reply', priority: 'Low',
    deadline: iso(-26), date_applied: iso(-38), next_follow_up: iso(-8), location: 'McAllister Building',
    work_mode: 'Remote', pay: '$13/hr', hours_per_week: 8, source: 'University portal',
    referral: false, outreach_method: null, resume_version: 'Resume v3', cover_letter: false },

  { type: 'Off-Campus', role: 'Software Engineer Intern', company: 'Vanguard',
    term: 'Summer 2027', category: 'Internship', status: 'OA / Assessment', priority: 'High',
    deadline: iso(-6), date_applied: iso(-11), next_follow_up: iso(1), location: 'Malvern, PA',
    work_mode: 'Hybrid', pay: '$42/hr', hours_per_week: 40, source: 'Handshake',
    referral: false, outreach_method: 'LinkedIn', resume_version: 'Resume v4', cover_letter: true },

  { type: 'Off-Campus', role: 'Data Analyst Intern', company: 'Highmark Health',
    term: 'Summer 2027', category: 'Internship', status: 'Screening', priority: 'High',
    deadline: iso(-2), date_applied: iso(-8), next_follow_up: iso(4), location: 'Pittsburgh, PA',
    work_mode: 'Hybrid', pay: '$34/hr', hours_per_week: 40, source: 'LinkedIn',
    referral: true, outreach_method: 'LinkedIn', resume_version: 'Resume v4', cover_letter: false },

  { type: 'Off-Campus', role: 'Backend Engineering Intern', company: 'Duolingo',
    term: 'Summer 2027', category: 'Internship', status: 'Rejected', priority: 'High',
    deadline: iso(-34), date_applied: iso(-41), next_follow_up: null, location: 'Pittsburgh, PA',
    work_mode: 'On-site', pay: '$48/hr', hours_per_week: 40, source: 'Company site',
    referral: false, outreach_method: null, resume_version: 'Resume v3', cover_letter: true },

  { type: 'Off-Campus', role: 'Product Analytics Intern', company: 'Comcast',
    term: 'Summer 2027', category: 'Internship', status: 'Applied', priority: 'Medium',
    deadline: iso(5), date_applied: iso(-3), next_follow_up: iso(4), location: 'Philadelphia, PA',
    work_mode: 'On-site', pay: '$36/hr', hours_per_week: 40, source: 'Career fair',
    referral: false, outreach_method: 'Career fair', resume_version: 'Resume v4', cover_letter: false },

  { type: 'Off-Campus', role: 'Machine Learning Intern', company: 'Lockheed Martin',
    term: 'Summer 2027', category: 'Internship', status: 'Wishlist', priority: 'Medium',
    deadline: iso(9), date_applied: null, next_follow_up: null, location: 'King of Prussia, PA',
    work_mode: 'On-site', pay: '$40/hr', hours_per_week: 40, source: 'Handshake',
    referral: false, outreach_method: null, resume_version: null, cover_letter: false },

  { type: 'Off-Campus', role: 'SWE Intern, Infrastructure', company: 'Stripe',
    term: 'Summer 2027', category: 'Internship', status: 'Final round', priority: 'High',
    deadline: iso(-21), date_applied: iso(-27), next_follow_up: iso(2), location: 'Remote (US)',
    work_mode: 'Remote', pay: '$55/hr', hours_per_week: 40, source: 'Referral',
    referral: true, outreach_method: 'Email', resume_version: 'Resume v4', cover_letter: true },
];

export function demoRows() {
  return ROWS.map((r, i) => ({
    id: `demo-${i + 1}`,
    contact: null, contact_email: null, contact_link: null, reached_out_on: null,
    requirements: null, job_description: null, notes: null,
    custom: {},
    ...r,
  }));
}
