'use client';

import { AnimatePresence, motion } from 'motion/react';
import Frame from './Frame';
import useSteps from './useSteps';

// Section three: the assistant route, recreated rather than recorded.
//
// A recording would be a video file, frozen at one window size and one
// theme, that has to be re-shot every time the UI moves. This is built from
// the same pieces as the page around it, so it stays sharp at any size and
// follows the page's own palette.
//
// It shows only what the product does: you paste a posting into a chat you
// were having anyway, say you applied, and the row appears in your sheet.

// The row the chat files, and the ones that were already there. Same
// employers as the wall in the section above, so the page reads as one
// person's search rather than two sets of made-up companies.
const ROW = { role: 'Software Engineer Intern', firm: 'Northwind', when: 'Today', status: 'Applied' };

const EXISTING = [
  { role: 'Data Science Intern', firm: 'Meridian Labs', when: '24 Sep', status: 'Screening' },
  { role: 'Product Analyst', firm: 'Cobalt', when: '19 Sep', status: 'Applied' },
  { role: 'ML Engineer Intern', firm: 'Halcyon', when: '15 Sep', status: 'Interviewing' },
  { role: 'Backend Intern', firm: 'Ravenna', when: '11 Sep', status: 'Wishlist' },
];

// The app's own status colours, carried across so the two look like the same
// product rather than a drawing of it.
const CHIP = {
  Applied: 'tw:bg-tint tw:text-brand',
  Screening: 'tw:bg-[#e6f0f4] tw:text-[#1c5a6b]',
  Interviewing: 'tw:bg-[#fbf0d9] tw:text-[#7a5a12]',
  Wishlist: 'tw:bg-sand tw:text-muted',
};

function Row({ row, fresh = false }) {
  return (
    <div className={`tw:grid tw:grid-cols-[1.5fr_1fr_auto_auto] tw:items-center tw:gap-2 tw:border-b tw:border-line tw:px-3 tw:py-2 ${fresh ? '' : ''}`}>
      <span className="tw:truncate tw:text-[11px] tw:font-semibold tw:text-ink">{row.role}</span>
      <span className="tw:truncate tw:text-[11px] tw:text-ink-2">{row.firm}</span>
      <span className="tw:text-[10px] tw:text-muted">{row.when}</span>
      <span className={`tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[9px] tw:font-semibold ${CHIP[row.status]}`}>
        {row.status}
      </span>
    </div>
  );
}

// user message, thinking, reply, row lands
const GAPS = [700, 900, 1100, 700];

export default function ChatDemo() {
  const { ref, step } = useSteps(GAPS);

  return (
    <div ref={ref} className="tw:grid tw:gap-4 tw:md:grid-cols-[1.05fr_1fr]">
      <Frame label="Your assistant">
        <div className="tw:flex tw:h-[clamp(230px,32vh,290px)] tw:flex-col tw:gap-3 tw:p-3.5">
          <AnimatePresence>
            {step >= 1 && (
              <motion.div
                key="ask"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="tw:ml-auto tw:max-w-[86%]"
              >
                <div className="tw:rounded-2xl tw:rounded-br-sm tw:bg-brand tw:px-3.5 tw:py-2.5 tw:text-[12.5px] tw:leading-snug tw:text-white">
                  I&rsquo;m applying to this
                </div>
                {/* The posting, pasted. Shape rather than sentences: the point
                    is that something was pasted, not what it said. */}
                <div className="tw:mt-1.5 tw:rounded-lg tw:border tw:border-line tw:bg-paper tw:p-2" aria-hidden>
                  <i className="tw:block tw:h-1 tw:w-[70%] tw:rounded-full tw:bg-line" />
                  <i className="tw:mt-1.5 tw:block tw:h-1 tw:w-[88%] tw:rounded-full tw:bg-line" />
                  <i className="tw:mt-1.5 tw:block tw:h-1 tw:w-[54%] tw:rounded-full tw:bg-line" />
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

          <AnimatePresence>
            {step >= 3 && (
              <motion.div
                key="reply"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="tw:max-w-[92%] tw:rounded-2xl tw:rounded-bl-sm tw:bg-paper tw:px-3.5 tw:py-2.5 tw:text-[12.5px] tw:leading-snug tw:text-ink"
              >
                Added <b>{ROW.role}</b> at <b>{ROW.firm}</b> to Job applications, marked Applied.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Frame>

      <Frame label="myjobtracker.co">
        <div className="tw:h-[clamp(230px,32vh,290px)] tw:overflow-hidden">
          <div className="tw:grid tw:grid-cols-[1.5fr_1fr_auto_auto] tw:gap-2 tw:border-b tw:border-line tw:bg-paper tw:px-3 tw:py-2 tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.06em] tw:text-muted">
            <span>Role</span><span>Company</span><span>Applied</span><span>Status</span>
          </div>

          {/* The rows already in the sheet. Real postings from the wall
              upstairs rather than grey bars: the section claims the row is
              filed, and a sheet of placeholders does not show that. */}
          {EXISTING.map((r) => (
            <Row key={r.role + r.firm} row={r} />
          ))}

          <AnimatePresence>
            {step >= 4 && (
              <motion.div
                initial={{ opacity: 0, y: -12, backgroundColor: '#dcece1' }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(220,236,225,0)' }}
                transition={{ duration: 0.5, backgroundColor: { duration: 1.8, delay: 0.6 } }}
              >
                <Row row={ROW} fresh />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Frame>
    </div>
  );
}
