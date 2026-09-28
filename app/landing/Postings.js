'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import PostingCard from './PostingCard';
import { POSTINGS } from './postings-data';

// The opening: a job search as it actually looks, spread across places that
// have nothing to do with each other.
//
// Each card is a miniature of a posting page rather than a text box: browser
// chrome, the address, the title, the chips, a few lines of the description
// and the Apply button. Small enough to read as "a job posting somewhere" in
// half a second, which is all this section asks of it.
//
// Written here rather than screenshotted. A screenshot would put another
// company's design, and their customers' postings, on our marketing page. The
// address bar carries the board's name as plain text, which says it just as
// well as their logo would.
const CARDS = POSTINGS.slice(0, 5);

// How near each of the five is, which drives how far it travels, how big it
// is and how solid. A property of the position rather than of the posting,
// which is why it sits beside SPOTS rather than in the data.
const DEPTHS = [1.0, 0.55, 1.35, 0.75, 1.15];

// Hand-placed rather than random: random scatter clumps, and a reload that
// rearranges the opening looks like a bug.
//
// Only from md up. A scatter needs room, and at 375px five overlapping cards
// are a pile with nothing readable in it, so below that they become a plain
// two-column grid and the fifth is dropped.
const SPOTS = [
  'tw:md:left-[0%] tw:md:top-[4%]',
  'tw:md:right-[1%] tw:md:top-[0%]',
  'tw:md:left-[8%] tw:md:bottom-[2%]',
  'tw:md:right-[10%] tw:md:bottom-[0%]',
  'tw:hidden tw:md:block tw:md:left-[36%] tw:md:top-[26%]',
];

export default function Postings() {
  const wrap = useRef(null);
  // Measured across the whole time the section is on screen, so the drift is
  // tied to the scroll rather than to a timer.
  const { scrollYProgress } = useScroll({
    target: wrap,
    offset: ['start end', 'end start'],
  });

  return (
    <div
      ref={wrap}
      className="tw:mx-auto tw:grid tw:w-full tw:grid-cols-2 tw:gap-3 tw:md:relative tw:md:block tw:md:h-[clamp(380px,52vh,520px)]"
    >
      {CARDS.map((card, i) => (
        <Card key={card.firm} card={card} spot={SPOTS[i]} depth={DEPTHS[i]} progress={scrollYProgress} />
      ))}
    </div>
  );
}

function Card({ card, spot, depth, progress }) {
  // Nearer cards travel further, which is the whole of parallax. The range is
  // small on purpose: this is depth, not a carousel.
  const y = useTransform(progress, [0, 1], [70 * depth, -70 * depth]);
  const scale = 0.84 + depth * 0.1;
  const fade = 0.6 + depth * 0.3;

  return (
    <motion.div
      style={{ y, scale, opacity: fade }}
      className={`tw:w-full tw:md:absolute tw:md:w-[17rem] ${spot}`}
    >
      <PostingCard card={card} />
    </motion.div>
  );
}
