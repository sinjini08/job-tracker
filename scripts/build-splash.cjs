// Split the logo mark into its two moving parts for the sign-in splash.
//   node scripts/build-splash.cjs
//
// Output: public/brand/splash-rings.png and public/brand/splash-dart.png,
// both the same canvas size as the source, so drawing one on top of the other
// at the same size reproduces the logo exactly, pixel for pixel. Nothing is
// redrawn or traced.
//
// This works because the dart and the rings are separate shapes in the
// artwork: the rings carry gaps where the dart crosses them, so the two never
// touch. A flood fill from every lit pixel finds exactly two blobs, and the
// one whose centre of mass sits up and to the right is the dart.
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'public', 'brand', 'mark-white.png');
const OUT = path.join(root, 'public', 'brand');

(async () => {
  const src = sharp(SRC).ensureAlpha();
  const { width, height } = await src.metadata();
  const { data } = await src.raw().toBuffer({ resolveWithObject: true });
  const lit = (i) => data[i * 4 + 3] > 128;

  const label = new Int32Array(width * height);
  const blobs = [];
  for (let start = 0; start < width * height; start++) {
    if (!lit(start) || label[start]) continue;
    const id = blobs.length + 1;
    const pixels = [];
    let sx = 0, sy = 0;
    const stack = [start];
    label[start] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % width, y = (p - x) / width;
      pixels.push(p);
      sx += x; sy += y;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (!label[q] && lit(q)) { label[q] = id; stack.push(q); }
      }
    }
    blobs.push({ id, pixels, cx: sx / pixels.length, cy: sy / pixels.length });
  }

  if (blobs.length !== 2) {
    throw new Error(`Expected the mark to be two shapes, found ${blobs.length}. `
      + 'If the artwork changed so the dart now touches the rings, this split needs rethinking.');
  }

  // The dart sits up and to the right of the rings.
  const [a, b] = blobs;
  const dartBlob = (a.cx - a.cy) > (b.cx - b.cy) ? a : b;
  const ringsBlob = dartBlob === a ? b : a;

  // The dart's tip is buried in the bullseye dot, so the flood fill hands back
  // dot and dart as one shape. The dot belongs to the target, not to the thing
  // being thrown, or the dart flies in looking like it has a ball on the end.
  //
  // Found rather than hard-coded, and not from the rings' centre of mass: the
  // ring is a C with a gap where the dart crosses it, so its centroid sits off
  // the real centre. Instead, fit a circle to the ring's outer edge, which is a
  // long clean arc, and take its centre. The dot is concentric with it.
  const inRings = new Set(ringsBlob.pixels);
  const edge = [];
  for (const p of ringsBlob.pixels) {
    if (!inRings.has(p - 1) || !inRings.has(p + 1)
      || !inRings.has(p - width) || !inRings.has(p + width)) {
      const x = p % width;
      edge.push([x, (p - x) / width]);
    }
  }
  // The ring is an annulus, so its edge is two arcs. Keep the far one.
  const reach = edge.map(([x, y]) => Math.hypot(x - ringsBlob.cx, y - ringsBlob.cy));
  const far = Math.max(...reach);
  const outer = edge.filter((_, i) => reach[i] > far * 0.8);

  // Kasa's algebraic circle fit: least squares on x^2 + y^2 + Dx + Ey + F = 0.
  let n = outer.length, Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sz = 0, Sxz = 0, Syz = 0;
  for (const [x, y] of outer) {
    const z = x * x + y * y;
    Sx += x; Sy += y; Sxx += x * x; Syy += y * y; Sxy += x * y;
    Sz += z; Sxz += x * z; Syz += y * z;
  }
  const M = [[Sxx, Sxy, Sx], [Sxy, Syy, Sy], [Sx, Sy, n]];
  const V = [-Sxz, -Syz, -Sz];
  for (let i = 0; i < 3; i++) {
    let piv = i;
    for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]]; [V[i], V[piv]] = [V[piv], V[i]];
    for (let k = i + 1; k < 3; k++) {
      const f = M[k][i] / M[i][i];
      for (let j = i; j < 3; j++) M[k][j] -= f * M[i][j];
      V[k] -= f * V[i];
    }
  }
  const sol = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let t = V[i];
    for (let j = i + 1; j < 3; j++) t -= M[i][j] * sol[j];
    sol[i] = t / M[i][i];
  }
  const cx = -sol[0] / 2, cy = -sol[1] / 2;

  // The radius, by walking outwards and asking how much of each circle the dart
  // blob covers. Inside the dot that is nearly all of it: the shaft's own point
  // is notched out of the dot's rim, which costs a few percent, no more. One
  // pixel past the dot only the shaft crosses and coverage falls off a cliff to
  // under a tenth, so any threshold in between finds the same edge.
  const inDart = new Set(dartBlob.pixels);
  const coverage = (r) => {
    let hit = 0, total = 0;
    for (let deg = 0; deg < 360; deg++) {
      const x = Math.round(cx + r * Math.cos(deg * Math.PI / 180));
      const y = Math.round(cy + r * Math.sin(deg * Math.PI / 180));
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      total++;
      if (inDart.has(y * width + x)) hit++;
    }
    return total ? hit / total : 0;
  };
  let dotR = 0;
  for (let r = 4; r < width / 2; r++) {
    if (coverage(r) < 0.25) break;
    dotR = r;
  }
  console.log('bullseye centre', [cx.toFixed(1), cy.toFixed(1)], 'dot radius', dotR);

  // A pixel and a half of slack, so the anti-aliased rim goes with the dot
  // rather than staying behind as a hairline crescent stuck to the dart.
  const isDot = (p) => {
    const x = p % width, y = (p - x) / width;
    return Math.hypot(x - cx, y - cy) <= dotR + 1.5;
  };
  const shaft = dartBlob.pixels.filter((p) => !isDot(p));
  const rings = { pixels: ringsBlob.pixels };
  // The dot is its own layer so the ring can draw itself round the gap without
  // a pie slice growing in the middle, and so the dot can land on its own beat.
  const dot = { pixels: dartBlob.pixels.filter(isDot) };

  // Taking the dot away leaves the shaft ending on the arc it was cut against,
  // so the dart's front is a concave bite rather than a point. In the logo the
  // shaft simply disappears into the dot and no tip is ever drawn, so there is
  // nothing to recover: it has to be built. A wedge continuing the shaft's own
  // width and direction gives a point that looks like it was always there.
  //
  // It is allowed to reach past where the dot sits, because the splash paints
  // the dart UNDERNEATH the rings: once the dart lands, the dot covers the
  // added tip completely and the composite is the logo again, pixel for pixel.
  const axisOf = (pixels) => {
    let lo = null, hi = null;
    for (const p of pixels) {
      const x = p % width, y = (p - x) / width;
      const along = x - y;
      if (!lo || along < lo.along) lo = { x, y, along };
      if (!hi || along > hi.along) hi = { x, y, along };
    }
    const dx = hi.x - lo.x, dy = hi.y - lo.y, len = Math.hypot(dx, dy);
    return { tip: lo, tail: hi, ux: dx / len, uy: dy / len };
  };

  const { ux, uy } = axisOf(shaft);
  const proj = (p) => { const x = p % width, y = (p - x) / width; return x * ux + y * uy; };
  const perp = (p) => { const x = p % width, y = (p - x) / width; return x * -uy + y * ux; };

  // Measure the shaft a little behind the cut, where the arc has not eaten it.
  // Its width and its centreline are both read off the artwork rather than
  // assumed: tip-to-tail runs a degree or two off the shaft's own line, which
  // is enough to leave a step on one side of the joint and a lip on the other.
  const front = Math.min(...shaft.map(proj));
  const nose = front + 12;
  const slices = [];
  for (let a = nose; a < nose + 160; a += 8) {
    const cut = shaft.filter((p) => proj(p) >= a && proj(p) < a + 8).map(perp);
    if (cut.length < 8) continue;
    const lo = Math.min(...cut), hi = Math.max(...cut);
    slices.push({ a: a + 4, mid: (lo + hi) / 2, w: hi - lo });
  }
  // Least squares on the slice centres: where the shaft's middle really runs.
  const mean = (xs) => xs.reduce((t, v) => t + v, 0) / xs.length;
  const ma = mean(slices.map((s) => s.a)), mm = mean(slices.map((s) => s.mid));
  let num = 0, den = 0;
  for (const s of slices) { num += (s.a - ma) * (s.mid - mm); den += (s.a - ma) ** 2; }
  const drift = num / den;
  const midAt = (a) => mm + drift * (a - ma);
  const w = slices[0].w;
  const apex = nose - w * 1.7;

  // The wedge is filled in the shaft's own frame rather than rasterised as a
  // triangle on the grid, which also fills the concave bite between the cut and
  // the nose instead of leaving a crescent of background inside the point.
  const added = [];
  const have = new Set(shaft);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const along = x * ux + y * uy;
      if (along > nose || along < apex) continue;
      const off = Math.abs((x * -uy + y * ux) - midAt(along));
      if (off > (w / 2) * ((along - apex) / (nose - apex))) continue;
      const p = y * width + x;
      if (!have.has(p)) { added.push(p); have.add(p); }
    }
  }
  console.log('shaft width', Math.round(w), 'px \u00b7 tip built from', added.length, 'pixels');

  const dart = { pixels: [...shaft, ...added], added: new Set(added) };

  // The built tip has no pixels in the source to copy, so it takes the mark's
  // own colour, sampled from a pixel that is definitely part of the shaft.
  const sample = blobs[0].pixels[Math.floor(blobs[0].pixels.length / 2)];
  const ink = [data[sample * 4], data[sample * 4 + 1], data[sample * 4 + 2]];

  const write = async (blob, name) => {
    const buf = Buffer.alloc(width * height * 4);
    for (const p of blob.pixels) {
      const built = blob.added?.has(p);
      buf[p * 4] = built ? ink[0] : data[p * 4];
      buf[p * 4 + 1] = built ? ink[1] : data[p * 4 + 1];
      buf[p * 4 + 2] = built ? ink[2] : data[p * 4 + 2];
      buf[p * 4 + 3] = built ? 255 : data[p * 4 + 3];
    }
    const file = path.join(OUT, name);
    await sharp(buf, { raw: { width, height, channels: 4 } }).png().toFile(file);
    return `${name} ${Math.round(fs.statSync(file).size / 1024)}KB`;
  };

  console.log('canvas', width, height);
  console.log(await write(rings, 'splash-rings.png'));
  console.log(await write(dot, 'splash-dot.png'));
  console.log(await write(dart, 'splash-dart.png'));

  // Everything the stylesheet needs to place its effects on the artwork rather
  // than on the box it sits in: where the bullseye is, and which way the ring's
  // gap faces, so the draw-on sweep can start there and finish there.
  const pc = (v, total) => `${(100 * v / total).toFixed(1)}%`;
  let gapStart = null, gapRun = 0, bestStart = 0, bestRun = 0;
  const hasInk = (deg) => {
    const rad = deg * Math.PI / 180;
    for (let r = dotR + 8; r < width / 2; r++) {
      const x = Math.round(cx + r * Math.cos(rad)), y = Math.round(cy + r * Math.sin(rad));
      if (x < 0 || y < 0 || x >= width || y >= height) break;
      if (inRings.has(y * width + x)) return true;
    }
    return false;
  };
  for (let deg = 0; deg < 720; deg++) {
    if (hasInk(deg % 360)) { gapStart = null; gapRun = 0; continue; }
    if (gapStart === null) gapStart = deg;
    gapRun++;
    if (gapRun > bestRun) { bestRun = gapRun; bestStart = gapStart; }
  }
  // Image angles run from +x, clockwise on screen. CSS conic angles run from
  // straight up, also clockwise, so the two differ by a quarter turn.
  const gapMid = ((bestStart + bestRun / 2) % 360 + 360) % 360;
  console.log('bullseye at', pc(cx, width), pc(cy, height),
    '\u00b7 ring gap', bestRun + 'deg wide, centred at conic', ((gapMid + 90) % 360).toFixed(0) + 'deg');

  // The dart's own axis, tip to flights, so it can fly in along the line it
  // points down rather than sliding in sideways.
  let tip = null, tail = null;
  for (const p of dart.pixels) {
    const x = p % width, y = (p - x) / width;
    const along = x - y;                       // grows toward the top right
    if (!tip || along < tip.along) tip = { x, y, along };
    if (!tail || along > tail.along) tail = { x, y, along };
  }
  const dx = tail.x - tip.x, dy = tail.y - tip.y;
  const len = Math.hypot(dx, dy);
  console.log('dart axis: tip', [tip.x, tip.y], 'tail', [tail.x, tail.y],
    'unit', [(dx / len).toFixed(3), (dy / len).toFixed(3)],
    'angle', `${(Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1)}deg`);
})();
