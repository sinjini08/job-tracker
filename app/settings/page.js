import { redirect } from 'next/navigation';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { listConnections } from '@/lib/oauth';
import SettingsPanel from './SettingsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Job Application Tracker' };

export default async function SettingsPage() {
  const user = await currentUserWithEmail();
  if (!user) redirect('/sign-in');
  await ensureProfile(user.id, user.email);

  const [{ data: profile }, connections] = await Promise.all([
    user.sb.from('profiles').select('share_token, mcp_token_hash').eq('id', user.id).maybeSingle(),
    listConnections(user.id),
  ]);
  return (
    <SettingsPanel
      email={user.email}
      shareToken={profile?.share_token ?? null}
      connectorOn={Boolean(profile?.mcp_token_hash)}
      connections={connections}
    />
  );
}
