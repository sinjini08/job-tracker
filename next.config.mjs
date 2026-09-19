/** @type {import('next').NextConfig} */
const nextConfig = {
  // Demo mode builds into its own folder so it can run alongside the real dev server.
  distDir: process.env.DEMO_MODE === '1' ? '.next-demo' : '.next',
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'no-referrer' },
      ],
    }];
  },
};

export default nextConfig;
