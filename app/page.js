import { redirect } from 'next/navigation';
import { currentRole } from '@/lib/auth';
import { db } from '@/lib/db';
import Sheet from './Sheet';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const role = await currentRole();
  if (!role) redirect('/login');

  let rows = [];
  let loadError = null;
  try {
    rows = await db().listApplications();
  } catch (e) {
    loadError = e.message;
  }
  return <Sheet initialRows={rows} role={role} loadError={loadError} />;
}
