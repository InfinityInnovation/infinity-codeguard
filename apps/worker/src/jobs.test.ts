import { describe, expect, it } from 'vitest';
import { scanJobSchema } from './jobs.js';

describe('scan job contract', () => {
  it('rejects missing tenant context', () => {
    expect(scanJobSchema.safeParse({ scanId: crypto.randomUUID() }).success).toBe(false);
  });
});
