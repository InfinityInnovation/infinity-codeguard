import { createSign } from 'node:crypto';
import { database } from '@codeguard/database';

type Configuration = { appId: string; privateKey: string };

function configuration(): Configuration | null {
  const appId = process.env.GITHUB_APP_ID;
  const encodedKey = process.env.GITHUB_APP_PRIVATE_KEY_BASE64;
  if (!appId || !encodedKey) return null;
  return { appId, privateKey: Buffer.from(encodedKey, 'base64').toString('utf8') };
}

function appJwt(config: Configuration): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: config.appId }),
  ).toString('base64url');
  const content = `${header}.${payload}`;
  const signer = createSign('RSA-SHA256');
  signer.update(content);
  return `${content}.${signer.sign(config.privateKey).toString('base64url')}`;
}

export async function githubInstallationToken(
  organizationId: string,
  repositoryUrl: URL,
): Promise<string | null> {
  if (repositoryUrl.hostname.toLowerCase() !== 'github.com') return null;
  const config = configuration();
  const installation = await database.gitHubInstallation.findUnique({ where: { organizationId } });
  if (!config || !installation || installation.suspendedAt) return null;
  const repositoryName = repositoryUrl.pathname
    .replace(/^\//, '')
    .replace(/\.git$/, '')
    .split('/')[1];
  if (!repositoryName) throw new Error('Nom du dépôt GitHub invalide.');
  const response = await fetch(
    `https://api.github.com/app/installations/${installation.installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${appJwt(config)}`,
        'content-type': 'application/json',
        'x-github-api-version': '2026-03-10',
        'user-agent': 'Infinity-CodeGuard-Worker',
      },
      body: JSON.stringify({ repositories: [repositoryName], permissions: { contents: 'read' } }),
    },
  );
  if (!response.ok) {
    throw new Error(
      response.status === 404
        ? 'Ce dépôt privé n’est pas autorisé dans l’installation GitHub de cette organisation.'
        : 'Impossible de créer un jeton GitHub temporaire pour cette analyse.',
    );
  }
  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== 'string') throw new Error('Réponse GitHub invalide.');
  return body.token;
}
