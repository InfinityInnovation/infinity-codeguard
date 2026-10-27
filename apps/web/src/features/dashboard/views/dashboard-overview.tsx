'use client';

import type { FindingSummary, ScanSummary } from '@codeguard/contracts';
import { useTranslations } from 'next-intl';
import { ScanState } from '../components/scan-state';
import { SEVERITIES } from '../model/security';

export function DashboardSummary({
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
      <header>
        <div>
          <h2>{t('recentAnalyses')}</h2>
          <p>{t('recentAnalysesHelp')}</p>
        </div>
        <button onClick={onOpenAnalyses}>{t('seeAllAnalyses')} →</button>
      </header>
      {scans.length ? (
        scans.map((scan) => (
          <article key={scan.id}>
            <div>
              <strong>{scan.repositoryName}</strong>
              <small>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(scan.queuedAt))}
              </small>
            </div>
            <ScanState scan={scan} />
            <div className="cg-summary-metric">
              <strong>{scan.findingCount}</strong>
              <small>{t('detectedIssues')}</small>
            </div>
          </article>
        ))
      ) : (
        <div className="cg-analysis-empty">{t('noAnalysisData')}</div>
      )}
    </section>
  );
}

export function DashboardAnalytics({
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
    CRITICAL: '#d9364f',
    HIGH: '#f06464',
    MEDIUM: '#e7a845',
    LOW: '#4aa9dc',
    INFO: '#687f98',
  };
  let offset = 0;
  const gradient = total
    ? SEVERITIES.map((severity) => {
        const start = offset;
        offset += (totals[severity] / total) * 360;
        return `${colors[severity]} ${start}deg ${offset}deg`;
      }).join(', ')
    : '#25394d 0deg 360deg';
  const completed = history
    .filter((scan) => scan.status === 'SUCCEEDED')
    .slice(0, 12)
    .reverse();
  const max = Math.max(1, ...completed.map((scan) => scan.findingCount));
  const points = completed.map((scan, index) => ({
    x: completed.length === 1 ? 150 : 12 + (index / (completed.length - 1)) * 276,
    y: 108 - (scan.findingCount / max) * 88,
    scan,
  }));
  const passed = currentScans.filter((scan) => scan.qualityGate === 'PASSED').length;
  const failed = currentScans.filter((scan) => scan.qualityGate === 'FAILED').length;
  return (
    <div className="cg-analytics-grid">
      <section className="cg-chart-card severity-chart">
        <header>
          <h2>{t('severityDistribution')}</h2>
          <p>{t('latestResults')}</p>
        </header>
        <div className="cg-donut-layout">
          <div className="cg-donut" style={{ background: `conic-gradient(${gradient})` }}>
            <span>
              <strong>{total}</strong>
              <small>{t('total')}</small>
            </span>
          </div>
          <div className="cg-chart-legend">
            {SEVERITIES.map((severity) => (
              <button key={severity} onClick={() => onSeverity(severity)}>
                <i style={{ background: colors[severity] }} />
                <span>{t(`severity.${severity}`)}</span>
                <b>{totals[severity]}</b>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="cg-chart-card trend-chart">
        <header>
          <h2>{t('findingTrend')}</h2>
          <p>{t('lastScans', { count: completed.length })}</p>
        </header>
        <svg viewBox="0 0 300 125" role="img" aria-label={t('findingTrend')}>
          <path className="grid-line" d="M12 20H288M12 64H288M12 108H288" />
          {points.length > 1 && (
            <polyline points={points.map(({ x, y }) => `${x},${y}`).join(' ')} />
          )}
          {points.map(({ x, y, scan }) => (
            <circle key={scan.id} cx={x} cy={y} r="3.5">
              <title>{`${scan.findingCount} — ${new Intl.DateTimeFormat(locale).format(new Date(scan.queuedAt))}`}</title>
            </circle>
          ))}
        </svg>
        <div className="cg-trend-summary">
          <span>
            <b>{completed.at(-1)?.findingCount ?? 0}</b>
            {t('latest')}
          </span>
          <span>
            <b>{max}</b>
            {t('maximum')}
          </span>
        </div>
      </section>
      <section className="cg-chart-card gate-chart">
        <header>
          <h2>{t('qualityGate')}</h2>
          <p>{t('latestResults')}</p>
        </header>
        <div className="cg-gate-visual">
          <strong>
            {passed}/{currentScans.length}
          </strong>
          <span>{t('gatePassed')}</span>
          <div>
            <i
              style={{
                width: `${currentScans.length ? (passed / currentScans.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
        <dl>
          <div>
            <dt className="passed" /> <span>{t('gate.PASSED')}</span>
            <b>{passed}</b>
          </div>
          <div>
            <dt className="failed" /> <span>{t('gate.FAILED')}</span>
            <b>{failed}</b>
          </div>
        </dl>
      </section>
    </div>
  );
}
