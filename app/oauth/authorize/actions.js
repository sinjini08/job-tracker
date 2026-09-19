'use server';

import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { getClient, issueCode, validRedirectUri } from '@/lib/oauth';

// Handles the Connect / Cancel buttons on the consent screen.
export async function approve(formData) {
  const get = (k) => {
    const v = formData.get(k);
    return v == null ? undefined : String(v);
  };
  const [clientId, redirectUri, state] = [get('client_id'), get('redirect_uri'), get('state')];

  const client = await getClient(clientId);
  if (!client || !redirectUri || !client.redirect_uris.includes(redirectUri) || !validRedirectUri(redirectUri)) {
    throw new Error('This connection request is no longer valid.');
  }
  const send = (params) => {
    const url = new URL(redirectUri);
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
    if (state) url.searchParams.set('state', state);
    redirect(url.toString());
  };

  if (get('decision') !== 'allow') send({ error: 'access_denied', error_description: 'The student cancelled' });

  const user = await currentUser();
  if (!user) send({ error: 'access_denied', error_description: 'Signed out before approving' });

  const code = await issueCode({
    client,
    userId: user.id,
    redirectUri,
    codeChallenge: get('code_challenge'),
    scope: get('scope'),
    resource: get('resource'),
  });
  send({ code });
}
