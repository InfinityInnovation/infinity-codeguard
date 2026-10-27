'use client';

import type { ScanSummary } from '@codeguard/contracts';
import { useTranslations } from 'next-intl';

export function ScanState({ scan }: { scan: ScanSummary }) {
  const t = useTranslations('dashboard');
  return (
    <span className={`scan-state ${scan.status.toLowerCase()}`}>
      <i />
      {t(`status.${scan.status}`)}
    </span>
  );
}
