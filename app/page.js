import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import Landing from './Landing';
import Sheet from './Sheet';
import Splash from './Splash';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }) {
  const user = await currentUserWithEmail();
  // Signed out, this is the front door rather than a bounce to /sign-in: most
  // people arriving here have never heard of the thing and need telling what
  // it is before being asked for an email.
  if (!user) return <Landing searchParams={searchParams} />;
  await ensureProfile(user.id, user.email);

  let rows = [];
  let loadError = null;
  try {
    rows = await storeFor(user.sb, user.id).listApplications();
  } catch (e) {
    loadError = e.message;
  }
  // The opening plays over the sheet and then fades, so the sheet is already
  // there underneath rather than arriving afterwards.
  return (
    <>
      <Splash />
      <Sheet initialRows={rows} role="edit" apiBase="/api" email={user.email} loadError={loadError} />
    </>
  );
}
