'use client';

import {
  authenticatedUserSchema,
  createRepositorySchema,
  createProjectSchema,
  organizationSummarySchema,
  projectSummarySchema,
  repositorySummarySchema,
  scanSummarySchema,
} from '@codeguard/contracts';
import type { CreateProjectInput, CreateRepositoryInput } from '@codeguard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiRequest, ApiClientError } from '../../lib/api';

const organizationsSchema = z.array(organizationSummarySchema);
const projectsSchema = z.array(projectSummarySchema);
const repositoriesSchema = z.array(repositorySummarySchema);
const scansSchema = z.array(scanSummarySchema);
const noContentSchema = z.undefined();

export function Dashboard({ locale }: { locale: string }) {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
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
  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? projects.data?.filter((project) =>
          `${project.name} ${project.slug}`.toLowerCase().includes(term),
        )
      : projects.data;
  }, [projects.data, search]);
  const activeProjectId = projects.data?.some(({ id }) => id === selectedProjectId)
    ? selectedProjectId
    : projects.data?.[0]?.id;
  const activeProject = projects.data?.find(({ id }) => id === activeProjectId);
  const repositories = useQuery({
    queryKey: ['repositories', activeId, activeProjectId],
    queryFn: () =>
      apiRequest(
        `/organizations/${activeId}/projects/${activeProjectId}/repositories`,
        repositoriesSchema,
      ),
    enabled: Boolean(activeId && activeProjectId),
  });
  const scans = useQuery({
    queryKey: ['scans', activeId, activeProjectId],
    queryFn: () =>
      apiRequest(`/organizations/${activeId}/projects/${activeProjectId}/scans`, scansSchema),
    enabled: Boolean(activeId && activeProjectId),
    refetchInterval: (query) =>
      query.state.data?.some((scan) => ['QUEUED', 'RUNNING'].includes(scan.status)) ? 2000 : false,
  });
  const findingCount = scans.data?.reduce((total, scan) => total + scan.findingCount, 0) ?? 0;

  useEffect(() => {
    if (session.error instanceof ApiClientError && session.error.status === 401)
      router.replace(`/${locale}/login`);
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
    <main className="sq-shell">
      <aside className="cg-sidebar">
        <div className="cg-brand">
          <span>∞</span>
          <div>
            <strong>Infinity CodeGuard</strong>
            <small>Open Source DevSecOps</small>
          </div>
        </div>
        <nav>
          <a className="active" href="#overview">
            ⌂ {t('dashboard')}
          </a>
          <a href="#projects">▣ {t('projects')}</a>
          <a href="#repositories">⌘ {t('repositories')}</a>
          <span>◫ {t('analyses')}</span>
          <span>◇ {t('vulnerabilities')}</span>
          <span>✓ {t('compliance')}</span>
          <span>▤ {t('reports')}</span>
        </nav>
        <div className="cg-sidebar-note">
          <strong>{t('enginePending')}</strong>
          <small>{t('scansUnavailable')}</small>
        </div>
      </aside>
      <header className="sq-topbar">
        <label className="cg-global-search">
          <span>⌕</span>
          <input type="search" placeholder={t('searchProjects')} aria-label={t('searchProjects')} />
        </label>
        <div className="sq-user">
          <LinkLocale locale={locale} />
          <span className="avatar">{session.data.displayName.slice(0, 1).toUpperCase()}</span>
          <div className="cg-user-copy">
            <strong>{session.data.displayName}</strong>
            <small>{activeOrganization?.role ?? ''}</small>
          </div>
          <button
            className="cg-logout"
            onClick={() => logout.mutate()}
            aria-label={common('logout')}
          >
            ↗
          </button>
        </div>
      </header>
      <section className="sq-page" id="overview">
        <div className="cg-page-heading">
          <div>
            <h1>{t('dashboard')}</h1>
            <p>{t('dashboardSubtitle')}</p>
          </div>
          <span className="cg-period">▣ {t('currentOverview')}</span>
        </div>
        <div className="cg-overview">
          <div>
            <i>▱</i>
            <span>{t('projects')}</span>
            <strong>{projects.data?.length ?? 0}</strong>
            <small>{t('projectCount', { count: projects.data?.length ?? 0 })}</small>
          </div>
          <div>
            <i>⌘</i>
            <span>{t('repositories')}</span>
            <strong>{repositories.data?.length ?? 0}</strong>
            <small>{activeProject?.name ?? t('selectProject')}</small>
          </div>
          <div>
            <i>◈</i>
            <span>{t('analyses')}</span>
            <strong>{scans.data?.length ?? 0}</strong>
            <small>{t('enginePending')}</small>
          </div>
          <div>
            <i>△</i>
            <span>{t('vulnerabilities')}</span>
            <strong>{findingCount}</strong>
            <small>{t('noAnalysisData')}</small>
          </div>
        </div>
        <div className="cg-dashboard-grid">
          <section className="cg-panel" id="projects">
            <div className="sq-page-title">
              <div>
                <h1>{t('projects')}</h1>
                <p>{t('projectCount', { count: projects.data?.length ?? 0 })}</p>
              </div>
              {activeOrganization && ['OWNER', 'ADMIN'].includes(activeOrganization.role) && (
                <ProjectForm organizationId={activeOrganization.id} />
              )}
            </div>
            <div className="sq-toolbar">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchProjects')}
                aria-label={t('searchProjects')}
              />
              <select
                value={activeId}
                onChange={(event) => setSelectedId(event.target.value)}
                aria-label={t('organizations')}
              >
                {organizations.data.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name} · {organization.role}
                  </option>
                ))}
              </select>
            </div>
            <div className="sq-layout">
              <section className="sq-projects" aria-live="polite">
                <div className="sq-list-head">
                  <span>{t('name')}</span>
                  <span>{t('created')}</span>
                  <span>{t('qualityGate')}</span>
                </div>
                {projects.isPending && activeId ? (
                  <p className="sq-empty">{common('loading')}</p>
                ) : projects.isError ? (
                  <p className="sq-empty error-text">{common('error')}</p>
                ) : filteredProjects?.length ? (
                  filteredProjects.map((project) => (
                    <article
                      className={
                        project.id === activeProjectId
                          ? 'sq-project-row selected-row'
                          : 'sq-project-row'
                      }
                      key={project.id}
                      onClick={() => setSelectedProjectId(project.id)}
                    >
                      <div className="project-identity">
                        <span className="project-icon">
                          {project.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div>
                          <h3>{project.name}</h3>
                          <code>{project.slug}</code>
                        </div>
                      </div>
                      <time>
                        {new Intl.DateTimeFormat(locale).format(new Date(project.createdAt))}
                      </time>
                      <span className="quality-state">
                        <i className="status-dot neutral" />
                        {t('notAnalyzed')}
                      </span>
                    </article>
                  ))
                ) : (
                  <div className="sq-empty">
                    <div className="empty-icon">⌕</div>
                    <h3>{search ? t('noSearchResults') : t('emptyProjects')}</h3>
                    <p>{t('emptyHelp')}</p>
                  </div>
                )}
              </section>
            </div>
          </section>
          <section className="cg-repositories cg-panel" id="repositories">
            <div className="cg-section-head">
              <div>
                <h2>{t('repositories')}</h2>
                <p>
                  {activeProject
                    ? t('repositoriesFor', { project: activeProject.name })
                    : t('selectProject')}
                </p>
              </div>
              {activeId &&
                activeProjectId &&
                activeOrganization &&
                ['OWNER', 'ADMIN'].includes(activeOrganization.role) && (
                  <RepositoryForm organizationId={activeId} projectId={activeProjectId} />
                )}
            </div>
            {!activeProjectId ? (
              <div className="cg-empty">{t('selectProject')}</div>
            ) : repositories.isPending ? (
              <div className="cg-empty">{common('loading')}</div>
            ) : repositories.data?.length ? (
              <div className="cg-repo-grid">
                {repositories.data.map((repository) => (
                <article key={repository.id}>
                    <span>{repository.provider.replace('_', ' ')}</span>
                    <h3>{repository.name}</h3>
                    <code>{repository.remoteUrl}</code>
                    <small>
                      {t('defaultBranch')}: {repository.defaultBranch}
                    </small>
                  {activeId && activeProjectId && (
                    <ScanButton
                      organizationId={activeId}
                      projectId={activeProjectId}
                      repositoryId={repository.id}
                    />
                  )}
                  </article>
                ))}
              </div>
            ) : (
              <div className="cg-empty">
                <strong>{t('emptyRepositories')}</strong>
                <span>{t('emptyRepositoriesHelp')}</span>
              </div>
            )}
          </section>
        </div>
        <div className="sq-notice">
          <strong>{t('analysisStatus')}</strong>
          <span>{t('scannerReady')}</span>
        </div>
      </section>
    </main>
  );
}

function ScanButton({
  organizationId,
  projectId,
  repositoryId,
}: {
  organizationId: string;
  projectId: string;
  repositoryId: string;
}) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const scan = useMutation({
    mutationFn: () =>
      apiRequest(
        `/organizations/${organizationId}/projects/${projectId}/scans`,
        scanSummarySchema,
        { method: 'POST', body: JSON.stringify({ repositoryId }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['scans', organizationId, projectId] }),
  });
  return (
    <div className="cg-scan-action">
      <button className="sq-primary" disabled={scan.isPending} onClick={() => scan.mutate()}>
        {scan.isPending ? t('scanQueued') : t('startScan')}
      </button>
      {scan.error && <small className="error-text">{scan.error.message}</small>}
    </div>
  );
}

function RepositoryForm({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId: string;
}) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<CreateRepositoryInput>({
    resolver: zodResolver(createRepositorySchema),
    defaultValues: { provider: 'GITHUB', defaultBranch: 'main' },
  });
  const create = useMutation({
    mutationFn: (input: CreateRepositoryInput) =>
      apiRequest(
        `/organizations/${organizationId}/projects/${projectId}/repositories`,
        repositorySummarySchema,
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: async () => {
      form.reset({ provider: 'GITHUB', defaultBranch: 'main' });
      setOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ['repositories', organizationId, projectId],
      });
    },
  });
  if (!open)
    return (
      <button className="sq-primary" onClick={() => setOpen(true)}>
        + {t('addRepository')}
      </button>
    );
  return (
    <form
      className="cg-repo-form"
      onSubmit={(event) => void form.handleSubmit((input) => create.mutate(input))(event)}
    >
      <input placeholder={t('repositoryName')} {...form.register('name')} />
      <input
        type="url"
        placeholder="https://github.com/org/repository"
        {...form.register('remoteUrl')}
      />
      <div>
        <select {...form.register('provider')}>
          <option value="GITHUB">GitHub</option>
          <option value="GITLAB">GitLab</option>
          <option value="BITBUCKET">Bitbucket</option>
          <option value="AZURE_DEVOPS">Azure DevOps</option>
          <option value="OTHER">{t('other')}</option>
        </select>
        <input placeholder={t('defaultBranch')} {...form.register('defaultBranch')} />
      </div>
      {Object.values(form.formState.errors)[0]?.message && (
        <span className="error-text">{Object.values(form.formState.errors)[0]?.message}</span>
      )}
      {create.error && <span className="error-text">{create.error.message}</span>}
      <footer>
        <button type="button" onClick={() => setOpen(false)}>
          {t('cancel')}
        </button>
        <button className="sq-primary" disabled={create.isPending}>
          {t('add')}
        </button>
      </footer>
    </form>
  );
}

function ProjectForm({ organizationId }: { organizationId: string }) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const form = useForm<CreateProjectInput>({ resolver: zodResolver(createProjectSchema) });
  const create = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiRequest(`/organizations/${organizationId}/projects`, projectSummarySchema, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async () => {
      form.reset();
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['projects', organizationId] });
    },
  });
  if (!open)
    return (
      <button className="sq-primary" onClick={() => setOpen(true)}>
        + {t('createProject')}
      </button>
    );
  return (
    <form
      className="sq-create"
      onSubmit={(event) => void form.handleSubmit((input) => create.mutate(input))(event)}
    >
      <label>
        <span>{t('projectName')}</span>
        <input autoFocus {...form.register('name')} placeholder={t('projectNamePlaceholder')} />
      </label>
      <small>{t('identifierGenerated')}</small>
      {form.formState.errors.name && (
        <span className="error-text">{form.formState.errors.name.message}</span>
      )}
      {create.error && <span className="error-text">{create.error.message}</span>}
      <div>
        <button type="button" onClick={() => setOpen(false)}>
          {t('cancel')}
        </button>
        <button className="sq-primary" disabled={create.isPending}>
          {t('create')}
        </button>
      </div>
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
  return <a href={`/${next}/dashboard`}>{next.toUpperCase()}</a>;
}
