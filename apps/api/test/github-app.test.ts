import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createAppJwt,
  createInstallationState,
  verifyInstallationState,
} from '../src/modules/integrations/github-app.js';

describe('GitHub App security helpers', () => {
  it('signs a short-lived installation state and rejects tampering', () => {
    const secret = 'a-state-secret-that-is-long-enough-for-tests';
    const state = createInstallationState(
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      secret,
    );
    expect(verifyInstallationState(state, secret).organizationId).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(() => verifyInstallationState(`${state}x`, secret)).toThrow();
  });

  it('creates an RS256 GitHub App JWT without exposing the private key', () => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwt = createAppJwt({
      appId: '123',
      slug: 'codeguard',
      privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
      stateSecret: 'unused',
    });
    expect(jwt.split('.')).toHaveLength(3);
    expect(jwt).not.toContain('PRIVATE KEY');
  });
});
