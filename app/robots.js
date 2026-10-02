// robots.txt. Everything may be crawled; the private routes carry their own
// noindex header (next.config.mjs), which a crawler can only see if it is
// allowed to fetch them. The API is the one exception: it is JSON for the
// app, never a page, and there is nothing in it for a crawler to read.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: '/api/' },
    sitemap: 'https://myjobtracker.co/sitemap.xml',
  };
}
