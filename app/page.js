import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import Sheet from './Sheet';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect('/login');

  let rows = [];
  let loadError = null;
  try {
    rows = await storeFor(user.sb, user.id).listApplications();
  } catch (e) {
    loadError = e.message;
  }
  return <Sheet initialRows={rows} role="edit" apiBase="/api" email={user.email} loadError={loadError} />;
}
