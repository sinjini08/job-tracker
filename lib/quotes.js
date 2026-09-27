// One line a day, at the top of Insights.
//
// Chosen by the date rather than at random, so it is the same line all day and
// a different one tomorrow. Nobody wants a motivational quote that reshuffles
// every time they switch tabs.
//
// Three tests for getting in here, and a line has to pass all of them.
//
//   It has to be true of a job search. Not true of anything, the way a poster
//   is: true of sending an application on a Tuesday and hearing nothing.
//
//   It has to sound like a person who has done this, not a brand. No grinding,
//   no manifesting, no dream jobs waiting out there for anybody.
//
//   And it has to leave someone on their fortieth rejection better off than
//   they were a second earlier. That rules out cheerfulness as much as it
//   rules out cynicism: being told to keep your chin up by a spreadsheet is
//   its own small insult. What works is being told something true that they
//   had lost sight of.
//
// Ordered so that consecutive days feel different from each other, because the
// list is walked in order rather than shuffled. Two reframings of rejection
// back to back read as a theme, and a theme reads as a lecture.

import { dayNumber, todayISO } from './format.js';

export const LINES = [
  'A rejection is one company’s answer, not the market’s.',
  'Confidence comes after the doing, not before it.',
  'Nobody gets hired for the applications they meant to send.',
  'You are not behind. You are in the middle.',
  'Silence is not a verdict. It is usually an inbox.',
  'The work it took to get here does not disappear because someone said no.',
  'You only need the process to work once.',
  'Doubt is not evidence.',
  'The people already doing the job were once as unqualified as you feel.',
  'Momentum is easier to keep than to rebuild.',
  'Every no narrows the search. That is progress, even when it stings.',
  'You are allowed to want the job.',
  'Most of this is waiting. The part you control is the sending.',
  'Skill compounds quietly. So does showing up.',
  'Being turned down at the final round means you were nearly right.',
  'On the day it feels pointless, send one anyway. That is the day that counts.',
  'The posting that looks slightly out of reach is usually the one worth writing for.',
  'You are building a habit, not waiting on a miracle.',
  'Ask for the referral. The worst answer is the one you already have.',
  'Nothing about this week is permanent, including how it feels.',
  'Every interview you sit is practice for the one that matters.',
  'Rejections are expensive to feel and cheap to collect.',
  'The gap on your CV is more interesting to you than it is to them.',
  'Courage here is mostly just doing the next thing on the list.',
  'Applying when you do not feel like it is the whole skill.',
  'You are not competing with everyone. Only with whoever else applied.',
  'Follow-ups feel awkward and work anyway.',
  'The right job does not need you to be finished, only willing to learn.',
  'A search that is quiet this week was decided three weeks ago.',
  'You are allowed to be proud of the applications nobody answered.',
  'Somebody is going to get this job. It may as well be the one who applied.',
  'An offer is a conversation, not a verdict on your worth.',
  'Two a day beats fourteen on a Sunday night.',
  'The offer, when it comes, will make this week look short.',
  'The hardest search is always the one you are in the middle of.',
  'Keep going long enough and luck starts to look like a pattern.',
];

// Same line all day, a different one tomorrow, and a full cycle before any
// repeat. dayNumber is a plain count of days, so this just walks the list.
export function quoteOfTheDay(today = todayISO()) {
  return LINES[((dayNumber(today) % LINES.length) + LINES.length) % LINES.length];
}
