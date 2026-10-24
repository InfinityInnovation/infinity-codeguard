import { describe, expect, it } from 'vitest';
import { scanJobSchema } from './jobs.js';

describe('scan job contract', () => {
  it('rejects missing tenant context', () => {
    expect(scanJobSchema.safeParse({ scanId: crypto.randomUUID() }).success).toBe(false);
  });

  it('accepts tenant-bound identifiers without a queue-controlled URL', () => {
    expect(
      scanJobSchema.safeParse({
        scanId: crypto.randomUUID(),
        organizationId: crypto.randomUUID(),
        projectId: crypto.randomUUID(),
        repositoryId: crypto.randomUUID(),
      }).success,
    ).toBe(true);
  });
});
