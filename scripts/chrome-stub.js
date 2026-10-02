// Enough of the chrome.* and fetch surface to run the real popup in a page.
//
//   <script type="module" src="chrome-stub.js?state=form"></script>
//
// The store screenshots have to show the actual popup rather than a drawing
// of one, so popup.js runs unmodified and this stands in for everything it
// would get from the browser and from the tracker. Nothing here is shipped:
// the extension never loads this file, and scripts/shot-frame.mjs copies it
// into public/_shot/ beside the popup it is faking for.
//
// It lives in scripts/ rather than in public/_shot/ because public/_shot/ is
// generated and gitignored, and a file that exists only there is one `rm -rf`
// away from being gone with no source to rebuild it from. That is not a
// hypothetical.
//
// States:
//   form   paired, page reads cleanly, nothing like it saved yet
//   known  paired, and the tracker already has this posting

const state = new URL(import.meta.url).searchParams.get('state') ?? 'form';

// Paired, so the popup goes straight to reading the page instead of showing
// the pairing step.
const SAVED = { api: 'https://myjobtracker.co/api/ext', token: 'shot-token' };

const EXISTING = {
  id: 'r1',
  role: 'Outbound Sales Representative',
  company: 'GrowGeneration Corp',
  sheet: 'Job applications',
  status: 'Saved to look at',
  saved_at: new Date(Date.now() - 2 * 86400000).toISOString(),
};

// The page the popup believes it is looking at. linkedin.html is a real saved
// posting, copied in by shot-frame.mjs from the extractor's own fixtures, so
// every field in the screenshot was extracted rather than typed here.
const PAGE_URL = 'https://www.linkedin.com/jobs/view/4123456789';
let pageHtml = '';

async function loadPage() {
  if (pageHtml) return pageHtml;
  pageHtml = await fetch('linkedin.html').then((r) => r.text());
  return pageHtml;
}

const store = { ...SAVED };

globalThis.chrome = {
  storage: {
    local: {
      get(keys, cb) {
        const out = {};
        for (const k of [].concat(keys)) if (k in store) out[k] = store[k];
        cb?.(out);
      },
      set(obj, cb) { Object.assign(store, obj); cb?.(); },
      remove(keys, cb) { for (const k of [].concat(keys)) delete store[k]; cb?.(); },
    },
    onChanged: { addListener() {} },
  },
  tabs: {
    // One tab, always the same one.
    query: async () => [{ id: 1, url: PAGE_URL, title: 'Outbound Sales Representative' }],
    create: async () => {},
  },
  scripting: {
    // popup.js injects two different functions: one returns the page's HTML
    // and URL, the other returns document.referrer. Telling them apart by
    // what the function's source mentions is crude and entirely sufficient
    // for two call sites that have not changed in a year.
    executeScript: async ({ func }) => {
      const src = String(func);
      if (src.includes('referrer')) return [{ result: '' }];
      return [{ result: { html: await loadPage(), url: PAGE_URL } }];
    },
  },
};

// The tracker, as far as the popup is concerned.
const realFetch = globalThis.fetch.bind(globalThis);

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;

  // Anything not aimed at the tracker is a real file next to this one.
  if (!url.includes('/api/ext')) return realFetch(input, init);

  const json = (body) => new Response(JSON.stringify(body), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });

  // The one GET the popup makes before showing anything: which sheets exist,
  // and whether this posting is already a row.
  if ((init.method ?? 'GET') === 'GET') {
    if (url.includes('/requirements')) return json({ requirements: '' });
    return json({
      sheets: [{ name: 'Job applications' }, { name: 'On-Campus' }],
      existing: state === 'known' ? EXISTING : null,
    });
  }

  // Saving and marking applied both just succeed.
  if (init.method === 'POST') return json({ id: 'r2', ...EXISTING, status: 'Saved to look at' });
  if (init.method === 'PATCH') return json({ ...EXISTING, status: 'Applied' });

  return json({});
};
