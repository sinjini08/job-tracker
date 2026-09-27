'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

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
const CARDS = [
  {
    role: 'Software Engineer Intern', firm: 'Northwind', where: 'Seattle, WA',
    url: 'linkedin.com/jobs/view', chips: ['Internship', 'Hybrid'], lines: [92, 74, 58], depth: 1.0,
  },
  {
    role: 'Data Science Intern', firm: 'Meridian Labs', where: 'Remote',
    url: 'indeed.com/viewjob', chips: ['Summer 2027', '$32/hr'], lines: [86, 66, 44], depth: 0.55,
  },
  {
    role: 'Product Analyst', firm: 'Cobalt', where: 'New York, NY',
    url: 'cobalt.com/careers', chips: ['Internship', 'On-site'], lines: [90, 70, 52], depth: 1.35,
  },
  {
    role: 'Backend Intern', firm: 'Ravenna', where: 'Austin, TX',
    url: 'joinhandshake.com/jobs', chips: ['Part-time'], lines: [78, 60], depth: 0.75,
  },
  {
    role: 'ML Engineer Intern', firm: 'Halcyon', where: 'Boston, MA',
    url: 'halcyon.ai/careers', chips: ['Internship', 'Remote'], lines: [88, 68, 48], depth: 1.15,
  },
];

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
        <Card key={card.firm} card={card} spot={SPOTS[i]} progress={scrollYProgress} />
      ))}
    </div>
  );
}

function Card({ card, spot, progress }) {
  // Nearer cards travel further, which is the whole of parallax. The range is
  // small on purpose: this is depth, not a carousel.
  const y = useTransform(progress, [0, 1], [70 * card.depth, -70 * card.depth]);
  const scale = 0.84 + card.depth * 0.1;
  const fade = 0.6 + card.depth * 0.3;

  return (
    <motion.article
      style={{ y, scale, opacity: fade }}
      className={`tw:w-full tw:overflow-hidden tw:rounded-xl tw:border tw:border-line tw:bg-white tw:shadow-xl tw:shadow-ink/5 tw:md:absolute tw:md:w-[17rem] ${spot}`}
    >
      {/* Browser chrome. Three dots and an address is all it takes for
          something to read as a page rather than a card. */}
      <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-line tw:bg-paper tw:px-2.5 tw:py-2">
        <span className="tw:flex tw:gap-1" aria-hidden>
          <i className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-line" />
          <i className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-line" />
          <i className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-line" />
        </span>
        <span className="tw:truncate tw:rounded tw:bg-white tw:px-2 tw:py-0.5 tw:text-[9px] tw:text-muted">
          {card.url}
        </span>
      </div>

      <div className="tw:p-3">
        <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:leading-snug tw:text-ink">{card.role}</p>
        <p className="tw:mt-0.5 tw:mb-0 tw:text-[11px] tw:text-muted">{card.firm} · {card.where}</p>

        <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-1">
          {card.chips.map((c) => (
            <span key={c} className="tw:rounded-full tw:bg-tint tw:px-1.5 tw:py-0.5 tw:text-[9px] tw:font-semibold tw:text-brand">
              {c}
            </span>
          ))}
        </div>

        {/* The description, as the shape of text rather than text. Real
            sentences at this size are unreadable and pull the eye into
            trying anyway. */}
        <div className="tw:mt-2.5 tw:flex tw:flex-col tw:gap-1.5" aria-hidden>
          {card.lines.map((w, i) => (
            <i key={i} className="tw:block tw:h-1 tw:rounded-full tw:bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>

        <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2">
          <span className="tw:rounded-md tw:bg-brand tw:px-2 tw:py-1 tw:text-[9px] tw:font-semibold tw:text-white">
            Apply
          </span>
          <i className="tw:block tw:h-1 tw:w-10 tw:rounded-full tw:bg-line" aria-hidden />
        </div>
      </div>
    </motion.article>
  );
}
