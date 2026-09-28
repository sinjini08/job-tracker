// The seven sections, in order, as written and signed off rather than as
// improvised in a component. One place, so a wording change is one edit and
// nobody has to hunt through JSX for a sentence.
//
// `head` is the explanatory headline: the point of them is that a visitor
// always knows what they are looking at. `sub` is the one line under it.
//
// `head` may be an array, which forces the break between its parts instead of
// leaving it to whatever width the window happens to be. Only worth doing
// where a sentence breaks somewhere that reads badly; left to itself the
// balancer is usually right.

export const SECTIONS = [
  {
    id: 'everywhere',
    head: 'Your job search is everywhere.',
    sub: "LinkedIn. Indeed. Company sites. Tabs you swore you'd come back to.",
  },
  {
    id: 'pileup',
    head: ['Applications pile up.', 'Details disappear. Follow-ups get forgotten.'],
    sub: 'What if your tracker just kept up with you?',
  },
  {
    id: 'assistant',
    head: 'Just apply. Your tracker handles the rest.',
    sub: 'Connect ChatGPT or Claude and your applications file themselves as you go.',
  },
  {
    id: 'extension',
    head: 'No AI assistant? One click does it.',
    sub: 'See a job. Save it. Track it. The Chrome extension captures the details for you.',
  },
  {
    id: 'insights',
    head: "Now you can see what's actually working.",
    sub: 'See the patterns behind your applications, interviews and offers, and where to focus next.',
  },
  {
    id: 'league',
    head: "Job searching is more fun when it's a little competitive.",
    sub: 'Add your friends. Earn points. Build streaks. Climb the league.',
  },
  {
    id: 'close',
    head: 'Less tracking. More applying.',
    sub: 'One place for every application, every insight, and every win along the way.',
  },
];

export const byId = (id) => SECTIONS.find((s) => s.id === id);
