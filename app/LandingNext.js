import { Geist, Instrument_Sans } from 'next/font/google';
import Body from './landing/Body';
import './landing/landing.css';

// The landing page being built, not yet the front door.
//
// Reachable at /?next=1 while it is worked on. The live front door is the
// original hero in Landing.js, restored until this one is finished.
//
// Seven screens: where a job search actually lives, what that costs you, the
// two ways this tracker keeps up with you, what it then tells you, the league,
// and the ask. The copy is in landing/copy.js.
//
// Tailwind is scoped to this page. landing.css explains how and why, and why
// every utility here is written `tw:`.

// Both faces are loaded so the headline can be judged by eye rather than by
// name. ?type=instrument switches; the default is Geist.
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', display: 'swap' });
const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });

export default async function LandingNext({ searchParams }) {
  const q = await searchParams;
  // The whole chain, because this is substituted on the element that uses it.
  const stack = 'ui-sans-serif, system-ui, sans-serif';
  const face = q?.type === 'instrument'
    ? `var(--font-instrument), ${stack}`
    : `var(--font-geist), ${stack}`;

  return (
    <div
      // `landing` is not decoration: globals.css keys the body's overflow off
      // it, because the body is overflow:hidden for the sheet.
      className={`landing ${geist.variable} ${instrument.variable}`}
      style={{ '--landing-display': face }}
    >
      <Body />
    </div>
  );
}
