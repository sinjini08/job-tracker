// Build every logo file from one source image (brand/source-logo.png).
//   node scripts/build-logo.cjs
//
// Produces:
//   app/icon.png, app/apple-icon.png   browser tab + phone home screen
//   public/brand/mark-white.png        the mark alone, white, transparent background
//   public/brand/mark-green.png        the mark alone, green, transparent background
//   public/brand/icon-green.png        the full rounded-square icon
//   brand/*.png                        512 and 1024 exports for posts and slides
const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const SRC = path.join(root, 'brand', 'source-logo.png');
const GREEN = { r: 0x1d, g: 0x5c, b: 0x36 }; // sampled from the artwork

const near = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const src = sharp(SRC).ensureAlpha();
  const { width, height } = await src.metadata();
  const { data } = await src.raw().toBuffer({ resolveWithObject: true });

  // 1. Find the rounded green square inside the white page, and crop to it.
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const isGreen = near(r, GREEN.r, 60) && near(g, GREEN.g, 60) && near(b, GREEN.b, 60);
      if (isGreen) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  console.log('green square found at', box);

  // 2. The mark on its own: keep light pixels that sit INSIDE the rounded
  //    square. Without the rounded-corner test, the white page showing through
  //    the square's corners is kept too, and the mark grows four stray corners.
  const radius = box.width * 0.19;
  const insideRounded = (x, y) => {
    const dx = Math.min(x, box.width - 1 - x);
    const dy = Math.min(y, box.height - 1 - y);
    if (dx >= radius || dy >= radius) return true;                 // not in a corner zone
    const cx = dx < radius ? radius - dx : 0;
    const cy = dy < radius ? radius - dy : 0;
    return Math.hypot(cx, cy) <= radius - 1;                       // inside the corner arc
  };
  const mark = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    for (let x = 0; x < box.width; x++) {
      const s = ((y + box.top) * width + (x + box.left)) * 4;
      const d = (y * box.width + x) * 4;
      const [r, g, b] = [data[s], data[s + 1], data[s + 2]];
      const light = (r + g + b) / 3;
      // Soft edge: fully opaque above 200, fading out below, so curves stay smooth.
      const alpha = !insideRounded(x, y) ? 0
        : light >= 200 ? 255
        : light <= 120 ? 0
        : Math.round(((light - 120) / 80) * 255);
      mark[d] = 245; mark[d + 1] = 245; mark[d + 2] = 240; mark[d + 3] = alpha;
    }
  }
  const raw = { raw: { width: box.width, height: box.height, channels: 4 } };

  const out = (p) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    return p;
  };

  // The mark, white and green, trimmed to its own bounds.
  await sharp(mark, raw).png().trim({ threshold: 1 })
    .toFile(out(path.join(root, 'public/brand/mark-white.png')));
  const greenMark = Buffer.from(mark);
  for (let i = 0; i < greenMark.length; i += 4) {
    greenMark[i] = 0x2e; greenMark[i + 1] = 0x6b; greenMark[i + 2] = 0x3d;
  }
  await sharp(greenMark, raw).png().trim({ threshold: 1 })
    .toFile(out(path.join(root, 'public/brand/mark-green.png')));

  // The full icon, cropped to the rounded square.
  const icon = sharp(SRC).extract(box);
  await icon.clone().resize(512, 512).png().toFile(out(path.join(root, 'public/brand/icon-green.png')));
  await icon.clone().resize(512, 512).png().toFile(out(path.join(root, 'app/icon.png')));
  await icon.clone().resize(180, 180).png().toFile(out(path.join(root, 'app/apple-icon.png')));
  for (const size of [512, 1024]) {
    await icon.clone().resize(size, size).png().toFile(out(path.join(root, `brand/icon-green-${size}.png`)));
    await sharp(greenMark, raw).png().trim({ threshold: 1 }).resize({ width: size, fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .toFile(out(path.join(root, `brand/mark-green-${size}.png`)));
  }
  // Stamp the content hash into Logo.js so the browser always fetches the new art.
  const crypto = require('node:crypto');
  const hash = crypto.createHash('sha1')
    .update(fs.readFileSync(path.join(root, 'public/brand/mark-white.png'))).digest('hex').slice(0, 8);
  const logoPath = path.join(root, 'app/Logo.js');
  fs.writeFileSync(logoPath, fs.readFileSync(logoPath, 'utf8').replace(/const V = '[^']*';/, `const V = '${hash}';`));
  console.log('logo version:', hash);

  console.log('written:', ['app/icon.png', 'app/apple-icon.png', 'public/brand/mark-white.png',
    'public/brand/mark-green.png', 'public/brand/icon-green.png', 'brand/icon-green-{512,1024}.png',
    'brand/mark-green-{512,1024}.png'].join(', '));
})();
