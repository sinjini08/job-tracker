// One line a day, at the top of Insights.
//
// Chosen by the date rather than at random, so it is the same line all day and
// a different one tomorrow. Nobody wants a motivational quote that reshuffles
// every time they switch tabs.
//
// The bar for getting in here: it has to be true of a job search, and it has
// to sound like a person rather than a poster. Anything that would make
// someone on their fortieth rejection feel worse is not motivating.

import { dayNumber, todayISO } from './format.js';

export const LINES = [
  'A rejection is one company’s answer, not the market’s.',
  'The best application you send this week will take twenty minutes longer than the others.',
  'Nobody gets hired for the applications they meant to send.',
  'Most of this is waiting. The part you control is the sending.',
  'One good referral is worth an afternoon of forms.',
  'You only need the process to work once.',
  'The posting that looks slightly out of reach is usually the one worth writing for.',
  'Silence is not a verdict. It is usually an inbox.',
  'Two a day beats fourteen on Sunday night.',
  'Every interview you sit is practice for the one that matters.',
  'The people already doing the job were once as unqualified as you feel.',
  'Follow-ups feel awkward and work anyway.',
  'Tailoring one application beats sending three identical ones.',
  'A search that is quiet this week was decided three weeks ago.',
  'You are allowed to want the job.',
  'Keep the list honest and it will tell you what to do next.',
  'The hardest part is starting again on Monday.',
  'Somebody is going to get this job. It may as well be the one who applied.',
  'Read the posting twice. Half the applicants did not read it once.',
  'Momentum is easier to keep than to rebuild.',
  'An offer is a conversation, not a verdict on your worth.',
  'The gap on your CV is more interesting to you than to them.',
  'Ask for the referral. The worst answer is the one you already have.',
  'Progress here looks like a slightly shorter list of unknowns.',
  'Applying when you do not feel like it is the whole skill.',
  'Being turned down at the final round means you were nearly right.',
  'Write the note you would want to receive.',
  'You are not behind. You are in the middle.',
];

// Same line all day, a different one tomorrow, and a full cycle before any
// repeat. dayNumber is a plain count of days, so this just walks the list.
export function quoteOfTheDay(today = todayISO()) {
  return LINES[((dayNumber(today) % LINES.length) + LINES.length) % LINES.length];
}
