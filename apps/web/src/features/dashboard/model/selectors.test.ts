import { describe, expect, it } from 'vitest';
import type { ScanSummary } from '@codeguard/contracts';
import { latestScansByRepository, selectAvailableId } from './selectors';

describe('workspace selection', () => {
  it('falls back to a member organization after switching context', () => {
    const accessible = [{ id: 'organization-b' }];
    expect(selectAvailableId(accessible, 'organization-a')).toBe('organization-b');
    expect(selectAvailableId([], 'organization-a')).toBeUndefined();
  });

  it('keeps the newest scan for each repository even if input order changes', () => {
    const scan = (id: string, repositoryId: string, queuedAt: string) =>
      ({
        id,
        repositoryId,
        queuedAt,
      }) as ScanSummary;
    const latest = latestScansByRepository([
      scan('older', 'repo-a', '2026-10-01T00:00:00.000Z'),
      scan('other', 'repo-b', '2026-10-03T00:00:00.000Z'),
      scan('newer', 'repo-a', '2026-10-02T00:00:00.000Z'),
    ]);
    expect(latest.map(({ id }) => id)).toEqual(['other', 'newer']);
  });
});
