import { describe, expect, it } from 'vitest';
import {
  authenticatedUserSchema,
  organizationSummarySchema,
  submitAnalysisSchema,
} from './index.js';

describe('API response contracts', () => {
  it('accepts a valid authenticated user', () => {
    expect(
      authenticatedUserSchema.safeParse({
        id: crypto.randomUUID(),
        email: 'user@example.com',
        displayName: 'CodeGuard User',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown organization role', () => {
    expect(
      organizationSummarySchema.safeParse({
        id: crypto.randomUUID(),
        name: 'Acme',
        slug: 'acme',
        role: 'SUPER_ADMIN',
      }).success,
    ).toBe(false);
  });

  it('accepts only the comprehensive profile for CI submissions', () => {
    const submission = {
      repositoryId: crypto.randomUUID(),
      branch: 'main',
      commitSha: 'a'.repeat(40),
      scannerVersion: '1.179.0',
      findings: [],
    };
    expect(submitAnalysisSchema.parse(submission).profile).toBe('COMPREHENSIVE');
    expect(submitAnalysisSchema.safeParse({ ...submission, profile: 'STANDARD' }).success).toBe(
      false,
    );
    expect(
      submitAnalysisSchema.safeParse({ ...submission, repositoryId: 'gbp-5b7b88' }).success,
    ).toBe(true);
    expect(submitAnalysisSchema.safeParse({ ...submission, repositoryId: undefined }).success).toBe(
      true,
    );
  });
});
