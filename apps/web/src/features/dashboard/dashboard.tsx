'use client';

import {
  authenticatedUserSchema,
  createRepositorySchema,
  createProjectSchema,
  findingSourceSchema,
  findingSummarySchema,
  organizationSummarySchema,
  projectSummarySchema,
  repositorySummarySchema,
  scanSummarySchema,
  updateFindingStatusSchema,
} from '@codeguard/contracts';
import type {
  CreateProjectInput,
  CreateRepositoryInput,
  FindingSummary,
  ScanSummary,
} from '@codeguard/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { apiRequest, ApiClientError } from '../../lib/api';

const organizationsSchema = z.array(organizationSummarySchema);
const projectsSchema = z.array(projectSummarySchema);
const repositoriesSchema = z.array(repositorySummarySchema);
const scansSchema = z.array(scanSummarySchema);
const findingsSchema = z.array(findingSummarySchema);
const noContentSchema = z.undefined();
type WorkspaceView = 'dashboard' | 'projects' | 'analyses' | 'vulnerabilities' | 'quality' | 'reports';

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
  const latestRepositoryScans =
    scans.data?.filter(
      (scan, index, history) =>
        history.findIndex((candidate) => candidate.repositoryId === scan.repositoryId) === index,
    ) ?? [];
  const findingCount = latestRepositoryScans.reduce(
    (total, scan) => total + scan.findingCount,
    0,
  );
  const selectedScan = scans.data?.find(({ id }) => id === selectedScanId) ?? scans.data?.[0];
  const findings = useQuery({
    queryKey: ['findings', activeId, activeProjectId, selectedScan?.id],
    queryFn: () =>
      apiRequest(
        `/organizations/${activeId}/projects/${activeProjectId}/scans/${selectedScan?.id}/findings`,
        findingsSchema,
      ),
    enabled: Boolean(activeId && activeProjectId && selectedScan?.id && selectedScan.status === 'SUCCEEDED'),
  });
  const findingsForSelection = severityFilter
    ? findings.data?.filter((finding) => finding.severity === severityFilter)
    : findings.data;
  const selectedFinding =
    findingsForSelection?.find(({ id }) => id === selectedFindingId) ?? findingsForSelection?.[0];
  const findingSource = useQuery({
    queryKey: ['finding-source', activeId, activeProjectId, selectedScan?.id, selectedFinding?.id],
    queryFn: () =>
      apiRequest(
        `/organizations/${activeId}/projects/${activeProjectId}/scans/${selectedScan?.id}/findings/${selectedFinding?.id}/source`,
        findingSourceSchema,
      ),
    enabled: Boolean(
      activeView === 'vulnerabilities' &&
      activeId &&
      activeProjectId &&
      selectedScan?.id &&
      selectedFinding?.id,
    ),
  });

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
    <main className="sq-shell cg-product-shell">
      <aside className="cg-sidebar">
        <div className="cg-brand">
          <span>∞</span>
          <div>
            <strong>Infinity CodeGuard</strong>
            <small>Open Source DevSecOps</small>
          </div>
        </div>
        <nav aria-label={t('mainNavigation')}>
          <small className="cg-nav-heading">{t('workspace')}</small>
          <SidebarButton icon="dashboard" label={t('dashboard')} view="dashboard" activeView={activeView} onSelect={setActiveView} />
          <SidebarButton icon="projects" label={t('projects')} view="projects" activeView={activeView} onSelect={setActiveView} />
          <small className="cg-nav-heading security">{t('security')}</small>
          <SidebarButton icon="analyses" label={t('analyses')} view="analyses" activeView={activeView} onSelect={setActiveView} />
          <SidebarButton icon="vulnerabilities" label={t('vulnerabilities')} view="vulnerabilities" activeView={activeView} onSelect={setActiveView} />
          <SidebarButton icon="quality" label={t('qualityGates')} view="quality" activeView={activeView} onSelect={setActiveView} />
          <SidebarButton icon="reports" label={t('reports')} view="reports" activeView={activeView} onSelect={setActiveView} />
        </nav>
        <div className="cg-sidebar-footer">
          <span>{activeOrganization?.name.slice(0, 2).toUpperCase()}</span>
          <div><strong>{activeOrganization?.name}</strong><small>{activeOrganization?.role}</small></div>
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
      <section className="sq-page">
        <div className="cg-page-heading">
          <div>
            <h1>{t(`views.${activeView}.title`)}</h1>
            <p>{t(`views.${activeView}.subtitle`)}</p>
          </div>
          <span className="cg-context">{activeOrganization?.name} / {activeProject?.name ?? t('selectProjectShort')}</span>
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
            <small>{selectedScan ? t(`status.${selectedScan.status}`) : t('noAnalysisData')}</small>
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
        <DashboardSummary scans={latestRepositoryScans} locale={locale} onOpenAnalyses={() => setActiveView('analyses')} />
          </>
        )}
        {activeView === 'projects' && (
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
                        {latestScanForProject(project.id, scans.data)
                          ? t(`status.${latestScanForProject(project.id, scans.data)!.status}`)
                          : t('notAnalyzed')}
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
                        activeScan={scans.data?.find(
                          (item) =>
                            item.repositoryId === repository.id &&
                            ['QUEUED', 'RUNNING'].includes(item.status),
                        )}
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
        )}
        {activeView === 'analyses' && (
        <AnalysisPanel
          scans={scans.data ?? []}
          selectedScan={selectedScan}
          onSelect={setSelectedScanId}
          locale={locale}
        />
        )}
        {activeView === 'vulnerabilities' && (
          <VulnerabilitiesPanel
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
        {activeView === 'quality' && <QualityGatePanel scans={latestRepositoryScans} />}
        {activeView === 'reports' && (
          <ReportsPanel
            organizationId={activeId}
            projectId={activeProjectId}
            scans={scans.data ?? []}
            selectedScan={selectedScan}
            findings={findings.data ?? []}
            onSelect={setSelectedScanId}
            locale={locale}
          />
        )}
      </section>
    </main>
  );
}

function ScanButton({
  organizationId,
  projectId,
  repositoryId,
  activeScan,
}: {
  organizationId: string;
  projectId: string;
  repositoryId: string;
  activeScan?: ScanSummary;
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
      <button
        className="sq-primary"
        disabled={scan.isPending || Boolean(activeScan)}
        onClick={() => scan.mutate()}
      >
        {scan.isPending
          ? t('scanQueued')
          : activeScan
            ? t(`status.${activeScan.status}`)
            : t('startScan')}
      </button>
      {scan.error && <small className="error-text">{scan.error.message}</small>}
    </div>
  );
}

function AnalysisPanel({
  scans,
  selectedScan,
  onSelect,
  locale,
}: {
  scans: ScanSummary[];
  selectedScan?: ScanSummary;
  onSelect: (id: string) => void;
  locale: string;
}) {
  const t = useTranslations('dashboard');
  return (
    <section className="cg-analysis-panel" id="analyses">
      <header>
        <div>
          <h2>{t('analysisActivity')}</h2>
          <p>{t('analysisActivityHelp')}</p>
        </div>
        {selectedScan && <ScanState scan={selectedScan} />}
      </header>
      {!scans.length ? (
        <div className="cg-analysis-empty">{t('noAnalysisData')}</div>
      ) : (
        <div className="cg-analysis-layout">
          <div className="cg-scan-history">
            {scans.map((scan) => (
              <button
                className={scan.id === selectedScan?.id ? 'active' : ''}
                key={scan.id}
                onClick={() => onSelect(scan.id)}
              >
                <span><strong>{scan.repositoryName}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(scan.queuedAt))}</small></span>
                <ScanState scan={scan} />
                <b>{scan.findingCount}</b>
              </button>
            ))}
          </div>
          <div className="cg-scan-detail">
            {selectedScan?.status === 'FAILED' ? (
              <div className="cg-scan-error"><strong>{t('analysisFailed')}</strong><code>{selectedScan.errorMessage ?? t('unknownError')}</code></div>
            ) : selectedScan && ['QUEUED', 'RUNNING'].includes(selectedScan.status) ? (
              <div className="cg-scan-progress"><i /><strong>{t(`status.${selectedScan.status}`)}</strong><span>{t('analysisProgressHelp')}</span></div>
            ) : (
              <div className="cg-analysis-result">
                <div><small>{t('repository')}</small><strong>{selectedScan?.repositoryName}</strong></div>
                <div><small>{t('detectedIssues')}</small><strong>{selectedScan?.findingCount ?? 0}</strong></div>
                <div><small>{t('commit')}</small><code>{selectedScan?.commitSha?.slice(0, 12) ?? '—'}</code></div>
                <p>{t('openVulnerabilitiesHelp')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function SidebarButton({
  icon,
  label,
  view,
  activeView,
  onSelect,
}: {
  icon: NavIconName;
  label: string;
  view: WorkspaceView;
  activeView: WorkspaceView;
  onSelect: (view: WorkspaceView) => void;
}) {
  return (
    <button className={view === activeView ? 'active' : ''} onClick={() => onSelect(view)}>
      <NavIcon name={icon} />
      <span>{label}</span>
    </button>
  );
}

type NavIconName = 'dashboard' | 'projects' | 'analyses' | 'vulnerabilities' | 'quality' | 'reports';

function NavIcon({ name }: { name: NavIconName }) {
  const paths: Record<NavIconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    projects: <><path d="M3 7.5h7l2 2h9v10.5H3z" /><path d="M3 7.5V5h7l2 2.5" /></>,
    analyses: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>,
    vulnerabilities: <><path d="M12 3 2.8 19h18.4z" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
    quality: <><path d="M12 3 4 6v6c0 4.5 3 7.5 8 9 5-1.5 8-4.5 8-9V6z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></>,
    reports: <><path d="M6 2h9l4 4v16H6z" /><path d="M14 2v5h5" /><path d="M9 13h6" /><path d="M9 17h6" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function ScanState({ scan }: { scan: ScanSummary }) {
  const t = useTranslations('dashboard');
  return (
    <span className={`scan-state ${scan.status.toLowerCase()}`}>
      <i />{t(`status.${scan.status}`)}
    </span>
  );
}

function DashboardSummary({
  scans,
  locale,
  onOpenAnalyses,
}: {
  scans: ScanSummary[];
  locale: string;
  onOpenAnalyses: () => void;
}) {
  const t = useTranslations('dashboard');
  return (
    <section className="cg-dashboard-summary">
      <header><div><h2>{t('recentAnalyses')}</h2><p>{t('recentAnalysesHelp')}</p></div><button onClick={onOpenAnalyses}>{t('seeAllAnalyses')} →</button></header>
      {scans.length ? scans.map((scan) => (
        <article key={scan.id}>
          <div><strong>{scan.repositoryName}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(scan.queuedAt))}</small></div>
          <ScanState scan={scan} />
          <div className="cg-summary-metric"><strong>{scan.findingCount}</strong><small>{t('detectedIssues')}</small></div>
        </article>
      )) : <div className="cg-analysis-empty">{t('noAnalysisData')}</div>}
    </section>
  );
}

const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;

function DashboardAnalytics({
  currentScans,
  history,
  locale,
  onSeverity,
}: {
  currentScans: ScanSummary[];
  history: ScanSummary[];
  locale: string;
  onSeverity: (severity: FindingSummary['severity']) => void;
}) {
  const t = useTranslations('dashboard');
  const totals = {
    CRITICAL: currentScans.reduce((sum, scan) => sum + scan.criticalCount, 0),
    HIGH: currentScans.reduce((sum, scan) => sum + scan.highCount, 0),
    MEDIUM: currentScans.reduce((sum, scan) => sum + scan.mediumCount, 0),
    LOW: currentScans.reduce((sum, scan) => sum + scan.lowCount, 0),
    INFO: currentScans.reduce((sum, scan) => sum + scan.infoCount, 0),
  };
  const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
  const colors: Record<(typeof SEVERITIES)[number], string> = {
    CRITICAL: '#d9364f', HIGH: '#f06464', MEDIUM: '#e7a845', LOW: '#4aa9dc', INFO: '#687f98',
  };
  let offset = 0;
  const gradient = total
    ? SEVERITIES.map((severity) => {
        const start = offset;
        offset += (totals[severity] / total) * 360;
        return `${colors[severity]} ${start}deg ${offset}deg`;
      }).join(', ')
    : '#25394d 0deg 360deg';
  const completed = history.filter((scan) => scan.status === 'SUCCEEDED').slice(0, 12).reverse();
  const max = Math.max(1, ...completed.map((scan) => scan.findingCount));
  const points = completed.map((scan, index) => {
    const x = completed.length === 1 ? 150 : 12 + (index / (completed.length - 1)) * 276;
    const y = 108 - (scan.findingCount / max) * 88;
    return { x, y, scan };
  });
  const passed = currentScans.filter((scan) => scan.qualityGate === 'PASSED').length;
  const failed = currentScans.filter((scan) => scan.qualityGate === 'FAILED').length;
  return (
    <div className="cg-analytics-grid">
      <section className="cg-chart-card severity-chart">
        <header><h2>{t('severityDistribution')}</h2><p>{t('latestResults')}</p></header>
        <div className="cg-donut-layout">
          <div className="cg-donut" style={{ background: `conic-gradient(${gradient})` }}><span><strong>{total}</strong><small>{t('total')}</small></span></div>
          <div className="cg-chart-legend">{SEVERITIES.map((severity) => <button key={severity} onClick={() => onSeverity(severity)}><i style={{ background: colors[severity] }} /><span>{t(`severity.${severity}`)}</span><b>{totals[severity]}</b></button>)}</div>
        </div>
      </section>
      <section className="cg-chart-card trend-chart">
        <header><h2>{t('findingTrend')}</h2><p>{t('lastScans', { count: completed.length })}</p></header>
        <svg viewBox="0 0 300 125" role="img" aria-label={t('findingTrend')}>
          <path className="grid-line" d="M12 20H288M12 64H288M12 108H288" />
          {points.length > 1 && <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} />}
          {points.map(({ x, y, scan }) => <circle key={scan.id} cx={x} cy={y} r="3.5"><title>{`${scan.findingCount} — ${new Intl.DateTimeFormat(locale).format(new Date(scan.queuedAt))}`}</title></circle>)}
        </svg>
        <div className="cg-trend-summary"><span><b>{completed.at(-1)?.findingCount ?? 0}</b>{t('latest')}</span><span><b>{max}</b>{t('maximum')}</span></div>
      </section>
      <section className="cg-chart-card gate-chart">
        <header><h2>{t('qualityGate')}</h2><p>{t('latestResults')}</p></header>
        <div className="cg-gate-visual"><strong>{passed}/{currentScans.length}</strong><span>{t('gatePassed')}</span><div><i style={{ width: `${currentScans.length ? (passed / currentScans.length) * 100 : 0}%` }} /></div></div>
        <dl><div><dt className="passed" /> <span>{t('gate.PASSED')}</span><b>{passed}</b></div><div><dt className="failed" /> <span>{t('gate.FAILED')}</span><b>{failed}</b></div></dl>
      </section>
    </div>
  );
}

function VulnerabilitiesPanel({
  organizationId,
  projectId,
  findings,
  selectedScan,
  selectedFinding,
  source,
  sourceLoading,
  sourceError,
  onSelect,
  severityFilter,
  onSeverityFilter,
  loading,
}: {
  organizationId?: string;
  projectId?: string;
  findings: FindingSummary[];
  selectedScan?: ScanSummary;
  selectedFinding?: FindingSummary;
  source?: z.infer<typeof findingSourceSchema>;
  sourceLoading: boolean;
  sourceError?: string;
  onSelect: (id: string) => void;
  severityFilter?: FindingSummary['severity'];
  onSeverityFilter: (severity?: FindingSummary['severity']) => void;
  loading: boolean;
}) {
  const t = useTranslations('dashboard');
  const visibleFindings = severityFilter
    ? findings.filter((finding) => finding.severity === severityFilter)
    : findings;
  if (loading) return <div className="cg-vulnerabilities-empty">{t('loadingFindings')}</div>;
  if (!selectedScan) return <div className="cg-vulnerabilities-empty">{t('noAnalysisData')}</div>;
  return (
    <section className="cg-vulnerabilities-panel">
      <header>
        <div><h2>{selectedScan.repositoryName}</h2><p>{t('vulnerabilityListHelp', { count: findings.length })}</p></div>
        <div className="cg-scan-reference"><small>{t('commit')}</small><code>{selectedScan.commitSha?.slice(0, 12) ?? '—'}</code></div>
      </header>
      <div className="cg-severity-filter">
        <button className={!severityFilter ? 'active' : ''} onClick={() => onSeverityFilter(undefined)}>{t('all')}</button>
        {SEVERITIES.map((severity) => <button className={severityFilter === severity ? 'active' : ''} key={severity} onClick={() => onSeverityFilter(severity)}>{t(`severity.${severity}`)}</button>)}
      </div>
      {findings.length ? (
        <div className="cg-issues-workspace">
        <div className="cg-findings-list">
          {visibleFindings.map((finding) => {
            const content = localizeFinding(finding, t);
            return (
              <button
                className={`severity-${finding.severity.toLowerCase()} ${finding.id === selectedFinding?.id ? 'active' : ''}`}
                key={finding.id}
                onClick={() => onSelect(finding.id)}
              >
                <div className="cg-finding-level"><i />{t(`severity.${finding.severity}`)}</div>
                <div className="cg-finding-content">
                  <h3>{content.title}</h3>
                  <div><code>{finding.filePath}:{finding.startLine}</code><span>{content.category}</span></div>
                </div>
              </button>
            );
          })}
        </div>
        <FindingDetail
          organizationId={organizationId}
          projectId={projectId}
          scanId={selectedScan.id}
          finding={selectedFinding}
          source={source}
          loading={sourceLoading}
          error={sourceError}
        />
        </div>
      ) : <div className="cg-vulnerabilities-empty">{t('noFindings')}</div>}
    </section>
  );
}

function FindingDetail({
  organizationId,
  projectId,
  scanId,
  finding,
  source,
  loading,
  error,
}: {
  organizationId?: string;
  projectId?: string;
  scanId: string;
  finding?: FindingSummary;
  source?: z.infer<typeof findingSourceSchema>;
  loading: boolean;
  error?: string;
}) {
  const t = useTranslations('dashboard');
  const queryClient = useQueryClient();
  const updateStatus = useMutation({
    mutationFn: (status: z.infer<typeof updateFindingStatusSchema>['status']) =>
      apiRequest(
        `/organizations/${organizationId}/projects/${projectId}/scans/${scanId}/findings/${finding?.id}`,
        findingSummarySchema,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['findings', organizationId, projectId, scanId] }),
  });
  if (!finding) return <div className="cg-issue-detail-empty">{t('selectIssue')}</div>;
  const content = localizeFinding(finding, t);
  return (
    <section className="cg-issue-detail">
      <header>
        <div className="cg-finding-level"><i />{t(`severity.${finding.severity}`)}</div>
        <h2>{content.title}</h2>
        <p>{content.description}</p>
      </header>
      <dl>
        <div><dt>{t('file')}</dt><dd><code>{finding.filePath}:{finding.startLine}</code></dd></div>
        <div><dt>{t('rule')}</dt><dd><code>{finding.ruleId}</code></dd></div>
        <div><dt>{t('category')}</dt><dd>{content.category}</dd></div>
      </dl>
      <div className="cg-triage">
        <strong>{t('triage')}</strong>
        <div>
          {updateFindingStatusSchema.shape.status.options.map((status) => (
            <button
              className={finding.status === status ? 'active' : ''}
              disabled={updateStatus.isPending || finding.status === status}
              key={status}
              onClick={() => updateStatus.mutate(status)}
            >{t(`findingStatus.${status}`)}</button>
          ))}
        </div>
        {updateStatus.error && <small className="error-text">{updateStatus.error.message}</small>}
      </div>
      <div className="cg-code-heading"><strong>{t('sourceContext')}</strong>{source && <a href={source.sourceUrl} target="_blank" rel="noreferrer">{t('openOnGithub')} ↗</a>}</div>
      {loading ? <div className="cg-code-state">{t('loadingSource')}</div> : error ? <div className="cg-code-state error-text">{t('sourceUnavailable')}</div> : source ? (
        <pre className="cg-code-view" aria-label={t('sourceContext')}>
          {source.lines.map((line) => <span className={line.highlighted ? 'highlighted' : ''} key={line.number}><b>{line.number}</b><code>{line.content || ' '}</code></span>)}
        </pre>
      ) : null}
      <details className="cg-technical-detail"><summary>{t('technicalDetail')}</summary><p>{finding.message}</p></details>
    </section>
  );
}

function QualityGatePanel({ scans }: { scans: ScanSummary[] }) {
  const t = useTranslations('dashboard');
  return (
    <section className="cg-quality-panel">
      <header><div><h2>{t('qualityGateTitle')}</h2><p>{t('qualityGateRule')}</p></div></header>
      <div className="cg-quality-table">
        <div className="head"><span>{t('repository')}</span><span>{t('qualityGate')}</span><span>{t('critical')}</span><span>{t('high')}</span><span>{t('medium')}</span><span>{t('low')}</span></div>
        {scans.map((scan) => <article key={scan.id}>
          <div><strong>{scan.repositoryName}</strong><code>{scan.commitSha?.slice(0, 12) ?? '—'}</code></div>
          <span className={`gate-state ${scan.qualityGate.toLowerCase()}`}><i />{t(`gate.${scan.qualityGate}`)}</span>
          <b>{scan.criticalCount}</b><b>{scan.highCount}</b><b>{scan.mediumCount}</b><b>{scan.lowCount}</b>
        </article>)}
      </div>
    </section>
  );
}

function ReportsPanel({
  organizationId,
  projectId,
  scans,
  selectedScan,
  findings,
  onSelect,
  locale,
}: {
  organizationId?: string;
  projectId?: string;
  scans: ScanSummary[];
  selectedScan?: ScanSummary;
  findings: FindingSummary[];
  onSelect: (id: string) => void;
  locale: string;
}) {
  const t = useTranslations('dashboard');
  const downloadable = scans.filter((scan) => scan.status === 'SUCCEEDED');
  const base = selectedScan && organizationId && projectId
    ? `/api/v1/organizations/${organizationId}/projects/${projectId}/scans/${selectedScan.id}/report`
    : undefined;
  return (
    <section className="cg-reports-panel">
      <header><div><h2>{t('securityReports')}</h2><p>{t('securityReportsHelp')}</p></div></header>
      <div className="cg-reports-layout">
        <div className="cg-report-scans">
          {downloadable.map((scan) => <button className={scan.id === selectedScan?.id ? 'active' : ''} key={scan.id} onClick={() => onSelect(scan.id)}>
            <div><strong>{scan.repositoryName}</strong><small>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(scan.completedAt ?? scan.queuedAt))}</small></div>
            <span>{scan.findingCount} {t('issues')}</span>
          </button>)}
        </div>
        <div className="cg-report-preview">
          {selectedScan && base ? <>
            <div className="cg-report-cover">
              <div><small>{t('securityAssessment')}</small><h3>{selectedScan.repositoryName}</h3><p>{t('reportGeneratedFrom', { scanner: selectedScan.scanner })}</p></div>
              <div className={`cg-report-verdict ${selectedScan.qualityGate.toLowerCase()}`}><i /> <span><small>{t('qualityGate')}</small><strong>{t(`gate.${selectedScan.qualityGate}`)}</strong></span></div>
            </div>
            <div className="cg-report-metrics">
              <div><small>{t('detectedIssues')}</small><strong>{selectedScan.findingCount}</strong></div>
              <div className="critical"><small>{t('critical')}</small><strong>{selectedScan.criticalCount}</strong></div>
              <div className="high"><small>{t('high')}</small><strong>{selectedScan.highCount}</strong></div>
              <div className="medium"><small>{t('medium')}</small><strong>{selectedScan.mediumCount}</strong></div>
            </div>
            <div className="cg-report-body">
              <section className="cg-report-severity">
                <h4>{t('severityDistribution')}</h4>
                <ReportSeverityChart scan={selectedScan} />
              </section>
              <section className="cg-report-context">
                <h4>{t('analysisContext')}</h4>
                <dl><div><dt>{t('commit')}</dt><dd><code>{selectedScan.commitSha?.slice(0, 12)}</code></dd></div><div><dt>{t('scanner')}</dt><dd>{selectedScan.scanner}</dd></div><div><dt>{t('completed')}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(selectedScan.completedAt ?? selectedScan.queuedAt))}</dd></div></dl>
              </section>
            </div>
            <section className="cg-report-issues">
              <header><h4>{t('priorityIssues')}</h4><span>{findings.length} {t('issues')}</span></header>
              {findings.slice(0, 6).map((finding) => <article key={finding.id}><div className={`report-severity ${finding.severity.toLowerCase()}`}><i />{t(`severity.${finding.severity}`)}</div><div><strong>{localizeFinding(finding, t).title}</strong><code>{finding.filePath}:{finding.startLine}</code></div><span>{t(`findingStatus.${finding.status}`)}</span></article>)}
            </section>
            <section className="cg-report-downloads"><div><h4>{t('exportReport')}</h4><p>{t('reportExportHelp')}</p></div><div className="cg-export-actions"><a href={`${base}?format=sarif`}>{t('downloadSarif')}<small>{t('sarifHelp')}</small></a><a href={`${base}?format=json`}>{t('downloadJson')}<small>{t('jsonHelp')}</small></a></div></section>
          </> : <div className="cg-analysis-empty">{t('noAnalysisData')}</div>}
        </div>
      </div>
    </section>
  );
}

function ReportSeverityChart({ scan }: { scan: ScanSummary }) {
  const t = useTranslations('dashboard');
  const rows = [
    ['CRITICAL', scan.criticalCount, '#d9364f'],
    ['HIGH', scan.highCount, '#f06464'],
    ['MEDIUM', scan.mediumCount, '#e7a845'],
    ['LOW', scan.lowCount, '#4aa9dc'],
    ['INFO', scan.infoCount, '#687f98'],
  ] as const;
  const max = Math.max(1, ...rows.map(([, count]) => count));
  return <div className="cg-report-bars">{rows.map(([severity, count, color]) => <div key={severity}><span>{t(`severity.${severity}`)}</span><div><i style={{ width: `${(count / max) * 100}%`, background: color }} /></div><b>{count}</b></div>)}</div>;
}

function localizeFinding(
  finding: FindingSummary,
  t: ReturnType<typeof useTranslations>,
): { title: string; description: string; category: string } {
  if (finding.ruleId.includes('github-actions-mutable-action-tag')) return {
    title: t('finding.mutableAction.title'),
    description: t('finding.mutableAction.description'),
    category: t('finding.supplyChain'),
  };
  if (finding.ruleId.includes('pnpm-block-exotic')) return {
    title: t('finding.exoticDependencies.title'),
    description: t('finding.exoticDependencies.description'),
    category: t('finding.dependencies'),
  };
  if (finding.ruleId.includes('minimum-release-age')) return {
    title: t('finding.releaseAge.title'),
    description: t('finding.releaseAge.description'),
    category: t('finding.dependencies'),
  };
  if (finding.ruleId.includes('pnpm-trust-policy')) return {
    title: t('finding.trustPolicy.title'),
    description: t('finding.trustPolicy.description'),
    category: t('finding.dependencies'),
  };
  return { title: t('finding.generic.title'), description: t('finding.generic.description'), category: t('finding.codeSecurity') };
}

function latestScanForProject(projectId: string, scans?: ScanSummary[]): ScanSummary | undefined {
  return scans?.find((scan) => scan.projectId === projectId);
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
