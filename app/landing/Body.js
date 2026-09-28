'use client';

import { useState } from 'react';
import { byId } from './copy';
import Doors from './Doors';
import ChatDemo from './ChatDemo';
import CloseHero from './CloseHero';
import GridFloor from './GridFloor';
import InsightsFrame from './InsightsFrame';
import LeagueFrame from './LeagueFrame';
import PopupDemo from './PopupDemo';
import Header from './Header';
import Postings from './Postings';
import Section from './Section';

// The page itself: seven stops, read in order.
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
        <Section id="everywhere" {...byId('everywhere')} wide>
          <Postings />
        </Section>

        <Section id="pileup" {...byId('pileup')} wide>
          <GridFloor />
        </Section>

        <Section id="assistant" {...byId('assistant')} wide>
          <ChatDemo />
        </Section>

        <Section id="extension" {...byId('extension')}>
          <PopupDemo />
        </Section>

        <Section id="insights" {...byId('insights')} wide>
          <InsightsFrame />
        </Section>

        <Section id="league" {...byId('league')}>
          <LeagueFrame />
        </Section>

        <CloseHero onOpen={setDoor} onInView={setAtClose} />
      </main>

      <Doors open={door} onClose={() => setDoor(null)} />
    </>
  );
}
