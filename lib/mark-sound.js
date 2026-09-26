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
//   520    the dart sets off
//   1280   it hits, and the ring goes out
//   2430   the ring has faded
//
// Kept quiet on purpose. Every gain here is a fraction of what it could be,
// because this plays unbidden and the second time somebody hears it they
// should barely notice it.

// Only the impact matters now; the rest is here because the animation's
// own timings are worth keeping written down next to the sound that lands on
// one of them.
const T = { draw: 0, dart: 0.52, hit: 1.28, end: 2.43 };

// Band-limited noise that swells and is cut, for the air under the rise.
//
// Noise came out of this piece on purpose, because it is the thing that
// makes a sound read as sound design rather than as an instrument. It is
// back for one voice and at a fifth of the level the old whoosh used, which
// is a different proposition: air underneath a tonal sweep, rather than a
// noise whoosh carrying the whole flight.
let noise = null;
function air(ctx, out, { at, dur, peak, from, to, q = 1.6 }) {
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = noise;
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(peak * 0.1, at);
  g.gain.exponentialRampToValueAtTime(peak, at + dur);
  g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.01);
  src.connect(f).connect(g).connect(out);
  src.start(at, 0, Math.min(dur + 0.1, 1));
}

// A tone that starts, slides and stops. Every voice in the piece is one of
// these, or a struck note built from three of them.
// snap: true starts at full level on the sample, with no ramp at all. That
// is what a click is. A 2ms attack sounds soft however short the sound is,
// and the old hit used 2ms on every voice, which is why it thudded instead
// of cracking.
function tone(ctx, out, { type = 'sine', from, to, at, dur, peak, attack = 0.004, snap = false, swell = false }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  // A swell starts from a tenth of where it is going, not from silence. An
  // exponential ramp out of 0.0001 spends most of its length inaudible and
  // only arrives at the last moment, which is why the rise was barely there:
  // it was technically present for 260ms and audible for about 40 of them.
  g.gain.setValueAtTime(snap ? peak : (swell ? peak * 0.1 : 0.0001), at);
  if (swell) {
    // Louder for its whole length, then cut. The impact lands on the cut and
    // covers it, which is how the rise hands over instead of colliding.
    g.gain.exponentialRampToValueAtTime(peak, at + dur);
    g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.008);
  } else {
    if (!snap) g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  }
  osc.connect(g).connect(out);
  osc.start(at);
  osc.stop(at + dur + 0.03);
}

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
  // 1, 2 and just under 4. The 3x that used to be here is a twelfth, which
  // is the hollow, organ-like interval; struck bars and glass put their
  // strong upper partial near 4x, and that is where the sparkle in an Apple
  // chime comes from. Slightly under 4 rather than exactly, because exact
  // multiples sound computed.
  const partials = [
    { mult: 1, gain: 1, len: 1 },
    { mult: 2, gain: 0.34, len: 0.58 },
    { mult: 3.93, gain: 0.13, len: 0.3 },
  ];
  // The fundamental is doubled a few cents flat. Two voices that close beat
  // against each other about twice a second, and that slow movement is the
  // difference between a note that sounds alive and one that sits still. It
  // is the cheapest richness there is.
  const voices = partials.flatMap((part) => (
    part.mult === 1
      ? [part, { ...part, mult: 1 * 0.9977, gain: part.gain * 0.7 }]
      : [part]
  ));
  for (const part of voices) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    // A struck bar falls a few cents as it decays. Almost subliminal, and
    // its absence is part of what makes a synthesised bell sound synthesised.
    osc.frequency.setValueAtTime(hz * part.mult, at);
    osc.frequency.exponentialRampToValueAtTime(hz * part.mult * 0.996, at + dur * part.len);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak * part.gain, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur * part.len);
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + dur * part.len + 0.02);
  }
}

// The piece, as two voices at one moment. One place, so auditioning a beat
// on its own cannot drift from the same beat inside the whole.
//
// It used to have four beats across two and a half seconds: a hum while the
// target drew itself, a noise whoosh along the dart's flight, a noise-and-sub
// impact, and a five-note chord. That is a sound effect. What was wanted was
// something closer to an Apple system sound, and those differ in four ways
// that all pull the same direction.
//
// They are tonal. Almost nothing in the iOS set uses filtered noise, and
// noise is the single thing that reads as sound design rather than as an
// instrument. Both noise voices are gone, which is why nothing here uses the
// noise buffer any more.
//
// They avoid the low end. This used to put its body at 190Hz falling to 92,
// which is inaudible on a phone and a thud on a laptop. Everything now sits
// between 900 and 2500Hz, where a small speaker can actually reproduce it.
//
// They mark a moment rather than scoring a sequence. The hum and the whoosh
// narrated the animation; silence until the dart lands says the same thing
// with less.
//
// And they are short. Two notes and a tap over about 700 milliseconds, not
// five notes over 2430. The ring on screen carries on fading in silence,
// which turns out to be better than hearing it fade.
const BEATS = {
  // The last quarter second of the dart's flight. Tonal, so it stays in the
  // same family as everything else: the noise whoosh this replaces was the
  // least Apple thing in the piece.
  //
  // It climbs an octave and lands on the chime's own root, so the rise and
  // the chord are the same note arriving twice. Quiet enough that on a
  // laptop at normal volume it reads as anticipation rather than as a sound.
  rise: (ctx, out, t) => {
    // Longer and louder than it was. At 260ms and a fifth of these levels it
    // read as nothing at all: the animation has the dart in flight for
    // 760ms, and something should be building for a useful part of that.
    const dur = 0.34;
    // The backbone is still tonal and still lands on the chime's root, so
    // the rise and the chord remain the same note arriving twice.
    tone(ctx, out, { type: 'sine', from: 311, to: 622.25, at: t, dur, peak: 0.026, swell: true });
    tone(ctx, out, { type: 'sine', from: 622.25, to: 1244.5, at: t, dur, peak: 0.024, swell: true });
    // A triangle on the top voice rather than a sine. Its extra partials are
    // what give the sweep something to whoosh with; a pure sine sliding up
    // is a test tone.
    tone(ctx, out, { type: 'triangle', from: 622.25, to: 2489, at: t, dur, peak: 0.016, swell: true });
    // And the air, sweeping wider than the notes so the movement reads ahead
    // of them. It leads rather than sits underneath: with the low sine on top
    // of it the rise measured 1204 zero crossings a second, which is a slide
    // rather than a whoosh. The tonal voices came down to let it through.
    air(ctx, out, { at: t, dur, peak: 0.055, from: 380, to: 3600, q: 1.2 });
  },

  // The dart landing: a soft tonal tap, not a thock. Two sine partials an
  // octave apart with a couple of milliseconds of attack, which is what
  // makes a tap feel soft rather than snapped.
  hit: (ctx, out, t) => {
    // A body partial at Bb4. Not the 92Hz sub this used to have, which no
    // phone reproduces, and not nothing, which is what made the tap a click
    // with no weight behind it.
    tone(ctx, out, { type: 'sine', from: 466, to: 415, at: t, dur: 0.1, peak: 0.055, attack: 0.002 });
    tone(ctx, out, { type: 'sine', from: 1046.5, to: 932, at: t, dur: 0.075, peak: 0.06, attack: 0.0018 });
    tone(ctx, out, { type: 'sine', from: 2093, to: 1864, at: t, dur: 0.045, peak: 0.022, attack: 0.0015 });
  },

  // The chime: a fifth struck together, and one note above it a breath later.
  // Struck together because a bare sequence reads as a doorbell; the late
  // third note is where the movement comes from.
  ring: (ctx, out, t) => {
    const ROOT = 1244.5;                     // Eb6, unchanged: the chord still
    const up = (semitones) => ROOT * 2 ** (semitones / 12);   // reads as high
    // Richness comes from underneath and from the third, not from moving the
    // whole thing down. Everything above 900Hz and nothing else was what made
    // this squeak: a sound with no energy in the 300 to 600 band has nothing
    // to stand on. The octave below is the floor and rings longest; the
    // fourth below fills the gap above it.
    chime(ctx, out, { at: t, hz: up(-12), peak: 0.03, dur: 0.78 });
    chime(ctx, out, { at: t + 0.003, hz: up(-5), peak: 0.022, dur: 0.7 });
    chime(ctx, out, { at: t + 0.006, hz: up(0), peak: 0.05, dur: 0.66 });
    // The major third, back in. Root, fifth and octave is a bare, hollow
    // voicing; the third is what makes a chord sound warm rather than open.
    chime(ctx, out, { at: t + 0.009, hz: up(4), peak: 0.028, dur: 0.62 });
    chime(ctx, out, { at: t + 0.012, hz: up(7), peak: 0.03, dur: 0.6 });
    chime(ctx, out, { at: t + 0.105, hz: up(12), peak: 0.02, dur: 0.44 });
  },
};

// 0.42, down from 0.55. Turned down here rather than by thinning the voices
// out, so the richness the eleven of them buy is kept and only the loudness
// changes. Level and character are separate dials and this is the level one.
const bus = (ctx, level) => {
  const out = ctx.createGain();
  out.gain.value = Math.max(0, Math.min(1, level)) * 0.42;
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
  // Silence until the dart lands. The animation runs for 2430ms and the
  // sound is about 700 of them, starting at the impact.
  const at = ctx.currentTime + 0.02 + T.hit;
  BEATS.rise(ctx, out, at - 0.34);
  BEATS.hit(ctx, out, at);
  BEATS.ring(ctx, out, at + 0.004);
  return T.hit + 0.72;
}

/** One beat on its own, for judging it. */
export function playPart(ctx, which, level = 1) {
  const beat = BEATS[which];
  if (!beat) return 0;
  beat(ctx, bus(ctx, level), ctx.currentTime + 0.02);
  return { ring: 0.72, rise: 0.38, hit: 0.12 }[which] ?? 0.2;
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
