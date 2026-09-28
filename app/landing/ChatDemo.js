'use client';

import { AnimatePresence, motion } from 'motion/react';
import Frame from './Frame';
import { Logo } from './PostingCard';
import useSteps from './useSteps';

// Section three: the assistant route, recreated rather than recorded.
//
// A recording would be a video file, frozen at one window size and one
// theme, that has to be re-shot every time the UI moves. This is built from
// the same pieces as the page around it, so it stays sharp at any size and
// follows the page's own palette.
//
// It shows only what the product does: you paste a posting into a chat you
// were having anyway, the assistant reads it and says something useful about
// it, and the row appears in your sheet.

// The posting being pasted. Same record the wall upstairs shows, down to the
// pay and the mark, so the two sections are one person's search rather than
// two sets of invented companies.
const POSTING = {
  role: 'Software Engineer Intern',
  firm: 'Northwind',
  where: 'Seattle, WA',
  meta: '$45/hr · Internship · Hybrid',
  logo: { bg: '#1f4b8f', glyph: 'chevron' },
};

const ROW = { role: POSTING.role, firm: POSTING.firm, when: 'Today', status: 'Applied' };

const EXISTING = [
  { role: 'Data Science Intern', firm: 'Meridian Labs', when: '24 Sep', status: 'Screening' },
  { role: 'Product Analyst', firm: 'Cobalt', when: '19 Sep', status: 'Applied' },
  { role: 'ML Engineer Intern', firm: 'Halcyon', when: '15 Sep', status: 'Interviewing' },
  { role: 'Backend Intern', firm: 'Ravenna', when: '11 Sep', status: 'Wishlist' },
  { role: 'Frontend Intern', firm: 'Lumen', when: '6 Sep', status: 'Offer' },
];

// The app's own light-mode chip values, copied rather than referenced: the
// tokens in globals.css flip with the theme and this page is light only, so
// var(--chip-applied-bg) would put dark-mode chips on a paper frame.
const CHIP = {
  Wishlist: 'tw:bg-[#e7eaf0] tw:text-[#44516a]',
  Applied: 'tw:bg-[#e0ebfb] tw:text-[#0f4d93]',
  Screening: 'tw:bg-[#d5eef2] tw:text-[#07646f]',
  Interviewing: 'tw:bg-[#fcebc4] tw:text-[#8a5a00]',
  Offer: 'tw:bg-[#d3f0d3] tw:text-[#0c7129]',
};

// One template, shared by the header and every row. Separate grids with an
// `auto` track size themselves to their own contents, which is why the dates
// and chips used to sit at a different x on every line.
const GRID = 'tw:grid tw:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)_52px_80px] tw:items-center tw:gap-2.5 tw:px-3';

function Row({ row }) {
  return (
    <div className={`${GRID} tw:border-b tw:border-line tw:py-2.5`}>
      <span className="tw:truncate tw:text-[11px] tw:font-semibold tw:text-ink">{row.role}</span>
      <span className="tw:truncate tw:text-[11px] tw:text-ink-2">{row.firm}</span>
      <span className="tw:text-right tw:text-[10px] tw:text-muted">{row.when}</span>
      <span className={`tw:justify-self-start tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[9px] tw:font-semibold ${CHIP[row.status]}`}>
        {row.status}
      </span>
    </div>
  );
}

function Bubble({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="tw:max-w-[94%] tw:rounded-2xl tw:rounded-bl-sm tw:bg-paper tw:px-3.5 tw:py-2.5 tw:text-[12.5px] tw:leading-snug tw:text-ink"
    >
      {children}
    </motion.div>
  );
}

// ask + posting, thinking, advice, confirmation, row lands. The gap before
// the confirmation is the longest because the advice above it is the one
// thing on this page worth stopping to read.
const GAPS = [700, 800, 1000, 1500, 600];

export default function ChatDemo() {
  const { ref, step } = useSteps(GAPS);

  return (
    <div ref={ref} className="tw:grid tw:gap-4 tw:md:grid-cols-[1.05fr_1fr]">
      <Frame label="Your assistant">
        <div className="tw:flex tw:h-[clamp(276px,30vh,300px)] tw:flex-col tw:gap-2.5 tw:p-3.5">
          <AnimatePresence>
            {step >= 1 && (
              <motion.div
                key="ask"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="tw:ml-auto tw:max-w-[88%]"
              >
                <div className="tw:ml-auto tw:w-fit tw:rounded-2xl tw:rounded-br-sm tw:bg-brand tw:px-3.5 tw:py-2.5 tw:text-[12.5px] tw:leading-snug tw:text-white">
                  I&rsquo;m applying to this
                </div>
                {/* The posting itself, not a grey placeholder. A drawing of
                    three bars says something was pasted; the actual role,
                    employer and pay say what the assistant is reading. */}
                <div className="tw:mt-1.5 tw:flex tw:gap-2 tw:rounded-xl tw:border tw:border-line tw:bg-paper tw:p-2.5">
                  <Logo logo={POSTING.logo} firm={POSTING.firm} />
                  <span className="tw:min-w-0">
                    <b className="tw:block tw:truncate tw:text-[11.5px] tw:font-semibold tw:text-ink">{POSTING.role}</b>
                    <span className="tw:mt-0.5 tw:block tw:truncate tw:text-[10.5px] tw:text-ink-2">
                      {POSTING.firm} · {POSTING.where}
                    </span>
                    <span className="tw:mt-0.5 tw:block tw:truncate tw:text-[10px] tw:text-muted">{POSTING.meta}</span>
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step === 2 && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="tw:flex tw:gap-1"
                aria-hidden
              >
                {[0, 1, 2].map((i) => (
                  <motion.i
                    key={i}
                    className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-muted"
                    animate={{ opacity: [0.25, 1, 0.25] }}
                    transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Two replies, in the order a person would want them. The useful
              one first, the bookkeeping second: filing the row is the thing
              the product does, but it is not the thing you were thinking
              about when you pasted the posting. */}
          <AnimatePresence>
            {step >= 3 && (
              <Bubble key="advice">
                The post asks twice for distributed systems. Move your message-queue bullet to the top of your r&eacute;sum&eacute;.
              </Bubble>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {step >= 4 && (
              <Bubble key="filed">
                Added <b>{ROW.role}</b> at <b>{ROW.firm}</b> to Job applications, marked Applied.
              </Bubble>
            )}
          </AnimatePresence>
        </div>
      </Frame>

      <Frame label="myjobtracker.co">
        <div className="tw:h-[clamp(276px,30vh,300px)] tw:overflow-hidden">
          <div className={`${GRID} tw:border-b tw:border-line tw:bg-paper tw:py-2 tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.06em] tw:text-muted`}>
            <span>Role</span><span>Company</span><span className="tw:text-right">Applied</span><span>Status</span>
          </div>

          {/* The rows already in the sheet. Real postings from the wall
              upstairs rather than grey bars: the section claims the row is
              filed, and a sheet of placeholders does not show that. */}
          {EXISTING.map((r) => (
            <Row key={r.role + r.firm} row={r} />
          ))}

          <AnimatePresence>
            {step >= 5 && (
              <motion.div
                initial={{ opacity: 0, y: -12, backgroundColor: '#dcece1' }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(220,236,225,0)' }}
                transition={{ duration: 0.5, backgroundColor: { duration: 1.8, delay: 0.6 } }}
              >
                <Row row={ROW} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Frame>
    </div>
  );
}
