import Link from 'next/link';
import Logo from '@/app/Logo';

export const metadata = {
  title: 'Privacy · Job Application Tracker',
  description: 'What the Job Application Tracker stores, who can see it, and how to get rid of it.',
};

// A real description of what this app does with data, not boilerplate. Google
// requires a privacy policy URL before an OAuth app can be published for
// external users, and anyone being asked to hand over their job search
// deserves a straight answer anyway.
//
// If the app's behaviour changes, this page changes with it. The claims below
// are specific on purpose: they are checkable against the schema.
export default function PrivacyPage() {
  return (
    <main className="legal">
      <header className="legal-head">
        <Link href="/" className="legal-mark"><Logo size={36} tone="dark" /></Link>
        <h1>Privacy</h1>
        <p className="legal-sub">Last updated 24 September 2026</p>
      </header>

      <p className="legal-lede">
        This is a job application tracker for students. It holds your job search, which is
        sensitive information: who you have applied to, what you were offered, what you were
        turned down for. Here is exactly what it keeps and who can see it.
      </p>

      <h2>What is stored</h2>
      <ul>
        <li><b>Your account.</b> Your email address, and your name and profile picture if you
          sign in with Google or Microsoft. Sign-in is handled by Clerk; this site never sees
          your password.</li>
        <li><b>Your applications.</b> Everything you type into the sheet: role, employer, status,
          dates, pay, links, contacts, notes and any job description you paste in.</li>
        <li><b>Your history.</b> Status changes and notes, so the charts can show how far
          applications got and when things moved.</li>
        <li><b>Your points.</b> A running score derived from the milestones your applications
          reach. Points are recorded whether or not you are in a league.</li>
      </ul>

      <h2>Who can see it</h2>
      <p>
        By default, only you. Every row is tied to your account in the database and access rules
        are enforced at the database itself, not just in the app code.
      </p>
      <p>There are exactly three ways anything leaves your own account, and you control all three:</p>
      <ul>
        <li><b>A league.</b> If you join one, the other members see your display name, your chosen
          avatar, your points, your streak and the days you won. They also see your real name if
          you filled that field in, which is blank unless you do and can be cleared again. They
          never see a company, a role, pay, a link or a note. Those are not in the leaderboard data
          at all. You can set your league profile to show points only, and you can leave a league
          whenever you like.</li>
        <li><b>A share link.</b> Only if you create one. It is read-only and you can revoke it.</li>
        <li><b>An assistant.</b> If you connect Claude or ChatGPT, it can read and write your
          applications, and only yours. You approve the connection with a sign-in and can revoke
          it in Settings at any time.</li>
        <li><b>The browser extension.</b> Only if you install it. It reads a page only when you
          click its icon on that page, and it sends nothing anywhere until you press save. What it
          then sends is the posting it read and the sheet you picked. It can add rows and see what
          your sheet tabs are called, and that is all: it cannot read the rows already in your
          tracker, change them, or delete anything. Disconnecting it in Settings stops it working
          and leaves your assistant connection alone.
          <br /><br />
          One part of it uses a language model. When a posting writes its requirements heading in
          a way the extension does not recognise, the text of that posting is sent to Anthropic to
          be asked which lines are the requirements. Only the posting is sent, never your rows,
          your notes or your name, and the model answers with line numbers rather than words, so
          what lands in the field is the posting's own text. Nothing is sent when the extension
          works out the requirements by itself, which is the usual case.</li>
      </ul>

      <h2>Who else is involved</h2>
      <p>
        Three services make this work: <b>Clerk</b> for sign-in, <b>Supabase</b> for the database,
        and <b>Vercel</b> for hosting. They process your data so the app can run. Nobody else
        receives it. Everything on the Insights tab is worked out here, from your own rows, and
        goes nowhere.
      </p>
      <p>
        Nothing is sold, and nothing is shared with advertisers. There is no analytics or tracking
        on this site beyond what is needed to keep you signed in.
      </p>

      <h2>Google and Microsoft sign-in</h2>
      <p>
        If you sign in with Google or Microsoft, this app asks only for your name, your email
        address and your profile picture. It cannot read your mail, your files, your calendar or
        your contacts, and it never receives your password.
      </p>

      <h2>Cookies</h2>
      <p>
        A session cookie from Clerk keeps you signed in. Your browser also remembers a few
        small preferences locally: which sheet you had open, which league you were looking at,
        and how tall you like the rows. Those never leave your device.
      </p>

      <h2>Getting rid of it</h2>
      <p>
        You can edit or delete any row at any time. Deleting your account removes your
        applications, history, points and league memberships along with it. The database is set
        up to cascade, so nothing is left behind.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:easy.jobtracker@gmail.com">easy.jobtracker@gmail.com</a>.
      </p>

      <p className="legal-foot">
        <Link href="/terms">Terms</Link> · <Link href="/">Back to the tracker</Link>
      </p>
    </main>
  );
}
