'use client';

// The window the recreations sit in.
//
// Both demos are "here is the app, doing the thing", and both need the same
// chrome around them or the page looks like two unrelated screenshots.
export default function Frame({ label, children, className = '' }) {
  return (
    <div className={`tw:overflow-hidden tw:rounded-2xl tw:border tw:border-line tw:bg-white tw:shadow-2xl tw:shadow-ink/10 ${className}`}>
      <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-line tw:bg-paper tw:px-3 tw:py-2.5">
        <span className="tw:flex tw:gap-1.5" aria-hidden>
          <i className="tw:block tw:h-2 tw:w-2 tw:rounded-full tw:bg-line" />
          <i className="tw:block tw:h-2 tw:w-2 tw:rounded-full tw:bg-line" />
          <i className="tw:block tw:h-2 tw:w-2 tw:rounded-full tw:bg-line" />
        </span>
        <span className="tw:text-[11px] tw:text-muted">{label}</span>
      </div>
      {children}
    </div>
  );
}
