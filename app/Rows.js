'use client';

import { useState } from 'react';
import { CHIP, daysSince, fmtDate } from '@/lib/format';
import { rowColumnsFor } from '@/lib/fields';
import Details from './Details';

// The sheet, read as a list rather than a grid.
//
// The grid is still there and still the fastest way to enter ten applications
// in a row. This is the other half of the job: reading what you already have.
// The role leads, the employer sits under it, and the rest of the application
// is a click away underneath rather than off the right-hand edge.
//
// Deliberately not a <table>. Every row is a button with a panel under it, so
// the expand works from a keyboard and a screen reader, and the whole thing
// can become one column on a phone instead of scrolling sideways.

// Per field, so a date column doesn't get the same room as a pay range.
const WIDTH = {
  status: 118, date_applied: 92, next_follow_up: 108, deadline: 92, priority: 88,
  category: 108, term: 104, location: 'minmax(0, 1fr)', work_mode: 86, pay: 100,
  source: 104, resume_version: 96, referral: 84, cover_letter: 96,
  hours_per_week: 92, job_link: 'minmax(0, 1fr)', outreach_method: 104, days: 80,
};

// A date close enough to matter reads better as a distance than as a number.
// Only lateness is coloured: it is the only one of these that is a problem.
function whenChip(iso) {
  const ago = daysSince(iso);
  if (ago == null) return null;
  if (ago > 0) return { text: ago === 1 ? '1 day late' : `${ago} days late`, late: true };
  if (ago === 0) return { text: 'Today' };
  if (ago === -1) return { text: 'Tomorrow' };
  if (ago >= -7) return { text: `In ${-ago} days` };
  return null;
}

const Cell = ({ value }) => (
  <span className={`rowsv-c ${value ? '' : 'nil'}`}>{value || '—'}</span>
);

// One value on a row. Three shapes: a coloured badge where the value is a
// state, a distance where a date is close, plain text otherwise.
function RowCell({ col, row }) {
  const value = row[col.key];

  if (col.key === 'status' || col.key === 'priority') {
    const [bg, fg] = CHIP[value] ?? [];
    return (
      <span className="rowsv-c">
        {value
          ? <em className="rowsv-badge" style={{ background: bg, color: fg }}>{value}</em>
          : <span className="nil">—</span>}
      </span>
    );
  }

  if (col.key === 'next_follow_up') {
    const near = whenChip(value);
    return near
      ? <span className={`rowsv-c ${near.late ? 'late' : ''}`}>{near.text}</span>
      : <Cell value={fmtDate(value)} />;
  }

  if (col.kind === 'date') return <Cell value={fmtDate(value)} />;
  if (col.kind === 'bool') return <Cell value={value ? 'Yes' : ''} />;
  return <Cell value={value == null || value === '' ? '' : String(value)} />;
}

export default function Rows({ rows, columns, rowKeys, custom, canEdit, apiBase, sheets, names,
  sort, onSort, onPatch, onDelete, onNew, emptyNote }) {
  const [open, setOpen] = useState(null);

  // Company and location have a different column id on each sheet
  // (company_off, company_on), so a header here has to find the one this sheet
  // actually has before it can sort by it. They share a `key`, which is what
  // that is for.
  const sortId = (field) => (columns ?? []).find((c) => c.key === field)?.id ?? field;
  const sortedBy = (field) => sort?.key === sortId(field);

  // Whatever the student put on the row. No cap: taking the first six of a
  // sheet somebody set up deliberately is the app overruling them, and the
  // ones they chose are the ones they want to see.
  const shown = rowColumnsFor(columns, rowKeys);

  // Exactly what the row left out. The two halves of one choice, so nothing is
  // listed twice and nothing goes missing.
  const onRow = new Set(shown.map((c) => c.id));
  const offRow = (columns ?? []).filter((c) => !onRow.has(c.id) && c.id !== 'role'
    && c.key !== 'company' && !c.custom && c.kind !== 'computed');

  const style = {
    gridTemplateColumns: ['minmax(150px, 2.4fr)',
      ...shown.map((c) => (typeof WIDTH[c.key] === 'number' ? `${WIDTH[c.key]}px` : WIDTH[c.key] ?? '104px')),
      '18px'].join(' '),
  };

  if (!rows.length) {
    return (
      <div className="rowsv" data-tour="sheet">
        <p className="rowsv-empty">
          {emptyNote ?? 'Nothing on this sheet yet.'}
          {canEdit && onNew && <> <button type="button" className="ins-link" onClick={onNew}>Add the first one</button></>}
        </p>
      </div>
    );
  }

  return (
    <div className="rowsv" data-tour="sheet">
      <div className="rowsv-head" role="row" style={style}>
        <button type="button" className="rowsv-h grow" onClick={() => onSort(sortId('role'))}
          aria-sort={sortedBy('role') ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
          Role / Company
          {sortedBy('role') && <i aria-hidden>{sort.dir === 1 ? '↑' : '↓'}</i>}
        </button>
        {shown.map((c) => (
          <button key={c.id} type="button" className="rowsv-h" onClick={() => onSort(c.id)}
            aria-sort={sort?.key === c.id ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
            {c.label}
            {sort?.key === c.id && <i aria-hidden>{sort.dir === 1 ? '↑' : '↓'}</i>}
          </button>
        ))}
        <span className="rowsv-h end" aria-hidden />
      </div>

      <ul className="rowsv-list">
        {rows.map((row) => {
          const isOpen = open === row.id;
          return (
            <li key={row.id} className={isOpen ? 'on' : ''}>
              <button type="button" className="rowsv-row" aria-expanded={isOpen} style={style}
                onClick={() => setOpen(isOpen ? null : row.id)}>
                {/* No monogram square. It was standing in for a logo, and
                    there is no way to get one: the connector has no field to
                    put an image in, nothing here fetches one, and a favicon
                    service would mean telling a third party every employer a
                    student applies to. An initial in a box is not worth the
                    width it takes from the role. */}
                <span className="rowsv-who grow">
                  <span className="rowsv-names">
                    {/* Role leads: it is column A of the grid this sits beside
                        and it is what someone is looking for. The employer is
                        how you tell two of them apart. */}
                    <b>{row.role?.trim() || 'No role yet'}</b>
                    <small>{row.company?.trim() || 'No employer yet'}</small>
                  </span>
                </span>
                {/* display:contents on a wide screen, so these stay cells of
                    the row's own grid; a wrapping line of its own on a narrow
                    one. A real element, because positional selectors over mixed
                    children are a trap. */}
                <span className="rowsv-meta">
                  {shown.map((c) => <RowCell key={c.id} col={c} row={row} />)}
                </span>
                {/* Drawn rather than typed: the chevron glyphs render at almost
                    nothing in most UI fonts. */}
                <svg className={`rowsv-chev ${isOpen ? 'up' : ''}`} viewBox="0 0 10 6" aria-hidden>
                  <path d="M1 1.5l4 3.5 4-3.5" />
                </svg>
              </button>

              {isOpen && (
                <div className="rowsv-open">
                  <Details row={row} apiBase={apiBase} canEdit={canEdit} custom={custom}
                    fields={offRow}
                    sheets={sheets} names={names}
                    onPatch={(patch) => onPatch(row.id, patch)}
                    onDelete={() => onDelete(row.id)} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
