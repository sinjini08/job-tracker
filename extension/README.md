# Job Application Tracker, browser extension

Reads the job posting you are looking at and files it, wherever you are
applying from.

## How a user connects it

Install from the store, click the icon on a job posting, press **Connect to my
tracker**. The tracker opens, they press one button, and the extension has its
token. Nothing is copied and nothing is typed.

They never run any of the commands below. `ext:sync` is a build step.

## Trying it yourself

1. `npm run ext:sync` from the repo root, which copies the extractor in.
2. Chrome, `chrome://extensions`, **Developer mode**, **Load unpacked**, pick
   this folder. Note the id Chrome gives it.
3. Set `EXTENSION_IDS` to that id, in `.env` locally or in Vercel for the real
   site, and restart. Without it the connect page refuses to pair, on purpose.
4. Open a posting and click the icon.

The one-press handshake needs a real https origin, so it does not work against
a local dev server: `externally_connectable` will not match localhost. Against
localhost, open the fold in the popup and paste a link from Settings instead.

## Connecting, and the trap in the obvious version

The extension opens `/settings/connect-extension`, where somebody already
signed in presses one button. That mints a token and hands it straight to the
extension. It is never rendered, never on the clipboard and never in a URL.

Which extension gets it comes from `EXTENSION_IDS` in the environment, never
from the query string. Reading it from the URL is the obvious way to write this
and it would mean any link anywhere could send somebody here with an id
belonging to an extension somebody else wrote, and one press would hand over a
token that writes to their tracker until it is revoked.

`background.js` exists only to receive that message, because a popup closes the
instant the connect tab opens. It also re-checks that the token points back at
the origin that sent it, so a page on the tracker's own domain cannot pair the
extension to somewhere else.

## Why the permissions are so small

`activeTab`, `scripting`, `storage`, and no host permissions at all.
`externally_connectable` names one origin, which is not a permission and shows
nothing at install time.

Clicking the icon is what grants this one tab, for that one moment. The
alternative, `<all_urls>`, makes Chrome tell everybody at install time that
this extension can read every page they visit, which is a heavy thing to
accept for a job tracker and is not needed: you are looking at the posting
when you click.

There is no background worker and no content script sitting on every page.
The popup reads the tab once and closes.

## Files

    manifest.json   MV3
    popup.html/css/js   the whole interface
    background.js   asleep except during the connect handshake
    extract.js      copied from ../lib/extract.js, do not edit here
    icons/          from the app's own mark

`extract.js` is generated. Edit `lib/extract.js`, which is the copy with tests
against saved postings, then `npm run ext:sync`.

The drift check runs as `pretest`, so `npm test` fails before the suite starts
if the two have diverged. It is not a thing anybody has to remember.

## What it reads, and what it does not

The popup reads the page as rendered, so postings assembled in the browser
work where a plain fetch of the same URL would see nothing.

It sends nothing until you press save. Fields read straight from the page's
structured data are shown plainly; anything worked out from the page is marked
**CHECK**, because a wrong value in a field is worse than an empty one.

Listing pages are refused rather than turned into a row called "Current job
openings".

The token only reaches `/api/ext`, which does two things: add a row, and list
what your sheet tabs are called so the popup can ask which one. It cannot read
the rows in them, change a row, or delete anything, and it is separate from
the assistant connector's token so turning one off leaves the other alone.

It travels in an `Authorization: Bearer` header, never in the URL. The link
the tracker hands over keeps it in the fragment (`/api/ext#<token>`), which a
browser never sends to a server, so the token stays out of access logs on both
sides. It is held in `chrome.storage.local`, which is not encrypted: anyone
with your unlocked machine and your Chrome profile can read it, the same as a
logged-in session. Disconnect from Settings revokes it.
