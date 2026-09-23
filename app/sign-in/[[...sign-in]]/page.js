import { SignIn } from '@clerk/nextjs';
import Logo from '@/app/Logo';
import { appearance } from '@/lib/clerk-appearance';

export const metadata = { title: 'Sign in · Job Application Tracker' };

export default function SignInPage() {
  return (
    <main className="login">
      <div className="login-intro">
        <div className="login-mark"><Logo size={64} /></div>
        <h1>Job Application Tracker</h1>
        <p>Pick up where you left off.</p>
      </div>
      <SignIn appearance={appearance} signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </main>
  );
}
