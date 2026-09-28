'use client';

// One posting, as a miniature of its page.
//
// Shared, because sections one and two are the same object at two densities:
// a few of them scattered, then a wall of them. Drawing that twice would let
// the two drift apart, and the whole point of the second section is that it
// is more of the first.
export default function PostingCard({ card, compact = false }) {
  return (
    <article className={`tw:overflow-hidden tw:rounded-xl tw:border tw:border-line tw:bg-white ${
      compact ? 'tw:w-52 tw:shadow-md tw:shadow-ink/5' : 'tw:w-full tw:shadow-xl tw:shadow-ink/5 tw:md:w-[17rem]'
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

      <div className={compact ? 'tw:p-2.5' : 'tw:p-3'}>
        <p className="tw:m-0 tw:truncate tw:text-[12.5px] tw:font-semibold tw:leading-snug tw:text-ink">{card.role}</p>
        <p className="tw:mt-0.5 tw:mb-0 tw:truncate tw:text-[11px] tw:text-muted">{card.firm} · {card.where}</p>

        <div className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-1">
          {card.chips.map((c) => (
            <span key={c} className="tw:rounded-full tw:bg-tint tw:px-1.5 tw:py-0.5 tw:text-[9px] tw:font-semibold tw:text-brand">
              {c}
            </span>
          ))}
        </div>

        {/* The description, as the shape of text rather than text. Real
            sentences at this size are unreadable and pull the eye into
            trying anyway. */}
        <div className={`tw:flex tw:flex-col tw:gap-1.5 ${compact ? 'tw:mt-2' : 'tw:mt-2.5'}`} aria-hidden>
          {card.lines.map((w, i) => (
            <i key={i} className="tw:block tw:h-1 tw:rounded-full tw:bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>

        <div className={`tw:flex tw:items-center tw:gap-2 ${compact ? 'tw:mt-2.5' : 'tw:mt-3'}`}>
          <span className="tw:rounded-md tw:bg-brand tw:px-2 tw:py-1 tw:text-[9px] tw:font-semibold tw:text-white">
            Apply
          </span>
          <i className="tw:block tw:h-1 tw:w-10 tw:rounded-full tw:bg-line" aria-hidden />
        </div>
      </div>
    </article>
  );
}
