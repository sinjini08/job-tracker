# Job Application Tracker, browser extension

Reads the job posting you are looking at and files it, wherever you are
applying from.

## Trying it

1. `npm run ext:sync` from the repo root, which copies the extractor in.
2. Chrome, `chrome://extensions`, turn on **Developer mode**, then **Load
   unpacked** and pick this folder.
3. In the tracker, **Settings → Save jobs from your browser → Create an
   extension link**, and copy it.
4. Open a job posting, click the extension icon, paste the link once.

## Why the permissions are so small

`activeTab`, `scripting`, `storage`, and no host permissions at all.

Clicking the icon is what grants this one tab, for that one moment. The
alternative, `<all_urls>`, makes Chrome tell everybody at install time that
this extension can read every page they visit, which is a heavy thing to
accept for a job tracker and is not needed: you are looking at the posting
when you click.

There is no background worker and no content script sitting on every page.
The popup reads the tab once and closes.

## Files

    manifest.json   MV3, popup only
    popup.html/css/js   the whole interface
    extract.js      copied from ../lib/extract.js, do not edit here
    icons/          from the app's own mark

`extract.js` is generated. Edit `lib/extract.js`, which is the copy with tests
against saved postings, then `npm run ext:sync`. `npm run ext:check` fails if
the two have drifted.

## What it reads, and what it does not

The popup reads the page as rendered, so postings assembled in the browser
work where a plain fetch of the same URL would see nothing.

It sends nothing until you press save. Fields read straight from the page's
structured data are shown plainly; anything worked out from the page is marked
**CHECK**, because a wrong value in a field is worse than an empty one.

Listing pages are refused rather than turned into a row called "Current job
openings".

The token only reaches `/api/ext`, which can add a row and amend one it was
just shown. It cannot list, read or delete anything, and it is separate from
the assistant connector's token so turning one off leaves the other alone.
