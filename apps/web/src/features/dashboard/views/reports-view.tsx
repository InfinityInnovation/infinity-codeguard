'use client';

import type { FindingSummary, ScanSummary } from '@codeguard/contracts';
import { useTranslations } from 'next-intl';
import { localizeFinding } from '../model/findings';

export function ReportsView({
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
  const base =
    selectedScan && organizationId && projectId
      ? `/api/v1/organizations/${organizationId}/projects/${projectId}/scans/${selectedScan.id}/report`
      : undefined;
  return (
    <section className="cg-reports-panel">
      <header>
        <div>
          <h2>{t('securityReports')}</h2>
          <p>{t('securityReportsHelp')}</p>
        </div>
      </header>
      <div className="cg-reports-layout">
        <div className="cg-report-scans">
          {downloadable.map((scan) => (
            <button
              className={scan.id === selectedScan?.id ? 'active' : ''}
              key={scan.id}
              onClick={() => onSelect(scan.id)}
            >
              <div>
                <strong>{scan.repositoryName}</strong>
                <small>
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(scan.completedAt ?? scan.queuedAt))}
                </small>
              </div>
              <span>
                {scan.findingCount} {t('issues')}
              </span>
            </button>
          ))}
        </div>
        <div className="cg-report-preview">
          {selectedScan && base ? (
            <>
              <div className="cg-report-cover">
                <div>
                  <small>{t('securityAssessment')}</small>
                  <h3>{selectedScan.repositoryName}</h3>
                  <p>{t('reportGeneratedFrom', { scanner: selectedScan.scanner })}</p>
                </div>
                <div className={`cg-report-verdict ${selectedScan.qualityGate.toLowerCase()}`}>
                  <i />{' '}
                  <span>
                    <small>{t('qualityGate')}</small>
                    <strong>{t(`gate.${selectedScan.qualityGate}`)}</strong>
                  </span>
                </div>
              </div>
              <div className="cg-report-metrics">
                <div>
                  <small>{t('detectedIssues')}</small>
                  <strong>{selectedScan.findingCount}</strong>
                </div>
                <div className="critical">
                  <small>{t('critical')}</small>
                  <strong>{selectedScan.criticalCount}</strong>
                </div>
                <div className="high">
                  <small>{t('high')}</small>
                  <strong>{selectedScan.highCount}</strong>
                </div>
                <div className="medium">
                  <small>{t('medium')}</small>
                  <strong>{selectedScan.mediumCount}</strong>
                </div>
              </div>
              <div className="cg-report-body">
                <section className="cg-report-severity">
                  <h4>{t('severityDistribution')}</h4>
                  <ReportSeverityChart scan={selectedScan} />
                </section>
                <section className="cg-report-context">
                  <h4>{t('analysisContext')}</h4>
                  <dl>
                    <div>
                      <dt>{t('commit')}</dt>
                      <dd>
                        <code>{selectedScan.commitSha?.slice(0, 12)}</code>
                      </dd>
                    </div>
                    <div>
                      <dt>{t('scanner')}</dt>
                      <dd>{selectedScan.scanner}</dd>
                    </div>
                    <div>
                      <dt>{t('completed')}</dt>
                      <dd>
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: 'long',
                          timeStyle: 'short',
                        }).format(new Date(selectedScan.completedAt ?? selectedScan.queuedAt))}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
              <section className="cg-report-issues">
                <header>
                  <h4>{t('priorityIssues')}</h4>
                  <span>
                    {findings.length} {t('issues')}
                  </span>
                </header>
                {findings.slice(0, 6).map((finding) => (
                  <article key={finding.id}>
                    <div className={`report-severity ${finding.severity.toLowerCase()}`}>
                      <i />
                      {t(`severity.${finding.severity}`)}
                    </div>
                    <div>
                      <strong>{localizeFinding(finding, t).title}</strong>
                      <code>
                        {finding.filePath}:{finding.startLine}
                      </code>
                    </div>
                    <span>{t(`findingStatus.${finding.status}`)}</span>
                  </article>
                ))}
              </section>
              <section className="cg-report-downloads">
                <div>
                  <h4>{t('exportReport')}</h4>
                  <p>{t('reportExportHelp')}</p>
                </div>
                <div className="cg-export-actions">
                  <a href={`${base}?format=sarif`}>
                    {t('downloadSarif')}
                    <small>{t('sarifHelp')}</small>
                  </a>
                  <a href={`${base}?format=json`}>
                    {t('downloadJson')}
                    <small>{t('jsonHelp')}</small>
                  </a>
                </div>
              </section>
            </>
          ) : (
            <div className="cg-analysis-empty">{t('noAnalysisData')}</div>
          )}
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
  return (
    <div className="cg-report-bars">
      {rows.map(([severity, count, color]) => (
        <div key={severity}>
          <span>{t(`severity.${severity}`)}</span>
          <div>
            <i style={{ width: `${(count / max) * 100}%`, background: color }} />
          </div>
          <b>{count}</b>
        </div>
      ))}
    </div>
  );
}
