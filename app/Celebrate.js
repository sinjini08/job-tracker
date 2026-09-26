'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Trophy } from './Icons';
import { RISE, tryPlayMark } from '@/lib/mark-sound';
import { soundOn } from '@/lib/sound-pref';

// A trophy and a burst of confetti across the screen for a couple of seconds
// when you win a day, a week or a month.
//
// It fires once per win, ever: `seenKey` is written to localStorage, so
// reloading the page or coming back tomorrow doesn't replay yesterday's
// party. It also respects prefers-reduced-motion — the trophy still appears,
// the confetti doesn't. A chime plays with it unless sound is switched
// off in Settings.

// When the last chime started. React mounts an effect twice in development
// (StrictMode), and a sound that is already scheduled cannot be called back,
// so without this the chime plays over itself in dev and sounds like a fault
// in the sound rather than in the harness. Two real celebrations queue 2600ms
// apart, well clear of this window, so the second still gets its own chime.
let lastChime = 0;

const COLORS = ['#1f9d55', '#69b57f', '#f1d68a', '#e0651f', '#2a78d6', '#d1478c'];
const PIECES = 90;
const HOLD_MS = 2600;

export function useCelebration() {
  const [queue, setQueue] = useState([]);
  const fired = useRef(new Set());

  // Remember a win the moment it's shown, so it never replays.
  const celebrate = (key, title, detail) => {
    if (!key || fired.current.has(key)) return;
    try {
      if (localStorage.getItem(`jt_won_${key}`)) { fired.current.add(key); return; }
      localStorage.setItem(`jt_won_${key}`, '1');
    } catch { /* private window: it just replays next time, which is harmless */ }
    fired.current.add(key);
    setQueue((q) => [...q, { key, title, detail }]);
  };

  const current = queue[0] ?? null;
  const dismiss = () => setQueue((q) => q.slice(1));
  // `key` is destructured out rather than spread: React treats it specially
  // and warns when it arrives as part of a props object.
  return {
    celebrate,
    node: current
      ? <Celebration key={current.key} title={current.title} detail={current.detail} onDone={dismiss} />
      : null,
  };
}

function Celebration({ title, detail, onDone }) {
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const pieces = useMemo(() => Array.from({ length: reduced ? 0 : PIECES }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() - 0.5) * 900,
    color: COLORS[i % COLORS.length],
    size: 6 + Math.random() * 7,
    round: Math.random() > 0.65,
  })), [reduced]);

  // Mount only, and deliberately not folded into the effect below: that one
  // re-runs whenever the league re-renders, and a chime that replayed on a
  // refetch would stutter. A new win remounts this, because the queue keys
  // each celebration, so mounting is exactly once per win.
  useEffect(() => {
    if (!soundOn()) return;
    if (Date.now() - lastChime < 1500) return;
    lastChime = Date.now();
    // There is no animation to wait for here, so the sound starts now and the
    // impact lands 340ms in, under the confetti with the card arriving. It
    // plays only if the page has been clicked at some point: audio cannot
    // start in an untouched document, and tryPlayMark gives up quietly.
    tryPlayMark(1, RISE);
  }, []);

  useEffect(() => {
    const t = setTimeout(onDone, HOLD_MS);
    const onKey = (e) => e.key === 'Escape' && onDone();
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [onDone]);

  return (
    <div className="celebrate" role="status" aria-live="polite" onClick={onDone}>
      <div className="confetti" aria-hidden>
        {pieces.map((p) => (
          <i key={p.id} className={p.round ? 'round' : ''} style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * (p.round ? 1 : 1.6),
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': `${p.drift}px`,
            '--spin': `${p.spin}deg`,
          }} />
        ))}
      </div>
      <div className="celebrate-card">
        <div className="cup-big"><Trophy size={62} /></div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
    </div>
  );
}
