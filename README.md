# Job Application Tracker

An Excel-style tracker for students' on-campus and off-campus job applications,
with charts, read-only share links, and a personal Claude connector that fills it
in from job postings.

- **Accounts:** anyone can sign up with an email address. They sign in with a
  one-time code emailed to them, so there are no passwords.
- **Private by default:** each student sees only their own applications. The
  database enforces this with row-level security, not just the website.
- **The sheet:** On-Campus and Off-Campus tabs. Click a cell and type. Click a
  row number to see the saved job description and the application's history.
- **📊 Charts:** headline numbers, how far applications get, applications per week,
  and breakdowns by status, source and category.
- **Sharing:** a student can create a read-only link (for a career advisor or a
  friend) and turn it off at any time.
- **Claude:** each student gets a personal connector link (Settings → Connect
  Claude). Claude can then add jobs from pasted postings, update statuses, and
  answer questions about the student's stats, with access to that student's data only.

```
Student ──sign in (email code)──► Website ──(their session, RLS)──► Supabase
Student's Claude ──personal link──► /api/mcp/<token> ──(scoped to them)──┘
Advisor ──share link──► /s/<token> (read-only) ─────────────────────────┘
```

---

## Setup (for whoever runs the site)

### 1. Supabase

1. Create a project at https://supabase.com.
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql), then
   [`supabase/migrations/002_multi_user.sql`](supabase/migrations/002_multi_user.sql).
3. Go to **Authentication → Emails → Templates** and add the one-time code to both
   the **Confirm signup** and **Magic Link** templates. The site asks for the code,
   not a link:
   ```html
   <h2>Your sign-in code</h2>
   <p>Enter this code to sign in to Job Application Tracker:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>It expires in an hour. If you didn't request it, you can ignore this email.</p>
   ```
4. In **Authentication → URL Configuration**, set **Site URL** to your live site's address.
5. **Before inviting anyone:** Supabase's built-in email only sends to members of
   your Supabase team, and only a few emails an hour. Under **Authentication →
   Emails → SMTP Settings**, connect a real email service. Gmail with an app
   password works for small groups (about 500 emails a day). Resend or Brevo are
   free alternatives.

### 2. Vercel

Import the repo and add these environment variables:

| Name | Where to find it |
|---|---|
| `SUPABASE_URL` | Project Settings → Data API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Project Settings → API Keys → publishable key (`sb_publishable_…`), safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → secret key (`sb_secret_…`), **server-only, never share it** |

On the free Vercel plan, commits must be authored by the email address linked to
the GitHub account that owns the Vercel project. Otherwise the deploy is blocked.

### 3. Local development

```bash
npm install
cp .env.example .env.local   # fill in the three values
npm run dev
```

---

## For students: using Claude with your tracker

1. On the site, open **Settings → Connect Claude → Create my connector link**, and
   copy the link. It's shown once, and it works like a password.
2. In Claude, go to **Settings → Connectors → Add custom connector**. Name it
   **Job Tracker** and paste the link. If you use Claude Code instead, run
   `claude mcp add --transport http job-tracker <link>`.
3. Optional but recommended: add the skill in
   [`claude-skill/job-tracker/`](claude-skill/job-tracker/SKILL.md). It teaches Claude
   the whole routine: read the posting, ask only about the gaps, confirm, then
   save. In Claude, zip the folder and go to **Settings → Capabilities → Skills →
   Upload**. In Claude Code, copy the folder to `~/.claude/skills/`.
4. Paste a job posting and say *"I'm applying to this."*

If a link leaks, open **Settings → Make a new link**. The old one stops working
immediately.

---

## How access is enforced

| Path | Who | How |
|---|---|---|
| Website and `/api/*` | the signed-in student | Supabase session cookie. Queries run as that user under RLS (`user_id = auth.uid()`) |
| `/s/<token>` and `/api/share/<token>/*` | anyone with the share link | read-only routes. The server looks up the owner and reads only their rows |
| `/api/mcp/<token>` | the student's Claude | the token is stored only as a SHA-256 hash. Tools run against a store scoped to that user |

Every database call goes through `storeFor(client, userId)` in `lib/db.js`, which
filters every query by `user_id`. For the signed-in path, RLS enforces the same
rule a second time. Deleting an account (Settings → Account) removes all of that
student's data through `ON DELETE CASCADE`.

## Project layout

```
app/
  page.js, Sheet.js, Drawer.js, Charts.js   the spreadsheet and the Charts tab
  login/                                    email-code sign-in (server actions)
  settings/                                 connector link, share link, account
  s/[token]/                                read-only shared view
  api/applications/…, api/events            signed-in JSON API
  api/share/[token]/…                       read-only JSON API for share links
  api/mcp/[token]/                          the per-student Claude connector (MCP)
lib/
  db.js            per-user data access (the one place queries are built)
  auth.js          sessions, share and connector token lookups
  mcp-tools.js     the connector's tools
  stats.js         numbers behind Charts, shared with the get_stats tool
  fields.js        columns and dropdown options
proxy.js           refreshes sessions; sends signed-out visitors to /login
supabase/          schema.sql and migrations/
claude-skill/      the Claude skill
```
