import Link from 'next/link';
import Logo from '@/app/Logo';

export const metadata = {
  title: 'Terms · Job Application Tracker',
  description: 'What you can expect from the Job Application Tracker, and what it expects from you.',
};

// Written to be read, not skipped. The point of this page is the handful of
// things somebody cannot work out for themselves: that it is free and run by
// one person, that it may break or stop, that the data is theirs and leaves
// with them, and what would get an account closed.
//
// Everything about what is stored and who sees it lives on /privacy instead.
// These two pages should never say the same thing twice, because then they can
// disagree, and one of them will be the one nobody remembers to update.
export default function TermsPage() {
  return (
    <main className="legal">
      <header className="legal-head">
        <Link href="/" className="legal-mark"><Logo size={36} tone="dark" /></Link>
        <h1>Terms</h1>
        <p className="legal-sub">Last updated 24 September 2026</p>
      </header>

      <p className="legal-lede">
        This is a free job application tracker for students, built and run by one person. Using it
        means agreeing to what is below. It is short, and there is nothing buried in it.
      </p>

      <h2>What you get</h2>
      <p>
        A place to keep your job search: a sheet of applications, charts of how it is going, and a
        league if you want to keep score with friends. It costs nothing, and there is no paid tier
        waiting to appear behind a feature you already use.
      </p>

      <h2>Your account</h2>
      <p>
        Sign-in is handled by Clerk, and access is by invitation or through the waitlist. Keep your
        sign-in to yourself: anything done from your account is treated as done by you. One account
        per person, and you need to be old enough to hold a Google account in your country, which
        in most places means thirteen.
      </p>

      <h2>Your data is yours</h2>
      <p>
        What you put in the sheet belongs to you. Using this app gives nobody the right to sell it,
        publish it, train on it, or hand it to an advertiser. You can edit or delete any of it at
        any time, and deleting your account takes the rest with it. What is stored and who can see
        it is set out on the <Link href="/privacy">privacy page</Link>.
      </p>

      <h2>What not to do</h2>
      <ul>
        <li>Do not use it to store other people&rsquo;s personal information without their say-so.
          A recruiter&rsquo;s name and email on an application you actually sent is fine. A list of
          people you scraped from somewhere is not.</li>
        <li>Do not use leagues to harass anyone. Leagues are for people who know each other.</li>
        <li>Do not attack the service: no scraping, no hammering the API, no trying to reach
          another person&rsquo;s rows, no automated sign-ups.</li>
        <li>Do not use it for anything illegal.</li>
      </ul>

      <h2>It may break, and it may stop</h2>
      <p>
        This is one person&rsquo;s project, not a company with an on-call rota. It can go down, lose
        a feature you liked, or change shape without warning. If it ever shuts down for good there
        will be notice and a way to take your data out, but it would be sensible not to keep your
        only copy of something important here.
      </p>
      <p>
        The tracker also only knows what it is told. Dates, reminders, and anything read out of a
        posting you pasted in can be wrong. Check a deadline that matters against the employer
        rather than against this.
      </p>

      <h2>If you connect an assistant</h2>
      <p>
        You can connect Claude or ChatGPT so it can read and write your applications. That is your
        account with them, under their terms, and what they do with a conversation is between you
        and them. You can revoke the connection in Settings whenever you like.
      </p>

      <h2>Ending it</h2>
      <p>
        You can delete your account whenever you want, from Settings, and it takes your
        applications, history, points and league memberships with it. An account may be closed from
        this end for the things listed above. If that happens you will be told why and given a
        chance to get your data out first, unless the account was being used to harm someone else.
      </p>

      <h2>The legal part, in plain words</h2>
      <p>
        The app is provided as it is, with no promise that it will be available, correct, or fit for
        any particular purpose. So far as the law allows, nobody here is liable for a job you did
        not get, a deadline you missed, or data you lost. That is not a way of dodging
        responsibility. It is the honest position of a free tool run by one person, and it is why
        the section above suggests keeping your own copy of anything that matters.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms change, the date at the top changes with them, and anything that actually
        affects you will be said in the app rather than quietly edited in here.
      </p>

      <h2>Questions</h2>
      <p>
        Email <a href="mailto:easy.jobtracker@gmail.com">easy.jobtracker@gmail.com</a>.
      </p>

      <p className="legal-foot"><Link href="/">Back to the tracker</Link></p>
    </main>
  );
}
