// Routes that must never appear in a search engine. A share link is
// somebody's applications; settings, the OAuth endpoints and the API are
// machinery. Kept out by header rather than by robots.txt: a crawler that is
// disallowed never fetches the page, so never sees a noindex, and can still
// list the bare URL if someone links to it.
const PRIVATE = ['/s/:path*', '/settings/:path*', '/settings', '/oauth/:path*', '/api/:path*'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      ...PRIVATE.map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
    ];
  },
};

export default nextConfig;
