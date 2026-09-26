# Chrome Web Store listing

Everything the submission form asks for, written out. Build the package with
`npm run ext:pack`, which produces `dist/extension-<version>.zip` and refuses
to build if the extractor copies have drifted from `lib/`.

The store will not let you unpublish a version, only replace it, so the pack
script runs the sync check first rather than trusting anyone to remember.

## Letting a reviewer in

A reviewer has to be able to use the extension, and this one is useless
without an account on myjobtracker.co. Sign-up is behind a waitlist and an
invite code, and the invite route creates an invitation bound to one specific
email address, so a code alone opens nothing: you would have to know the
reviewer's address in advance. Submissions get rejected for exactly this,
with "we were unable to test the functionality".

Email and password sign-in is already on in Clerk, so there is nothing to
change there. What is in the way is **Device Trust**, under Configure ->
System policies, which treats a new device as untrusted for password sign-ins
and asks for a code by email. The reviewer signs in from their machine with
correct credentials, and then waits for a code that arrives in an inbox they
cannot reach.

There is no per-user exemption, only one toggle. So it is a submission-day
step rather than something to change now:

1. Make a test account. Use the invite code on the landing page with an email
   you control, sign up, then set a password on it in Clerk (Users -> that
   user -> set password). Put a couple of saved rows on it so the reviewer has
   something to look at.
2. Turn Device Trust off, immediately before submitting.
3. Submit, with the credentials in the reviewer notes.
4. Turn Device Trust back on the moment it is approved.

Leaving it off for those few days exposes one throwaway account and nothing
else: it only ever applied to password sign-ins, and after this the test
account is the only account with a password. Yours and your friend's are
Google-only, so password sign-in fails for them whatever this is set to.

**Reviewer notes**, to paste into the submission:

    The extension saves job postings into the user's own tracker at
    myjobtracker.co, so it needs an account there. Sign-up is invite-only, so
    here is a test account:

        https://myjobtracker.co/sign-in
        email:    <test account email>
        password: <test account password>

    To see it work end to end:
    1. Sign in with the account above.
    2. Open https://myjobtracker.co/settings/connect-extension and press
       Connect. This hands the extension an add-only token for that account.
    3. Open any job posting, for example on LinkedIn, Indeed or a company
       careers page, and click the extension's icon. It reads the posting and
       shows what it found.
    4. Press "Save to tracker", then reload myjobtracker.co to see the row.

    The extension reads a page only when the icon is clicked, holds no host
    permissions, and cannot read or delete anything already in the tracker.

## Store listing

**Name** (45 characters): `Job Application Tracker`

Worth a thought. It is accurate and generic, and there are other extensions
with names close to it, so it will not stand out in search and it does not
say whose tracker it is. `My Job Tracker` matches the site. Changing it means
changing `name` in the manifest.

**Summary** (132 characters):

    Save any job posting from your browser into your tracker, and mark it applied when you send it. No retyping.

**Description**:

    Save a job posting to your tracker without retyping it.

    Open a job, click the icon, and it reads what the page says: the role, the
    employer, the location, the pay, the work arrangement, the deadline, the
    requirements, and whether the employer sponsors visas. Check what it found,
    pick a sheet, and save.

    Works where students actually apply: LinkedIn, Indeed, Handshake, Jobright,
    Workday, Greenhouse, Lever, Ashby, and company careers pages.

    - Reads the page you are looking at, only when you click the icon
    - Marks a row applied in one click when you send the application
    - Tells you when a job is already in your tracker, so nothing doubles up
    - Says whether a posting needs sponsorship, citizenship or a clearance
    - Anything it fills in is yours to edit or delete in the sheet

    A field it worked out rather than read is marked CHECK, because a wrong
    value in a column is worse than an empty one. A page listing many jobs is
    refused rather than turned into a row called "Current openings".

    Requires a free account at myjobtracker.co.

**Category**: Productivity

**Language**: English

## Privacy

**Single purpose**:

    Save the job posting on the page the user is viewing into their own job
    application tracker at myjobtracker.co, and update that row's status when
    they apply.

**activeTab justification**:

    Reads the job posting on the tab the user is looking at, at the moment they
    click the extension's icon and only then. Nothing is read in the
    background, and no other tab is ever accessed.

**scripting justification**:

    Runs one function in that tab, once per click, which returns the page's
    rendered HTML so that postings assembled by JavaScript can be read. A
    plain fetch of the same URL returns an empty shell on LinkedIn, Indeed and
    Workday. No script is injected persistently and no content script runs on
    any page.

**storage justification**:

    Stores the address of the user's tracker and the access token they were
    given when they connected it, so they do not have to reconnect on every
    use. Nothing else is stored.

**Host permission justification**: none requested. The extension declares no
host permissions and cannot read any site in the background.

**Remote code**: No. Every line the extension runs is in the package. Nothing
is fetched and evaluated.

**Data collected** (tick these two, and nothing else):

- Authentication information — the access token for the user's own tracker,
  kept in browser storage on their machine.
- Website content — the text of the job posting the user chose to save, sent
  to their own tracker when they press save.

Not web history: nothing is recorded about where they browse, and no page is
read unless they click the icon on it.

**Certifications**: all three apply. The data is not sold to third parties,
not used for anything outside the single purpose above, and not used to
determine creditworthiness or for lending.

**Privacy policy URL**: https://myjobtracker.co/privacy

It names the extension, says what is sent and when, and discloses the one
third party involved: when a posting words its requirements heading in a way
the extension does not recognise, the posting text goes to Anthropic to be
asked which lines are the requirements.

## Screenshots

At least one, up to five, each exactly 1280x800 or 640x400, PNG or JPEG.
Three worth taking, in this order:

1. The popup open on a real posting, fields filled, the sheet and status
   pickers visible. This is the whole product in one image.
2. The "Already in your tracker" state, which is the thing no other extension
   of this kind does.
3. The row it produced in the tracker, so it is clear where the posting ends
   up.

The popup is 340px wide, so a raw screenshot of it is far smaller than the
required canvas. Centre it on a 1280x800 background rather than scaling it up.

## After it is published

The store assigns a new extension id, different from the unpacked one.
`EXTENSION_IDS` has to hold both, comma separated, or connecting will work for
whichever is missing. Keep the unpacked id so development still works.
