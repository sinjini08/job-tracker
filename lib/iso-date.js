// A date the database will accept, or nothing.
//
// Checking the shape is not enough and the difference is not theoretical:
// "2026-13-45T00:00:00Z" cut to ten characters is "2026-13-45", which matches
// \d{4}-\d{2}-\d{2} exactly and is month thirteen, day forty-five. Postgres
// refuses it, so a single malformed date from a scraped page took down the
// whole save rather than leaving one column empty.
//
// So the parts are read back after parsing. A date that does not survive the
// round trip was never a date, whatever it looked like.
export function isoDate(value) {
  const s = String(value ?? '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const when = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(when.getTime())) return null;
  // Rolls over silently otherwise: month 13 becomes January of the next year
  // rather than an error, so the output has to be compared with the input.
  return when.toISOString().slice(0, 10) === s ? s : null;
}
