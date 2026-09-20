const sharp = require('/Users/user/Documents/job-tracker/node_modules/sharp');
const fs = require('fs');
const out = '/Users/user/Documents/job-tracker/brand';

const mark = (ring, dart) => `
  <mask id="g"><rect width="64" height="64" fill="#fff"/><path d="M27 38 L50 15" stroke="#000" stroke-width="11" stroke-linecap="round"/></mask>
  <g mask="url(#g)" fill="none" stroke="${ring}" stroke-width="6">
    <circle cx="27" cy="38" r="19.5"/><circle cx="27" cy="38" r="11"/>
  </g>
  <circle cx="27" cy="38" r="4.6" fill="${ring}"/>
  <path d="M27 38 L48.5 16.5" stroke="${dart}" stroke-width="5" stroke-linecap="round"/>
  <path d="M45 9.5 L56.5 7 L54 18.5 Z" fill="${dart}"/>
  <path d="M49.5 20 L58.5 18 L56.5 27 Z" fill="${dart}" opacity="0.78"/>`;

const files = {
  'icon-green.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#2e6b3d"/>${mark('#f5f5f0', '#6bb87a')}</svg>`,
  'icon-white.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#ffffff"/>${mark('#2e6b3d', '#4a8b5a')}</svg>`,
  'mark-transparent.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${mark('#2e6b3d', '#4a8b5a')}</svg>`,
};
for (const [name, svg] of Object.entries(files)) fs.writeFileSync(`${out}/${name}`, svg);

(async () => {
  for (const [name, svg] of Object.entries(files)) {
    for (const size of [512, 1024]) {
      const png = name.replace('.svg', `-${size}.png`);
      await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(`${out}/${png}`);
    }
  }
  // Apple touch icon for phone home screens (Next.js picks this up by filename).
  await sharp(Buffer.from(files['icon-green.svg']), { density: 600 }).resize(180, 180).png()
    .toFile('/Users/user/Documents/job-tracker/app/apple-icon.png');
  // A small strip for checking legibility at real sizes.
  const proof = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="80" viewBox="0 0 420 80">
    <rect width="420" height="80" fill="#f7f7f7"/>
    <g transform="translate(20,24)"><svg width="16" height="16" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#2e6b3d"/>${mark('#f5f5f0', '#6bb87a')}</svg></g>
    <g transform="translate(52,16)"><svg width="32" height="32" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#2e6b3d"/>${mark('#f5f5f0', '#6bb87a')}</svg></g>
    <g transform="translate(100,8)"><svg width="48" height="48" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#2e6b3d"/>${mark('#f5f5f0', '#6bb87a')}</svg></g>
    <g transform="translate(164,4)"><svg width="56" height="56" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#ffffff" stroke="#e1e0d9"/>${mark('#2e6b3d', '#4a8b5a')}</svg></g>
    <g transform="translate(240,16)"><rect width="160" height="48" rx="11" fill="#2e6b3d"/>
      <g transform="translate(9,9)"><svg width="30" height="30" viewBox="0 0 64 64">${mark('#f5f5f0', '#6bb87a')}</svg></g>
      <text x="46" y="30" style="font:700 15px system-ui;fill:#fff">Job Tracker</text></g>
  </svg>`;
  await sharp(Buffer.from(proof), { density: 600 }).resize(840).png().toFile('/private/tmp/claude-501/-Users-user-Documents-ACE/e9c6b827-b4db-465a-ba0e-c1605b552955/scratchpad/logo-proof.png');
  console.log(fs.readdirSync(out).join('\n'));
})();
