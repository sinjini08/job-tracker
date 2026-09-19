import { cors } from '@/lib/oauth';
import { getPublicOrigin } from 'mcp-handler';

// RFC 8414: tells MCP clients how to sign a student in and get a token.
export function GET(request) {
  const issuer = getPublicOrigin(request);
  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    registration_endpoint: `${issuer}/oauth/register`,
    revocation_endpoint: `${issuer}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['tracker'],
    client_id_metadata_document_supported: true,
    service_documentation: `${issuer}/`,
  }, { headers: { ...cors, 'Cache-Control': 'public, max-age=600' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
