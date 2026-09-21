---
name: job-tracker
description: Log and update the student's job applications in their Job Application Tracker (an Excel-style website with On-Campus / Off-Campus sheets and charts). Use when the student shares a job posting (link or pasted text) and says they are applying or have applied, asks to add a job to their tracker, reports progress on an application (online assessment, interview, offer, rejection, follow-up, withdrawal), or asks about their application stats. Works through the student's personal "Job Tracker" connector.
---

# Job Application Tracker

The student keeps a tracker of on-campus (university) and off-campus jobs on a
website. You read and write it through their personal **Job Tracker connector**,
which only ever sees this student's own applications. Its tools:

| Tool | Use it to |
|---|---|
| `list_applications` | find rows (filter by sheet/status, search role or company). Check for duplicates, find ids |
| `get_application` | one application in full, with its history |
| `add_application` | add a job (**only after the student confirms**) |
| `update_application` | change fields: status, dates, pay… (pass `null` to clear) |
| `add_history_note` | log an interview, offer details, a follow-up, or a note |
| `delete_application` | delete (only after explicit confirmation) |
| `get_stats` | the numbers behind the website's Charts tab |

If these tools aren't available, tell the student to connect the tracker: in
Claude, **Settings → Connectors → Add custom connector**, paste the tracker's
`/api/mcp` URL (shown on the site under **Settings → Connect Claude**), then click
**Connect** and approve it on the site. Don't pretend anything was saved.

Dates are `YYYY-MM-DD`. Most dropdowns (status, category, source, work mode,
term, outreach method) list the usual choices but accept another value when the
posting genuinely calls for one — prefer a listed value, and only stray when
none of them fit. `type` (the sheet) and `priority` are strict. Status changes
are recorded in the history automatically, so never log them yourself.

Statuses, in pipeline order: `Wishlist` · `Applied` · `Screening` ·
`OA / Assessment` · `Interviewing` · `Final round` · `Offer` · `Accepted`, plus
`Rejected`, `Withdrawn` and `No reply` (an application that went silent).

## Workflow A: the student is applying to a job

1. **Get the posting.** If they gave a link and you can fetch it, read it. If you
   can't (login walls like Handshake or Workday, or no web access), ask them to
   paste the text.
2. **Extract** everything you can:
   - `type`: `On-Campus` when the employer is the university itself (a
     department, lab, library, dining, IT, a TA/LA role, a posting on the
     university's Workday). Everything else is `Off-Campus`.
   - `category`: infer it from the title and terms ("Summer 2027 Intern" is
     `Internship`; "Learning Assistant" is `Research / TA / LA`).
   - `term`: the hiring season the posting names, e.g. `Summer 2027`. Use
     `Ongoing` for a job with no season (most on-campus work). Leave it out if
     the posting doesn't say.
   - `source`: infer it from the URL (handshake.com → Handshake;
     `*.myworkdayjobs.com` for the university → University portal; linkedin.com
     → LinkedIn; indeed.com → Indeed; the employer's own site → Company site).
   - `location`: the campus or building on-campus, "City, ST" off-campus.
     `work_mode` and `hours_per_week` apply to both sheets — fill them only
     when the posting states them.
   - `deadline`: leave it out when the posting is rolling or gives no date, and
     say "rolling — no stated deadline" in `notes`.
   - `requirements`: the must-have qualifications, in 2–4 short lines.
   - `job_description`: the full posting text, lightly cleaned. Postings vanish,
     and the student will want the text for interview prep.
   - **Never invent values.** If the posting doesn't say, leave the field out.
3. **Ask only for the gaps**, in one short message:
   - Always ask which **resume version** they used, whether they sent a
     **cover letter**, and whether they had a **referral**.
   - If they mention a recruiter or hiring manager, save the name in `contact`
     and their **LinkedIn profile** in `contact_link` (many recruiters have no
     findable email; `contact_email` stays empty then).
   - Also ask about anything important you couldn't find (pay, deadline,
     location or work mode, a contact). Let them say "skip".
   - Defaults you can state rather than ask about: status Applied, applied
     today, follow up in 7 days (`next_follow_up`), priority Medium.
4. **Check for duplicates** with `list_applications` (search the company). If the
   same role is already there, ask whether to update that one instead.
5. **Confirm.** Show a compact summary (role, company, sheet, category,
   status, pay, deadline, follow-up date, link) and ask "Save this?"
6. **Save** with `add_application`.
7. **Report back** in one line, for example: "Saved *Software Engineering Intern @
   Vanguard* to your Off-Campus sheet. Follow-up reminder set for 9/26."

## Workflow B: the student reports progress

Examples: "got an OA from Vanguard", "interview with the HCI lab Thursday 2pm",
"Comcast rejected me", "I got the offer!", "withdraw from IT help desk",
"messaged the recruiter on LinkedIn".

**Reaching out to someone** ("I messaged the recruiter", "sent a LinkedIn DM to
the hiring manager", "emailed them to follow up", "talked to them at the career
fair"):
  1. `update_application` with `outreach_method` (`LinkedIn`, `Email`,
     `In person`, `Career fair`), `reached_out_on` = that date (today unless
     they say otherwise), `contact` = the person's name and `contact_link` =
     their LinkedIn profile if they gave one, and `next_follow_up` about a week
     later unless they already have a sooner one.
  2. `add_history_note` (kind `follow_up`) with what they sent, in their words,
     e.g. "LinkedIn DM to Priya Raman (recruiter): asked about timeline for the
     SWE intern role". If they later get a reply, add another note for it.
  Don't change `status` for outreach; messaging someone isn't a pipeline stage.

1. Find the row with `list_applications` (search the company or role). If more
   than one matches, ask which one.
2. Update it with `update_application`:
   - Recruiter screen / phone screen: status `Screening`.
   - OA received: status `OA / Assessment`. Put the OA due date in
     `next_follow_up` if they gave one.
   - Interview scheduled: status `Interviewing`, and `next_follow_up` = the
     interview date. Then `add_history_note` (kind `interview`) with the date,
     time, format and interviewer, if known.
   - Final / onsite round: status `Final round`, same history note.
   - Offer: status `Offer`. Then `add_history_note` (kind `offer`) with pay,
     the deadline to respond, and the start date.
   - Accepted, Rejected, Withdrawn or No reply: set the status and clear
     `next_follow_up` (set it to `null`).
3. Confirm in one line what changed.

## Stats and charts

The website's **Charts** tab always shows the headline numbers, how far
applications get, applications per week, current status, and results by source
and by category. Point the student there for an overview. For specific questions
("what's my interview rate?", "how many did I send this month?", "which source
works best?"), call `get_stats` (optionally with `sheet` and `days`) and answer
with the numbers. If a picture helps, draw a chart. For anything `get_stats`
doesn't cover, use `list_applications` and compute it.

## Points and leagues

The website has a **League** tab where students compete with friends: every
application earns a point, and reaching a screening, assessment, interview,
final round or offer earns more. That happens automatically from what you log —
there is no tool to call and no points to award by hand. If a student asks how
they're doing against their friends, point them at the League tab; `get_stats`
answers questions about their own numbers.

## Other requests

- "What should I follow up on?" Use `list_applications`, and list the open ones
  (anything except Rejected, Withdrawn and No reply) whose `next_follow_up` is
  today or earlier, soonest first — the same count the website shows as
  "Follow-ups due". Also flag a `Wishlist` row whose `deadline` is within three
  days.
- "Delete X": confirm which one first, then `delete_application`. Its history
  goes with it.
