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
// window to itself; the same button is in the middle of that section.
export default function Header({ hidden = false }) {
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
      {/* Full width rather than a centred column. On a wide screen a 6xl
          container left the name floating in from the edge with nothing to
          its left; the brand belongs in the corner. */}
      <div className="tw:flex tw:items-center tw:gap-3 tw:px-6 tw:py-3.5 tw:lg:px-10 tw:xl:px-14">
        <span className="tw:flex tw:items-center tw:gap-2.5 tw:text-ink">
          {/* tone="dark" is the green mark. The default is the white one,
              which on paper is an invisible 26px of nothing, which is why
              the header looked like it had no logo at all. */}
          <Logo size={26} tone="dark" />
          {/* Set in the interface font, like the buttons beside it, not in
              the display face. The display face is for the headlines; a
              wordmark in it competes with them. */}
          <span className="tw:hidden tw:text-[15px] tw:font-semibold tw:tracking-[-0.01em] tw:sm:inline">
            Job Application Tracker
          </span>
        </span>

        <span className="tw:flex-1" />

        {/* One way in. Sign-up is open, so there is no waitlist to join and
            no code to have: the only decision left is new or returning. */}
        <Link href="/sign-in"
          className="tw:px-1 tw:py-2 tw:text-sm tw:text-muted tw:no-underline tw:hover:text-ink">
          Sign in
        </Link>
        <Link href="/sign-up"
          className="tw:rounded-full tw:bg-brand tw:px-4 tw:py-2 tw:text-sm tw:font-semibold tw:text-white tw:no-underline">
          <span className="tw:sm:hidden">Get started</span>
          <span className="tw:hidden tw:sm:inline">Get started free</span>
        </Link>
      </div>
    </header>
  );
}
