'use client';

import Reveal from './Reveal';

// One screen of the story: the headline, its one explanatory line, and
// whatever the section shows underneath.
//
// Full height, because the page is read as seven deliberate stops rather than
// a continuous column of text. `min-h` rather than `h`, so a section whose
// visual is taller than the window grows instead of clipping.
export default function Section({ head, sub, children, id, wide = false }) {
  // A headline given as an array breaks where it was written to break. It
  // also needs more room and slightly less size, because the whole point is
  // that its longest part stays on one line: at the size a one-line headline
  // uses, it would not.
  const lines = Array.isArray(head) ? head : null;

  return (
    <section
      id={id}
      className="tw:relative tw:min-h-[100svh] tw:w-full tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-10 tw:px-6 tw:py-24 tw:overflow-hidden"
    >
      <header className={`tw:relative tw:z-10 tw:text-center ${lines ? 'tw:max-w-5xl' : 'tw:max-w-3xl'}`}>
        <Reveal>
          <h2 className={`tw:m-0 tw:font-[family-name:var(--landing-display)] tw:font-semibold tw:leading-[1.08] tw:tracking-[-0.03em] tw:text-ink ${
            lines
              ? 'tw:text-[clamp(1.7rem,3.6vw,2.7rem)]'
              : 'tw:text-[clamp(1.9rem,5vw,3.4rem)] tw:text-balance'
          }`}>
            {lines
              ? lines.map((line) => <span key={line} className="tw:block">{line}</span>)
              : head}
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="tw:mt-5 tw:mb-0 tw:text-[clamp(1rem,1.6vw,1.2rem)] tw:leading-relaxed tw:text-muted tw:text-balance">
            {sub}
          </p>
        </Reveal>
      </header>

      {children && (
        <div className={`tw:relative tw:z-10 tw:w-full ${wide ? 'tw:max-w-6xl' : 'tw:max-w-5xl'}`}>
          {children}
        </div>
      )}
    </section>
  );
}
