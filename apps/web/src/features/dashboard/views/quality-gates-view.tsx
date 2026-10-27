'use client';

import type { ScanSummary } from '@codeguard/contracts';
import { useTranslations } from 'next-intl';

export function QualityGatesView({ scans }: { scans: ScanSummary[] }) {
  const t = useTranslations('dashboard');
  return (
    <section className="cg-quality-panel">
      <header>
        <div>
          <h2>{t('qualityGateTitle')}</h2>
          <p>{t('qualityGateRule')}</p>
        </div>
      </header>
      <div className="cg-quality-table">
        <div className="head">
          <span>{t('repository')}</span>
          <span>{t('qualityGate')}</span>
          <span>{t('critical')}</span>
          <span>{t('high')}</span>
          <span>{t('medium')}</span>
          <span>{t('low')}</span>
        </div>
        {scans.map((scan) => (
          <article key={scan.id}>
            <div>
              <strong>{scan.repositoryName}</strong>
              <code>{scan.commitSha?.slice(0, 12) ?? '—'}</code>
            </div>
            <span className={`gate-state ${scan.qualityGate.toLowerCase()}`}>
              <i />
              {t(`gate.${scan.qualityGate}`)}
            </span>
            <b>{scan.criticalCount}</b>
            <b>{scan.highCount}</b>
            <b>{scan.mediumCount}</b>
            <b>{scan.lowCount}</b>
          </article>
        ))}
      </div>
    </section>
  );
}
