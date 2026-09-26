import { redirect } from 'next/navigation';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { listConnections } from '@/lib/oauth';
import { enabledSheets } from '@/lib/fields';
import SettingsPanel from './SettingsPanel';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Settings · Job Application Tracker' };

export default async function SettingsPage() {
  const user = await currentUserWithEmail();
  if (!user) redirect('/sign-in');
  await ensureProfile(user.id, user.email);

  const [{ data: profile }, connections] = await Promise.all([
    user.sb.from('profiles')
      .select('share_token, mcp_token_hash, ext_token_hash, sheets_enabled, sheet_names')
      .eq('id', user.id).maybeSingle(),
    listConnections(user.id),
  ]);
  return (
    <SettingsPanel
      email={user.email}
      // Handed over rather than fetched. The sheets card used to load itself
      // and render nothing until it had, so the page painted with Connect an
      // assistant at the top and then shoved it down half a second later.
      sheets={{ enabled: enabledSheets(profile?.sheets_enabled), names: profile?.sheet_names ?? {} }}
      shareToken={profile?.share_token ?? null}
      connectorOn={Boolean(profile?.mcp_token_hash)}
      extensionOn={Boolean(profile?.ext_token_hash)}
      connections={connections}
    />
  );
}
