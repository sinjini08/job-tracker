'use client';

import { useState } from 'react';
import Doors from './Doors';
import CloseHero from './CloseHero';
import DeskScene from './DeskScene';
import InsightsWheel from './InsightsWheel';
import Podium from './Podium';
import Header from './Header';
import TwoWays from './TwoWays';

// The page itself: seven stops, read in order, on six screens. Three and
// four share one.
//
// Every section carries an explanatory headline, because a visitor who has to
// guess what they are looking at stops scrolling. The copy lives in copy.js.
export default function Body() {
  const [door, setDoor] = useState(null);
  // The header steps aside for the last screen, which is the opening
  // animation again and does not want a bar across the top of it.
  const [atClose, setAtClose] = useState(false);

  return (
    <>
      <Header onOpen={setDoor} hidden={atClose} />

      <main className="tw:bg-paper tw:text-ink">
        {/* Sections one and two are one camera move: a drawn room, then the
            push into its screen, which turns out to be the wall. */}
        <DeskScene />

        {/* Sections three and four are one stage: the assistant's words and
            chat leave, the extension's arrive in their place. */}
        <TwoWays />

        {/* Insights is split rather than stacked: the claim holds still on
            the right while the four charts take turns on the left. */}
        <InsightsWheel />

        {/* The league builds its podium as you scroll: third place, then
            second, then first, with the points climbing behind them. */}
        <Podium />

        <CloseHero onOpen={setDoor} onInView={setAtClose} />
      </main>

      <Doors open={door} onClose={() => setDoor(null)} />
    </>
  );
}
