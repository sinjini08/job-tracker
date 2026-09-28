'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Logo from '../Logo';

// Always reachable, because the page is seven screens long and someone can be
// convinced at any one of them. Having to scroll back to the top, or all the
// way to the bottom, to act on that is how you lose them.
//
// Transparent over the first screen and frosted once you have left it, so it
// does not sit as a bar across the opening. It slides away entirely on the
// last screen, which is the opening animation again and wants the top of the
// window to itself; the same two buttons are in the middle of that section.
export default function Header({ onOpen, hidden = false }) {
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const onScroll = () => setMoved(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`tw:fixed tw:inset-x-0 tw:top-0 tw:z-40 tw:transition tw:duration-300 ${
        moved ? 'tw:bg-paper/80 tw:backdrop-blur-md tw:border-b tw:border-line' : 'tw:border-b tw:border-transparent'
      } ${hidden ? 'tw:pointer-events-none tw:-translate-y-full tw:opacity-0' : ''}`}
    >
      <div className="tw:mx-auto tw:flex tw:max-w-6xl tw:items-center tw:gap-3 tw:px-5 tw:py-3.5">
        <span className="tw:flex tw:items-center tw:gap-2.5 tw:text-ink">
          <Logo size={26} />
          <span className="tw:hidden tw:font-[family-name:var(--landing-display)] tw:text-[15px] tw:font-semibold tw:tracking-[-0.01em] tw:sm:inline">
            Job Application Tracker
          </span>
        </span>

        <span className="tw:flex-1" />

        <Link href="/sign-in"
          className="tw:hidden tw:text-sm tw:text-muted tw:no-underline tw:hover:text-ink tw:sm:inline">
          Sign in
        </Link>
        <button type="button" onClick={() => onOpen('waitlist')}
          className="tw:cursor-pointer tw:rounded-full tw:border tw:border-line tw:bg-white tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-ink">
          <span className="tw:sm:hidden">Waitlist</span>
          <span className="tw:hidden tw:sm:inline">Join the waitlist</span>
        </button>
        <button type="button" onClick={() => onOpen('code')}
          className="tw:cursor-pointer tw:rounded-full tw:border-0 tw:bg-brand tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-white">
          I have a code
        </button>
      </div>
    </header>
  );
}
