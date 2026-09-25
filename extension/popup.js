import { extractJob } from './extract.js';

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
const SHOW = [
  ['role', 'Role', 'input'],
  ['company', 'Company', 'input'],
  ['location', 'Location', 'input'],
  ['pay', 'Pay', 'input'],
  ['term', 'Term', 'input'],
  ['category', 'Category', 'input'],
  ['work_mode', 'Work mode', 'input'],
  ['deadline', 'Deadline', 'input'],
  ['source', 'Found on', 'input'],
  ['requirements', 'Key requirements', 'textarea'],
];

const store = {
  get: () => new Promise((res) => chrome.storage.local.get(['endpoint'], (v) => res(v.endpoint ?? ''))),
  set: (endpoint) => new Promise((res) => chrome.storage.local.set({ endpoint }, res)),
  clear: () => new Promise((res) => chrome.storage.local.remove('endpoint', res)),
};

let endpoint = '';
let extracted = null;

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

function render(result, url) {
  const { fields } = result;
  $('title').textContent = fields.role?.value ?? 'Save this posting';
  $('from').textContent = [fields.company?.value, new URL(url).hostname.replace(/^www\./, '')]
    .filter(Boolean).join(' · ');

  const box = $('fields');
  box.textContent = '';
  let anyReview = false;

  for (const [key, label, kind] of SHOW) {
    const got = fields[key];
    // Empty fields are left out rather than shown blank. A popup of ten empty
    // boxes reads as a form to fill in, which is the opposite of the point.
    if (!got) continue;
    const review = got.from !== 'json-ld';
    if (review) anyReview = true;

    const row = document.createElement('div');
    row.className = `row${review ? ' review' : ''}`;
    const lab = document.createElement('label');
    lab.htmlFor = `f-${key}`;
    lab.append(document.createTextNode(label));
    if (review) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'CHECK';
      lab.append(tag);
    }
    const input = document.createElement(kind);
    input.id = `f-${key}`;
    input.value = got.value;
    if (kind === 'textarea') input.rows = 3;
    row.append(lab, input);
    box.append(row);
  }

  $('review-note').hidden = !anyReview;
  show('form');
}

async function loadSheets() {
  const sel = $('sheet');
  sel.textContent = '';
  try {
    const r = await fetch(endpoint, { method: 'GET' });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'Could not reach the tracker.');
    for (const s of d.sheets ?? []) {
      const o = document.createElement('option');
      o.value = s.name;
      o.textContent = s.name;
      sel.append(o);
    }
  } catch {
    // The sheets are a convenience. Failing to fetch them should not stop
    // somebody saving; the endpoint falls back to their first sheet.
    const o = document.createElement('option');
    o.value = '';
    o.textContent = 'Default sheet';
    sel.append(o);
  }
}

function collect() {
  const out = { sheet: $('sheet').value };
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
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collect()),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error ?? 'Could not save that.');
    $('done-what').textContent = `${d.saved.role} at ${d.saved.company}, on ${d.saved.sheet}.`;
    $('done-link').href = d.view_at;
    show('done');
  } catch (e) {
    $('error').textContent = e.message;
    $('error').hidden = false;
    btn.disabled = false;
    btn.textContent = 'Save to tracker';
  }
}

async function start() {
  endpoint = await store.get();
  // Focus the button, not the box: the box now lives inside a collapsed
  // fallback, and focusing something folded away either does nothing or
  // springs the fold open for no reason.
  if (!endpoint) { show('pairing'); $('connect').focus(); return; }

  show('reading');
  try {
    const { html, url } = await readTab();
    extracted = extractJob(html, url);
    if (extracted.isIndex) { show('refused'); return; }
    if (!extracted.fields.role && !extracted.fields.company) {
      show('refused');
      $('refused').querySelector('h1').textContent = 'Nothing to read here';
      $('refused').querySelector('.hint').textContent =
        'This page does not look like a job posting. Open one and try again.';
      return;
    }
    await loadSheets();
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
  const site = endpoint ? new URL(endpoint).origin : 'https://myjobtracker.co';
  await chrome.tabs.create({ url: `${site}/settings/connect-extension` });
  window.close();
});

// When the service worker stores a token, the popup picks it up the next time
// it is opened. Nothing to poll: chrome.storage fires this in any open popup.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.endpoint?.newValue) start();
});

$('pair').addEventListener('click', async () => {
  const value = $('token').value.trim();
  const err = $('pair-error');
  err.hidden = true;
  // Checked here rather than on save, so a mistyped link fails while the
  // person is still looking at the box they typed it into.
  if (!/^https?:\/\/[^\s]+\/api\/ext\/[A-Za-z0-9_-]{20,}$/.test(value)) {
    err.textContent = 'That does not look like the extension link. Copy the whole thing from Settings.';
    err.hidden = false;
    return;
  }
  try {
    const r = await fetch(value, { method: 'GET' });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'The tracker did not accept that link.');
    await store.set(value);
    start();
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  }
});

$('save').addEventListener('click', save);
$('refused-close').addEventListener('click', () => window.close());
$('unpair').addEventListener('click', async () => {
  await store.clear();
  endpoint = '';
  show('pairing');
});

start();
