'use client';

import PostingCard from './PostingCard';
import { POSTINGS } from './postings-data';

// Section two: the same postings as section one, but there is no end to them.
//
// Six columns running in alternating directions, upright, with the edges
// faded out so the wall has no top, bottom or sides. That is the point
// the section has to make: not that a job search is disorganised, but that it
// does not stop, and that things go missing inside it rather than from it.
//
// Each column's list is repeated twice and the keyframe travels exactly half
// its height, which is what makes the loop seamless: the second copy is
// standing where the first one started.

// Six of them, so the wall reaches the edges of a wide window instead of
// leaving paper down both sides. Offsets are spread across the twenty
// postings and no two speeds match, so the columns never line up into rows.
//
// Durations are 0.6 of what they were, because each column now carries 0.6
// of the cards: the keyframe travels half the column, so a shorter column at
// the old duration would drift visibly slower.
//
// Each column also walks the list with its own stride rather than taking a
// run of it. Twelve in a row starting three apart means the next column over
// is showing the same nine postings in the same order, and two columns
// running the same sequence side by side is the one thing a reader notices
// about a background. Every stride is coprime with twenty, so a column still
// visits twelve different postings.
const COLUMNS = [
  { from: 0, step: 3, dur: '31s', rev: false },
  { from: 5, step: 7, dur: '26s', rev: true },
  { from: 11, step: 9, dur: '35s', rev: false },
  { from: 2, step: 11, dur: '29s', rev: true },
  { from: 16, step: 13, dur: '33s', rev: false },
  { from: 8, step: 17, dur: '25s', rev: true },
];

// How many of the twenty each column carries.
//
// It used to be all of them, twice, which is 240 posting cards and 6,800 DOM
// nodes for one background. Measured: that wall cost the whole page about
// twenty frames a second, in every section, because it stays mounted the
// whole way down. A column's window is 130vh and twelve cards is nearly
// three times that, so the loop still has plenty to land on and no reader
// sees the seam.
const PER_COLUMN = 12;

// Twelve postings, starting at `from` and stepping by `step`, wrapping round.
const walk = (arr, from, step, n) =>
  Array.from({ length: n }, (_, i) => arr[(from + i * step) % arr.length]);

// `fill` is for the camera scene, where the wall is revealed through a hole
// that grows to the whole window: at its own height it would open onto a band
// of cards with paper above and below.
export default function BoardWall({ fill = false }) {
  return (
    <div
      className={`tw:relative tw:w-full tw:overflow-hidden ${fill ? 'tw:absolute tw:inset-0 tw:h-full' : 'tw:h-[clamp(360px,54vh,520px)]'}`}
      aria-hidden
    >
      <div
        className="tw:absolute tw:left-1/2 tw:top-1/2 tw:flex tw:gap-3"
        style={{ transform: 'translate(-50%, -50%)' }}
      >
        {COLUMNS.map((col) => {
          const list = walk(POSTINGS, col.from, col.step, PER_COLUMN);
          return (
            <div key={`${col.from}-${col.step}`} className="tw:h-[130vh] tw:overflow-hidden">
              <div className={`l-col ${col.rev ? 'rev' : ''}`} style={{ '--l-dur': col.dur }}>
                {/* Twice, so the loop has somewhere to land. */}
                {[0, 1].map((copy) =>
                  list.map((card) => (
                    <PostingCard key={`${copy}-${card.firm}-${card.role}`} card={card} compact />
                  )))}
              </div>
            </div>
          );
        })}
      </div>

      {/* The wall has no edges: it fades out on all four sides rather than
          being cut off by the section, which would make it a box of cards.
          The paper colour is written out rather than referenced. Tailwind
          rewrites theme variables to --tw-color-paper under the prefix, so
          var(--color-paper) is undefined here and takes the whole gradient
          down with it. */}
      <span
        className="tw:pointer-events-none tw:absolute tw:inset-0"
        style={{
          background:
            'radial-gradient(72% 62% at 50% 50%, rgba(245,245,240,0) 30%, rgba(245,245,240,0.86) 74%, #f5f5f0 100%)',
        }}
      />
    </div>
  );
}
