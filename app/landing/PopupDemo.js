'use client';

import { AnimatePresence, motion } from 'motion/react';
import Frame from './Frame';
import useSteps from './useSteps';

// Section four: the extension route, recreated the same way as section three.
//
// The popup fills itself in field by field, the way it actually does, and
// then saves. CHECK is on the fields the extractor worked out rather than
// read, because that is the honest part of the product and worth showing: a
// wrong value in a column is worse than an empty one.

const FIELDS = [
  ['Role', 'Software Engineer Intern', false],
  ['Company', 'Northwind', false],
  ['Location', 'Seattle, WA', false],
  ['Pay', '$45/hr', true],
  ['Work mode', 'Hybrid', true],
];

// One per field, then the save. Only used when nothing drives the steps from
// outside, which is the reduced-motion page, where useSteps jumps straight
// to the end anyway.
const GAPS = [520, 260, 260, 260, 260, 700];

// `step`, when given, is the scroll's: the stage in TwoWays fills the popup
// in as you scroll, so it cannot be scrolled past half done.
export default function PopupDemo({ step: driven }) {
  const { ref, step: timed } = useSteps(GAPS, { armed: driven === undefined });
  const step = driven ?? timed;
  const saved = step >= FIELDS.length + 1;

  return (
    <div ref={ref} className="tw:flex tw:justify-center">
      <Frame label="Save this posting" className="tw:w-[min(22rem,92vw)]">
        <div className="tw:p-3.5">
          <p className="tw:m-0 tw:text-[12.5px] tw:font-semibold tw:text-ink">Software Engineer Intern</p>
          <p className="tw:mt-0.5 tw:mb-3 tw:text-[11px] tw:text-muted">Northwind · linkedin.com</p>

          <div className="tw:flex tw:flex-col tw:gap-2">
            {FIELDS.map(([label, value, check], i) => {
              const filled = step >= i + 1;
              return (
                <div key={label}>
                  <div className="tw:mb-1 tw:flex tw:items-center tw:gap-1.5">
                    <span className="tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.07em] tw:text-muted">
                      {label}
                    </span>
                    {check && filled && (
                      <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="tw:rounded tw:bg-amber-100 tw:px-1 tw:py-px tw:text-[8px] tw:font-bold tw:tracking-wide tw:text-amber-800"
                      >
                        CHECK
                      </motion.span>
                    )}
                  </div>
                  <div className={`tw:flex tw:h-7 tw:items-center tw:rounded-md tw:border tw:px-2 tw:text-[11.5px] ${
                    check && filled ? 'tw:border-amber-300 tw:bg-amber-50/50' : 'tw:border-line tw:bg-paper'
                  }`}>
                    <AnimatePresence>
                      {filled ? (
                        <motion.span
                          key="v"
                          initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25 }}
                          className="tw:truncate tw:text-ink"
                        >
                          {value}
                        </motion.span>
                      ) : (
                        <motion.i
                          key="s"
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: [0.35, 0.7, 0.35] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                          className="tw:block tw:h-1.5 tw:w-2/3 tw:rounded-full tw:bg-line"
                          aria-hidden
                        />
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="tw:mt-2.5 tw:mb-0 tw:text-[10px] tw:leading-snug tw:text-muted">
            The marked fields were worked out from the page rather than read from it.
          </p>

          <motion.div
            animate={saved ? { scale: [1, 0.97, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`tw:mt-3 tw:flex tw:h-9 tw:items-center tw:justify-center tw:rounded-lg tw:text-[12px] tw:font-semibold tw:text-white ${
              saved ? 'tw:bg-brand-mid' : 'tw:bg-brand'
            }`}
          >
            {saved ? 'Saved to your tracker' : 'Save to tracker'}
          </motion.div>
        </div>
      </Frame>
    </div>
  );
}
