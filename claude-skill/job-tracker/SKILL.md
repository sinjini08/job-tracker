---
name: job-tracker
description: Log and update the user's job applications in their Supabase-backed Job Application Tracker. Use when the user shares a job posting (link or pasted text) and says they are applying or have applied, asks to add a job to their tracker, or reports progress on an application (online assessment, interview, offer, rejection, follow-up, withdrawal). Extracts every field it can from the posting, asks only for what's missing, confirms, then writes to the database.
---

# Job Application Tracker

The user keeps a live, spreadsheet-style tracker of on-campus (Penn State) and
off-campus jobs. It is a website backed by a Supabase Postgres database. You
write to that database through the **Supabase connector** (its SQL tool,
`execute_sql`, against the project that contains the `applications` table).
The website updates within ~20 seconds of any write.

- **Supabase project ID:** `pnlzjqdcxcpznqwhkynm`. Pass it as `project_id` on every
  call. Never touch any other project.
- **Live site:** https://job-tracker-sable-iota.vercel.app (mention it when reporting a save)

If the Supabase connector isn't available in this conversation, say so and stop.
Don't pretend to have saved anything.

## Tables

`public.applications`: one row per job.

| column | type | notes |
|---|---|---|
| `type` | text | **`On-Campus`** or **`Off-Campus`** (which sheet tab it lands on) |
| `role` | text | job title |
| `company` | text | company, or the PSU office/department for on-campus jobs |
| `category` | text | `Internship`, `Part-time`, `Full-time`, `Co-op`, `Research / TA / LA`, `Work-Study` |
| `status` | text | `Wishlist`, `Applied`, `OA / Assessment`, `Interviewing`, `Offer`, `Accepted`, `Rejected`, `Withdrawn`, `Ghosted` |
| `priority` | text | `High`, `Medium`, `Low` |
| `deadline` | date | application deadline |
| `date_applied` | date | |
| `next_follow_up` | date | |
| `location` | text | "City, ST" |
| `work_mode` | text | `On-site`, `Hybrid`, `Remote` |
| `pay` | text | as written: "$15/hr", "$95,000–$110,000/yr", "Stipend" |
| `hours_per_week` | numeric | |
| `job_link` | text | canonical posting URL |
| `source` | text | `Handshake`, `Workday (PSU)`, `LinkedIn`, `Company Site`, `Referral`, `Career Fair`, `Other` |
| `contact` / `contact_email` | text | recruiter or hiring manager |
| `referral` / `cover_letter` | boolean | |
| `resume_version` | text | which resume they sent |
| `requirements` | text | 2–4 line summary of key qualifications |
| `job_description` | text | the full posting text, saved because listings disappear |
| `notes` | text | anything else worth remembering |

Values in select-style columns **must exactly match** the options above. The
database rejects anything else.

`public.application_events` is the history of each application:
`(application_id, event_date, kind, detail)`, where `kind` is one of
`status`, `note`, `interview`, `follow_up`, `offer`.
**Status changes are logged automatically by a trigger.** Never insert a
`status` event yourself. Add `interview` / `offer` / `note` / `follow_up`
events for the details that a status change alone doesn't capture.

## Workflow A: the user is applying to a job

1. **Get the posting.** If they gave a link and you can fetch it, read it. If you
   can't fetch it (a login wall like Handshake or Workday, or no web access), ask
   them to paste the text.
2. **Extract** every column you can. Rules:
   - `type`: `On-Campus` when the employer is Penn State itself (a PSU
     department, lab, library, dining, IT, a TA/LA role, or a posting on PSU
     Workday). Everything else is `Off-Campus`.
   - `category`: infer it from the title and terms ("Summer 2027 Intern" is
     `Internship`; "Learning Assistant" is `Research / TA / LA`).
   - `source`: infer it from the URL (handshake.com → Handshake;
     psu.wd1.myworkdayjobs.com → Workday (PSU); linkedin.com → LinkedIn; the
     employer's own domain → Company Site).
   - `requirements`: summarize the must-have qualifications in 2–4 short lines.
   - `job_description`: the full posting text, lightly cleaned (no nav or footer junk).
   - Never invent values. If the posting doesn't say, leave the column empty.
3. **Ask only for the gaps**, in one short message:
   - Always ask: which **resume version** they used, whether they sent a
     **cover letter**, and whether they had a **referral**.
   - Also ask about anything important you couldn't find: pay, deadline,
     location or work mode, a contact. Let them say "skip".
   - Defaults you can state rather than ask about: `status = 'Applied'`,
     `date_applied = today`, `next_follow_up = today + 7 days`, `priority = 'Medium'`.
4. **Check for duplicates** before inserting:
   ```sql
   select id, role, company, status, date_applied from public.applications
   where company ilike '%<company>%' order by created_at desc limit 10;
   ```
   If the same role at the same company already exists, ask whether to update
   that row instead.
5. **Confirm.** Show a compact summary (role, company, sheet, category,
   status, pay, deadline, follow-up, link) and ask "Save this?" Don't write
   until they say yes.
6. **Insert.** Use dollar-quoting for every free-text value so quotes and
   apostrophes in the posting can't break the SQL. Pick a tag that doesn't
   appear in the text, e.g. `$jd$`:
   ```sql
   insert into public.applications
     (type, role, company, category, status, priority, deadline, date_applied,
      next_follow_up, location, work_mode, pay, hours_per_week, job_link, source,
      contact, contact_email, referral, cover_letter, resume_version,
      requirements, job_description, notes)
   values
     ('Off-Campus', $t$Software Engineering Intern$t$, $t$Vanguard$t$, 'Internship',
      'Applied', 'Medium', '2026-10-15', current_date, current_date + 7,
      $t$Malvern, PA$t$, 'Hybrid', $t$$40/hr$t$, null, $t$https://...$t$, 'Handshake',
      null, null, false, true, $t$Resume v3$t$,
      $t$Java or Python; data structures; grad 2028$t$, $jd$...full posting...$jd$, null)
   returning id, role, company;
   ```
7. **Report back** in one line, for example: "Saved: *Software Engineering Intern
   @ Vanguard* on the Off-Campus sheet. Follow-up set for 9/26."

## Workflow B: the user reports progress

Examples: "got an OA from Vanguard", "interview with the HCI lab Thursday 2pm",
"Comcast rejected me", "I got the offer!", "withdraw from IT help desk".

1. Find the row:
   ```sql
   select id, role, company, status from public.applications
   where company ilike '%vanguard%' or role ilike '%vanguard%';
   ```
   If more than one row matches, ask which one.
2. Update the status and any dates it implies:
   - OA received: `status = 'OA / Assessment'`. If they gave a due date, put it
     in `next_follow_up`.
   - Interview scheduled: `status = 'Interviewing'` and
     `next_follow_up = <interview date>`. Also add an `interview` event with
     the date, time, format and interviewer, if known.
   - Offer: `status = 'Offer'`. Add an `offer` event with pay, deadline to
     respond and start date.
   - Accepted, Rejected or Withdrawn: set the status and clear `next_follow_up`.
   ```sql
   update public.applications
   set status = 'Interviewing', next_follow_up = '2026-09-25'
   where id = '<id>';

   insert into public.application_events (application_id, event_date, kind, detail)
   values ('<id>', '2026-09-25', 'interview', $t$Technical interview, 2pm, Zoom, with J. Lee$t$);
   ```
3. Confirm in one line what changed.

## Charts and stats

The website has a **Charts** tab (the last tab at the bottom) that's always up to date:
headline numbers, how far applications get, applications per week, current
status, results by source, and by category, with Sheet and Period filters.
Point the user there for those.

For anything the tab doesn't cover ("interview rate for on-campus vs
off-campus", "average days until I hear back", "which week did I apply the
most"), query the tables with `execute_sql` and answer with the number. If a
picture helps, draw a chart. Count "reached a stage" from the history
(`application_events` status rows, where `detail` is `'Applied'` or
`'Old → New'`), not just from the current status, because a row now marked
Rejected may have reached Interviewing first.

## Other requests

- "What's on my plate?" / "what should I follow up on?" Query the rows where
  `next_follow_up <= current_date + 3` and `status in ('Applied','OA / Assessment','Interviewing','Offer')`,
  and list them.
- "Delete X". Confirm first. Deleting a row also deletes its history.
- Only touch `public.applications` and `public.application_events`. Never
  change the schema, the triggers or the RLS settings.
