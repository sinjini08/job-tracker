'use client';

import { motion } from 'motion/react';
import Counter from './Counter';
import Frame from './Frame';

// Section six: the part that makes somebody come back tomorrow.
//
// Today's board, with the bars filling as it arrives. The target line matters
// more than the ranking and the copy on the real page says so: everyone who
// clears the target has won the day, so this is not a fight over one place.

const TARGET = 10;

const BOARD = [
  { name: 'you', pts: 12, streak: 6, won: true, me: true },
  { name: 'rou', pts: 10, streak: 3, won: true },
  { name: 'tam', pts: 4, streak: 0, won: false },
];

export default function LeagueFrame() {
  return (
    <Frame label="League · CS friends">
      <div className="tw:p-4">
        <div className="tw:mb-3.5 tw:flex tw:items-baseline tw:justify-between">
          <p className="tw:m-0 tw:text-[11px] tw:font-semibold tw:text-ink">Today</p>
          <p className="tw:m-0 tw:text-[10.5px] tw:text-muted">{TARGET} points wins the day</p>
        </div>

        <ul className="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-2 tw:p-0">
          {BOARD.map((m, i) => (
            <li
              key={m.name}
              className={`tw:grid tw:grid-cols-[1.6rem_4.5rem_1fr_2rem_auto] tw:items-center tw:gap-2.5 tw:rounded-xl tw:border tw:px-2.5 tw:py-2.5 ${
                m.me ? 'tw:border-tint tw:bg-tint/45' : 'tw:border-line tw:bg-white'
              }`}
            >
              <span className={`tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-full tw:text-[10px] tw:font-bold ${
                i === 0 ? 'tw:bg-amber-200 tw:text-amber-900' : 'tw:bg-sand tw:text-muted'
              }`}>
                {i + 1}
              </span>

              <span className="tw:truncate tw:text-[12px] tw:font-semibold tw:text-ink">
                {m.name}
                {m.streak > 0 && (
                  <span className="tw:ml-1.5 tw:text-[10px] tw:font-normal tw:text-muted">{m.streak}d</span>
                )}
              </span>

              <span className="tw:relative tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-sand">
                <motion.i
                  className={`tw:block tw:h-full tw:rounded-full ${m.won ? 'tw:bg-brand' : 'tw:bg-brand-light'}`}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.min(100, (m.pts / TARGET) * 100)}%` }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.9, delay: 0.2 + i * 0.14, ease: [0.16, 1, 0.3, 1] }}
                />
              </span>

              <span className="tw:text-right tw:text-[12px] tw:font-bold tw:text-ink">
                <Counter to={m.pts} />
              </span>

              {m.won ? (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ delay: 0.9 + i * 0.14, type: 'spring', stiffness: 320, damping: 18 }}
                  className="tw:rounded-full tw:bg-brand tw:px-2 tw:py-0.5 tw:text-[9px] tw:font-bold tw:uppercase tw:tracking-[0.06em] tw:text-white"
                >
                  Won
                </motion.span>
              ) : (
                <span className="tw:text-[10px] tw:text-muted">{TARGET - m.pts} to go</span>
              )}
            </li>
          ))}
        </ul>

        <p className="tw:mt-3.5 tw:mb-0 tw:text-[10.5px] tw:leading-snug tw:text-muted">
          Anyone who reaches the target has won the day, so you are not fighting over one spot.
        </p>
      </div>
    </Frame>
  );
}
