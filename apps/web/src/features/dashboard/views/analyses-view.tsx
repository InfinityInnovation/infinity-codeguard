'use client';

import { scanDeltaSchema } from '@codeguard/contracts';
import type { ScanSummary } from '@codeguard/contracts';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { apiRequest } from '../../../lib/api';
import { ScanState } from '../components/scan-state';
import { workspaceQueryKeys } from '../model/query-keys';

export function AnalysesView({
  scans,
  selectedScan,
  onSelect,
  locale,
  organizationId,
  projectId,
}: {
  scans: ScanSummary[];
  selectedScan?: ScanSummary;
  onSelect: (id: string) => void;
  locale: string;
  organizationId?: string;
  projectId?: string;
}) {
  const t = useTranslations('dashboard');
  const delta = useQuery({
    queryKey: workspaceQueryKeys.scanDelta(organizationId, projectId, selectedScan?.id),
    queryFn: () =>
      apiRequest(
        `/organizations/${organizationId}/projects/${projectId}/scans/${selectedScan?.id}/delta`,
        scanDeltaSchema,
      ),
    enabled: Boolean(organizationId && projectId && selectedScan?.status === 'SUCCEEDED'),
  });
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
                <span>
                  <strong>{scan.repositoryName}</strong>
                  <small>
                    {scan.branch} · {t(`profile.${scan.profile}`)} ·{' '}
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(scan.queuedAt))}
                  </small>
                </span>
                <ScanState scan={scan} />
                <b>{scan.findingCount}</b>
              </button>
            ))}
          </div>
          <div className="cg-scan-detail">
            {selectedScan?.status === 'FAILED' ? (
              <div className="cg-scan-error">
                <strong>{t('analysisFailed')}</strong>
                <code>{selectedScan.errorMessage ?? t('unknownError')}</code>
              </div>
            ) : selectedScan && ['QUEUED', 'RUNNING'].includes(selectedScan.status) ? (
              <div className="cg-scan-progress">
                <i />
                <strong>{t(`status.${selectedScan.status}`)}</strong>
                <span>{t('analysisProgressHelp')}</span>
              </div>
            ) : (
              <div className="cg-analysis-result">
                <div>
                  <small>{t('repository')}</small>
                  <strong>{selectedScan?.repositoryName}</strong>
                </div>
                <div>
                  <small>{t('detectedIssues')}</small>
                  <strong>{selectedScan?.findingCount ?? 0}</strong>
                </div>
                <div>
                  <small>{t('analysisProfile')}</small>
                  <strong>{selectedScan ? t(`profile.${selectedScan.profile}`) : '—'}</strong>
                </div>
                <div>
                  <small>{t('branch')}</small>
                  <strong>{selectedScan?.branch ?? '—'}</strong>
                </div>
                <div>
                  <small>{t('commit')}</small>
                  <code>{selectedScan?.commitSha?.slice(0, 12) ?? '—'}</code>
                </div>
                {delta.data && (
                  <div className="cg-scan-delta">
                    <span>
                      <small>{t('newFindings')}</small>
                      <strong>{delta.data.newCount}</strong>
                    </span>
                    <span>
                      <small>{t('fixedFindings')}</small>
                      <strong>{delta.data.fixedCount}</strong>
                    </span>
                    <span>
                      <small>{t('reopenedFindings')}</small>
                      <strong>{delta.data.reopenedCount}</strong>
                    </span>
                    <span>
                      <small>{t('continuingFindings')}</small>
                      <strong>{delta.data.continuingCount}</strong>
                    </span>
                  </div>
                )}
                <p>{t('openVulnerabilitiesHelp')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
