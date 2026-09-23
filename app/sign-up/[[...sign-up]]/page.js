import { SignUp } from '@clerk/nextjs';
import Logo from '@/app/Logo';
import { appearance } from '@/lib/clerk-appearance';

export const metadata = { title: 'Create an account · Job Application Tracker' };

export default function SignUpPage() {
  return (
    <main className="login">
      <div className="login-intro">
        <div className="login-mark"><Logo size={64} /></div>
        <h1>Job Application Tracker</h1>
        <p>Your applications, organized. Your progress, visible. Your job hunt,
          more fun.</p>
      </div>
      <SignUp appearance={appearance} signInUrl="/sign-in" fallbackRedirectUrl="/" />
    </main>
  );
}
