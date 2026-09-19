import LoginForm from './LoginForm';

export default async function LoginPage({ searchParams }) {
  const { link } = await searchParams;
  return <LoginForm linkFailed={link === 'failed'} />;
}
