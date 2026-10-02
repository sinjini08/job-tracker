// sitemap.xml: the three public pages. Everything else is behind a sign-in
// or private, so there is nothing more to list.
export default function sitemap() {
  const base = 'https://myjobtracker.co';
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
