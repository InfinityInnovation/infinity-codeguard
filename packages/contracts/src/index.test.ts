import { describe, expect, it } from 'vitest';
import { authenticatedUserSchema, organizationSummarySchema } from './index.js';

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
});
