import Link from 'next/link';
import { redirect } from 'next/navigation';
import Avatar from '@/app/Avatar';
import Logo from '@/app/Logo';
import { currentUser } from '@/lib/auth';
import { leagueInvite } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

// An invite to a league, as a link: myjobtracker.co/join/A1B2C3.
//
// It used to be a six-character code, which left the friend five steps from
// playing: find the site, sign up, open League, set a name, type the code.
// The link takes them straight to the one that matters.
//
// Signed in, it hands over to the League tab (/?join=CODE), which asks for a
// board name if they have none and then offers Join. Signed out, it is a small
// front door naming the league and its host, with sign-up and sign-in that
// both come back here, so the invite survives making an account.
//
// Kept out of search (next.config.mjs): a league's name is for its invitees.

const SUB = 'Add your friends. Earn points. Build streaks. Climb the league.';

export async function generateMetadata({ params }) {
  const { code } = await params;
  const invite = await leagueInvite(code);
  // What a messaging app shows when the link is pasted, so it is worth saying
  // what the link is rather than the site's bare name.
  const title = invite
    ? `Join ${invite.name} on Job Application Tracker`
    : 'League invite · Job Application Tracker';
  return {
    title,
    description: SUB,
    robots: { index: false, follow: false },
    openGraph: { title, description: SUB, siteName: 'Job Application Tracker' },
  };
}

export default async function JoinPage({ params }) {
  const { code } = await params;
  const invite = await leagueInvite(code);
  const user = await currentUser();
  if (user && invite) redirect(`/?join=${invite.code}`);

  const back = encodeURIComponent(`/join/${invite?.code ?? ''}`);
  const people = invite && `${invite.members} ${invite.members === 1 ? 'person' : 'people'} in it so far.`;

  return (
    <main className="login">
      <div className="login-intro">
        <div className="login-mark"><Logo size={64} /></div>
        <h1>Job Application Tracker</h1>
        <p>{SUB}</p>
      </div>

      <div className="login-card join-card">
        {invite ? (
          <>
            <Avatar name={invite.host.name ?? invite.name} avatar={invite.host.avatar} size={52} />
            <h2>
              You&rsquo;re invited to <b>{invite.name}</b>
              {invite.host.name && <>, hosted by <b>{invite.host.name}</b></>}
            </h2>
            <p>{people} Your friends see your points, never where you applied.</p>
            <Link className="join-go" href={`/sign-up?redirect_url=${back}`}>Get started free</Link>
            <p className="join-fine">
              Already have an account? <Link href={`/sign-in?redirect_url=${back}`}>Sign in</Link>
            </p>
          </>
        ) : (
          <>
            <h2>This invite has expired</h2>
            <p>The league may have been deleted. Ask whoever sent it for a new link.</p>
            <Link className="join-go" href="/">Go to Job Application Tracker</Link>
          </>
        )}
      </div>
    </main>
  );
}
