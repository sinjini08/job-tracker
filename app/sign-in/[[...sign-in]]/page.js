import { SignIn } from '@clerk/nextjs';
import Logo from '@/app/Logo';
import { appearance } from '@/lib/clerk-appearance';

export const metadata = { title: 'Sign in · Job Application Tracker' };

export default function SignInPage() {
  return (
    <main className="login">
      <div className="login-intro">
        <div className="login-mark"><Logo size={52} /></div>
        <h1>Job Application Tracker</h1>
        <p>Track on-campus and off-campus applications in one spreadsheet, with charts,
          and let Claude fill it in from job postings.</p>
      </div>
      <SignIn appearance={appearance} signUpUrl="/sign-up" fallbackRedirectUrl="/" />
    </main>
  );
}
