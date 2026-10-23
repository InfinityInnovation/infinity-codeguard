'use client';

import {
  authenticatedUserSchema,
  createProjectSchema,
  organizationSummarySchema,
  projectSummarySchema,
} from '@codeguard/contracts';
import type { CreateProjectInput } from '@codeguard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiRequest, ApiClientError } from '../../lib/api';

const organizationsSchema = z.array(organizationSummarySchema);
const projectsSchema = z.array(projectSummarySchema);
const noContentSchema = z.undefined();

export function Dashboard({ locale }: { locale: string }) {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: () => apiRequest('/auth/session', authenticatedUserSchema),
    retry: false,
  });
  const organizations = useQuery({
    queryKey: ['organizations'],
    queryFn: () => apiRequest('/organizations', organizationsSchema),
    enabled: session.isSuccess,
  });
  const activeId = selectedId ?? organizations.data?.[0]?.id;
  const activeOrganization = organizations.data?.find(({ id }) => id === activeId);
  const projects = useQuery({
    queryKey: ['projects', activeId],
    queryFn: () => apiRequest(`/organizations/${activeId}/projects`, projectsSchema),
    enabled: Boolean(activeId),
  });

  useEffect(() => {
    if (session.error instanceof ApiClientError && session.error.status === 401) {
      router.replace(`/${locale}/login`);
    }
  }, [locale, router, session.error]);

  const logout = useMutation({
    mutationFn: () => apiRequest('/auth/logout', noContentSchema, { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear();
      router.replace(`/${locale}/login`);
    },
  });

  if (session.isPending || organizations.isPending) return <Status text={common('loading')} />;
  if (session.isError || organizations.isError) return <Status text={common('error')} />;

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <div className="brand">∞ Infinity CodeGuard</div>
          <span className="muted">{session.data.displayName}</span>
        </div>
        <div className="header-actions">
          <LinkLocale locale={locale} />
          <button className="secondary" onClick={() => logout.mutate()}>
            {common('logout')}
          </button>
        </div>
      </header>
      <section className="dashboard-intro">
        <p className="eyebrow">SECURITY GOVERNANCE</p>
        <h1>{t('title')}</h1>
        <p className="muted">{t('intro')}</p>
      </section>
      <div className="dashboard-grid">
        <aside className="panel">
          <h2>{t('organizations')}</h2>
          {organizations.data.length === 0 ? (
            <p className="muted">{t('emptyOrganizations')}</p>
          ) : (
            <div className="organization-list">
              {organizations.data.map((organization) => (
                <button
                  className={organization.id === activeId ? 'organization active' : 'organization'}
                  onClick={() => setSelectedId(organization.id)}
                  key={organization.id}
                >
                  <strong>{organization.name}</strong>
                  <span>
                    {t('role')}: {organization.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </aside>
        <section className="panel projects-panel">
          <div className="panel-heading">
            <h2>{t('projects')}</h2>
            {activeOrganization && <span className="tag">{activeOrganization.slug}</span>}
          </div>
          {projects.isPending && activeId ? (
            <p className="muted">{common('loading')}</p>
          ) : projects.isError ? (
            <p className="form-error">{common('error')}</p>
          ) : projects.data?.length ? (
            <div className="project-list">
              {projects.data.map((project) => (
                <article key={project.id}>
                  <span>{project.slug}</span>
                  <h3>{project.name}</h3>
                  <time>{new Intl.DateTimeFormat(locale).format(new Date(project.createdAt))}</time>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted">{t('emptyProjects')}</p>
          )}
          {activeOrganization && ['OWNER', 'ADMIN'].includes(activeOrganization.role) && (
            <ProjectForm organizationId={activeOrganization.id} />
          )}
        </section>
      </div>
      <p className="scanner-notice">{t('scansUnavailable')}</p>
    </main>
  );
}

function ProjectForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const form = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });
  const create = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest(`/organizations/${organizationId}/projects`, projectSummarySchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      form.reset();
      await queryClient.invalidateQueries({ queryKey: ['projects', organizationId] });
    },
  });
  return (
    <form className="project-form" onSubmit={form.handleSubmit((input) => create.mutate(input))}>
      <h3>{t('newProject')}</h3>
      <div className="inline-fields">
        <label className="field">
          <span>{t('projectName')}</span>
          <input {...form.register('name')} />
        </label>
        <label className="field">
          <span>{t('projectSlug')}</span>
          <input {...form.register('slug')} />
        </label>
        <button className="primary" disabled={create.isPending}>
          {t('create')}
        </button>
      </div>
      {create.error && <p className="form-error">{create.error.message}</p>}
    </form>
  );
}

function Status({ text }: { text: string }) {
  return (
    <main className="status">
      <div className="brand">∞ Infinity CodeGuard</div>
      <p>{text}</p>
    </main>
  );
}
function LinkLocale({ locale }: { locale: string }) {
  const next = locale === 'fr' ? 'en' : 'fr';
  return (
    <a className="nav-link" href={`/${next}/dashboard`}>
      {next.toUpperCase()}
    </a>
  );
}
