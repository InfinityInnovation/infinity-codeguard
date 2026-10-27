'use client';

import { findingSummarySchema, updateFindingStatusSchema } from '@codeguard/contracts';
import type { FindingSource, FindingSummary, ScanSummary } from '@codeguard/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { z } from 'zod';
import { apiRequest } from '../../../lib/api';
import { localizeFinding } from '../model/findings';
import { workspaceQueryKeys } from '../model/query-keys';
import { SEVERITIES } from '../model/security';

export function VulnerabilitiesView({
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
  source?: FindingSource;
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
  const visibleSelectedFinding =
    visibleFindings.find(({ id }) => id === selectedFinding?.id) ?? visibleFindings[0];
  if (loading) return <div className="cg-vulnerabilities-empty">{t('loadingFindings')}</div>;
  if (!selectedScan) return <div className="cg-vulnerabilities-empty">{t('noAnalysisData')}</div>;
  return (
    <section className="cg-vulnerabilities-panel">
      <header>
        <div>
          <h2>{selectedScan.repositoryName}</h2>
          <p>{t('vulnerabilityListHelp', { count: findings.length })}</p>
        </div>
        <div className="cg-scan-reference">
          <small>{t('commit')}</small>
          <code>{selectedScan.commitSha?.slice(0, 12) ?? '—'}</code>
        </div>
      </header>
      <div className="cg-severity-filter">
        <button
          className={!severityFilter ? 'active' : ''}
          onClick={() => onSeverityFilter(undefined)}
        >
          {t('all')}
        </button>
        {SEVERITIES.map((severity) => (
          <button
            className={severityFilter === severity ? 'active' : ''}
            key={severity}
            onClick={() => onSeverityFilter(severity)}
          >
            {t(`severity.${severity}`)}
          </button>
        ))}
      </div>
      {findings.length ? (
        <div className="cg-issues-workspace">
          <div className="cg-findings-list">
            {visibleFindings.map((finding) => {
              const content = localizeFinding(finding, t);
              return (
                <button
                  className={`severity-${finding.severity.toLowerCase()} ${finding.id === visibleSelectedFinding?.id ? 'active' : ''}`}
                  key={finding.id}
                  onClick={() => onSelect(finding.id)}
                >
                  <div className="cg-finding-level">
                    <i />
                    {t(`severity.${finding.severity}`)}
                  </div>
                  <div className="cg-finding-content">
                    <h3>{content.title}</h3>
                    <div>
                      <code>
                        {finding.filePath}:{finding.startLine}
                      </code>
                      <span>{content.category}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <FindingDetail
            organizationId={organizationId}
            projectId={projectId}
            scanId={selectedScan.id}
            finding={visibleSelectedFinding}
            source={source}
            loading={sourceLoading}
            error={sourceError}
          />
        </div>
      ) : (
        <div className="cg-vulnerabilities-empty">{t('noFindings')}</div>
      )}
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
  source?: FindingSource;
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
      queryClient.invalidateQueries({
        queryKey: workspaceQueryKeys.findings(organizationId, projectId, scanId),
      }),
  });
  if (!finding) return <div className="cg-issue-detail-empty">{t('selectIssue')}</div>;
  const content = localizeFinding(finding, t);
  return (
    <section className="cg-issue-detail">
      <header>
        <div className="cg-finding-level">
          <i />
          {t(`severity.${finding.severity}`)}
        </div>
        <h2>{content.title}</h2>
        <p>{content.description}</p>
      </header>
      <dl>
        <div>
          <dt>{t('file')}</dt>
          <dd>
            <code>
              {finding.filePath}:{finding.startLine}
            </code>
          </dd>
        </div>
        <div>
          <dt>{t('rule')}</dt>
          <dd>
            <code>{finding.ruleId}</code>
          </dd>
        </div>
        <div>
          <dt>{t('category')}</dt>
          <dd>{content.category}</dd>
        </div>
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
            >
              {t(`findingStatus.${status}`)}
            </button>
          ))}
        </div>
        {updateStatus.error && <small className="error-text">{updateStatus.error.message}</small>}
      </div>
      <div className="cg-code-heading">
        <strong>{t('sourceContext')}</strong>
        {source?.sourceUrl.startsWith('https://') && (
          <a href={source.sourceUrl} target="_blank" rel="noreferrer">
            {t('openOnGithub')} ↗
          </a>
        )}
      </div>
      {loading ? (
        <div className="cg-code-state">{t('loadingSource')}</div>
      ) : error ? (
        <div className="cg-code-state error-text">{t('sourceUnavailable')}</div>
      ) : source ? (
        <pre className="cg-code-view" aria-label={t('sourceContext')}>
          {source.lines.map((line) => (
            <span className={line.highlighted ? 'highlighted' : ''} key={line.number}>
              <b>{line.number}</b>
              <code>{line.content || ' '}</code>
            </span>
          ))}
        </pre>
      ) : null}
      <details className="cg-technical-detail">
        <summary>{t('technicalDetail')}</summary>
        <p>{finding.message}</p>
      </details>
    </section>
  );
}
