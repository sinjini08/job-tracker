// The extractor lives in lib/ and the extension needs its own copy.
//
//   npm run ext:sync    write the copy
//   npm run ext:check   fail if it has drifted
//
// The check also runs as `pretest`, which npm invokes before `npm test`, so a
// drifted copy fails the suite before it starts. A guard nobody has to
// remember to run is the only kind worth having: without that, the tested
// extractor and the installed one could quietly become different code.
//
// A Chrome extension cannot import from outside its own directory, and this
// project has no bundler for anything but Next. So the file is copied, and the
// check is what stops the copy quietly becoming a fork: every fixture-tested
// improvement to lib/extract.js would otherwise apply to the tests and not to
// the thing people actually install.
import { readFileSync, writeFileSync } from 'fs';

const SRC = new URL('../lib/extract.js', import.meta.url);
const OUT = new URL('../extension/extract.js', import.meta.url);
const NOTE = `// Copied from lib/extract.js by scripts/sync-extension.mjs. Do not edit here:
// edit lib/extract.js, which is the one with tests against saved postings, and
// run npm run ext:sync. npm run ext:check fails if these two differ.\n\n`;

const want = NOTE + readFileSync(SRC, 'utf8');

if (process.argv.includes('--check')) {
  let have = '';
  try { have = readFileSync(OUT, 'utf8'); } catch { /* not written yet */ }
  if (have !== want) {
    console.error('\x1b[31mextension/extract.js has drifted from lib/extract.js\x1b[0m');
    console.error('run: npm run ext:sync');
    process.exit(1);
  }
  console.log('\x1b[32mok\x1b[0m   extension/extract.js matches lib/extract.js');
} else {
  writeFileSync(OUT, want);
  console.log(`written: extension/extract.js (${want.length} bytes)`);
}
