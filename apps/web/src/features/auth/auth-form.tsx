'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema, sessionViewSchema } from '@codeguard/contracts';
import type { LoginInput, RegisterInput } from '@codeguard/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { apiRequest } from '../../lib/api';

export function AuthForm({ mode, locale }: { mode: 'login' | 'register'; locale: string }) {
  return mode === 'login' ? <LoginForm locale={locale} /> : <RegisterForm locale={locale} />;
}

function LoginForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });
  const submit = form.handleSubmit(async (input) => {
    try {
      await apiRequest('/auth/login', sessionViewSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : t('invalid') });
    }
  });

  return (
    <AuthShell title={t('loginTitle')} intro={t('loginIntro')}>
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t('email')} error={form.formState.errors.email?.message}>
          <input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field label={t('password')} error={form.formState.errors.password?.message}>
          <input type="password" autoComplete="current-password" {...form.register('password')} />
        </Field>
        <FormError message={form.formState.errors.root?.message} />
        <button className="primary" disabled={form.formState.isSubmitting} type="submit">
          {t('login')}
        </button>
      </form>
      <p className="form-switch">
        {t('needAccount')} <Link href={`/${locale}/register`}>{t('register')}</Link>
      </p>
    </AuthShell>
  );
}

function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const form = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const submit = form.handleSubmit(async (input) => {
    try {
      await apiRequest('/auth/register', sessionViewSchema, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      router.replace(`/${locale}/dashboard`);
      router.refresh();
    } catch (error) {
      form.setError('root', { message: error instanceof Error ? error.message : t('invalid') });
    }
  });

  return (
    <AuthShell title={t('registerTitle')} intro={t('registerIntro')}>
      <form onSubmit={submit} className="form-stack" noValidate>
        <Field label={t('displayName')} error={form.formState.errors.displayName?.message}>
          <input autoComplete="name" {...form.register('displayName')} />
        </Field>
        <Field label={t('email')} error={form.formState.errors.email?.message}>
          <input type="email" autoComplete="email" {...form.register('email')} />
        </Field>
        <Field
          label={t('password')}
          hint={t('passwordHelp')}
          error={form.formState.errors.password?.message}
        >
          <input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field
          label={t('organizationName')}
          error={form.formState.errors.organizationName?.message}
        >
          <input autoComplete="organization" {...form.register('organizationName')} />
        </Field>
        <Field
          label={t('organizationSlug')}
          error={form.formState.errors.organizationSlug?.message}
        >
          <input autoCapitalize="none" {...form.register('organizationSlug')} />
        </Field>
        <FormError message={form.formState.errors.root?.message} />
        <button className="primary" disabled={form.formState.isSubmitting} type="submit">
          {t('register')}
        </button>
      </form>
      <p className="form-switch">
        {t('haveAccount')} <Link href={`/${locale}/login`}>{t('login')}</Link>
      </p>
    </AuthShell>
  );
}

function AuthShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">∞ Infinity CodeGuard</div>
        <h1>{title}</h1>
        <p className="muted">{intro}</p>
        {children}
      </section>
    </main>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </label>
  );
}

function FormError({ message }: { message?: string }) {
  return message ? (
    <p className="form-error" role="alert">
      {message}
    </p>
  ) : null;
}
