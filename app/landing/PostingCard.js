'use client';

// One posting, as a miniature of its page.
//
// Shared, because sections one and two are the same object at two densities:
// a few of them scattered, then a wall of them. Drawing that twice would let
// the two drift apart, and the whole point of the second section is that it
// is more of the first.
//
// Everything below the role is optional and most postings have only some of
// it. That is deliberate: the tell of a fake screenshot is that every card
// carries the same fields, and a real board never does. One posting shows a
// salary, the next has been up nine days with two hundred applicants, the one
// after that says nothing.

// Two shapes each, drawn rather than copied, because the employers are
// invented and a real mark would imply a real customer.
export function Logo({ logo, firm }) {
  if (!logo) {
    // Plenty of postings have no mark at all, just the monogram a board draws
    // for them.
    return (
      <span className="tw:flex tw:h-7 tw:w-7 tw:flex-none tw:items-center tw:justify-center tw:rounded tw:bg-sand tw:text-[11px] tw:font-bold tw:text-muted">
        {firm[0]}
      </span>
    );
  }
  return (
    <span
      className="tw:flex tw:h-7 tw:w-7 tw:flex-none tw:items-center tw:justify-center tw:rounded"
      style={{ background: logo.bg }}
    >
      <svg viewBox="0 0 24 24" className="tw:h-3.5 tw:w-3.5" fill="none" aria-hidden>
        {logo.glyph === 'chevron' && (
          <path d="M5 16l7-8 7 8" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {logo.glyph === 'rings' && (
          <>
            <circle cx="9.5" cy="12" r="5.5" stroke="#fff" strokeWidth="2.2" />
            <circle cx="15.5" cy="12" r="5.5" stroke="#fff" strokeWidth="2.2" opacity="0.55" />
          </>
        )}
        {logo.glyph === 'square' && (
          <>
            <rect x="4" y="4" width="9" height="9" rx="1.5" fill="#fff" />
            <rect x="11" y="11" width="9" height="9" rx="1.5" fill="#fff" opacity="0.55" />
          </>
        )}
        {logo.glyph === 'triangle' && (
          <path d="M12 4l8 15H4z" fill="#fff" />
        )}
      </svg>
    </span>
  );
}

export default function PostingCard({ card, compact = false }) {
  const pad = compact ? 'tw:p-2.5' : 'tw:p-3';
  const gap = compact ? 'tw:mt-2' : 'tw:mt-2.5';

  return (
    <article className={`tw:overflow-hidden tw:rounded-xl tw:border tw:border-line tw:bg-white ${
      compact ? 'tw:w-56 tw:shadow-md tw:shadow-ink/5' : 'tw:w-full tw:shadow-xl tw:shadow-ink/5 tw:md:w-[17rem]'
    }`}>
      <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-line tw:bg-paper tw:px-2.5 tw:py-2">
        <span className="tw:flex tw:gap-1" aria-hidden>
          <i className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-line" />
          <i className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-line" />
          <i className="tw:block tw:h-1.5 tw:w-1.5 tw:rounded-full tw:bg-line" />
        </span>
        <span className="tw:truncate tw:rounded tw:bg-white tw:px-2 tw:py-0.5 tw:text-[9px] tw:text-muted">
          {card.url}
        </span>
      </div>

      <div className={pad}>
        {card.promoted && (
          <p className="tw:m-0 tw:mb-1.5 tw:text-[9px] tw:font-semibold tw:uppercase tw:tracking-[0.07em] tw:text-muted">
            Promoted
          </p>
        )}

        <div className="tw:flex tw:items-start tw:gap-2">
          <Logo logo={card.logo} firm={card.firm} />
          <div className="tw:min-w-0">
            <p className="tw:m-0 tw:truncate tw:text-[12.5px] tw:font-semibold tw:leading-snug tw:text-ink">
              {card.role}
            </p>
            <p className="tw:mt-0.5 tw:mb-0 tw:flex tw:items-center tw:gap-1 tw:truncate tw:text-[11px] tw:text-muted">
              <span className="tw:truncate">{card.firm}</span>
              {card.verified && (
                <svg viewBox="0 0 24 24" className="tw:h-2.5 tw:w-2.5 tw:flex-none tw:text-brand-mid" aria-hidden>
                  <path d="M12 2l2.4 1.8 3 .2.6 2.9 2.2 2-1.4 2.6 1.4 2.6-2.2 2-.6 2.9-3 .2L12 22l-2.4-1.8-3-.2-.6-2.9-2.2-2L5.2 12 3.8 9.4l2.2-2 .6-2.9 3-.2z" fill="currentColor" />
                  <path d="M8.6 12.2l2.2 2.2 4.4-4.6" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </p>
            <p className="tw:mt-0.5 tw:mb-0 tw:truncate tw:text-[10.5px] tw:text-muted">{card.where}</p>
          </div>
        </div>

        {card.pay && (
          <p className="tw:mt-2 tw:mb-0 tw:text-[11px] tw:font-semibold tw:text-ink">{card.pay}</p>
        )}

        <div className="tw:mt-1.5 tw:flex tw:flex-wrap tw:gap-1">
          {card.chips.map((c) => (
            <span key={c} className="tw:rounded-full tw:bg-tint tw:px-1.5 tw:py-0.5 tw:text-[9px] tw:font-semibold tw:text-brand">
              {c}
            </span>
          ))}
        </div>

        {/* The description, as the shape of text rather than text. Real
            sentences at this size are unreadable and pull the eye into
            trying anyway. */}
        <div className={`tw:flex tw:flex-col tw:gap-1.5 ${gap}`} aria-hidden>
          {card.lines.map((w, i) => (
            <i key={i} className="tw:block tw:h-1 tw:rounded-full tw:bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>

        {(card.posted || card.applicants || card.deadline) && (
          <p className="tw:mt-2 tw:mb-0 tw:truncate tw:text-[9.5px] tw:text-muted">
            {[card.posted, card.applicants, card.deadline].filter(Boolean).join(' · ')}
          </p>
        )}

        <div className={`tw:flex tw:items-center tw:gap-2 ${compact ? 'tw:mt-2.5' : 'tw:mt-3'}`}>
          <span className={`tw:rounded-md tw:px-2 tw:py-1 tw:text-[9px] tw:font-semibold ${
            card.apply === 'Apply on company site'
              ? 'tw:border tw:border-line tw:text-ink-2'
              : 'tw:bg-brand tw:text-white'
          }`}>
            {card.apply ?? 'Apply'}
          </span>
          <i className="tw:block tw:h-1 tw:w-8 tw:rounded-full tw:bg-line" aria-hidden />
        </div>
      </div>
    </article>
  );
}
