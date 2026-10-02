'use client';

import { useInView } from 'motion/react';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { byId } from './copy';

// The last screen, and the only one that is not on paper.
//
// It is the opening animation again, played where somebody has just read the
// whole argument: the mark draws itself, the dart lands, and the ask is
// underneath it. The green is the app's own, so the last thing seen here is
// the first thing seen after signing in.
//
// The mark is the real artwork and the real keyframes from the opening, not a
// copy: the same three pieces out of public/brand and the same .sp-* classes
// out of globals.css, which run on mount. Replaying on every visit is
// therefore a remount, which is what the `key` below is for.

export default function CloseHero({ onInView }) {
  const wrap = useRef(null);
  const copy = byId('close');

  // Two thresholds on the same section, because the two things it drives want
  // different moments.
  //
  // The mark starts as soon as a fifth of the section is showing, which is
  // partway through the scroll out of the league rather than once you have
  // arrived: waiting until the section was mostly on screen meant the dart
  // landed after you had already stopped.
  const marking = useInView(wrap, { amount: 0.2 });

  // The header waits until you are actually here, so it does not vanish while
  // you are still reading the section above.
  const here = useInView(wrap, { amount: 0.55 });
  useEffect(() => { onInView?.(here); }, [here, onInView]);

  return (
    <section
      id="close"
      ref={wrap}
      className="tw:relative tw:flex tw:min-h-[100svh] tw:w-full tw:flex-col tw:items-center tw:justify-center tw:gap-7 tw:overflow-hidden tw:px-6 tw:py-24 tw:text-center"
      style={{
        background:
          'radial-gradient(105% 80% at 50% 45%, #2e7d46 0%, #1d5c36 52%, #14472a 100%)',
      }}
    >
      {/* The soft light behind the mark, over the gradient rather than in it,
          so it can be centred on the mark instead of on the section. */}
      <span
        aria-hidden
        className="tw:pointer-events-none tw:absolute tw:left-1/2 tw:top-[38%] tw:h-[min(46rem,90vw)] tw:w-[min(46rem,90vw)] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 62%)' }}
      />

      {marking && (
        <div key="mark" className="splash-mark tw:relative tw:z-10">
          <div className="sp-stack">
            <span className="sp-flash" />
            <span className="sp-ring" />
            <img className="sp-dart" src="/brand/splash-dart.png" alt="" draggable={false} />
            <img className="sp-dot" src="/brand/splash-dot.png" alt="" draggable={false} />
            <img className="sp-rings" src="/brand/splash-rings.png" alt="" draggable={false} />
          </div>
        </div>
      )}

      <div className="tw:relative tw:z-10 tw:max-w-3xl">
        <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:font-bold tw:text-[clamp(2.1rem,6vw,4rem)] tw:leading-[1.04] tw:tracking-[-0.035em] tw:text-white tw:text-balance">
          {copy.head}
        </h2>
        <p className="tw:mx-auto tw:mt-5 tw:mb-0 tw:max-w-xl tw:text-[clamp(1rem,1.7vw,1.2rem)] tw:leading-relaxed tw:text-white/75 tw:text-balance">
          {copy.sub}
        </p>
      </div>

      <div className="tw:relative tw:z-10 tw:flex tw:flex-wrap tw:items-center tw:justify-center tw:gap-3">
        <Link href="/sign-up"
          className="tw:rounded-full tw:bg-white tw:px-7 tw:py-3.5 tw:text-base tw:font-bold tw:text-brand tw:no-underline">
          Get started free
        </Link>
      </div>

      <div className="tw:relative tw:z-10">
        <p className="tw:m-0 tw:text-sm tw:text-white/70">
          Been here before? <Link href="/sign-in" className="tw:text-white tw:underline tw:underline-offset-4">Sign in</Link>
        </p>
        <p className="tw:mt-8 tw:mb-0 tw:text-xs tw:text-white/55">
          <Link href="/privacy" className="tw:text-white/70">Privacy</Link>
          {' · '}
          <Link href="/terms" className="tw:text-white/70">Terms</Link>
        </p>
      </div>
    </section>
  );
}
