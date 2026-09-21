'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PERIODS, goalProgress, periodBy, rankBoard } from '@/lib/board';

// The friends leaderboard. Everything it shows comes from league_board() in
// the database, which returns totals and counts — never anyone's applications.

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

  // Reload the board when the league changes, and every time the tab regains
  // focus — a friend logging an application should show up without a reload.
  const loadBoard = useCallback(async (id) => {
    if (!id) return;
    try {
      const data = await api(`/api/leagues/${id}`);
      setBoard(data.board);
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
  const saveProfile = (patch) => act(async () => {
    setProfile(await api('/api/profile', 'PATCH', patch));
    await loadBoard(active);
  });

  const league = leagues?.find((l) => l.id === active) ?? null;
  const ranked = useMemo(() => (board ? rankBoard(board, me, period) : null), [board, me, period]);
  const mine = ranked?.find((r) => r.is_me) ?? null;

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

          {mine && <div className="viz-kpis">
            <Stat label="Your place" value={ranked.length > 1 ? `#${mine.rank}` : '—'}
              sub={ranked.length > 1 ? `of ${ranked.length} in ${league.name}` : 'nobody else has joined yet'} />
            <Stat label={`Points ${periodBy(period).label.toLowerCase()}`} value={mine[periodBy(period).points]}
              sub={period === 'total' ? 'since you started' : `${mine.points_total} all time`} />
            <GoalStat row={mine} period={period} profile={profile} onSave={saveProfile} />
          </div>}

          <div className="viz-grid league-grid">
            <div className="viz-card">
              <div className="viz-card-head">
                <div>
                  <h2>{league?.name ?? 'Leaderboard'}</h2>
                  <p>{periodBy(period).label} · {ranked?.length ?? 0} {ranked?.length === 1 ? 'member' : 'members'}</p>
                </div>
                {league && (
                  <button className="viz-toggle" onClick={() => leave(league)} disabled={busy}>
                    {league.is_owner ? 'Delete league' : 'Leave'}
                  </button>
                )}
              </div>
              <Board rows={ranked} period={period} />
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
                Deleting an application takes its points back, so the board stays honest.
              </p>
            </div>

            <div className="viz-card">
              <div className="viz-card-head">
                <div>
                  <h2>Your settings</h2>
                  <p>What your friends see, and what you’re aiming for.</p>
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

function Board({ rows, period }) {
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
          <th>Applied</th>
          <th>Interviews</th>
          <th>Offers</th>
          <th>Goal</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const goal = goalProgress(row, period);
          return (
            <tr key={row.user_id} className={row.is_me ? 'me' : ''}>
              <td className="rank-col">{row.rank}</td>
              <td className="member">
                {row.display_name}{row.is_me && <span className="you">you</span>}
              </td>
              <td><b>{row[p.points]}</b></td>
              {/* A member who chose "points only" has no counts to show. */}
              <td>{p.applied ? cell(row[p.applied]) : '—'}</td>
              <td>{cell(row.interviews)}</td>
              <td>{cell(row.offers)}</td>
              <td>
                {goal ? (
                  <span className={`goal ${goal.met ? 'met' : ''}`} title={`${goal.done} of ${goal.target}`}>
                    <span className="goal-track"><span className="goal-fill" style={{ width: `${goal.pct}%` }} /></span>
                    {goal.done}/{goal.target}
                  </span>
                ) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}

const cell = (v) => (v == null ? <span className="hidden-cell" title="This member shows points only">·</span> : v);

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
            every application and every round you reach — weekly, monthly and all time.
            Your friends never see which jobs you applied to.
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
  const [week, setWeek] = useState(profile.weekly_goal);
  const [month, setMonth] = useState(profile.monthly_goal);
  return (
    <div className="league-settings">
      <label className="field">
        <span>Name on the board</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== (profile.display_name ?? '') && onSave({ display_name: name })} />
      </label>
      <label className="field">
        <span>Applications a week</span>
        <input type="number" min="0" max="200" value={week}
          onChange={(e) => setWeek(e.target.value)}
          onBlur={() => Number(week) !== profile.weekly_goal && onSave({ weekly_goal: week })} />
      </label>
      <label className="field">
        <span>Applications a month</span>
        <input type="number" min="0" max="800" value={month}
          onChange={(e) => setMonth(e.target.value)}
          onBlur={() => Number(month) !== profile.monthly_goal && onSave({ monthly_goal: month })} />
      </label>
      <fieldset className="field detail">
        <span>What friends see</span>
        {[
          ['counts', 'Points and counts', 'Your points, plus how many applications, interviews and offers.'],
          ['points', 'Points only', 'Just your total. Nobody sees the numbers behind it.'],
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

function GoalStat({ row, period, profile, onSave }) {
  const goal = goalProgress(row, period);
  if (!goal) {
    return <Stat label="Goal" value="—"
      sub={period === 'total' ? 'goals run weekly and monthly' : 'set one in your settings'} />;
  }
  return <Stat label={`${periodBy(period).label} goal`} value={`${goal.done} / ${goal.target}`}
    sub={goal.met ? '✓ goal met' : `${goal.target - goal.done} to go`} />;
}

function Stat({ label, value, sub }) {
  return (
    <div className="stat">
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
