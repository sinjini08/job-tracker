import { createMcpHandler, getPublicOrigin, withMcpAuth } from 'mcp-handler';
import { storeFor } from '@/lib/db';
import { INSTRUCTIONS, registerTools } from '@/lib/mcp-tools';
import { SCOPE, verifyAccessToken } from '@/lib/oauth';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// The student's Claude connects here after the OAuth sign-in. The bearer token
// says which student, and every tool runs against a store scoped to them.
async function handle(request) {
  const origin = getPublicOrigin(request);
  const inner = async (req) => {
    const auth = req.auth; // set by withMcpAuth
    const store = storeFor(supabaseAdmin(), auth.extra.userId);
    const handler = createMcpHandler(
      (server) => registerTools(server, store, origin),
      { serverInfo: { name: 'job-tracker', version: '2.0.0' }, instructions: INSTRUCTIONS },
    );
    return handler(req);
  };

  const guarded = withMcpAuth(
    inner,
    async (_req, bearer) => {
      const info = await verifyAccessToken(bearer);
      if (!info) return undefined;
      return {
        token: bearer,
        clientId: info.clientId,
        scopes: info.scopes,
        expiresAt: info.expiresAt,
        extra: { userId: info.userId },
      };
    },
    { required: true, requiredScopes: [SCOPE], resourceMetadataPath: '/.well-known/oauth-protected-resource/api/mcp' },
  );
  return guarded(request);
}

export { handle as GET, handle as POST, handle as DELETE };
