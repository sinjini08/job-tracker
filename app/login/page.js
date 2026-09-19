import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  const { link, next } = await searchParams;
  const safe = typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return <LoginForm linkFailed={link === 'failed'} next={safe} />;
}
