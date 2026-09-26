// The opening, as a sound.
//
// Synthesised rather than a file. A splash sound is a few hundred
// milliseconds of noise and two thumps; making it in the browser costs no
// download, and it can be placed on the animation's own beats to the
// millisecond instead of hoping a recording lines up.
//
// The beats are the ones in globals.css, and they are the reason the timings
// below look arbitrary:
//
//   0      the target starts drawing itself
//   740    the bullseye lands
//   520    the dart sets off
//   1280   it hits, and the ring goes out
//   2430   the ring has faded
//
// Kept quiet on purpose. Every gain here is a fraction of what it could be,
// because this plays unbidden and the second time somebody hears it they
// should barely notice it.

const T = { draw: 0, dot: 0.74, dart: 0.52, hit: 1.28, end: 2.43 };

// One second of white noise, made once and reused for the whoosh, the click
// and the ring's tail.
let noise = null;
function noiseBuffer(ctx) {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  noise = buf;
  return buf;
}

// A tone that starts, slides and stops. Every voice here is one of these or
// a burst of the noise above.
// snap: true starts at full level on the sample, with no ramp at all. That
// is what a click is. A 2ms attack sounds soft however short the sound is,
// and the old hit used 2ms on every voice, which is why it thudded instead
// of cracking.
function tone(ctx, out, { type = 'sine', from, to, at, dur, peak, attack = 0.004, snap = false }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  if (snap) g.gain.setValueAtTime(peak, at);
  else {
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

// swell: true means it gets louder for its whole length and stops, instead of
// hitting a peak and fading. The dart needs that and nothing else does: a
// whoosh that decays before the thump sounds like the dart stopped in mid
// air. Measured at 0.005 in the 100ms before impact when it should have been
// at its loudest there.
// A struck note, modern-chime flavoured.
//
// Three partials at whole multiples, each quieter and shorter than the last.
// The decreasing decay is the whole trick: in a struck object the high
// partials die first, and that is what the ear reads as struck rather than
// blown. A flat set of equal-length partials is an organ.
//
// The third partial is pulled very slightly sharp. Exact multiples sound
// synthetic; real bells are a little inharmonic up top, and a few cents is
// the difference between a chime and a test tone.
function chime(ctx, out, { at, hz, peak, dur }) {
  const partials = [
    { mult: 1, gain: 1, len: 1 },
    { mult: 2, gain: 0.42, len: 0.62 },
    { mult: 3.02, gain: 0.17, len: 0.38 },
  ];
  for (const part of partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz * part.mult;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak * part.gain, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur * part.len);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur * part.len + 0.02);
  }
}

function burst(ctx, out, { at, dur, peak, filter = 'bandpass', from, to, q = 1, attack = 0.01, swell = false, snap = false }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  f.type = filter;
  f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  if (to && to !== from) f.frequency.exponentialRampToValueAtTime(to, at + dur);
  if (snap) g.gain.setValueAtTime(peak, at);
  else g.gain.setValueAtTime(0.0001, at);
  if (snap) {
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  } else if (swell) {
    g.gain.exponentialRampToValueAtTime(peak, at + dur);
    // Cut rather than faded: the thump lands here and covers the edge.
    g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.012);
  } else {
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }
  src.connect(f).connect(g).connect(out);
  src.start(at, 0, Math.min(dur + 0.08, 1));
}

// Every voice in the piece, grouped by the beat it belongs to. One place, so
// auditioning a single beat cannot drift from the beat inside the whole.
const BEATS = {
  draw: (ctx, out, t) => {
    // The target drawing itself: a slow rise, barely there, so the silence
    // before the dart is not quite silent.
    tone(ctx, out, { type: 'sine', from: 196, to: 392, at: t, dur: 0.95, peak: 0.02, attack: 0.3 });
  },
  dot: (ctx, out, t) => {
    // The bullseye landing. A tick, not a note.
    tone(ctx, out, { type: 'triangle', from: 1320, to: 880, at: t, dur: 0.07, peak: 0.05 });
  },
  dart: (ctx, out, t) => {
    // From the moment it sets off to the moment it lands, rising through the
    // band as it comes at you.
    burst(ctx, out, { at: t, dur: T.hit - T.dart, peak: 0.16, from: 260, to: 2600, q: 0.8, swell: true });
  },
  hit: (ctx, out, t) => {
    // A dart into sisal is dry and mid-heavy with almost no sustain, and the
    // satisfying part is the first three milliseconds. Four voices, all
    // starting on the sample with no attack ramp at all.
    //
    // The click: broadband and very short. Thirty-five milliseconds of
    // highpassed noise, which is what this used to be, is a hiss; three
    // milliseconds is a tick.
    burst(ctx, out, { at: t, dur: 0.003, peak: 0.5, filter: 'highpass', from: 3800, q: 0.5, snap: true });
    // The knock: a narrow band of noise around a wooden pitch, which is the
    // sound of the board rather than the point.
    burst(ctx, out, { at: t, dur: 0.028, peak: 0.34, filter: 'bandpass', from: 1100, to: 620, q: 5, snap: true });
    // The body: short, dense, and stopping well above the sub. It used to
    // slide to 52Hz over 220ms, which is a soft boom on a laptop speaker and
    // nothing at all on a phone.
    tone(ctx, out, { type: 'sine', from: 210, to: 96, at: t, dur: 0.085, peak: 0.44, snap: true });
    // And the rim, pitched, giving the hit a note to land on.
    tone(ctx, out, { type: 'triangle', from: 440, to: 300, at: t, dur: 0.045, peak: 0.16, snap: true });
  },
  ring: (ctx, out, t) => {
    // A chord, not a melody. C6, E6 and G6 sounding together, staggered by a
    // few milliseconds each so the ear hears one struck thing rather than
    // three, which is the difference between a harmonised chime and an
    // arpeggio. Two notes in sequence read as a doorbell.
    //
    // A major triad because it resolves. The stack is deliberately quiet at
    // the top: the third and the fifth colour the root rather than competing
    // with it.
    const tail = T.end - T.hit;
    chime(ctx, out, { at: t, hz: 1046.5, peak: 0.062, dur: tail });
    chime(ctx, out, { at: t + 0.007, hz: 1318.5, peak: 0.04, dur: tail * 0.92 });
    chime(ctx, out, { at: t + 0.014, hz: 1568, peak: 0.032, dur: tail * 0.85 });
    // One octave up, late and faint, so the tail lifts as it fades instead of
    // just getting quieter.
    chime(ctx, out, { at: t + 0.15, hz: 2093, peak: 0.016, dur: tail * 0.55 });
  },
};

const bus = (ctx, level) => {
  const out = ctx.createGain();
  out.gain.value = Math.max(0, Math.min(1, level)) * 0.55;
  out.connect(ctx.destination);
  return out;
};

/**
 * Play the opening. Returns its length in seconds, scheduled not finished.
 * @param {AudioContext} ctx  a context that is already running
 * @param {number} level  0 to 1, the whole thing
 */
export function playMark(ctx, level = 1) {
  const out = bus(ctx, level);
  const t0 = ctx.currentTime + 0.02;
  BEATS.draw(ctx, out, t0 + T.draw);
  BEATS.dot(ctx, out, t0 + T.dot);
  BEATS.dart(ctx, out, t0 + T.dart);
  BEATS.hit(ctx, out, t0 + T.hit);
  BEATS.ring(ctx, out, t0 + T.hit + 0.02);
  return T.end;
}

/** One beat on its own, for judging it. */
export function playPart(ctx, which, level = 1) {
  const beat = BEATS[which];
  if (!beat) return 0;
  beat(ctx, bus(ctx, level), ctx.currentTime + 0.02);
  return which === 'ring' ? T.end - T.hit : 1;
}

/**
 * Play it if the browser will allow it, and say whether it did.
 *
 * Audio cannot start in a document nobody has touched yet, which is exactly
 * the situation the opening plays in. So this never waits, never prompts, and
 * reports false rather than leaving a suspended context lying around.
 */
export async function tryPlayMark(level = 1) {
  const Ctx = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return false;
  let ctx;
  try {
    ctx = new Ctx();
    if (ctx.state === 'suspended') {
      // resume() only succeeds off the back of a gesture. Trying costs
      // nothing and tells us which case we are in.
      await ctx.resume().catch(() => {});
    }
    if (ctx.state !== 'running') { await ctx.close().catch(() => {}); return false; }
    const secs = playMark(ctx, level);
    setTimeout(() => ctx.close().catch(() => {}), (secs + 0.4) * 1000);
    return true;
  } catch {
    try { await ctx?.close(); } catch { /* nothing to close */ }
    return false;
  }
}
