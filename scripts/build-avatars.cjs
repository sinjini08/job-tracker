// Slice the avatar sheet into one PNG per avatar.
//   node scripts/build-avatars.cjs
//
// Source: brand/source-avatars.webp, a grid of circular portraits on a paper
// background. Output: public/avatars/<key>.png, each a circle on transparency
// so it sits on any surface without square corners showing.
//
// The grid is found rather than hard-coded: rows are the bands of pixels that
// aren't the paper colour, and columns are the same scan within each row. That
// way a re-exported sheet with slightly different spacing still slices.
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'brand', 'source-avatars.webp');
const OUT = path.join(root, 'public', 'avatars');
const SIZE = 160;            // covers 62px on the podium at 2x, with room spare
const TOL = 10;              // how close to the paper colour still counts as background

(async () => {
  const src = sharp(SRC).ensureAlpha();
  const { width, height } = await src.metadata();
  const { data } = await src.raw().toBuffer({ resolveWithObject: true });

  // The top-left pixel is the paper.
  const bg = [data[0], data[1], data[2]];
  const isBg = (x, y) => {
    const i = (y * width + x) * 4;
    return Math.abs(data[i] - bg[0]) < TOL
      && Math.abs(data[i + 1] - bg[1]) < TOL
      && Math.abs(data[i + 2] - bg[2]) < TOL;
  };

  const bandsOf = (count, on) => {
    const out = [];
    let start = null;
    for (let i = 0; i < count; i++) {
      if (on(i) && start === null) start = i;
      if (!on(i) && start !== null) { out.push([start, i - 1]); start = null; }
    }
    if (start !== null) out.push([start, count - 1]);
    return out;
  };

  const rows = bandsOf(height, (y) => {
    let n = 0;
    for (let x = 0; x < width; x += 2) if (!isBg(x, y)) n++;
    return n > 4;
  });

  const boxes = [];
  for (const [y0, y1] of rows) {
    const cols = bandsOf(width, (x) => {
      let n = 0;
      for (let y = y0; y <= y1; y += 2) if (!isBg(x, y)) n++;
      return n > 3;
    });
    for (const [x0, x1] of cols) boxes.push({ x0, y0, x1, y1 });
  }

  fs.mkdirSync(OUT, { recursive: true });
  const mask = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}"><circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="${SIZE / 2}" fill="#fff"/></svg>`,
  );

  const keys = [];
  for (const [i, b] of boxes.entries()) {
    // Square the crop around the circle's centre, so nothing is squashed.
    const w = b.x1 - b.x0 + 1;
    const h = b.y1 - b.y0 + 1;
    const side = Math.max(w, h);
    const cx = b.x0 + w / 2;
    const cy = b.y0 + h / 2;
    const left = Math.max(0, Math.round(cx - side / 2));
    const top = Math.max(0, Math.round(cy - side / 2));
    const size = Math.min(side, width - left, height - top);

    const key = `a${i + 1}`;
    keys.push(key);
    await sharp(SRC)
      .extract({ left, top, width: size, height: size })
      .resize(SIZE, SIZE, { fit: 'cover' })
      .composite([{ input: mask, blend: 'dest-in' }])
      .png({ compressionLevel: 9, palette: true })
      .toFile(path.join(OUT, `${key}.png`));
  }

  // Stamp the content hash into lib/avatars.js, so a re-slice can't be served
  // from a browser cache holding the old faces.
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha1');
  for (const k of keys) hash.update(fs.readFileSync(path.join(OUT, `${k}.png`)));
  const stamp = hash.digest('hex').slice(0, 8);
  const libPath = path.join(root, 'lib', 'avatars.js');
  fs.writeFileSync(libPath, fs.readFileSync(libPath, 'utf8')
    .replace(/const AVATAR_VERSION = '[^']*';/, `const AVATAR_VERSION = '${stamp}';`));
  console.log('avatar version:', stamp);

  const bytes = keys.reduce((t, k) => t + fs.statSync(path.join(OUT, `${k}.png`)).size, 0);
  console.log(`${keys.length} avatars -> public/avatars (${Math.round(bytes / 1024)} KB total)`);
  console.log(keys.join(' '));
})();
