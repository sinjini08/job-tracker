'use client';

import { useSyncExternalStore } from 'react';

// Whether the window is phone-sized: under Tailwind's md, which is where
// every layout on this page changes over.
//
// For the few places where a phone gets different motion rather than
// different CSS. Null on the server and through hydration, since the server
// cannot know, so anything that depends on it should render the same either
// way until it is known: in practice, a scene's opening frame, before the
// first scroll has moved anything.
const QUERY = '(max-width: 767.98px)';

function subscribe(onChange) {
  const media = window.matchMedia(QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

export default function usePhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => null);
}
