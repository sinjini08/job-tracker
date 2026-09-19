// Shared display helpers for the sheet and the details drawer.

export const CHIP = {
  Wishlist: ['#eef0f3', '#4b5563'],
  Applied: ['#dbeafe', '#1d4ed8'],
  'OA / Assessment': ['#ede9fe', '#6d28d9'],
  Interviewing: ['#fef3c7', '#a16207'],
  Offer: ['#dcfce7', '#15803d'],
  Accepted: ['#bbf7d0', '#166534'],
  Rejected: ['#fee2e2', '#b91c1c'],
  Withdrawn: ['#f3eee8', '#7c5e3c'],
  Ghosted: ['#f1f1f1', '#6b7280'],
  High: ['#fee2e2', '#b91c1c'],
  Medium: ['#fef3c7', '#a16207'],
  Low: ['#eef0f3', '#4b5563'],
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
export function daysSince(iso) {
  return iso ? dayNumber(todayISO()) - dayNumber(iso) : null;
}
