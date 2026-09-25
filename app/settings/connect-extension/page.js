import { redirect } from 'next/navigation';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { EXTENSION_IDS } from '@/lib/ext-ids';
import Connect from './Connect';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Connect the extension · Job Application Tracker',
  robots: { index: false, follow: false },
};

// Where the browser extension sends somebody to be paired.
//
// The whole point is that nobody copies a token. They are already signed in
// here, so one press mints one and hands it straight to the extension.
//
// Which extension. This is the part worth being careful about: the obvious
// version takes the extension id from the query string, and then any link
// anywhere could send somebody here with an id belonging to an extension the
// attacker wrote, and one press would hand over a token that can write to
// their tracker for as long as it is not revoked.
//
// So the id is never read from the URL. It comes from EXTENSION_IDS in the
// environment, which is a decision made once by whoever runs this, and an
// extension not on that list cannot be paired no matter what link was
// followed.

export default async function ConnectExtensionPage() {
  const user = await currentUserWithEmail();
  if (!user) redirect('/sign-in');
  await ensureProfile(user.id, user.email);
  return <Connect ids={EXTENSION_IDS} email={user.email} />;
}
