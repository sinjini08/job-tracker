import { cors, revokeToken } from '@/lib/oauth';

// RFC 7009: a client disconnecting itself.
export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const token = form?.get('token');
  if (token) await revokeToken(String(token));
  return new Response(null, { status: 200, headers: cors }); // always 200, per spec
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
