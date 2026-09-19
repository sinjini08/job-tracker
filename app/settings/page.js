import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import SettingsPanel from './SettingsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Job Application Tracker' };

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login');
  const { data: profile } = await user.sb.from('profiles')
    .select('share_token, mcp_token_hash').eq('id', user.id).maybeSingle();
  return (
    <SettingsPanel
      email={user.email}
      shareToken={profile?.share_token ?? null}
      connectorOn={Boolean(profile?.mcp_token_hash)}
    />
  );
}
