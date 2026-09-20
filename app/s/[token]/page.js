import { shareStore } from '@/lib/auth';
import Logo from '../../Logo';
import Sheet from '../../Sheet';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Shared job tracker (read-only)', robots: { index: false, follow: false } };

export default async function SharedTracker({ params }) {
  const { token } = await params;
  const store = await shareStore(token);
  if (!store) {
    return (
      <main className="login">
        <div className="login-card">
          <div className="login-mark"><Logo size={52} badge /></div>
          <h1>This link isn’t active</h1>
          <p>The owner turned off sharing or made a new link. Ask them for the current one.</p>
        </div>
      </main>
    );
  }
  const rows = await store.listApplications();
  return <Sheet initialRows={rows} role="view" apiBase={`/api/share/${token}`} shared />;
}
