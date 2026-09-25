// Turning a model's answer into text, or refusing to.
//
// The model is asked for two line numbers and never for words. This is where
// that promise is kept: the numbers are checked against the lines that were
// actually sent, and the text is then cut from those same lines. Nothing the
// model wrote is ever passed through, so a requirement it invented cannot
// reach the tracker even if it tried to write one.

export const MAX_SPAN = 40;
const MAX_ITEMS = 6;

/**
 * @param {string[]} lines  the lines that were sent, in the order sent
 * @param {unknown} answer  whatever came back
 * @returns {{text: string} | {why: string}}
 */
export function pickSpan(lines, answer) {
  const start = answer?.start;
  const end = answer?.end;

  // "No such section" is a valid answer and the one we want when a posting
  // has no requirements, so it is not lumped in with a malformed reply.
  if (start === null && end === null) return { why: 'the posting has no such section' };
  if (!Number.isInteger(start) || !Number.isInteger(end)) return { why: 'not a span' };
  if (start < 0 || end < start || end >= lines.length) return { why: 'span outside the posting' };
  if (end - start + 1 > MAX_SPAN) return { why: 'span too wide to be one section' };

  const picked = lines
    .slice(start, end + 1)
    .map((l) => String(l).replace(/^[-•*]\s*/, '').trim())
    .filter((l) => l.length > 3)
    .slice(0, MAX_ITEMS);

  return picked.length ? { text: picked.join('\n') } : { why: 'nothing on those lines' };
}
