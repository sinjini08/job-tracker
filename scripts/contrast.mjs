// Every colour pair in globals.css that carries text, checked.
//
//   npm run contrast
//
// The light palette was measured once when it was chosen. A second theme
// doubles the number of pairs that can be wrong, and a dark chip that looks
// fine to one pair of eyes on one screen is exactly the kind of thing that
// ships broken. So the file is parsed and the numbers computed.
//
// Two measures, both on the pairs that matter:
//   WCAG contrast, where small text needs 4.5:1
//   OKLab distance between chip inks, where neighbours under 8 read as one
//     colour to a colourblind reader (the threshold the light set was built to)

import { readFileSync } from 'fs';

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

// The light values are on :root; the dark ones on :root[data-theme="dark"].
// The media-query copy is checked against the attribute copy rather than
// measured twice, because the two drifting apart is its own kind of bug.
const block = (re) => {
  const m = css.match(re);
  if (!m) throw new Error(`could not find block: ${re}`);
  return Object.fromEntries([...m[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)]
    .map(([, k, v]) => [k, v.trim()]));
};
// Some tokens point at others (--head-bg is var(--paper)), and a token the
// dark block does not restate keeps its light value. Both have to be followed
// or the measurement is of the wrong colour, or of nothing at all.
const resolve = (vars, base = vars) => {
  const seen = new Map();
  const walk = (key, depth = 0) => {
    if (seen.has(key)) return seen.get(key);
    if (depth > 8) throw new Error(`token loop at ${key}`);
    const raw = vars[key] ?? base[key];
    if (raw === undefined) return undefined;
    const ref = raw.match(/^var\((--[\w-]+)\)$/);
    const out = ref ? walk(ref[1], depth + 1) : raw;
    seen.set(key, out);
    return out;
  };
  return new Proxy({}, { get: (_, k) => walk(String(k)) });
};

const light = block(/:root \{([\s\S]*?)\n\}/);
const vizLight = block(/\.viz-root \{([\s\S]*?)\n\}/);
const vizDark = block(/:root\[data-theme="dark"\] \.viz-root,[\s\S]*?\{([\s\S]*?)\n\}/);
const dark = block(/:root\[data-theme="dark"\] \{([\s\S]*?)\n\}/);
const media = block(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\) \{([\s\S]*?)\n  \}/);

const hex = (c) => {
  const h = c.replace('#', '').trim();
  const full = h.length === 3 ? [...h].map((x) => x + x).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
};
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (c) => { const [r, g, b] = hex(c).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
// OKLab, for perceptual distance rather than RGB distance.
const oklab = (c) => {
  const [r, g, b] = hex(c).map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
};
const deltaE = (a, b) => {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(...x.map((v, i) => (v - y[i]) * 100));
};

let failed = 0;
const say = (pass, msg) => { if (!pass) failed += 1; console.log(`  ${pass ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${msg}`); };

const CHIPS = ['wishlist', 'applied', 'screening', 'oa', 'interviewing', 'final',
  'offer', 'accepted', 'rejected', 'withdrawn', 'noreply', 'high', 'medium', 'low'];
// Neighbours in the pipeline, where confusing one for the other actually
// misleads. Screening against Offer and Final against Rejected are in here
// because those two pairs mean opposite things.
const CONFUSABLE = [['applied', 'screening'], ['screening', 'offer'],
  ['final', 'rejected'], ['offer', 'accepted']];
// Interviewing and Medium share an ink, as do Wishlist and Low, and that is
// deliberate: a status chip and a priority chip never appear in the same
// column, so the palette reuses a hue rather than inventing a fourteenth.
const SHARED = [['interviewing', 'medium'], ['wishlist', 'low']];

for (const [name, raw] of [['Light', light], ['Dark', dark]]) {
  const vars = resolve(raw, light);
  console.log(`\n${name}`);
  say(contrast(vars['--text'], vars['--bg']) >= 4.5,
    `body text on the page: ${contrast(vars['--text'], vars['--bg']).toFixed(2)}:1`);
  say(contrast(vars['--text'], vars['--surface']) >= 4.5,
    `body text on a card: ${contrast(vars['--text'], vars['--surface']).toFixed(2)}:1`);
  say(contrast(vars['--muted'], vars['--surface']) >= 4.5,
    `muted text on a card: ${contrast(vars['--muted'], vars['--surface']).toFixed(2)}:1`);
  say(contrast(vars['--head-text'], vars['--head-bg']) >= 4.5,
    `header text on the header: ${contrast(vars['--head-text'], vars['--head-bg']).toFixed(2)}:1`);
  say(contrast(vars['--due'], vars['--surface']) >= 4.5,
    `overdue red on a card: ${contrast(vars['--due'], vars['--surface']).toFixed(2)}:1`);
  // The gutter and the frozen column carry row numbers and field names, so
  // they are text surfaces, not decoration. This is the pair that shipped
  // broken the first time: a near-white gutter that never flipped, with the
  // dark theme's near-white text on it, at 1.15:1.
  say(contrast(vars['--text'], vars['--gutter']) >= 4.5,
    `row numbers on the gutter: ${contrast(vars['--text'], vars['--gutter']).toFixed(2)}:1`);
  // The "won the day" chip: white on the bar's green. It used to be white on
  // --series-1, a chart hue that was never chosen to carry text, and measured
  // 3.49:1 in light and 2.24:1 in dark. Nothing rendered it until a league
  // with members was finally put on screen.
  say(contrast('#ffffff', vars['--xl-green']) >= 4.5,
    `white on the bar's green: ${contrast('#ffffff', vars['--xl-green']).toFixed(2)}:1`);
  say(contrast(vars['--green-ink'], vars['--surface']) >= 4.5,
    `green as text on a card: ${contrast(vars['--green-ink'], vars['--surface']).toFixed(2)}:1`);
  say(contrast(vars['--link'], vars['--surface']) >= 4.5,
    `a link in a cell: ${contrast(vars['--link'], vars['--surface']).toFixed(2)}:1`);
  say(contrast(vars['--text'], vars['--hover']) >= 4.5,
    `text on a hovered button: ${contrast(vars['--text'], vars['--hover']).toFixed(2)}:1`);

  for (const c of CHIPS) {
    const r = contrast(vars[`--chip-${c}-fg`], vars[`--chip-${c}-bg`]);
    say(r >= 4.5, `chip ${c}: ${r.toFixed(2)}:1`);
  }
  for (const [a, b] of CONFUSABLE) {
    const d = deltaE(vars[`--chip-${a}-fg`], vars[`--chip-${b}-fg`]);
    say(d >= 8, `${a} vs ${b}: ${d.toFixed(1)} apart`);
  }
  for (const [a, b] of SHARED) {
    say(vars[`--chip-${a}-fg`] === vars[`--chip-${b}-fg`],
      `${a} and ${b} still share an ink`);
  }
}

// The funnel ramp and the calendar. These are filled marks rather than text,
// so the bar is lower than 4.5:1, but a step you cannot tell from the card it
// sits on carries no information, and neither does one you cannot tell from
// the step beside it. The dark ramp shipped once at 1.4:1 on its first step.
for (const [name, viz, surfaceKey] of [['Light', vizLight, '--viz-surface'], ['Dark', vizDark, '--viz-surface']]) {
  console.log(`\n${name} charts`);
  const v = resolve(viz, { ...light, ...vizLight });
  const surface = v[surfaceKey];
  const ramp = [1, 2, 3, 4, 5, 6, 7].map((i) => v[`--ord-${i}`]);
  // 1.4 rather than 4.5, and the reason matters. These are filled bars and
  // calendar cells, and every one of them sits beside its own text label and
  // its own count, so the colour is never the only thing carrying the value.
  // What the ramp has to do is progress: neighbours far enough apart to read
  // as steps, and no step lost in the card. The light ramp's palest step is
  // 1.65:1 by its own design, which is the floor this bar is set just under.
  ramp.forEach((c, i) => {
    const r = contrast(c, surface);
    say(r >= 1.4, `ord-${i + 1} against the card: ${r.toFixed(2)}:1`);
  });
  say(deltaE(ramp[0], ramp[6]) >= 40,
    `the ramp spans a real range: ${deltaE(ramp[0], ramp[6]).toFixed(0)} end to end`);
  ramp.slice(1).forEach((c, i) => {
    const d = deltaE(ramp[i], c);
    say(d >= 5, `ord-${i + 1} to ord-${i + 2}: ${d.toFixed(1)} apart`);
  });
  for (const k of ['--viz-wait', '--viz-over']) {
    const r = contrast(v[k], surface);
    say(r >= 1.35, `${k.replace('--viz-', '')} against the card: ${r.toFixed(2)}:1`);
    // Neutral, so it must not be mistaken for a step on the green scale.
    const d = deltaE(v[k], v['--ord-4']);
    say(d >= 10, `${k.replace('--viz-', '')} is clearly not a green step: ${d.toFixed(1)} apart`);
  }
  const series = [1, 2, 3, 4, 5].map((i) => v[`--series-${i}`]);
  series.forEach((c, i) => {
    const r = contrast(c, surface);
    say(r >= 1.9, `series-${i + 1} against the card: ${r.toFixed(2)}:1`);
  });
  for (let i = 0; i < series.length - 1; i += 1) {
    const d = deltaE(series[i], series[i + 1]);
    say(d >= 15, `series-${i + 1} to series-${i + 2}: ${d.toFixed(1)} apart`);
  }
}

console.log('\nThe two dark copies');
const drift = Object.keys(dark).filter((k) => dark[k] !== media[k]);
say(drift.length === 0, drift.length ? `media query has drifted: ${drift.join(', ')}` : 'attribute and media query agree');

console.log(failed ? `\n\x1b[31m${failed} failed\x1b[0m` : '\n\x1b[32mall passed\x1b[0m');
process.exit(failed ? 1 : 0);
