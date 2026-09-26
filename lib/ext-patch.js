// What the extension is allowed to change about a row it already has.
//
// The PATCH this replaces accepted every writable column, which meant a token
// sitting in browser storage could rewrite any row in the tracker. The
// extension only ever has one thing to say after somebody presses Apply on a
// careers site, so this builds the patch itself rather than filtering one:
// whatever else the body carries is not read at all, so there is nothing to
// get wrong about which keys are safe.

import { isoDate } from './iso-date.js';

// Wishlist so a mistaken tap can be undone; Applied because that is the
// point. Everything past Applied happens in the tracker, where the person can
// see what they are changing.
const MOVABLE = new Set(['Wishlist', 'Applied']);

/**
 * @param {unknown} body  the request body, whatever it contains
 * @param {string} today  YYYY-MM-DD, injected so this is testable
 */
export function statusPatch(body, today) {
  const id = body?.id;
  if (typeof id !== 'string' || !id.trim()) return { why: 'Expected an id.' };

  const status = body?.status;
  if (typeof status !== 'string' || !MOVABLE.has(status)) {
    return { why: 'That is not a status this can set.' };
  }

  const patch = { status };
  if (status === 'Applied') {
    // A date the extension supplies is only believed in the one shape the
    // column takes; anything else means today, which is when the person
    // pressed the button.
    patch.date_applied = isoDate(body?.date_applied) ?? today;
  }
  return { id: id.trim(), patch };
}
