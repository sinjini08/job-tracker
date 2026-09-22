'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ALWAYS_ON, allColumnsFor, columnsFor, columnLetter, isBlankRow, snapToKnown } from '@/lib/fields';
import Columns from './Columns';
import { CLOSED } from '@/lib/stats';
import { SignOutButton } from '@clerk/nextjs';
import Logo from './Logo';
import Drawer from './Drawer';
import Charts from './Charts';
import League from './League';
import { CHIP, addDays, daysSince, dayNumber, fmtDate, todayISO } from '@/lib/format';

const TABS = ['On-Campus', 'Off-Campus', 'Charts', 'League'];
const CHARTS = 'Charts';
const LEAGUE = 'League';
const MIN_GRID_ROWS = 40;
const MIN_COL_W = 48, MAX_COL_W = 640;
const MIN_ROW_H = 18, MAX_ROW_H = 120;
const DEADLINE_WARN_DAYS = 3;
const POLL_MS = 20000;
const REQUIRED = new Set(['status']); // NOT NULL in the schema: never offer a blank
const LISTS = new Set(['select', 'combo']);
const open = (row) => Boolean(row) && !CLOSED.has(row.status);

function rawValue(row, col) {
  if (!row) return null;
  if (col.kind === 'computed') return daysSince(row.date_applied);
  if (col.custom) return row.custom?.[col.id] ?? null;
  return row[col.key] ?? null;
}

// Writing to a custom column rewrites the whole blob, since that is what the
// API stores. The row we already hold is the base, so nothing else is lost.
function patchFor(row, col, next) {
  if (!col.custom) return { [col.key]: next };
  return { custom: { ...(row?.custom ?? {}), [col.id]: next } };
}

function plainText(row, col) {
  const v = rawValue(row, col);
  if (v == null) return '';
  if (col.kind === 'date') return fmtDate(v);
  if (col.kind === 'bool') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

function normalize(col, value) {
  if (col.kind === 'bool') return Boolean(value);
  if (value == null) return null;
  const s = String(value).trim();
  if (s === '') return col.key === 'role' ? '' : null;
  if (col.kind === 'number') {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  // A typed value that only differs in case or spacing becomes the listed one.
  if (LISTS.has(col.kind)) return snapToKnown(s, col.options);
  return s;
}

// A reminder a week out, set the first time a row gets a Date applied. It's a
// starting point, not a rule: clear it or move it and nothing puts it back.
const FOLLOW_UP_DAYS = 7;
function withFollowUp(row, patch) {
  if (!patch.date_applied || row?.next_follow_up) return patch;
  return { ...patch, next_follow_up: addDays(patch.date_applied, FOLLOW_UP_DAYS) };
}

// A deadline only matters until you've applied, so it warns on rows with no
// Date applied rather than on the Wishlist status alone.
export function deadlineSoon(row) {
  return Boolean(row?.deadline) && !row.date_applied && open(row) &&
    dayNumber(row.deadline) - dayNumber(todayISO()) <= DEADLINE_WARN_DAYS;
}
export function followUpDue(row) {
  return Boolean(row?.next_follow_up) && open(row) && row.next_follow_up <= todayISO();
}

function cellFlags(row, col) {
  if (!row) return '';
  if (col.key === 'next_follow_up' && followUpDue(row)) return 'due';
  if (col.key === 'deadline' && deadlineSoon(row)) return 'due';
  if (col.kind === 'computed' && !open(row)) return 'dim';
  return '';
}

async function api(url, method = 'GET', body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    window.location.href = '/login';
    throw new Error('Signed out');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export default function Sheet({ initialRows, role, apiBase = '/api', email, shared = false, loadError }) {
  const canEdit = role === 'edit';
  const [rows, setRows] = useState(initialRows);
  const [tab, setTab] = useState(TABS[0]);
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState(null); // { r, c, draft }
  const [pending, setPending] = useState(0);
  const [error, setError] = useState(loadError);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null); // { key, dir: 1 | -1 }
  const [drawerId, setDrawerId] = useState(null);
  const [colWidths, setColWidths] = useState({});   // { [column id]: px }, per sheet
  const [rowHeight, setRowHeight] = useState(24);
  const gridRef = useRef(null);
  const drawerOpenRef = useRef(false);

  const isCharts = tab === CHARTS;
  const isLeague = tab === LEAGUE;
  const isGrid = !isCharts && !isLeague;
  const [custom, setCustom] = useState([]);
  const [hidden, setHidden] = useState({});
  const [pickingCols, setPickingCols] = useState(false);
  // The extra tabs have no grid, so an unknown name falls back to On-Campus.
  const cols = useMemo(() => columnsFor(isGrid ? tab : 'On-Campus', { custom, hidden }),
    [tab, isGrid, custom, hidden]);
  const [events, setEvents] = useState(null);

  // Which columns this student keeps, and any they added. These follow the
  // student rather than the browser, unlike the widths below.
  const loadColumns = useCallback(async () => {
    if (shared) return;
    try {
      const [cc, profile] = await Promise.all([api('/api/columns'), api('/api/profile')]);
      setCustom(cc.columns ?? []);
      setHidden(profile.hidden_columns ?? {});
    } catch { /* the sheet still works with the built-in columns */ }
  }, [shared]);
  useEffect(() => { loadColumns(); }, [loadColumns]);

  const saveHidden = (next) => {
    setHidden(next);
    api('/api/profile', 'PATCH', { hidden_columns: next }).catch((e) => setError(e.message));
  };

  // Remember the last tab, the column widths and the row height per browser.
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jt_tab');
      if (TABS.includes(saved)) setTab(saved);
      const h = Number(localStorage.getItem('jt_rowh'));
      if (h >= MIN_ROW_H && h <= MAX_ROW_H) setRowHeight(h);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      setColWidths(JSON.parse(localStorage.getItem(`jt_colw_${tab}`) || '{}'));
    } catch { setColWidths({}); }
  }, [tab]);

  const widthOf = (col) => colWidths[col.id] ?? col.width;
  const saveWidths = (next) => {
    setColWidths(next);
    try { localStorage.setItem(`jt_colw_${tab}`, JSON.stringify(next)); } catch {}
  };
  const saveRowHeight = (h) => {
    setRowHeight(h);
    try { localStorage.setItem('jt_rowh', String(h)); } catch {}
  };

  // Drag a column's right edge, or a row number's bottom edge, to resize.
  const startColDrag = (e, col) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = widthOf(col);
    const move = (ev) => {
      const w = Math.round(Math.min(MAX_COL_W, Math.max(MIN_COL_W, startW + ev.clientX - startX)));
      setColWidths((prev) => ({ ...prev, [col.id]: w }));
    };
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      const w = Math.round(Math.min(MAX_COL_W, Math.max(MIN_COL_W, startW + ev.clientX - startX)));
      saveWidths({ ...colWidths, [col.id]: w });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startRowDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = rowHeight;
    const move = (ev) => setRowHeight(Math.round(Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, startH + ev.clientY - startY))));
    const up = (ev) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      saveRowHeight(Math.round(Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, startH + ev.clientY - startY))));
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // Double-click an edge to fit the column to its widest value (Excel's autofit).
  const autoFit = (col) => {
    const texts = [col.label, ...visible.map((row) => plainText(row, col))];
    const ctx = autoFit.ctx ??= document.createElement('canvas').getContext('2d');
    ctx.font = '13px system-ui, sans-serif';
    const widest = Math.max(...texts.map((t) => ctx.measureText(String(t)).width));
    saveWidths({ ...colWidths, [col.id]: Math.round(Math.min(MAX_COL_W, Math.max(MIN_COL_W, widest + 26))) });
  };

  const resetSizes = () => {
    saveWidths({});
    saveRowHeight(24);
  };
  const switchTab = (t) => {
    setTab(t);
    setSel({ r: 0, c: 0 });
    setEditing(null);
    try { localStorage.setItem('jt_tab', t); } catch {}
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows.filter((r) => r.type === tab);
    if (q) {
      list = list.filter((r) =>
        [r.role, r.company, r.location, r.notes, r.status, r.category, r.contact, r.source]
          .some((v) => v && String(v).toLowerCase().includes(q)));
    }
    if (sort) {
      const col = cols.find((c) => c.id === sort.key);
      if (col) {
        list = [...list].sort((a, b) => {
          const va = rawValue(a, col), vb = rawValue(b, col);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir;
        });
      }
    }
    return list;
  }, [rows, tab, query, sort, cols]);

  const gridRowCount = Math.max(MIN_GRID_ROWS, visible.length + 10);
  const rowAt = (r) => visible[r] ?? null;

  // ---- live refresh ----
  const busy = useRef(false);
  busy.current = Boolean(editing) || pending > 0;
  const onCharts = useRef(false);
  onCharts.current = isCharts;
  const refresh = useCallback(async () => {
    if (busy.current || document.visibilityState !== 'visible') return;
    try {
      const [data, evs] = await Promise.all([
        api(`${apiBase}/applications`),
        onCharts.current ? api(`${apiBase}/events`) : null,
      ]);
      if (!busy.current) setRows(data);
      if (evs) setEvents(evs);
    } catch (e) {
      setError(e.message);
    }
  }, [apiBase]);
  // Load history the first time the Charts tab opens (the funnel needs it).
  useEffect(() => {
    if (isCharts) api(`${apiBase}/events`).then(setEvents).catch((e) => setError(e.message));
  }, [isCharts, apiBase]);
  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    window.addEventListener('focus', refresh);
    return () => { clearInterval(t); window.removeEventListener('focus', refresh); };
  }, [refresh]);

  // ---- writes ----
  const track = async (fn) => {
    setPending((n) => n + 1);
    try {
      const result = await fn();
      setError(null);
      return result;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  };

  const patchRow = useCallback((id, patch) => track(async () => {
    const before = rows.find((x) => x.id === id);
    setRows((rs) => rs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      const saved = await api(`${apiBase}/applications/${id}`, 'PATCH', patch);
      setRows((rs) => rs.map((x) => (x.id === id ? saved : x)));
    } catch (e) {
      if (before) setRows((rs) => rs.map((x) => (x.id === id ? before : x)));
      throw e;
    }
  }), [rows]);

  const createRow = (fields) => track(async () => {
    const saved = await api(`${apiBase}/applications`, 'POST', { type: tab, ...fields });
    setRows((rs) => [...rs, saved]);
    return saved;
  });

  const deleteRow = (id) => track(async () => {
    await api(`${apiBase}/applications/${id}`, 'DELETE');
    setRows((rs) => rs.filter((x) => x.id !== id));
    setDrawerId(null);
  });

  // Typing into a blank row creates it. If you keep typing across that row before
  // the create comes back, later cells wait for it instead of creating duplicates.
  const creating = useRef(null); // { r, promise }
  const commit = (r, c, value) => {
    const col = cols[c];
    if (!col || col.kind === 'computed') return;
    const row = rowAt(r);
    const next = normalize(col, value);
    if (row) {
      // Clearing the last filled cell removes the row, like an emptied row in Excel.
      // Checked before the no-change test so Delete also clears out a row that's
      // already empty apart from its status.
      const clearing = next === null || next === '';
      if (clearing && isBlankRow({ ...row, ...patchFor(row, col, next) })) {
        deleteRow(row.id);
        return;
      }
      if ((rawValue(row, col) ?? null) === next) return;
      patchRow(row.id, withFollowUp(row, patchFor(row, col, next)));
      return;
    }
    if (next === null || next === '' || next === false) return;
    if (creating.current?.r === r) {
      creating.current.promise.then((saved) =>
        saved && patchRow(saved.id, withFollowUp(saved, patchFor(saved, col, next))));
      return;
    }
    const promise = createRow(withFollowUp(null, patchFor(null, col, next)));
    creating.current = { r, promise };
    promise.finally(() => { if (creating.current?.promise === promise) creating.current = null; });
  };

  const addRow = () => {
    if (!canEdit) return;
    createRow(withFollowUp(null, { date_applied: todayISO() })).then(() => {
      setSort(null);
      setQuery('');
      setSel({ r: visible.length, c: 0 });
    });
  };

  // ---- selection & keyboard ----
  const move = (dr, dc) => setSel((s) => ({
    r: Math.min(Math.max(s.r + dr, 0), gridRowCount - 1),
    c: Math.min(Math.max(s.c + dc, 0), cols.length - 1),
  }));

  useEffect(() => {
    gridRef.current
      ?.querySelector(`[data-cell="${sel.r}-${sel.c}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [sel]);

  // The sheet needs keyboard focus for arrows/Delete/typing to work. Take it on
  // load (a cell already looks selected), and route keys pressed while nothing
  // in particular is focused to the grid.
  const focusGrid = () => gridRef.current?.focus({ preventScroll: true });
  useEffect(() => { focusGrid(); }, []);
  const keyHandler = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      if (document.activeElement === document.body && !drawerOpenRef.current) keyHandler.current?.(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const startEdit = (r, c, draft) => {
    const col = cols[c];
    if (!canEdit || !col || col.kind === 'computed') return;
    if (col.kind === 'bool') {
      commit(r, c, !rawValue(rowAt(r), col));
      return;
    }
    setEditing({ r, c, draft: draft ?? (rawValue(rowAt(r), col) ?? '') });
  };

  const endEdit = (save, value, step = [0, 0]) => {
    if (!editing) return;
    const { r, c } = editing;
    setEditing(null);
    if (save) commit(r, c, value);
    move(...step);
    requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
  };

  const onGridKey = (e) => {
    if (!isGrid || editing || e.metaKey || e.ctrlKey || e.altKey) return;
    const col = cols[sel.c];
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); move(-1, 0); return;
      case 'ArrowDown': e.preventDefault(); move(1, 0); return;
      case 'ArrowLeft': e.preventDefault(); move(0, -1); return;
      case 'ArrowRight': e.preventDefault(); move(0, 1); return;
      case 'Tab': e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return;
      case 'Enter':
      case 'F2': e.preventDefault(); startEdit(sel.r, sel.c); return;
      case ' ':
        if (col?.kind === 'bool') { e.preventDefault(); startEdit(sel.r, sel.c); }
        return;
      case 'Delete':
      case 'Backspace':
        if (canEdit && col && col.kind !== 'computed' && !REQUIRED.has(col.id) && rowAt(sel.r)) {
          e.preventDefault();
          commit(sel.r, sel.c, col.kind === 'bool' ? false : null);
        }
        return;
      default:
        if (e.key.length === 1 && col && ['text', 'number', 'url', 'email', 'combo'].includes(col.kind)) {
          e.preventDefault();
          startEdit(sel.r, sel.c, e.key); // a combo opens filtered by what you typed
        } else if (e.key.length === 1 && col && ['select', 'date'].includes(col.kind)) {
          e.preventDefault();
          startEdit(sel.r, sel.c);
        }
    }
  };

  keyHandler.current = onGridKey;

  const toggleSort = (key) => setSort((s) =>
    !s || s.key !== key ? { key, dir: 1 } : s.dir === 1 ? { key, dir: -1 } : null);

  // ---- derived UI bits ----
  const selRow = rowAt(sel.r);
  const selCol = cols[sel.c];
  const counts = useMemo(() => {
    const out = { due: 0 };
    for (const r of rows) {
      if (r.type !== tab) continue;
      out[r.status] = (out[r.status] || 0) + 1;
      if (followUpDue(r)) out.due += 1;
    }
    return out;
  }, [rows, tab]);
  const tabCount = (t) => rows.filter((r) => r.type === t).length;
  const drawerRow = rows.find((r) => r.id === drawerId) || null;
  drawerOpenRef.current = Boolean(drawerRow);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="brand"><Logo size={24} />Job Application Tracker</div>
        <div className="toolbar-mid">
          {isGrid && <input
            className="search"
            type="search"
            placeholder="Search this sheet"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />}
          {canEdit && isGrid && <button className="btn primary" onClick={addRow}>+ New row</button>}
          {isGrid && !shared && (
            <button className="btn ghost" onClick={() => setPickingCols(true)}>Columns</button>
          )}
        </div>
        <div className="toolbar-right">
          <span className={`save-state ${error ? 'err' : ''}`} title={error || ''}>
            {error ? `⚠ ${error}` : shared ? 'Shared view · read-only' : !canEdit ? 'View only' : pending ? 'Saving…' : 'All changes saved'}
          </span>
          {!shared && (
            <>
              {email && <span className="whoami" title={email}>{email}</span>}
              <a className="btn ghost" href="/settings">Settings</a>
              <SignOutButton><button className="btn ghost" type="button">Sign out</button></SignOutButton>
            </>
          )}
        </div>
      </header>

      {isCharts ? <Charts rows={rows} events={events} /> : isLeague ? <League /> : <>
      <div className="formula-bar">
        <div className="name-box">{selCol ? `${columnLetter(sel.c)}${sel.r + 2}` : ''}</div>
        <div className="fx" aria-hidden>fx</div>
        <div className="formula-value">{selCol ? plainText(selRow, selCol) : ''}</div>
      </div>

      <div
        className="grid-wrap"
        style={{ '--row-h': `${rowHeight}px` }}
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onGridKey}
        aria-label={`${tab} sheet`}
      >
        <table className="grid">
          <colgroup>
            <col style={{ width: 44 }} />
            {cols.map((c) => <col key={c.id} style={{ width: widthOf(c) }} />)}
          </colgroup>
          <thead>
            <tr className="letters">
              <th className="corner" />
              {cols.map((c, i) => (
                <th key={c.id} className={`${i === 0 ? 'sticky-col' : ''} ${i === sel.c ? 'hl' : ''}`}>
                  {columnLetter(i)}
                  <span
                    className="col-resizer"
                    title="Drag to resize · double-click to fit"
                    onPointerDown={(e) => startColDrag(e, c)}
                    onDoubleClick={() => autoFit(c)}
                  />
                </th>
              ))}
            </tr>
            <tr className="headers">
              <th className="rownum">1</th>
              {cols.map((c, i) => (
                <th
                  key={c.id}
                  className={i === 0 ? 'sticky-col' : ''}
                  onClick={() => toggleSort(c.id)}
                  title={`${c.hint}\n\nClick to sort.`}
                >
                  {c.label}
                  {sort?.key === c.id && <span className="sort">{sort.dir === 1 ? ' ▲' : ' ▼'}</span>}
                  <span
                    className="col-resizer"
                    title="Drag to resize · double-click to fit"
                    onPointerDown={(e) => startColDrag(e, c)}
                    onDoubleClick={() => autoFit(c)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: gridRowCount }, (_, r) => {
              const row = rowAt(r);
              return (
                <tr key={row?.id ?? `empty-${r}`} className={r === sel.r ? 'sel-row' : ''}>
                  <th
                    className={`rownum ${r === sel.r ? 'hl' : ''} ${row ? 'has-row' : ''}`}
                    onClick={() => row && setDrawerId(row.id)}
                    title={row ? 'Open details & history' : ''}
                  >
                    {r + 2}
                    <span className="row-resizer" title="Drag to change row height" onPointerDown={startRowDrag} />
                  </th>
                  {cols.map((col, c) => (
                    <Cell
                      key={col.id}
                      r={r}
                      c={c}
                      row={row}
                      col={col}
                      selected={sel.r === r && sel.c === c}
                      editing={editing && editing.r === r && editing.c === c ? editing : null}
                      canEdit={canEdit}
                      onSelect={() => { setSel({ r, c }); if (!editing) focusGrid(); }}
                      onStartEdit={() => { setSel({ r, c }); startEdit(r, c); }}
                      onEnd={endEdit}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>}

      <footer className="tabs-bar">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => switchTab(t)}
            >
              {t === CHARTS || t === LEAGUE ? t : <>{t} <span className="tab-count">{tabCount(t)}</span></>}
            </button>
          ))}
        </div>
        {isGrid && (Object.keys(colWidths).length > 0 || rowHeight !== 24) && (
          <button className="reset-sizes" onClick={resetSizes} title="Back to default column widths and row height">
            Reset sizes
          </button>
        )}
        {isGrid && <div className="status-summary">
          {['Applied', 'OA / Assessment', 'Interviewing', 'Offer'].map((s) => (
            <span key={s}>{s}: <b>{counts[s] || 0}</b></span>
          ))}
          <span>Total: <b>{tabCount(tab)}</b></span>
          {counts.due > 0 && (
            <span className="due-count" title="Rows whose Follow up by date has arrived">
              Follow-ups due: <b>{counts.due}</b>
            </span>
          )}
        </div>}
      </footer>

      {pickingCols && (
        <Columns
          sheet={tab}
          all={allColumnsFor(tab, custom)}
          custom={custom}
          hidden={hidden[tab] ?? []}
          onToggle={(id, show) => {
            const set = new Set(hidden[tab] ?? []);
            if (show) set.delete(id); else set.add(id);
            saveHidden({ ...hidden, [tab]: [...set] });
          }}
          onShowAll={() => saveHidden({ ...hidden, [tab]: [] })}
          onAdd={async (def) => {
            const made = await api('/api/columns', 'POST', def);
            setCustom((c) => [...c, made]);
          }}
          onRemove={async (id) => {
            await api(`/api/columns/${id}`, 'DELETE');
            setCustom((c) => c.filter((x) => x.id !== id));
          }}
          onClose={() => setPickingCols(false)}
        />
      )}

      {drawerRow && (
        <Drawer
          apiBase={apiBase}
          row={drawerRow}
          canEdit={canEdit}
          custom={custom}
          onPatch={(patch) => patchRow(drawerRow.id, patch)}
          onDelete={() => deleteRow(drawerRow.id)}
          onClose={() => {
            setDrawerId(null);
            requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));
          }}
        />
      )}
    </div>
  );
}

function Cell({ r, c, row, col, selected, editing, canEdit, onSelect, onStartEdit, onEnd }) {
  const v = rawValue(row, col);
  const flags = cellFlags(row, col);
  const cls = [
    'cell',
    `k-${col.kind}`,
    c === 0 ? 'sticky-col' : '',
    selected ? 'selected' : '',
    flags,
  ].join(' ');

  return (
    <td
      className={cls}
      data-cell={`${r}-${c}`}
      onMouseDown={onSelect}
      onDoubleClick={() => canEdit && col.kind !== 'bool' && onStartEdit()}
      onClick={(e) => {
        if (col.kind === 'bool' && canEdit && row && e.target.classList.contains('check')) onStartEdit();
      }}
    >
      {editing ? <Editor col={col} initial={editing.draft} onEnd={onEnd} /> : <Display col={col} v={v} row={row} />}
    </td>
  );
}

function Display({ col, v, row }) {
  if (v == null || v === '') {
    return col.kind === 'bool' && row ? <span className="check">☐</span> : null;
  }
  switch (col.kind) {
    case 'select':
    case 'combo': {
      // Statuses and priorities are colour-coded; the other lists (and any
      // status a student typed themselves) get the neutral chip.
      const [bg, fg] = CHIP[v] || ['#eef0f3', '#374151'];
      return <span className="chip" style={{ background: bg, color: fg }}>{v}</span>;
    }
    case 'date':
      return fmtDate(v);
    case 'bool':
      return <span className="check">{v ? '☑' : '☐'}</span>;
    case 'url': {
      let label = v;
      try { const u = new URL(v); label = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''); } catch {}
      return (
        <span className="link-cell">
          <span className="truncate">{label}</span>
          <a href={v} target="_blank" rel="noreferrer noopener" onMouseDown={(e) => e.stopPropagation()} title="Open posting">↗</a>
        </span>
      );
    }
    default:
      return <span className="truncate">{String(v)}</span>;
  }
}

function Editor({ col, initial, onEnd }) {
  const ref = useRef(null);
  const done = useRef(false);
  const finish = (save, value, step) => {
    if (done.current) return;
    done.current = true;
    onEnd(save, value, step);
  };

  // Layout effect, not a plain effect: focus must move into the editor before the
  // next keystroke arrives, or fast typing lands on the grid and is lost.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    if (el.setSelectionRange && typeof initial === 'string' && col.kind !== 'date') {
      el.setSelectionRange(initial.length, initial.length);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const keys = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    else if (e.key === 'Enter') { e.preventDefault(); finish(true, e.currentTarget.value, [e.shiftKey ? -1 : 1, 0]); }
    else if (e.key === 'Tab') { e.preventDefault(); finish(true, e.currentTarget.value, [0, e.shiftKey ? -1 : 1]); }
  };

  if (col.kind === 'combo') return <ComboEditor col={col} initial={initial} finish={finish} />;

  if (col.kind === 'select') {
    const options = col.options;
    return (
      <select
        ref={ref}
        className="list-editor"
        size={Math.min(options.length + (REQUIRED.has(col.id) ? 0 : 1), 10)}
        defaultValue={initial ?? ''}
        onKeyDown={keys}
        onClick={(e) => finish(true, ref.current.value, [0, 0])}
        onBlur={() => finish(false)}
      >
        {!REQUIRED.has(col.id) && <option value="">Leave blank</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <input
      ref={ref}
      className="cell-editor"
      type={col.kind === 'date' ? 'date' : col.kind === 'number' ? 'number' : 'text'}
      defaultValue={initial ?? ''}
      onKeyDown={keys}
      onBlur={(e) => finish(true, e.currentTarget.value)}
    />
  );
}

// A dropdown you can also type into: the listed values are suggestions, and
// anything else you type is kept as-is (normalize() snaps near-matches).
function ComboEditor({ col, initial, finish }) {
  const ref = useRef(null);
  const listRef = useRef(null);
  const [draft, setDraft] = useState(String(initial ?? ''));
  // Start on the value the cell already holds, so opening a cell and pressing
  // Enter leaves it alone.
  const [hi, setHi] = useState(() => Math.max(0, col.options.indexOf(String(initial ?? ''))));

  const q = draft.trim().toLowerCase();
  // While the draft is still exactly the current value, show the whole list —
  // opening a cell shouldn't hide the other choices.
  const matches = !q || q === String(initial ?? '').trim().toLowerCase()
    ? col.options
    : col.options.filter((o) => o.toLowerCase().includes(q));

  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.setSelectionRange(draft.length, draft.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the highlighted option visible: the list scrolls past ten or so.
  useEffect(() => {
    listRef.current?.children[hi]?.scrollIntoView({ block: 'nearest' });
  }, [hi]);

  const keys = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const step = e.key === 'Tab' ? [0, e.shiftKey ? -1 : 1] : [e.shiftKey ? -1 : 1, 0];
      finish(true, matches[hi] ?? draft, step);
    }
  };

  return (
    <div className="combo">
      <input
        ref={ref}
        className="cell-editor"
        value={draft}
        placeholder={REQUIRED.has(col.id) ? '' : 'Type or pick'}
        onChange={(e) => { setDraft(e.target.value); setHi(0); }}
        onKeyDown={keys}
        onBlur={() => finish(true, draft)}
      />
      {matches.length > 0 && (
        <ul className="combo-list" role="listbox" ref={listRef}>
          {matches.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? 'hi' : ''}
              onMouseEnter={() => setHi(i)}
              // mousedown, not click: the input's blur would land first.
              onMouseDown={(e) => { e.preventDefault(); finish(true, o, [0, 0]); }}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
