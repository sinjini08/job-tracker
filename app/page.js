import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import { demoRows } from '@/lib/demo';
import Landing from './Landing';
import Sheet from './Sheet';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUserWithEmail();

  // The front door. A visitor gets the same sheet everyone else works in,
  // filled with sample rows and wired to nothing, rather than a redirect to a
  // sign-in form that explains none of it.
  if (!user) {
    return (
      <Landing hero>
        <Sheet initialRows={demoRows()} role="view" demo shared />
      </Landing>
    );
  }

  await ensureProfile(user.id, user.email);

  let rows = [];
  let loadError = null;
  try {
    rows = await storeFor(user.sb, user.id).listApplications();
  } catch (e) {
    loadError = e.message;
  }
  return (
    <Landing>
      <Sheet initialRows={rows} role="edit" apiBase="/api" email={user.email} loadError={loadError} />
    </Landing>
  );
}
