// The extractor lives in lib/ and the extension needs its own copy.
//
//   npm run ext:sync    write the copies
//   npm run ext:check   fail if they have drifted
//
// The check also runs as `pretest`, which npm invokes before `npm test`, so a
// drifted copy fails the suite before it starts. A guard nobody has to
// remember to run is the only kind worth having: without that, the tested
// extractor and the installed one could quietly become different code.
//
// A Chrome extension cannot import from outside its own directory, and this
// project has no bundler for anything but Next. So the files are copied, and
// the check is what stops the copies quietly becoming a fork.
//
// Every file lib/extract.js imports is copied too, and that is not a
// nicety. It copied one file until lib/extract.js grew an import of
// iso-date.js, at which point the installed extension pointed at a file that
// was not there, the module failed to load, and clicking the icon opened a
// popup with nothing in it. The check passed throughout, because it only ever
// compared the one file it knew about. Following the imports is what makes
// the guard mean what it says.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { basename } from 'path';

const ENTRY = new URL('../lib/extract.js', import.meta.url);
const OUT_DIR = new URL('../extension/', import.meta.url);
const note = (from) => `// Copied from lib/${from} by scripts/sync-extension.mjs. Do not edit here:
// edit lib/${from}, which is the one with tests against saved postings, and
// run npm run ext:sync. npm run ext:check fails if these two differ.\n\n`;

// Walk the imports, so a new dependency cannot be left behind.
const RELATIVE = /^\s*import\s+[^'"]*from\s+['"](\.\/[^'"]+)['"]/gm;
const wanted = new Map();
const queue = [ENTRY];

while (queue.length) {
  const url = queue.shift();
  const name = basename(url.pathname);
  if (wanted.has(name)) continue;
  const source = readFileSync(url, 'utf8');
  wanted.set(name, note(name) + source);
  for (const [, spec] of source.matchAll(RELATIVE)) {
    if (spec.includes('..')) {
      // Nothing outside lib/ can come along: the extension has no bundler and
      // no node_modules, so a path that climbs out cannot be satisfied.
      console.error(`\x1b[31mlib/${name} imports ${spec}, which cannot be copied into the extension\x1b[0m`);
      process.exit(1);
    }
    queue.push(new URL(spec.replace('./', ''), ENTRY));
  }
}

const checking = process.argv.includes('--check');
const stale = [];

for (const [name, want] of wanted) {
  const out = new URL(name, OUT_DIR);
  if (checking) {
    let have = '';
    try { have = readFileSync(out, 'utf8'); } catch { /* not written yet */ }
    if (have !== want) stale.push(name);
  } else {
    writeFileSync(out, want);
  }
}

// Then the thing that was actually broken: every relative import anywhere in
// the extension has to point at a file that is there. Comparing copies would
// not have caught it, because the copy it knew about was perfectly in sync;
// what was missing was a file it had never heard of.
const unresolved = [];
for (const file of readdirSync(new URL('.', OUT_DIR)).filter((f) => f.endsWith('.js'))) {
  const source = readFileSync(new URL(file, OUT_DIR), 'utf8');
  for (const [, spec] of source.matchAll(RELATIVE)) {
    if (!existsSync(new URL(spec.replace('./', ''), OUT_DIR))) {
      unresolved.push(`${file} imports ${spec}, which is not in extension/`);
    }
  }
}
if (unresolved.length) {
  console.error('\x1b[31mthe extension would fail to load:\x1b[0m');
  for (const line of unresolved) console.error(`  ${line}`);
  console.error('run: npm run ext:sync');
  process.exit(1);
}

const names = [...wanted.keys()].join(', ');
if (checking) {
  if (stale.length) {
    console.error(`\x1b[31mextension copies have drifted from lib: ${stale.join(', ')}\x1b[0m`);
    console.error('run: npm run ext:sync');
    process.exit(1);
  }
  console.log(`\x1b[32mok\x1b[0m   extension copies match lib (${names})`);
} else {
  console.log(`written into extension/: ${names}`);
}
