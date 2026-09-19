import { redirect } from 'next/navigation';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { getClient, validRedirectUri } from '@/lib/oauth';
import { approve } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connect an app · Job Application Tracker', robots: { index: false } };

// The consent screen. Claude sends the student here; after they approve, we
// hand Claude an authorization code.
export default async function Authorize({ searchParams }) {
  const q = await searchParams;
  const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope, resource } = q;

  const fail = (title, detail) => (
    <main className="login">
      <div className="login-card">
        <div className="login-mark" aria-hidden>▦</div>
        <h1>{title}</h1>
        <p>{detail}</p>
      </div>
    </main>
  );

  const client = await getClient(client_id);
  if (!client) return fail('Unknown app', 'This app isn’t registered with the tracker. Try adding the connector again.');
  if (!redirect_uri || !client.redirect_uris.includes(redirect_uri) || !validRedirectUri(redirect_uri)) {
    return fail('Bad redirect address', 'The app asked to be sent somewhere it isn’t registered for, so the request was stopped.');
  }

  // From here the redirect_uri is trusted, so errors can go back to the app.
  const back = (error, description) => {
    const url = new URL(redirect_uri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state) url.searchParams.set('state', state);
    redirect(url.toString());
  };
  if (response_type !== 'code') back('unsupported_response_type', 'Only response_type=code is supported');
  if (!code_challenge || (code_challenge_method ?? 'S256') !== 'S256') {
    back('invalid_request', 'PKCE with code_challenge_method=S256 is required');
  }

  // Not signed in? Sign in first, then come back here.
  const user = await currentUserWithEmail();
  if (!user) {
    const self = new URLSearchParams(Object.entries(q).filter(([, v]) => typeof v === 'string'));
    redirect(`/sign-in?redirect_url=${encodeURIComponent(`/oauth/authorize?${self}`)}`);
  }
  await ensureProfile(user.id, user.email);

  return (
    <main className="login">
      <div className="login-card consent">
        <div className="login-mark" aria-hidden>▦</div>
        <h1>Connect {client.client_name}</h1>
        <p><b>{client.client_name}</b> wants to connect to your Job Application Tracker.</p>
        <ul className="consent-list">
          <li>Read your applications and their history</li>
          <li>Add and update applications on your behalf</li>
          <li>Delete an application when you ask it to</li>
        </ul>
        <p className="consent-note">
          It can only reach <b>your</b> tracker, never another student’s, and never your account
          settings. You can disconnect it any time in Settings.
        </p>
        <form action={approve} className="consent-actions">
          {Object.entries({ client_id, redirect_uri, code_challenge, state, scope, resource }).map(
            ([k, v]) => (typeof v === 'string' ? <input key={k} type="hidden" name={k} value={v} /> : null),
          )}
          <button className="btn ghost-dark" name="decision" value="deny" type="submit">Cancel</button>
          <button className="btn primary" name="decision" value="allow" type="submit">Connect</button>
        </form>
        <p className="consent-signed">Signed in as {user.email}</p>
      </div>
    </main>
  );
}
