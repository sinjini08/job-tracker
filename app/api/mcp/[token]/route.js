import { createMcpHandler } from 'mcp-handler';
import { userIdForConnector } from '@/lib/auth';
import { storeFor } from '@/lib/db';
import { INSTRUCTIONS, registerTools } from '@/lib/mcp-tools';
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
  // Read once per connection: the tools name the student's own sheets, so the
  // schema has to know them before it is built.
  const sheets = await store.sheets().catch(() => null);
  const handler = createMcpHandler(
    (server) => registerTools(server, store, new URL(request.url).origin, sheets),
    { serverInfo: { name: 'job-tracker', version: '2.0.0' }, instructions: INSTRUCTIONS },
  );
  return handler(request);
}

export { handle as GET, handle as POST, handle as DELETE };
