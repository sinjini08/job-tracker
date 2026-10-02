'use client';

import { Analytics as VercelAnalytics } from '@vercel/analytics/next';

// Page views, counted by Vercel Web Analytics: how many people visit, which
// pages, and where they came from. No cookies, and nothing tied to a person;
// the privacy page says so and says why.
//
// Every address is cleaned before it is sent, because some of them carry
// things that belong to somebody:
//
//   /s/<token>     a shared tracker. The token is the key to someone's
//                  applications, so the visit is not counted at all.
//   /join/<code>   a league invite. Counted, since invites are worth
//                  counting, but as /join/[code], never the code itself.
//   ?anything      query strings carry ?join=CODE, OAuth parameters and the
//                  like. None of it is needed to count a page, so it goes.
export default function Analytics() {
  return (
    <VercelAnalytics
      beforeSend={(event) => {
        const url = new URL(event.url);
        if (url.pathname.startsWith('/s/')) return null;
        if (url.pathname.startsWith('/join/')) url.pathname = '/join/[code]';
        url.search = '';
        return { ...event, url: url.toString() };
      }}
    />
  );
}
