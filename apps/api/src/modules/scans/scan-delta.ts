import type { ScanDelta } from '@codeguard/contracts';

export function classifyScanFindings(
  scanId: string,
  previousScanId: string | null,
  current: string[],
  previous: string[],
  historical: string[],
): ScanDelta {
  const currentSet = new Set(current);
  const previousSet = new Set(previous);
  const historicalSet = new Set(historical);
  let newCount = 0;
  let continuingCount = 0;
  let reopenedCount = 0;
  for (const fingerprint of currentSet) {
    if (previousSet.has(fingerprint)) continuingCount++;
    else if (historicalSet.has(fingerprint)) reopenedCount++;
    else newCount++;
  }
  let fixedCount = 0;
  for (const fingerprint of previousSet) {
    if (!currentSet.has(fingerprint)) fixedCount++;
  }
  return { scanId, previousScanId, newCount, fixedCount, continuingCount, reopenedCount };
}
