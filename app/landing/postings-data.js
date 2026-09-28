// The postings the first two sections are made of.
//
// Written rather than screenshotted: a screenshot would put another company's
// design, and their customers' postings, on our marketing page. The address
// bar carries the board's name as plain text, which says what a logo would.
//
// The employers are invented, and so are their marks. Using real ones would
// imply they are hiring through us, and the logos are drawn from two shapes
// each rather than copied from anybody.
//
// No two tiles carry the same set of fields. That is the whole point of the
// list: a real board is a jumble of postings where one shows a salary, the
// next has been up for nine days with two hundred applicants, and the one
// after that says nothing at all. A wall of identical cards reads as a
// template, which is the opposite of what section two is claiming.

// Muted enough to sit on a page that is otherwise green and paper, varied
// enough that four of them in a column do not look like a set.
export const POSTINGS = [
  {
    role: 'Software Engineer Intern', firm: 'Northwind', where: 'Seattle, WA',
    url: 'linkedin.com/jobs/view', chips: ['Internship', 'Full-time', 'Hybrid'], lines: [92, 74, 58],
    logo: { bg: '#1f4b8f', glyph: 'chevron' }, pay: '$45/hr',
    posted: '2 days ago', applicants: 'Over 100 applicants', verified: true, apply: 'Easy Apply',
  },
  {
    role: 'Data Science Intern', firm: 'Meridian Labs', where: 'Remote',
    url: 'indeed.com/viewjob', chips: ['Summer 2027'], lines: [86, 66, 44],
    logo: { bg: '#0f7d74', glyph: 'rings' }, pay: '$32 – $38/hr',
    posted: 'Just posted', apply: 'Apply now',
  },
  {
    role: 'Product Analyst', firm: 'Cobalt', where: 'New York, NY',
    url: 'cobalt.com/careers', chips: ['Internship', 'On-site'], lines: [90, 70, 52],
    logo: { bg: '#3b3f7d', glyph: 'square' },
    posted: '9 days ago', applicants: '212 applicants', apply: 'Apply on company site',
  },
  {
    role: 'Backend Intern', firm: 'Ravenna', where: 'Austin, TX',
    url: 'joinhandshake.com/jobs', chips: ['Part-time'], lines: [78, 60],
    logo: { bg: '#8a4b2a', glyph: 'triangle' },
    deadline: 'Closes 14 Oct', apply: 'Apply',
  },
  {
    role: 'ML Engineer Intern', firm: 'Halcyon', where: 'Boston, MA',
    url: 'halcyon.ai/careers', chips: ['Internship', 'Remote'], lines: [88, 68, 48],
    logo: { bg: '#6a3f8f', glyph: 'chevron' }, pay: '$52/hr',
    promoted: true, posted: '4 days ago', apply: 'Apply',
  },
  {
    role: 'Frontend Intern', firm: 'Lumen', where: 'Remote',
    url: 'linkedin.com/jobs/view', chips: ['Summer 2027'], lines: [84, 62],
    posted: '3 weeks ago', applicants: 'Be an early applicant', apply: 'Easy Apply',
  },
  {
    role: 'Platform Engineer Intern', firm: 'Kestrel', where: 'Chicago, IL',
    url: 'kestrel.io/jobs', chips: ['Internship', 'Hybrid'], lines: [90, 72, 50],
    logo: { bg: '#2f6f3e', glyph: 'rings' }, pay: '$48/hr',
    verified: true, apply: 'Apply',
  },
  {
    role: 'Software Engineer, New Grad', firm: 'Calder', where: 'Remote',
    url: 'calder.dev/careers', chips: ['Full-time'], lines: [80, 64],
    logo: { bg: '#1c5a6b', glyph: 'square' }, pay: '$118k – $140k',
    posted: 'Yesterday', apply: 'Apply',
  },
  {
    role: 'Security Analyst Intern', firm: 'Ironwood', where: 'Arlington, VA',
    url: 'ironwood.com/careers', chips: ['Citizenship'], lines: [88, 64, 46],
    logo: { bg: '#5d5f66', glyph: 'triangle' },
    posted: '11 days ago', apply: 'Apply on company site',
  },
  {
    role: 'Mobile Engineer Intern', firm: 'Tessellate', where: 'Remote',
    url: 'indeed.com/viewjob', chips: ['Internship'], lines: [82, 70, 54],
    pay: '$40/hr', applicants: '38 applicants', apply: 'Apply now',
  },
  {
    role: 'Data Engineer Intern', firm: 'Alder & Finch', where: 'Denver, CO',
    url: 'alderfinch.com/jobs', chips: ['Summer 2027', 'Hybrid'], lines: [86, 60],
    logo: { bg: '#8a6a1f', glyph: 'chevron' },
    deadline: 'Closes 2 Nov', posted: '6 days ago', apply: 'Apply',
  },
  {
    role: 'QA Intern', firm: 'Brightwater', where: 'Remote',
    url: 'linkedin.com/jobs/view', chips: ['Part-time'], lines: [80, 66, 42],
    logo: { bg: '#2a6fa8', glyph: 'rings' },
    promoted: true, applicants: 'Be an early applicant', apply: 'Easy Apply',
  },
];
