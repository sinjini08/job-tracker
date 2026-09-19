import { getPublicOrigin, protectedResourceHandler } from 'mcp-handler';
import { cors } from '@/lib/oauth';

// RFC 9728: points clients at the authorization server for this resource.
export function GET(request) {
  const origin = getPublicOrigin(request);
  const res = protectedResourceHandler({ authServerUrls: [origin], resourceUrl: `${origin}/api/mcp` })(request);
  Object.entries(cors).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
