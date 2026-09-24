'use client';

import { useEffect, useRef, useState } from 'react';
import { ALWAYS_ON, ROW_ORDER, SHEET_KEYS, sheetLabel } from '@/lib/fields';

// Choose which columns this sheet shows, and add columns of your own.
//
// Hiding a column never deletes anything: the value stays on the row and
// comes back the moment the column does. Deleting a column you added is the
// only thing here that loses data, so it asks first.

const KINDS = [
  { id: 'text', label: 'Text' },
  { id: 'number', label: 'Number' },
  { id: 'date', label: 'Date' },
  { id: 'bool', label: 'Tick box' },
  { id: 'select', label: 'Pick from a list' },
];

export default function Columns({ sheet, all, custom, hidden, listView, rowKeys, sheets = SHEET_KEYS, names = {}, onToggle, onRowToggle, onReorder, onShowAll, onAdd, onRemove, onClose }) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const off = new Set(hidden);

  // Dragging, driven by pointer events rather than HTML5 drag and drop.
  //
  // HTML5 DnD hands the OS a ghost image and destroys it the instant you let
  // go, so the thing under your cursor disappears and a different thing
  // appears somewhere else. That cut is what kept reading as wrong, and no
  // amount of animating around it helps, because the jump belongs to the
  // browser rather than to us.
  //
  // Here the real row follows your finger, the rows it passes part to open a
  // gap, and on release it travels into that gap and stops. The reorder is
  // committed only once it has arrived, so the frame where the data changes
  // is a frame where nothing moves.
  const [drag, setDrag] = useState(null);   // { from, startY, tops, heights }
  const [dy, setDy] = useState(0);
  const [landing, setLanding] = useState(false);
  // One frame with transitions off, for the commit.
  const [snap, setSnap] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Where it would land right now, measured against the slots as they were
  // when the drag began, which is exactly what the parting rows are showing.
  const target = (() => {
    if (!drag) return null;
    const { from, tops, heights } = drag;
    const mid = tops[from] + heights[from] / 2 + dy;
    let to = from;
    while (to + 1 < tops.length && mid > tops[to + 1] + heights[to + 1] / 2) to += 1;
    while (to - 1 >= 0 && mid < tops[to - 1] + heights[to - 1] / 2) to -= 1;
    return to;
  })();

  // How far the dragged row must travel to sit in that slot, and how far each
  // row it passes moves aside.
  //
  // Both are measured from `tops`, the actual laid-out positions, not summed
  // from heights. The list has a 2px gap between rows, so a sum of heights is
  // short by 2px per row crossed: the landing would ease to almost the right
  // place and then the commit would snap it the rest of the way. That snap was
  // half the shuffle. Whatever the row lands on has to be the post-reorder
  // position exactly, or the commit is visible.
  //
  // Taking out the held row and putting it back at `target` leaves it at
  // tops[target] either way, up or down, which makes this a subtraction.
  const pitch = drag && drag.tops.length > 1 ? drag.tops[1] - drag.tops[0] : 0;
  const restingDy = !drag || target === drag.from ? 0 : drag.tops[target] - drag.tops[drag.from];

  const shiftOf = (i) => {
    if (!drag || target == null || i === drag.from) return 0;
    if (target > drag.from && i > drag.from && i <= target) return -pitch;
    if (target < drag.from && i >= target && i < drag.from) return pitch;
    return 0;
  };

  const startDrag = (e, i) => {
    if (e.button != null && e.button !== 0) return;
    const rows = [...(listRef.current?.children ?? [])];
    if (!rows.length) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDrag({
      from: i,
      startY: e.clientY,
      // offsetTop, not getBoundingClientRect: a rect includes the transforms
      // this very feature applies, so a measurement taken mid-drag reads its
      // own animation back as layout.
      tops: rows.map((li) => li.offsetTop),
      heights: rows.map((li) => li.offsetHeight),
    });
    setDy(0);
  };

  const moveDrag = (e) => { if (drag && !landing) setDy(e.clientY - drag.startY); };

  const endDrag = () => {
    if (!drag || landing) return;
    if (target === drag.from) { setDrag(null); setDy(0); return; }
    const ids = all.map((c) => c.id);
    const [moved] = ids.splice(drag.from, 1);
    ids.splice(target, 0, moved);
    // Travel into the gap, then commit once it is there.
    setLanding(true);
    setDy(restingDy);
    window.setTimeout(() => {
      // Transitions OFF for this one render. At the commit the row moves to
      // its new slot in the DOM and its transform drops away at the same
      // moment; those cancel out to no visible change, but only if the
      // transform drops instantly. Left transitioned, it animates from
      // (new position - the whole distance already travelled) back down, and
      // the row you just placed slides in a second time. That was the
      // shuffle.
      setSnap(true);
      onReorder(ids);
      setDrag(null);
      setDy(0);
      setLanding(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false)));
    }, 170);
  };

  // The keyboard path. Nothing to travel, so it commits straight away.
  const move = (from, to) => {
    if (from === to || from == null || to == null || to < 0 || to >= all.length) return;
    const ids = all.map((c) => c.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  };

  const onHandleKey = (e, i) => {
    const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
    if (to == null) return;
    e.preventDefault();
    move(i, to);
    requestAnimationFrame(() => {
      document.querySelectorAll('.col-grip')[Math.max(0, Math.min(all.length - 1, to))]?.focus();
    });
  };

  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const mine = new Set(custom.map((c) => c.id));
  const shown = all.length - off.size;
  // In list view a column has two homes rather than one: on the row, or in
  // the details under it. Nothing is hidden by that second choice, so it is a
  // separate control from the checkbox.
  const onRow = new Set(rowKeys ?? []);
  const canSitOnRow = (col) => ROW_ORDER.includes(col.key);

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer cols-drawer" aria-label="Choose columns">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">Columns</div>
            <div className="drawer-sub">
              {listView
                ? `${onRow.size} on the row, the rest in the details · ${sheetLabel(sheet, names)}`
                : `${shown} of ${all.length} showing on ${sheetLabel(sheet, names)}`}
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          {err && <p className="drawer-err">{err}</p>}

          <ul ref={listRef} className={`col-list ${drag ? 'lifting' : ''} ${snap ? 'snap' : ''}`}>
            {all.map((col, i) => {
              const locked = ALWAYS_ON.has(col.id);
              const on = !off.has(col.id);
              const held = drag?.from === i;
              return (
                <li key={col.id}
                  className={[on ? '' : 'off', held ? 'held' : ''].filter(Boolean).join(' ')}
                  style={drag ? {
                    transform: `translateY(${held ? dy : shiftOf(i)}px)`,
                    // The held row tracks the finger with no easing. It only
                    // eases on the way into the gap.
                    transition: held && !landing ? 'none' : undefined,
                  } : undefined}>
                  {/* A button, so the order can be changed from a keyboard
                      too: a pointer drag has no keyboard equivalent. */}
                  <button type="button" className="col-grip"
                    aria-label={`Move ${col.label}. Use the up and down arrows.`}
                    onPointerDown={(e) => startDrag(e, i)}
                    onPointerMove={moveDrag}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={(e) => onHandleKey(e, i)}>
                    <svg viewBox="0 0 10 16" aria-hidden>
                      <circle cx="3" cy="3" r="1.2" /><circle cx="7" cy="3" r="1.2" />
                      <circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" />
                      <circle cx="3" cy="13" r="1.2" /><circle cx="7" cy="13" r="1.2" />
                    </svg>
                  </button>
                  {/* One question per view. The grid asks show or hide; the
                      list asks row or details, where nothing is ever hidden.
                      Offering both in one panel was what tied the two views
                      to each other. */}
                  {listView ? (
                    <span className="colpick-label plain">
                      {col.label}
                      {mine.has(col.id) && <span className="col-tag">yours</span>}
                    </span>
                  ) : (
                    <label>
                      <input type="checkbox" checked={on} disabled={locked}
                        onChange={() => onToggle(col.id, !on)} />
                      <span className="colpick-label">
                        {col.label}
                        {mine.has(col.id) && <span className="col-tag">yours</span>}
                        {locked && <span className="col-tag muted-tag">always on</span>}
                      </span>
                    </label>
                  )}
                  {/* Role and Company are the row's name: one over the
                      other in the first cell. Neither is a choice, and
                      showing Company as "in details" was simply wrong. */}
                  {listView && (locked || col.key === 'company' ? (
                    <span className="rowpin fixed">Always on the row</span>
                  ) : canSitOnRow(col) ? (
                    <button className={`rowpin ${onRow.has(col.key) ? 'on' : ''}`}
                      aria-pressed={onRow.has(col.key)}
                      title={onRow.has(col.key)
                        ? 'On the row. Click to move it into the details instead.'
                        : 'In the details. Click to put it on the row.'}
                      onClick={() => onRowToggle(col.key, !onRow.has(col.key))}>
                      {onRow.has(col.key) ? 'On the row' : 'In details'}
                    </button>
                  ) : (
                    <span className="rowpin fixed">In details</span>
                  ))}
                  {mine.has(col.id) && (
                    <button className="viz-toggle" disabled={busy}
                      onClick={() => {
                        if (!confirm(`Delete the “${col.label}” column? What you typed in it goes too.`)) return;
                        run(() => onRemove(col.id));
                      }}>
                      Delete
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="col-actions">
            {!listView && (
              <button className="viz-toggle" onClick={onShowAll} disabled={off.size === 0}>
                Show all
              </button>
            )}
            {!adding && (
              <button className="btn primary" onClick={() => setAdding(true)}>+ Add a column</button>
            )}
          </div>

          <p className="league-fine">
            Drag a column by its handle to move it, or focus the handle and use the up and down
            arrows.
            {listView
              ? ' Nothing is hidden here. A column not on the row is in the panel that opens when you click one, and this choice is the list\u2019s own: what the grid shows is set separately, in grid view.'
              : ' The one at the top is the column the grid freezes on the left. Hiding a column only hides it: whatever you typed stays on the row and comes back when you switch it on again. This choice is the grid\u2019s own, and does not change the list.'}
          </p>

          {adding && (
            <AddColumn sheet={sheet} sheets={sheets} names={names} busy={busy}
              onCancel={() => setAdding(false)}
              onSave={(def) => run(async () => { await onAdd(def); setAdding(false); })} />
          )}
        </div>
      </aside>
    </>
  );
}

function AddColumn({ sheet, sheets, names, busy, onSave, onCancel }) {
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState('text');
  const [applies, setApplies] = useState('both');
  const [options, setOptions] = useState('');

  return (
    <form className="add-col" onSubmit={(e) => { e.preventDefault(); onSave({ label, kind, applies, options }); }}>
      <h3>A column of your own</h3>

      <label className="field">
        <span>Name</span>
        <input value={label} maxLength={40} autoFocus placeholder="Referral name, Visa sponsor, Notes to self"
          onChange={(e) => setLabel(e.target.value)} />
      </label>

      <label className="field">
        <span>Holds</span>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>

      {kind === 'select' && (
        <label className="field">
          <span>The list, separated by commas</span>
          <input value={options} placeholder="Yes, No, Waiting to hear"
            onChange={(e) => setOptions(e.target.value)} />
        </label>
      )}

      <label className="field">
        <span>Show it on</span>
        <select value={applies} onChange={(e) => setApplies(e.target.value)}>
          {sheets.length > 1 && <option value="both">Every sheet</option>}
          {sheets.map((k) => (
            <option key={k} value={k}>{sheetLabel(k, names)} only</option>
          ))}
        </select>
      </label>

      <div className="col-actions">
        <button className="btn primary" type="submit" disabled={busy || !label.trim()}>Add column</button>
        <button className="viz-toggle" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
