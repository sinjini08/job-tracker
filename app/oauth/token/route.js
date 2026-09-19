import { OAuthError, cors, redeemCode, refreshTokens } from '@/lib/oauth';

// Exchanges an authorization code (or a refresh token) for access tokens.
export async function POST(request) {
  let form;
  try {
    const type = request.headers.get('content-type') || '';
    form = type.includes('application/json')
      ? new Map(Object.entries(await request.json()))
      : await request.formData();
  } catch {
    return new OAuthError('invalid_request', 'Could not read the request body').toResponse();
  }
  const get = (k) => {
    const v = form.get(k);
    return v == null ? undefined : String(v);
  };

  try {
    const grant = get('grant_type');
    const tokens = grant === 'authorization_code'
      ? await redeemCode({
          code: get('code'),
          clientId: get('client_id'),
          redirectUri: get('redirect_uri'),
          codeVerifier: get('code_verifier'),
        })
      : grant === 'refresh_token'
        ? await refreshTokens({ refreshToken: get('refresh_token'), clientId: get('client_id') })
        : null;
    if (!tokens) throw new OAuthError('unsupported_grant_type', `Unsupported grant_type: ${grant}`);
    return Response.json(tokens, { headers: { ...cors, 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof OAuthError) return e.toResponse();
    return new OAuthError('server_error', e.message, 500).toResponse();
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
