'use client';

import type { FindingSummary } from '@codeguard/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { apiRequest, ApiClientError } from '../../lib/api';
import { Sidebar } from './components/sidebar';
import type { WorkspaceView } from './model/navigation';
import { noContentSchema } from './model/schemas';
import { useWorkspaceData } from './hooks/use-workspace-data';
import { AnalysesView } from './views/analyses-view';
import { DashboardAnalytics, DashboardSummary } from './views/dashboard-overview';
import { IntegrationsView } from './views/integrations-view';
import { QualityGatesView } from './views/quality-gates-view';
import { ReportsView } from './views/reports-view';
import { ProjectsView } from './views/projects-view';
import { ProjectWorkspace } from './views/project-workspace';
import { VulnerabilitiesView } from './views/vulnerabilities-view';

export function Dashboard({ locale }: { locale: string }) {
  const t = useTranslations('dashboard');
  const common = useTranslations('common');
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const [search, setSearch] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [selectedScanId, setSelectedScanId] = useState<string>();
  const [selectedFindingId, setSelectedFindingId] = useState<string>();
  const [severityFilter, setSeverityFilter] = useState<FindingSummary['severity']>();
  const [activeView, setActiveView] = useState<WorkspaceView>('dashboard');
  const {
    session,
    organizations,
    activeId,
    activeOrganization,
    githubIntegration,
    projects,
    activeProjectId,
    activeProject,
    repositories,
    scans,
    latestRepositoryScans,
    findingCount,
    selectedScan,
    findings,
    selectedFinding,
    findingSource,
  } = useWorkspaceData({
    organizationId: selectedId,
    projectId: selectedProjectId,
    scanId: selectedScanId,
    findingId: selectedFindingId,
    severity: severityFilter,
    activeView,
  });

  useEffect(() => {
    if (session.error instanceof ApiClientError && session.error.status === 401)
      router.replace(`/${locale}/login`);
  }, [locale, router, session.error]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'integrations') {
      setActiveView('integrations');
    }
  }, []);

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
    <main className="sq-shell cg-product-shell">
      <Sidebar activeView={activeView} organization={activeOrganization} onSelect={setActiveView} />
      <header className="sq-topbar">
        <label className="cg-global-search">
          <span>⌕</span>
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setActiveView('projects');
            }}
            placeholder={t('searchProjects')}
            aria-label={t('searchProjects')}
          />
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
      <section className="sq-page">
        <div className="cg-page-heading">
          <div>
            <h1>{t(`views.${activeView}.title`)}</h1>
            <p>{t(`views.${activeView}.subtitle`)}</p>
          </div>
          <span className="cg-context">
            {activeOrganization?.name} / {activeProject?.name ?? t('selectProjectShort')}
          </span>
        </div>
        {activeView === 'dashboard' && (
          <>
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
                <small>
                  {selectedScan ? t(`status.${selectedScan.status}`) : t('noAnalysisData')}
                </small>
              </div>
              <div>
                <i>△</i>
                <span>{t('vulnerabilities')}</span>
                <strong>{findingCount}</strong>
                <small>{t('noAnalysisData')}</small>
              </div>
            </div>
            <DashboardAnalytics
              currentScans={latestRepositoryScans}
              history={scans.data ?? []}
              locale={locale}
              onSeverity={(severity) => {
                setSeverityFilter(severity);
                setSelectedFindingId(undefined);
                setActiveView('vulnerabilities');
              }}
            />
            <DashboardSummary
              scans={latestRepositoryScans}
              locale={locale}
              onOpenAnalyses={() => setActiveView('analyses')}
            />
          </>
        )}
        {activeView === 'projects' && (
          <ProjectsView
            organizations={organizations.data}
            organizationId={activeId}
            activeOrganization={activeOrganization}
            activeProject={activeProject}
            activeProjectId={activeProjectId}
            projects={projects.data ?? []}
            projectsPending={projects.isPending}
            projectsError={projects.isError}
            repositories={repositories.data ?? []}
            repositoriesPending={repositories.isPending}
            scans={scans.data ?? []}
            search={search}
            locale={locale}
            onSearch={setSearch}
            onSelectOrganization={(id) => {
              setSelectedId(id);
              setSelectedProjectId(undefined);
              setSelectedScanId(undefined);
              setSelectedFindingId(undefined);
            }}
            onSelectProject={(id) => {
              setSelectedProjectId(id);
              setSelectedScanId(undefined);
              setActiveView('project');
            }}
          />
        )}
        {activeView === 'project' && activeProject && (
          <ProjectWorkspace
            key={activeProject.id}
            project={activeProject}
            repositories={repositories.data ?? []}
            scans={scans.data ?? []}
            latestScans={latestRepositoryScans}
            selectedScan={selectedScan}
            findings={findings.data ?? []}
            selectedFinding={selectedFinding}
            source={findingSource.data}
            sourceLoading={findingSource.isPending && findingSource.isFetching}
            sourceError={findingSource.error?.message}
            organizationId={activeId}
            locale={locale}
            onSelectScan={setSelectedScanId}
            onSelectFinding={setSelectedFindingId}
            canManage={Boolean(
              activeOrganization && ['OWNER', 'ADMIN'].includes(activeOrganization.role),
            )}
          />
        )}
        {activeView === 'analyses' && (
          <AnalysesView
            scans={scans.data ?? []}
            selectedScan={selectedScan}
            onSelect={setSelectedScanId}
            locale={locale}
            organizationId={activeId}
            projectId={activeProject?.id}
          />
        )}
        {activeView === 'vulnerabilities' && (
          <VulnerabilitiesView
            organizationId={activeId}
            projectId={activeProjectId}
            findings={findings.data ?? []}
            selectedScan={selectedScan}
            selectedFinding={selectedFinding}
            source={findingSource.data}
            sourceLoading={findingSource.isPending && findingSource.isFetching}
            sourceError={findingSource.error?.message}
            onSelect={setSelectedFindingId}
            severityFilter={severityFilter}
            onSeverityFilter={setSeverityFilter}
            loading={findings.isPending && findings.isFetching}
          />
        )}
        {activeView === 'quality' && <QualityGatesView scans={latestRepositoryScans} />}
        {activeView === 'reports' && (
          <ReportsView
            organizationId={activeId}
            projectId={activeProjectId}
            scans={scans.data ?? []}
            selectedScan={selectedScan}
            findings={findings.data ?? []}
            onSelect={setSelectedScanId}
            locale={locale}
          />
        )}
        {activeView === 'integrations' && activeId && (
          <IntegrationsView
            organizationId={activeId}
            integration={githubIntegration.data}
            loading={githubIntegration.isPending}
          />
        )}
      </section>
    </main>
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
