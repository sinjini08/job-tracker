'use client';

import PostingCard from './PostingCard';
import { POSTINGS } from './postings-data';

// Section two: the same postings as section one, but there is no end to them.
//
// Four columns running in alternating directions, upright, with the edges
// faded out so the wall has no top, bottom or sides. That is the point
// the section has to make: not that a job search is disorganised, but that it
// does not stop, and that things go missing inside it rather than from it.
//
// Each column's list is repeated twice and the keyframe travels exactly half
// its height, which is what makes the loop seamless: the second copy is
// standing where the first one started.

const COLUMNS = [
  { from: 0, dur: '52s', rev: false },
  { from: 3, dur: '44s', rev: true },
  { from: 6, dur: '58s', rev: false },
  { from: 9, dur: '48s', rev: true },
];

// Rotated from the list's own start so the four columns do not read as one
// list four times.
const rotate = (arr, n) => [...arr.slice(n), ...arr.slice(0, n)];

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
          const list = rotate(POSTINGS, col.from);
          return (
            <div key={col.from} className="tw:h-[130vh] tw:overflow-hidden">
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
