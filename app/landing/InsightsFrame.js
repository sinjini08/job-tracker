'use client';

import { motion } from 'motion/react';
import Counter from './Counter';
import Frame from './Frame';

// Section five: what the numbers say once there are enough of them.
//
// The three tiles and the two bars are the shape of the real Insights page,
// with plausible numbers rather than anybody's actual ones. They are chosen
// to make the section's point: that the useful question is not how many you
// sent but which route answers.

const TILES = [
  { label: 'Applications', to: 47, suffix: '', note: 'plus 6 on the wishlist' },
  { label: 'Heard back', to: 39, suffix: '%', note: '18 of 47' },
  { label: 'Interviews', to: 7, suffix: '', note: '15% of applications' },
];

const SOURCES = [
  { name: 'Referrals', pct: 71, hue: 'tw:bg-brand' },
  { name: 'Campus board', pct: 52, hue: 'tw:bg-brand-mid' },
  { name: 'Job boards', pct: 18, hue: 'tw:bg-brand-light' },
];

export default function InsightsFrame() {
  return (
    <Frame label="Insights">
      <div className="tw:grid tw:gap-4 tw:p-4 tw:md:grid-cols-[1fr_1.1fr]">
        <div className="tw:grid tw:grid-cols-3 tw:gap-2.5 tw:md:grid-cols-1">
          {TILES.map((t) => (
            <div key={t.label} className="tw:rounded-xl tw:border tw:border-line tw:bg-paper tw:p-3">
              <p className="tw:m-0 tw:text-[10px] tw:font-semibold tw:uppercase tw:tracking-[0.07em] tw:text-muted">
                {t.label}
              </p>
              <p className="tw:mt-1 tw:mb-0 tw:text-[clamp(1.4rem,3vw,1.9rem)] tw:font-semibold tw:leading-none tw:text-ink">
                <Counter to={t.to} suffix={t.suffix} />
              </p>
              <p className="tw:mt-1 tw:mb-0 tw:text-[10.5px] tw:text-muted">{t.note}</p>
            </div>
          ))}
        </div>

        <div className="tw:rounded-xl tw:border tw:border-line tw:p-3.5">
          <p className="tw:m-0 tw:text-[11px] tw:font-semibold tw:text-ink">Where the replies come from</p>
          <p className="tw:mt-0.5 tw:mb-3.5 tw:text-[10.5px] tw:text-muted">
            Share of applications that got an answer
          </p>

          <div className="tw:flex tw:flex-col tw:gap-3">
            {SOURCES.map((s, i) => (
              <div key={s.name}>
                <div className="tw:mb-1 tw:flex tw:items-baseline tw:justify-between tw:text-[11px]">
                  <span className="tw:text-ink-2">{s.name}</span>
                  <span className="tw:font-semibold tw:text-ink"><Counter to={s.pct} suffix="%" /></span>
                </div>
                <div className="tw:h-2 tw:overflow-hidden tw:rounded-full tw:bg-sand">
                  <motion.i
                    className={`tw:block tw:h-full tw:rounded-full ${s.hue}`}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${s.pct}%` }}
                    viewport={{ once: true, amount: 0.6 }}
                    transition={{ duration: 0.9, delay: 0.15 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="tw:mt-4 tw:mb-0 tw:rounded-lg tw:bg-tint tw:px-2.5 tw:py-2 tw:text-[10.5px] tw:leading-snug tw:text-brand">
            Every referral you used got a reply. Job boards answered one in five.
          </p>
        </div>
      </div>
    </Frame>
  );
}
