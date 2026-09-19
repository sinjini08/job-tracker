import { createMcpHandler } from 'mcp-handler';
import { userIdForConnector } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import { registerTools } from '@/lib/mcp-tools';
import { supabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Each student's personal Claude connector: /api/mcp/<token>. The token picks
// the student; every tool runs against a store scoped to them.
async function handle(request, { params }) {
  const { token } = await params;
  const userId = await userIdForConnector(token);
  if (!userId) {
    return Response.json(
      { error: 'This connector link is not active. Make a new one in the tracker\'s Settings.' },
      { status: 401 },
    );
  }
  const store = storeFor(supabaseAdmin(), userId);
  const handler = createMcpHandler(
    (server) => registerTools(server, store, new URL(request.url).origin),
    { serverInfo: { name: 'job-tracker', version: '2.0.0' } },
  );
  return handler(request);
}

export { handle as GET, handle as POST, handle as DELETE };
