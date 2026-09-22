'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PERIODS, periodBy, periodLabel, rankBoard, todayProgress } from '@/lib/board';

// The friends leaderboard. Everything it shows comes from league_board(),
// league_history() and league_settle() in the database, which return totals and
// counts — never anyone's applications.
//
// Three tiers: clear the league's daily target today, build a streak of days
// hit, and win the week or the month. A finished week is settled once and kept,
// so last week's winner stops moving the moment the week is over.

// Only a fallback for the instant before the league loads; the real number
// lives on the league row.
const DEFAULT_TARGET = 10;

const api = async (url, method = 'GET', body) => {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { window.location.href = '/sign-in'; throw new Error('Signed out'); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
};

export default function League() {
  const [leagues, setLeagues] = useState(null);
  const [values, setValues] = useState([]);
  const [profile, setProfile] = useState(null);
  const [active, setActive] = useState(null);
  const [board, setBoard] = useState(null);
  const [history, setHistory] = useState([]);
  const [me, setMe] = useState(null);
  const [period, setPeriod] = useState('week');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadLeagues = useCallback(async (prefer) => {
    const data = await api('/api/leagues');
    setLeagues(data.leagues);
    setValues(data.pointValues);
    setActive((cur) => prefer ?? (data.leagues.some((l) => l.id === cur) ? cur : data.leagues[0]?.id ?? null));
  }, []);

  useEffect(() => {
    Promise.all([loadLeagues(), api('/api/profile').then(setProfile)]).catch((e) => setErr(e.message));
    try {
      const saved = localStorage.getItem('jt_league');
      if (saved) setActive((cur) => cur ?? saved);
    } catch {}
  }, [loadLeagues]);

  // Reload when the league changes and whenever the tab regains focus: a
  // friend logging an application should show up without a reload, and the
  // read is also what settles a week that ended while nobody was looking.
  const loadBoard = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await api(`/api/leagues/${id}`);
      setBoard(data.board);
      setHistory(data.history ?? []);
      setMe(data.me);
      setErr(null);
    } catch (e) { setErr(e.message); }
  }, []);

  useEffect(() => {
    if (!active) { setBoard(null); return; }
    try { localStorage.setItem('jt_league', active); } catch {}
    loadBoard(active);
    const onFocus = () => loadBoard(active);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [active, loadBoard]);

  const act = async (fn) => {
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const create = (name) => act(async () => {
    const league = await api('/api/leagues', 'POST', { name });
    await loadLeagues(league.id);
  });
  const join = (code) => act(async () => {
    const league = await api('/api/leagues/join', 'POST', { code });
    await loadLeagues(league?.id);
  });
  const leave = (league) => act(async () => {
    const msg = league.is_owner
      ? `Delete “${league.name}”? It disappears for everyone in it.`
      : `Leave “${league.name}”?`;
    if (!confirm(msg)) return;
    await api(`/api/leagues/${league.id}`, 'DELETE');
    setActive(null);
    await loadLeagues();
  });
  const removeMember = (row) => act(async () => {
    if (!confirm(`Remove ${row.display_name} from “${league.name}”? They keep all their own data, and can rejoin with the code.`)) return;
    await api(`/api/leagues/${active}/members/${encodeURIComponent(row.user_id)}`, 'DELETE');
    await Promise.all([loadBoard(active), loadLeagues(active)]);
  });
  const setTarget = (daily_target) => act(async () => {
    await api(`/api/leagues/${active}`, 'PATCH', { daily_target });
    await Promise.all([loadLeagues(active), loadBoard(active)]);
  });
  const saveProfile = (patch) => act(async () => {
    setProfile(await api('/api/profile', 'PATCH', patch));
    await loadBoard(active);
  });

  const league = leagues?.find((l) => l.id === active) ?? null;
  const target = league?.daily_target ?? DEFAULT_TARGET;
  const ranked = useMemo(() => (board ? rankBoard(board, me, period) : null), [board, me, period]);
  const mine = ranked?.find((r) => r.is_me) ?? null;
  const today = todayProgress(mine, target);

  if (leagues == null) return <div className="charts viz-root"><p className="viz-note">Loading…</p></div>;

  return (
    <div className="charts viz-root">
      {leagues.length === 0 ? (
        <Start onCreate={create} onJoin={join} busy={busy} err={err} />
      ) : (
        <>
          <div className="viz-filters">
            {leagues.length > 1 && (
              <Segmented label="League" value={active} onChange={setActive}
                options={leagues.map((l) => ({ id: l.id, label: l.name }))} />
            )}
            <Segmented label="Period" value={period} onChange={setPeriod}
              options={PERIODS.map((p) => ({ id: p.id, label: p.label }))} />
            {league && <InviteCode league={league} />}
          </div>

          {err && <p className="league-err">{err}</p>}

          {mine && today && <div className="viz-kpis">
            <Stat label="Today" value={`${today.done} / ${today.target}`}
              sub={today.met ? '✓ target hit' : `${today.target - today.done} points to go`}
              tone={today.met ? 'good' : null} />
            <Stat label="Streak" value={mine.streak_days ?? 0}
              sub={(mine.streak_days ?? 0) === 1 ? 'day in a row at target' : 'days in a row at target'} />
            <Stat label="Your place" value={ranked.length > 1 ? `#${mine.rank}` : '—'}
              sub={ranked.length > 1 ? `of ${ranked.length}, ${periodBy(period).label.toLowerCase()}` : 'nobody else has joined yet'} />
            <Stat label={`Points ${periodBy(period).label.toLowerCase()}`} value={mine[periodBy(period).points]}
              sub={period === 'total' ? 'since you started' : `${mine.points_total} all time`} />
          </div>}

          <div className="viz-grid league-grid">
            <div className="viz-card board-card">
              <div className="viz-card-head">
                <div>
                  <h2>{league?.name ?? 'Leaderboard'}</h2>
                  <p>
                    {periodBy(period).label} · {ranked?.length ?? 0} {ranked?.length === 1 ? 'member' : 'members'} ·{' '}
                    <TargetControl league={league} onSave={setTarget} busy={busy} />
                  </p>
                </div>
                {league && (
                  <button className="viz-toggle" onClick={() => leave(league)} disabled={busy}>
                    {league.is_owner ? 'Delete league' : 'Leave'}
                  </button>
                )}
              </div>
              <Board rows={ranked} period={period} target={target}
                canRemove={Boolean(league?.is_owner)} onRemove={removeMember} busy={busy} />
            </div>

            <div className="viz-card">
              <div className="viz-card-head">
                <div>
                  <h2>Past winners</h2>
                  <p>Settled when the week or the month ends, and kept.</p>
                </div>
              </div>
              <Winners rows={history} />
            </div>

            <div className="viz-card">
              <div className="viz-card-head">
                <div>
                  <h2>How points work</h2>
                  <p>Earned once per application. A rejection never takes them away.</p>
                </div>
              </div>
              <table className="viz-table">
                <tbody>
                  {values.map((v) => (
                    <tr key={v.milestone}><td>{v.label}</td><td>+{v.points}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="league-fine">
                A row scores only once it names a role and a company, and the same job scores once.
                Deleting an application takes its points back.
              </p>
            </div>

            <div className="viz-card">
              <div className="viz-card-head">
                <div>
                  <h2>Your settings</h2>
                  <p>What your friends see on the board.</p>
                </div>
              </div>
              {profile && <Settings profile={profile} onSave={saveProfile} busy={busy} />}
            </div>

            <div className="viz-card">
              <div className="viz-card-head">
                <div>
                  <h2>Add a league</h2>
                  <p>Start one, or join a friend’s with their code.</p>
                </div>
              </div>
              <Start onCreate={create} onJoin={join} busy={busy} compact />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Board({ rows, period, target, canRemove, onRemove, busy }) {
  if (!rows) return <p className="viz-note">Loading…</p>;
  const p = periodBy(period);
  return (
    // Scrolls sideways rather than spilling out of the card on a phone.
    <div className="board-wrap">
    <table className="viz-table league-board">
      <thead>
        <tr>
          <th className="rank-col">#</th>
          <th>Member</th>
          <th>Points</th>
          <th title={`Points earned today, against the league's target of ${target}`}>Today</th>
          <th title={`Days this period at ${target} points or more`}>Days hit</th>
          <th title="Days in a row at target">Streak</th>
          <th>Applied</th>
          <th>Interviews</th>
          <th>Offers</th>
          <th className="trace-col" title="Points per day over the last two weeks">Last 2 weeks</th>
          {canRemove && <th className="kick-col" aria-label="Remove" />}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const today = todayProgress(row, target);
          return (
            <tr key={row.user_id} className={row.is_me ? 'me' : ''}>
              <td className="rank-col">{row.rank}</td>
              <td className="member">
                {row.display_name}{row.is_me && <span className="you">you</span>}
              </td>
              <td><b>{row[p.points]}</b></td>
              <td>
                <span className={`goal ${today.met ? 'met' : ''}`} title={`${today.done} of ${target} today`}>
                  <span className="goal-track"><span className="goal-fill" style={{ width: `${today.pct}%` }} /></span>
                  {today.done}
                </span>
              </td>
              <td>{p.hits ? (row[p.hits] ?? 0) : '—'}</td>
              <td>{row.streak_days ?? 0}</td>
              {/* A member who chose "points only" has no counts to show. */}
              <td>{cell(row[p.applied])}</td>
              <td>{cell(row.interviews)}</td>
              <td>{cell(row.offers)}</td>
              <td className="trace-col"><Trace daily={row.daily} target={target} /></td>
              {canRemove && (
                <td className="kick-col">
                  {!row.is_me && (
                    <button className="kick" title={`Remove ${row.display_name}`} disabled={busy}
                      onClick={() => onRemove(row)}>×</button>
                  )}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

// Points per day for the last fortnight, drawn against the daily target, so a
// bar that reaches the top is a day you hit it. Steady beats spiky, and a
// week's work done in one evening looks like exactly that.
function Trace({ daily, target }) {
  if (!daily) return <span className="hidden-cell" title="This member shows points only">·</span>;
  const hit = daily.filter((n) => n >= target).length;
  const total = daily.reduce((t, n) => t + n, 0);
  return (
    <span className="trace" title={`${total} points in the last 14 days · ${hit} ${hit === 1 ? 'day' : 'days'} at target`}>
      {daily.map((n, i) => (
        // A day with something on it must not look like a day with nothing.
        <i key={i} className={n >= target ? 'hit' : n ? '' : 'empty'}
           style={{ height: n ? `${Math.max(20, Math.min(100, (n / target) * 100))}%` : undefined }} />
      ))}
    </span>
  );
}

const cell = (v) => (v == null ? <span className="hidden-cell" title="This member shows points only">·</span> : v);

function Winners({ rows }) {
  if (!rows?.length) {
    return <p className="muted">Nothing settled yet — the first winner is recorded once a week finishes.</p>;
  }
  // Newest first, and don't lean on the order the API happened to send.
  const sorted = [...rows].sort((a, b) =>
    String(b.period_start).localeCompare(String(a.period_start)) ||
    String(a.period).localeCompare(String(b.period)));
  return (
    <table className="viz-table winners">
      <tbody>
        {sorted.map((r) => (
          <tr key={`${r.period}-${r.period_start}-${r.winner}`}>
            <td className="period">{periodLabel(r.period, r.period_start)}</td>
            <td className="winner">🏆 {r.winner}</td>
            <td>{r.points} pts</td>
            <td title="days at target that period">{r.days_hit}d</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// The target belongs to the league, not to each member: a shared bar is the
// only thing that makes "days hit" comparable between friends.
function TargetControl({ league, onSave, busy }) {
  const [draft, setDraft] = useState(league?.daily_target ?? DEFAULT_TARGET);
  useEffect(() => setDraft(league?.daily_target ?? DEFAULT_TARGET), [league?.daily_target]);
  if (!league?.is_owner) return <>target {league?.daily_target ?? DEFAULT_TARGET} points a day</>;
  return (
    <>
      target{' '}
      <input className="target-input" type="number" min="1" max="500" value={draft} disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => Number(draft) !== league.daily_target && onSave(draft)}
        title="Everyone in the league aims at the same number" />
      {' '}points a day
    </>
  );
}

function InviteCode({ league }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(league.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked; the code is on screen anyway */ }
  };
  return (
    <span className="invite">
      <span className="seg-label">Invite code</span>
      <code>{league.join_code}</code>
      <button className="viz-toggle" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
    </span>
  );
}

function Start({ onCreate, onJoin, busy, err, compact }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  return (
    <div className={compact ? 'league-start compact' : 'league-start'}>
      {!compact && (
        <>
          <p className="viz-empty-title">Compete with your friends</p>
          <p className="league-intro">
            Make a league and send the code to a friend. You’ll both get a board with points for
            every application and every round you reach, a daily target to clear, and a winner
            each week and month. Your friends never see which jobs you applied to.
          </p>
        </>
      )}
      <form onSubmit={(e) => { e.preventDefault(); onCreate(name); setName(''); }}>
        <label>
          <span>New league</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="CS friends" maxLength={60} />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>Create</button>
      </form>
      <div className="league-or">or</div>
      <form onSubmit={(e) => { e.preventDefault(); onJoin(code); setCode(''); }}>
        <label>
          <span>Join with a code</span>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="A1B2C3" maxLength={12} className="code" />
        </label>
        <button className="btn" type="submit" disabled={busy || code.trim().length < 4}>Join</button>
      </form>
      {err && <p className="league-err">{err}</p>}
    </div>
  );
}

function Settings({ profile, onSave, busy }) {
  const [name, setName] = useState(profile.display_name ?? '');
  return (
    <div className="league-settings">
      <label className="field">
        <span>Name on the board</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== (profile.display_name ?? '') && onSave({ display_name: name })} />
      </label>
      <fieldset className="field detail">
        <span>What friends see</span>
        {[
          ['counts', 'Points and counts', 'Your points and streak, plus how many applications, interviews and offers.'],
          ['points', 'Points only', 'Points, streak and days hit — not the counts behind them, and not your day-by-day trace.'],
        ].map(([id, label, hint]) => (
          <label key={id} className="radio">
            <input type="radio" name="detail" value={id} disabled={busy}
              checked={profile.leaderboard_detail === id}
              onChange={() => onSave({ leaderboard_detail: id })} />
            <span><b>{label}</b><small>{hint}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="league-fine">Your job titles, companies, pay and notes are never shared, either way.</p>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone === 'good' ? 'good' : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      <span className="seg-label">{label}</span>
      {options.map((o) => (
        <button key={o.id} role="radio" aria-checked={value === o.id}
          className={`seg-btn ${value === o.id ? 'on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
