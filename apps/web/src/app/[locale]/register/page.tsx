import { AuthForm } from '../../../features/auth/auth-form';

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  return <AuthForm mode="register" locale={(await params).locale} />;
}
