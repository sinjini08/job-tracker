'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { periodBy, periodLabel, rankBoard, todayProgress, wonToday } from '@/lib/board';

// The friends leaderboard. Everything it shows comes from league_board(),
// league_history() and league_settle() in the database, which return totals
// and counts — never anyone's applications.
//
// Three tiers. Clear the league's daily target and you've won the day; do that
// often enough and you win the week, then the month. A finished week is
// settled once and kept, so last week's winner stops moving once it's over.
//
// The dense numbers live under Stats on purpose: Today, This week and This
// month are meant to read like a scoreboard, not a spreadsheet.

const DEFAULT_TARGET = 10;

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'stats', label: 'Stats' },
  { id: 'points', label: 'How points work' },
  { id: 'settings', label: 'Settings' },
];

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
  const [view, setView] = useState('today');
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
      const savedLeague = localStorage.getItem('jt_league');
      if (savedLeague) setActive((cur) => cur ?? savedLeague);
      const savedView = localStorage.getItem('jt_league_view');
      if (VIEWS.some((v) => v.id === savedView)) setView(savedView);
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

  const show = (id) => {
    setView(id);
    try { localStorage.setItem('jt_league_view', id); } catch {}
  };

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
  // The three scoreboard views each rank by their own period; the rest just
  // need the rows, so they borrow today's ordering.
  const period = view === 'week' || view === 'month' ? view : 'today';
  const ranked = useMemo(() => (board ? rankBoard(board, me, period) : null), [board, me, period]);
  const mine = ranked?.find((r) => r.is_me) ?? null;

  if (leagues == null) return <div className="charts viz-root"><p className="viz-note">Loading…</p></div>;
  if (leagues.length === 0) {
    return (
      <div className="charts viz-root">
        <Start onCreate={create} onJoin={join} busy={busy} err={err} />
      </div>
    );
  }

  return (
    <div className="charts viz-root league-root">
      <nav className="league-rail" aria-label="League sections">
        {leagues.length > 1 ? (
          <select className="rail-league" value={active ?? ''} onChange={(e) => setActive(e.target.value)}
            aria-label="Which league">
            {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        ) : <div className="rail-title">{league?.name}</div>}

        <ul className="rail-tabs">
          {VIEWS.map((v) => (
            <li key={v.id}>
              <button className={`rail-tab ${view === v.id ? 'on' : ''}`} onClick={() => show(v.id)}
                aria-current={view === v.id ? 'page' : undefined}>
                {v.label}
              </button>
            </li>
          ))}
        </ul>

        {league && <InviteCode league={league} />}
      </nav>

      <div className="league-panel">
        {err && <p className="league-err">{err}</p>}
        {!ranked ? <p className="viz-note">Loading…</p> : (
          <>
            {view === 'today' && <TodayPanel rows={ranked} mine={mine} target={target} />}
            {(view === 'week' || view === 'month') && (
              <PeriodPanel rows={ranked} mine={mine} target={target} period={view}
                history={history.filter((h) => h.period === view)} />
            )}
            {view === 'stats' && <StatsPanel rows={ranked} target={target} />}
            {view === 'points' && <PointsPanel values={values} target={target} />}
            {view === 'settings' && (
              <SettingsPanel league={league} profile={profile} rows={ranked} busy={busy}
                onProfile={saveProfile} onTarget={setTarget} onRemove={removeMember}
                onLeave={() => leave(league)} onCreate={create} onJoin={join} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Today — a scoreboard, not a table.
// ---------------------------------------------------------------------------

function TodayPanel({ rows, mine, target }) {
  const progress = todayProgress(mine, target) ?? { done: 0, target, pct: 0, met: false };
  const winners = rows.filter((r) => wonToday(r, target));
  const best = rows[0]?.points_today ?? 0;

  return (
    <>
      <section className={`hero ${progress.met ? 'won' : ''}`}>
        <Ring done={progress.done} target={target} met={progress.met} />
        <div className="hero-copy">
          <h2>{progress.met ? 'You won today' : `${target - progress.done} to go`}</h2>
          <p>
            {progress.met
              ? `${progress.done} points today against a target of ${target}. Keep it going tomorrow.`
              : `${progress.done} of ${target} points today. Log an application and you’re a point closer.`}
          </p>
          <div className="hero-pills">
            <Pill label={(mine?.streak_days ?? 0) === 1 ? 'day streak' : 'day streak'}
              value={mine?.streak_days ?? 0} tone={(mine?.streak_days ?? 0) >= 3 ? 'hot' : null} />
            <Pill label={`of ${rows.length} won today`} value={winners.length} />
          </div>
        </div>
      </section>

      <h3 className="panel-h">Today’s board</h3>
      <ol className="day-list">
        {rows.map((row) => {
          const won = wonToday(row, target);
          const done = row.points_today ?? 0;
          return (
            <li key={row.user_id} className={`day-row ${row.is_me ? 'me' : ''} ${won ? 'won' : ''}`}>
              <Rank n={row.rank} lead={done > 0 && done === best} scored={done > 0} />
              <span className="day-name">
                {row.display_name}{row.is_me && <span className="you">you</span>}
              </span>
              <span className="day-bar">
                <i style={{ width: `${Math.min(100, Math.round((done / target) * 100))}%` }} />
              </span>
              <span className="day-score">{done}</span>
              <span className="day-flag">
                {won ? <b className="won-chip">won</b> : `${Math.max(0, target - done)} to go`}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="league-fine">
        Everyone who reaches {target} points wins the day — it isn’t one winner takes all. The
        crown goes to whoever is highest.
      </p>
    </>
  );
}

function Ring({ done, target, met, size = 116 }) {
  const pct = Math.max(0, Math.min(1, target ? done / target : 0));
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="10" />
      <circle className={`ring-fill ${met ? 'met' : ''}`} cx={size / 2} cy={size / 2} r={r} fill="none"
        strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text className="ring-num" x="50%" y="45%" textAnchor="middle" dominantBaseline="central">{done}</text>
      <text className="ring-sub" x="50%" y="67%" textAnchor="middle" dominantBaseline="central">of {target}</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// This week / this month — standings, then the winners already settled.
// ---------------------------------------------------------------------------

function PeriodPanel({ rows, mine, target, period, history }) {
  const p = periodBy(period);
  const top = rows[0]?.[p.points] ?? 0;
  return (
    <>
      <h3 className="panel-h">{p.label}</h3>
      <ol className="day-list tall">
        {rows.map((row) => {
          const pts = row[p.points] ?? 0;
          const won = row[p.hits] ?? 0;
          return (
            <li key={row.user_id} className={`day-row ${row.is_me ? 'me' : ''}`}>
              <Rank n={row.rank} lead={pts > 0 && pts === top} scored={pts > 0} />
              <span className="day-name">
                {row.display_name}{row.is_me && <span className="you">you</span>}
                <small>{won} {won === 1 ? 'day' : 'days'} won</small>
              </span>
              <span className="day-bar">
                <i style={{ width: `${top ? Math.round((pts / top) * 100) : 0}%` }} />
              </span>
              <span className="day-score big">{pts}</span>
            </li>
          );
        })}
      </ol>
      <p className="league-fine">
        {mine ? `You’re #${mine.rank} of ${rows.length}. ` : ''}A day counts as won at {target} points.
      </p>

      <h3 className="panel-h">Past winners</h3>
      <Winners rows={history} />
    </>
  );
}

function Winners({ rows }) {
  if (!rows?.length) {
    return <p className="muted">Nothing settled yet — the first winner is recorded once the period ends.</p>;
  }
  const sorted = [...rows].sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)));
  return (
    <ul className="winner-list">
      {sorted.map((r) => (
        <li key={`${r.period}-${r.period_start}-${r.winner}`}>
          <span className="cup" aria-hidden>🏆</span>
          <span className="winner-name">{r.winner}</span>
          <span className="winner-when">{periodLabel(r.period, r.period_start)}</span>
          <span className="winner-pts">{r.points} pts · {r.days_hit}d</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Stats — where the dense numbers live now.
// ---------------------------------------------------------------------------

function StatsPanel({ rows, target }) {
  return (
    <>
      <h3 className="panel-h">Everything, all time</h3>
      <div className="board-wrap">
        <table className="viz-table league-board">
          <thead>
            <tr>
              <th>Member</th>
              <th>Points</th>
              <th title="Points earned today">Today</th>
              <th title="Days in a row at target">Streak</th>
              <th title={`Days this month at ${target} points or more`}>Days won</th>
              <th>Applied</th>
              <th>Interviews</th>
              <th>Offers</th>
              <th className="trace-col" title="Points per day over the last two weeks">Last 2 weeks</th>
            </tr>
          </thead>
          <tbody>
            {[...rows].sort((a, b) => b.points_total - a.points_total).map((row) => (
              <tr key={row.user_id} className={row.is_me ? 'me' : ''}>
                <td className="member">
                  {row.display_name}{row.is_me && <span className="you">you</span>}
                </td>
                <td><b>{row.points_total}</b></td>
                <td>{row.points_today ?? 0}</td>
                <td>{row.streak_days ?? 0}</td>
                <td>{row.days_hit_month ?? 0}</td>
                <td>{cell(row.applied_total)}</td>
                <td>{cell(row.interviews)}</td>
                <td>{cell(row.offers)}</td>
                <td className="trace-col"><Trace daily={row.daily} target={target} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="league-fine">
        A dot means that member shows points only. The trace is points per day over the last
        fortnight against the {target}-point target, so a full bar is a day they won.
      </p>
    </>
  );
}

// Points per day for the last fortnight, drawn against the daily target, so a
// bar that reaches the top is a day won. Steady beats spiky, and a week's work
// done in one evening looks like exactly that.
function Trace({ daily, target }) {
  if (!daily) return <span className="hidden-cell" title="This member shows points only">·</span>;
  const hit = daily.filter((n) => n >= target).length;
  const total = daily.reduce((t, n) => t + n, 0);
  return (
    <span className="trace" title={`${total} points in the last 14 days · ${hit} ${hit === 1 ? 'day' : 'days'} won`}>
      {daily.map((n, i) => (
        // A day with something on it must not look like a day with nothing.
        <i key={i} className={n >= target ? 'hit' : n ? '' : 'empty'}
           style={{ height: n ? `${Math.max(20, Math.min(100, (n / target) * 100))}%` : undefined }} />
      ))}
    </span>
  );
}

const cell = (v) => (v == null ? <span className="hidden-cell" title="This member shows points only">·</span> : v);

// ---------------------------------------------------------------------------

function PointsPanel({ values, target }) {
  return (
    <>
      <h3 className="panel-h">What earns a point</h3>
      <ul className="points-list">
        {values.map((v) => (
          <li key={v.milestone}>
            <span className="pv-label">{v.label}</span>
            <span className="pv-points">+{v.points}</span>
          </li>
        ))}
      </ul>
      <div className="rules">
        <h4>The rules</h4>
        <ul>
          <li><b>Reach {target} points in a day and you’ve won it.</b> Everyone who clears the
            target wins that day; the crown goes to whoever is highest.</li>
          <li><b>Win a week or a month</b> by having the most points in it. When the period ends
            the result is recorded, and stops changing.</li>
          <li><b>Each milestone is earned once per application.</b> Getting to an interview is
            worth 8 points altogether — one for applying, then the rounds on the way.</li>
          <li><b>A rejection never takes points back.</b> Deleting the application does, which is
            what stops anyone padding the board and then tidying up.</li>
          <li><b>A row scores only once it names a role and a company</b>, and the same job logged
            twice scores once.</li>
        </ul>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function SettingsPanel({ league, profile, rows, busy, onProfile, onTarget, onRemove, onLeave, onCreate, onJoin }) {
  return (
    <>
      <h3 className="panel-h">You</h3>
      {profile && <Settings profile={profile} onSave={onProfile} busy={busy} />}

      <h3 className="panel-h">{league?.name}</h3>
      <div className="league-settings">
        <label className="field">
          <span>Daily target</span>
          {league?.is_owner
            ? <TargetInput league={league} onSave={onTarget} busy={busy} />
            : <div className="readonly-text">{league?.daily_target} points a day, set by whoever made the league.</div>}
        </label>

        <div className="field">
          <span>Members</span>
          <ul className="member-list">
            {rows.map((r) => (
              <li key={r.user_id}>
                <span>{r.display_name}{r.is_me && <span className="you">you</span>}</span>
                {league?.is_owner && !r.is_me && (
                  <button className="viz-toggle" disabled={busy} onClick={() => onRemove(r)}>Remove</button>
                )}
              </li>
            ))}
          </ul>
        </div>

        <button className="btn danger" onClick={onLeave} disabled={busy}>
          {league?.is_owner ? 'Delete this league' : 'Leave this league'}
        </button>
      </div>

      <h3 className="panel-h">Another league</h3>
      <Start onCreate={onCreate} onJoin={onJoin} busy={busy} compact />
    </>
  );
}

function TargetInput({ league, onSave, busy }) {
  const [draft, setDraft] = useState(league?.daily_target ?? DEFAULT_TARGET);
  useEffect(() => setDraft(league?.daily_target ?? DEFAULT_TARGET), [league?.daily_target]);
  return (
    <span className="target-row">
      <input className="target-input" type="number" min="1" max="500" value={draft} disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => Number(draft) !== league.daily_target && onSave(draft)} />
      <small>points a day, the same for everyone — that’s what makes days won comparable.</small>
    </span>
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
          ['points', 'Points only', 'Points, streak and days won — not the counts behind them, and not your day-by-day trace.'],
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

// ---------------------------------------------------------------------------

// Gold, silver and bronze — but only for a score worth having. Three people
// tied on nothing shouldn't all be wearing medals.
function Rank({ n, lead, scored }) {
  return (
    <span className={`rank r${scored && n <= 3 ? n : 'x'} ${lead ? 'lead' : ''}`}
      title={lead ? 'Top of the board' : undefined}>
      {n}
    </span>
  );
}

function Pill({ label, value, tone }) {
  return <span className={`pill ${tone === 'hot' ? 'hot' : ''}`}><b>{value}</b> {label}</span>;
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
    <div className="rail-invite">
      <span>Invite a friend</span>
      <code>{league.join_code}</code>
      <button className="viz-toggle" onClick={copy}>{copied ? 'Copied' : 'Copy code'}</button>
    </div>
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
            Make a league and send the code to a friend. Every application earns points and every
            round you reach earns more; clear the daily target and you’ve won the day. Weekly and
            monthly winners are recorded when the period ends. Your friends never see which jobs
            you applied to.
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
