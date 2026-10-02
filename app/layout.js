import { ClerkProvider } from '@clerk/nextjs';
import { cookies } from 'next/headers';
import { THEME_KEY } from '@/lib/theme';
import './globals.css';

// Indexable since sign-up opened: the landing page, privacy and terms are
// public. The private routes are kept out by an X-Robots-Tag header in
// next.config.mjs. The description is what a search result shows under the
// title.
export const metadata = {
  metadataBase: new URL('https://myjobtracker.co'),
  title: 'Job Application Tracker',
  description: 'Track every job application in one place. Save jobs in one click, let ChatGPT or Claude file them as you go, see what is working, and climb a league with friends.',
};

// For anyone whose choice predates the cookie. It only acts when the server
// wrote no attribute, applies what it finds in storage, and then writes the
// cookie so that every load after this one is decided on the server and this
// script has nothing left to do.
//
// It writes nothing when no choice has been stored, so the CSS media query
// keeps control and the system setting keeps working. Wrapped in try/catch
// because reading localStorage throws outright in some private windows, and a
// blank page would be a poor trade for a theme.
const migrate = `try{var r=document.documentElement;if(!r.hasAttribute('data-theme')){var t=localStorage.getItem('jt_theme');if(t==='dark'||t==='light'){r.setAttribute('data-theme',t);document.cookie='jt_theme='+t+';path=/;max-age=31536000;samesite=lax'}}}catch(e){}`;

export default async function RootLayout({ children }) {
  // Read on the server, so the attribute is in the HTML the browser receives
  // rather than applied by a script once it arrives. Nothing to run before
  // the first paint, nothing to fail quietly, and no route can disagree with
  // another about which theme was chosen.
  const chosen = (await cookies()).get(THEME_KEY)?.value;
  const theme = chosen === 'dark' || chosen === 'light' ? chosen : undefined;

  return (
    <ClerkProvider>
      {/* The migration script can still set this attribute before React sees
          it, so the server's markup and the browser's may disagree by design. */}
      <html lang="en" data-theme={theme} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: migrate }} />
          {/* So form controls, scrollbars and the like are drawn to match. */}
          <meta name="color-scheme" content="light dark" />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
