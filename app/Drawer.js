'use client';

import { useEffect } from 'react';
import { SHEET_KEYS } from '@/lib/fields';
import { CHIP } from '@/lib/format';
import Details from './Details';

// The side panel. Everything inside it is <Details>, which the expanded row in
// the list view uses too, so the two can't drift into showing different things.

export default function Drawer({ row, apiBase = '/api', canEdit, custom = [],
  sheets = SHEET_KEYS, names = {}, onPatch, onDelete, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [bg, fg] = CHIP[row.status] || [];

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Application details">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{row.role || 'Untitled role'}</div>
            <div className="drawer-sub">
              {row.company || 'No company yet'}
              <span className="chip" style={{ background: bg, color: fg, marginLeft: 8 }}>{row.status}</span>
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="drawer-body">
          {/* No `fields`: the grid next to this already shows every column,
              so listing them again here is what made the drawer unfamiliar. */}
          <Details row={row} apiBase={apiBase} canEdit={canEdit} custom={custom}
            sheets={sheets} names={names} onPatch={onPatch} onDelete={onDelete} />
        </div>
      </aside>
    </>
  );
}
