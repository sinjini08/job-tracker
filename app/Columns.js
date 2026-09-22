'use client';

import { useEffect, useState } from 'react';
import { ALWAYS_ON } from '@/lib/fields';

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

export default function Columns({ sheet, all, custom, hidden, onToggle, onShowAll, onAdd, onRemove, onClose }) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const off = new Set(hidden);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (fn) => {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const mine = new Set(custom.map((c) => c.id));
  const shown = all.length - off.size;

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer cols-drawer" aria-label="Choose columns">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">Columns</div>
            <div className="drawer-sub">{shown} of {all.length} showing on {sheet}</div>
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          {err && <p className="drawer-err">{err}</p>}

          <ul className="col-list">
            {all.map((col) => {
              const locked = ALWAYS_ON.has(col.id);
              const on = !off.has(col.id);
              return (
                <li key={col.id} className={on ? '' : 'off'}>
                  <label>
                    <input type="checkbox" checked={on} disabled={locked}
                      onChange={() => onToggle(col.id, !on)} />
                    <span className="colpick-label">
                      {col.label}
                      {mine.has(col.id) && <span className="col-tag">yours</span>}
                      {locked && <span className="col-tag muted-tag">always on</span>}
                    </span>
                  </label>
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
            <button className="viz-toggle" onClick={onShowAll} disabled={off.size === 0}>
              Show all
            </button>
            {!adding && (
              <button className="btn primary" onClick={() => setAdding(true)}>+ Add a column</button>
            )}
          </div>

          <p className="league-fine">
            Hiding a column only hides it. Whatever you typed stays on the row and comes back
            when you switch the column on again.
          </p>

          {adding && (
            <AddColumn sheet={sheet} busy={busy} onCancel={() => setAdding(false)}
              onSave={(def) => run(async () => { await onAdd(def); setAdding(false); })} />
          )}
        </div>
      </aside>
    </>
  );
}

function AddColumn({ sheet, busy, onSave, onCancel }) {
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
          <option value="both">Both sheets</option>
          <option value="On-Campus">On-Campus only</option>
          <option value="Off-Campus">Off-Campus only</option>
        </select>
      </label>

      <div className="col-actions">
        <button className="btn primary" type="submit" disabled={busy || !label.trim()}>Add column</button>
        <button className="viz-toggle" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
