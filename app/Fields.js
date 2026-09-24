'use client';

import { useEffect, useState } from 'react';
import { fmtDate } from '@/lib/format';

// The editable details, shared by the drawer and by an expanded row.
//
// All of them save on blur rather than on keystroke, so typing a note is one
// request at the end instead of one per character, and a field the student is
// still in never fights them by re-rendering from the server underneath.

export function ShortField({ label, value, canEdit, onSave, type = 'text', hint, options }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const id = options ? `opts-${label.replace(/\W+/g, '-')}` : undefined;
  return (
    <label className="field" title={hint || ''}>
      <span>{label}</span>
      {canEdit ? (
        <>
          <input type={type} value={draft} list={id}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { if ((value ?? '') !== draft) onSave(draft); }} />
          {options && <datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist>}
        </>
      ) : (
        <div className="readonly-text">{(type === 'date' ? fmtDate(value) : value) || 'Not set'}</div>
      )}
    </label>
  );
}

export function LongField({ label, value, canEdit, onSave, rows }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      {canEdit ? (
        <textarea rows={rows} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if ((value ?? '') !== draft) onSave(draft); }} />
      ) : (
        <div className="readonly-text">{value || 'Nothing here yet'}</div>
      )}
    </label>
  );
}

// One of the student's own columns. Same save-on-blur, except a tick box,
// which has nothing to wait for.
export function CustomField({ def, value, canEdit, onSave }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);

  if (def.kind === 'bool') {
    return (
      <label className="field check-field">
        <span>{def.label}</span>
        <input type="checkbox" checked={Boolean(value)} disabled={!canEdit}
          onChange={(e) => onSave(e.target.checked)} />
      </label>
    );
  }

  const save = () => { if ((value ?? '') !== draft) onSave(draft === '' ? null : draft); };
  return (
    <label className="field">
      <span>{def.label}</span>
      {!canEdit ? (
        <div className="readonly-text">{value == null || value === '' ? 'Not set' : String(value)}</div>
      ) : def.kind === 'select' ? (
        <input list={`opts-${def.id}`} value={draft}
          onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      ) : (
        <input type={def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : 'text'}
          value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={save} />
      )}
      {def.kind === 'select' && (
        <datalist id={`opts-${def.id}`}>
          {(def.options ?? []).map((o) => <option key={o} value={o} />)}
        </datalist>
      )}
    </label>
  );
}
