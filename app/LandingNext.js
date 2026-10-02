import {
  Bricolage_Grotesque, Fraunces, Geist, Outfit, Plus_Jakarta_Sans, Unbounded,
} from 'next/font/google';
import Body from './landing/Body';
import './landing/landing.css';

// The landing page: the front door for anyone signed out.
//
// Seven screens: where a job search actually lives, what that costs you, the
// two ways this tracker keeps up with you, what it then tells you, the league,
// and the ask. The copy is in landing/copy.js.
//
// Tailwind is scoped to this page. landing.css explains how and why, and why
// every utility here is written `tw:`.

// The candidates for the headline, all loaded so it can be judged by eye
// rather than by name. ?type=<key> switches; the default is the first.
//
// Only the display face changes. Body text stays on the system font
// throughout: a page this long is tiring to read in anything with character.
// One const each, at module scope, because next/font refuses to be called
// anywhere else: it rewrites these at build time and cannot follow a loader
// buried in an object literal.
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--f-bricolage', display: 'swap' });
const outfit = Outfit({ subsets: ['latin'], variable: '--f-outfit', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--f-jakarta', display: 'swap' });
const unbounded = Unbounded({ subsets: ['latin'], variable: '--f-unbounded', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--f-fraunces', display: 'swap' });
const geist = Geist({ subsets: ['latin'], variable: '--f-geist', display: 'swap' });

const FACES = { bricolage, outfit, jakarta, unbounded, fraunces, geist };
const DEFAULT_FACE = 'bricolage';

export default async function LandingNext({ searchParams }) {
  const q = await searchParams;
  const key = FACES[q?.type] ? q.type : DEFAULT_FACE;
  // The whole chain, because this is substituted on the element that uses it.
  const face = `var(--f-${key}), ui-sans-serif, system-ui, sans-serif`;
  const vars = Object.values(FACES).map((f) => f.variable).join(' ');

  return (
    <div
      // `landing` is not decoration: globals.css keys the body's overflow off
      // it, because the body is overflow:hidden for the sheet.
      className={`landing ${vars}`}
      style={{ '--landing-display': face }}
    >
      <Body />
    </div>
  );
}
