// Which posting a URL points at.
//
// The tracker asks "have I saved this one already" by comparing links, and
// the comparison cannot be a string match: the same posting arrives with a
// different trail of tracking parameters every time, so refId, trk, utm_* and
// the rest have to be ignored or nothing ever matches itself.
//
// Ignoring the whole query string is what we did, and it is wrong on the two
// biggest boards. A LinkedIn posting opened from search results is
//
//   linkedin.com/jobs/search-results/?currentJobId=4472473316&refId=...
//
// so the path is the same for every job you click through, and the first row
// ever saved from that page matched every posting afterwards. Indeed keeps
// its id in `jk` the same way.
//
// So: the path identifies the posting, unless the path is a board's search or
// listing page, in which case the id in the query does.

// Checked in this order, so a URL carrying two of them resolves the same way
// every time.
const ID_PARAMS = ['currentjobid', 'jk', 'vjk', 'jobid', 'gh_jid', 'gh_src'];

/**
 * @returns {{base: string, id: {key: string, value: string} | null} | null}
 *   `base` is origin + path, lowercased, without a trailing slash. `id` is
 *   the identifying query parameter when the URL has one. Null when the link
 *   is unusable, which includes anything too short to be a posting.
 */
export function linkParts(link) {
  let u;
  try { u = new URL(link); } catch { return null; }

  const path = u.pathname.replace(/\/$/, '');

  let id = null;
  for (const want of ID_PARAMS) {
    for (const [key, value] of u.searchParams) {
      if (key.toLowerCase() !== want) continue;
      const v = value.trim();
      // An empty or absurd value is not an id. The cap is well past any real
      // one and stops a long junk parameter becoming the whole comparison.
      if (v && v.length <= 64) { id = { key, value: v }; break; }
    }
    if (id) break;
  }

  // A bare domain is not a posting, and as a prefix it would match every row
  // on that site. This replaced a minimum length, which let https://x.co
  // through on a technicality: it is exactly twelve characters.
  if (!path && !id) return null;

  return { base: `${u.origin.toLowerCase()}${path}`, id };
}
