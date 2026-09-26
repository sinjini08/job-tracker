// Telling a confirmation page from a posting that talks about applying.
//
// Getting this wrong in the generous direction marks a row Applied when
// nothing was sent, which is worse than not noticing at all: the tracker
// would be confidently wrong rather than merely behind.
import { looksApplied } from '../lib/extract.js';

let right = 0; const fails = [];
const check = (ok, name) => {
  if (ok) right += 1; else fails.push(name);
  console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
};

const page = (body) => `<html><head><title>x</title></head><body>${body}</body></html>`;
const long = ' We build things and we care about them deeply, every single day of the week.'.repeat(60);

console.log('\nPages that mean you applied');
for (const [name, html] of [
  ['thanks for applying', page('<h1>Thanks for applying</h1><p>We will be in touch.</p>')],
  ['application submitted', page('<h1>Application submitted</h1><p>Reference 44812.</p>')],
  ['we have received your application', page('<p>We have received your application and will review it shortly.</p>')],
  ['your application was sent', page('<h2>Your application was sent</h2><p>Good luck.</p>')],
  ['you have successfully applied', page('<p>You have successfully applied to this role.</p>')],
  ["we've received your application", page('<p>We’ve received your application.</p>')],
]) check(looksApplied(html) === true, name);

console.log('\nPages that do not');
for (const [name, html] of [
  ['a posting inviting applications', page(`<h1>Software Engineer</h1><p>Thank you for your interest in applying to Acme.</p>${long}`)],
  ['a posting promising a review', page(`<h1>Data Analyst</h1><p>We will review your application within two weeks.</p>${long}`)],
  ['a long page that happens to say it', page(`<h1>Careers</h1><p>Thanks for applying, and here is everything else about us.</p>${long}`)],
  ['an ordinary posting', page(`<h1>Backend Engineer</h1><p>You will build services.</p>${long}`)],
  ['an empty page', page('')],
  ['a page about applications in general', page('<p>Applications close on Friday. Apply early.</p>')],
]) check(looksApplied(html) === false, name);

console.log(`\n${right}/${right + fails.length} correct`);
if (fails.length) { for (const f of fails) console.log('  ' + f); process.exit(1); }
