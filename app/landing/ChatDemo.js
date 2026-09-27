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

const ROW = { role: 'Software Engineer Intern', firm: 'Northwind', when: '27 Sep', status: 'Applied' };

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
          <div className="tw:grid tw:grid-cols-[1.6fr_1fr_auto] tw:gap-2 tw:border-b tw:border-line tw:bg-paper tw:px-3 tw:py-2 tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.06em] tw:text-muted">
            <span>Role</span><span>Company</span><span>Status</span>
          </div>

          {/* Rows already there, as shape. The new one is the only one that
              has to be legible. */}
          {[0, 1].map((i) => (
            <div key={i} className="tw:grid tw:grid-cols-[1.6fr_1fr_auto] tw:items-center tw:gap-2 tw:border-b tw:border-line tw:px-3 tw:py-2.5" aria-hidden>
              <i className="tw:block tw:h-1.5 tw:w-[76%] tw:rounded-full tw:bg-line" />
              <i className="tw:block tw:h-1.5 tw:w-[58%] tw:rounded-full tw:bg-line" />
              <i className="tw:block tw:h-3 tw:w-12 tw:rounded-full tw:bg-line" />
            </div>
          ))}

          <AnimatePresence>
            {step >= 4 && (
              <motion.div
                key="new"
                initial={{ opacity: 0, y: -12, backgroundColor: '#dcece1' }}
                animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(220,236,225,0)' }}
                transition={{ duration: 0.5, backgroundColor: { duration: 1.6, delay: 0.5 } }}
                className="tw:grid tw:grid-cols-[1.6fr_1fr_auto] tw:items-center tw:gap-2 tw:border-b tw:border-line tw:px-3 tw:py-2.5"
              >
                <span className="tw:truncate tw:text-[11.5px] tw:font-semibold tw:text-ink">{ROW.role}</span>
                <span className="tw:truncate tw:text-[11.5px] tw:text-ink-2">{ROW.firm}</span>
                <span className="tw:rounded-full tw:bg-tint tw:px-2 tw:py-0.5 tw:text-[9px] tw:font-semibold tw:text-brand">
                  {ROW.status}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Frame>
    </div>
  );
}
