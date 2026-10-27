import { createHmac, createSign, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const stateSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  expiresAt: z.number().int(),
});

export type GitHubAppConfiguration = {
  appId: string;
  slug: string;
  privateKey: string;
  stateSecret: string;
};

export function githubAppConfiguration(): GitHubAppConfiguration | null {
  const appId = process.env.GITHUB_APP_ID;
  const slug = process.env.GITHUB_APP_SLUG;
  const encodedKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
  const stateSecret = process.env.GITHUB_APP_STATE_SECRET;
  if (!appId || !slug || !encodedKey || !stateSecret) return null;
  return { appId, slug, privateKey: Buffer.from(encodedKey, 'base64').toString('utf8'), stateSecret };
}

export function createAppJwt(configuration: GitHubAppConfiguration): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: configuration.appId }),
  ).toString('base64url');
  const content = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(content);
  return `${content}.${signer.sign(configuration.privateKey).toString('base64url')}`;
}

export function createInstallationState(
  organizationId: string,
  userId: string,
  secret: string,
): string {
  const payload = Buffer.from(
    JSON.stringify({ organizationId, userId, expiresAt: Date.now() + 10 * 60_000 }),
  ).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyInstallationState(raw: string, secret: string) {
  const [payload, signature] = raw.split('.');
  if (!payload || !signature) throw new Error('Invalid GitHub installation state');
  const expected = createHmac('sha256', secret).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid GitHub installation state');
  }
  const state = stateSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
  if (state.expiresAt < Date.now()) throw new Error('Expired GitHub installation state');
  return state;
}
