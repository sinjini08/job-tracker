'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { periodBy, periodLabel, rankBoard, todayProgress, wonToday } from '@/lib/board';
import { AVATAR_GROUPS } from '@/lib/avatars';
import Avatar from './Avatar';
import { Check, Crown, Flame, Trophy } from './Icons';
import DayChart from './LeagueCharts';
import { useCelebration } from './Celebrate';

// The friends leaderboard. Everything it shows comes from league_board(),
// league_history() and league_settle() in the database, which return totals
// and counts — never anyone's applications.
//
// Three tiers. The daily target is a floor, not a cap: reach it and you've won
// the day, and every point past it still counts toward the week and the month.
// Weeks and months are settled when they end, so a past winner stops moving.
//
// The dense numbers live under Stats on purpose — Today, This week and This
// month are meant to read like a scoreboard.

const DEFAULT_TARGET = 10;

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'mine', label: 'Your points' },
  { id: 'stats', label: 'Stats' },
  { id: 'points', label: 'How points work' },
  { id: 'settings', label: 'Settings' },
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

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
  const [months, setMonths] = useState([]);
  const [me, setMe] = useState(null);
  const [view, setView] = useState('today');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const { celebrate, node: party } = useCelebration();

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
      setMonths(data.months ?? []);
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
  const rename = (name) => act(async () => {
    await api(`/api/leagues/${active}`, 'PATCH', { name });
    await loadLeagues(active);
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

  // Confetti for a win, once ever — crossing today's target, and any week or
  // month that settled in your favour while you weren't looking.
  useEffect(() => {
    if (!league || !mine || !wonToday(mine, target)) return;
    const over = mine.points_today - target;
    celebrate(`${league.id}-day-${todayKey()}`, 'You won today',
      over > 0 ? `${mine.points_today} points today, ${over} more than you needed.`
        : `${mine.points_today} points today.`);
  }, [league, mine, target, celebrate]);

  useEffect(() => {
    if (!league || !me || !history.length) return;
    // Only the latest of each kind, or joining a busy league replays a year.
    for (const kind of ['week', 'month']) {
      const latest = history.filter((h) => h.period === kind)[0];
      if (latest?.user_id !== me) continue;
      celebrate(`${league.id}-${kind}-${latest.period_start}`,
        kind === 'week' ? 'You won the week' : 'You won the month',
        `${periodLabel(kind, latest.period_start)} · ${latest.points} points`);
    }
  }, [history, me, league, celebrate]);

  if (leagues == null) return <div className="charts viz-root"><p className="viz-note">Loading…</p></div>;
  if (leagues.length === 0) {
    return (
      <div className="charts viz-root">
        <Start onCreate={create} onJoin={join} busy={busy} err={err} />
      </div>
    );
  }

  return (
    // Two elements on purpose. The outer one scrolls and fills the tab; the
    // inner one is the capped, centred grid. They used to be the same element,
    // which meant the centred box was also the scroller, so its width moved
    // with its own content and every section of the league sat somewhere
    // slightly different.
    <div className="charts viz-root">
      <div className="league-root">
        {party}
        <nav className="league-rail" aria-label="League sections">
          {/* Who you are on the board, so the avatar you picked is visible
              without opening Settings to look at it. */}
          <div className="rail-me">
            <Avatar name={mine?.display_name ?? profile?.display_name}
              avatar={profile?.avatar} size={34} />
            <b>{mine?.display_name ?? profile?.display_name ?? 'You'}</b>
          </div>

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
          {/* The league you are looking at heads the panel it belongs to,
              rather than sitting in the rail away from its own content. Still
              a picker even with one league, so there is somewhere obvious for
              a second one to appear. */}
          {/* A bare <select> sizes itself to its widest option, which parks the
              chevron somewhere out past the end of a short name. So the name
              is drawn as text and the real select lies invisibly on top of it,
              which keeps the keyboard and the native menu and still measures
              to the name actually showing. */}
          <div className="league-pick">
            <b>{league?.name}</b>
            <svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
            <select value={active ?? ''} onChange={(e) => setActive(e.target.value)}
              aria-label="Which league">
              {leagues.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>

          {err && <p className="league-err">{err}</p>}
          {!ranked ? <p className="viz-note">Loading…</p> : (
            <>
              {view === 'today' && <TodayPanel rows={ranked} mine={mine} target={target} />}
              {view === 'week' && (
                <PeriodPanel rows={ranked} mine={mine} target={target} period="week"
                  history={history.filter((h) => h.period === 'week')} />
              )}
              {view === 'month' && (
                <MonthPanel rows={ranked} mine={mine} target={target} me={me}
                  history={history.filter((h) => h.period === 'month')} />
              )}
              {view === 'mine' && <MyPointsPanel target={target} />}
              {view === 'stats' && <StatsPanel rows={ranked} target={target} months={months} me={me} />}
              {view === 'points' && <PointsPanel values={values} target={target} />}
              {view === 'settings' && (
                <SettingsPanel league={league} leagues={leagues} profile={profile} rows={ranked}
                  busy={busy} onSwitch={setActive} onProfile={saveProfile} onRename={rename}
                  onTarget={setTarget} onRemove={removeMember} onLeave={() => leave(league)}
                  onCreate={create} onJoin={join} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// A handle like "mrmalpani25" doesn't tell a league who that is. Tapping it
// swaps in the name that person gave. A swap rather than an extra line,
// because these rows are a fixed height and a second line would push the
// board around under whoever clicked.
//
// It puts itself away after three seconds. A peek is what this is for, and
// leaving somebody's real name sitting on a leaderboard until the next click
// is not the same thing: walk away from the screen and it is still there.
// Tapping again reverts it at once, so nobody has to wait out the timer.
//
// Only one name is ever open. Tapping a second cancels the first, rather than
// leaving two timers racing to close different rows.
const REVEAL_MS = 3000;

function useNameReveal() {
  const [shown, setShown] = useState(null);
  const timer = useRef(null);

  const stop = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => stop, []);

  return (row) => ({
    row,
    open: shown === row.user_id,
    onToggle: () => {
      stop();
      setShown((cur) => {
        if (cur === row.user_id) return null;
        timer.current = setTimeout(() => { timer.current = null; setShown(null); }, REVEAL_MS);
        return row.user_id;
      });
    },
  });
}

function BoardName({ row, open, onToggle }) {
  if (!row.full_name) return row.display_name;
  return (
    <button type="button" className="name-btn" onClick={onToggle} aria-pressed={open}
      title={open ? `Back to ${row.display_name}` : row.full_name}>
      {open ? row.full_name : row.display_name}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Today — the target is a floor, and beating it is the point.
// ---------------------------------------------------------------------------

function TodayPanel({ rows, mine, target }) {
  const reveal = useNameReveal();
  const progress = todayProgress(mine, target) ?? { done: 0, target, met: false };
  const over = Math.max(0, progress.done - target);
  const winners = rows.filter((r) => wonToday(r, target));
  const best = rows[0]?.points_today ?? 0;

  return (
    <>
      <section className={`hero ${progress.met ? 'won' : ''}`}>
        <Ring done={progress.done} target={target} met={progress.met} over={over} />
        <div className="hero-copy">
          <h2>{progress.met ? 'You won today' : `${target - progress.done} to go`}</h2>
          <p>
            {progress.met
              ? over > 0
                ? `You needed ${target} and you got ${progress.done}. Those ${over} extra points still count toward your week and your month, so keep them coming.`
                : `${progress.done} points, right on target. Anything more still builds your week and your month.`
              : `Get to ${target} points today and the day is yours. And ${target} is only the floor, so everything past it still builds your week and your month.`}
          </p>
          <div className="hero-pills">
            <Pill label="day streak" value={mine?.streak_days ?? 0} icon={<Flame />}
              tone={(mine?.streak_days ?? 0) >= 3 ? 'hot' : null} />
            <Pill label={`of ${rows.length} cleared the target`} value={winners.length} icon={<Check />} />
            {mine?.bonus_month > 0 && (
              <Pill label="bonus this month" value={`+${mine.bonus_month}`} icon={<Trophy />} tone="gold" />
            )}
          </div>
        </div>
      </section>

      <h3 className="panel-h">Today’s board</h3>
      <ol className="day-list">
        {rows.map((row) => {
          const done = row.points_today ?? 0;
          const won = wonToday(row, target);
          const past = done - target;
          return (
            <li key={row.user_id} className={`day-row ${row.is_me ? 'me' : ''} ${won ? 'won' : ''}`}>
              <Rank n={row.rank} lead={done > 0 && done === best} scored={done > 0} />
              <Avatar name={row.display_name} avatar={row.avatar} size={34} />
              <span className="day-name">
                <BoardName {...reveal(row)} />
                {/* The trophy belongs to the person, not to the score, so it
                    sits with their name: this is the day's top scorer, and
                    that is what earns the bonus point. */}
                {done > 0 && done === best && (
                  <span className="name-cup" title="Top score today, worth a bonus point on the month">
                    <Trophy size={17} />
                  </span>
                )}
              </span>
              <span className="day-bar" title={`${done} of ${target}`}>
                <i style={growBar(Math.min(100, Math.round((done / target) * 100)), row.rank)} />
              </span>
              <span className="day-score">{done}</span>
              <span className="day-flag">
                {won
                  ? <b className="won-chip">won{past > 0 ? ` +${past}` : ''}</b>
                  : `${Math.max(0, target - done)} to go`}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="league-fine">
        Anyone who reaches {target} points has won the day, so you are not fighting over one
        spot. The trophy marks whoever scored highest, and that is worth a bonus point on the
        month!
      </p>
    </>
  );
}

function Ring({ done, target, met, over = 0, size = 116 }) {
  const pct = Math.max(0, Math.min(1, target ? done / target : 0));
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap">
      <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="10" />
        <circle className={`ring-fill ${met ? 'met' : ''}`} cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        <text className="ring-num" x="50%" y="45%" textAnchor="middle" dominantBaseline="central">{done}</text>
        <text className="ring-sub" x="50%" y="67%" textAnchor="middle" dominantBaseline="central">of {target}</text>
      </svg>
      {over > 0 && <span className="ring-over">+{over}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// This week — podium, standings, and the weeks already settled.
// ---------------------------------------------------------------------------

function PeriodPanel({ rows, mine, target, period, history }) {
  const p = periodBy(period);
  return (
    <>
      <h3 className="panel-h">{p.label}</h3>
      <Podium rows={rows} period={period} />
      <Standings rows={rows} period={period} />
      <p className="league-fine">
        {mine ? `You are #${mine.rank} of ${rows.length}. ` : ''}A day is won at {target} points, and
        anything you score past that still adds to this total.
      </p>

      <h3 className="panel-h">Past winners</h3>
      <Winners rows={history} />
    </>
  );
}

// The classic three-step podium. Heights go by place, not by score — every
// value is printed above its column, and a podium where second place is a
// hair shorter than first doesn't read as a podium.
function Podium({ rows, period }) {
  const p = periodBy(period);
  const top = rows.slice(0, 3);
  if (top.length < 2 || !(top[0]?.[p.points] > 0)) return null;
  const order = [top[1], top[0], top[2]].filter(Boolean);
  const heights = { 1: 132, 2: 100, 3: 78 };
  return (
    <div className="podium">
      {order.map((row) => {
        const h = heights[row.rank] ?? 70;
        return (
          <div key={row.user_id} className={`plinth place-${row.rank} ${row.is_me ? 'me' : ''}`}>
            <div className="plinth-who">
              <span className="plinth-av">
                <Avatar name={row.display_name} avatar={row.avatar} size={row.rank === 1 ? 62 : 52} />
                <b className={`crown c${row.rank}`} aria-hidden><Crown /></b>
              </span>
              <span className="plinth-name">{row.display_name}</span>
              <span className="plinth-score"><CountUp value={row[p.points]} delay={620} /></span>
            </div>
            {/* --h drives the keyframe, and the inline height is what it lands
                on — so the column is the right size even without animation. */}
            <div className="plinth-bar" style={{ height: h, '--h': `${h}px` }}>{row.rank}</div>
          </div>
        );
      })}
    </div>
  );
}

// Counts from zero once the bars have finished growing. Reduced motion, or a
// browser without rAF, just shows the number.
function CountUp({ value, delay = 0, ms = 520 }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (typeof window === 'undefined' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    setShown(0);
    let frame;
    const start = performance.now() + delay;
    const tick = (now) => {
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      // Ease out, so it sprints then settles rather than crawling to the end.
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, delay, ms]);
  return <>{shown}</>;
}

function Standings({ rows, period }) {
  const reveal = useNameReveal();
  const p = periodBy(period);
  const top = rows[0]?.[p.points] ?? 0;
  return (
    <ol className="day-list tall">
      {rows.map((row) => {
        const pts = row[p.points] ?? 0;
        const won = row[p.hits] ?? 0;
        return (
          <li key={row.user_id} className={`day-row ${row.is_me ? 'me' : ''}`}>
            <Rank n={row.rank} lead={pts > 0 && pts === top} scored={pts > 0} />
            <Avatar name={row.display_name} avatar={row.avatar} size={34} />
            <span className="day-name">
              <BoardName {...reveal(row)} />
              <small>{won} {won === 1 ? 'day' : 'days'} won</small>
            </span>
            <span className="day-bar">
              <i style={growBar(top ? Math.round((pts / top) * 100) : 0, row.rank)} />
            </span>
            <span className="day-score big">{pts}</span>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------------------
// This month — the shape of everyone's month, then the standings.
// ---------------------------------------------------------------------------

function MonthPanel({ rows, mine, target, history }) {
  const series = rows
    .filter((r) => Array.isArray(r.daily))
    .map((r) => ({ key: r.user_id, label: r.display_name + (r.is_me ? ' (you)' : ''), daily: r.daily }));
  const hidden = rows.length - series.length;

  return (
    <>
      <h3 className="panel-h">This month, day by day</h3>
      <div className="viz-card chart-card">
        <DayChart series={series} target={target}
          subtitle={`Points each day this month. Anything above the dashed line is a day won.`} />
      </div>
      {hidden > 0 && (
        <p className="league-fine">
          {hidden} {hidden === 1 ? 'member shows' : 'members show'} points only, so their daily shape isn’t drawn.
        </p>
      )}

      <h3 className="panel-h">Standings</h3>
      <Podium rows={rows} period="month" />
      <Standings rows={rows} period="month" />
      <p className="league-fine">
        {mine ? `You are #${mine.rank} of ${rows.length} this month, with ${mine.days_hit_month ?? 0} days won. ` : ''}
        {mine?.bonus_month > 0
          ? `That includes ${mine.bonus_month} bonus ${mine.bonus_month === 1 ? 'point' : 'points'}: ${mine.day_wins_month} ${mine.day_wins_month === 1 ? 'day' : 'days'} topped and ${mine.week_wins_month} ${mine.week_wins_month === 1 ? 'week' : 'weeks'} won.`
          : 'Top a day for a bonus point, or win a week for two.'}
      </p>

      <h3 className="panel-h">Past winners</h3>
      <Winners rows={history} />
    </>
  );
}

function Winners({ rows }) {
  if (!rows?.length) {
    return <p className="muted">Nothing settled yet. The first winner gets recorded as soon as a period ends.</p>;
  }
  const sorted = [...rows].sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)));
  return (
    <ul className="winner-list">
      {sorted.map((r) => (
        <li key={`${r.period}-${r.period_start}-${r.user_id}`}>
          <span className="cup"><Trophy size={15} /></span>
          <Avatar name={r.winner} avatar={r.avatar} size={28} />
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

function StatsPanel({ rows, target, months, me }) {
  const reveal = useNameReveal();
  // Settled months, newest first, each with its own little table.
  const byMonth = [];
  for (const row of months ?? []) {
    const bucket = byMonth.find((b) => b.start === row.period_start);
    if (bucket) bucket.rows.push(row);
    else byMonth.push({ start: row.period_start, rows: [row] });
  }

  return (
    <>
      <h3 className="panel-h">Month by month</h3>
      {byMonth.length === 0 ? (
        <p className="muted">
          No finished months yet. When this month ends the board resets to zero, and the whole
          month lands here so you can still see how it went.
        </p>
      ) : (
        <div className="months">
          {byMonth.map((m) => (
            <div className="month-card" key={m.start}>
              <h4>{periodLabel('month', m.start)}</h4>
              <ol className="month-rows">
                {m.rows.map((r, i) => (
                  <li key={r.user_id} className={r.user_id === me ? 'me' : ''}>
                    <span className="mr-rank">{i + 1}</span>
                    <Avatar name={r.member} avatar={r.avatar} size={24} />
                    <span className="mr-name">{r.member}</span>
                    {r.won && <span className="mr-cup"><Trophy size={13} /></span>}
                    <span className="mr-days">{r.days_hit}d</span>
                    <span className="mr-points">{r.points}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <p className="league-fine">
        Each month starts from zero, so nobody runs away with it forever. Finished months stay
        here, bonus points included.
      </p>

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
              <th title="Bonus points this month: one for topping a day, two for winning a week">Bonus</th>
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
                  <BoardName {...reveal(row)} />
                </td>
                <td><b>{row.points_total}</b></td>
                <td>{row.points_today ?? 0}</td>
                <td>{row.streak_days ?? 0}</td>
                <td>{row.days_hit_month ?? 0}</td>
                <td>{row.bonus_month ? `+${row.bonus_month}` : 0}</td>
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
        fortnight against the {target} point target, so a full bar is a day they won.
      </p>
    </>
  );
}

// The last fortnight of the daily series, drawn against the target: a bar that
// reaches the top is a day won. Steady beats spiky, and a week's work done in
// one evening looks like exactly that.
function Trace({ daily, target }) {
  if (!daily) return <span className="hidden-cell" title="This member shows points only">·</span>;
  const last = daily.slice(-14);
  const hit = last.filter((n) => n >= target).length;
  const total = last.reduce((t, n) => t + n, 0);
  return (
    <span className="trace" title={`${total} points in the last 14 days · ${hit} ${hit === 1 ? 'day' : 'days'} won`}>
      {last.map((n, i) => (
        // A day with something on it must not look like a day with nothing.
        <i key={i} className={n >= target ? 'hit' : n ? '' : 'empty'}
           style={{ height: n ? `${Math.max(20, Math.min(100, (n / target) * 100))}%` : undefined }} />
      ))}
    </span>
  );
}

// The width the bar lands on, plus the stagger for its place in the list.
const growBar = (pct, rank) => ({ width: `${pct}%`, '--w': `${pct}%`, '--i': rank ?? 1 });

const cell = (v) => (v == null ? <span className="hidden-cell" title="This member shows points only">·</span> : v);

// ---------------------------------------------------------------------------
// Your points, and what they were made of. Yours alone: the points table
// carries an owner-only read policy, so the database will not return a league
// mate's rows to this request no matter what it asks for. Nobody sees the
// shape of anybody else's day here, only their total on the board.

function MyPointsPanel({ target }) {
  const [daily, setDaily] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let live = true;
    api('/api/points/breakdown?days=30')
      .then((d) => live && setDaily(d.daily ?? []))
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, []);

  if (err) return <p className="league-err">{err}</p>;
  if (!daily) return <p className="muted">Adding it up…</p>;

  return (
    <>
      <h3 className="panel-h">Your points, day by day</h3>
      {daily.length === 0 ? (
        <p className="muted">
          Nothing in the last 30 days. Log an application you sent since you joined and it
          shows up here with the points it earned.
        </p>
      ) : (
        <ul className="breakdown">
          {daily.map((d) => (
            <li key={d.day} className={d.total >= target ? 'won' : ''}>
              <div className="bd-head">
                <b>{longDate(d.day)}</b>
                <span className="bd-total">
                  {d.total} {d.total === 1 ? 'point' : 'points'}
                  {d.total >= target && <span className="bd-won">day won</span>}
                </span>
              </div>
              <ul className="bd-items">
                {d.items.map((it) => (
                  <li key={it.milestone}>
                    <span>{it.label}{it.count > 1 && <em> x{it.count}</em>}</span>
                    <span className="bd-pts">+{it.points}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="league-fine">
        Applying counts on the day you applied, so filling in last week's applications adds
        to last week. Reaching a screening or an interview counts on the day you record it.
        Anything you applied to before you first signed in is kept in your sheet but earns
        nothing here.
      </p>
    </>
  );
}

const longDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  const today = new Date().toISOString().slice(0, 10);
  if (iso === today) return 'Today';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
};

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

      <h3 className="panel-h">Bonus points</h3>
      <ul className="points-list bonus">
        <li>
          <span className="pv-label">
            <span className="pv-cup"><Trophy size={15} /></span>
            Top the day, by scoring highest of anyone
          </span>
          <span className="pv-points">+1</span>
        </li>
        <li>
          <span className="pv-label">
            <span className="pv-cup"><Trophy size={15} /></span>
            Win the week, by having the most points in it
          </span>
          <span className="pv-points">+2</span>
        </li>
      </ul>
      <p className="league-fine">
        Bonus points go on your monthly total and nowhere else. That keeps them out of the day
        they were won on, so a bonus can never decide who topped that day. You can see what you
        have banked on the monthly board.
      </p>

      <div className="rules">
        <h4>The rules</h4>
        <ul>
          <li><b>{target} points in a day wins the day.</b> That is the floor, not the ceiling, so
            everything past it still builds your week and your month. Anyone who reaches it has won
            that day, and the trophy goes to whoever scored highest.</li>
          <li><b>Win a week or a month</b> by having the most points in it. When the period ends
            the result is recorded, and stops changing.</li>
          <li><b>Every month starts from zero.</b> The finished month is kept, so you can still
            see it under Stats.</li>
          <li><b>Each milestone is earned once per application.</b> Getting to an interview is worth
            8 points in total: one for applying, then the rounds along the way.</li>
          <li><b>A rejection never takes points back.</b> Deleting the application does, which is what
            stops anyone stuffing the board and then tidying up after themselves.</li>
          <li><b>A row scores only once it names a role and a company</b>, and the same job logged
            twice scores once.</li>
          <li><b>Applications from before you first signed in never score.</b> Log them anyway.
            They sit in your sheet and your charts, which is where the honest history of your
            search belongs. They simply earn nothing in a league, and moving one forward later
            earns nothing either. Only jobs you applied to from your first day here can win you
            a day, so nobody can arrive with a backlog and jump the queue.</li>
          <li><b>A stage counts on the day you record it.</b> Applying keeps the date you applied,
            so filling in last week's applications adds to last week, but reaching a screening or
            an interview lands on today.</li>
          <li><b>Points are yours either way.</b> Everything in the first list above scores from
            the moment you log it, league or no league, and you can see your own run of them on
            the Charts tab. A league adds who you are measured against, and the two bonuses.</li>
        </ul>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------

function SettingsPanel({ league, leagues, profile, rows, busy, onSwitch, onProfile, onRename,
  onTarget, onRemove, onLeave, onCreate, onJoin }) {
  const reveal = useNameReveal();
  const host = rows.find((r) => r.user_id === league?.owner_id) ?? null;
  return (
    <>
      {/* No heading. The panel opens on your avatar and your name, which says
          "you" more clearly than the word does. */}
      {profile && <Settings profile={profile} onSave={onProfile} busy={busy} />}

      {leagues.length > 1 && (
        <>
          <h3 className="panel-h">Your leagues</h3>
          <ul className="member-list">
            {leagues.map((l) => (
              <li key={l.id} className={l.id === league?.id ? 'current' : ''}>
                <span className="member-who">
                  <b>{l.name}</b>
                  <small>{l.members} {l.members === 1 ? 'member' : 'members'}</small>
                  {l.is_owner && <span className="host">you host</span>}
                </span>
                {l.id === league?.id
                  ? <span className="muted small">Showing</span>
                  : <button className="viz-toggle" onClick={() => onSwitch(l.id)}>Show</button>}
              </li>
            ))}
          </ul>
          <p className="league-fine">
            You can be in as many leagues as you like. Points are yours, so the same day counts in
            every one of them.
          </p>
        </>
      )}

      <h3 className="panel-h">{league?.name}</h3>
      <div className="league-settings">
        <label className="field">
          <span>League name</span>
          {league?.is_owner
            ? <NameInput league={league} onSave={onRename} busy={busy} />
            : <div className="readonly-text">
                {league?.name}. Only the host can rename it.
              </div>}
        </label>

        <label className="field">
          <span>Daily target</span>
          {league?.is_owner
            ? <TargetInput league={league} onSave={onTarget} busy={busy} />
            : <div className="readonly-text">{league?.daily_target} points a day, set by the host.</div>}
        </label>

        <div className="field">
          <span>Members</span>
          <ul className="member-list">
            {rows.map((r) => {
              const isHost = r.user_id === league?.owner_id;
              return (
                <li key={r.user_id} className={r.is_me ? 'me' : ''}>
                  <span className="member-who">
                    <Avatar name={r.display_name} avatar={r.avatar} size={26} />
                    <BoardName {...reveal(r)} />
                    {isHost && <span className="host">host</span>}
                  </span>
                  {/* The host can remove anyone but themselves. Leaving is how
                      the host gets out, and that deletes the league. */}
                  {league?.is_owner && !isHost && (
                    <button className="viz-toggle" disabled={busy} onClick={() => onRemove(r)}>Remove</button>
                  )}
                </li>
              );
            })}
          </ul>
          <small className="league-fine">
            {league?.is_owner
              ? 'You host this league, so you can rename it, set the target and remove anyone. Whoever you remove keeps all of their own data and can rejoin with the code.'
              : `${host ? host.display_name : 'The host'} runs this league and sets the target.`}
          </small>
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

function NameInput({ league, onSave, busy }) {
  const [draft, setDraft] = useState(league?.name ?? '');
  useEffect(() => setDraft(league?.name ?? ''), [league?.name]);
  return (
    <input value={draft} maxLength={60} disabled={busy}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== league.name && onSave(draft)} />
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
      <small>points a day, the same for everyone in the league. That is what makes days won worth comparing.</small>
    </span>
  );
}

// Nothing here saves until you say so. Picking an avatar used to write
// immediately and the name wrote on blur, so you could change how you appear
// to your friends by clicking near something, and there was no way back short
// of remembering what it used to be.
// Each field saves on its own, with Cancel and Save appearing beside the
// thing that changed rather than in a bar at the bottom of the panel. The
// avatar grid is tall, so a single bar underneath it meant scrolling past
// thirty faces to confirm a click you had just made.
function Settings({ profile, onSave, busy }) {
  const saved = {
    display_name: profile.display_name ?? '',
    full_name: profile.full_name ?? '',
    avatar: profile.avatar ?? null,
    leaderboard_detail: profile.leaderboard_detail,
  };
  const [draft, setDraft] = useState(saved);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const revert = (key) => set({ [key]: saved[key] });

  // Follow the saved profile when it changes under us, which it does after a
  // save lands and if another tab edits it.
  useEffect(() => {
    setDraft({
      display_name: profile.display_name ?? '',
      full_name: profile.full_name ?? '',
      avatar: profile.avatar ?? null,
      leaderboard_detail: profile.leaderboard_detail,
    });
  }, [profile.display_name, profile.full_name, profile.avatar, profile.leaderboard_detail]);

  const actions = (key) => (
    <FieldActions dirty={draft[key] !== saved[key]} busy={busy}
      onCancel={() => revert(key)} onSave={() => onSave({ [key]: draft[key] })} />
  );

  return (
    <div className="league-settings">
      <div className="field">
        <span className="field-head">Your avatar</span>
        <div className="avatar-pick">
          <div className="avatar-now">
            <Avatar name={draft.display_name} avatar={draft.avatar} size={76} />
          </div>
          <div className="avatar-groups">
            {AVATAR_GROUPS.map((group, gi) => (
              <div key={group.label}>
                <small className="avatar-group-label">{group.label}</small>
                <div className="avatar-row">
                  <div className="avatar-grid">
                    {group.keys.map((a, i) => (
                      <button key={a} type="button" disabled={busy}
                        className={`avatar-opt ${draft.avatar === a ? 'on' : ''}`}
                        aria-pressed={draft.avatar === a} title={`${group.label} ${i + 1}`}
                        onClick={() => set({ avatar: draft.avatar === a ? null : a })}>
                        <Avatar name={draft.display_name} avatar={a} size={44} />
                      </button>
                    ))}
                  </div>
                  {/* Beside the last row of faces, not up by the heading: that
                      is a long way from the one you just clicked, and on a wide
                      screen it is the far corner of the panel. */}
                  {gi === AVATAR_GROUPS.length - 1 && actions('avatar')}
                </div>
              </div>
            ))}
          </div>
        </div>
        <small className="league-fine">
          Pick one, or click it again to go back to your initial.
        </small>
      </div>

      <div className="field">
        <label className="field-head" htmlFor="board-name">Name on the board</label>
        <div className="field-inline">
          <input id="board-name" value={draft.display_name} maxLength={40}
            onChange={(e) => set({ display_name: e.target.value })} />
          {actions('display_name')}
        </div>
      </div>

      <div className="field">
        <label className="field-head" htmlFor="real-name">Your name</label>
        <div className="field-inline">
          <input id="real-name" value={draft.full_name} maxLength={60} required
            placeholder="First name is enough"
            onChange={(e) => set({ full_name: e.target.value })} />
          {actions('full_name')}
        </div>
        <small className="league-fine">
          So a handle on the board says who you are. Only the people in your leagues see it, and
          only for the three seconds after they tap your name. A first name is enough; you do not
          have to give the rest.
        </small>
      </div>

      <fieldset className="field detail">
        <span className="field-head">What friends see {actions('leaderboard_detail')}</span>
        {[
          ['counts', 'Points and how you got them',
            'Friends see your points, streak and days won, plus how many jobs you applied to, how many interviews you reached and how many offers you got. Your points for each day are drawn as a line on the monthly chart.'],
          ['points', 'Points only',
            'Friends see your points, streak and days won, and nothing else. Not how many jobs you applied to, not your interviews or offers, and no line for you on the monthly chart.'],
        ].map(([id, label, hint]) => (
          <label key={id} className="radio">
            <input type="radio" name="detail" value={id} disabled={busy}
              checked={draft.leaderboard_detail === id}
              onChange={() => set({ leaderboard_detail: id })} />
            <span><b>{label}</b><small>{hint}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="league-fine">Your job titles, companies, pay and notes are never shared, either way.</p>
    </div>
  );
}

function FieldActions({ dirty, busy, onCancel, onSave }) {
  if (!dirty) return null;
  return (
    <span className="field-actions">
      <button type="button" className="tiny-btn" disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className="tiny-btn primary" disabled={busy} onClick={onSave}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </span>
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

function Pill({ label, value, tone, icon }) {
  return (
    <span className={`pill ${tone === 'hot' ? 'hot' : ''}`}>
      {icon}<b>{value}</b> {label}
    </span>
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
            Make a league and send the code to a friend. Every application earns points, every round
            you reach earns more, and clearing the daily target wins you the day. Weekly and monthly
            winners get recorded when the period ends. Your friends never see which jobs you
            applied to.
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
