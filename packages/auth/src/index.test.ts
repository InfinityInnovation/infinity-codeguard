import { describe, expect, it } from 'vitest';
import {
  createSessionToken,
  digestSessionToken,
  hashPassword,
  safeTokenEquals,
  verifyPassword,
} from './index.js';

describe('authentication primitives', () => {
  it('hashes and verifies passwords without retaining plaintext', async () => {
    const hash = await hashPassword('a-valid-password');
    expect(hash).not.toContain('a-valid-password');
    await expect(verifyPassword(hash, 'a-valid-password')).resolves.toBe(true);
    await expect(verifyPassword(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('creates opaque session tokens with stable digests', () => {
    const session = createSessionToken();
    expect(session.digest).toBe(digestSessionToken(session.token));
    expect(safeTokenEquals(session.digest, digestSessionToken(session.token))).toBe(true);
    expect(safeTokenEquals(session.digest, 'different')).toBe(false);
  });
});
