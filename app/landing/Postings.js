'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';

// The opening: a job search as it actually looks, spread across places that
// have nothing to do with each other.
//
// These are written here rather than screenshotted from the real boards. A
// screenshot would put someone else's design and someone else's customers'
// postings on our marketing page, and the names alone say it just as well.
const CARDS = [
  { role: 'Software Engineer Intern', firm: 'Northwind', where: 'Seattle, WA', on: 'LinkedIn', depth: 1.0 },
  { role: 'Data Science Intern', firm: 'Meridian Labs', where: 'Remote', on: 'Indeed', depth: 0.55 },
  { role: 'Product Analyst, Summer', firm: 'Cobalt', where: 'New York, NY', on: 'Company site', depth: 1.35 },
  { role: 'Backend Intern', firm: 'Ravenna', where: 'Austin, TX', on: 'Handshake', depth: 0.75 },
  { role: 'ML Engineer Intern', firm: 'Halcyon', where: 'Boston, MA', on: 'Careers page', depth: 1.15 },
  { role: 'Frontend Intern', firm: 'Lumen', where: 'Remote', on: 'LinkedIn', depth: 0.45 },
];

// Hand-placed rather than random: random scatter clumps, and a reload that
// rearranges the opening looks like a bug.
const SPOTS = [
  'tw:left-[2%] tw:top-[6%]',
  'tw:right-[4%] tw:top-[0%]',
  'tw:left-[14%] tw:bottom-[8%]',
  'tw:right-[16%] tw:bottom-[4%]',
  'tw:left-[38%] tw:top-[16%]',
  'tw:right-[34%] tw:bottom-[22%]',
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
    <div ref={wrap} className="tw:relative tw:mx-auto tw:h-[clamp(320px,46vh,460px)] tw:w-full">
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
  const scale = 0.88 + card.depth * 0.09;
  const fade = 0.55 + card.depth * 0.33;

  return (
    <motion.article
      style={{ y, scale, opacity: fade }}
      className={`tw:absolute ${spot} tw:w-[min(15rem,42vw)] tw:rounded-xl tw:border tw:border-line tw:bg-white tw:p-3.5 tw:shadow-lg tw:shadow-ink/5`}
    >
      <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:leading-snug tw:text-ink">{card.role}</p>
      <p className="tw:mt-0.5 tw:mb-0 tw:text-[12px] tw:text-muted">
        {card.firm} · {card.where}
      </p>
      <p className="tw:mt-2.5 tw:mb-0 tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.08em] tw:text-brand-mid">
        {card.on}
      </p>
    </motion.article>
  );
}
