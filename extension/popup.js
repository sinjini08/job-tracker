import { extractJob, looksApplied } from './extract.js';

// The popup does all the work. There is no content script sitting on every
// page: clicking the icon is what grants this one tab, the page is read once,
// and the popup closes.
//
// Which is also why the permissions are only activeTab and scripting. An
// extension that asks to read every page you visit is a heavy thing to install
// for a job tracker, and it is not needed: the person is looking at the
// posting when they click.
//
// background.js exists for one reason and is otherwise asleep: a popup closes
// when focus leaves it, which is exactly when the connect tab opens, so the
// service worker is what is still listening when the tracker sends the token
// back.

const $ = (id) => document.getElementById(id);
const show = (id) => {
  for (const s of document.querySelectorAll('main > section')) s.hidden = s.id !== id;
};

// Order matters: this is the order a person reads a row in, and role and
// company come first because those two are the only ones the tracker insists
// on. The long text goes last so the popup opens on the parts worth checking.
const REQUIRED = new Set(['role', 'company']);

const SHOW = [
  ['role', 'Role', 'input'],
  ['company', 'Company', 'input'],
  ['location', 'Location', 'input'],
  ['pay', 'Pay', 'input'],
  ['term', 'Term', 'input'],
  ['category', 'Category', 'input'],
  ['work_mode', 'Work mode', 'input'],
  ['work_auth', 'Work authorisation', 'input'],
  ['hours_per_week', 'Hours per week', 'input'],
  ['deadline', 'Deadline', 'date'],
  ['source', 'Found on', 'input'],
  ['requirements', 'Key requirements', 'textarea'],
];

const control = (kind) => document.createElement(kind === 'textarea' ? 'textarea' : 'input');

// The address and the token are kept apart, because the token is only ever
// put in a header. Nothing here builds a URL containing it.
const store = {
  get: () => new Promise((res) => chrome.storage.local.get(['api', 'token'], (v) => res(v))),
  set: (api, token) => new Promise((res) => chrome.storage.local.set({ api, token }, res)),
  clear: () => new Promise((res) => chrome.storage.local.remove(['api', 'token'], res)),
};

let api = '';
let token = '';
let extracted = null;

const auth = () => ({ Authorization: `Bearer ${token}` });

// Where "Open the tracker" goes.
//
// ?sheet=1 on purpose. The tracker remembers the last tab you were on, which
// is right for an ordinary visit and wrong for this link: somebody who has
// just saved a row wants the sheet with the row in it, and was landing on
// Insights or the League instead. The app already honours this parameter, for
// the same reason, on Settings' "Back to my sheet".
const trackerUrl = () => `${new URL(api).origin}/?sheet=1`;

// Read the page as rendered, not as served. A fetch of the same URL gets the
// HTML before any JavaScript has run; this runs in the tab, so a posting
// assembled in the browser is there to be read.
async function readTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No page to read.');
  const [hit] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
  });
  if (!hit?.result) throw new Error('This page cannot be read. Chrome blocks extensions on its own pages.');
  return hit.result;
}

// The page somebody applied from. A confirmation page rarely names the job,
// but the browser knows which page it came from, and that is the posting.
async function cameFrom() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [hit] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.referrer,
    });
    return hit?.result ?? '';
  } catch { return ''; }
}

function render(result, url) {
  const { fields } = result;
  $('title').textContent = fields.role?.value ?? 'Save this posting';
  $('from').textContent = [fields.company?.value, new URL(url).hostname.replace(/^www\./, '')]
    .filter(Boolean).join(' · ');

  const found = $('fields');
  const absent = $('absent');
  found.textContent = '';
  absent.textContent = '';
  let anyReview = false;
  let missing = false;
  let offered = 0;

  for (const [key, label, kind] of SHOW) {
    const got = fields[key];
    // Empty fields are left out rather than shown blank. A popup of ten empty
    // boxes reads as a form to fill in, which is the opposite of the point.
    //
    // Role and company are the exception, because the tracker refuses a row
    // without them. Leaving those out when the page did not give them up is
    // a dead end: the person is told the row needs an employer and has
    // nowhere to type one. So they are always here, empty if need be.
    // What the page could have said and did not is offered rather than
    // dropped. Plenty of postings never state a deadline or the hours, and
    // the person often knows. It goes in a fold, because a column of empty
    // boxes reads as a form to work through and usually none of it is needed.
    if (!got && !REQUIRED.has(key)) {
      const row = document.createElement('div');
      row.className = 'row';
      const lab = document.createElement('label');
      lab.htmlFor = `f-${key}`;
      lab.textContent = label;
      const input = control(kind);
      if (kind === 'date') input.type = 'date';
      input.id = `f-${key}`;
      if (kind === 'textarea') input.rows = 3;
      row.append(lab, input);
      absent.append(row);
      offered += 1;
      continue;
    }
    const blank = !got;
    const review = blank || got.from !== 'json-ld';
    if (review && !blank) anyReview = true;
    if (blank) missing = true;

    const row = document.createElement('div');
    row.className = `row${blank ? ' missing' : review ? ' review' : ''}`;
    const lab = document.createElement('label');
    lab.htmlFor = `f-${key}`;
    lab.append(document.createTextNode(label));
    if (blank || review) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = blank ? 'NEEDED' : 'CHECK';
      lab.append(tag);
    }
    const input = control(kind);
    if (kind === 'date') input.type = 'date';
    input.id = `f-${key}`;
    input.value = got ? got.value : '';
    if (blank) input.placeholder = `The page did not say. Type the ${label.toLowerCase()}.`;
    if (kind === 'textarea') input.rows = 3;
    row.append(lab, input);
    found.append(row);
  }

  $('review-note').hidden = !anyReview || missing;
  $('missing-note').hidden = !missing;
  $('absent-wrap').hidden = offered === 0;
  $('absent-count').textContent = String(offered);
  show('form');
}

// The tracker is asked which lines of the description are the requirements.
// It answers with the text off those lines, or with nothing, and nothing is
// the ordinary case rather than a failure: no key configured, a timeout, or a
// posting that genuinely has no such section all look the same from here.
async function askForRequirements() {
  try {
    const r = await fetch(`${api}/requirements`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: extracted.fields.job_description.value }),
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return;
    const d = await r.json();
    // 'derived' and not 'json-ld', so it arrives marked CHECK like anything
    // else that was worked out rather than read.
    if (d.requirements) extracted.fields.requirements = { value: d.requirements, from: 'derived' };
  } catch {
    // Never blocks the save. A missing field is a much smaller problem than
    // a popup stuck on "Reading the page".
  }
}

// The one call the popup makes before showing anything: which sheets there
// are, and whether this posting is already one of the rows.
async function ask(link) {
  const url = link ? `${api}?link=${encodeURIComponent(link)}` : api;
  const r = await fetch(url, { method: 'GET', headers: auth() });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error ?? 'Could not reach the tracker.');
  return d;
}

const ago = (iso) => {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

// Move a row to Applied. Used from both of the states below.
async function markApplied(id, errBox, done) {
  errBox.hidden = true;
  try {
    const r = await fetch(api, {
      method: 'PATCH',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'Applied' }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'Could not update that.');
    done(d.saved);
  } catch (e) {
    errBox.textContent = e.message;
    errBox.hidden = false;
  }
}

function fillSheets(sheets) {
  const sel = $('sheet');
  sel.textContent = '';
  for (const s of sheets ?? []) {
    const o = document.createElement('option');
    o.value = s.name;
    o.textContent = s.name;
    sel.append(o);
  }
  if (!sel.options.length) {
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Default sheet';
    sel.append(o);
  }
}


function collect() {
  const out = { sheet: $('sheet').value, status: $('status').value };
  for (const [key] of SHOW) {
    const el = $(`f-${key}`);
    if (el && el.value.trim()) out[key] = el.value.trim();
  }
  // Sent whole, never shown: nobody wants a 6,000 character box in a popup,
  // and it is the field the whole feature exists for.
  const f = extracted?.fields ?? {};
  if (f.job_description) out.job_description = f.job_description.value;
  if (f.job_link) out.job_link = f.job_link.value;
  return out;
}

async function save() {
  const btn = $('save');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  $('error').hidden = true;
  try {
    const r = await fetch(api, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify(collect()),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'Could not save that.');
    $('done-what').textContent = `${d.saved.role} at ${d.saved.company}, on ${d.saved.sheet}.`;
    $('done-link').href = trackerUrl();
    show('done');
  } catch (e) {
    $('error').textContent = e.message;
    $('error').hidden = false;
    btn.disabled = false;
    btn.textContent = 'Save to tracker';
  }
}

async function start() {
  ({ api = '', token = '' } = await store.get());
  // Focus the button, not the box: the box now lives inside a collapsed
  // fallback, and focusing something folded away either does nothing or
  // springs the fold open for no reason.
  if (!api || !token) { show('pairing'); $('connect').focus(); return; }

  show('reading');
  try {
    const { html, url } = await readTab();

    // Three things this page might be, and they are asked in this order
    // because the later ones are the expensive ones.
    //
    // A confirmation page, which is the moment worth catching: somebody has
    // just pressed Apply and the row that says Wishlist is now wrong. The
    // tracker is asked about the page they applied from, which is where the
    // browser came from.
    if (looksApplied(html)) {
      const from = await cameFrom();
      const { existing } = await ask(from || url).catch(() => ({}));
      if (existing && existing.status !== 'Applied') {
        $('applied-what').textContent =
          `${existing.role} at ${existing.company} is still down as ${existing.status}.`;
        $('applied-yes').onclick = () => markApplied(existing.id, $('applied-err'), (saved) => {
          $('done-what').textContent = `${saved.role} at ${saved.company} is now Applied.`;
          $('done-link').href = trackerUrl();
          $('done').querySelector('h1').textContent = 'Updated';
          show('done');
        });
        $('applied-no').onclick = () => window.close();
        show('applied');
        return;
      }
    }

    extracted = extractJob(html, url);
    if (extracted.isIndex) { show('refused'); return; }
    if (!extracted.fields.role && !extracted.fields.company) {
      show('refused');
      $('refused').querySelector('h1').textContent = 'Nothing to read here';
      $('refused').querySelector('.hint').textContent =
        'This page does not look like a job posting. Open one and try again.';
      return;
    }

    // Saving the same job twice is easy and noticing afterwards is not, so
    // the tracker is asked before the form is offered rather than after.
    const link = extracted.fields.job_link?.value || url;
    const answer = await ask(link).catch(() => ({}));
    const known = answer.existing;
    if (known) {
      const applied = known.status === 'Applied';
      $('known-what').textContent = applied
        ? `${known.role} at ${known.company}, applied ${ago(known.date_applied ?? known.saved_at)}, on ${known.sheet}.`
        : `${known.role} at ${known.company}, saved ${ago(known.saved_at)} as ${known.status}, on ${known.sheet}.`;
      $('known-apply').hidden = applied;
      $('known-apply').onclick = () => markApplied(known.id, $('known-err'), (saved) => {
        $('known-what').textContent = `${saved.role} at ${saved.company} is now Applied.`;
        $('known-apply').hidden = true;
      });
      $('known-open').href = trackerUrl();
      show('known');
      return;
    }

    fillSheets(answer.sheets);
    // Only when the page's own wording defeated the matcher. The deterministic
    // answer is preferred whenever there is one: it is free, instant, and it
    // was read off the page rather than judged.
    if (!extracted.fields.requirements && extracted.fields.job_description) {
      await askForRequirements();
    }
    render(extracted, url);
  } catch (e) {
    show('form');
    $('error').textContent = e.message;
    $('error').hidden = false;
    $('save').disabled = true;
  }
}

// The handshake. The popup cannot stay open across a tab switch, so it opens
// the tracker and stops; the service worker is what receives the token, and
// this listener is what notices the write and carries on.
$('connect').addEventListener('click', async () => {
  const err = $('pair-error');
  err.hidden = true;
  // Where to send them. Whatever they last paired with, else the real site.
  const site = api ? new URL(api).origin : 'https://myjobtracker.co';
  await chrome.tabs.create({ url: `${site}/settings/connect-extension` });
  window.close();
});

// When the service worker stores a token, the popup picks it up the next time
// it is opened. Nothing to poll: chrome.storage fires this in any open popup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.token?.newValue) start();
});

$('pair').addEventListener('click', async () => {
  const value = $('token').value.trim();
  const err = $('pair-error');
  err.hidden = true;
  // Checked here rather than on save, so a mistyped link fails while the
  // person is still looking at the box they typed it into.
  const found = /^(https?:\/\/[^\s/#]+\/api\/ext)#([A-Za-z0-9_-]{20,})$/.exec(value);
  if (!found) {
    err.textContent = 'That does not look like the extension link. Copy the whole thing from Settings.';
    err.hidden = false;
    return;
  }
  try {
    const r = await fetch(found[1], { method: 'GET', headers: { Authorization: `Bearer ${found[2]}` } });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'The tracker did not accept that link.');
    await store.set(found[1], found[2]);
    start();
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  }
});

$('save').addEventListener('click', save);
$('refused-close').addEventListener('click', () => window.close());
$('known-close').addEventListener('click', () => window.close());
$('unpair').addEventListener('click', async () => {
  await store.clear();
  api = '';
  token = '';
  show('pairing');
});

start();
