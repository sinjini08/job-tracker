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

If these tools aren't available, tell the student to connect the tracker:
**tracker website → Settings → Connect Claude**, then add the link as a custom
connector in Claude. Don't pretend anything was saved.

The tools validate every value. Sheets, statuses, categories, sources, work modes
and priorities must be one of the listed options, and dates are `YYYY-MM-DD`.
Status changes are recorded in the history automatically, so never log them
yourself.

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
   - `source`: infer it from the URL (handshake.com → Handshake;
     `*.myworkdayjobs.com` for the university → Workday (PSU); linkedin.com →
     LinkedIn; the employer's own site → Company Site).
   - `requirements`: the must-have qualifications, in 2–4 short lines.
   - `job_description`: the full posting text, lightly cleaned. Postings vanish,
     and the student will want the text for interview prep.
   - **Never invent values.** If the posting doesn't say, leave the field out.
3. **Ask only for the gaps**, in one short message:
   - Always ask which **resume version** they used, whether they sent a
     **cover letter**, and whether they had a **referral**.
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
"Comcast rejected me", "I got the offer!", "withdraw from IT help desk".

1. Find the row with `list_applications` (search the company or role). If more
   than one matches, ask which one.
2. Update it with `update_application`:
   - OA received: status `OA / Assessment`. Put the OA due date in
     `next_follow_up` if they gave one.
   - Interview scheduled: status `Interviewing`, and `next_follow_up` = the
     interview date. Then `add_history_note` (kind `interview`) with the date,
     time, format and interviewer, if known.
   - Offer: status `Offer`. Then `add_history_note` (kind `offer`) with pay,
     the deadline to respond, and the start date.
   - Accepted, Rejected or Withdrawn: set the status and clear `next_follow_up`
     (set it to `null`).
3. Confirm in one line what changed.

## Stats and charts

The website's **Charts** tab always shows the headline numbers, how far
applications get, applications per week, current status, and results by source
and by category. Point the student there for an overview. For specific questions
("what's my interview rate?", "how many did I send this month?", "which source
works best?"), call `get_stats` (optionally with `sheet` and `days`) and answer
with the numbers. If a picture helps, draw a chart. For anything `get_stats`
doesn't cover, use `list_applications` and compute it.

## Other requests

- "What should I follow up on?" Use `list_applications`, and list the active ones
  (Applied, OA / Assessment, Interviewing, Offer) whose `next_follow_up` is today
  or earlier, soonest first.
- "Delete X": confirm which one first, then `delete_application`. Its history
  goes with it.
