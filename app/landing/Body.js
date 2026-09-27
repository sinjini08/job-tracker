'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SECTIONS, byId } from './copy';
import Doors from './Doors';
import Header from './Header';
import Postings from './Postings';
import Reveal from './Reveal';
import Section from './Section';

// The page itself: seven stops, read in order.
//
// Every section carries an explanatory headline, because a visitor who has to
// guess what they are looking at stops scrolling. The copy lives in copy.js.
export default function Body() {
  const [door, setDoor] = useState(null);

  return (
    <>
      <Header onOpen={setDoor} />

      <main className="tw:bg-paper tw:text-ink">
        <Section id="everywhere" {...byId('everywhere')} wide>
          <Postings />
        </Section>

        {/* The remaining visuals land next: the grid, the two animated
            recreations, the insights frame and the league board. */}
        {SECTIONS.slice(1, 6).map((s) => (
          <Section key={s.id} id={s.id} {...s}>
            <Placeholder id={s.id} />
          </Section>
        ))}

        <Section id="close" {...byId('close')}>
          <Reveal delay={0.1}>
            <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3">
              <button type="button" onClick={() => setDoor('code')}
                className="tw:cursor-pointer tw:rounded-full tw:border-0 tw:bg-brand tw:px-7 tw:py-3.5 tw:text-base tw:font-semibold tw:text-white">
                I have a code
              </button>
              <button type="button" onClick={() => setDoor('waitlist')}
                className="tw:cursor-pointer tw:rounded-full tw:border tw:border-line tw:bg-white tw:px-7 tw:py-3.5 tw:text-base tw:font-semibold tw:text-ink">
                Join the waitlist
              </button>
            </div>
            <p className="tw:mt-6 tw:mb-0 tw:text-center tw:text-sm tw:text-muted">
              Been here before? <Link href="/sign-in" className="tw:text-brand-mid">Sign in</Link>
            </p>
            <p className="tw:mt-10 tw:mb-0 tw:text-center tw:text-xs tw:text-muted">
              <Link href="/privacy" className="tw:text-muted">Privacy</Link>
              {' · '}
              <Link href="/terms" className="tw:text-muted">Terms</Link>
            </p>
          </Reveal>
        </Section>
      </main>

      <Doors open={door} onClose={() => setDoor(null)} />
    </>
  );
}

// Stands in for a visual that is not built yet, and says which one, so an
// unfinished page reads as unfinished rather than as broken.
function Placeholder({ id }) {
  return (
    <Reveal delay={0.1}>
      <div className="tw:flex tw:h-[clamp(240px,38vh,380px)] tw:items-center tw:justify-center tw:rounded-2xl tw:border tw:border-dashed tw:border-line tw:bg-white/60">
        <p className="tw:m-0 tw:text-sm tw:text-muted">{id} visual</p>
      </div>
    </Reveal>
  );
}
