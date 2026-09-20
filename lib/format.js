// Shared display helpers for the sheet and the details drawer.

export const CHIP = {
  Wishlist: ['#ecece1', '#5b5b50'],
  Applied: ['#dde9f7', '#1d4ed8'],
  'OA / Assessment': ['#e7e2f6', '#5b21b6'],
  Interviewing: ['#f7ebcf', '#8a5a08'],
  Offer: ['#daf0e0', '#1f7a3f'],
  Accepted: ['#c6e9d1', '#1c5a33'],
  Rejected: ['#f7dedb', '#a32f22'],
  Withdrawn: ['#efe9df', '#6f5a3e'],
  Ghosted: ['#eeeee6', '#6b6b60'],
  High: ['#f7dedb', '#a32f22'],
  Medium: ['#f7ebcf', '#8a5a08'],
  Low: ['#ecece1', '#5b5b50'],
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
