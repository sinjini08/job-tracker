import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata = {
  title: 'Job Application Tracker',
  robots: { index: false, follow: false },
};

// Runs before the first paint, which is the only moment it can be useful.
// Without it a reader who has chosen dark gets one white frame on every single
// page load, and that flash is more noticeable than the feature is welcome.
//
// It writes nothing when no choice has been stored, so the CSS media query
// keeps control and the system setting keeps working. Wrapped in try/catch
// because reading localStorage throws outright in some private windows, and a
// blank page would be a poor trade for a theme.
const noFlash = `try{var t=localStorage.getItem('jt_theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      {/* The script sets an attribute on this element before React sees it,
          so the server's markup and the browser's disagree by design. */}
      <html lang="en" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: noFlash }} />
          {/* So form controls, scrollbars and the like are drawn to match. */}
          <meta name="color-scheme" content="light dark" />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
