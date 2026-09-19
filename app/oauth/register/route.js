import { cors, registerClient } from '@/lib/oauth';

// RFC 7591 dynamic client registration: an MCP client introduces itself and
// gets a client_id. Public clients only (PKCE), so no secret is issued.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_client_metadata', error_description: 'Body must be JSON' },
      { status: 400, headers: cors });
  }
  try {
    const client = await registerClient(body);
    return Response.json({
      client_id: client.client_id,
      client_name: client.client_name,
      redirect_uris: client.redirect_uris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      client_id_issued_at: Math.floor(Date.now() / 1000),
    }, { status: 201, headers: { ...cors, 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: 'invalid_client_metadata', error_description: e.message },
      { status: 400, headers: cors });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
