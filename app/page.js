import { redirect } from 'next/navigation';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import Sheet from './Sheet';
import Splash from './Splash';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUserWithEmail();
  if (!user) redirect('/sign-in');
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
