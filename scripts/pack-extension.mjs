// Build the zip the Chrome Web Store wants.
//
// Only what the extension runs: the store rejects nothing for carrying a
// README, but a package should be the thing itself, and anything extra in
// there is something a reviewer has to read and a user has to download.
//
// Runs the sync check first. Publishing a package whose extractor had drifted
// from the tested one would ship code no test has ever seen, and the store
// does not let you unpublish a version, only replace it.
import { execFileSync } from 'child_process';
import { mkdirSync, readFileSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const ext = join(root, 'extension');

execFileSync('node', [join(here, 'sync-extension.mjs'), '--check'], { stdio: 'inherit' });

const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
const { version, name } = manifest;

// The store's own limits, checked here rather than discovered at the upload
// form. The first attempt was rejected for a 148-character description
// against a limit of 132, after the zip had been built and carried over to
// the browser, which is a slow way to find out.
const LIMITS = [
  ['name', 45],
  ['description', 132],
  ['short_name', 12],
];
const tooLong = LIMITS
  .filter(([key, max]) => typeof manifest[key] === 'string' && manifest[key].length > max)
  .map(([key, max]) => `${key} is ${manifest[key].length} characters, the store allows ${max}`);
if (tooLong.length) {
  console.error('\x1b[31mthe store would reject this manifest:\x1b[0m');
  for (const line of tooLong) console.error(`  ${line}`);
  process.exit(1);
}

// Named so two builds of different versions cannot be confused for each other
// on the way to the upload form.
const out = join(root, 'dist');
const zip = join(out, `extension-${version}.zip`);
mkdirSync(out, { recursive: true });
if (existsSync(zip)) rmSync(zip);

// An allowlist, not an ignore list: a file added to extension/ later is left
// out until somebody says otherwise, which is the safer direction to fail in.
const SHIP = [
  'manifest.json', 'popup.html', 'popup.css', 'popup.js',
  'background.js', 'extract.js', 'iso-date.js',
  'icons/16.png', 'icons/32.png', 'icons/48.png', 'icons/128.png',
];

for (const file of SHIP) {
  if (!existsSync(join(ext, file))) {
    console.error(`\x1b[31mmissing: extension/${file}\x1b[0m`);
    process.exit(1);
  }
}

execFileSync('zip', ['-q', '-X', zip, ...SHIP], { cwd: ext });
const size = readFileSync(zip).length;
console.log(`\x1b[32mok\x1b[0m   dist/extension-${version}.zip (${(size / 1024).toFixed(1)} KB)`);
console.log(`     ${name} ${version}, ${SHIP.length} files`);
