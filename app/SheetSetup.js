'use client';

import { useState } from 'react';
import { SHEET_KEYS } from '@/lib/fields';

// Asked once, the first time someone opens the tracker.
//
// Two sheets called On-Campus and Off-Campus is the right shape for a student
// working a campus job alongside a graduate search, and the wrong shape for
// everyone else. Nothing is lost by choosing: the sheet is hidden, not
// deleted, and turning it back on in Settings brings back whatever was in it.

const CHOICES = [
  { id: 'both', keys: SHEET_KEYS, title: 'Both',
    hint: 'A sheet for campus jobs and a sheet for everything else. Pick this if you are enrolled at a university and also applying outside it.' },
  { id: 'off', keys: ['Off-Campus'], title: 'Just job applications',
    hint: 'One sheet for everything you apply to. The usual choice if you are not working on campus.' },
  { id: 'on', keys: ['On-Campus'], title: 'Just campus jobs',
    hint: 'One sheet, for roles within your university. Only if you are enrolled somewhere.' },
];

export default function SheetSetup({ onChoose }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const choose = async (keys) => {
    setBusy(true);
    setErr(null);
    try {
      await onChoose(keys);
    } catch (e) {
      setErr(e.message || 'Could not save that. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="setup" role="dialog" aria-modal="true" aria-labelledby="setup-title">
      <div className="setup-card">
        <h1 id="setup-title">How do you want your sheets?</h1>
        <p className="setup-sub">
          You can rename these later, turn the other one on, or add sheets of your own, all in Settings.
        </p>
        <div className="setup-choices">
          {CHOICES.map((c) => (
            <button key={c.id} className="setup-choice" disabled={busy}
              onClick={() => choose(c.keys)}>
              <b>{c.title}</b>
              <small>{c.hint}</small>
            </button>
          ))}
        </div>
        {err && <p className="setup-err" role="alert">{err}</p>}
      </div>
    </div>
  );
}
