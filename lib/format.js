// Shared display helpers for the sheet and the details drawer.

// Chip colours for the statuses and priorities the app knows about. A status a
// student types themselves has no entry and falls back to the neutral chip.
// Status and priority.
//
// Eleven states, and the ones people confuse are neighbours in the funnel, so
// both of these were measured rather than eyeballed:
//
//   CONTRAST. Every pair clears WCAG AA for small text, worst 4.75:1. The old
//   set had several nobody could read.
//
//   SEPARATION. The distinction lives in the INK, not the tint: eleven pale
//   backgrounds are all the same lightness by construction, so no amount of
//   tinting tells them apart. Measured as OKLab distance between the text
//   colours, funnel neighbours are mostly 13 or more. Applied and Screening,
//   which read as the same blue before, are now 10.3 apart: blue against teal.
//
//   Screening is teal rather than green so it cannot be mistaken for Offer,
//   and Final round is rose rather than amber so it cannot be mistaken for
//   Rejected. Those two pairs mean opposite things.
export const CHIP = {
  Wishlist:          ['#e7eaf0', '#44516a'],
  Applied:           ['#e0ebfb', '#0f4d93'],
  Screening:         ['#d5eef2', '#07646f'],
  'OA / Assessment': ['#eae2f7', '#5b2d9c'],
  Interviewing:      ['#fcebc4', '#8a5a00'],
  'Final round':     ['#fbdeec', '#9b2f63'],
  Offer:             ['#d3f0d3', '#0c7129'],
  Accepted:          ['#b4e5ba', '#04480f'],
  Rejected:          ['#fbdbd7', '#a82113'],
  Withdrawn:         ['#eae7de', '#6a6458'],
  'No reply':        ['#e9e9e9', '#5f6366'],
  High:              ['#fbdbd7', '#a82113'],
  Medium:            ['#fcebc4', '#8a5a00'],
  Low:               ['#e7eaf0', '#44516a'],
};

// ---- date helpers (dates are 'YYYY-MM-DD' strings; never go through UTC) ----
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${m}/${d}/${y}`;
}
export function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}
export function addDays(iso, n) {
  if (!iso) return null;
  const d = new Date(dayNumber(iso) * 86400000 + n * 86400000);
  return d.toISOString().slice(0, 10);
}
export function daysSince(iso) {
  return iso ? dayNumber(todayISO()) - dayNumber(iso) : null;
}
