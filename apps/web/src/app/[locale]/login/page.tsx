import { AuthForm } from '../../../features/auth/auth-form';

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AuthForm mode="login" locale={(await params).locale} />;
}
