// What happens when the model answers badly.
//
// The whole safety argument for asking a model at all is that it returns two
// line numbers and never any words. These are the ways it could try not to.
import { pickSpan, MAX_SPAN } from '../lib/req-span.js';

let right = 0; const fails = [];
const check = (ok, name, detail = '') => {
  if (ok) right += 1; else fails.push(`${name}${detail ? ` — ${detail}` : ''}`);
  console.log(`  ${ok ? '\x1b[32mok\x1b[0m  ' : '\x1b[31mFAIL\x1b[0m'} ${name}`);
};

const lines = [
  'About the role:',
  'You will drive pipeline generation across the USA.',
  'The skills you will need:',
  '- Three years of outbound sales experience',
  '- Fluent English, written and spoken',
  '- Experience with HubSpot CRM',
  "What's in it for you:",
  '- Competitive commission',
];

console.log('\nA good answer');
check(pickSpan(lines, { start: 3, end: 5 }).text
  === 'Three years of outbound sales experience\nFluent English, written and spoken\nExperience with HubSpot CRM',
  'the named lines come back, bullets stripped');

console.log('\nAnswers that must be refused');
const bad = [
  ['text instead of numbers', { start: 'the skills section', end: 'the benefits' }],
  ['a line past the end', { start: 3, end: 99 }],
  ['a negative line', { start: -1, end: 4 }],
  ['end before start', { start: 5, end: 3 }],
  ['a float', { start: 3.5, end: 5 }],
  ['a numeric string', { start: '3', end: '5' }],
  ['nothing at all', null],
  ['an empty object', {}],
  ['a string where the object should be', 'start 3 end 5'],
  ['only a start', { start: 3 }],
  ['NaN', { start: NaN, end: 5 }],
];
for (const [name, answer] of bad) {
  const got = pickSpan(lines, answer);
  check(!got.text, name, got.text);
}

// The case that matters most. A reply carrying an invented requirement
// alongside a perfectly good span is not refused, because the span is good;
// the extra field is simply never read, so what comes back is the posting's
// own lines and nothing else.
console.log('\nA reply that tries to supply text');
const smuggled = pickSpan(lines, { start: 3, end: 5, requirements: 'Must hold a security clearance' });
check(!/security clearance/.test(smuggled.text ?? ''), 'the invented requirement does not appear');
check(smuggled.text === 'Three years of outbound sales experience\nFluent English, written and spoken\nExperience with HubSpot CRM',
  'and the real lines still come back');

console.log('\nLimits');
check(!pickSpan(lines, { start: 0, end: MAX_SPAN + 1 }).text, 'a span wider than one section is refused');
check(pickSpan(lines, { start: 0, end: 0 }).why === undefined, 'a single line is a valid span');
check(pickSpan(lines, { start: null, end: null }).why === 'the posting has no such section',
  'no section is an answer, not a malfunction');
check(!pickSpan(['', '  ', 'ab'], { start: 0, end: 2 }).text, 'blank and stub lines yield nothing');

const many = Array.from({ length: 20 }, (_, i) => `- Requirement number ${i}`);
check(pickSpan(many, { start: 0, end: 19 }).text.split('\n').length === 6, 'at most six items are kept');

console.log(`\n${right}/${right + fails.length} correct`);
if (fails.length) { for (const f of fails) console.log('  ' + f); process.exit(1); }
