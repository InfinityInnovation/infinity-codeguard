import type { ScanSummary } from '@codeguard/contracts';

export function selectAvailableId<T extends { id: string }>(
  items: readonly T[] | undefined,
  requestedId?: string,
): string | undefined {
  return items?.some(({ id }) => id === requestedId) ? requestedId : items?.[0]?.id;
}

export function latestScansByRepository(scans: readonly ScanSummary[]): ScanSummary[] {
  const latest = new Map<string, ScanSummary>();
  for (const scan of scans) {
    const previous = latest.get(scan.repositoryId);
    if (!previous || scan.queuedAt > previous.queuedAt) latest.set(scan.repositoryId, scan);
  }
  return [...latest.values()].sort((left, right) => right.queuedAt.localeCompare(left.queuedAt));
}
