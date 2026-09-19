# Job Application Tracker

A live, Excel-style tracker for on-campus and off-campus job applications.

- **The website** (Next.js on Vercel) is a spreadsheet with **On-Campus** and
  **Off-Campus** tabs. You can click any cell and type. Click a row number to see the
  saved job description and that application's history.
- **Access codes.** `EDIT_CODE` gets full access (that's you). `VIEW_CODE` is read-only;
  give it to anyone who should be able to look. Without a code, the site shows only the
  sign-in screen, and none of the data leaves the server.
- **Claude adds applications for you.** Paste a posting, say you're applying, and Claude
  fills in the row through the Supabase connector (see `claude-skill/job-tracker/SKILL.md`).
- **The data lives in Supabase (Postgres).** Status changes are logged to each
  application's history automatically.

```
You ──► Claude (Supabase connector) ──┐
                                      ├──► Supabase Postgres
Website (edit code / view code) ──────┘
```

---

## 1. Try it locally (no accounts needed)

```bash
npm install
npm run demo
```

Open http://localhost:3000 and sign in with `edit-demo`, or `view-demo` for read-only.
Demo mode keeps sample data in memory and resets it every time the server restarts. It
ignores `.env.local`, and it never runs in production.

## 2. Create the database (Supabase)

1. Sign up at https://supabase.com and click **New project**. Name it `job-tracker`,
   choose a strong database password (save it in your password manager), and pick the
   region closest to you.
2. In the project, open **SQL Editor → New query**. Paste all of
   [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. It's safe to run again.
3. Open **Project Settings → API Keys** and copy:
   - the **Project URL**, which goes in `SUPABASE_URL`
   - the **secret key** (called `service_role` on older projects), which goes in
     `SUPABASE_SERVICE_ROLE_KEY`. This key bypasses all security. Only ever put it in
     `.env.local` and in Vercel's settings. Never commit it or paste it into a chat.

Row-level security is on, and there are no public policies. The public "anon" key can't
read anything, so the only ways in are this website's server and your Claude connector.

> Free Supabase projects pause after about a week of no activity. If the site shows a
> connection error, open the Supabase dashboard and click **Restore**.

## 3. Deploy the website (Vercel)

1. Push this folder to a **private** GitHub repo.
2. In Vercel, click **Add New → Project** and import the repo. It detects Next.js on its own.
3. Under **Environment Variables**, add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | from step 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 2 |
   | `EDIT_CODE` | your own code: long and unguessable |
   | `VIEW_CODE` | the code you'll give to other people |
   | `SESSION_SECRET` | the output of `openssl rand -base64 48` |

4. Click **Deploy**. To change a code later, edit the variable and redeploy. Changing
   `SESSION_SECRET` signs everyone out.

## 4. Let Claude update the tracker

1. **Connect Supabase to Claude.**
   - *Claude app:* **Settings → Connectors**. Add **Supabase**, sign in, and allow access
     to the `job-tracker` project.
   - *Claude Code:* add Supabase's MCP server by following Supabase's MCP guide. Scope it
     to the `job-tracker` project.
2. **Install the skill** in [`claude-skill/job-tracker/`](claude-skill/job-tracker/SKILL.md):
   - *Claude app:* zip the `job-tracker` folder, then go to **Settings → Capabilities →
     Skills → Upload skill**.
   - *Claude Code:* copy the folder to `~/.claude/skills/job-tracker/`.
3. Try it: paste a posting and say *"I'm applying to this."* Claude fills in what it can,
   asks about the rest (resume version, cover letter, referral, anything the posting
   doesn't say), shows you the row, and saves it after you confirm. Later, say things like
   *"Vanguard sent me an OA"* or *"interview with the HCI lab Thursday at 2"*, and it
   updates the status and history.

---

## Using the sheet

| Action | How |
|---|---|
| Edit a cell | Double-click it, press Enter, or just start typing |
| Save and move | Enter moves down, Tab moves right, Esc cancels |
| Clear a cell | Delete or Backspace. Clearing the last filled cell in a row deletes the row |
| Add a row | Type in the first empty row, or click **+ New row** |
| Sort | Click a column header (click again to reverse, a third time to clear) |
| Details and history | Click the row number |
| Move a job to the other tab | Open its details → **Sheet** |

Overdue follow-ups, and wishlist deadlines within three days, show in red. The sheet
refreshes every 20 seconds and whenever you switch back to the tab, so changes Claude
makes show up on their own.

## Project layout

```
app/
  page.js, Sheet.js, Drawer.js   the spreadsheet UI
  login/                         access-code sign-in (server action)
  api/applications/...           JSON API (edit code needed for writes)
lib/
  fields.js                      the columns in each sheet and the dropdown options
  session.js, auth.js            signed session cookie and role checks
  db.js, memory-store.js         Supabase store and the local demo store
proxy.js                         sends signed-out visitors to /login
supabase/schema.sql              tables, triggers, RLS
claude-skill/job-tracker/        the Claude skill
```

To add a column: add it to `supabase/schema.sql` (with `alter table ... add column`),
then to `WRITABLE` and a sheet in `lib/fields.js`, and to the table in the skill.
