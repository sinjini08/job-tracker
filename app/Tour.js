'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// The guided tour, shown once, straight after somebody has chosen their sheets.
//
// A tour that points at the interface is coupled to the interface, and this
// interface moves. Three things keep that from turning into a broken overlay:
//
//   Targets are found by data-tour, not by class name. A class is a styling
//   decision and gets renamed the moment something is restyled; data-tour is
//   a contract, and grepping for it finds every step that depends on it.
//
//   A step whose target is missing is skipped, not shown. Elements disappear
//   for real reasons: the view switcher is not in the DOM on a narrow window,
//   the sheet tabs are not there on Insights. The alternative is a spotlight
//   on empty space, which is worse than a shorter tour.
//
//   Nothing is measured until the element is on screen. Positions come from
//   getBoundingClientRect on every step and again on resize and scroll, rather
//   than being written down anywhere.
//
// If every step's target is missing, the tour does not run at all and marks
// itself done, so it cannot become a modal nobody can get out of.

const STEPS = [
  {
    // Both views carry this anchor, because only one of them is ever mounted
    // and the default is the list. Anchoring it to the grid alone dropped this
    // step for almost everybody, which the skip logic hid rather than reported.
    at: 'sheet',
    title: 'This is your sheet',
    body: 'One row per application, and everything you type stays yours. Click a row to open it up, or a cell to edit it, depending on the view.',
  },
  {
    at: 'new-row',
    title: 'Add one by hand',
    body: 'Or let an assistant do it. Paste a job posting into Claude or ChatGPT and it fills the row in for you, which is the last step of this tour.',
  },
  {
    at: 'view',
    title: 'Two ways to look at it',
    body: 'Grid is the spreadsheet. List gives every application a soft row that opens up when you click it, with room for notes, contacts and the posting itself.',
  },
  {
    at: 'sections',
    title: 'Insights and League',
    body: 'Insights turns the sheet into charts and tells you what needs chasing. League is for keeping score with friends, and never shows them where you applied.',
  },
  {
    at: 'sheets',
    title: 'Your sheets live down here',
    body: 'Switch between them, or add one of your own in Settings. Campus jobs and graduate applications do not have to share a list.',
  },
  {
    at: 'settings',
    title: 'Connect an assistant',
    body: 'In Settings. Link the tracker to Claude or ChatGPT and you can paste a posting into a chat and have it filed for you, statuses and all.',
  },
];

const GAP = 12;        // between the spotlight and the card
const PAD = 6;         // how far the spotlight sits outside its target

export default function Tour({ onDone }) {
  const [live, setLive] = useState(null);   // the steps whose targets exist
  const [i, setI] = useState(0);
  const [box, setBox] = useState(null);
  const [cardH, setCardH] = useState(200);
  const card = useRef(null);

  // Worked out once, on mount, after the sheet has painted. A step whose
  // target is not in the DOM is dropped here rather than handled later.
  useEffect(() => {
    const found = STEPS.filter((s) => document.querySelector(`[data-tour="${s.at}"]`));
    if (!found.length) { onDone(); return; }
    setLive(found);
  }, [onDone]);

  const step = live?.[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.at}"]`);
    // It was there when the tour started and has gone since: skip rather than
    // stall, which is what happens if a step is reached after a resize.
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    measure();
    const el = document.querySelector(`[data-tour="${step?.at}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [measure, step]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  const last = live ? i === live.length - 1 : false;
  const next = useCallback(() => (last ? onDone() : setI((n) => n + 1)), [last, onDone]);
  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onDone(); }
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [next, back, onDone]);

  useEffect(() => { card.current?.focus(); }, [i]);

  // The card's own height, measured rather than guessed, because where it can
  // go depends on how tall it is and the copy is not all one length.
  useLayoutEffect(() => {
    const h = card.current?.offsetHeight;
    if (h && h !== cardH) setCardH(h);
  }, [i, box, cardH]);

  if (!live || !step) return null;

  // Below the target if it fits, above if that fits instead, and clamped into
  // the window if neither does.
  //
  // That last case is not hypothetical: the first step points at the whole
  // sheet, which is taller than the window, so there is no room on either
  // side of it. Without the clamp the card was positioned off the top of the
  // screen and its text was cut in half.
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const CARD_W = 340;

  let top;
  if (!box) {
    top = Math.max(GAP, (vh - cardH) / 2);
  } else if (vh - (box.top + box.height) > cardH + GAP * 2) {
    top = box.top + box.height + GAP;          // below
  } else if (box.top > cardH + GAP * 2) {
    top = box.top - GAP - cardH;               // above
  } else {
    top = Math.max(GAP, (vh - cardH) / 2);     // over it, centred
  }
  const style = {
    top: Math.max(GAP, Math.min(top, vh - cardH - GAP)),
    left: box
      ? Math.max(GAP, Math.min(box.left, vw - CARD_W - GAP))
      : Math.max(GAP, (vw - CARD_W) / 2),
  };

  return (
    <div className="tour" role="presentation">
      {/* The dimming and the hole in it are one element: a ring shadow big
          enough to cover the window, cast outward from the target's rectangle.
          No mask, no second overlay, and the target stays visible and crisp. */}
      {box && (
        <div className="tour-spot" style={{
          top: box.top - PAD, left: box.left - PAD,
          width: box.width + PAD * 2, height: box.height + PAD * 2,
        }} />
      )}
      {!box && <div className="tour-dim" />}

      <div className="tour-card" style={style} ref={card} tabIndex={-1}
        role="dialog" aria-modal="true" aria-labelledby="tour-title">
        <p className="tour-count">{i + 1} of {live.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p className="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={onDone}>
            {last ? '' : 'Skip'}
          </button>
          <div className="tour-move">
            {i > 0 && <button type="button" className="btn ghost-dark" onClick={back}>Back</button>}
            <button type="button" className="btn primary" onClick={next} autoFocus>
              {last ? 'Start using it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
