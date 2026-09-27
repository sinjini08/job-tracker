// Which posting a URL points at.
//
// The tracker asks "have I saved this one already" by comparing links, and
// the comparison cannot be a plain string match: the same posting arrives
// with a different trail of tracking parameters every time, so refId, trk,
// utm_* and the rest have to be ignored or nothing ever matches itself.
//
// Ignoring the whole query string is what we used to do, and it is wrong
// wherever the path is shared. A LinkedIn posting opened from search results
// is
//
//   linkedin.com/jobs/search-results/?currentJobId=4472473316&refId=...
//
// so every job clicked through there has the same path, and the first row
// ever saved that way matched all of them. Indeed keeps its id in `jk`, and a
// company careers page often keeps its own in something nobody could predict.
//
// So the rule is a denylist rather than an allowlist: keep the path, keep
// every query parameter that is not known to be tracking, and let an
// unfamiliar board's id survive by default.
//
// The two ways this can be wrong are not equally bad, and the denylist is
// chosen for that. Keeping too much means a posting found a second way round
// is not recognised, and you get a duplicate row, which is visible and one
// click to delete. Keeping too little means a job you have never seen is
// declared already saved under some other job's name, and the save is blocked
// entirely. The second is much worse, so this errs towards keeping.

// Things that identify the visit rather than the posting. Anything ending in
// a star is matched as a prefix.
const TRACKING = [
  'utm_*', 'ref', 'refid', 'trk', 'trackingid', 'tracking_id', 'trackingparams',
  'gclid', 'fbclid', 'msclkid', 'li_fat_id', 'igshid',
  'src', 'source', 'origin', 'from', 'tk', 'vjs', 'seen',
  'keywords', 'q', 'query', 'search', 'page', 'pagenum', 'start',
  'sid', 'sessionid', 'session_id', 'lang', 'locale', 'hl',
  'alid', 'eboguid', 'cmpid', 'savedsearchid', 'spa',
];

// Checked first when the cap bites, because these are ids rather than
// something that merely survived the denylist.
const KNOWN_IDS = ['currentjobid', 'jk', 'vjk', 'jobid', 'job_id', 'gh_jid', 'id', 'postingid', 'posting_id', 'reqid'];

// Enough to identify a posting on any board seen so far, without building a
// query with a dozen conditions in it.
const MAX_MARKS = 3;

const isTracking = (key) => TRACKING.some((t) =>
  (t.endsWith('*') ? key.startsWith(t.slice(0, -1)) : key === t));

/**
 * @returns {{base: string, marks: string[]} | null}
 *   `base` is origin + path, lowercased, without a trailing slash. `marks`
 *   are the raw `key=value` pairs that identify the posting, exactly as they
 *   appeared in the link, so they can be matched against a stored URL without
 *   worrying about encoding. Null when the link is unusable.
 */
export function linkParts(link) {
  let u;
  try { u = new URL(link); } catch { return null; }

  const path = u.pathname.replace(/\/$/, '');

  // Read from the raw query rather than searchParams, because searchParams
  // decodes and the stored link has not been: comparing a decoded pair
  // against an encoded URL finds nothing.
  const pairs = u.search.replace(/^\?/, '').split('&').filter(Boolean);
  const kept = [];
  for (const raw of pairs) {
    const key = decodeURIComponent(raw.split('=')[0] ?? '').toLowerCase();
    const value = raw.slice(raw.indexOf('=') + 1);
    if (!key || raw.indexOf('=') === -1) continue;
    // Empty is not an id, and an absurdly long one is a payload rather than
    // an identifier.
    if (!value || value.length > 64) continue;
    if (isTracking(key)) continue;
    kept.push({ key, raw });
  }

  // Ids first, then whatever else survived, then cut.
  kept.sort((a, b) => KNOWN_IDS.indexOf(a.key) - KNOWN_IDS.indexOf(b.key));
  const marks = kept
    .sort((a, b) => (KNOWN_IDS.includes(b.key) ? 1 : 0) - (KNOWN_IDS.includes(a.key) ? 1 : 0))
    .slice(0, MAX_MARKS)
    .map((p) => p.raw);

  // A bare domain is not a posting, and as a prefix it would match every row
  // on that site. This replaced a minimum length, which let https://x.co
  // through on a technicality: it is exactly twelve characters.
  if (!path && !marks.length) return null;

  return { base: `${u.origin.toLowerCase()}${path}`, marks };
}
