'use client';

import { analysisTokenCreatedSchema, analysisTokenSummariesSchema } from '@codeguard/contracts';
import type {
  FindingSource,
  FindingSummary,
  ProjectSummary,
  RepositorySummary,
  ScanSummary,
} from '@codeguard/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../../../lib/api';
import { workspaceQueryKeys } from '../model/query-keys';
import { SEVERITIES, SEVERITY_COUNT_FIELDS } from '../model/security';
import { AnalysesView } from './analyses-view';
import { DashboardAnalytics } from './dashboard-overview';
import { VulnerabilitiesView } from './vulnerabilities-view';

type ProjectTab = 'overview' | 'issues' | 'measures' | 'activity';

export function ProjectWorkspace({
  project,
  repositories,
  scans,
  latestScans,
  selectedScan,
  findings,
  selectedFinding,
  source,
  sourceLoading,
  sourceError,
  organizationId,
  locale,
  onSelectScan,
  onSelectFinding,
  canManage,
}: {
  project: ProjectSummary;
  repositories: RepositorySummary[];
  scans: ScanSummary[];
  latestScans: ScanSummary[];
  selectedScan?: ScanSummary;
  findings: FindingSummary[];
  selectedFinding?: FindingSummary;
  source?: FindingSource;
  sourceLoading: boolean;
  sourceError?: string;
  organizationId?: string;
  locale: string;
  onSelectScan: (id: string | undefined) => void;
  onSelectFinding: (id: string | undefined) => void;
  canManage: boolean;
}) {
  const t = useTranslations('dashboard');
  const [tab, setTab] = useState<ProjectTab>('overview');
  const [projectSeverity, setProjectSeverity] = useState<FindingSummary['severity']>();
  const [analysisToken, setAnalysisToken] = useState<z.infer<typeof analysisTokenCreatedSchema>>();
  const queryClient = useQueryClient();
  const tokenQueryKey = workspaceQueryKeys.analysisTokens(organizationId, project.id);
  const tokens = useQuery({
    queryKey: tokenQueryKey,
    queryFn: () =>
      apiRequest(
        `/scanner/organizations/${organizationId}/projects/${project.id}/tokens`,
        analysisTokenSummariesSchema,
      ),
    enabled: canManage && Boolean(organizationId),
  });
  const createToken = useMutation({
    mutationFn: () =>
      apiRequest(
        `/scanner/organizations/${organizationId}/projects/${project.id}/tokens`,
        analysisTokenCreatedSchema,
        { method: 'POST', body: JSON.stringify({ name: 'CI scanner', expiresInDays: 90 }) },
      ),
    onSuccess: async (created) => {
      setAnalysisToken(created);
      await queryClient.invalidateQueries({ queryKey: tokenQueryKey });
    },
  });
  const revokeToken = useMutation({
    mutationFn: (tokenId: string) =>
      apiRequest(
        `/scanner/organizations/${organizationId}/projects/${project.id}/tokens/${tokenId}`,
        z.object({ revoked: z.literal(true) }),
        { method: 'DELETE' },
      ),
    onSuccess: async (_result, tokenId) => {
      if (analysisToken?.id === tokenId) setAnalysisToken(undefined);
      await queryClient.invalidateQueries({ queryKey: tokenQueryKey });
    },
  });
  const completed = scans.filter((scan) => scan.status === 'SUCCEEDED');
  const failed = scans.filter((scan) => scan.status === 'FAILED');
  const gate = latestScans.some((scan) => scan.qualityGate === 'FAILED')
    ? 'FAILED'
    : latestScans.length && latestScans.every((scan) => scan.qualityGate === 'PASSED')
      ? 'PASSED'
      : 'PENDING';
  const totalIssues = latestScans.reduce((sum, scan) => sum + scan.findingCount, 0);
  const criticalIssues = latestScans.reduce((sum, scan) => sum + scan.criticalCount, 0);
  const highIssues = latestScans.reduce((sum, scan) => sum + scan.highCount, 0);
  const latestCompleted = completed[0];
  const successRate = scans.length ? Math.round((completed.length / scans.length) * 100) : 0;
  const openIssues = (severity?: FindingSummary['severity']) => {
    setProjectSeverity(severity);
    setTab('issues');
    onSelectFinding(findings.find((finding) => !severity || finding.severity === severity)?.id);
  };

  return (
    <section className="cg-project-workspace">
      <header className="cg-project-hero">
        <div className="cg-project-avatar">{project.name.slice(0, 1).toUpperCase()}</div>
        <div className="cg-project-title">
          <div>
            <h2>{project.name}</h2>
            <code>{project.slug}</code>
          </div>
          <p>{t('projectSecurityWorkspace')}</p>
        </div>
        <div className={`cg-project-gate ${gate.toLowerCase()}`}>
          <small>{t('qualityGate')}</small>
          <strong>{t(`gate.${gate}`)}</strong>
        </div>
      </header>
      <nav className="cg-project-tabs" aria-label={t('projectNavigation')}>
        {(['overview', 'issues', 'measures', 'activity'] as const).map((item) => (
          <button className={tab === item ? 'active' : ''} key={item} onClick={() => setTab(item)}>
            {t(`projectTabs.${item}`)}
          </button>
        ))}
      </nav>
      {tab === 'overview' && (
        <div className="cg-project-overview">
          <div className="cg-project-kpis">
            <button onClick={() => openIssues()}>
              <span>{t('detectedIssues')}</span>
              <strong>{totalIssues}</strong>
              <small>{t('onLatestAnalysis')}</small>
            </button>
            <button className="critical" onClick={() => openIssues('CRITICAL')}>
              <span>{t('critical')}</span>
              <strong>{criticalIssues}</strong>
              <small>{t('requiresAttention')}</small>
            </button>
            <button className="high" onClick={() => openIssues('HIGH')}>
              <span>{t('high')}</span>
              <strong>{highIssues}</strong>
              <small>{t('requiresAttention')}</small>
            </button>
            <div>
              <span>{t('analysisReliability')}</span>
              <strong>{successRate}%</strong>
              <small>
                {t('successfulScans', { completed: completed.length, total: scans.length })}
              </small>
            </div>
          </div>
          <DashboardAnalytics
            currentScans={latestScans}
            history={scans}
            locale={locale}
            onSeverity={openIssues}
          />
          <section className="cg-scanner-setup">
            <header>
              <div>
                <h3>{t('ciAnalysis')}</h3>
                <p>{t('ciAnalysisHelp')}</p>
              </div>
              {canManage && !analysisToken && (
                <button
                  className="sq-primary"
                  disabled={createToken.isPending}
                  onClick={() => createToken.mutate()}
                >
                  {t('generateAnalysisToken')}
                </button>
              )}
            </header>
            {analysisToken ? (
              <div className="cg-scanner-command">
                <div>
                  <strong>{t('tokenShownOnce')}</strong>
                  <code>{analysisToken.token}</code>
                </div>
                <pre>{`# Dans le projet à analyser : codeguard.properties\ncodeguard.host.url=http://localhost:3000\ncodeguard.repository.id=${repositories[0]?.id ?? project.slug}\n\n# Depuis le dépôt Infinity CodeGuard :\nCG_TOKEN='${analysisToken.token}' ./scripts/codeguard-scan /chemin/vers/votre-projet`}</pre>
              </div>
            ) : (
              <div className="cg-scanner-flow">
                <span>
                  <b>1</b>
                  {t('scannerStepToken')}
                </span>
                <i>→</i>
                <span>
                  <b>2</b>
                  {t('scannerStepAnalyze')}
                </span>
                <i>→</i>
                <span>
                  <b>3</b>
                  {t('scannerStepUpload')}
                </span>
                <i>→</i>
                <span>
                  <b>4</b>
                  {t('scannerStepGate')}
                </span>
              </div>
            )}
            {createToken.error && <small className="error-text">{createToken.error.message}</small>}
            {canManage && Boolean(organizationId) && (
              <div className="cg-token-list">
                <h4>{t('analysisTokens')}</h4>
                {tokens.isPending && <small>{t('loadingTokens')}</small>}
                {tokens.error && <small className="error-text">{tokens.error.message}</small>}
                {tokens.data?.map((token) => {
                  const inactive = Boolean(
                    token.revokedAt || (token.expiresAt && new Date(token.expiresAt) <= new Date()),
                  );
                  return (
                    <div key={token.id}>
                      <span>
                        <strong>{token.name}</strong>
                        <code>{token.prefix}…</code>
                      </span>
                      <small>
                        {token.revokedAt
                          ? t('tokenRevoked')
                          : inactive
                            ? t('tokenExpired')
                            : t('tokenActive')}
                      </small>
                      {!inactive && (
                        <button
                          disabled={revokeToken.isPending}
                          onClick={() => revokeToken.mutate(token.id)}
                        >
                          {t('revokeToken')}
                        </button>
                      )}
                    </div>
                  );
                })}
                {revokeToken.error && (
                  <small className="error-text">{revokeToken.error.message}</small>
                )}
              </div>
            )}
          </section>
          <section className="cg-project-repositories">
            <header>
              <div>
                <h3>{t('repositoryPortfolio')}</h3>
                <p>{t('repositoryPortfolioHelp')}</p>
              </div>
              <span>{repositories.length}</span>
            </header>
            {repositories.map((repository) => {
              const lastScan = latestScans.find((scan) => scan.repositoryId === repository.id);
              return (
                <article key={repository.id}>
                  <div>
                    <strong>{repository.name}</strong>
                    <small>
                      {repository.provider} · {repository.defaultBranch}
                    </small>
                  </div>
                  <div>
                    {lastScan ? (
                      <>
                        <span className={`gate-state ${lastScan.qualityGate.toLowerCase()}`}>
                          <i />
                          {t(`gate.${lastScan.qualityGate}`)}
                        </span>
                        <code>{lastScan.commitSha?.slice(0, 8) ?? '—'}</code>
                      </>
                    ) : (
                      <span className="gate-state pending">
                        <i />
                        {t('notAnalyzed')}
                      </span>
                    )}
                  </div>
                  <code>{repository.id}</code>
                </article>
              );
            })}
          </section>
        </div>
      )}
      {tab === 'issues' && (
        <VulnerabilitiesView
          organizationId={organizationId}
          projectId={project.id}
          findings={findings}
          selectedScan={selectedScan}
          selectedFinding={selectedFinding}
          source={source}
          sourceLoading={sourceLoading}
          sourceError={sourceError}
          onSelect={(id) => onSelectFinding(id)}
          severityFilter={projectSeverity}
          onSeverityFilter={(severity) => {
            setProjectSeverity(severity);
            onSelectFinding(
              findings.find((finding) => !severity || finding.severity === severity)?.id,
            );
          }}
          loading={false}
        />
      )}
      {tab === 'measures' && (
        <div className="cg-project-measures">
          <section>
            <header>
              <h3>{t('securityMeasures')}</h3>
              <p>{t('securityMeasuresHelp')}</p>
            </header>
            <div className="cg-measure-grid">
              {SEVERITIES.map((severity) => (
                <button key={severity} onClick={() => openIssues(severity)}>
                  <i className={`severity-${severity.toLowerCase()}`} />
                  <span>{t(`severity.${severity}`)}</span>
                  <strong>
                    {latestScans.reduce(
                      (sum, scan) => sum + scan[SEVERITY_COUNT_FIELDS[severity]],
                      0,
                    )}
                  </strong>
                </button>
              ))}
            </div>
          </section>
          <section>
            <header>
              <h3>{t('analysisHealth')}</h3>
            </header>
            <dl>
              <div>
                <dt>{t('repositories')}</dt>
                <dd>{repositories.length}</dd>
              </div>
              <div>
                <dt>{t('completedAnalyses')}</dt>
                <dd>{completed.length}</dd>
              </div>
              <div>
                <dt>{t('failedAnalyses')}</dt>
                <dd>{failed.length}</dd>
              </div>
              <div>
                <dt>{t('lastProfile')}</dt>
                <dd>{latestCompleted ? t(`profile.${latestCompleted.profile}`) : '—'}</dd>
              </div>
              <div>
                <dt>{t('lastCommit')}</dt>
                <dd>
                  <code>{latestCompleted?.commitSha?.slice(0, 12) ?? '—'}</code>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
      {tab === 'activity' && (
        <AnalysesView
          scans={scans}
          selectedScan={selectedScan}
          onSelect={(id) => onSelectScan(id)}
          locale={locale}
          organizationId={organizationId}
          projectId={project.id}
        />
      )}
    </section>
  );
}
